importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34",
  authDomain: "my-team-chat-2255.firebaseapp.com",
  projectId: "my-team-chat-2255",
  storageBucket: "my-team-chat-2255.firebasestorage.app",
  messagingSenderId: "805016891521",
  appId: "1:805016891521:web:ac9bc7a252bcf33686dd80"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  if (data.kind === 'call_ended' && data.callId) {
    return self.registration.getNotifications({ tag: `call-${data.callId}` })
      .then(notifications => notifications.forEach(notification => notification.close()));
  }
  const isCall = data.kind === 'call';
  const title = payload.notification?.title || data.title ||
    (isCall ? (data.type === 'video' ? 'Incoming video call' : 'Incoming voice call') : 'Team Chat');
  const body = payload.notification?.body || data.body ||
    (isCall ? `${data.fromUserName || 'Team Chat'} is calling. Tap to open Team Chat.` : 'New notification');
  const notificationUrl = data.url || payload.notification?.data?.url || './index.html';
  const chatKey = data.chatId && data.chatType ? `${data.chatType}-${data.chatId}` : '';
  const unreadCount = Number(data.unreadCount || 0);

  self.registration.showNotification(title, {
    body,
    tag: isCall && data.callId ? `call-${data.callId}` : (chatKey ? `chat-${chatKey}` : `${data.kind || 'team-chat'}-${data.messageId || data.callId || Date.now()}`),
    renotify: Boolean(isCall),
    requireInteraction: Boolean(isCall),
    silent: data.soundEnabled === false || data.soundEnabled === 'false',
    icon: data.senderAvatar || 'app-icon-192.png',
    badge: 'app-icon-192.png',
    image: data.senderAvatar || 'app-icon-512.png',
    timestamp: Date.now(),
    vibrate: data.vibrate === 'false' ? [] : (isCall ? [700, 250, 700, 250, 700, 250, 700, 250, 700] : [180, 80, 180]),
    data: {
      url: notificationUrl,
      callId: data.callId || '',
      kind: data.kind || '',
      chatId: data.chatId || '',
      chatType: data.chatType || '',
      unreadCount,
      chatUserId: data.chatUserId || '',
      groupId: data.groupId || '',
      fromUserName: data.fromUserName || ''
    },
    actions: isCall ? [
      { action: 'reject', title: 'Decline' },
      { action: 'accept', title: 'Accept' }
    ] : [
      { action: 'reply', title: '↩ Reply', type: 'text', placeholder: 'Type a reply…' },
      { action: 'open',  title: 'Open' }
    ]
  });
});

/* ── IDB helper: read Firebase ID token stored by notification-reply.js ── */
function getStoredAuthToken() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('tcAuthStore', 1);
      req.onsuccess = e => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains('tokens')) { resolve(null); return; }
        const get = idb.transaction('tokens', 'readonly').objectStore('tokens').get('idToken');
        get.onsuccess = () => resolve(get.result?.token || null);
        get.onerror   = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch (_) { resolve(null); }
  });
}

