importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

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

function notifyWindowClients(message) {
  return clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clientList => {
      clientList.forEach(client => {
        try { client.postMessage(message); } catch (_) {}
      });
      return clientList;
    });
}

/* ══════════════════════════════════════════════════════════════
   PUSH NOTIFICATION HANDLING
   ══════════════════════════════════════════════════════════════ */

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  if (data.kind === 'call_ended' && data.callId) {
    return self.registration.getNotifications({ tag: 'call-' + data.callId })
      .then(notifications => notifications.forEach(notification => notification.close()))
      .then(() => notifyWindowClients({ type: 'TC_CALL_STOP', callId: data.callId }));
  }

  if (data.kind === 'read_sync' && data.chatId) {
    var chatKey = (data.chatType || 'chat') + '-' + data.chatId;
    return self.registration.getNotifications({ tag: 'chat-' + chatKey })
      .then(function(notifications) {
        notifications.forEach(function(n) { n.close(); });
        notifyWindowClients({
          type: 'TC_READ_SYNC',
          chatId: data.chatId,
          chatType: data.chatType || 'direct',
          readBy: data.readBy || ''
        });
      });
  }

  var isCall = data.kind === 'call';
  var title = payload.notification?.title || data.title ||
    (isCall ? (data.type === 'video' ? 'Incoming video call' : 'Incoming voice call') : 'Team Chat');
  var body = payload.notification?.body || data.body ||
    (isCall ? (data.fromUserName || 'Team Chat') + ' is calling. Tap to open Team Chat.' : 'New notification');
  var notificationUrl = data.url || payload.notification?.data?.url || './index.html';
  var chatKey2 = data.chatId && data.chatType ? data.chatType + '-' + data.chatId : '';
  var unreadCount = Number(data.unreadCount || 0);
  var chatTag = isCall && data.callId ? 'call-' + data.callId : (chatKey2 ? 'chat-' + chatKey2 : (data.kind || 'team-chat') + '-' + (data.messageId || data.callId || Date.now()));

  self.registration.showNotification(title, {
    body: body,
    tag: chatTag,
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
      messageId: data.messageId || '',
      callId: data.callId || '',
      kind: data.kind || '',
      chatId: data.chatId || '',
      chatType: data.chatType || '',
      unreadCount: unreadCount,
      chatUserId: data.chatUserId || '',
      groupId: data.groupId || '',
      fromUserName: data.fromUserName || ''
    },
    actions: isCall ? [
      { action: 'reject', title: 'Decline' },
      { action: 'accept', title: 'Accept' }
    ] : [
      { action: 'reply', title: '↩ Reply', type: 'text', placeholder: 'Type a reply…' },
      { action: 'mark_read', title: '✓ Mark read' },
      { action: 'open',  title: 'Open' }
    ]
  });

  if (!isCall && chatKey2) {
    notifyWindowClients({
      type: 'TC_PUSH_MESSAGE',
      payload: {
        chatId: data.chatId || '',
        chatType: data.chatType || 'direct',
        chatUserId: data.chatUserId || '',
        groupId: data.groupId || '',
        unreadCount: unreadCount,
        title: title,
        body: body,
        messageId: data.messageId || ''
      }
    });
  }
});

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION REPLY — IndexedDB auth token helper
   ══════════════════════════════════════════════════════════════ */

function getStoredAuthToken() {
  return new Promise(function(resolve) {
    try {
      var req = indexedDB.open('tcAuthStore', 1);
      req.onsuccess = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('tokens')) { resolve(null); return; }
        var get = db.transaction('tokens', 'readonly').objectStore('tokens').get('idToken');
        get.onsuccess = function() { resolve(get.result?.token || null); };
        get.onerror = function() { resolve(null); };
      };
      req.onerror = function() { resolve(null); };
    } catch (_) { resolve(null); }
  });
}

