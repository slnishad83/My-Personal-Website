importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const SW_VERSION = 'v180-notifications';
const CACHE_NAME = `team-chat-${SW_VERSION}`;
const APP_URL = 'https://nishadsl.com/works/chat/';

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

/* ── Active call ring map: callId → intervalId ─── */
const activeCallRings = new Map();

function stopCallRing(callId) {
  const id = activeCallRings.get(callId);
  if (id) { clearInterval(id); activeCallRings.delete(callId); }
}

/* ── Show a notification (wrapper) ─────────────────────────────────────── */
async function showCallNotification(callId, type, fromName, iteration) {
  const title = type === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call';
  const body  = `${fromName || 'Team Chat'} is calling…  (${iteration})`;
  return self.registration.showNotification(title, {
    tag: `call-${callId}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    icon:  '/works/chat/app-icon-192.png',
    badge: '/works/chat/app-icon-192.png',
    timestamp: Date.now(),
    vibrate: [700, 250, 700, 250, 700, 250, 700, 250, 700],
    data: { url: APP_URL, callId, kind: 'call', type, fromName },
    actions: [
      { action: 'accept', title: '✅ Accept' },
      { action: 'reject', title: '❌ Decline' },
    ],
  });
}

async function showMessageNotification(payload) {
  const data  = payload.data  || {};
  const notif = payload.notification || {};
  const title = notif.title || data.senderName || 'New message';
  const body  = notif.body  || data.text || 'You have a new message';
  const tag   = `msg-${data.chatId || data.messageId || 'chat'}`;
  return self.registration.showNotification(title, {
    tag,
    renotify: true,
    requireInteraction: false,
    silent: false,
    icon:  '/works/chat/app-icon-192.png',
    badge: '/works/chat/app-icon-192.png',
    timestamp: Date.now(),
    vibrate: [200, 100, 200],
    data: {
      url: APP_URL,
      messageId: data.messageId || '',
      chatId: data.chatId || '',
      chatType: data.chatType || 'direct',
      kind: 'message',
    },
    actions: [{ action: 'open', title: 'Open' }],
  });
}

/* ── FCM background handler ─────────────────────────────────────────────── */
messaging.onBackgroundMessage(async payload => {
  const data = payload.data || {};

  /* ── CALL notifications ──────────────────────────────── */
  if (data.kind === 'call' && data.callId) {
    const { callId, type = 'voice', fromUserName = 'Team Chat' } = data;

    // Stop any previous ring for this call
    stopCallRing(callId);

    let iteration = 1;
    await showCallNotification(callId, type, fromUserName, iteration);

    // Re-show notification every 5 s to simulate ringing (up to 60 s / 12 rings)
    const ringInterval = setInterval(async () => {
      iteration++;
      if (iteration > 12) { stopCallRing(callId); return; }
      // Check if call was already answered/dismissed
      const openNotifs = await self.registration.getNotifications({ tag: `call-${callId}` });
      if (!openNotifs.length) { stopCallRing(callId); return; }
      await showCallNotification(callId, type, fromUserName, iteration);
    }, 5000);

    activeCallRings.set(callId, ringInterval);
    return;
  }

  /* ── MESSAGE notifications ───────────────────────────── */
  await showMessageNotification(payload);
});

/* ── Notification click ─────────────────────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const nData  = event.notification.data || {};
  const action = event.action || 'open';

  // Stop ringing for this call
  if (nData.callId) stopCallRing(nData.callId);

  let targetUrl = APP_URL;
  if (nData.kind === 'call' && nData.callId) {
    targetUrl = `${APP_URL}?callId=${encodeURIComponent(nData.callId)}&callAction=${encodeURIComponent(action)}`;
  } else if (nData.kind === 'message' && nData.chatId) {
    targetUrl = `${APP_URL}?openChat=${encodeURIComponent(nData.chatId)}&chatType=${encodeURIComponent(nData.chatType || 'direct')}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Try to focus an existing tab
      for (const client of clientList) {
        const clientBase = client.url.split('?')[0].replace(/\/?$/, '/');
        const appBase    = APP_URL.replace(/\/?$/, '/');
        if (clientBase === appBase && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', action, data: nData });
          return;
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* ── Notification close (reject action) ──────────────────────────────────── */
self.addEventListener('notificationclose', event => {
  const nData = event.notification.data || {};
  if (nData.callId) stopCallRing(nData.callId);
});

/* ── Push event fallback (for data-only messages without notification key) ── */
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch (e) { return; }

  // Firebase SDK handles this in onBackgroundMessage above;
  // this fallback fires for raw push events that bypass FCM SDK.
  const data = payload.data || {};
  if (!data.kind) return; // already handled by FCM SDK

  if (data.kind === 'call' && data.callId) {
    event.waitUntil(
      showCallNotification(data.callId, data.type || 'voice', data.fromUserName || 'Team Chat', 1)
    );
  } else if (data.kind === 'message') {
    event.waitUntil(showMessageNotification(payload));
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   SERVICE WORKER LIFECYCLE + CACHING
   ══════════════════════════════════════════════════════════════════════════ */
const urlsToCache = [
  'index.html', 'login.html', 'reset.html', 'verify.html', 'turn.html',
  'auth-theme.css', 'style.css', 'message-actions.css', 'ui-audit.css',
  'translation-ui.css', 'safe-area-audit.css', 'calls-ui.css',
  'app.js', 'pwa-install.js', 'manifest.json',
  'app-icon.svg', 'app-icon-192.png', 'app-icon-512.png',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(urlsToCache.map(url => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const url = new URL(event.request.url);
        if (url.origin === self.location.origin && response.ok &&
            !url.pathname.toLowerCase().endsWith('.apk')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ── Handle messages from app (e.g., call answered → stop ring) ─────────── */
self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'CALL_ANSWERED' && msg.callId) {
    stopCallRing(msg.callId);
    self.registration.getNotifications({ tag: `call-${msg.callId}` })
      .then(notifs => notifs.forEach(n => n.close()));
  }
  if (msg.type === 'CALL_REJECTED' && msg.callId) {
    stopCallRing(msg.callId);
    self.registration.getNotifications({ tag: `call-${msg.callId}` })
      .then(notifs => notifs.forEach(n => n.close()));
  }
});