/* ── Send a notification reply (tab open → postMessage, else Cloud Function) ── */
async function handleNotificationReply(data, replyText) {
  const chatId     = data.chatId     || '';
  const chatType   = data.chatType   || 'direct';
  const chatUserId = data.chatUserId || '';
  const groupId    = data.groupId    || '';

  /* Try relaying to an open app tab first */
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clientList.length > 0) {
    clientList[0].postMessage({ type: 'TC_NOTIF_REPLY', chatId, chatType, chatUserId, groupId, replyText });
    await self.registration.showNotification('Reply sent ✓', {
      body: replyText.length > 80 ? replyText.slice(0, 80) + '…' : replyText,
      icon: 'app-icon-192.png', badge: 'app-icon-192.png',
      tag: 'tc-reply-sent-' + chatId, silent: true
    });
    return;
  }

  /* No open tab — send via Cloud Function using the stored ID token */
  try {
    const token = await getStoredAuthToken();
    if (!token) throw new Error('no-token');

    const resp = await fetch(
      'https://us-central1-my-team-chat-2255.cloudfunctions.net/sendNotificationReply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ chatId, chatType, chatUserId, groupId, text: replyText })
      }
    );
    if (!resp.ok) throw new Error('cf-' + resp.status);

    await self.registration.showNotification('Reply sent ✓', {
      body: replyText.length > 80 ? replyText.slice(0, 80) + '…' : replyText,
      icon: 'app-icon-192.png', badge: 'app-icon-192.png',
      tag: 'tc-reply-sent-' + chatId, silent: true
    });
  } catch (err) {
    /* Fallback — open the chat so user can send manually */
    await self.registration.showNotification('Tap to open chat', {
      body: 'Could not send reply automatically — tap to open chat',
      icon: 'app-icon-192.png', badge: 'app-icon-192.png',
      tag: 'tc-reply-failed', data: { url: data.url || './index.html' }
    });
    if (clients.openWindow) clients.openWindow(data.url || './index.html');
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data   = event.notification.data || {};
  const action = event.action || (data.kind === 'call' ? 'accept' : 'open');

  /* Inline reply — only fired on browsers that support type:'text' actions (Chrome Android) */
  if (action === 'reply' && event.reply != null) {
    const replyText = (event.reply || '').trim();
    if (replyText) event.waitUntil(handleNotificationReply(data, replyText));
    return;
  }

  const url = data.kind === 'call' && data.callId
    ? `./index.html?callId=${encodeURIComponent(data.callId)}&callAction=${encodeURIComponent(action)}`
    : (data.url || './index.html');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          return ('navigate' in client)
            ? client.navigate(url).then(() => client.focus()).catch(() => client.focus())
            : client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

const CACHE_NAME = 'nsl-chat-v1';
const STATIC_ASSETS = [
  'chat.css',
  'config.js',
  'chat-theme.css',
  'notification-reply.js',
  'manifest.json',
  'app-icon.svg',
  'app-icon-192.png',
  'app-icon-512.png',
  'pwa-install.js',
  'platform-detect.js',
  'network-quality.js',
  'audio-manager.js',
  'offline-queue.js',
  'presence.js',
  'multi-device.js',
  'security.js',
  'error-boundary.js',
  'virtual-scroll.js',
  'accessibility.js',
  'keyboard-shortcuts.js',
  'chat-missing-features.js',
  'chat-enhancements.js',
  'chat-fixes.js',
  'threads.js',
  'message-search.js',
  'notification-prefs.js',
  'notification-digest.js',
  'permissions-manager.js',
  '../app-extras.js',
  '../app.js'
];
const HTML_PAGES = [
  'index.html',
  'login.html',
  'reset.html',
  'verify.html',
  'turn.html',
  'album.html',
  'insights.html',
  'calendar.html',
  'expenses.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => (
      Promise.all([
        ...STATIC_ASSETS.map(url => cache.add(url).catch(() => null)),
        ...HTML_PAGES.map(url => cache.add(url).catch(() => null))
      ])
    )).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isApk = requestUrl.pathname.toLowerCase().endsWith('.apk');
  const isHtml = requestUrl.pathname.endsWith('.html') || requestUrl.pathname === '/' || requestUrl.pathname === '';
  const isStatic = STATIC_ASSETS.some(asset => requestUrl.pathname.endsWith(asset));
  const isFirestore = requestUrl.hostname.indexOf('firestore') !== -1 || requestUrl.hostname.indexOf('firebaseio') !== -1;
  const isFunction = requestUrl.pathname.indexOf('cloudfunctions') !== -1;

  if (isApk || isFirestore || isFunction) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isStatic) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached);
          if (cached) { fetchPromise.catch(() => {}); return cached; }
          return fetchPromise;
        });
      })
    );
    return;
  }

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => {
          if (cached) return cached;
          return caches.match('index.html');
        }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const origin = self.location.origin;
        if (response.ok && requestUrl.origin === origin && !isApk) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
