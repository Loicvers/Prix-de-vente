// État de référence : PWA (service worker, cache, hors ligne, manifeste,
// installation, mise à jour).
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CIBLE, DOSSIERS, lancer, ouvrir, fauxScript, connecte, enregistrer, attendreEtat, lireJSON, texte, prixAffiche, CONFIG_E2E } = require('./outils');
const Calcul = require('../../app/src/core/calcul.js');

// Dossier publié : dist/ (compilé) ou racine du dépôt (ancienne app).
const PUBLIE = DOSSIERS[CIBLE];
const SOURCES_PUBLIQUES = CIBLE === 'dist' ? path.join(__dirname, '..', '..', 'app', 'public') : PUBLIE;
const NOM_CACHE = /const CACHE = '([^']+)'/.exec(fs.readFileSync(path.join(PUBLIE, 'sw.js'), 'utf8'))[1];

// Fichiers que le service worker doit garder hors ligne.
function fichiersAttendus() {
  if (CIBLE === 'ancienne') return ['/', '/index.html', '/calcul.js', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
  const liste = [];
  (function parcourir(dossier, prefixe) {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      if (e.isDirectory()) parcourir(path.join(dossier, e.name), prefixe + e.name + '/');
      else if (e.name !== 'sw.js' && !e.name.endsWith('.woff') && !e.name.endsWith('.map')) liste.push('/' + prefixe + e.name);
    }
  })(PUBLIE, '');
  return ['/', ...liste];
}
let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

async function appareilPwa(script) {
  const { page, context } = await app.appareil(script, { serviceWorkers: 'allow', stockage: connecte() });
  await ouvrir(app, page, { connecter: false });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  return { page, context };
}

