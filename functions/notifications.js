const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');

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

const CHAT_APP_URL = 'https://chat.nishadsl.com/works/chat/';

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
            url: 'https://chat.nishadsl.com/works/chat/',
            callId,
            kind: 'call'
          },
          actions: [{ action: 'open', title: 'Open' }]
        },
        fcmOptions: {
          link: 'https://chat.nishadsl.com/works/chat/'
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
              url: 'https://chat.nishadsl.com/works/chat/',
              callId,
              kind: 'call'
            },
            actions: [
              { action: 'reject', title: 'Decline' },
              { action: 'accept', title: 'Accept' }
            ]
          },
          fcmOptions: { link: 'https://chat.nishadsl.com/works/chat/' }
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

    // Fan out to ALL participants (both caller and callee) so every device clears the notification
    const allParticipantIds = new Set([
      call.fromUserId,
      call.toUserId,
      ...(call.participantIds || [])
    ].filter(Boolean));
    const receiverIds = [...allParticipantIds].filter(uid => uid !== call.fromUserId || call.groupCall === true);

    await Promise.all(receiverIds.map(async (receiverId) => {
      const { userSnap, user, tokens } = await getUserPushTokens(receiverId);
      if (!tokens.length) return;
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        data: {
          kind: 'call_ended',
          callId: event.params.callId,
          status: call.status || 'ended',
          fromUserId: call.fromUserId || '',
          toUserId: call.toUserId || ''
        },
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high', TTL: '60' } }
      });
      await removeStalePushTokens(userSnap, user, tokens, response);
    }));
    return null;
  }
);

exports.fanOutCallStateChange = onDocumentUpdated(
  {
    document: 'calls/{callId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const call = event.data?.after.data() || {};
    const callId = event.params.callId;
    if (before.status === call.status) return null;

    const newStatus = call.status;
    const oldStatus = before.status;

    // Notify the CALLER when the callee accepts or declines
    if (newStatus === 'connected' && oldStatus === 'ringing' && call.fromUserId) {
      const { userSnap, user, tokens } = await getUserPushTokens(call.fromUserId);
      if (tokens.length) {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          data: {
            kind: 'call_accepted',
            callId,
            type: call.type || 'voice',
            fromUserId: call.toUserId || '',
            fromUserName: call.toUserName || ''
          },
          android: { priority: 'high' },
          webpush: { headers: { Urgency: 'high', TTL: '30' } }
        });
        await removeStalePushTokens(userSnap, user, tokens, response);
      }
    }

    // Notify the CALLER when callee declines
    if (newStatus === 'declined' && oldStatus === 'ringing' && call.fromUserId) {
      const { userSnap, user, tokens } = await getUserPushTokens(call.fromUserId);
      if (tokens.length) {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          data: {
            kind: 'call_declined',
            callId,
            type: call.type || 'voice',
            fromUserId: call.toUserId || '',
            fromUserName: call.toUserName || ''
          },
          android: { priority: 'high' },
          webpush: { headers: { Urgency: 'normal', TTL: '60' } }
        });
        await removeStalePushTokens(userSnap, user, tokens, response);
      }
    }

    // Notify the CALLER when callee is busy
    if (newStatus === 'busy' && oldStatus === 'ringing' && call.fromUserId) {
      const { userSnap, user, tokens } = await getUserPushTokens(call.fromUserId);
      if (tokens.length) {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          data: {
            kind: 'call_busy',
            callId,
            type: call.type || 'voice',
            fromUserId: call.toUserId || ''
          },
          android: { priority: 'normal' },
          webpush: { headers: { Urgency: 'normal', TTL: '60' } }
        });
        await removeStalePushTokens(userSnap, user, tokens, response);
      }
    }

    // Notify the CALLER when callee fails to connect
    if (newStatus === 'failed' && oldStatus === 'ringing' && call.fromUserId) {
      const { userSnap, user, tokens } = await getUserPushTokens(call.fromUserId);
      if (tokens.length) {
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          data: {
            kind: 'call_failed',
            callId,
            type: call.type || 'voice',
            reason: call.failureReason || 'connection_failed'
          },
          android: { priority: 'normal' },
          webpush: { headers: { Urgency: 'normal', TTL: '60' } }
        });
        await removeStalePushTokens(userSnap, user, tokens, response);
      }
    }

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
      const notificationUrl = (chatType === 'group'
        ? `${CHAT_APP_URL}?groupId=${encodeURIComponent(chatId)}`
        : `${CHAT_APP_URL}?chatUserId=${encodeURIComponent(chatUserId)}`)
        + `&messageId=${encodeURIComponent(messageId)}`;
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

