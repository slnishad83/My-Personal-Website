const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
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
    notification: { title, body },
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
      priority: 'high',
      notification: {
        channelId: 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
        ...(chatUserId ? { clickAction: 'OPEN_CHAT' } : {}),
        tag: `chat-request-${requestId || type}`
      }
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
    } else if (after.status === 'accepted' || after.status === 'declined') {
      const accepted = after.status === 'accepted';
      await sendChatRequestEventNotification({
        requestId: event.params.requestId,
        toUserId: after.fromUserId,
        fromUserId: after.toUserId,
        fromUserName: after.toUserName,
        chatUserId: accepted ? after.toUserId : '',
        type: accepted ? 'chat_request_accepted' : 'chat_request_declined',
        title: accepted ? 'Chat request accepted' : 'Chat request declined',
        body: accepted
          ? 'Your chat request has been accepted. Tap to start chatting.'
          : `${after.toUserName || 'The user'} declined your chat request.`
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

    const title = message.senderName || 'New message';
    const body = message.text || 'Sent an attachment';

    const sendTasks = receiverIds.map(async (receiverId) => {
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
        notification: { title, body },
        data: {
          kind: 'message',
          messageId,
          chatId: message.directId || message.groupId || '',
          chatType: message.groupId ? 'group' : 'direct',
          senderId: message.senderId || ''
        },
        android: {
  priority: 'high',
  notification: {
    channelId: 'default',
    defaultSound: true,
    defaultVibrateTimings: true,
    tag: `message-${messageId}`
  }
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
            tag: `message-${messageId}`,
            renotify: true,
            silent: false,
            timestamp: Date.now(),
            data: {
              url: 'https://nishadsl.com/works/chat/',
              messageId,
              kind: 'message'
            },
            actions: [{ action: 'open', title: 'Open' }]
          },
          fcmOptions: {
            link: 'https://nishadsl.com/works/chat/'
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
