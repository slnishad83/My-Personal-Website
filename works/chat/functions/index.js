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
exports.weeklyOrphanedUploadCleanup = onSchedule(
  { schedule: "every monday 03:00", region: "us-central1", memory: 128 },
  async () => {
    const admin = require("firebase-admin");
    if (!admin.apps.length) admin.initializeApp();
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: "chat_uploads/" });
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const file of files) {
      const [meta] = await file.getMetadata();
      const created = new Date(meta.timeCreated).getTime();
      if (created < cutoff) {
        try { await file.delete(); deleted++; } catch (_) {}
      }
    }
    console.log(`Cleanup: deleted ${deleted} orphaned files`);
  }
);
