// ============================================================
// SERVICE WORKER - TEAM CHAT 2026
// Handles offline support, caching, background sync
// Enables app-like experience with offline functionality
// ============================================================

const CACHE_VERSION = 'v1';
const CACHE_NAME = `team-chat-${CACHE_VERSION}`;
const RUNTIME_CACHE = `team-chat-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE = `team-chat-images-${CACHE_VERSION}`;
const API_CACHE = `team-chat-api-${CACHE_VERSION}`;

// Files to cache on install
const STATIC_ASSETS = [
  '/My-Personal-Website/works/chat/',
  '/My-Personal-Website/works/chat/index.html',
  '/My-Personal-Website/works/chat/styles/design-system.css',
  '/My-Personal-Website/works/chat/services/firebase-config.js',
  '/My-Personal-Website/works/chat/pwa/manifest.json',
  '/My-Personal-Website/works/chat/offline.html'
];

// ============================================================
// INSTALL EVENT - Cache static assets
// ============================================================

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💾 Caching static assets...');
        return cache.addAll(STATIC_ASSETS)
          .catch((error) => {
            console.warn('⚠️ Some assets failed to cache:', error);
            // Continue even if some assets fail
          });
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// ============================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('team-chat-') && name !== CACHE_NAME;
            })
            .map((name) => {
              console.log('🗑️ Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker activated');
        return self.clients.claim();
      })
  );
});

// ============================================================
// FETCH EVENT - Network-first with fallback to cache
// ============================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle different request types
  if (request.method !== 'GET') {
    // For POST/PUT/DELETE, try network only
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return error response if offline
          return new Response(
            JSON.stringify({ error: 'Offline - request queued for later' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Determine cache strategy based on URL
  if (url.pathname.includes('/assets/') || url.pathname.includes('/images/')) {
    // Cache images and assets with longer TTL
    event.respondWith(cacheImages(request));
  } else if (url.pathname.includes('/api/') || url.pathname.includes('firebase')) {
    // Cache API responses with expiration
    event.respondWith(cacheApi(request));
  } else {
    // Cache static resources
    event.respondWith(cacheStatic(request));
  }
});

// ============================================================
// CACHE STRATEGIES
// ============================================================

/**
 * Cache static assets (network-first with fallback)
 */
async function cacheStatic(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      // Cache successful response
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('📡 Network failed, checking cache:', request.url);
    
    // Fall back to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page if available
    return caches.match('/My-Personal-Website/works/chat/offline.html')
      .then((response) => {
        return response || new Response('You are offline', { status: 503 });
      });
  }
}

/**
 * Cache images (cache-first with network fallback)
 */
async function cacheImages(request) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Try network
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('🖼️ Image failed to load:', request.url);
    
    // Return placeholder image or default
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#e0e0e0" width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-family="Arial">Image unavailable</text></svg>',
      {
        headers: { 'Content-Type': 'image/svg+xml' },
        status: 200
      }
    );
  }
}

/**
 * Cache API responses with TTL
 */
async function cacheApi(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response && response.status === 200) {
      // Cache successful response
      const cache = await caches.open(API_CACHE);
      
      // Add timestamp header for TTL
      const clonedResponse = response.clone();
      const headers = new Headers(clonedResponse.headers);
      headers.append('X-Cache-Time', new Date().toISOString());
      
      const responseToCache = new Response(clonedResponse.body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: headers
      });
      
      cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    console.log('🌐 API failed, checking cache:', request.url);
    
    // Fall back to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// ============================================================
// MESSAGE EVENT - Communication with clients
// ============================================================

self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'CLEAR_CACHE') {
    caches.keys()
      .then((names) => {
        return Promise.all(
          names.map((name) => caches.delete(name))
        );
      })
      .then(() => {
        event.ports[0].postMessage({ status: 'cache-cleared' });
      });
  }

  if (type === 'CACHE_URLS') {
    const { urls } = data;
    caches.open(RUNTIME_CACHE)
      .then((cache) => {
        return Promise.all(
          urls.map((url) => cache.add(url).catch(() => {}))
        );
      })
      .then(() => {
        event.ports[0].postMessage({ status: 'urls-cached' });
      });
  }
});

// ============================================================
// PUSH EVENT - Handle push notifications
// ============================================================

self.addEventListener('push', (event) => {
  console.log('📬 Push notification received');

  let notificationData = {
    title: 'Team Chat',
    body: 'New message',
    icon: '/My-Personal-Website/works/chat/assets/icons/app-icon-192.png',
    badge: '/My-Personal-Website/works/chat/assets/icons/app-icon-192.png',
    tag: 'team-chat-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/My-Personal-Website/works/chat/assets/icons/open.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/My-Personal-Website/works/chat/assets/icons/close.png'
      }
    ]
  };

  // Parse notification data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      data: notificationData
    })
  );
});

// ============================================================
// NOTIFICATION CLICK EVENT
// ============================================================

self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Look for existing window
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].url === '/My-Personal-Website/works/chat/' && 'focus' in clientList[i]) {
            return clientList[i].focus();
          }
        }
        // If not found, open new window
        if (clients.openWindow) {
          return clients.openWindow('/My-Personal-Website/works/chat/');
        }
      })
  );
});

// ============================================================
// SYNC EVENT - Background sync for offline messages
// ============================================================

self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

/**
 * Sync pending messages when back online
 */
async function syncMessages() {
  try {
    // Get pending messages from IndexedDB
    const db = await openDB();
    const pendingMessages = await getAllFromStore(db, 'pending-messages');

    console.log('📤 Syncing', pendingMessages.length, 'pending messages...');

    // Send each pending message
    for (const message of pendingMessages) {
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });

        // Remove from pending
        await deleteFromStore(db, 'pending-messages', message.id);
      } catch (error) {
        console.error('Failed to sync message:', error);
        throw error; // Retry later
      }
    }

    console.log('✅ Messages synced');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error; // Retry
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Open IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TeamChatDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Get all items from store
 */
function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Delete from store
 */
function deleteFromStore(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

console.log('✅ Service Worker loaded');
