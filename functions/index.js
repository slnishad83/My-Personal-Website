const admin = require('firebase-admin');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');

if (!admin.apps.length) {
  admin.initializeApp();
}

const meteredApiKey = defineSecret('METERED_API_KEY');
const METERED_APP_URL = 'teamchatnishad.metered.live';
const TURN_CREDENTIAL_LABEL = 'team-chat-secure-turn';
const BACKEND_RUNTIME_GENERATION = 'nodejs22';
const CHAT_APP_URL = 'https://nishadsl.com/works/chat/';

async function getUserPushTokens(userId) {
  if (!userId) return { userSnap: null, user: {}, tokens: [] };
  const userSnap = await admin.firestore().collection('users').doc(userId).get();
  const user = userSnap.data() || {};
  const tokens = Object.values(user.fcmTokens || {})
    .map((entry) => entry && entry.token)
    .filter(Boolean);
  return { userSnap, user, tokens };
}

async function removeStalePushTokens(userSnap, user, tokens, response) {
  if (!userSnap || !response?.responses?.length) return;
  const staleTokens = [];
  response.responses.forEach((result, index) => {
    const code = result.error && result.error.code;
    if (
      !result.success &&
      (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token')
    ) {
      staleTokens.push(tokens[index]);
    }
  });
  if (!staleTokens.length) return;
  const updates = {};
  Object.entries(user.fcmTokens || {}).forEach(([key, entry]) => {
    if (entry && staleTokens.includes(entry.token)) {
      updates[`fcmTokens.${key}`] = admin.firestore.FieldValue.delete();
    }
  });
  if (Object.keys(updates).length) await userSnap.ref.update(updates);
}

function getMessagePreview(message = {}) {
  if (message.text) return String(message.text).slice(0, 180);
  if (message.attachment?.type === 'voice') return 'Voice message';
  if (message.attachment?.type === 'video') return 'Video';
  if (message.attachment?.type === 'image') return 'Photo';
  if (message.attachment) return 'Attachment';
  if (message.type === 'call') return message.text || 'Call update';
  return 'New message';
}

async function getChatNotificationPreferences(userId, chatId) {
  if (!userId || !chatId) return { muted: false, showPreview: true, soundEnabled: true, vibrate: true };
  const [settingsSnap, muteSnap, userSnap] = await Promise.all([
    admin.firestore().collection('chatNotifSettings').doc(`${userId}_${chatId}`).get(),
    admin.firestore().collection('mutedChats').where('userId', '==', userId).get(),
    admin.firestore().collection('users').doc(userId).get()
  ]);
  const settings = settingsSnap.data() || {};
  const now = Date.now();
  const mutedByUser = muteSnap.docs.some((doc) => {
    const mute = doc.data() || {};
    if (mute.chatId !== chatId) return false;
    const until = mute.muteUntil?.toMillis?.();
    return !until || until > now;
  });
  const userData = userSnap.data() || {};
  const dnd = userData.dndSettings || {};
  let dndMuted = false;
  if (dnd.enabled && dnd.from && dnd.to) {
    const tzOffset = typeof dnd.tzOffset === 'number' ? dnd.tzOffset : 0;
    const serverUtcMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    const userLocalMinutes = (serverUtcMinutes - tzOffset + 1440) % 1440;
    const fromParts = dnd.from.split(':').map(Number);
    const toParts = dnd.to.split(':').map(Number);
    const fromMinutes = fromParts[0] * 60 + fromParts[1];
    const toMinutes = toParts[0] * 60 + toParts[1];
    if (fromMinutes <= toMinutes) {
      dndMuted = userLocalMinutes >= fromMinutes && userLocalMinutes <= toMinutes;
    } else {
      dndMuted = userLocalMinutes >= fromMinutes || userLocalMinutes <= toMinutes;
    }
  }
  return {
    muted: mutedByUser || dndMuted,
    showPreview: settings.showPreview !== false,
    soundEnabled: settings.customSound !== false,
    vibrate: settings.vibrate !== false
  };
}

async function getUnreadMessageCount(userId, chatId, chatType) {
  if (!userId || !chatId) return 1;
  const field = chatType === 'group' ? 'groupId' : 'directId';
  const snapshot = await admin.firestore().collection('messages').where(field, '==', chatId).get();
  return Math.max(1, snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    return data.senderId &&
      data.senderId !== userId &&
      !data.deletedForEveryone &&
      !data.deletedFor?.[userId] &&
      !data.openedBy?.[userId] &&
      !data.readBy?.[userId];
  }).length);
}

