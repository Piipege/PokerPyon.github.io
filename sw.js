// Pion service worker: the installed app opens and plays offline (bots, course, coach).
// The page: network first (fresh version when online, 4 s timeout), cache when offline.
// assets/*: file names contain a content hash, so they never change — cache first.
const CACHE = 'pion-e297b4a286';
const PRECACHE = ["./pion-online.html","./assets/app.782e199713.js","./assets/peerjs.f69f573cb6.js"].concat(['./manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']);
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // keep the hashed assets of older versions only in the new cache if they are still referenced (they are re-fetched on use)
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pion-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return; // PeerJS signalling and the rest go to the network
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/pion-online.html');
  const isAsset = url.pathname.includes('/assets/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if(isAsset){
      const hit = await cache.match(req);
      if(hit) return hit;
      const res = await fetch(req);
      if(res.ok) cache.put(req, res.clone());
      return res;
    }
    const key = isPage ? './pion-online.html' : req;
    try{
      const net = fetch(req);
      const res = await (isPage ? Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]) : net);
      if(res && res.ok) cache.put(key, res.clone());
      return res;
    }catch(err){
      const hit = await cache.match(key, { ignoreSearch: true });
      if(hit) return hit;
      throw err;
    }
  })());
});
