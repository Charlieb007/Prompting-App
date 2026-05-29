/* Prompt Refina — Service Worker
 * Strategy:
 *   - Navigation requests: network-first, fall back to cached index.html (offline shell)
 *   - Static assets (JS/CSS/fonts/images): cache-first, update in background
 *   - API calls (different origin): always network, never cache
 */

const CACHE = 'prompt-refina-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
];

// ── Install: precache the app shell ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache when possible ─────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (API calls go straight to network)
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // Navigation → network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets → cache-first, then network + update cache
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});
