const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const _adminModule = require('firebase-admin');
const admin = new Proxy({}, {
  get(_target, prop) {
    if (!_adminModule.getApps().length) {
      _adminModule.initializeApp();
    }
    return _adminModule[prop];
  }
});

const CHAT_APP_URL = 'https://nishadsl.com/works/chat/';
const ADMIN_EMAIL = 'sl.nishad@gmail.com';

async function syncGroupAccessMetadata(groupId) {
  if (!groupId) return;
  const memberSnap = await admin.firestore()
    .collection('groupMembers')
    .where('groupId', '==', groupId)
    .get();
  const memberIds = [];
  const adminIds = [];
  memberSnap.docs.forEach((doc) => {
    const member = doc.data() || {};
    if (!member.userId || memberIds.includes(member.userId)) return;
    memberIds.push(member.userId);
    if (member.role === 'admin' || member.role === 'owner') {
      adminIds.push(member.userId);
    }
  });
  await admin.firestore().collection('groups').doc(groupId).set({
    memberIds,
    adminIds,
    memberCount: memberIds.length,
    accessMetadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

/** Extract a Firebase Storage file path from a download URL. */
function _storagePathFromUrl(url) {
  try {
    // Format: .../o/chat_uploads%2Fuid%2Ffilename?alt=media&...
    const match = url.match(/\/o\/([^?#]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch (_) {
    return null;
  }
}

exports.syncGroupMemberCreated = onDocumentCreated(
  { document: 'groupMembers/{memberId}', region: 'asia-south1' },
  async (event) => syncGroupAccessMetadata(event.data?.data()?.groupId)
);

exports.syncGroupMemberUpdated = onDocumentUpdated(
  { document: 'groupMembers/{memberId}', region: 'asia-south1' },
  async (event) => {
    const beforeGroupId = event.data?.before.data()?.groupId;
    const afterGroupId = event.data?.after.data()?.groupId;
    await syncGroupAccessMetadata(afterGroupId);
    if (beforeGroupId && beforeGroupId !== afterGroupId) {
      await syncGroupAccessMetadata(beforeGroupId);
    }
  }
);

exports.syncGroupMemberDeleted = onDocumentDeleted(
  { document: 'groupMembers/{memberId}', region: 'asia-south1' },
  async (event) => syncGroupAccessMetadata(event.data?.data()?.groupId)
);

exports.cleanupMessageAttachment = onDocumentDeleted(
  'messages/{messageId}',
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return null;

    const attachment = data.attachment;
    if (!attachment || !attachment.url) return null;

    const url = attachment.url;

    // Only handle Firebase Storage URLs for this project
    const storageBucket = admin.storage().bucket().name;
    if (!url.includes(storageBucket) && !url.includes('firebasestorage.googleapis.com')) {
      return null; // Cloudinary or other CDN — skip
    }

    // Safety check: does any other message still reference this URL?
    const db = admin.firestore();
    const stillInUse = await db.collection('messages')
      .where('attachment.url', '==', url)
      .limit(1)
      .get();

    if (!stillInUse.empty) {
      console.log('[cleanup] URL still referenced in another message, skipping:', url);
      return null;
    }

    // Extract storage path from the download URL
    try {
      const filePath = _storagePathFromUrl(url);
      if (!filePath) return null;
      await admin.storage().bucket().file(filePath).delete();
      console.log('[cleanup] Deleted attachment file:', filePath);
    } catch (err) {
      // File may already be gone — not an error worth surfacing
      console.warn('[cleanup] Could not delete attachment:', err.message);
    }

    return null;
  }
);

exports.weeklyOrphanedUploadCleanup = onSchedule(
  { schedule: '0 2 * * 0', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    const [files] = await bucket.getFiles({ prefix: 'chat_uploads/' });

    let deleted = 0;
    let skipped = 0;

    for (const file of files) {
      const meta = file.metadata;
      const updatedMs = meta.updated ? new Date(meta.updated).getTime() : 0;

      // Only consider files older than 7 days
      if (updatedMs > cutoffMs) { skipped++; continue; }

      // Build the public download URL to check against Firestore
      const encodedPath = encodeURIComponent(file.name).replace(/%2F/g, '%2F');
      const bucketName = bucket.name;
      const urlPattern = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}`;

      // Check if any message still references this file
      const refs = await db.collection('messages')
        .where('attachment.url', '>=', urlPattern)
        .where('attachment.url', '<', urlPattern + '\uf8ff')
        .limit(1)
        .get();

      if (!refs.empty) { skipped++; continue; }

      // Also check getDownloadURL style URLs (alt=media suffix)
      const refsAlt = await db.collection('messages')
        .where('attachment.url', '>=', 'https://firebasestorage.googleapis.com')
        .limit(1)
        .get();

      // For safety, do a simple string search across results
      const stillUsed = refsAlt.docs.some((doc) => {
        const u = doc.data()?.attachment?.url || '';
        return u.includes(encodeURIComponent(file.name));
      });

      if (stillUsed) { skipped++; continue; }

      try {
        await file.delete();
        deleted++;
        console.log('[weeklyCleanup] Deleted orphan:', file.name);
      } catch (err) {
        console.warn('[weeklyCleanup] Failed to delete:', file.name, err.message);
      }
    }

    console.log(`[weeklyCleanup] Done. Deleted: ${deleted}, Skipped/active: ${skipped}`);
    return null;
  }
);

exports.runMigrationOnTrigger = onDocumentCreated(
  { document: 'migrationTriggers/{triggerId}', region: 'us-central1', timeoutSeconds: 300 },
  async (event) => {
    const trigger = event.data?.data() || {};
    // Verify the creator is admin
    const createdBy = trigger.createdBy;
    if (!createdBy) { console.warn('Migration trigger missing createdBy — skipping'); return null; }
    try {
      const creatorSnap = await admin.firestore().collection('users').doc(createdBy).get();
      const creator = creatorSnap.data();
      if (!creator || creator.email !== ADMIN_EMAIL) {
        console.warn('Migration trigger by non-admin:', createdBy, '— skipping');
        return null;
      }
    } catch (_) {
      console.warn('Could not verify migration creator — skipping');
      return null;
    }
    const db = admin.firestore();

    if (trigger.type === 'backfillEmails') {
      console.log('Migration: backfillEmails started');
      const msgSnap = await db.collection('messages').get();
      let updated = 0;
      const emailCache = {};
      let batch = db.batch();
      let opCount = 0;
      for (const msgDoc of msgSnap.docs) {
        const msg = msgDoc.data();
        if (msg.participantEmails && msg.participantEmails.length > 0) continue;
        if (!msg.participants || !msg.participants.length) continue;
        const emails = [];
        for (const uid of msg.participants) {
          if (emailCache[uid]) { emails.push(emailCache[uid]); continue; }
          try {
            const userSnap = await db.collection('users').doc(uid).get();
            const email = userSnap.data()?.email || '';
            emailCache[uid] = email;
            if (email) emails.push(email);
          } catch (e) { emailCache[uid] = ''; }
        }
        if (emails.length) {
          batch.update(msgDoc.ref, { participantEmails: emails });
          opCount++; updated++;
        }
        if (opCount >= 400) { await batch.commit(); batch = db.batch(); opCount = 0; }
      }
      if (opCount > 0) await batch.commit();
      console.log('Migration: backfillEmails complete. Updated:', updated, 'Total:', msgSnap.size);
      await event.data.ref.set({ done: true, updated, total: msgSnap.size, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    if (trigger.type === 'migrateCalls') {
      console.log('Migration: migrateCalls started');
      const callsSnap = await db.collection('calls').get();
      let created = 0;
      for (const callDoc of callsSnap.docs) {
        const call = callDoc.data();
        const logId = callDoc.id;
        const existingLog = await db.collection('callLogs').doc(logId).get();
        if (existingLog.exists) continue;
        await db.collection('callLogs').doc(logId).set({
          callerId: call.fromUserId || call.callerId || '',
          calleeId: call.toUserId || call.calleeId || '',
          type: call.type || 'voice',
          duration: call.duration || 0,
          timestamp: call.timestamp || call.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          status: call.status || 'ended',
          participants: [call.fromUserId, call.toUserId].filter(Boolean)
        });
        created++;
      }
      console.log('Migration: migrateCalls complete. Created:', created, 'Total:', callsSnap.size);
      await event.data.ref.set({ done: true, created, total: callsSnap.size, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    return null;
  }
);
