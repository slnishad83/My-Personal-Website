const { onCall, HttpsError } = require('firebase-functions/v2/https');
const _adminModule = require('firebase-admin');
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

async function deleteSubcollection(db, collectionPath, batchSize = 500) {
  const snapshot = await db.collection(collectionPath).limit(batchSize).get();
  if (snapshot.empty) return 0;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

async function deleteAllInSubcollection(db, collectionPath) {
  let total = 0;
  let deleted = batchSize => batchSize > 0;
  while (deleted > 0) {
    deleted = await deleteSubcollection(db, collectionPath);
    total += deleted;
  }
  return total;
}

exports.deleteUserData = onCall({ region: 'asia-south1', timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  try {
    const chatsSnap = await db.collection('chats')
      .where('participants', 'array-contains', uid)
      .get();

    const batch = db.batch();
    const chatIdsToDelete = [];
    const chatIdsToRemoveUser = [];

    for (const chatDoc of chatsSnap.docs) {
      const chatData = chatDoc.data();
      const participants = chatData.participants || [];

      if (participants.length <= 2) {
        chatIdsToDelete.push(chatDoc.id);
        batch.delete(chatDoc.ref);
      } else {
        chatIdsToRemoveUser.push(chatDoc.id);
        batch.update(chatDoc.ref, {
          participants: admin.firestore.FieldValue.arrayRemove(uid),
          memberCount: (participants.length - 1),
        });
      }
    }

    await batch.commit();

    for (const chatId of chatIdsToDelete) {
      await deleteAllInSubcollection(db, `chats/${chatId}/messages`);
    }

    for (const chatId of chatIdsToRemoveUser) {
      await deleteAllInSubcollection(db, `chats/${chatId}/messages`);
    }

    const callLogsSnap = await db.collection('callLogs')
      .where('participants', 'array-contains', uid)
      .get();
    const callBatch = db.batch();
    callLogsSnap.docs.forEach((doc) => callBatch.delete(doc.ref));
    if (callLogsSnap.docs.length > 0) await callBatch.commit();

    const statusesSnap = await db.collection('statuses')
      .where('userId', '==', uid)
      .get();
    const statusBatch = db.batch();
    statusesSnap.docs.forEach((doc) => statusBatch.delete(doc.ref));
    if (statusesSnap.docs.length > 0) await statusBatch.commit();

    await deleteAllInSubcollection(db, `users/${uid}/notificationSettings`);
    await deleteAllInSubcollection(db, `users/${uid}/chatNotifSettings`);
    await deleteAllInSubcollection(db, `users/${uid}/unreadCounts`);

    await db.collection('users').doc(uid).delete().catch(() => {});

    await admin.auth().deleteUser(uid);
    return { success: true, message: 'Account and all data deleted permanently.' };
  } catch (error) {
    console.error('[deleteUserData] Error:', error);
    try {
      await admin.auth().deleteUser(uid);
    } catch (authErr) {
      console.error('[deleteUserData] Auth deletion also failed:', authErr);
    }
    throw new HttpsError('internal', 'Deletion completed with errors. Auth account was deleted.');
  }
});
