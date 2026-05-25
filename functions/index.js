const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');

if (!admin.apps.length) {
  admin.initializeApp();
}

const meteredApiKey = defineSecret('METERED_API_KEY');
const METERED_APP_URL = 'teamchatnishad.metered.live';
const TURN_CREDENTIAL_LABEL = 'team-chat-secure-turn';

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
      notification: { title, body },
      data: {
        kind: 'call',
        callId,
        type: call.type || 'voice',
        fromUserId: call.fromUserId || '',
        fromUserName: call.fromUserName || '',
        toUserId: call.toUserId || ''
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'incoming-calls',
          priority: 'max',
          defaultSound: true,
          defaultVibrateTimings: true,
          tag: `call-${callId}`,
          clickAction: 'https://nishadsl.com/works/chat/'
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