async function handleNotificationReply(data, replyText) {
  var chatId = data.chatId || '';
  var chatType = data.chatType || 'direct';
  var chatUserId = data.chatUserId || '';
  var groupId = data.groupId || '';

  var clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (clientList.length > 0) {
    clientList[0].postMessage({ type: 'TC_NOTIF_REPLY', chatId: chatId, chatType: chatType, chatUserId: chatUserId, groupId: groupId, replyText: replyText });
    await self.registration.showNotification('Reply sent ✓', {
      body: replyText.length > 80 ? replyText.slice(0, 80) + '…' : replyText,
      icon: 'app-icon-192.png', badge: 'app-icon-192.png',
      tag: 'tc-reply-sent-' + chatId, silent: true
    });
    return;
  }

  try {
    var token = await getStoredAuthToken();
    if (!token) throw new Error('no-token');
    var resp = await fetch(
      'https://us-central1-my-team-chat-2255.cloudfunctions.net/sendNotificationReply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ chatId: chatId, chatType: chatType, chatUserId: chatUserId, groupId: groupId, text: replyText })
      }
    );
    if (!resp.ok) throw new Error('cf-' + resp.status);
    await self.registration.showNotification('Reply sent ✓', {
      body: replyText.length > 80 ? replyText.slice(0, 80) + '…' : replyText,
      icon: 'app-icon-192.png', badge: 'app-icon-192.png',
      tag: 'tc-reply-sent-' + chatId, silent: true
    });
  } catch (err) {
    await self.registration.showNotification('Tap to open chat', {
      body: 'Could not send reply automatically — tap to open chat',
      icon: 'app-icon-192.png', badge: 'app-icon-192.png',
      tag: 'tc-reply-failed', data: { url: data.url || './index.html' }
    });
    if (clients.openWindow) clients.openWindow(data.url || './index.html');
  }
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION CLICK HANDLER
   ══════════════════════════════════════════════════════════════ */

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var data = event.notification.data || {};
  var action = event.action || (data.kind === 'call' ? 'accept' : 'open');

  if (action === 'reply' && event.reply != null) {
    var replyText = (event.reply || '').trim();
    if (replyText) event.waitUntil(handleNotificationReply(data, replyText));
    return;
  }

  if (action === 'mark_read') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        clientList.forEach(function(client) {
          try {
            client.postMessage({
              type: 'TC_MARK_READ',
              scope: {
                chatId: data.chatId || '',
                chatType: data.chatType || 'direct',
                chatUserId: data.chatUserId || '',
                groupId: data.groupId || ''
              }
            });
          } catch (_) {}
        });
      })
    );
    return;
  }

  var url = data.kind === 'call' && data.callId
    ? './index.html?callId=' + encodeURIComponent(data.callId) + '&callAction=' + encodeURIComponent(action)
    : (data.url || './index.html');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          return ('navigate' in client)
            ? client.navigate(url).then(function() { return client.focus(); }).catch(function() { return client.focus(); })
            : client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* ══════════════════════════════════════════════════════════════
   CACHING STRATEGY — Versioned, resilient, non-blocking
   
   Tier 1: Critical assets (pre-cached on install — <10 items)
   Tier 2: Important assets (cached on first fetch — stale-while-revalidate)
   Tier 3: Dynamic assets (network-first with cache fallback)
   ══════════════════════════════════════════════════════════════ */

var CACHE_NAME = 'nsl-chat-v3.1.0';
var CACHE_MAX_ENTRIES = 300;

// Tier 1: Critical — pre-cached on install (<10 items to avoid timeout)
var CRITICAL_ASSETS = [
  'manifest.json',
  'app-icon-192.png',
  'app-icon-512.png',
  'app-icon.svg',
  'offline.html',
];

// Tier 2: Important — cached on first fetch (stale-while-revalidate)
var IMPORTANT_ASSETS = [
  'config.js', 'app.js', 'app-extras.js', 'security.js',
  'chat.css', 'chat-theme.css', 'chat-enhancements.css', 'chat-consolidated.css',
  'redesign-base.css', 'chat-missing-features.css', 'accessibility.css',
  'new-features.css', 'message-actions.css', 'scheduled-calendar.css',
  'notification-prefs.css', 'url-preview.css', 'translation-ui.css',
  'sync-audit.css', 'snooze-history.css', 'snooze-enhancements.css',
  'auth-theme.css',
  'notification-sounds.js', 'notification-reply.js', 'pwa-install.js',
  'platform-detect.js', 'offline-queue.js', 'call-sync.js',
  'presence.js', 'multi-device.js', 'error-boundary.js',
  'virtual-scroll.js', 'accessibility.js', 'keyboard-shortcuts.js',
  'chat-missing-features.js', 'chat-enhancements.js', 'chat-fixes.js',
  'threads.js', 'message-search.js', 'notification-prefs.js',
  'notification-digest.js', 'notification-orchestrator.js',
  'notification-telemetry.js', 'ios-callkit.js', 'desktop-notifications.js',
  'permissions-manager.js', 'call-controller.js', 'group-call.js',
  'call-history.js', 'archive-chat.js', 'forward-modal.js',
  'block-user.js', 'message-reactions.js', 'delete-group.js',
  'profile-edit.js', 'app-lock.js', 'video-notes.js',
  'in-call-reactions.js', 'status.js', 'status-viewer.js',
  'notification-nav.js', 'unread-polish.js', 'home-camera.js',
  'group-features.js', 'lazy-modules.js',
  'calculator.js', 'mini-games.js',
];

