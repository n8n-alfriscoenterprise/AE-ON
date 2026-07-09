// ════════════════════════════════════════════════════════
// AE-ON service worker — makes the app installable on Android
// (real app icon, standalone window) and keeps it usable offline.
//
// Strategy: STALE-WHILE-REVALIDATE. Serve every same-origin file
// from cache instantly (fast startup on any connection), then
// refresh the cached copy in the background. After a deploy, the
// new code applies on the NEXT app open — open the app twice.
// API calls to Apps Script are POSTs and are never touched.
//
// (v1 was network-first, which re-downloaded ~30 files from GitHub
// on every launch before painting anything — that's why startup
// felt slow. v2 paints from cache first.)
// ════════════════════════════════════════════════════════
const CACHE = 'aeon-v2';

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

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);

    // Always kick off a background refresh so the cache tracks deploys
    const refresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => undefined);

    if (hit) {
      e.waitUntil(refresh.then(() => {}));   // keep SW alive until refresh lands
      return hit;                            // instant paint from cache
    }
    // Nothing cached yet (first run / new file) — wait for the network
    const res = await refresh;
    return res || (req.mode === 'navigate' ? cache.match('./index.html') : undefined);
  })());
});
