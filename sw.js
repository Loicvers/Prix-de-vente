// Service worker : l'app s'ouvre instantanément, même hors ligne.
// Fichiers de l'app servis depuis le cache, puis mis à jour en arrière-plan
// (la nouvelle version s'affiche à l'ouverture suivante). Les appels au
// script Google (POST) ne passent jamais par le cache.
'use strict';
const CACHE = 'pv-v3';
const COQUILLE = [
  './', 'index.html', 'calcul.js', 'manifest.json',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
];
const POLICES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(COQUILLE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const local = url.origin === self.location.origin;
  if (!local && !POLICES.includes(url.origin)) return;

  e.respondWith(caches.open(CACHE).then(async cache => {
    const cle = req.mode === 'navigate' ? './' : req;
    const enCache = await cache.match(cle, { ignoreSearch: local });
    const reseau = fetch(req).then(rep => {
      if (rep.ok || rep.type === 'opaque') cache.put(cle, rep.clone());
      return rep;
    });
    if (enCache) {
      e.waitUntil(reseau.catch(() => {}));
      return enCache;
    }
    return reseau;
  }));
});
