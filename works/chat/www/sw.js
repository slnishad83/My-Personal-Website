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
  const isCall = data.kind === 'call';
  const title = payload.notification?.title || (data.type === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call');
  const body = payload.notification?.body || `${data.fromUserName || 'Team Chat'} is calling. Tap to open Team Chat.`;
  const notificationUrl = data.url || payload.notification?.data?.url || './index.html';

  self.registration.showNotification(title, {
    body,
    tag: isCall && data.callId ? `call-${data.callId}` : 'team-chat',
    renotify: true,
    requireInteraction: Boolean(isCall),
    silent: false,
    icon: 'app-icon-192.png',
    badge: 'app-icon-192.png',
    timestamp: Date.now(),
    vibrate: isCall ? [700, 250, 700, 250, 700, 250, 700, 250, 700] : [180, 80, 180],
    data: {
      url: notificationUrl,
      callId: data.callId || '',
      kind: data.kind || '',
      chatUserId: data.chatUserId || ''
    },
    actions: isCall ? [
      { action: 'reject', title: 'Decline' },
      { action: 'accept', title: 'Accept' }
    ] : []
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

const CACHE_NAME = 'team-chat-v160-phase2-navigation';
const urlsToCache = [
  'index.html',
  'login.html',
  'reset.html',
  'verify.html',
  'turn.html',
  'auth-theme.css',
  'style.css',
  'message-actions.css',
  'ui-audit.css',
  'translation-ui.css',
  'safe-area-audit.css',
  'calls-ui.css',
  'app.js',
  'pwa-install.js',
  'manifest.json',
  'app-icon.svg',
  'app-icon-192.png',
  'app-icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => (
      Promise.all(urlsToCache.map(url => cache.add(url).catch(() => null)))
    ))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const requestUrl = new URL(event.request.url);
        if (
          requestUrl.origin === self.location.origin &&
          response.ok &&
          !requestUrl.pathname.toLowerCase().endsWith(".apk")
        ) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
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