exports.sendReactionNotification = onDocumentUpdated(
  {
    document: 'messages/{messageId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const messageId = event.params.messageId;

    const beforeReactions = before.reactions || {};
    const afterReactions = after.reactions || {};

    const newReactions = {};
    for (const [emoji, afterEntry] of Object.entries(afterReactions)) {
      const beforeEntry = beforeReactions[emoji] || {};
      const beforeUsers = Array.isArray(beforeEntry) ? beforeEntry : (beforeEntry.users || []);
      const afterUsers = Array.isArray(afterEntry) ? afterEntry : (afterEntry.users || []);
      const newUsers = afterUsers.filter((uid) => !beforeUsers.includes(uid));
      if (newUsers.length) {
        newReactions[emoji] = newUsers;
      }
    }

    if (!Object.keys(newReactions).length) return null;

    const senderId = after.senderId || '';
    if (!senderId) return null;

    for (const [emoji, reactors] of Object.entries(newReactions)) {
      for (const reactorId of reactors) {
        if (reactorId === senderId) continue;

        const [reactorSnap, messageSnap] = await Promise.all([
          admin.firestore().collection('users').doc(reactorId).get().catch(() => null),
          after.attachment ? null : null
        ]);
        const reactorName = reactorSnap?.data?.()?.displayName || reactorSnap?.data?.()?.email || 'Someone';

        const chatId = after.directId || after.groupId || '';
        const chatType = after.groupId ? 'group' : 'direct';
        const chatUserId = chatType === 'direct' ? senderId : '';
        const notificationUrl = `${CHAT_APP_URL}?${chatType === 'group' ? 'groupId' : 'chatUserId'}=${encodeURIComponent(chatId)}&messageId=${encodeURIComponent(messageId)}`;

        const receiverTokens = await getUserPushTokens(senderId);
        if (!receiverTokens.tokens.length) continue;

        const preview = after.text || after.attachment?.type || 'message';
        const title = chatType === 'group'
          ? `${reactorName} reacted ${emoji} · ${after.groupName || 'Group'}`
          : `${reactorName} reacted ${emoji}`;
        const body = `to: "${preview.length > 80 ? preview.substring(0, 80) + '...' : preview}"`;

        const fcmMessage = {
          tokens: receiverTokens.tokens,
          data: {
            kind: 'reaction',
            title,
            body,
            messageId,
            chatId,
            chatType,
            chatUserId,
            groupId: after.groupId || '',
            emoji,
            reactorName,
            reactorId,
            senderId,
            url: notificationUrl,
            vibrate: 'true',
            soundEnabled: 'true',
            unreadCount: '1'
          },
          android: { priority: 'high' },
          webpush: {
            headers: { Urgency: 'high', TTL: '120' }
          }
        };

        const response = await admin.messaging().sendEachForMulticast(fcmMessage);
        await removeStalePushTokens(receiverTokens.userSnap, receiverTokens.user, receiverTokens.tokens, response);
      }
    }

    return null;
  }
);

exports.busyAutoReply = onDocumentCreated(
  { document: 'messages/{messageId}', region: 'asia-south1' },
  async (event) => {
    const msg = event.data?.data();
    if (!msg || msg.senderId === 'busy-autoreply' || msg.isAutoReply) return;
    if (!msg.directId || !msg.receiverId) return;
    try {
      const recipientSnap = await admin.firestore().collection('users').doc(msg.receiverId).get();
      if (!recipientSnap.exists) return;
      const recipient = recipientSnap.data();
      if (!recipient?.busyStatus) return;
      await admin.firestore().collection('messages').add({
        directId: msg.directId,
        senderId: msg.receiverId,
        senderName: (recipient.displayName || 'User') + ' (Auto-reply)',
        receiverId: msg.senderId,
        text: `${recipient.displayName || 'I'} is currently busy: "${recipient.busyStatus}". They will get back to you soon.`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isAutoReply: true,
        readBy: {}
      });
    } catch (err) {
      console.error('[busyAutoReply] Error:', err.message);
    }
  }
);

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

exports.syncReadStatus = onDocumentUpdated(
  {
    document: 'messages/{messageId}',
    region: 'us-central1'
  },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    const messageId = event.params.messageId;

    // Detect newly added readBy entries
    const beforeReadBy = before.readBy || {};
    const afterReadBy = after.readBy || {};
    const newlyReadBy = [];

    for (const [uid, ts] of Object.entries(afterReadBy)) {
      if (!beforeReadBy[uid] && ts) {
        newlyReadBy.push(uid);
      }
    }

    if (!newlyReadBy.length) return null;

    // For each user who just read the message, send a sync notification
    // to their OTHER devices so they can clear the notification badge
    await Promise.all(newlyReadBy.map(async (readerId) => {
      try {
        const userSnap = await admin.firestore().collection('users').doc(readerId).get();
        const user = userSnap.data() || {};
        const tokens = Object.values(user.fcmTokens || {})
          .map((entry) => entry && entry.token)
          .filter(Boolean);

        if (tokens.length <= 1) return null; // Only one device, no sync needed

        const chatId = after.directId || after.groupId || '';
        const chatType = after.groupId ? 'group' : 'direct';

        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          data: {
            kind: 'read_sync',
            messageId,
            chatId,
            chatType,
            readBy: readerId,
            unreadCount: '0'
          },
          android: { priority: 'normal' },
          webpush: {
            headers: { Urgency: 'normal', TTL: '30' }
          }
        });

        await removeStalePushTokens(userSnap, user, tokens, response);
      } catch (e) {
        console.warn('[syncReadStatus] Error syncing for user', readerId, e.message);
      }
    }));

    return null;
  }
);
