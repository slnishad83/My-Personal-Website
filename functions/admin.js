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

const SENSITIVE_FIELDS = ['fcmTokens', 'pinHash', 'pinSalt', 'twofaPinHash', 'twofaPinSalt'];

async function assertAdmin(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const userRecord = await admin.auth().getUser(auth.uid);
  if (!userRecord.customClaims || !userRecord.customClaims.admin) {
    throw new HttpsError('permission-denied', 'Admin access only.');
  }
}

exports.adminBanUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const { targetUid, reason } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Missing targetUid.');

    await admin.firestore().collection('users').doc(targetUid).set({
      banned: true,
      banReason: String(reason || '').slice(0, 500),
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      bannedBy: request.auth.uid,
    }, { merge: true });

    try { await admin.auth().updateUser(targetUid, { disabled: true }); }
    catch (e) { console.error('[adminBanUser] Auth disable failed:', e.message); }

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
    } catch (e) { console.error('[adminBanUser] Session revoke failed:', e.message); }

    return { ok: true };
  }
);

exports.adminUnbanUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const { targetUid } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Missing targetUid.');

    await admin.firestore().collection('users').doc(targetUid).set({
      banned: false,
      banReason: '',
      unbannedAt: admin.firestore.FieldValue.serverTimestamp(),
      unbannedBy: request.auth.uid,
    }, { merge: true });

    try { await admin.auth().updateUser(targetUid, { disabled: false }); }
    catch (e) { console.error('[adminUnbanUser] Auth enable failed:', e.message); }

    return { ok: true };
  }
);

exports.adminListUsers = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const snap = await admin.firestore().collection('users')
      .orderBy('createdAt', 'desc').limit(500).get();
    return {
      users: snap.docs.map(d => {
        const data = d.data();
        const safe = { id: d.id };
        for (const [k, v] of Object.entries(data)) {
          if (!SENSITIVE_FIELDS.includes(k)) safe[k] = v;
        }
        return safe;
      })
    };
  }
);

exports.adminDeleteUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const { targetUid } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Missing targetUid.');
    if (targetUid === request.auth.uid) throw new HttpsError('invalid-argument', 'Cannot delete your own admin account.');

    async function batchDeleteQuery(query) {
      const snap = await query.get();
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = admin.firestore().batch();
        snap.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    try { await admin.auth().deleteUser(targetUid); }
    catch (e) { console.error('[adminDeleteUser] Auth delete failed:', e.message); }

    try { await admin.firestore().collection('users').doc(targetUid).delete(); }
    catch (e) { console.error('[adminDeleteUser] Firestore delete failed:', e.message); }

    const collections = [
      'userSessions', 'usernames', 'groupMembers',
      'chatRequests', 'groupJoinRequests', 'groupInvites',
      'blockedUsers', 'favoriteChats', 'archivedChats',
      'lockedChats', 'mutedChats', 'deletedChats',
      'chatNotifSettings', 'inAppNotifications', 'notificationTelemetry',
      'statuses', 'typingIndicators', 'typingStatus',
      'userReports', 'messageReports', 'blockedWords',
      'pinnedMessages', 'starredMessages', 'calendarEvents',
      'tasks', 'scheduledMessages', 'userPublicKeys',
      'quickReplies', 'reminders', 'chatLockSettings',
      'appLockSettings', 'chatTranslationSettings',
      'chatRequestsRead', 'chatRequestsSnooze', 'scheduledCalls',
      'groupExpenses', 'whiteboards', 'playlists', 'musicLibrary',
      'listeningRooms', 'stickerPacks', 'animatedStickerPacks'
    ];

    for (const col of collections) {
      const uidField = ['chatRequests'].includes(col)
        ? ['fromUserId', 'toUserId']
        : ['groupInvites'].includes(col)
        ? ['fromUserId', 'toUserId']
        : ['blockedUsers'].includes(col)
        ? ['userId', 'blockedUserId']
        : ['tasks'].includes(col)
        ? ['userId', 'assignedTo']
        : ['inAppNotifications'].includes(col)
        ? ['toUserId', 'fromUserId']
        : ['userReports'].includes(col)
        ? ['reporterId', 'reportedUserId']
        : ['messageReports'].includes(col)
        ? ['reporterId', 'reportedUserId']
        : ['userId'];

      for (const field of uidField) {
        try { await batchDeleteQuery(admin.firestore().collection(col).where(field, '==', targetUid)); }
        catch (e) { console.error(`[adminDeleteUser] ${col}.${field} cleanup failed:`, e.message); }
      }
    }

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
    } catch (e) { console.error('[adminDeleteUser] Message anonymization failed:', e.message); }

    return { ok: true };
  }
);
