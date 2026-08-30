importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

var firebaseConfig = {"apiKey":"AIzaSyCdbut_FdscAjl-OVSlAUhb7TOTiRNkh34","authDomain":"my-team-chat-2255.firebaseapp.com","projectId":"my-team-chat-2255","storageBucket":"my-team-chat-2255.firebasestorage.app","messagingSenderId":"805016891521","appId":"1:805016891521:web:ac9bc7a252bcf33686dd80"};

firebase.initializeApp(firebaseConfig);
var messaging = firebase.messaging();

function notifyWindowClients(message) {
  return clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(function(clientList) {
      clientList.forEach(function(client) {
        try { client.postMessage(message); } catch (_) {}
      });
      return clientList;
    });
}

/* ══════════════════════════════════════════════════════════════
   PUSH NOTIFICATION HANDLING
   ══════════════════════════════════════════════════════════════ */

messaging.onBackgroundMessage(function(payload) {
  var data = payload.data || {};
  if (data.kind === 'call_ended' && data.callId) {
    return self.registration.getNotifications({ tag: 'call-' + data.callId })
      .then(function(notifications) {
        notifications.forEach(function(n) { n.close(); });
      })
      .then(function() {
        return notifyWindowClients({ type: 'TC_CALL_STOP', callId: data.callId });
      });
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
  var isReaction = data.kind === 'reaction';
  var title = (payload.notification && payload.notification.title) || data.title ||
    (isCall ? (data.type === 'video' ? 'Incoming video call' : 'Incoming voice call') :
    (isReaction ? (data.fromUserName || 'Someone') + ' reacted ' + (data.emoji || '') : 'Team Chat'));
  var body = (payload.notification && payload.notification.body) || data.body ||
    (isCall ? (data.fromUserName || 'Team Chat') + ' is calling. Tap to open Team Chat.' :
    (isReaction ? data.message || 'Reacted to your message' : 'New notification'));
  var notificationUrl = data.url || (payload.notification && payload.notification.data && payload.notification.data.url) || './index.html';
  var chatKey2 = data.chatId && data.chatType ? data.chatType + '-' + data.chatId : '';
  var unreadCount = Number(data.unreadCount || 0);

  var chatTag;
  if (isCall && data.callId) {
    chatTag = 'call-' + data.callId;
  } else if (isReaction && data.messageId) {
    chatTag = 'reaction-' + data.messageId;
  } else if (chatKey2) {
    chatTag = 'chat-' + chatKey2;
  } else {
    chatTag = (data.kind || 'team-chat') + '-' + (data.messageId || data.callId || Date.now());
  }

  var actions = [];
  if (isCall) {
    actions = [
      { action: 'accept_call', title: 'Accept' },
      { action: 'decline_call', title: 'Decline' }
    ];
  } else if (isReaction) {
    actions = [
      { action: 'open_chat', title: 'View' }
    ];
  } else if (data.chatId) {
    actions = [
      { action: 'open_chat', title: 'Open' },
      { action: 'mark_read', title: 'Mark read' }
    ];
  }

  var notifData = {
    url: notificationUrl,
    chatId: data.chatId || '',
    chatType: data.chatType || '',
    messageId: data.messageId || '',
    callId: data.callId || '',
    kind: data.kind || 'message',
    emoji: data.emoji || '',
    fromUserName: data.fromUserName || '',
    unreadCount: unreadCount
  };

  if (isReaction && data.messageId) {
    notifData.url = './index.html#reaction:' + data.messageId;
  }

  var notificationPromise = self.registration.showNotification(title, {
    body: body,
    icon: 'app-icon-192.png',
    badge: 'app-icon-192.png',
    tag: chatTag,
    renotify: true,
    requireInteraction: isCall,
    silent: false,
    data: notifData,
    actions: actions
  });

  return notificationPromise.then(function() {
    if (isReaction && data.chatId) {
      return notifyWindowClients({
        type: 'TC_OPEN_CHAT',
        chatId: data.chatId,
        chatType: data.chatType || 'direct',
        messageId: data.messageId || '',
        kind: 'reaction',
        emoji: data.emoji || ''
      });
    }
    if (unreadCount > 0 && data.chatId) {
      return notifyWindowClients({
        type: 'TC_UNREAD_COUNT',
        chatId: data.chatId,
        chatType: data.chatType || 'direct',
        count: unreadCount
      });
    }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var data = event.notification.data || {};
  var url = data.url || './index.html';

  // Validate URL is same-origin to prevent phishing
  try {
    var urlObj = new URL(url, self.location.origin);
    if (urlObj.origin !== self.location.origin) {
      url = './index.html';
    }
  } catch (_) {
    url = './index.html';
  }

  if (event.action === 'decline_call' && data.callId) {
    return notifyWindowClients({ type: 'TC_CALL_DECLINE', callId: data.callId });
  }

  if (event.action === 'accept_call' && data.callId) {
    url = './index.html#call=' + data.callId;
  }

  if (event.action === 'mark_read' && data.chatId) {
    notifyWindowClients({
      type: 'TC_READ_SYNC',
      chatId: data.chatId,
      chatType: data.chatType || 'direct',
      readBy: 'self'
    });
    return;
  }

  if (event.action === 'reply' && data.chatId) {
    var replyText = event.notification.data && event.notification.data.reply;
    if (replyText) {
      notifyWindowClients({
        type: 'TC_NOTIF_REPLY',
        chatId: data.chatId,
        chatType: data.chatType || 'direct',
        chatUserId: data.chatUserId || '',
        groupId: data.groupId || '',
        replyText: replyText
      });
    }
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.focus();
          if (data.chatId) {
            client.postMessage({
              type: 'TC_OPEN_CHAT',
              chatId: data.chatId,
              chatType: data.chatType || 'direct',
              messageId: data.messageId || '',
              kind: data.kind || 'message',
              emoji: data.emoji || ''
            });
          }
          return;
        }
      }
      if (clients.openWindow) {
        var openUrl = url;
        if (data.kind === 'reaction' && data.messageId) {
          openUrl = './index.html#reaction:' + data.messageId;
        }
        return clients.openWindow(openUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Analytics cleanup for dismissed notifications
});

/* ══════════════════════════════════════════════════════════════
   VITE-OPTIMIZED CACHING STRATEGY
   ══════════════════════════════════════════════════════════════
   Vite produces hashed filenames: main-BGMyYqdm.js, main-DWtoic-G.css
   Hashed assets → cache-forever (immutable — hash changes with content)
   HTML pages → network-first (may reference new hashes)
   Firebase CDN → stale-while-revalidate (versions rarely change)
   Everything else → network-first with cache fallback
   ══════════════════════════════════════════════════════════════ */

var CACHE_NAME = 'nsl-chat-v7.1.0';
var CACHE_MAX_ENTRIES = 300;

/* Pre-cached on install — minimal set for offline shell */
var SHELL_ASSETS = [
  './',
  'index.html',
  'login.html',
  'manifest.json',
  'app-icon-192.png',
  'app-icon-512.png',
  'offline.html'
];

/* ══════════════════════════════════════════════════════════════
   URL PATTERN HELPERS
   ══════════════════════════════════════════════════════════════ */

function isViteHashedAsset(pathname) {
  // Matches /assets/*.js, /assets/*.css, /assets/*.png etc.
  // Vite pattern: name-HASH.ext (e.g., main-08Q2jOX6.js)
  return /\/assets\/[^\s]+-[a-zA-Z0-9_-]{8,}\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/i.test(pathname);
}

function isFirebaseHost(hostname) {
  return hostname.indexOf('firebase') !== -1 ||
         hostname.indexOf('gstatic') !== -1 ||
         hostname.indexOf('googleapis') !== -1;
}

function isFirestoreRequest(hostname) {
  return hostname.indexOf('firestore') !== -1 ||
         hostname.indexOf('firebaseio') !== -1;
}

function isFunctionRequest(hostname) {
  return hostname.indexOf('cloudfunctions') !== -1;
}

var HTML_EXTENSIONS = ['.html'];
var HTML_PAGE_NAMES = [
  'index.html', 'login.html', 'verify.html', 'reset.html', 'turn.html',
  'album.html', 'calendar.html', 'expenses.html', 'insights.html', 'offline.html'
];

function isHtmlPage(pathname) {
  if (pathname === '/' || pathname === '') return true;
  if (HTML_EXTENSIONS.some(function(ext) { return pathname.endsWith(ext); })) return true;
  // Match bare names that would serve HTML (no extension)
  var basename = pathname.split('/').pop();
  if (basename && !basename.includes('.') && HTML_PAGE_NAMES.some(function(p) { return p.startsWith(basename); })) return true;
  return false;
}

function isVersionJson(pathname) {
  return pathname.endsWith('version.json');
}

function isApk(pathname) {
  return pathname.toLowerCase().endsWith('.apk');
}

/* ── Install: Pre-cache shell assets ─────────────────── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        SHELL_ASSETS.map(function(url) {
          return cache.add(url).catch(function() { /* non-fatal */ });
        })
      );
    }).then(function() { return self.skipWaiting(); })
  );
});

