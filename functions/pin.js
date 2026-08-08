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

// All PIN secrets live in the private userSecrets/<uid> collection so that
// Firestore rules can keep them owner-only. Fields are lazily migrated out of
// users/<uid> (legacy storage) on first access.
const _SECRET_KEYS = [
  "pinHash", "pinSalt", "pinUpdatedAt", "pinResetAt",
  "twofaPinHash", "twofaPinSalt", "twofaUpdatedAt", "twofaResetAt",
  "appLockPinHash", "appLockPinSalt", "appLockUpdatedAt", "appLockResetAt",
];

async function _getSecret(db, uid) {
  const secretRef = db.collection("userSecrets").doc(uid);
  const secretDoc = await secretRef.get();
  const data = secretDoc.data() || {};
  if (!data.pinHash && !data.twofaPinHash && !data.appLockPinHash) {
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() || {};
    const legacy = {};
    for (const key of _SECRET_KEYS) {
      if (userData[key] !== undefined) legacy[key] = userData[key];
    }
    if (Object.keys(legacy).length > 0) {
      await secretRef.set(legacy, { merge: true });
      const deletes = {};
      for (const key of Object.keys(legacy)) deletes[key] = admin.firestore.FieldValue.delete();
      await db.collection("users").doc(uid).update(deletes).catch(() => {});
    }
  }
  return data;
}

async function _setSecretField(db, uid, fields) {
  await db.collection("userSecrets").doc(uid).set(fields, { merge: true });
}

async function _deleteSecretFields(db, uid, keys) {
  const deletes = {};
  for (const key of keys) deletes[key] = admin.firestore.FieldValue.delete();
  await db.collection("userSecrets").doc(uid).update(deletes);
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
  const secretData = await _getSecret(db, uid);
  if (secretData.pinSalt && secretData.pinHash) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, secretData.pinSalt);
    if (!timingSafeEqual(oldHash, secretData.pinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await _setSecretField(db, uid, { pinSalt: salt, pinHash: hash, pinUpdatedAt: Date.now() });
  clearPinFailures(uid);
  return { ok: true };
});

exports.verifyChatPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data || {};
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = admin.firestore();
  const secretData = await _getSecret(db, uid);

  if (!secretData.pinHash || !secretData.pinSalt) {
    throw new HttpsError("failed-precondition", "No chat PIN set. Use setChatPin to create one.");
  }

  const hash = await hashPinServer(pin, secretData.pinSalt);
  if (!timingSafeEqual(hash, secretData.pinHash)) {
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
  const secretData = await _getSecret(db, uid);
  if (secretData.pinSalt && secretData.pinHash) {
    if (!oldPin || typeof oldPin !== "string") throw new HttpsError("invalid-argument", "Old PIN required to reset");
    const oldHash = await hashPinServer(oldPin, secretData.pinSalt);
    if (!timingSafeEqual(oldHash, secretData.pinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }
  await _deleteSecretFields(db, uid, ["pinSalt", "pinHash"]);
  await _setSecretField(db, uid, { pinResetAt: Date.now() });
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
  const secretData = await _getSecret(db, uid);
  if (secretData.twofaPinHash && secretData.twofaPinSalt) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, secretData.twofaPinSalt);
    if (!timingSafeEqual(oldHash, secretData.twofaPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await _setSecretField(db, uid, { twofaPinSalt: salt, twofaPinHash: hash, twofaUpdatedAt: Date.now() });
  await db.collection("users").doc(uid).set({ twofaEnabled: true }, { merge: true });
  clearPinFailures(uid);
  return { ok: true };
});

exports.verifyTwoFactorPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data || {};
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = admin.firestore();
  const secretData = await _getSecret(db, uid);

  if (!secretData.twofaPinHash || !secretData.twofaPinSalt) {
    throw new HttpsError("failed-precondition", "No 2FA PIN set. Use setTwoFactorPin to create one.");
  }

  const hash = await hashPinServer(pin, secretData.twofaPinSalt);
  if (!timingSafeEqual(hash, secretData.twofaPinHash)) {
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
  const secretData = await _getSecret(db, uid);
  if (secretData.twofaPinHash && secretData.twofaPinSalt) {
    if (!oldPin || typeof oldPin !== "string") throw new HttpsError("invalid-argument", "Old PIN required to reset 2FA");
    const oldHash = await hashPinServer(oldPin, secretData.twofaPinSalt);
    if (!timingSafeEqual(oldHash, secretData.twofaPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }
  await _deleteSecretFields(db, uid, ["twofaPinSalt", "twofaPinHash"]);
  await _setSecretField(db, uid, { twofaResetAt: Date.now() });
  await db.collection("users").doc(uid).set({ twofaEnabled: false }, { merge: true });
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
  const secretData = await _getSecret(db, uid);
  if (secretData.appLockPinHash && secretData.appLockPinSalt) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, secretData.appLockPinSalt);
    if (!timingSafeEqual(oldHash, secretData.appLockPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await _setSecretField(db, uid, { appLockPinSalt: salt, appLockPinHash: hash, appLockUpdatedAt: Date.now() });
  await db.collection("users").doc(uid).set({ appLockEnabled: true }, { merge: true });
  clearPinFailures(uid);
  return { ok: true };
});

exports.verifyAppLockPin = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "applock-verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data || {};
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = admin.firestore();
  const secretData = await _getSecret(db, uid);

  if (!secretData.appLockPinHash || !secretData.appLockPinSalt) {
    throw new HttpsError("failed-precondition", "No app lock PIN set. Use setAppLockPin to create one.");
  }

  const hash = await hashPinServer(pin, secretData.appLockPinSalt);
  if (!timingSafeEqual(hash, secretData.appLockPinHash)) {
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
  const secretData = await _getSecret(db, uid);
  if (secretData.appLockPinHash && secretData.appLockPinSalt) {
    if (!oldPin || typeof oldPin !== "string") throw new HttpsError("invalid-argument", "Old PIN required to reset");
    const oldHash = await hashPinServer(oldPin, secretData.appLockPinSalt);
    if (!timingSafeEqual(oldHash, secretData.appLockPinHash)) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }
  await _deleteSecretFields(db, uid, ["appLockPinSalt", "appLockPinHash"]);
  await _setSecretField(db, uid, { appLockResetAt: Date.now() });
  await db.collection("users").doc(uid).set({ appLockEnabled: false }, { merge: true });
  clearPinFailures(uid);
  return { ok: true };
});
