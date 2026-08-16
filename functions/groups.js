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

function db() { return admin.firestore(); }

function validateAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  return request.auth.uid;
}

async function getGroupDoc(groupId) {
  const snap = await db().collection('groups').doc(groupId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Group not found.');
  }
  return { id: snap.id, ...snap.data() };
}

function requireAdmin(groupData, uid) {
  const adminIds = groupData.adminIds || groupData.admins || [];
  const isOwner = groupData.ownerId === uid || groupData.createdBy === uid;
  const isAdmin = adminIds.includes(uid) || isOwner;
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Only group admins can perform this action.');
  }
  return isOwner;
}

function requireCreator(groupData, uid) {
  if (groupData.createdBy !== uid && groupData.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Only the group creator can perform this action.');
  }
}

/* ══════════════════════════════════════════════════════════════
   1. addGroupMembers — Admin-only
   ══════════════════════════════════════════════════════════════ */
exports.addGroupMembers = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { groupId, userIds } = request.data || {};

    if (!groupId || typeof groupId !== 'string') {
      throw new HttpsError('invalid-argument', 'groupId is required.');
    }
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 100) {
      throw new HttpsError('invalid-argument', 'userIds must be a non-empty array (max 100).');
    }

    const group = await getGroupDoc(groupId);
    requireAdmin(group, uid);

    const batch = db().batch();
    const membersRef = db().collection('groups').doc(groupId).collection('members');
    const groupRef = db().collection('groups').doc(groupId);

    // Enforce "Who can add me to groups" privacy for each target user.
    let added = 0;
    let skipped = [];
    for (const memberUid of userIds) {
      if (typeof memberUid !== 'string') continue;
      const allow = await canAddToGroup(uid, memberUid);
      if (!allow) { skipped.push(memberUid); continue; }
      batch.set(membersRef.doc(memberUid), {
        uid: memberUid,
        displayName: 'Member',
        photoURL: '',
        role: 'member',
        addedBy: uid,
        addedAt: Date.now(),
      });
      added++;
    }
    batch.update(groupRef, {
      updatedAt: Date.now(),
    });

    await batch.commit();
    return { success: true, added, skipped };
  }
);

/**
 * Respect a user's groupInvites privacy setting:
 *   'everyone' (default)  → anyone can add them
 *   'contacts'            → only mutual direct chats can add them
 *   'nobody'              → never
 */
async function canAddToGroup(adderUid, targetUid) {
  try {
    const target = await db().collection('users').doc(targetUid).get();
    const settings = target.exists ? (target.data().privacySettings || {}) : {};
    const setting = settings.groupInvites || 'everyone';
    if (setting === 'nobody') return false;
    if (setting !== 'contacts') return true;
    const chats = await db().collection('chats')
      .where('participants', 'array-contains', targetUid)
      .limit(200)
      .get();
    let found = false;
    chats.forEach(doc => {
      const parts = doc.data().participants || [];
      if (parts.includes(adderUid)) found = true;
    });
    if (found) return true;
    const targetUser = target.exists ? target.data() : {};
    const contacts = Array.isArray(targetUser.contacts) ? targetUser.contacts : [];
    return contacts.includes(adderUid);
  } catch (_) {
    return true;
  }
}

/* ══════════════════════════════════════════════════════════════
   1b. createGroup — WhatsApp-style group creation
   Creates the groups/{id} doc + member subdocs, respecting each
   target user's "who can add me to groups" privacy setting.
   ══════════════════════════════════════════════════════════════ */