/* ── Activate: Clean old caches + claim clients ──────── */
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
        return caches.open(CACHE_NAME).then(function(cache) {
          return cache.keys().then(function(keys) {
            if (keys.length <= CACHE_MAX_ENTRIES) return;
            // Delete oldest entries
            return Promise.all(
              keys.slice(0, keys.length - CACHE_MAX_ENTRIES).map(function(req) {
                return cache.delete(req);
              })
            );
          });
        });
      })
      .then(function() {
        return self.clients.matchAll({ type: 'window' }).then(function(clients) {
          clients.forEach(function(client) {
            try { client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME }); } catch (_) {}
          });
        });
      })
  );
});

/* ══════════════════════════════════════════════════════════════
   OFFLINE OPERATION QUEUE — IndexedDB fallback for Firestore/CF
   ══════════════════════════════════════════════════════════════ */

function openOperationQueue() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('tcOperationQueue', 1);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('pendingOps')) {
        db.createObjectStore('pendingOps', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function(e) { reject(e.target.error); };
  });
}

function storeFailedOperation(request, error) {
  return openOperationQueue().then(function(db) {
    var tx = db.transaction('pendingOps', 'readwrite');
    var store = tx.objectStore('pendingOps');
    var entry = {
      url: request.url,
      method: request.method,
      headers: {},
      body: null,
      timestamp: Date.now(),
      error: error ? error.message || String(error) : 'unknown'
    };
    // Capture request headers
    try {
      request.headers.forEach(function(value, key) {
        entry.headers[key] = value;
      });
    } catch (_) {}
    // Capture request body for replay (clone first since body can only be read once)
    var bodyReady = Promise.resolve(null);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      bodyReady = request.clone().text().then(function(body) {
        return body || null;
      }).catch(function() { return null; });
    }
    return bodyReady.then(function(body) {
      entry.body = body;
      store.add(entry);
      return new Promise(function(resolve, reject) {
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function(e) { reject(e.target.error); };
      });
    });
  }).catch(function() { /* non-fatal */ });
}

