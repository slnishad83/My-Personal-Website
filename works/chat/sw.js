const CACHE_NAME = 'team-chat-v130-search-request';
const urlsToCache = [
  'index.html',
  'login.html',
  'verify.html',
  'turn.html',
  'style.css',
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
        if (requestUrl.origin === self.location.origin && response.ok) {
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
