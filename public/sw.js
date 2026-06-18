// Minimal runtime-caching service worker so the app works offline / installs as a PWA.
// Strategy: network-first, fall back to cache. New successful responses are cached as
// they're fetched, so we never need to know Vite's hashed asset names ahead of time.
const CACHE = 'reality-planner-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && new URL(req.url).origin === self.location.origin) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;
        // For navigations while offline, fall back to the cached app shell.
        if (req.mode === 'navigate') {
          const shell = await cache.match('/');
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});