exports.createGroup = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { name, description, memberIds } = request.data || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new HttpsError('invalid-argument', 'Group name is required.');
    }
    const cleanName = name.trim().slice(0, 100);
    const cleanDesc = typeof description === 'string' ? description.trim().slice(0, 250) : '';

    const userIds = Array.isArray(memberIds) ? memberIds : [];
    const memberSet = new Set(userIds.filter((u) => typeof u === 'string' && u !== uid && u.length > 0));
    if (memberSet.size === 0) {
      throw new HttpsError('invalid-argument', 'Select at least one participant.');
    }

    // Fetch creator + target profiles in one pass
    const profilePromises = [uid, ...memberSet].map((id) =>
      db().collection('users').doc(id).get().catch(() => null)
    );
    const snaps = await Promise.all(profilePromises);
    const profiles = new Map();
    snaps.forEach((snap, i) => {
      const id = [uid, ...memberSet][i];
      if (snap && snap.exists) {
        const d = snap.data();
        profiles.set(id, {
          name: d.displayName || d.name || (id === uid ? 'Admin' : 'Member'),
          photo: d.photoURL || '',
        });
      }
    });
    const creator = profiles.get(uid) || { name: 'Admin', photo: '' };

    const groupId = db().collection('groups').doc().id;
    const groupRef = db().collection('groups').doc(groupId);
    const membersRef = db().collection('groups').doc(groupId).collection('members');
    const batch = db().batch();

    const allMemberIds = [uid, ...memberSet];
    batch.set(groupRef, {
      id: groupId,
      name: cleanName,
      description: cleanDesc,
      type: 'group',
      createdBy: uid,
      ownerId: uid,
      adminIds: [uid],
      admins: [uid],
      memberIds: allMemberIds,
      members: allMemberIds,
      memberCount: allMemberIds.length,
      photoURL: '',
      avatar: '',
      isPublic: false,
      announcementOnly: false,
      ephemeralTimer: null,
      lastMessage: '',
      lastMessageText: '',
      lastMessageAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdByName: creator.name,
      createdByPhotoURL: creator.photo,
      unreadCounts: {},
    });

    batch.set(membersRef.doc(uid), {
      uid,
      displayName: creator.name,
      photoURL: creator.photo,
      role: 'admin',
      addedBy: uid,
      addedAt: Date.now(),
    });

    // Respect "who can add me to groups" for each invitee
    let added = 0;
    let skipped = [];
    for (const mUid of memberSet) {
      const allow = await canAddToGroup(uid, mUid);
      if (!allow) { skipped.push(mUid); continue; }
      const p = profiles.get(mUid) || { name: 'Member', photo: '' };
      batch.set(membersRef.doc(mUid), {
        uid: mUid,
        displayName: p.name,
        photoURL: p.photo,
        role: 'member',
        addedBy: uid,
        addedAt: Date.now(),
      });
      added++;
    }

    if (skipped.length) {
      const finalIds = allMemberIds.filter((id) => !skipped.includes(id));
      batch.update(groupRef, {
        memberIds: finalIds,
        members: finalIds,
        memberCount: finalIds.length,
      });
    }

    await batch.commit();
    return { success: true, groupId, added, skipped };
  }
);

/* ══════════════════════════════════════════════════════════════
   2. removeGroupMember — Admin or self-removal
   ══════════════════════════════════════════════════════════════ */
exports.removeGroupMember = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { groupId, userId } = request.data || {};

    if (!groupId || typeof groupId !== 'string') {
      throw new HttpsError('invalid-argument', 'groupId is required.');
    }
    if (!userId || typeof userId !== 'string') {
      throw new HttpsError('invalid-argument', 'userId is required.');
    }

    const group = await getGroupDoc(groupId);
    const isSelf = uid === userId;
    if (!isSelf) {
      requireAdmin(group, uid);
    }

    // Prevent removing the last admin/owner
    const groupData = group;
    if (!isSelf && groupData) {
      const isRemovingAdmin = (groupData.adminIds || []).includes(userId)
        || groupData.ownerId === userId
        || groupData.createdBy === userId;
      if (isRemovingAdmin) {
        const adminCount = (groupData.adminIds || []).length;
        const isOwner = groupData.ownerId === userId || groupData.createdBy === userId;
        if (adminCount <= 1 && !isOwner) {
          throw new HttpsError('failed-precondition', 'Cannot remove the last admin. Promote another admin first or delete the group.');
        }
        if (isOwner) {
          throw new HttpsError('failed-precondition', 'Cannot remove the group owner. Delete the group instead.');
        }
      }
    }

    const batch = db().batch();
    batch.delete(db().collection('groups').doc(groupId).collection('members').doc(userId));
    batch.update(db().collection('groups').doc(groupId), {
      updatedAt: Date.now(),
    });

    await batch.commit();
    return { success: true };
  }
);

/* ══════════════════════════════════════════════════════════════
   3. promoteGroupAdmin — Creator only
   ══════════════════════════════════════════════════════════════ */
exports.promoteGroupAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { groupId, userId } = request.data || {};

    if (!groupId || typeof groupId !== 'string') {
      throw new HttpsError('invalid-argument', 'groupId is required.');
    }
    if (!userId || typeof userId !== 'string') {
      throw new HttpsError('invalid-argument', 'userId is required.');
    }

    const group = await getGroupDoc(groupId);
    requireCreator(group, uid);

    await db().collection('groups').doc(groupId).update({
      admins: admin.firestore.FieldValue.arrayUnion(userId),
      adminIds: admin.firestore.FieldValue.arrayUnion(userId),
      updatedAt: Date.now(),
    });

    await db().collection('groups').doc(groupId).collection('members').doc(userId).update({
      role: 'admin',
    }).catch(() => {});

    return { success: true };
  }
);

