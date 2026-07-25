// ════════════════════════════════════════════════════════
// AE-ON service worker — installable Android app + offline use.
//
// Strategy (v3):
//   CODE (index.html + *.js) → NETWORK-FIRST with a short timeout.
//       New deployments are picked up on the FIRST open, every time.
//       If the network is slow or down, we fall back to cache after
//       NET_TIMEOUT ms so the app still opens fast (and offline).
//   ASSETS (icons, manifest) → cache-first, refreshed in background.
//       These rarely change and are the bulk of the bytes.
//
// History: v1 was network-first with no timeout (slow launches on
// mobile data). v2 was cache-first for everything — fast, but new
// code only appeared on the SECOND open, which made deploys
// unreliable. v3 keeps the speed floor while guaranteeing freshness.
// ════════════════════════════════════════════════════════
const CACHE       = 'aeon-v3';   // bumping this purges every older cache
const NET_TIMEOUT = 2500;        // ms to wait for fresh code before using cache

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

// Code = the app itself. Must be fresh so a deploy actually lands.
function isCode(req, url) {
  return req.mode === 'navigate' || /\.(?:html|js)$/i.test(url.pathname);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                   // POSTs (API calls) pass through
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;    // never touch Apps Script / external

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // Kick off the network request once; both paths below reuse it.
    const fromNetwork = fetch(req)
      .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => null);

    if (isCode(req, url)) {
      // ── NETWORK-FIRST (bounded): fresh code wins, cache rescues a slow link
      const timeout = new Promise(resolve => setTimeout(() => resolve(null), NET_TIMEOUT));
      const winner  = await Promise.race([fromNetwork, timeout]);
      if (winner) return winner;

      const cached = await cache.match(req);
      if (cached) {
        e.waitUntil(fromNetwork);        // let the refresh finish in the background
        return cached;
      }
      const late = await fromNetwork;    // nothing cached — wait it out
      return late || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }

    // ── ASSETS: cache-first, refresh behind the scenes
    const hit = await cache.match(req);
    if (hit) { e.waitUntil(fromNetwork); return hit; }
    const res = await fromNetwork;
    return res || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  })());
});
