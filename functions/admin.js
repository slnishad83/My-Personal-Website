const { onCall, HttpsError } = require('firebase-functions/v2/https');

const _adminModule = require('firebase-admin');
const admin = new Proxy({}, {
  get(_target, prop) {
    if (!_adminModule.getApps().length) {
      _adminModule.initializeApp();
    }
    return _adminModule[prop];
  }
});

const ADMIN_EMAIL = 'sl.nishad@gmail.com';

async function assertAdmin(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const userRecord = await admin.auth().getUser(auth.uid);
  if (userRecord.email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Admin access only.');
  }
}

exports.adminBanUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const { targetUid, reason } = request.data || {};
    if (!targetUid) throw new HttpsError('invalid-argument', 'Missing targetUid.');

    // Mark banned in Firestore
    await admin.firestore().collection('users').doc(targetUid).set({
      banned: true,
      banReason: reason || '',
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      bannedBy: request.auth.uid,
    }, { merge: true });

    // Disable in Firebase Auth
    try { await admin.auth().updateUser(targetUid, { disabled: true }); } catch (_) {}

    // Revoke all active sessions
    try {
      const sessions = await admin.firestore()
        .collection('userSessions')
        .where('userId', '==', targetUid)
        .where('isActive', '==', true)
        .get();
      for (let i = 0; i < sessions.docs.length; i += 500) {
        const batch = admin.firestore().batch();
        sessions.docs.slice(i, i + 500).forEach(doc => batch.update(doc.ref, { revoked: true, isActive: false }));
        await batch.commit();
      }
    } catch (_) {}

    return { ok: true };
  }
);

exports.adminUnbanUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const { targetUid } = request.data || {};
    if (!targetUid) throw new HttpsError('invalid-argument', 'Missing targetUid.');

    await admin.firestore().collection('users').doc(targetUid).set({
      banned: false,
      banReason: '',
      unbannedAt: admin.firestore.FieldValue.serverTimestamp(),
      unbannedBy: request.auth.uid,
    }, { merge: true });

    try { await admin.auth().updateUser(targetUid, { disabled: false }); } catch (_) {}

    return { ok: true };
  }
);

exports.adminListUsers = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const snap = await admin.firestore().collection('users')
      .orderBy('createdAt', 'desc').limit(500).get();
    return { users: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  }
);

