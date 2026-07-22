"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, getAuth, getAdmin } = require("./admin");
const { requireAuth } = require("./helpers");

exports.leaveGroup = onCall({ memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  const { groupId } = request.data;

  if (!groupId) {
    throw new HttpsError("invalid-argument", "Missing groupId");
  }

  const db = getDb();
  const groupRef = db.collection("groups").doc(groupId);
  const groupDoc = await groupRef.get();

  if (!groupDoc.exists) {
    throw new HttpsError("not-found", "Group not found");
  }

  const groupData = groupDoc.data();
  if (!groupData.memberIds || !groupData.memberIds.includes(uid)) {
    throw new HttpsError("failed-precondition", "You are not a member of this group");
  }

  const FieldValue = getAdmin().firestore.FieldValue;
  const updates = {
    memberIds: FieldValue.arrayRemove(uid)
  };
  // Also remove from 'members' array if present (used by groupChats rules)
  if (groupData.members) {
    updates.members = FieldValue.arrayRemove(uid);
  }
  // Decrement member count
  if (typeof groupData.memberCount === 'number') {
    updates.memberCount = Math.max(0, groupData.memberCount - 1);
  }
  await groupRef.update(updates);

  return { ok: true };
});

async function paginatedDelete(db, query, batchSize) {
  let totalDeleted = 0;
  let lastDoc = null;
  while (true) {
    let q = query.limit(batchSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < batchSize) break;
  }
  return totalDeleted;
}

exports.adminDeleteUser = onCall({ memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  const { targetUid } = request.data;
  const firebaseAuth = getAuth();

  const callerRecord = await firebaseAuth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing targetUid");
  }

  const db = getDb();
  const FieldValue = getAdmin().firestore.FieldValue;
  const BATCH_SIZE = 500;

  const messagesDeleted = await paginatedDelete(db,
    db.collection("messages").where("senderId", "==", targetUid), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("users").doc(targetUid).collection("sessions"), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("users").doc(targetUid).collection("callEvents"), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("groupMembers").where("userId", "==", targetUid), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("statuses").where("userId", "==", targetUid), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("tasks").where("userId", "==", targetUid), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("calendarEvents").where("addedBy", "==", targetUid), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("groupExpenses").where("addedBy", "==", targetUid), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("directChats").where("participants", "array-contains", targetUid), BATCH_SIZE);

  await paginatedDelete(db,
    db.collection("notificationTelemetry").where("userId", "==", targetUid), BATCH_SIZE);

  const groupsSnap = await db.collection("groups")
    .where("memberIds", "array-contains", targetUid).get();
  const batch4 = db.batch();
  groupsSnap.forEach(doc => {
    batch4.update(doc.ref, {
      memberIds: FieldValue.arrayRemove(targetUid)
    });
  });
  if (groupsSnap.size > 0) await batch4.commit();

  await firebaseAuth.deleteUser(targetUid);
  await db.collection("users").doc(targetUid).delete();

  return { ok: true, messagesDeleted };
});

exports.adminBanUser = onCall({ memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  const { targetUid, reason } = request.data;
  const firebaseAuth = getAuth();

  const callerRecord = await firebaseAuth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing targetUid");
  }

  await firebaseAuth.setCustomUserClaims(targetUid, { banned: true });
  await getDb().collection("users").doc(targetUid).update({
    banned: true,
    bannedAt: Date.now(),
    bannedBy: uid,
    banReason: reason || ""
  });

  return { ok: true };
});

exports.adminUnbanUser = onCall({ memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  const { targetUid } = request.data;
  const firebaseAuth = getAuth();

  const callerRecord = await firebaseAuth.getUser(uid);
  if (!callerRecord.customClaims || !callerRecord.customClaims.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing targetUid");
  }

  const targetRecord = await firebaseAuth.getUser(targetUid);
  const claims = { ...targetRecord.customClaims };
  delete claims.banned;
  await firebaseAuth.setCustomUserClaims(targetUid, claims);

  await getDb().collection("users").doc(targetUid).update({
    banned: false,
    unbannedAt: Date.now(),
    unbannedBy: uid
  });

  return { ok: true };
});

exports.deleteUserAccount = onCall({ region: "us-central1", memory: "128MiB" }, async (request) => {
  const uid = requireAuth(request);
  const db = getDb();
  const FieldValue = getAdmin().firestore.FieldValue;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new HttpsError("not-found", "User not found");
  const userData = userDoc.data() || {};

  // Step 1: If already scheduled, check 30-day grace period
  if (userData.deletionScheduledAt) {
    const scheduled = userData.deletionScheduledAt.toDate ? userData.deletionScheduledAt.toDate() : new Date(userData.deletionScheduledAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (scheduled < thirtyDaysAgo) {
      // Perform full cleanup
      const firebaseAuth = getAuth();

      // Remove from all groups
      const groupsSnap = await db.collection("groups").where("memberIds", "array-contains", uid).get();
      const batchGroups = db.batch();
      groupsSnap.forEach(doc => batchGroups.update(doc.ref, { memberIds: FieldValue.arrayRemove(uid) }));
      if (groupsSnap.size > 0) await batchGroups.commit();

      // Delete subcollection data
      const subcollections = ["sessions", "callEvents"];
      for (const sub of subcollections) {
        const snap = await db.collection("users").doc(uid).collection(sub).limit(500).get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        if (snap.size > 0) await batch.commit();
      }

      // Delete user doc
      await db.collection("users").doc(uid).delete();

      // Delete Firebase Auth user
      try { await firebaseAuth.deleteUser(uid); } catch (_) {}

      return { ok: true, deleted: true };
    }
    return { ok: true, deleted: false, message: "Account pending deletion. Access revoked." };
  }

  // Step 2: First call — schedule deletion and revoke access
  await db.collection("users").doc(uid).update({
    deletionScheduledAt: FieldValue.serverTimestamp(),
    banned: true,
    accessRevokedAt: Date.now()
  });

  try {
    await getAuth().setCustomUserClaims(uid, { banned: true });
  } catch (_) {}

  return { ok: true, deleted: false, message: "Account scheduled for deletion in 30 days." };
});