async function addNotificationCenterItem({
  toUserId,
  fromUserId = '',
  fromUserName = 'Team Chat',
  type,
  message,
  chatId = '',
  chatType = '',
  chatUserId = '',
  callId = '',
  statusId = ''
}) {
  if (!toUserId) return;
  await admin.firestore().collection('inAppNotifications').add({
    toUserId,
    fromUserId,
    fromUserName,
    type,
    message,
    chatId,
    chatType,
    chatUserId,
    callId,
    statusId,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function sendChatRequestEventNotification({
  requestId,
  toUserId,
  fromUserId,
  fromUserName,
  chatUserId,
  type,
  title,
  body
}) {
  if (!toUserId) return;
  const notificationUrl = chatUserId
    ? `${CHAT_APP_URL}?chatUserId=${encodeURIComponent(chatUserId)}`
    : CHAT_APP_URL;
  await admin.firestore().collection('inAppNotifications').add({
    toUserId,
    fromUserId: fromUserId || '',
    fromUserName: fromUserName || 'Team Chat',
    chatUserId: chatUserId || '',
    requestId: requestId || '',
    type,
    message: body,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const { userSnap, user, tokens } = await getUserPushTokens(toUserId);
  if (!tokens.length) return;
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    data: {
      kind: 'chat_request',
      requestId: requestId || '',
      requestStatus: type,
      fromUserId: fromUserId || '',
      fromUserName: fromUserName || '',
      chatUserId: chatUserId || '',
      url: notificationUrl,
      title,
      body
    },
    android: {
      priority: 'high'
    },
    webpush: {
      headers: { Urgency: 'high', TTL: '3600' },
      notification: {
        title,
        body,
        icon: '/works/chat/app-icon-192.png',
        badge: '/works/chat/app-icon-192.png',
        tag: `chat-request-${requestId || type}`,
        renotify: true,
        data: {
          url: notificationUrl,
          kind: 'chat_request',
          requestId: requestId || '',
          chatUserId: chatUserId || ''
        }
      },
      fcmOptions: { link: notificationUrl }
    }
  });
  await removeStalePushTokens(userSnap, user, tokens, response);
}

exports.sendNewChatRequestNotification = onDocumentCreated(
  {
    document: 'chatRequests/{requestId}',
    region: 'asia-south1'
  },
  async (event) => {
    const request = event.data?.data() || {};
    if (request.status !== 'pending' || !request.toUserId) return null;
    await sendChatRequestEventNotification({
      requestId: event.params.requestId,
      toUserId: request.toUserId,
      fromUserId: request.fromUserId,
      fromUserName: request.fromUserName,
      type: 'chat_request_pending',
      title: 'New chat request',
      body: `${request.fromUserName || 'Someone'} wants to chat with you.`
    });
    return null;
  }
);

exports.sendChatRequestStatusNotification = onDocumentUpdated(
  {
    document: 'chatRequests/{requestId}',
    region: 'asia-south1'
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    if (!after.status || before.status === after.status) return null;

    if (after.status === 'pending') {
      await sendChatRequestEventNotification({
        requestId: event.params.requestId,
        toUserId: after.toUserId,
        fromUserId: after.fromUserId,
        fromUserName: after.fromUserName,
        type: 'chat_request_pending',
        title: 'New chat request',
        body: `${after.fromUserName || 'Someone'} wants to chat with you.`
      });
    } else if (after.status === 'accepted') {
      await sendChatRequestEventNotification({
        requestId: event.params.requestId,
        toUserId: after.fromUserId,
        fromUserId: after.toUserId,
        fromUserName: after.toUserName,
        chatUserId: after.toUserId,
        type: 'chat_request_accepted',
        title: 'Chat request accepted',
        body: 'Your chat request has been accepted. Tap to start chatting.'
      });
    } else if (after.status === 'cancelled') {
      await sendChatRequestEventNotification({
        requestId: event.params.requestId,
        toUserId: after.toUserId,
        fromUserId: after.fromUserId,
        fromUserName: after.fromUserName,
        type: 'chat_request_cancelled',
        title: 'Chat request cancelled',
        body: `${after.fromUserName || 'The user'} cancelled their chat request.`
      });
    }
    return null;
  }
);

exports.sendGroupJoinRequestNotification = onDocumentCreated(
  {
    document: 'groupJoinRequests/{requestId}',
    region: 'asia-south1'
  },
  async (event) => {
    const req = event.data?.data() || {};
    if (req.status !== 'pending' || !req.groupId) return null;
    // Notify all group admins
    const memberSnap = await admin.firestore().collection('groupMembers')
      .where('groupId', '==', req.groupId)
      .get();
    const adminIds = [];
    memberSnap.docs.forEach((doc) => {
      if (['owner', 'admin'].includes(doc.data().role)) {
        adminIds.push(doc.data().userId);
      }
    });
    const groupSnap = await admin.firestore().collection('groups').doc(req.groupId).get();
    const groupName = groupSnap.data()?.name || 'Group';
    const title = 'New join request';
    const body = `${req.userName || 'Someone'} wants to join "${groupName}"`;
    await Promise.all(adminIds.map(async (adminId) => {
      await addNotificationCenterItem({
        toUserId: adminId,
        fromUserId: req.userId || '',
        fromUserName: req.userName || 'Someone',
        type: 'group_join_request',
        message: body,
        chatId: req.groupId,
        chatType: 'group'
      });
      const { user, tokens } = await getUserPushTokens(adminId);
      if (!tokens.length) return;
      await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
          kind: 'group_join_request',
          groupId: req.groupId,
          requestId: event.params.requestId,
          title,
          body,
          url: `${CHAT_APP_URL}?groupId=${encodeURIComponent(req.groupId)}`
        },
        android: { priority: 'high' },
        webpush: {
          headers: { Urgency: 'high', TTL: '3600' },
          notification: { title, body, icon: '/works/chat/app-icon-192.png', tag: `group-req-${req.groupId}` },
          fcmOptions: { link: `${CHAT_APP_URL}?groupId=${encodeURIComponent(req.groupId)}` }
        }
      });
    }));
    return null;
  }
);

exports.lookupVerifiedUserByEmail = onRequest(
  {
    region: 'us-central1',
    invoker: 'public'
  },
  async (request, response) => {
    setCorsHeaders(response);
    response.set('Cache-Control', 'private, no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const caller = await verifyFirebaseUser(request);
      const email = String(request.query.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
        response.status(400).json({ error: 'A valid email address is required' });
        return;
      }
      const authUser = await admin.auth().getUserByEmail(email);
      if (
        authUser.disabled ||
        authUser.emailVerified !== true ||
        authUser.uid === caller.uid
      ) {
        response.status(404).json({ error: 'Verified user not found' });
        return;
      }
      const profileSnap = await admin.firestore().collection('users').doc(authUser.uid).get();
      const profile = profileSnap.data() || {};
      if (profile.isActive === false) {
        response.status(404).json({ error: 'Verified user not found' });
        return;
      }
      response.status(200).json({
        id: authUser.uid,
        uid: authUser.uid,
        email: authUser.email,
        emailVerified: true,
        pendingVerification: false,
        isActive: true,
        displayName: profile.displayName || authUser.displayName || email.split('@')[0],
        avatar: profile.avatar || authUser.photoURL || '',
        onlineStatus: profile.onlineStatus || 'offline'
      });
    } catch (error) {
      response.status(404).json({ error: 'Verified user not found' });
    }
  }
);

async function findVerifiedUserByEmail(email, callerUid) {
  const candidates = new Map();
  try {
    const authUser = await admin.auth().getUserByEmail(email);
    candidates.set(authUser.uid, authUser);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }

  // Newly registered profiles can become visible in Firestore before an
  // email lookup is immediately consistent in Firebase Authentication.
  const profileMatches = await admin.firestore()
    .collection('users')
    .where('email', '==', email)
    .limit(5)
    .get();
  for (const profileDoc of profileMatches.docs) {
    if (candidates.has(profileDoc.id)) continue;
    try {
      const authUser = await admin.auth().getUser(profileDoc.id);
      if (String(authUser.email || '').trim().toLowerCase() === email) {
        candidates.set(authUser.uid, authUser);
      }
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }
  }

  for (const authUser of candidates.values()) {
    if (
      authUser.disabled ||
      authUser.emailVerified !== true ||
      authUser.uid === callerUid
    ) {
      continue;
    }
    const profileSnap = await admin.firestore().collection('users').doc(authUser.uid).get();
    const profile = profileSnap.data() || {};
    if (profile.isActive === false) continue;
    return {
      id: authUser.uid,
      uid: authUser.uid,
      email: authUser.email,
      emailVerified: true,
      pendingVerification: false,
      isActive: true,
      displayName: profile.displayName || authUser.displayName || email.split('@')[0],
      avatar: profile.avatar || authUser.photoURL || '',
      onlineStatus: profile.onlineStatus || 'offline'
    };
  }
  return null;
}

exports.lookupVerifiedUserByEmailV2 = onRequest(
  {
    region: 'asia-south1',
    invoker: 'public',
    timeoutSeconds: 30
  },
  async (request, response) => {
    setCorsHeaders(response);
    response.set('Cache-Control', 'private, no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      const caller = await verifyFirebaseUser(request);
      const email = String(request.query.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
        response.status(400).json({ error: 'A valid email address is required' });
        return;
      }
      const verifiedUser = await findVerifiedUserByEmail(email, caller.uid);
      if (!verifiedUser) {
        console.info('Verified user lookup completed without a discoverable match');
        response.status(404).json({ error: 'Verified user not found' });
        return;
      }
      console.info('Verified user lookup returned a discoverable match');
      response.status(200).json(verifiedUser);
    } catch (error) {
      console.error('Verified user lookup failed', {
        code: error?.code || 'unknown',
        message: error?.message || 'Unknown error'
      });
      response.status(500).json({ error: 'User lookup is temporarily unavailable' });
    }
  }
);

