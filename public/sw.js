// App shell + album art + song info cache. Music streams are never cached (YouTube/Spotify terms).
const CACHE = 'dhun-shell-v2';
const ART = 'dhun-art-v1';
const META = 'dhun-meta-v1';
const ART_HOSTS = /(^|\.)(mzstatic\.com|scdn\.co|spotifycdn\.com|ytimg\.com|audius\.co)$/;
const META_HOSTS = /(^|\.)itunes\.apple\.com$/;
const MAX_ART = 600, MAX_META = 300;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './icon.svg', './manifest.webmanifest'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  const keep = [CACHE, ART, META];
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))));
  self.clients.claim();
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

// Album art: cache first (art never changes), so scrolling and reopening is instant.
async function art(req) {
  const c = await caches.open(ART);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(ART, MAX_ART); }
  return res;
}
// Song info (search results): answer from cache at once, refresh in the background.
async function meta(req) {
  const c = await caches.open(META);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok) { c.put(req, res.clone()); trim(META, MAX_META); } return res; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (ART_HOSTS.test(url.hostname) && e.request.destination === 'image') return e.respondWith(art(e.request).catch(() => fetch(e.request)));
  if (META_HOSTS.test(url.hostname)) return e.respondWith(meta(e.request).catch(() => fetch(e.request)));
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./')))
  );
});
