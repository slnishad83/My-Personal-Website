const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
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
  const [settingsSnap, muteSnap] = await Promise.all([
    admin.firestore().collection('chatNotifSettings').doc(`${userId}_${chatId}`).get(),
    admin.firestore().collection('mutedChats').where('userId', '==', userId).get()
  ]);
  const settings = settingsSnap.data() || {};
  const now = Date.now();
  const muted = muteSnap.docs.some((doc) => {
    const mute = doc.data() || {};
    if (mute.chatId !== chatId) return false;
    const until = mute.muteUntil?.toMillis?.();
    return !until || until > now;
  });
  return {
    muted,
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
      const body = preferences.showPreview ? preview : 'New message';
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
            renotify: true,
            silent: !preferences.soundEnabled,
            timestamp: Date.now(),
            vibrate: preferences.vibrate ? [180, 80, 180] : [],
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