function setCorsHeaders(response) {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Max-Age', '3600');
}

async function verifyFirebaseUser(request) {
  const authorization = request.get('Authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error('Missing Firebase auth token');
  }

  return admin.auth().verifyIdToken(match[1]);
}

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

exports.repairGroupAccessMetadata = onRequest(
  { region: 'us-central1', invoker: 'public' },
  async (request, response) => {
    setCorsHeaders(response);
    response.set('Cache-Control', 'private, no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }
    try {
      await verifyFirebaseUser(request);
      const migrationRef = admin.firestore().collection('systemMigrations').doc('groupAccessMetadataV1');
      const migration = await migrationRef.get();
      if (migration.exists && migration.data()?.completed === true) {
        response.status(200).json({ repaired: 0, alreadyComplete: true });
        return;
      }
      const groupSnap = await admin.firestore().collection('groups').get();
      for (const groupDoc of groupSnap.docs) {
        await syncGroupAccessMetadata(groupDoc.id);
      }
      await migrationRef.set({
        completed: true,
        repairedGroups: groupSnap.size,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      response.status(200).json({ repaired: groupSnap.size, alreadyComplete: false });
    } catch (error) {
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
);

function normalizeIceServers(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.iceServers)) return payload.iceServers;
  if (Array.isArray(payload?.ice_servers)) return payload.ice_servers;
  return [];
}

async function fetchMeteredJson(url, options) {
  const meteredResponse = await fetch(url, options);
  let body = null;

  try {
    body = await meteredResponse.json();
  } catch (error) {
    body = null;
  }

  return {
    ok: meteredResponse.ok,
    status: meteredResponse.status,
    body
  };
}

async function fetchIceServersWithCredentialApiKey(apiKey) {
  const result = await fetchMeteredJson(
    `https://${METERED_APP_URL}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`
  );

  if (!result.ok) {
    return { ok: false, status: result.status, error: result.body?.error || 'Metered TURN request failed' };
  }

  const iceServers = normalizeIceServers(result.body);
  return iceServers.length
    ? { ok: true, iceServers }
    : { ok: false, status: 502, error: 'Metered returned no TURN servers' };
}

async function getCredentialApiKeyFromSecret(secretKey) {
  const listResult = await fetchMeteredJson(
    `https://${METERED_APP_URL}/api/v2/turn/credentials?secretKey=${encodeURIComponent(secretKey)}&all=false&label=${encodeURIComponent(TURN_CREDENTIAL_LABEL)}`
  );

  if (listResult.ok && Array.isArray(listResult.body?.data)) {
    const credential = listResult.body.data.find((item) => item?.apiKey && !item.expired) || listResult.body.data[0];
    if (credential?.apiKey) return { apiKey: credential.apiKey };
  }

  const createResult = await fetchMeteredJson(
    `https://${METERED_APP_URL}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: TURN_CREDENTIAL_LABEL })
    }
  );

  if (!createResult.ok || !createResult.body?.apiKey) {
    return {
      error: createResult.body?.message || createResult.body?.error || listResult.body?.message || listResult.body?.error
    };
  }

  return { apiKey: createResult.body.apiKey };
}

async function getMeteredIceServers(configuredKey) {
  const directResult = await fetchIceServersWithCredentialApiKey(configuredKey);
  if (directResult.ok) return directResult;

  if (![400, 401, 403].includes(directResult.status)) {
    return directResult;
  }

  const credentialResult = await getCredentialApiKeyFromSecret(configuredKey);
  if (!credentialResult?.apiKey) {
    return {
      ok: false,
      status: directResult.status,
      error: credentialResult?.error || 'Metered key is not a valid TURN credential API key or secret key'
    };
  }

  return fetchIceServersWithCredentialApiKey(credentialResult.apiKey);
}

exports.getTurnCredentials = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    secrets: [meteredApiKey]
  },
  async (request, response) => {
    setCorsHeaders(response);
    response.set('Cache-Control', 'private, no-store');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'GET') {
      response.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      await verifyFirebaseUser(request);

      const apiKey = meteredApiKey.value().trim();
      if (!apiKey) {
        response.status(500).json({ error: 'TURN secret is not configured' });
        return;
      }

      const meteredResult = await getMeteredIceServers(apiKey);
      if (!meteredResult.ok) {
        response.status(502).json({ error: meteredResult.error || 'Metered TURN request failed' });
        return;
      }

      response.status(200).json(meteredResult.iceServers);
    } catch (error) {
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
);


// ========================================
// Incoming call push notification via FCM
// Strongest web/PWA notification allowed by Chrome/Android.
// ========================================
exports.sendIncomingCallNotification = onDocumentCreated(
  {
    document: 'calls/{callId}',
    region: 'us-central1'
  },
  async (event) => {
    const call = event.data?.data() || {};
    const callId = event.params.callId;

    if (!call.toUserId || call.status !== 'ringing') return null;

    await addNotificationCenterItem({
      toUserId: call.toUserId,
      fromUserId: call.fromUserId || '',
      fromUserName: call.fromUserName || 'Team Chat',
      type: call.type === 'video' ? 'incoming_video_call' : 'incoming_voice_call',
      message: `${call.fromUserName || 'Someone'} is calling`,
      chatUserId: call.fromUserId || '',
      callId
    });

    const userSnap = await admin.firestore().collection('users').doc(call.toUserId).get();
    const user = userSnap.data() || {};
    const tokenEntries = Object.values(user.fcmTokens || {});
    const tokens = tokenEntries.map((entry) => entry && entry.token).filter(Boolean);

    if (!tokens.length) {
      console.log('No FCM tokens for receiver', call.toUserId);
      return null;
    }

    const title = call.type === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call';
    const body = `${call.fromUserName || 'Team Chat'} is calling. Tap to open Team Chat.`;

    const message = {
  tokens,
  data: {
        kind: 'call',
        callId,
        type: call.type || 'voice',
        fromUserId: call.fromUserId || '',
        fromUserName: call.fromUserName || '',
        fromUserAvatar: call.fromUserAvatar || '',
        toUserId: call.toUserId || ''
      },
      android: {
  priority: 'high'
},
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '120'
        },
        notification: {
          title,
          body,
          icon: '/works/chat/app-icon-192.png',
          badge: '/works/chat/app-icon-192.png',
          tag: `call-${callId}`,
          requireInteraction: true,
          renotify: true,
          silent: false,
          timestamp: Date.now(),
          vibrate: [700, 250, 700, 250, 700, 250, 700, 250, 700],
          data: {
            url: 'https://nishadsl.com/works/chat/',
            callId,
            kind: 'call'
          },
          actions: [{ action: 'open', title: 'Open' }]
        },
        fcmOptions: {
          link: 'https://nishadsl.com/works/chat/'
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    const staleTokens = [];

    response.responses.forEach((result, index) => {
      if (!result.success) {
        const code = result.error && result.error.code;
        console.warn('FCM send failed', code, result.error && result.error.message);
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(tokens[index]);
        }
      }
    });

    if (staleTokens.length) {
      const updates = {};
      Object.entries(user.fcmTokens || {}).forEach(([key, entry]) => {
        if (entry && staleTokens.includes(entry.token)) {
          updates[`fcmTokens.${key}`] = admin.firestore.FieldValue.delete();
        }
      });
      if (Object.keys(updates).length) await userSnap.ref.update(updates);
    }

    return null;
  }
);

// Group calls do not have a single toUserId, so notify every invited
// participant except the caller through the same call action flow.
exports.sendIncomingGroupCallNotification = onDocumentCreated(
  {
    document: 'calls/{callId}',
    region: 'us-central1'
  },
  async (event) => {
    const call = event.data?.data() || {};
    const callId = event.params.callId;
    if (
      call.groupCall !== true ||
      call.status !== 'ringing' ||
      !Array.isArray(call.participantIds)
    ) return null;

    const receiverIds = call.participantIds.filter(
      (uid) => uid && uid !== call.fromUserId
    );
    const title = call.type === 'video'
      ? 'Incoming group video call'
      : 'Incoming group voice call';
    const body = `${call.fromUserName || 'Team Chat'} started a call in ${call.groupName || 'your group'}.`;

    await Promise.all(receiverIds.map(async (receiverId) => {
      await addNotificationCenterItem({
        toUserId: receiverId,
        fromUserId: call.fromUserId || '',
        fromUserName: call.fromUserName || 'Team Chat',
        type: call.type === 'video' ? 'incoming_group_video_call' : 'incoming_group_voice_call',
        message: body,
        chatId: call.groupId || '',
        chatType: 'group',
        callId
      });
      const userSnap = await admin.firestore().collection('users').doc(receiverId).get();
      const user = userSnap.data() || {};
      const tokens = Object.values(user.fcmTokens || {})
        .map((entry) => entry && entry.token)
        .filter(Boolean);
      if (!tokens.length) return;

      await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
          kind: 'call',
          callId,
          type: call.type || 'voice',
          fromUserId: call.fromUserId || '',
          fromUserName: call.fromUserName || '',
          fromUserAvatar: call.fromUserAvatar || '',
          toUserId: receiverId,
          groupCall: 'true',
          groupId: call.groupId || ''
        },
        android: { priority: 'high' },
        webpush: {
          headers: { Urgency: 'high', TTL: '120' },
          notification: {
            title,
            body,
            icon: '/works/chat/app-icon-192.png',
            badge: '/works/chat/app-icon-192.png',
            tag: `call-${callId}`,
            requireInteraction: true,
            renotify: true,
            silent: false,
            vibrate: [700, 250, 700, 250, 700, 250, 700],
            data: {
              url: 'https://nishadsl.com/works/chat/',
              callId,
              kind: 'call'
            },
            actions: [
              { action: 'reject', title: 'Decline' },
              { action: 'accept', title: 'Accept' }
            ]
          },
          fcmOptions: { link: 'https://nishadsl.com/works/chat/' }
        }
      });
    }));

    return null;
  }
);

exports.sendMissedCallNotification = onDocumentUpdated(
  {
    document: 'calls/{callId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const call = event.data?.after.data() || {};
    if (before.status === call.status) return null;
    const isDirectMissed = call.groupCall !== true && call.status === 'missed';
    const isGroupCompleted = call.groupCall === true && ['ended', 'cancelled', 'missed'].includes(call.status);
    if (!isDirectMissed && !isGroupCompleted) return null;
    const callId = event.params.callId;
    const receiverIds = call.groupCall === true
      ? (call.participantIds || []).filter((uid) =>
          uid && uid !== call.fromUserId && !['joined', 'rejected', 'failed'].includes(call.participantStates?.[uid])
        )
      : [call.toUserId].filter(Boolean);
    await Promise.all(receiverIds.map(async (receiverId) => {
      const title = call.groupCall ? 'Missed group call' : 'Missed call';
      const body = `${call.fromUserName || 'Someone'} called you`;
      await addNotificationCenterItem({
        toUserId: receiverId,
        fromUserId: call.fromUserId || '',
        fromUserName: call.fromUserName || 'Team Chat',
        type: call.groupCall ? 'missed_group_call' : 'missed_call',
        message: body,
        chatId: call.groupId || '',
        chatType: call.groupId ? 'group' : 'direct',
        chatUserId: call.groupId ? '' : call.fromUserId || '',
        callId
      });
      const { userSnap, user, tokens } = await getUserPushTokens(receiverId);
      if (!tokens.length) return;
      const url = call.groupId
        ? `${CHAT_APP_URL}?groupId=${encodeURIComponent(call.groupId)}`
        : `${CHAT_APP_URL}?chatUserId=${encodeURIComponent(call.fromUserId || '')}`;
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
          kind: 'missed_call',
          title,
          body,
          callId,
          chatUserId: call.groupId ? '' : call.fromUserId || '',
          groupId: call.groupId || '',
          url
        },
        android: { priority: 'high' },
        webpush: {
          headers: { Urgency: 'high', TTL: '3600' },
          notification: {
            title, body,
            icon: '/works/chat/app-icon-192.png',
            badge: '/works/chat/app-icon-192.png',
            tag: `missed-call-${callId}`,
            data: { url, kind: 'missed_call', chatUserId: call.fromUserId || '', groupId: call.groupId || '' },
            actions: [{ action: 'open', title: 'Open chat' }]
          },
          fcmOptions: { link: url }
        }
      });
      await removeStalePushTokens(userSnap, user, tokens, response);
    }));
    return null;
  }
);

exports.clearEndedCallNotification = onDocumentUpdated(
  {
    document: 'calls/{callId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const call = event.data?.after.data() || {};
    if (before.status === call.status || !['ended', 'cancelled', 'rejected', 'declined', 'missed', 'failed', 'busy'].includes(call.status)) {
      return null;
    }
    const receiverIds = call.groupCall === true
      ? (call.participantIds || []).filter((uid) => uid && uid !== call.fromUserId)
      : [call.toUserId].filter(Boolean);
    await Promise.all(receiverIds.map(async (receiverId) => {
      const { userSnap, user, tokens } = await getUserPushTokens(receiverId);
      if (!tokens.length) return;
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
          kind: 'call_ended',
          callId: event.params.callId,
          status: call.status || 'ended'
        },
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'normal', TTL: '120' } }
      });
      await removeStalePushTokens(userSnap, user, tokens, response);
    }));
    return null;
  }
);

exports.sendStatusUpdateNotification = onDocumentCreated(
  {
    document: 'statuses/{statusId}',
    region: 'us-central1'
  },
  async (event) => {
    const status = event.data?.data() || {};
    if (!status.userId) return null;
    const chats = await admin.firestore().collection('directChats')
      .where('participants', 'array-contains', status.userId)
      .get();
    const receiverIds = [...new Set(chats.docs
      .filter((doc) => doc.data()?.status !== 'deleted')
      .flatMap((doc) =>
        (doc.data()?.participants || []).filter((uid) => uid && uid !== status.userId)
      ))];
    const title = `${status.userName || 'A contact'} shared a status`;
    const body = status.text ? String(status.text).slice(0, 120) : 'Tap to view the new status';
    const url = `${CHAT_APP_URL}?tab=status`;
    await Promise.all(receiverIds.map(async (receiverId) => {
      await addNotificationCenterItem({
        toUserId: receiverId,
        fromUserId: status.userId,
        fromUserName: status.userName || 'Team Chat',
        type: 'status_update',
        message: body,
        statusId: event.params.statusId
      });
      const { userSnap, user, tokens } = await getUserPushTokens(receiverId);
      if (!tokens.length) return;
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
          kind: 'status_update',
          title,
          body,
          statusId: event.params.statusId,
          url
        },
        android: { priority: 'normal' },
        webpush: {
          headers: { Urgency: 'normal', TTL: '3600' },
          notification: {
            title, body,
            icon: '/works/chat/app-icon-192.png',
            badge: '/works/chat/app-icon-192.png',
            tag: `status-${event.params.statusId}`,
            data: { url, kind: 'status_update' },
            actions: [{ action: 'open', title: 'View status' }]
          },
          fcmOptions: { link: url }
        }
      });
      await removeStalePushTokens(userSnap, user, tokens, response);
    }));
    return null;
  }
);

// ========================================
// New chat message push notification via FCM
// ========================================
exports.sendMessageNotification = onDocumentCreated(
  {
    document: 'messages/{messageId}',
    region: 'us-central1'
  },
  async (event) => {
    const message = event.data?.data() || {};
    const messageId = event.params.messageId;

    if (!message.senderId) return null;

    let receiverIds = [];

    if (Array.isArray(message.participants)) {
      receiverIds = message.participants.filter((uid) => uid && uid !== message.senderId);
    }

    if (!receiverIds.length && message.receiverId && message.receiverId !== message.senderId) {
      receiverIds = [message.receiverId];
    }

    if (!receiverIds.length && message.directId) {
      receiverIds = String(message.directId)
        .split('_')
        .filter((uid) => uid && uid !== message.senderId);
    }

    if (!receiverIds.length) {
      console.log('No receiver found for message', messageId);
      return null;
    }

    const title = message.groupId
      ? `${message.senderName || 'Someone'} · ${message.groupName || 'Group'}`
      : message.senderName || 'New message';
    const [senderSnap, groupSnap] = await Promise.all([
      admin.firestore().collection('users').doc(message.senderId).get().catch(() => null),
      message.groupId
        ? admin.firestore().collection('groups').doc(message.groupId).get().catch(() => null)
        : Promise.resolve(null)
    ]);
    const senderProfile = senderSnap?.data?.() || {};
    const groupProfile = groupSnap?.data?.() || {};
    const resolvedSenderName =
      message.senderName || senderProfile.displayName || senderProfile.email || 'Someone';
    const resolvedSenderAvatar =
      message.senderAvatar || message.senderPhoto || senderProfile.avatar || senderProfile.photoURL || '';
    const resolvedGroupName = message.groupName || groupProfile.name || 'Group';
    const notificationTitle = message.groupId
      ? `${resolvedSenderName} - ${resolvedGroupName}`
      : resolvedSenderName;
    const preview = getMessagePreview(message);

    const sendTasks = receiverIds.map(async (receiverId) => {
      const chatId = message.directId || message.groupId || '';
      const chatType = message.groupId ? 'group' : 'direct';
      const preferences = await getChatNotificationPreferences(receiverId, chatId);
      if (preferences.muted) return null;
      const unreadCount = await getUnreadMessageCount(receiverId, chatId, chatType);
      // Smart grouping: count-based body + alert only on first unread message
      const isFirstUnread = unreadCount <= 1;
      const body = unreadCount > 1
        ? (message.groupId
            ? `${unreadCount} new messages in ${resolvedGroupName}`
            : `${unreadCount} new messages from ${resolvedSenderName}`)
        : (preferences.showPreview ? preview : 'New message');
      const shouldAlert  = isFirstUnread && preferences.soundEnabled;
      const shouldVibrate = isFirstUnread && preferences.vibrate;
      const chatUserId = chatType === 'direct' ? message.senderId || '' : '';
      const notificationUrl = chatType === 'group'
        ? `${CHAT_APP_URL}?groupId=${encodeURIComponent(chatId)}`
        : `${CHAT_APP_URL}?chatUserId=${encodeURIComponent(chatUserId)}`;
      await addNotificationCenterItem({
        toUserId: receiverId,
        fromUserId: message.senderId || '',
        fromUserName: message.senderName || 'Team Chat',
        type: chatType === 'group' ? 'group_message' : 'message',
        message: body,
        chatId,
        chatType,
        chatUserId
      });
      const userSnap = await admin.firestore().collection('users').doc(receiverId).get();
      const user = userSnap.data() || {};
      const tokenEntries = Object.values(user.fcmTokens || {});
      const tokens = tokenEntries.map((entry) => entry && entry.token).filter(Boolean);

      if (!tokens.length) {
        console.log('No FCM tokens for receiver', receiverId);
        return null;
      }

      const fcmMessage = {
        tokens,
        data: {
          kind: 'message',
          title: notificationTitle,
          body,
          messageId,
          chatId,
          chatType,
          senderId: message.senderId || '',
          chatUserId,
          groupId: message.groupId || '',
          groupName: resolvedGroupName,
          senderName: resolvedSenderName,
          senderAvatar: resolvedSenderAvatar,
          unreadCount: String(unreadCount),
          url: notificationUrl,
          vibrate: preferences.vibrate ? 'true' : 'false',
          soundEnabled: preferences.soundEnabled ? 'true' : 'false'
        },
        android: {
          priority: 'high'
        },
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '120'
          },
          notification: {
            title: notificationTitle,
            body,
            icon: resolvedSenderAvatar || '/works/chat/app-icon-192.png',
            badge: '/works/chat/app-icon-192.png',
            tag: `chat-${chatType}-${chatId}`,
            renotify: isFirstUnread,
            silent: !shouldAlert,
            timestamp: Date.now(),
            vibrate: shouldVibrate ? [180, 80, 180] : [],
            data: {
              url: notificationUrl,
              messageId,
              kind: 'message',
              chatId,
              chatType,
              chatUserId,
              groupId: message.groupId || ''
            },
            actions: [{ action: 'open', title: 'Open chat' }]
          },
          fcmOptions: {
            link: notificationUrl
          }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(fcmMessage);
const hasSuccessfulDelivery = response.responses.some((result) => result.success);

if (hasSuccessfulDelivery) {
  const deliveryUpdates = {};
  deliveryUpdates[`deliveredTo.${receiverId}`] = admin.firestore.FieldValue.serverTimestamp();
  deliveryUpdates.status = 'delivered';

  await admin.firestore()
    .collection('messages')
    .doc(messageId)
    .set(deliveryUpdates, { merge: true });
}

      const staleTokens = [];
      response.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error && result.error.code;
          console.warn('Message FCM send failed', code, result.error && result.error.message);
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            staleTokens.push(tokens[index]);
          }
        }
      });

      if (staleTokens.length) {
        const updates = {};
        Object.entries(user.fcmTokens || {}).forEach(([key, entry]) => {
          if (entry && staleTokens.includes(entry.token)) {
            updates[`fcmTokens.${key}`] = admin.firestore.FieldValue.delete();
          }
        });
        if (Object.keys(updates).length) await userSnap.ref.update(updates);
      }

      return null;
    });

    await Promise.all(sendTasks);
    return null;
  }
);

// ============================================================
// STORAGE CLEANUP — safe, never touches active chat media
// ============================================================

/**
 * Triggered when a message document is deleted.
 * If the deleted message had a Firebase Storage attachment,
 * delete the file from Storage too — but ONLY if no other
 * message still references that same URL.
 *
 * This covers: "delete for everyone", manual deletes, etc.
 * It does NOT touch Cloudinary URLs (legacy) or any file
 * whose URL still appears in another message.
 */
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

/**
 * Weekly scheduled job — removes orphaned uploads.
 * An orphaned upload is a file in chat_uploads/ that:
 *   1. Was uploaded more than 7 days ago
 *   2. Is NOT referenced in any Firestore message
 *
 * This catches files where the upload succeeded but the
 * message send failed (e.g. network drop after upload).
 *
 * Run schedule: every Sunday at 02:00 UTC.
 * Safe: it checks Firestore before deleting anything.
 */
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

// ========================================
// AI CHAT BOT — powered by Google Gemini
// ========================================
// Setup: firebase functions:secrets:set GEMINI_API_KEY
// Then deploy: firebase deploy --only functions:aiChatBot

const geminiApiKey = defineSecret('GEMINI_API_KEY');

exports.aiChatBot = onCall(
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    // onCall automatically verifies the Firebase auth token
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to use the AI assistant.');
    }

    const { prompt, chatId, chatType, senderName } = request.data || {};
    if (!prompt || !chatId || !chatType) {
      throw new HttpsError('invalid-argument', 'Missing prompt, chatId, or chatType.');
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret is not configured.');
    }

    // Fetch recent chat messages for context (last 10)
    let contextMessages = '';
    try {
      const snap = await admin.firestore()
        .collection('messages')
        .where(chatType === 'direct' ? 'directId' : 'groupId', '==', chatId)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      const recent = snap.docs.reverse().map(d => {
        const data = d.data();
        return `${data.senderName || 'User'}: ${data.text || '[media]'}`;
      }).join('\n');
      if (recent) contextMessages = `\nRecent conversation:\n${recent}\n`;
    } catch (_) {}

    const systemPrompt = `You are a helpful AI assistant inside a team chat app called Team Chat. Be concise, friendly, and helpful.${contextMessages}`;

    let botText;
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser asks: ${prompt}` }] }
            ],
            generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
          })
        }
      );

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text();
        console.error('[aiChatBot] Gemini error:', errBody);
        throw new HttpsError('internal', `Gemini API error: ${errBody.substring(0, 200)}`);
      }

      const geminiData = await geminiRes.json();
      botText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
        || 'Sorry, I could not generate a response.';
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('[aiChatBot] Gemini fetch error:', err);
      throw new HttpsError('internal', err.message);
    }

    // Post the AI reply as a chat message
    const messageData = {
      text: botText,
      senderId: 'ai-bot',
      senderName: 'AI Assistant',
      isAiBot: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      readBy: { [request.auth.uid]: admin.firestore.FieldValue.serverTimestamp() },
    };
    if (chatType === 'direct') messageData.directId = chatId;
    else if (chatType === 'group') messageData.groupId = chatId;

    await admin.firestore().collection('messages').add(messageData);

    return { ok: true };
  }
);

