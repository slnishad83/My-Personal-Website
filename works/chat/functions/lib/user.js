"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, getAuth, getAdmin } = require("./admin");
const { requireAuth } = require("./helpers");

exports.leaveGroup = onCall(async (request) => {
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

  await groupRef.update({
    memberIds: getAdmin().firestore.FieldValue.arrayRemove(uid)
  });

  return { ok: true };
});

exports.adminDeleteUser = onCall(async (request) => {
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

  const messagesSnap = await db.collection("messages")
    .where("senderId", "==", targetUid).limit(500).get();
  const batch1 = db.batch();
  messagesSnap.forEach(doc => batch1.delete(doc.ref));
  if (messagesSnap.size > 0) await batch1.commit();

  const sessionsSnap = await db.collection("users").doc(targetUid)
    .collection("sessions").limit(500).get();
  const batch2 = db.batch();
  sessionsSnap.forEach(doc => batch2.delete(doc.ref));
  if (sessionsSnap.size > 0) await batch2.commit();

  const callsSnap = await db.collection("users").doc(targetUid)
    .collection("callEvents").limit(500).get();
  const batch3 = db.batch();
  callsSnap.forEach(doc => batch3.delete(doc.ref));
  if (callsSnap.size > 0) await batch3.commit();

  const groupMembersSnap = await db.collection("groupMembers")
    .where("userId", "==", targetUid).limit(500).get();
  const batchGM = db.batch();
  groupMembersSnap.forEach(doc => batchGM.delete(doc.ref));
  if (groupMembersSnap.size > 0) await batchGM.commit();

  const statusSnap = await db.collection("statuses")
    .where("userId", "==", targetUid).limit(500).get();
  const batchStatus = db.batch();
  statusSnap.forEach(doc => batchStatus.delete(doc.ref));
  if (statusSnap.size > 0) await batchStatus.commit();

  const tasksSnap = await db.collection("tasks")
    .where("userId", "==", targetUid).limit(500).get();
  const batchTasks = db.batch();
  tasksSnap.forEach(doc => batchTasks.delete(doc.ref));
  if (tasksSnap.size > 0) await batchTasks.commit();

  const calendarSnap = await db.collection("calendarEvents")
    .where("addedBy", "==", targetUid).limit(500).get();
  const batchCal = db.batch();
  calendarSnap.forEach(doc => batchCal.delete(doc.ref));
  if (calendarSnap.size > 0) await batchCal.commit();

  const expensesSnap = await db.collection("groupExpenses")
    .where("addedBy", "==", targetUid).limit(500).get();
  const batchExp = db.batch();
  expensesSnap.forEach(doc => batchExp.delete(doc.ref));
  if (expensesSnap.size > 0) await batchExp.commit();

  const directChatsSnap = await db.collection("directChats")
    .where("participants", "array-contains", targetUid).limit(500).get();
  const batchDC = db.batch();
  directChatsSnap.forEach(doc => batchDC.delete(doc.ref));
  if (directChatsSnap.size > 0) await batchDC.commit();

  const telemetrySnap = await db.collection("notificationTelemetry")
    .where("userId", "==", targetUid).limit(500).get();
  const batchTel = db.batch();
  telemetrySnap.forEach(doc => batchTel.delete(doc.ref));
  if (telemetrySnap.size > 0) await batchTel.commit();

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

  return { ok: true, messagesDeleted: messagesSnap.size };
});

exports.adminBanUser = onCall(async (request) => {
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

exports.adminUnbanUser = onCall(async (request) => {
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

exports.deleteUserAccount = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuth(request);
  const db = getDb();
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) throw new HttpsError("not-found", "User not found");
  const userData = userDoc.data() || {};

  if (userData.deletionScheduledAt) {
    const scheduled = userData.deletionScheduledAt.toDate ? userData.deletionScheduledAt.toDate() : new Date(userData.deletionScheduledAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (scheduled < thirtyDaysAgo) {
      await db.collection("users").doc(uid).delete();
      return { ok: true, deleted: true };
    }
  }

  return { ok: true, deleted: false, message: "Account not yet eligible for permanent deletion" };
});
