"use strict";

// Thin entry point — re-exports all Cloud Functions from lib/ modules.
// admin.initializeApp() is LAZY (only runs on first function invocation),
// not at module parse time. This prevents deployment timeout errors.

const webhooks = require("./lib/webhooks");
const ai = require("./lib/ai");
const user = require("./lib/user");
const pin = require("./lib/pin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// HTTP functions
exports.getTurnCredentials = webhooks.getTurnCredentials;
exports.sendNotificationReply = webhooks.sendNotificationReply;
exports.generateUrlPreview = webhooks.generateUrlPreview;
exports.lookupVerifiedUserByEmailV2 = webhooks.lookupVerifiedUserByEmailV2;
exports.repairGroupAccessMetadata = webhooks.repairGroupAccessMetadata;

// AI / Gemini functions
exports.catchMeUp = ai.catchMeUp;
exports.aiChatBot = ai.aiChatBot;
exports.generateMeetingNotes = ai.generateMeetingNotes;
exports.analyzeTone = ai.analyzeTone;
exports.autoTagChat = ai.autoTagChat;
exports.aiSearchMessages = ai.aiSearchMessages;
exports.classifyNotification = ai.classifyNotification;

// User management functions
exports.leaveGroup = user.leaveGroup;
exports.adminDeleteUser = user.adminDeleteUser;
exports.adminBanUser = user.adminBanUser;
exports.adminUnbanUser = user.adminUnbanUser;
exports.deleteUserAccount = user.deleteUserAccount;

// PIN / 2FA functions
exports.setChatPin = pin.setChatPin;
exports.verifyChatPin = pin.verifyChatPin;
exports.resetChatPin = pin.resetChatPin;
exports.setTwoFactorPin = pin.setTwoFactorPin;
exports.verifyTwoFactorPin = pin.verifyTwoFactorPin;
exports.resetTwoFactorPin = pin.resetTwoFactorPin;

// Scheduled cleanup — removes orphaned uploads older than 7 days
// Only deletes files NOT referenced by any Firestore message document.
exports.weeklyOrphanedUploadCleanup = onSchedule(
  { schedule: "every monday 03:00", region: "us-central1", memory: 128 },
  async () => {
    const admin = require("firebase-admin");
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: "chat_uploads/" });
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let skipped = 0;
    for (const file of files) {
      const [meta] = await file.getMetadata();
      const created = new Date(meta.timeCreated).getTime();
      if (created >= cutoff) { skipped++; continue; }
      try {
        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(file.name)}`;
        const directSnap = await db.collection('messages')
          .where('attachments', 'array-contains-any', [{ url: fileUrl }])
          .limit(1).get();
        if (!directSnap.empty) { skipped++; continue; }
        const urlSnap = await db.collection('messages')
          .where('attachments', 'array-contains', fileUrl)
          .limit(1).get();
        if (!urlSnap.empty) { skipped++; continue; }
        const fieldSnap = await db.collection('messages')
          .where('text', 'array-contains', fileUrl)
          .limit(1).get();
        if (!fieldSnap.empty) { skipped++; continue; }
        await file.delete();
        deleted++;
      } catch (_) { skipped++; }
    }
    console.log(`Cleanup: deleted ${deleted} orphaned files, skipped ${skipped}`);
  }
);

// Server-side self-destruct: deletes ephemeral messages whose timer has expired.
// Runs every 5 minutes to enforce disappearing messages even when clients are offline.
exports.serverSelfDestruct = onSchedule(
  { schedule: "every 5 minutes", region: "us-central1", memory: 128 },
  async () => {
    const admin = require("firebase-admin");
    if (!admin.apps.length) admin.initializeApp();
    const db = admin.firestore();
    const now = Date.now();
    let deletedTotal = 0;

    // Scan groups with ephemeralTimer set
    const groupsSnap = await db.collection('groups').where('ephemeralTimer', '>', 0).get();
    for (const groupDoc of groupsSnap.docs) {
      const timer = groupDoc.data().ephemeralTimer;
      const cutoff = now - timer;
      const msgsSnap = await db.collection('messages')
        .where('groupId', '==', groupDoc.id)
        .where('time', '<', cutoff)
        .where('ephemeral', '==', true)
        .limit(50).get();
      const batch = db.batch();
      for (const msg of msgsSnap.docs) {
        batch.delete(msg.ref);
        deletedTotal++;
      }
      if (msgsSnap.docs.length > 0) await batch.commit();
    }

    // Scan direct chats with ephemeralTimer set
    const chatsSnap = await db.collection('directChats').where('ephemeralTimer', '>', 0).get();
    for (const chatDoc of chatsSnap.docs) {
      const timer = chatDoc.data().ephemeralTimer;
      const cutoff = now - timer;
      const msgsSnap = await db.collection('messages')
        .where('chatId', '==', chatDoc.id)
        .where('time', '<', cutoff)
        .where('ephemeral', '==', true)
        .limit(50).get();
      const batch = db.batch();
      for (const msg of msgsSnap.docs) {
        batch.delete(msg.ref);
        deletedTotal++;
      }
      if (msgsSnap.docs.length > 0) await batch.commit();
    }

    console.log(`Self-destruct: deleted ${deletedTotal} expired ephemeral messages`);
  }
);
