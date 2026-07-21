"use strict";

// Thin entry point — re-exports all Cloud Functions from lib/ modules.
// admin.initializeApp() is LAZY (only runs on first function invocation),
// not at module parse time. This prevents deployment timeout errors.

const webhooks = require("./lib/webhooks");
const ai = require("./lib/ai");
const user = require("./lib/user");
const pin = require("./lib/pin");

// HTTP functions
exports.getTurnCredentials = webhooks.getTurnCredentials;
exports.sendNotificationReply = webhooks.sendNotificationReply;
exports.generateUrlPreview = webhooks.generateUrlPreview;
exports.lookupVerifiedUserByEmailV2 = webhooks.lookupVerifiedUserByEmailV2;
exports.repairGroupAccessMetadata = webhooks.repairGroupAccessMetadata;

// AI / Gemini functions
exports.catchMeUp = ai.catchMeUp;
exports.transcribeVoiceMessage = ai.transcribeVoiceMessage;
exports.aiChatBot = ai.aiChatBot;
exports.summarizeThread = ai.summarizeThread;
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