exports.adminDeleteUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const { targetUid } = request.data || {};
    if (!targetUid) throw new HttpsError('invalid-argument', 'Missing targetUid.');
    if (targetUid === request.auth.uid) throw new HttpsError('invalid-argument', 'Cannot delete your own admin account.');

    // Helper: batch-delete documents from a collection query
    async function batchDeleteQuery(query) {
      const snap = await query.get();
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = admin.firestore().batch();
        snap.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    // 1. Delete from Firebase Auth
    try { await admin.auth().deleteUser(targetUid); } catch (_) {}

    // 2. Delete Firestore user document
    try { await admin.firestore().collection('users').doc(targetUid).delete(); } catch (_) {}

    // 3. Remove all sessions
    try { await batchDeleteQuery(admin.firestore().collection('userSessions').where('userId', '==', targetUid)); } catch (_) {}

    // 4. Remove username reservation
    try { await batchDeleteQuery(admin.firestore().collection('usernames').where('uid', '==', targetUid)); } catch (_) {}

    // 5. Remove group memberships
    try { await batchDeleteQuery(admin.firestore().collection('groupMembers').where('userId', '==', targetUid)); } catch (_) {}

    // 6. Remove chat requests (sent or received)
    try { await batchDeleteQuery(admin.firestore().collection('chatRequests').where('fromUserId', '==', targetUid)); } catch (_) {}
    try { await batchDeleteQuery(admin.firestore().collection('chatRequests').where('toUserId', '==', targetUid)); } catch (_) {}

    // 7. Remove group join requests
    try { await batchDeleteQuery(admin.firestore().collection('groupJoinRequests').where('userId', '==', targetUid)); } catch (_) {}

    // 8. Remove group invites
    try { await batchDeleteQuery(admin.firestore().collection('groupInvites').where('fromUserId', '==', targetUid)); } catch (_) {}
    try { await batchDeleteQuery(admin.firestore().collection('groupInvites').where('toUserId', '==', targetUid)); } catch (_) {}

    // 9. Remove blocked users entries
    try { await batchDeleteQuery(admin.firestore().collection('blockedUsers').where('userId', '==', targetUid)); } catch (_) {}
    try { await batchDeleteQuery(admin.firestore().collection('blockedUsers').where('blockedUserId', '==', targetUid)); } catch (_) {}

    // 10. Remove favorite chats
    try { await batchDeleteQuery(admin.firestore().collection('favoriteChats').where('userId', '==', targetUid)); } catch (_) {}

    // 11. Remove archived chats
    try { await batchDeleteQuery(admin.firestore().collection('archivedChats').where('userId', '==', targetUid)); } catch (_) {}

    // 12. Remove locked chats
    try { await batchDeleteQuery(admin.firestore().collection('lockedChats').where('userId', '==', targetUid)); } catch (_) {}

    // 13. Remove muted chats
    try { await batchDeleteQuery(admin.firestore().collection('mutedChats').where('userId', '==', targetUid)); } catch (_) {}

    // 14. Remove deleted chats
    try { await batchDeleteQuery(admin.firestore().collection('deletedChats').where('userId', '==', targetUid)); } catch (_) {}

    // 15. Remove notification preferences
    try { await batchDeleteQuery(admin.firestore().collection('chatNotifSettings').where('userId', '==', targetUid)); } catch (_) {}

    // 16. Remove in-app notifications (sent and received)
    try { await batchDeleteQuery(admin.firestore().collection('inAppNotifications').where('toUserId', '==', targetUid)); } catch (_) {}
    try { await batchDeleteQuery(admin.firestore().collection('inAppNotifications').where('fromUserId', '==', targetUid)); } catch (_) {}

    // 17. Remove notification telemetry
    try { await batchDeleteQuery(admin.firestore().collection('notificationTelemetry').where('userId', '==', targetUid)); } catch (_) {}

    // 18. Remove statuses
    try { await batchDeleteQuery(admin.firestore().collection('statuses').where('userId', '==', targetUid)); } catch (_) {}

    // 19. Remove typing indicators
    try { await batchDeleteQuery(admin.firestore().collection('typingIndicators').where('userId', '==', targetUid)); } catch (_) {}

    // 20. Remove typing status
    try { await batchDeleteQuery(admin.firestore().collection('typingStatus').where('userId', '==', targetUid)); } catch (_) {}

    // 21. Remove user reports filed by or against this user
    try { await batchDeleteQuery(admin.firestore().collection('userReports').where('reporterId', '==', targetUid)); } catch (_) {}
    try { await batchDeleteQuery(admin.firestore().collection('userReports').where('reportedUserId', '==', targetUid)); } catch (_) {}

    // 22. Remove message reports
    try { await batchDeleteQuery(admin.firestore().collection('messageReports').where('reporterId', '==', targetUid)); } catch (_) {}

    // 23. Remove blocked words
    try { await batchDeleteQuery(admin.firestore().collection('blockedWords').where('userId', '==', targetUid)); } catch (_) {}

    // 24. Remove pinned/starred messages
    try { await batchDeleteQuery(admin.firestore().collection('pinnedMessages').where('userId', '==', targetUid)); } catch (_) {}
    try { await batchDeleteQuery(admin.firestore().collection('starredMessages').where('userId', '==', targetUid)); } catch (_) {}

    // 25. Remove calendar events
    try { await batchDeleteQuery(admin.firestore().collection('calendarEvents').where('userId', '==', targetUid)); } catch (_) {}

    // 26. Remove tasks
    try { await batchDeleteQuery(admin.firestore().collection('tasks').where('userId', '==', targetUid)); } catch (_) {}
    try { await batchDeleteQuery(admin.firestore().collection('tasks').where('assignedTo', '==', targetUid)); } catch (_) {}

    // 27. Remove scheduled messages
    try { await batchDeleteQuery(admin.firestore().collection('scheduledMessages').where('senderId', '==', targetUid)); } catch (_) {}

    // 28. Mark messages as deleted (don't batch-delete all messages — too expensive, but anonymize)
    try {
      const msgSnap = await admin.firestore().collection('messages').where('senderId', '==', targetUid).limit(500).get();
      for (let i = 0; i < msgSnap.docs.length; i += 500) {
        const batch = admin.firestore().batch();
        msgSnap.docs.slice(i, i + 500).forEach(doc => batch.update(doc.ref, {
          senderName: 'Deleted User',
          senderAvatar: '',
          deletedByAdmin: true
        }));
        await batch.commit();
      }
    } catch (_) {}

    return { ok: true };
  }
);