var HTML_PAGES = [
  'offline.html', 'index.html', 'login.html', 'reset.html',
  'verify.html', 'turn.html', 'album.html', 'insights.html',
  'calendar.html', 'expenses.html'
];

/* ── Install: Pre-cache only critical assets ───────────── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        CRITICAL_ASSETS.map(function(url) {
          return cache.add(url).catch(function() { /* non-fatal */ });
        })
      );
    }).then(function() { return self.skipWaiting(); })
  );
});

/* ── Activate: Clean old caches + claim clients ────────── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys.filter(function(key) { return key !== CACHE_NAME; })
              .map(function(key) { return caches.delete(key); })
        );
      })
      .then(function() {
        if (self.clients && self.clients.claim) return self.clients.claim();
      })
      .then(function() {
        // Enforce cache size limit
        return caches.open(CACHE_NAME).then(function(cache) {
          return cache.keys().then(function(keys) {
            if (keys.length > CACHE_MAX_ENTRIES) {
              var toDelete = keys.slice(0, keys.length - CACHE_MAX_ENTRIES);
              return Promise.all(toDelete.map(function(req) { return cache.delete(req); }));
            }
          });
        });
      })
  );
});

/* ── Fetch: Tiered caching strategy ───────────────────── */
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var requestUrl = new URL(event.request.url);
  var pathname = requestUrl.pathname;

  // Skip non-same-origin requests (except fonts and Firebase)
  var isFirebase = requestUrl.hostname.indexOf('firebase') !== -1 ||
                   requestUrl.hostname.indexOf('gstatic') !== -1 ||
                   requestUrl.hostname.indexOf('googleapis') !== -1;
  var isApk = pathname.toLowerCase().endsWith('.apk');
  var isFirestore = requestUrl.hostname.indexOf('firestore') !== -1 || requestUrl.hostname.indexOf('firebaseio') !== -1;
  var isFunction = requestUrl.hostname.indexOf('cloudfunctions') !== -1;

  // Always network for APK, Firestore, Cloud Functions
  if (isApk || isFirestore || isFunction) {
    event.respondWith(fetch(event.request));
    return;
  }

  var isHtml = pathname.endsWith('.html') || pathname === '/' || pathname === '';
  var isCritical = CRITICAL_ASSETS.some(function(a) { return pathname.endsWith(a); });
  var isImportant = IMPORTANT_ASSETS.some(function(a) { return pathname.endsWith(a); });
  var isVersionJson = pathname.endsWith('version.json');

  // Version check: always network-first for version.json
  if (isVersionJson) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function() { return caches.match(event.request); })
    );
    return;
  }

  // Critical assets: cache-first (already pre-cached)
  if (isCritical) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          if (response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages: network-first with cache fallback
  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            return cached || caches.match('offline.html').then(function(off) {
              return off || new Response('<!DOCTYPE html><html><body style="background:#0d0d0f;color:#e2e4e9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h1 style="font-size:20px;margin-bottom:8px">You\'re offline</h1><p style="color:#8d92a0">Check your connection and try again.</p></div></body></html>', { headers: { 'Content-Type': 'text/html' } }));
            });
          });
        })
    );
    return;
  }

  // Important JS/CSS: stale-while-revalidate
  if (isImportant) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          var fetchPromise = fetch(event.request).then(function(response) {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(function() { return cached; });

          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        var origin = self.location.origin;
        if (response.ok && requestUrl.origin === origin && !isApk) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
        }
        return response;
      })
      .catch(function() { return caches.match(event.request); })
  );
});

/* ══════════════════════════════════════════════════════════════
   BACKGROUND SYNC — Queue failed messages for retry
   ══════════════════════════════════════════════════════════════ */

self.addEventListener('sync', function(event) {
  if (event.tag === 'tc-message-retry') {
    event.waitUntil(notifyWindowClients({ type: 'TC_SYNC_RETRY' }));
  }
});
