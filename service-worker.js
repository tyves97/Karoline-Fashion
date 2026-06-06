const CACHE_NAME = 'caroline-couture-v2';

// Fichiers essentiels seulement — évite l'échec si une ressource manque
const urlsToCache = [
  '/index.html',
  '/manifest.json',
  '/Image/logoSarra.png'
];

// Fichiers optionnels (chargés séparément pour ne pas bloquer l'install)
const optionalUrls = [
  '/Adminpage/Index.html',
  '/Image/MOOV.png',
  '/Image/MTN.jpg',
  '/Image/OM.png',
  '/Image/WAVE.jpg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache obligatoire — si ça échoue, l'install échoue proprement
      return cache.addAll(urlsToCache)
        .then(() => {
          // Cache optionnel — les erreurs sont ignorées silencieusement
          return Promise.allSettled(
            optionalUrls.map(url =>
              cache.add(url).catch(() => {
                console.warn('[SW] Ressource optionnelle non mise en cache :', url);
              })
            )
          );
        });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => {
              console.log('[SW] Suppression ancien cache :', k);
              return caches.delete(k);
            })
        )
      )
    ])
  );
});

self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET et les extensions Chrome
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Retourner le cache ET mettre à jour en arrière-plan (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse;
      }

      // Pas dans le cache : réseau avec fallback
      return fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback page hors ligne si HTML demandé
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        });
    })
  );
});