// ========================================
// MIGRATION: backfill callLogs from existing calls
// POST /migrateCallsToCallLogs (admin only — sl.nishad@gmail.com)
// ========================================
exports.migrateCallsToCallLogs = onRequest(
  { region: 'us-central1', invoker: 'public', timeoutSeconds: 120 },
  async (request, response) => {
    setCorsHeaders(response);
    if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
    if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed' }); return; }
    try {
      const auth = await verifyFirebaseUser(request);
      await assertAdmin(auth);
      const callsSnap = await admin.firestore().collection('calls').get();
      let created = 0;
      for (const callDoc of callsSnap.docs) {
        const call = callDoc.data();
        const logId = callDoc.id;
        const existingLog = await admin.firestore().collection('callLogs').doc(logId).get();
        if (existingLog.exists) continue;
        await admin.firestore().collection('callLogs').doc(logId).set({
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
      response.status(200).json({ migrated: created, total: callsSnap.size });
    } catch (error) {
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
);

// ========================================
// AUTO-CREATE callLogs when a call is completed
// Listens for status changes to ended/missed/cancelled/rejected/declined/failed/busy
// ========================================
exports.exportCallToCallLog = onDocumentUpdated(
  {
    document: 'calls/{callId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const call = event.data?.after.data() || {};
    if (before.status === call.status) return null;
    if (!['ended', 'missed', 'cancelled', 'rejected', 'declined', 'failed', 'busy'].includes(call.status)) return null;
    const callId = event.params.callId;
    const existingLog = await admin.firestore().collection('callLogs').doc(callId).get();
    if (existingLog.exists) return null;
    await admin.firestore().collection('callLogs').doc(callId).set({
      callerId: call.fromUserId || call.callerId || '',
      calleeId: call.toUserId || call.calleeId || '',
      type: call.type || 'voice',
      duration: call.duration || 0,
      timestamp: call.timestamp || call.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      status: call.status || 'ended',
      participants: [call.fromUserId, call.toUserId].filter(Boolean)
    });
    return null;
  }
);

// ========================================
// MIGRATION: backfill participantEmails on existing messages
// POST /backfillMessageEmails (admin only — sl.nishad@gmail.com)
// ========================================
exports.backfillMessageEmails = onRequest(
  { region: 'us-central1', invoker: 'public', timeoutSeconds: 300 },
  async (request, response) => {
    setCorsHeaders(response);
    if (request.method === 'OPTIONS') { response.status(204).send(''); return; }
    if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed' }); return; }
    try {
      const auth = await verifyFirebaseUser(request);
      await assertAdmin(auth);
      const msgSnap = await admin.firestore().collection('messages').get();
      let updated = 0;
      const emailCache = {};
      let batch = admin.firestore().batch();
      let opCount = 0;
      for (const msgDoc of msgSnap.docs) {
        const msg = msgDoc.data();
        if (msg.participantEmails && msg.participantEmails.length > 0) continue;
        if (!msg.participants || !msg.participants.length) continue;
        const emails = [];
        for (const uid of msg.participants) {
          if (emailCache[uid]) { emails.push(emailCache[uid]); continue; }
          try {
            const userSnap = await admin.firestore().collection('users').doc(uid).get();
            const email = userSnap.data()?.email || '';
            emailCache[uid] = email;
            if (email) emails.push(email);
          } catch (e) { emailCache[uid] = ''; }
        }
        if (emails.length) {
          batch.update(msgDoc.ref, { participantEmails: emails });
          opCount++;
          updated++;
        }
        if (opCount >= 400) {
          await batch.commit();
          batch = admin.firestore().batch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
      response.status(200).json({ updated, total: msgSnap.size });
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  }
);

// ── Summarize Thread ──────────────────────────────────────────────────────
exports.summarizeThread = onCall(
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { messageId } = request.data || {};
    if (!messageId) throw new HttpsError('invalid-argument', 'Missing messageId.');

    const apiKey = geminiApiKey.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured.');

    const snap = await admin.firestore()
      .collection('messages').doc(messageId)
      .collection('threadReplies')
      .orderBy('timestamp', 'asc')
      .limit(100)
      .get();

    if (snap.empty) throw new HttpsError('not-found', 'No replies to summarize yet.');

    const replies = snap.docs.map(d => {
      const data = d.data();
      return `${data.senderName || 'User'}: ${data.text || '[media]'}`;
    }).join('\n');

    const prompt = `Summarize the following team chat thread into 3-5 concise bullet points. Each bullet should capture a key point, decision, or action item. Do not use markdown formatting — plain text only, one bullet per line starting with a dash.\n\nThread:\n${replies}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.4 }
        })
      }
    );
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new HttpsError('internal', `Gemini error: ${errText.substring(0, 200)}`);
    }
    const geminiData = await geminiRes.json();
    const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate summary.';
    return { summary };
  }
);

// ── Explain Message ───────────────────────────────────────────────────────
exports.explainMessage = onCall(
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { text } = request.data || {};
    if (!text) throw new HttpsError('invalid-argument', 'Missing message text.');

    const apiKey = geminiApiKey.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured.');

    const prompt = `A user received this chat message and wants it explained clearly and briefly (2-4 sentences). Explain what it means, any implied context, tone, or intent. Be concise and friendly.\n\nMessage: "${text}"`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.5 }
        })
      }
    );
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new HttpsError('internal', `Gemini error: ${errText.substring(0, 200)}`);
    }
    const geminiData = await geminiRes.json();
    const explanation = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not explain this message.';
    return { explanation };
  }
);

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

// ════════════════════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS — Only callable by sl.nishad@gmail.com
// ════════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = 'sl.nishad@gmail.com';

async function assertAdmin(auth) {
  if (!auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const userRecord = await admin.auth().getUser(auth.uid);
  if (userRecord.email !== ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Admin access only.');
  }
}

// ── Ban a user ────────────────────────────────────────────────────────────
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
      const batch = admin.firestore().batch();
      sessions.docs.forEach(doc => batch.update(doc.ref, { revoked: true, isActive: false }));
      await batch.commit();
    } catch (_) {}

    return { ok: true };
  }
);

// ── Unban a user ─────────────────────────────────────────────────────────
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

// ── Get all users (admin only) ────────────────────────────────────────────
exports.adminListUsers = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const snap = await admin.firestore().collection('users')
      .orderBy('createdAt', 'desc').limit(500).get();
    return { users: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  }
);

// ── Delete a user permanently ─────────────────────────────────────────────
exports.adminDeleteUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    await assertAdmin(request.auth);
    const { targetUid } = request.data || {};
    if (!targetUid) throw new HttpsError('invalid-argument', 'Missing targetUid.');
    if (targetUid === request.auth.uid) throw new HttpsError('invalid-argument', 'Cannot delete your own admin account.');

    // Delete from Firebase Auth
    try { await admin.auth().deleteUser(targetUid); } catch (_) {}

    // Delete Firestore user document
    try { await admin.firestore().collection('users').doc(targetUid).delete(); } catch (_) {}

    // Remove all sessions
    try {
      const sessions = await admin.firestore()
        .collection('userSessions').where('userId', '==', targetUid).get();
      const batch = admin.firestore().batch();
      sessions.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (_) {}

    // Remove username reservation
    try {
      const usernames = await admin.firestore()
        .collection('usernames').where('uid', '==', targetUid).get();
      const batch2 = admin.firestore().batch();
      usernames.docs.forEach(doc => batch2.delete(doc.ref));
      await batch2.commit();
    } catch (_) {}

    return { ok: true };
  }
);

// ════════════════════════════════════════════════════════════════════════════
// INNOVATIVE FEATURES — Cloud Functions
// ════════════════════════════════════════════════════════════════════════════

// ── Feature 1: Voice Message Transcription (uses Gemini 1.5 Flash) ────────
exports.transcribeVoiceMessage = onCall(
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { messageId, audioUrl } = request.data || {};
    if (!audioUrl) throw new HttpsError('invalid-argument', 'Missing audioUrl.');
    const apiKey = geminiApiKey.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not set.');
    try {
      // Download the audio file and convert to base64
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error('Could not fetch audio file.');
      const buffer = await audioRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = audioRes.headers.get('content-type') || 'audio/webm';
      // Send to Gemini for transcription
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: 'Please transcribe this voice message accurately. Return only the transcribed text, nothing else. If you cannot transcribe, say "Could not transcribe."' }
              ]
            }],
            generationConfig: { maxOutputTokens: 500, temperature: 0 }
          })
        }
      );
      if (!gemRes.ok) throw new Error('Gemini error: ' + await gemRes.text());
      const gemData = await gemRes.json();
      const text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not transcribe.';
      // Save transcription to the message
      if (messageId) {
        await admin.firestore().collection('messages').doc(messageId).update({ transcription: text.trim() }).catch(() => {});
      }
      return { text: text.trim() };
    } catch (err) {
      throw new HttpsError('internal', err.message);
    }
  }
);

// ── Feature 4: Catch Me Up AI Summary ─────────────────────────────────────
exports.catchMeUp = onCall(
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { chatId, chatType } = request.data || {};
    if (!chatId || !chatType) throw new HttpsError('invalid-argument', 'Missing chatId or chatType.');
    const apiKey = geminiApiKey.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not set.');
    try {
      const field = chatType === 'group' ? 'groupId' : 'directId';
      const snap = await admin.firestore().collection('messages')
        .where(field, '==', chatId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      if (snap.empty) return { summary: 'No messages yet in this chat.' };
      const messages = snap.docs.reverse().map(d => {
        const data = d.data();
        return `${data.senderName || 'Someone'}: ${data.text || (data.attachment ? '[media]' : '')}`;
      }).filter(Boolean).join('\n');
      const prompt = `These are the last messages in a team chat. Give a short, friendly summary (3-5 bullet points) of what was discussed, any decisions made, and anything that needs attention. Use plain text with dash bullets. Be brief and conversational.\n\nMessages:\n${messages}`;
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400, temperature: 0.5 }
          })
        }
      );
      const gemData = await gemRes.json();
      const summary = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate summary.';
      return { summary };
    } catch (err) {
      throw new HttpsError('internal', err.message);
    }
  }
);

// ── Feature 10: Busy Status Auto-Reply ────────────────────────────────────
exports.busyAutoReply = onDocumentCreated(
  { document: 'messages/{messageId}', region: 'asia-south1' },
  async (event) => {
    const msg = event.data.data();
    if (!msg || msg.senderId === 'busy-autoreply' || msg.isAutoReply) return;
    // Only for direct messages
    if (!msg.directId || !msg.receiverId) return;
    try {
      const recipientSnap = await admin.firestore().collection('users').doc(msg.receiverId).get();
      const recipient = recipientSnap.data();
      if (!recipient?.busyStatus) return;
      // Send auto-reply
      await admin.firestore().collection('messages').add({
        directId: msg.directId,
        senderId: msg.receiverId,
        senderName: (recipient.displayName || 'User') + ' (Auto-reply)',
        receiverId: msg.senderId,
        text: `🔴 ${recipient.displayName || 'I'} is currently busy: "${recipient.busyStatus}". They will get back to you soon.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isAutoReply: true,
        readBy: {}
      });
    } catch (_) {}
  }
);

// ── Feature 7: Detect Calendar Events from Chat Messages ──────────────────
exports.detectCalendarEvent = onCall(
  { region: 'us-central1', secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const { text } = request.data || {};
    if (!text) throw new HttpsError('invalid-argument', 'Missing text.');
    const apiKey = geminiApiKey.value();
    if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not set.');
    const today = new Date().toISOString().split('T')[0];
    const prompt = `Today is ${today}. Analyze this message and extract any event or appointment details.\nMessage: "${text}"\n\nReturn ONLY valid JSON like: {"hasEvent":true,"title":"Dinner","date":"2026-06-25","time":"19:00","note":"at Taj Hotel"}\nIf no event, return: {"hasEvent":false}`;
    try {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 100, temperature: 0 }
          })
        }
      );
      const gemData = await gemRes.json();
      const raw = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '{"hasEvent":false}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { hasEvent: false };
      return result;
    } catch (_) {
      return { hasEvent: false };
    }
  }
);

