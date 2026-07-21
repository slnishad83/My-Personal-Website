"use strict";

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, getAdmin } = require("./admin");
const { requireAuth } = require("./helpers");

function hashPinServer(pin, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(pin, salt, 100000, 64, "sha512", (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString("hex"));
    });
  });
}

const _pinRateLimit = new Map();
function checkPinRateLimit(uid, action) {
  const key = `${uid}:${action}`;
  const now = Date.now();
  const entry = _pinRateLimit.get(key);
  if (entry && now - entry.start < 60000 && entry.count >= 10) return false;
  if (!entry || now - entry.start >= 60000) _pinRateLimit.set(key, { start: now, count: 1 });
  else entry.count++;
  return true;
}

exports.setChatPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "set")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin, oldPin } = request.data;
  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin))
    throw new HttpsError("invalid-argument", "PIN must be 4-8 digits");

  const db = getDb();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.pinSalt && userData.pinHash) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, userData.pinSalt);
    if (oldHash !== userData.pinHash) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await db.collection("users").doc(uid).set({ pinSalt: salt, pinHash: hash, pinUpdatedAt: Date.now() }, { merge: true });
  return { ok: true };
});

exports.verifyChatPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data;
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = getDb();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  if (!userData.pinHash || !userData.pinSalt) {
    throw new HttpsError("failed-precondition", "No chat PIN set. Use setChatPin to create one.");
  }

  const hash = await hashPinServer(pin, userData.pinSalt);
  if (hash !== userData.pinHash) throw new HttpsError("permission-denied", "Incorrect PIN");
  return { ok: true };
});

exports.resetChatPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "reset")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  await getDb().collection("users").doc(uid).set(
    { pinSalt: getAdmin().firestore.FieldValue.delete(), pinHash: getAdmin().firestore.FieldValue.delete(), pinResetAt: Date.now() },
    { merge: true }
  );
  return { ok: true };
});

exports.setTwoFactorPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-set")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin, oldPin } = request.data;
  if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin))
    throw new HttpsError("invalid-argument", "PIN must be 4-8 digits");

  const db = getDb();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};
  if (userData.twofaPinHash && userData.twofaPinSalt) {
    if (!oldPin) throw new HttpsError("invalid-argument", "Old PIN required");
    const oldHash = await hashPinServer(oldPin, userData.twofaPinSalt);
    if (oldHash !== userData.twofaPinHash) throw new HttpsError("permission-denied", "Incorrect current PIN");
  }

  const salt = crypto.randomBytes(32).toString("hex");
  const hash = await hashPinServer(pin, salt);
  await db.collection("users").doc(uid).set({ twofaPinSalt: salt, twofaPinHash: hash, twofaEnabled: true, twofaUpdatedAt: Date.now() }, { merge: true });
  return { ok: true };
});

exports.verifyTwoFactorPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-verify")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  const { pin } = request.data;
  if (!pin || typeof pin !== "string") throw new HttpsError("invalid-argument", "Missing PIN");

  const db = getDb();
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data() || {};

  if (!userData.twofaPinHash || !userData.twofaPinSalt) {
    throw new HttpsError("failed-precondition", "No 2FA PIN set. Use setTwoFactorPin to create one.");
  }

  const hash = await hashPinServer(pin, userData.twofaPinSalt);
  if (hash !== userData.twofaPinHash) throw new HttpsError("permission-denied", "Incorrect PIN");
  return { ok: true };
});

exports.resetTwoFactorPin = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  if (!checkPinRateLimit(uid, "2fa-reset")) throw new HttpsError("resource-exhausted", "Too many attempts. Wait a minute.");
  await getDb().collection("users").doc(uid).set(
    {
      twofaPinSalt: getAdmin().firestore.FieldValue.delete(),
      twofaPinHash: getAdmin().firestore.FieldValue.delete(),
      twofaEnabled: false,
      twofaResetAt: Date.now()
    },
    { merge: true }
  );
  return { ok: true };
});