function processOperationQueue() {
  return openOperationQueue().then(function(db) {
    var tx = db.transaction('pendingOps', 'readwrite');
    var store = tx.objectStore('pendingOps');
    var getAll = store.getAll();
    return new Promise(function(resolve) {
      getAll.onsuccess = function() {
        var ops = getAll.result || [];
        var clears = ops.map(function(op) {
          var headers = {};
          try { headers = JSON.parse(op.headers || '{}'); } catch (_) {}
          return fetch(new Request(op.url, { method: op.method, headers: headers, body: op.body }))
            .then(function() { return store.delete(op.id); })
            .catch(function() { /* keep in queue for next retry */ });
        });
        Promise.all(clears).then(resolve);
      };
      getAll.onerror = function() { resolve(); };
    });
  }).catch(function() { /* non-fatal */ });
}

/* ── Fetch: Vite-aware tiered caching ────────────────── */
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var requestUrl = new URL(event.request.url);
  var hostname = requestUrl.hostname;
  var pathname = requestUrl.pathname;

  // ── Tier A: Skip cross-origin (except Firebase/fonts) ──
  var isFirebase = isFirebaseHost(hostname);
  var isApkReq = isApk(pathname);
  var isFirestore = isFirestoreRequest(hostname);
  var isFunction = isFunctionRequest(hostname);

  if (isApkReq || isFirestore || isFunction) {
    event.respondWith(
      fetch(event.request).catch(function(err) {
        if (isFirestore || isFunction) {
          return storeFailedOperation(event.request, err).then(function() {
            return new Response(JSON.stringify({ error: 'offline', queued: true }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        }
        throw err;
      })
    );
    return;
  }

  var isViteAsset = isViteHashedAsset(pathname);
  var isHtml = isHtmlPage(pathname);
  var isVersion = isVersionJson(pathname);

  // ── Tier 1: Vite hashed assets → CACHE FOREVER ──────
  // These files have content hashes (main-BGMyYqdm.js).
  // When content changes, the hash changes → new URL.
  // Old cached versions are harmless (will be evicted by max entries).
  if (isViteAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          if (cached) return cached;
          return fetch(event.request).then(function(response) {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(function() {
            return new Response('', { status: 504, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // ── Tier 2: Firebase CDN → stale-while-revalidate ───
  // Firebase SDK versions change infrequently; safe to serve stale.
  if (isFirebase) {
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

  // ── Tier 3: version.json → always network-first ─────
  if (isVersion) {
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

  // ── Tier 4: HTML pages → network-first + offline shell ──
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
              return off || new Response(
                '<!DOCTYPE html><html><body style="background:#0d0d0f;color:#e2e4e9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h1 style="font-size:20px;margin-bottom:8px">You\'re offline</h1><p style="color:#8d92a0">Check your connection and try again.</p></div></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
          });
        })
    );
    return;
  }

  // ── Tier 4.5: Media (images, video, audio) → cache-first with network fallback ──
  var isMedia = /\.(png|jpe?g|gif|webp|svg|ico|mp4|webm|mp3|ogg|wav|opus|m4a|aac)(\?|$)/i.test(pathname) ||
    /firebasestorage\.googleapis\.com|res\.cloudinary\.com/.test(hostname);
  if (isMedia) {
    var MEDIA_CACHE = 'nsl-chat-media-v1';
    event.respondWith(
      caches.open(MEDIA_CACHE).then(function(cache) {
        return cache.match(event.request).then(function(cached) {
          if (cached) return cached;
          return fetch(event.request).then(function(response) {
            if (response.ok && response.type === 'basic') {
              var copy = response.clone();
              cache.put(event.request, copy);
            }
            return response;
          }).catch(function() {
            return new Response('', { status: 504, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // ── Tier 5: Everything else (static assets, non-hashed) ──
  // network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        if (response.ok && requestUrl.origin === self.location.origin) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
        }
        return response;
      })
      .catch(function() { 
        return caches.match(event.request).then(function(cached) {
          return cached || new Response('', { status: 504, statusText: 'Offline' });
        });
      })
  );
});

/* ══════════════════════════════════════════════════════════════
   ONLINE EVENT — Process queued failed operations
   ══════════════════════════════════════════════════════════════ */

self.addEventListener('online', function(event) {
  event.waitUntil(processOperationQueue());
});

/* ══════════════════════════════════════════════════════════════
   BACKGROUND SYNC — Queue failed messages for retry
   ══════════════════════════════════════════════════════════════ */

self.addEventListener('sync', function(event) {
  if (event.tag === 'tc-message-retry') {
    event.waitUntil(
      processOperationQueue().then(function() {
        return notifyWindowClients({ type: 'TC_SYNC_RETRY' });
      })
    );
  }
});