// ========================================
// Notification Reply — called by service worker when user replies
// inline from a push notification (no open tab scenario)
// ========================================
exports.sendNotificationReply = onRequest(
  { region: 'us-central1', cors: ['https://nishadsl.com', 'https://my-team-chat-2255.web.app'] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) { res.status(401).json({ error: 'Missing auth token' }); return; }

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;

      const { chatId, chatType, chatUserId, groupId, text } = req.body || {};
      const trimmedText = (text || '').trim();
      if (!trimmedText)  { res.status(400).json({ error: 'Empty reply text' }); return; }
      if (!chatId)       { res.status(400).json({ error: 'Missing chatId' });   return; }

      const userSnap = await admin.firestore().collection('users').doc(uid).get();
      const user = userSnap.data() || {};

      const msgData = {
        text: trimmedText,
        senderId: uid,
        senderName: user.displayName || user.name || 'Team Chat',
        senderAvatar: user.avatar || user.photoURL || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        readBy: { [uid]: admin.firestore.FieldValue.serverTimestamp() },
        deliveredTo: {},
        sentViaNotification: true
      };

      if (chatType === 'group' && groupId) {
        msgData.groupId = groupId;
      } else {
        msgData.directId     = chatId;
        msgData.receiverId   = chatUserId || '';
        msgData.participants = [uid, chatUserId].filter(Boolean);
      }

      const ref = await admin.firestore().collection('messages').add(msgData);
      res.status(200).json({ ok: true, messageId: ref.id });
    } catch (err) {
      console.error('sendNotificationReply error:', err);
      res.status(401).json({ error: err.message || 'Unauthorized' });
    }
  }
);

