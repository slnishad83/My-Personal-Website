"use strict";

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const _adminModule = require("firebase-admin");
let _adminInitialized = false;
const admin = new Proxy({}, {
  get(_target, prop) {
    if (!_adminInitialized) {
      _adminModule.initializeApp();
      _adminInitialized = true;
    }
    return _adminModule[prop];
  }
});

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  return request.auth.uid;
}

function hashPinServer(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(pin, salt, 100000, 64, "sha512", (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString("hex"));
    });
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

const _pinRateLimit = new Map();
const _pinFailures = new Map();
let _pinCleanupStarted = false;
const PIN_WINDOW = 60 * 1000;
const PIN_MAX = 5;
const LOCKOUT_BASE = 5 * 60 * 1000;
const LOCKOUT_MAX = 60 * 60 * 1000;

// Cleanup expired entries lazily on first use (prevents event loop leak during deploy)
function _startPinCleanup() {
  if (_pinCleanupStarted) return;
  _pinCleanupStarted = true;
  const t = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of _pinRateLimit) {
      if (now - entry.start > PIN_WINDOW * 2) _pinRateLimit.delete(key);
    }
    for (const [key, entry] of _pinFailures) {
      if (now - entry.lastFail > LOCKOUT_MAX * 2) _pinFailures.delete(key);
    }
  }, 300000);
  if (t && typeof t.unref === 'function') t.unref();
}

function getLockoutDuration(failures) {
  const level = Math.min(failures - PIN_MAX, 5);
  return Math.min(LOCKOUT_BASE * Math.pow(2, level), LOCKOUT_MAX);
}

function checkPinRateLimit(uid, action) {
  _startPinCleanup();
  const key = `${uid}:${action}`;
  const now = Date.now();
  const failKey = `${uid}:failures`;
  const failEntry = _pinFailures.get(failKey);
  if (failEntry && failEntry.count >= PIN_MAX) {
    const lockoutDuration = getLockoutDuration(failEntry.count);
    if (now - failEntry.lastFail < lockoutDuration) {
      return false;
    }
    _pinFailures.delete(failKey);
  }
  const entry = _pinRateLimit.get(key);
  if (entry && now - entry.start < PIN_WINDOW && entry.count >= 10) return false;
  if (!entry || now - entry.start >= PIN_WINDOW) _pinRateLimit.set(key, { start: now, count: 1 });
  else entry.count++;
  return true;
}

function recordPinFailure(uid) {
  const failKey = `${uid}:failures`;
  const entry = _pinFailures.get(failKey);
  const now = Date.now();
  if (!entry || now - entry.lastFail > LOCKOUT_MAX * 2) {
    _pinFailures.set(failKey, { count: 1, lastFail: now });
  } else {
    entry.count++;
    entry.lastFail = now;
  }
}

function clearPinFailures(uid) {
  _pinFailures.delete(`${uid}:failures`);
}

exports.setChatPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "set")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin, oldPin } = request.data || {};
  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin))
    throw new HttpsError("invalid-argument", "PIN must be 4-8 digits");

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.pinSalt && userData.pinHash) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, userData.pinSalt);
    if (!timingSafeEqual(oldHash, userData.pinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await db.collection("users").doc(uid).set({ pinSalt: salt, pinHash: hash, pinUpdatedAt: Date.now() }, { merge: true });
  clearPinFailures(uid);
  return { ok: true };
});

exports.verifyChatPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data || {};
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  if (!userData.pinHash || !userData.pinSalt) {
    throw new HttpsError("failed-precondition", "No chat PIN set. Use setChatPin to create one.");
  }

  const hash = await hashPinServer(pin, userData.pinSalt);
  if (!timingSafeEqual(hash, userData.pinHash)) {
    recordPinFailure(uid);
    throw new HttpsError("permission-denied", "Incorrect PIN");
  }
  clearPinFailures(uid);
  return { ok: true };
});

