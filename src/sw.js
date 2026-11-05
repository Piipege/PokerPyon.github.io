// Pion service worker: keeps the game working offline once it has been opened.
// The page is one self-contained file, so the cache is tiny. Strategy: network first
// (fresh version when online, 4 s timeout), cache when offline.
const CACHE = 'pion-__VERSION__';
const FILES = ['./pion-online.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pion-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return; // PeerJS and everything else go straight to the network
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/pion-online.html');
  const key = isPage ? './pion-online.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try{
      const net = fetch(req);
      const res = await (isPage ? Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]) : net);
      if(res && res.ok && (isPage || FILES.some(f => url.pathname.endsWith(f.slice(1))))) cache.put(key, res.clone());
      return res;
    }catch(err){
      const hit = await cache.match(key, { ignoreSearch: true });
      if(hit) return hit;
      throw err;
    }
  })());
});
