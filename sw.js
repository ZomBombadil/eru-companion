/* Eru Companion — service worker: cache the app shell, serve cache-first.
   The pet + arena work fully offline; radio streams still need connectivity. */
const CACHE = 'eru-companion-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-icons/icon-192.png',
  './pwa-icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* offline on first install: page still works from network */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? Promise.resolve() : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // Never intercept radio API calls or audio streams — those are live network.
  if (url.hostname.indexOf('radio-browser.info') !== -1) return;
  if (url.hostname.indexOf('somafm.com') !== -1) return;
  var dest = e.request.destination;
  if (dest === 'audio' || dest === 'video') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        // cache same-origin app shell files for next time
        if (res && res.ok && url.origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); }).catch(function(){});
        }
        return res;
      }).catch(function () {
        // offline + not cached: serve the app shell for navigations
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline');
      });
    })
  );
});
