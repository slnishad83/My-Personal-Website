const { defineSecret } = require('firebase-functions/params');

const _adminModule = require('firebase-admin');
const admin = new Proxy({}, {
  get(_target, prop) {
    if (!_adminModule.getApps().length) {
      _adminModule.initializeApp();
    }
    return _adminModule[prop];
  }
});

const meteredApiKey = defineSecret('METERED_API_KEY');
const METERED_APP_URL = 'teamchatnishad.metered.live';
const TURN_CREDENTIAL_LABEL = 'team-chat-secure-turn';
const CHAT_APP_URL = 'https://nishadsl.com/works/chat/';
const ADMIN_EMAIL = 'sl.nishad@gmail.com';

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
    admin.firestore().collection('mutedChats').where('userId', '==', userId).where('chatId', '==', chatId).get(),
    admin.firestore().collection('users').doc(userId).get()
  ]);
  const settings = settingsSnap.data() || {};
  const now = Date.now();
  const mutedByUser = muteSnap.docs.some((doc) => {
    const mute = doc.data() || {};
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
  if (!userId || !chatId) return 0;
  const field = chatType === 'group' ? 'groupId' : 'directId';
  const snapshot = await admin.firestore().collection('messages').where(field, '==', chatId).get();
  return snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    return data.senderId &&
      data.senderId !== userId &&
      !data.deletedForEveryone &&
      !data.deletedFor?.[userId] &&
      !data.openedBy?.[userId] &&
      !data.readBy?.[userId];
  }).length;
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
    android: { priority: 'high' },
    webpush: {
      headers: { Urgency: 'high', TTL: '3600' },
      notification: {
        title, body,
        icon: '/works/chat/app-icon-192.png',
        badge: '/works/chat/app-icon-192.png',
        tag: `chat-request-${requestId || type}`,
        renotify: true,
        data: { url: notificationUrl, kind: 'chat_request', requestId: requestId || '', chatUserId: chatUserId || '' }
      },
      fcmOptions: { link: notificationUrl }
    }
  });
  await removeStalePushTokens(userSnap, user, tokens, response);
}

async function findVerifiedUserByEmail(email, callerUid) {
  if (!email) return null;
  const usersRef = admin.firestore().collection('users');
  const snapshot = await usersRef.where('email', '==', email.toLowerCase().trim()).limit(1).get();
  if (!snapshot.empty) {
    const userDoc = snapshot.docs[0];
    const data = userDoc.data() || {};
    return {
      uid: userDoc.id,
      displayName: data.displayName || '',
      avatar: data.avatar || data.photoURL || '',
      status: data.presence?.status || 'offline'
    };
  }
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return {
      uid: userRecord.uid,
      displayName: userRecord.displayName || '',
      avatar: userRecord.photoURL || '',
      status: 'offline'
    };
  } catch (e) {
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://nishadsl.com',
  'https://my-team-chat-2255.web.app',
  'https://my-team-chat-2255.firebaseapp.com',
  'http://localhost:5000',
  'capacitor://localhost',
  'http://localhost'
];

function setCorsHeaders(response, origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://nishadsl.com';
  response.set('Access-Control-Allow-Origin', allowed);
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.set('Access-Control-Max-Age', '86400');
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

async function verifyFirebaseUser(request) {
  const authHeader = request.get('Authorization') || request.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) throw new Error('Missing or invalid Authorization header');
  const token = authHeader.slice(7);
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded;
}

function assertValidOrigin(request) {
  const origin = request.get('Origin') || request.get('Referer') || '';
  if (!origin) return;
  const allowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
  if (!allowed) throw new Error('Forbidden origin');
}

const _rateLimitBuckets = new Map();

function checkRateLimit(userId, action, maxPerMinute) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  let bucket = _rateLimitBuckets.get(key);
  if (!bucket || now - bucket.resetAt > 60000) {
    bucket = { count: 0, resetAt: now + 60000 };
    _rateLimitBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count <= maxPerMinute;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of _rateLimitBuckets) {
    if (now > bucket.resetAt) _rateLimitBuckets.delete(key);
  }
}, 300000);

async function syncGroupAccessMetadata(groupId) {
  if (!groupId) return;
  const [membersSnap, groupSnap] = await Promise.all([
    admin.firestore().collection('groupMembers').where('groupId', '==', groupId).get(),
    admin.firestore().collection('groups').doc(groupId).get()
  ]);
  const group = groupSnap.data() || {};
  const memberIds = [];
  const adminIds = [];
  let title = group.title || group.name || 'Group';
  membersSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    memberIds.push(doc.id);
    if (data.role === 'admin' || data.role === 'owner') adminIds.push(doc.id);
    if (data.displayName && !title.startsWith(data.displayName)) title = data.displayName;
  });
  const memberCount = memberIds.length;
  await admin.firestore().collection('groups').doc(groupId).set(
    { memberIds, adminIds, memberCount, title, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

module.exports = {
  admin, meteredApiKey, CHAT_APP_URL, ADMIN_EMAIL,
  METERED_APP_URL, TURN_CREDENTIAL_LABEL,
  getUserPushTokens, removeStalePushTokens, getMessagePreview,
  getChatNotificationPreferences, getUnreadMessageCount,
  addNotificationCenterItem, sendChatRequestEventNotification,
  findVerifiedUserByEmail, setCorsHeaders, verifyFirebaseUser,
  assertValidOrigin, checkRateLimit, syncGroupAccessMetadata
};