function taillePng(fichier) {
  const b = fs.readFileSync(path.join(PUBLIE, fichier));
  assert.equal(b.toString('ascii', 1, 4), 'PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('PWA', () => {
  it('service worker actif, un seul cache, contenant tous les fichiers de l\'app', async () => {
    const { page, context } = await appareilPwa(fauxScript());
    const cache = await page.evaluate(async () => {
      const cles = await caches.keys();
      const c = await caches.open(cles[0]);
      return { cles, urls: (await c.keys()).map(r => new URL(r.url).pathname) };
    });
    assert.deepEqual(cache.cles, [NOM_CACHE]);
    if (CIBLE === 'dist') assert.match(NOM_CACHE, /^pv-[0-9a-f]{12}$/);   // version calculée à la compilation
    const attendus = fichiersAttendus();
    assert.ok(attendus.includes('/index.html') && attendus.includes('/manifest.json'));
    for (const f of attendus) {
      assert.ok(cache.urls.includes(f), 'absent du cache : ' + f);
    }
    await context.close();
  });

  it('hors ligne : l\'app s\'ouvre, calcule, enregistre en attente, puis envoie au retour du réseau', async () => {
    const script = fauxScript();
    const { page, context } = await appareilPwa(script);
    await attendreEtat(page, 'ok');
    await context.setOffline(true);
    await page.reload();
    assert.equal(await texte(page, 'h1'), 'Prix de vente');
    assert.equal(await texte(page, '#pastille-texte'), 'Hors ligne');
    await enregistrer(page, 'magnum_mousseux', '15', 'Hors réseau');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(15, 'magnum_mousseux', CONFIG_E2E)));
    assert.equal(await texte(page, '#badge-attente'), '1');
    assert.equal(await texte(page, '#pastille-texte'), 'Hors ligne');
    assert.equal(await texte(page, '#sync-status'), 'Non synchronisé – hors ligne (1 en attente)');
    const avant = script.requetes.length;
    await context.setOffline(false);
    await attendreEtat(page, 'ok');
    assert.deepEqual(script.requetes.slice(avant).map(r => r.action), ['lot']);
    assert.equal(script.prive()[0][1], 'Hors réseau');
    // Les appels au script ne sont jamais mis en cache.
    const urls = await page.evaluate(async nom => (await (await caches.open(nom)).keys()).map(r => r.url), NOM_CACHE);
    assert.ok(urls.every(u => !u.includes('script.test')));
    await context.close();
  });

  it('nouvelle version du service worker : message « Nouvelle version disponible » avec « Recharger »', async () => {
    const { page, context } = await appareilPwa(fauxScript());
    // Deuxième ouverture : la page démarre déjà contrôlée par le service worker
    // (à la toute première visite, aucun message n'est affiché).
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const code = fs.readFileSync(path.join(PUBLIE, 'sw.js'), 'utf8').replace(`'${NOM_CACHE}'`, "'pv-v8-test'");
    assert.ok(code.includes("'pv-v8-test'"));
    app.remplacements['/sw.js'] = code;             // « nouvelle version publiée »
    try {
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await page.waitForFunction(() => document.getElementById('toast-texte').textContent === 'Nouvelle version disponible');
      assert.equal(await texte(page, '#toast-action'), 'Recharger');
      await page.waitForFunction(async () => (await caches.keys()).join() === 'pv-v8-test');   // ancien cache supprimé
    } finally {
      delete app.remplacements['/sw.js'];
    }
    await context.close();
  });

  it('mise à jour depuis l\'app en ligne (cache pv-v7) : produit en attente conservé et envoyé, ancien cache supprimé', { skip: CIBLE !== 'dist' && 'concerne la version compilée' }, async () => {
    const script = fauxScript();
    app.servir('ancienne');
    try {
      const { page, context } = await app.appareil(script, { serviceWorkers: 'allow', stockage: connecte() });
      await ouvrir(app, page, { connecter: false });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await page.reload();                         // app déjà installée : ouverture suivante
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await attendreEtat(page, 'ok');
      assert.deepEqual(await page.evaluate(() => caches.keys()), ['pv-v7']);
      // Un produit enregistré hors ligne attend d'être envoyé.
      await context.setOffline(true);
      await enregistrer(page, 'magnum_tranquille', '12', 'En attente');
      assert.equal(await texte(page, '#badge-attente'), '1');

      // La nouvelle version est publiée ; le réseau revient, mais le script
      // ne répond pas encore : le produit reste en attente sur l'appareil.
      app.servir('dist');
      script.mode = 'coupure';
      await context.setOffline(false);
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      // Ce que voit l'utilisateur : l'ancienne app annonce la nouvelle version.
      await page.waitForFunction(() => document.getElementById('toast-texte').textContent === 'Nouvelle version disponible');
      assert.equal(await page.evaluate(async nom => (await caches.keys()).includes(nom), NOM_CACHE), true);

      // Ouverture suivante : nouvelle app, servie par le nouveau service worker.
      script.mode = 'normal';
      await page.reload();
      assert.equal(await page.evaluate(() => !!document.querySelector('script[type="module"][src*="assets/"]')), true);
      // Ancien cache supprimé (au plus tard à cette ouverture).
      await page.waitForFunction(async nom => (await caches.keys()).join() === nom, NOM_CACHE);
      await attendreEtat(page, 'ok');
      assert.equal(script.prive().length, 1);
      assert.equal(script.prive()[0][1], 'En attente');
      const [p] = await lireJSON(page, 'pv_produits_v2');
      assert.deepEqual([p.nom, p.sku, p.synced], ['En attente', 'UCP-0001', true]);
      assert.equal(await page.evaluate(() => localStorage.getItem('pv_pin')), connecte().pv_pin);
      assert.deepEqual(page.erreurs, []);
      await context.close();
    } finally {
      app.servir(CIBLE);
    }
  });

  it('manifeste : nom, affichage autonome, portrait, couleurs, icônes présentes aux bonnes tailles', async () => {
    const m = JSON.parse(fs.readFileSync(path.join(PUBLIE, 'manifest.json'), 'utf8'));
    assert.deepEqual(m, JSON.parse(fs.readFileSync(path.join(SOURCES_PUBLIQUES, 'manifest.json'), 'utf8')));
    assert.deepEqual({ name: m.name, short_name: m.short_name, start_url: m.start_url, scope: m.scope, display: m.display, orientation: m.orientation, lang: m.lang },
      { name: 'Prix de vente – Une Autre Clé du Paradis', short_name: 'Prix de vente', start_url: './', scope: './', display: 'standalone', orientation: 'portrait', lang: 'fr' });
    assert.equal(m.theme_color, '#16100f');
    assert.equal(m.background_color, '#16100f');
    assert.deepEqual(taillePng('icon-192.png'), [192, 192]);
    assert.deepEqual(taillePng('icon-512.png'), [512, 512]);
    assert.deepEqual(taillePng('apple-touch-icon.png'), [180, 180]);
    assert.equal(m.icons.find(i => i.src === 'icon-512.png').purpose, 'any maskable');
    assert.ok(fs.existsSync(path.join(PUBLIE, 'icon.svg')));
  });

  it('en-tête HTML : manifeste, icônes, couleur de thème, plein écran iPhone', async () => {
    const { page, context } = await app.appareil(null);
    await ouvrir(app, page, { connecter: false });
    const tete = await page.evaluate(() => ({
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
      apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
      icone: document.querySelector('link[rel="icon"]')?.getAttribute('href'),
      theme: document.querySelector('meta[name="theme-color"]')?.content,
      capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
      viewport: document.querySelector('meta[name="viewport"]')?.content,
      lang: document.documentElement.lang,
    }));
    assert.deepEqual(tete, {
      manifest: 'manifest.json', apple: 'apple-touch-icon.png', icone: 'icon.svg', theme: '#16100f', capable: 'yes',
      viewport: 'width=device-width, initial-scale=1.0, viewport-fit=cover', lang: 'fr',
    });
    await context.close();
  });
});
