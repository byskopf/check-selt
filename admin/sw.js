/* Service Worker da Central Administrativa CHECK */
importScripts('app-config.js?v=1.1.2');

var PWA_VERSION = self.CHECK_ADMIN_CONFIG && self.CHECK_ADMIN_CONFIG.version;
var ICON_VERSION = self.CHECK_ADMIN_CONFIG && self.CHECK_ADMIN_CONFIG.iconVersion || PWA_VERSION;
if (!PWA_VERSION) throw new Error('Versão da Central não configurada.');

var CACHE_PREFIX = 'check-admin-launcher-';
var CACHE_NAME = CACHE_PREFIX + 'pwa-' + PWA_VERSION;
var scopeBase;
try {
  scopeBase = new URL('.', self.registration.scope).href;
} catch (error) {
  scopeBase = self.location.origin + '/check-selt/admin/';
}

var APP_SHELL = [
  'index.html',
  'app-config.js',
  'app.js',
  'manifest.json',
  'offline.html',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
].map(function (name) {
  var assetUrl = new URL(name, scopeBase);
  if (/^(?:icon-|apple-touch-icon)/.test(name)) {
    assetUrl.searchParams.set('v', ICON_VERSION);
  }
  return assetUrl.href;
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return Promise.allSettled(APP_SHELL.map(function (url) {
          return fetch(url, { cache: 'no-cache' }).then(function (response) {
            if (!response || !response.ok) throw new Error('Falha ao baixar ' + url);
            return cache.put(url, response.clone());
          }).catch(function () {
            return Promise.resolve();
          });
        }));
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME
            ? caches.delete(key)
            : Promise.resolve(false);
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  var indexUrl = new URL('index.html', scopeBase).href;
  var offlineUrl = new URL('offline.html', scopeBase).href;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(request.url, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(request.url).then(function (cached) {
            return cached || caches.match(indexUrl).then(function (index) {
              return index || caches.match(offlineUrl);
            });
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request.url).then(function (cached) {
      return cached || fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            return cache.put(request.url, copy);
          });
        }
        return response;
      });
    })
  );
});