// ── generateUrlPreview — item #24 ─────────────────────────────────────────
exports.generateUrlPreview = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const url = (req.body && req.body.url) || req.query.url;
  if (!url || !/^https?:\/\//.test(url)) {
    res.status(400).json({ error: 'Missing or invalid url parameter' }); return;
  }

  const https = require('https');
  const http  = require('http');
  const { URL } = require('url');

  function getHtml(rawUrl, redirects) {
    redirects = redirects || 0;
    if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
    return new Promise((resolve, reject) => {
      const parsed = new URL(rawUrl);
      const mod = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search, method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatBot/1.0)', Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
        timeout: 7000
      };
      const request = mod.request(options, response => {
        if ([301,302,303,307,308].includes(response.statusCode)) {
          const loc = response.headers.location;
          if (!loc) { reject(new Error('Redirect without location')); return; }
          const next = loc.startsWith('http') ? loc : parsed.origin + loc;
          resolve(getHtml(next, redirects + 1));
          return;
        }
        const ct = response.headers['content-type'] || '';
        if (!ct.includes('text/html') && !ct.includes('text/plain')) {
          reject(new Error('Not HTML')); return;
        }
        let data = ''; let received = 0;
        response.on('data', chunk => { received += chunk.length; if (received < 500000) data += chunk; });
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.on('timeout', () => { request.destroy(); reject(new Error('Timeout')); });
      request.end();
    });
  }

  function extractMeta(html) {
    const m = (prop, name) => {
      const re1 = new RegExp('<meta[^>]+property=["\'\']' + prop + '["\'\'][^>]+content=["\'\']([^\'\'"]+)["\'\']', 'i');
      const re2 = new RegExp('<meta[^>]+content=["\'\']([^\'\'"]+)["\'\'][^>]+property=["\'\']' + prop + '["\'\']', 'i');
      const rn1 = new RegExp('<meta[^>]+name=["\'\']' + name + '["\'\'][^>]+content=["\'\']([^\'\'"]+)["\'\']', 'i');
      const rn2 = new RegExp('<meta[^>]+content=["\'\']([^\'\'"]+)["\'\'][^>]+name=["\'\']' + name + '["\'\']', 'i');
      for (const r of [re1, re2, rn1, rn2]) { const x = html.match(r); if (x) return x[1].trim(); }
      return '';
    };
    const titleM  = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const parsed2 = new URL(url);
    return {
      title      : m('og:title','og:title')       || (titleM ? titleM[1].trim() : ''),
      description: m('og:description','description') || '',
      image      : m('og:image','og:image')         || '',
      domain     : parsed2.hostname.replace(/^www\./,'')
    };
  }

  try {
    const html = await getHtml(url);
    const data = extractMeta(html);
    if (!data.title && !data.description && !data.image) {
      res.status(422).json({ error: 'No preview data found' }); return;
    }
    res.json(data);
  } catch (e) {
    console.error('[generateUrlPreview] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ========================================
// FIRESTORE-TRIGGERED MIGRATIONS
// Create a document in migrationTriggers/{id} with type 'backfillEmails'
// or 'migrateCalls' to run one-time migrations
// ========================================
exports.runMigrationOnTrigger = onDocumentCreated(
  { document: 'migrationTriggers/{triggerId}', region: 'us-central1', timeoutSeconds: 300 },
  async (event) => {
    const trigger = event.data?.data() || {};
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

// ════════════════════════════════════════════════════════════════════════════
// TEMPORARY — Diagnostics: check callLogs, messages, calls data
// ════════════════════════════════════════════════════════════════════════════
exports.diagnoseData = onRequest(
  { region: 'us-central1', invoker: 'public' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    const db = admin.firestore();
    
    const result = {};

    // Check callLogs collection
    const callLogsSnap = await db.collection('callLogs').limit(20).get();
    result.callLogsCount = callLogsSnap.size;
    result.callLogs = callLogsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Check calls collection
    const callsSnap = await db.collection('calls').limit(20).get();
    result.callsCount = callsSnap.size;
    result.calls = callsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Check messages: sample messages with participantEmails
    const msgSnap = await db.collection('messages').limit(5).get();
    result.messagesSample = msgSnap.docs.map(d => ({ id: d.id, participants: d.data().participants, participantEmails: d.data().participantEmails, senderId: d.data().senderId, directId: d.data().directId }));

    // Check directChats
    const dcSnap = await db.collection('directChats').limit(20).get();
    result.directChatsCount = dcSnap.size;
    result.directChats = dcSnap.docs.map(d => ({ id: d.id, participants: d.data().participants }));

    res.json(result);
  }
);


