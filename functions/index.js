const MODULES = {
  sendNewChatRequestNotification: 'notifications',
  sendChatRequestStatusNotification: 'notifications',
  sendGroupJoinRequestNotification: 'notifications',
  sendIncomingCallNotification: 'notifications',
  sendIncomingGroupCallNotification: 'notifications',
  sendMissedCallNotification: 'notifications',
  clearEndedCallNotification: 'notifications',
  fanOutCallStateChange: 'notifications',
  sendStatusUpdateNotification: 'notifications',
  sendMessageNotification: 'notifications',
  sendReactionNotification: 'notifications',
  busyAutoReply: 'notifications',
  syncReadStatus: 'notifications',
  exportCallToCallLog: 'notifications',
  lookupVerifiedUserByEmail: 'http',
  lookupVerifiedUserByEmailV2: 'http',
  repairGroupAccessMetadata: 'http',
  getTurnCredentials: 'http',
  migrateCallsToCallLogs: 'http',
  backfillMessageEmails: 'http',
  sendNotificationReply: 'http',
  generateUrlPreview: 'http',
  youtubeSearch: 'http',
  aiChatBot: 'callables',
  summarizeThread: 'callables',
  explainMessage: 'callables',
  transcribeVoiceMessage: 'callables',
  catchMeUp: 'callables',
  detectCalendarEvent: 'callables',
  muteChatNotification: 'callables',
  setDndSchedule: 'callables',
  syncGroupMemberCreated: 'triggers',
  syncGroupMemberUpdated: 'triggers',
  syncGroupMemberDeleted: 'triggers',
  cleanupMessageAttachment: 'triggers',
  weeklyOrphanedUploadCleanup: 'triggers',
  runMigrationOnTrigger: 'triggers',
  adminBanUser: 'admin',
  adminUnbanUser: 'admin',
  adminListUsers: 'admin',
  adminDeleteUser: 'admin',
  setChatPin: 'pin',
  verifyChatPin: 'pin',
  resetChatPin: 'pin',
  setTwoFactorPin: 'pin',
  verifyTwoFactorPin: 'pin',
  resetTwoFactorPin: 'pin',
  addGroupMembers: 'groups',
  removeGroupMember: 'groups',
  promoteGroupAdmin: 'groups',
  demoteGroupAdmin: 'groups',
  exitGroup: 'groups',
  deleteGroup: 'groups',
};

for (const [name, mod] of Object.entries(MODULES)) {
  Object.defineProperty(module.exports, name, {
    enumerable: true,
    configurable: true,
    get() {
      const val = require('./' + mod)[name];
      Object.defineProperty(module.exports, name, {
        value: val,
        writable: true,
        enumerable: true,
        configurable: true
      });
      return val;
    }
  });
}