exports.resetChatPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "reset")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { oldPin } = request.data || {};
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.pinSalt && userData.pinHash) {
    if (!oldPin || typeof oldPin !== "string") throw new HttpsError("invalid-argument", "Old PIN required to reset");
    const oldHash = await hashPinServer(oldPin, userData.pinSalt);
    if (!timingSafeEqual(oldHash, userData.pinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }
  await db.collection("users").doc(uid).set(
    { pinSalt: admin.firestore.FieldValue.delete(), pinHash: admin.firestore.FieldValue.delete(), pinResetAt: Date.now() },
    { merge: true }
  );
  clearPinFailures(uid);
  return { ok: true };
});

exports.setTwoFactorPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-set")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin, oldPin } = request.data || {};
  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin))
    throw new HttpsError("invalid-argument", "PIN must be 4-8 digits");

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.twofaPinHash && userData.twofaPinSalt) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, userData.twofaPinSalt);
    if (!timingSafeEqual(oldHash, userData.twofaPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await db.collection("users").doc(uid).set({ twofaPinSalt: salt, twofaPinHash: hash, twofaEnabled: true, twofaUpdatedAt: Date.now() }, { merge: true });
  clearPinFailures(uid);
  return { ok: true };
});

exports.verifyTwoFactorPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data || {};
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  if (!userData.twofaPinHash || !userData.twofaPinSalt) {
    throw new HttpsError("failed-precondition", "No 2FA PIN set. Use setTwoFactorPin to create one.");
  }

  const hash = await hashPinServer(pin, userData.twofaPinSalt);
  if (!timingSafeEqual(hash, userData.twofaPinHash)) {
    recordPinFailure(uid);
    throw new HttpsError("permission-denied", "Incorrect PIN");
  }
  clearPinFailures(uid);
  return { ok: true };
});

exports.resetTwoFactorPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-reset")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { oldPin } = request.data || {};
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.twofaPinHash && userData.twofaPinSalt) {
    if (!oldPin || typeof oldPin !== "string") throw new HttpsError("invalid-argument", "Old PIN required to reset 2FA");
    const oldHash = await hashPinServer(oldPin, userData.twofaPinSalt);
    if (!timingSafeEqual(oldHash, userData.twofaPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }
  await db.collection("users").doc(uid).set(
    {
      twofaPinSalt: admin.firestore.FieldValue.delete(),
      twofaPinHash: admin.firestore.FieldValue.delete(),
      twofaEnabled: false,
      twofaResetAt: Date.now()
    },
    { merge: true }
  );
  clearPinFailures(uid);
  return { ok: true };
});

exports.setAppLockPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "applock-set")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin, oldPin } = request.data || {};
  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))
    throw new HttpsError("invalid-argument", "PIN must be 4-6 digits");

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.appLockPinHash && userData.appLockPinSalt) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, userData.appLockPinSalt);
    if (!timingSafeEqual(oldHash, userData.appLockPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await db.collection("users").doc(uid).set({ appLockPinSalt: salt, appLockPinHash: hash, appLockEnabled: true, appLockUpdatedAt: Date.now() }, { merge: true });
  clearPinFailures(uid);
  return { ok: true };
});

exports.verifyAppLockPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "applock-verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data || {};
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  if (!userData.appLockPinHash || !userData.appLockPinSalt) {
    throw new HttpsError("failed-precondition", "No app lock PIN set. Use setAppLockPin to create one.");
  }

  const hash = await hashPinServer(pin, userData.appLockPinSalt);
  if (!timingSafeEqual(hash, userData.appLockPinHash)) {
    recordPinFailure(uid);
    throw new HttpsError("permission-denied", "Incorrect PIN");
  }
  clearPinFailures(uid);
  return { ok: true };
});

exports.resetAppLockPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "applock-reset")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { oldPin } = request.data || {};
  const db = admin.firestore();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.appLockPinHash && userData.appLockPinSalt) {
    if (!oldPin || typeof oldPin !== "string") throw new HttpsError("invalid-argument", "Old PIN required to reset");
    const oldHash = await hashPinServer(oldPin, userData.appLockPinSalt);
    if (!timingSafeEqual(oldHash, userData.appLockPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }
  await db.collection("users").doc(uid).set(
    {
      appLockPinSalt: admin.firestore.FieldValue.delete(),
      appLockPinHash: admin.firestore.FieldValue.delete(),
      appLockEnabled: false,
      appLockResetAt: Date.now()
    },
    { merge: true }
  );
  clearPinFailures(uid);
  return { ok: true };
});
