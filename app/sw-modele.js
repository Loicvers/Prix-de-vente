// Service worker : l'app s'ouvre instantanément, même hors ligne.
// Fichiers de l'app servis depuis le cache, puis mis à jour en arrière-plan
// (la nouvelle version s'affiche à l'ouverture suivante). Les appels au
// script Google (POST) ne passent jamais par le cache.
//
// Modèle : la liste des fichiers et la version du cache sont insérées à la
// compilation (vite.config.mjs) ; la version change dès qu'un fichier change.
'use strict';
const CACHE = 'pv-__VERSION__';
const COQUILLE = __FICHIERS__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(COQUILLE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// Supprime tous les autres caches, y compris ceux de l'ancienne version
// (« pv-v7 » et précédents).
function nettoyer() {
  return caches.keys().then(cles => Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k))));
}

self.addEventListener('activate', e => {
  e.waitUntil(nettoyer().then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(caches.open(CACHE).then(async cache => {
    // Une requête de l'ancien service worker encore en cours peut recréer
    // son cache juste après l'activation : on refait le ménage à chaque
    // ouverture de l'app.
    if (req.mode === 'navigate') e.waitUntil(nettoyer());
    const cle = req.mode === 'navigate' ? './' : req;
    const enCache = await cache.match(cle, { ignoreSearch: true });
    const reseau = fetch(req).then(rep => {
      if (rep.ok) cache.put(cle, rep.clone());
      return rep;
    });
    if (enCache) {
      e.waitUntil(reseau.catch(() => {}));
      return enCache;
    }
    return reseau;
  }));
});
