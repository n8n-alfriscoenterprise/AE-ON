// ════════════════════════════════════════════════════════
// AE-ON service worker — makes the app installable on Android
// (real app icon, standalone window) and keeps it usable offline.
//
// Strategy: NETWORK-FIRST for everything. When online, employees
// always run the newest deployed code (no stale-cache pain); the
// cache is only a fallback when the connection drops. API calls to
// Apps Script are never cached.
// ════════════════════════════════════════════════════════
const CACHE = 'aeon-v1';

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                      // POSTs (all API calls) pass through
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // never touch Apps Script / external

  e.respondWith(
    fetch(req)
      .then(res => {
        // Fresh from network — update the cache copy for offline use
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
  );
});
