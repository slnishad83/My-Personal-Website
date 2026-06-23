importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

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
    silent: data.soundEnabled === 'false',
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
    ] : [{ action: 'open', title: 'Open chat' }]
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action || (data.kind === 'call' ? 'accept' : 'open');
  const url = data.kind === 'call' && data.callId
    ? `./index.html?callId=${encodeURIComponent(data.callId)}&callAction=${encodeURIComponent(action)}`
    : (data.url || './index.html');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            return client
              .navigate(url)
              .then(() => client.focus())
              .catch(() => client.focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

const CACHE_NAME = 'team-chat-v211-wa';
const STATIC_ASSETS = [
  'auth-theme.css',
  'feature-updates.css',
  'feature-updates.js',
  'sync-audit.css',
  'sync-audit.js',
  'push-notifications.js',
  'style.css',
  'message-actions.css',
  'ui-audit.css',
  'translation-ui.css',
  'safe-area-audit.css',
  'calls-ui.css',
  'polish.css',
  'config.js',
  'permissions-manager.js',
  'app-core.js',
  'app-extras.js',
  'app-init.js',
  'fixes.js',
  'threads.js',
  'ai-bot.js',
  'features-addon.js',
  'whatsapp-enhancements.js',
  'pwa-install.js',
  'manifest.json',
  'app-icon.svg',
  'app-icon-192.png',
  'app-icon-512.png'
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => (
      Promise.all([
        ...STATIC_ASSETS.map(url => cache.add(url).catch(() => null)),
        ...HTML_PAGES.map(url => cache.add(url).catch(() => null))
      ])
    ))
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
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => caches.match(event.request).then(fallback => fallback || new Response('Offline', { status: 503 })));
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
