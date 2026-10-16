// Service worker Bulakbalik CYC: halaman network-first maks 3 dtk (biar update kepake, tapi sinyal jelek nggak nungguin), sisanya cache-first.
// VERSION diganti otomatis sama publish.js tiap push.
const VERSION = '202610161734';
const CACHE = 'cyc-' + VERSION;
const SHELL = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('cyc-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'unpkg.com' && /^\/leaflet(-rotate)?@/.test(url.pathname));
  if (url.hostname === 'tile.openstreetmap.org') return e.respondWith(tile(req));
  if (url.origin !== location.origin && !font) return;
  if (req.mode === 'navigate') {
    // sinyal jelek: tunggu jaringan maks 3 dtk, lewat itu pakai cache (yang baru tetep disimpen buat bukaan berikutnya)
    const net = fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); return r; });
    const slow = new Promise(res => setTimeout(res, 3000)).then(() => caches.match('./'));
    e.respondWith(Promise.race([net.catch(() => caches.match('./')), slow.then(hit => hit || net)]).then(r => r || net));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});

// tile peta: cache-first di cache terpisah (nggak kehapus tiap versi), maks ±1500 tile
const TILES = 'tiles-1';
let tileN = 0;
async function tile(req) {
  const c = await caches.open(TILES), hit = await c.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r.ok || r.type === 'opaque') {
      await c.put(req, r.clone());
      if (++tileN % 100 === 0) { const ks = await c.keys(); if (ks.length > 1500) await Promise.all(ks.slice(0, ks.length - 1200).map(k => c.delete(k))); }
    }
    return r;
  } catch (_) { return new Response('', { status: 504 }); }
}