/* ══════════════════════════════════════════════════════════════
   4. demoteGroupAdmin — Creator only
   ══════════════════════════════════════════════════════════════ */
exports.demoteGroupAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { groupId, userId } = request.data || {};

    if (!groupId || typeof groupId !== 'string') {
      throw new HttpsError('invalid-argument', 'groupId is required.');
    }
    if (!userId || typeof userId !== 'string') {
      throw new HttpsError('invalid-argument', 'userId is required.');
    }

    const group = await getGroupDoc(groupId);
    requireCreator(group, uid);

    await db().collection('groups').doc(groupId).update({
      admins: admin.firestore.FieldValue.arrayRemove(userId),
      adminIds: admin.firestore.FieldValue.arrayRemove(userId),
      updatedAt: Date.now(),
    });

    await db().collection('groups').doc(groupId).collection('members').doc(userId).update({
      role: 'member',
    }).catch(() => {});

    return { success: true };
  }
);

/* ══════════════════════════════════════════════════════════════
   5. exitGroup — Any member (creator cannot exit)
   ══════════════════════════════════════════════════════════════ */
exports.exitGroup = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { groupId } = request.data || {};

    if (!groupId || typeof groupId !== 'string') {
      throw new HttpsError('invalid-argument', 'groupId is required.');
    }

    const group = await getGroupDoc(groupId);
    if (group.createdBy === uid || group.ownerId === uid) {
      throw new HttpsError('failed-precondition', 'Group creator cannot exit. Transfer ownership or delete the group.');
    }

    const batch = db().batch();
    batch.delete(db().collection('groups').doc(groupId).collection('members').doc(uid));
    batch.update(db().collection('groups').doc(groupId), {
      updatedAt: Date.now(),
    });

    await batch.commit();
    return { success: true };
  }
);

/* ══════════════════════════════════════════════════════════════
   6. deleteGroup — Creator only
   ══════════════════════════════════════════════════════════════ */
exports.deleteGroup = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { groupId } = request.data || {};

    if (!groupId || typeof groupId !== 'string') {
      throw new HttpsError('invalid-argument', 'groupId is required.');
    }

    const group = await getGroupDoc(groupId);
    requireCreator(group, uid);

    const membersSnap = await db().collection('groups').doc(groupId).collection('members').get();
    const batch = db().batch();
    membersSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await db().collection('groups').doc(groupId).delete();
    return { success: true };
  }
);

/* ══════════════════════════════════════════════════════════════
   7. respondToGroupInvite — Recipient accepts/declines a group invite
   ══════════════════════════════════════════════════════════════ */
exports.respondToGroupInvite = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = validateAuth(request);
    const { inviteId, action } = request.data || {};

    if (!inviteId || typeof inviteId !== 'string') {
      throw new HttpsError('invalid-argument', 'inviteId is required.');
    }
    if (action !== 'accept' && action !== 'decline') {
      throw new HttpsError('invalid-argument', 'action must be "accept" or "decline".');
    }

    const inviteRef = db().collection('groupInvites').doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      throw new HttpsError('not-found', 'Group invite not found.');
    }
    const invite = inviteSnap.data() || {};

    if (invite.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'This invite has already been responded to.');
    }
    if (invite.toUserId !== uid) {
      throw new HttpsError('permission-denied', 'This invite is not addressed to you.');
    }
    if (invite.fromUserId === uid) {
      throw new HttpsError('permission-denied', 'You cannot accept an invite you created.');
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    if (action === 'accept') {
      const groupId = invite.groupId;
      const group = await getGroupDoc(groupId);

      // Self/duplicate protection: skip if already a member.
      const existing = await groupRef(groupId).collection('members').doc(uid).get();
      if (existing.exists) {
        await inviteRef.update({
          status: 'accepted',
          respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, status: 'accepted', alreadyMember: true, groupId, groupName: group.name };
      }

      const batch = db().batch();
      batch.update(inviteRef, {
        status: newStatus,
        respondedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Client-facing members subcollection model (group-features.js).
      // syncGroupMemberCreated fires on this doc and recomputes
      // memberIds/adminIds/memberCount on the group doc.
      batch.set(groupRef(groupId).collection('members').doc(uid), {
        uid,
        displayName: 'Member',
        photoURL: '',
        role: 'member',
        addedBy: invite.fromUserId,
        addedAt: Date.now(),
      });
      await batch.commit();

      return { success: true, status: newStatus, groupId, groupName: group.name };
    }

    await inviteRef.update({
      status: newStatus,
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, status: newStatus };
  }
);

function groupRef(groupId) {
  return db().collection('groups').doc(groupId);
}
