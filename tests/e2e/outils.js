// Outils des tests de l'app (état de référence, étape 0).
//
// L'app est servie telle quelle par un petit serveur local et ouverte dans
// Chromium (Playwright). Les appels au script Google sont interceptés et
// exécutés par le VRAI apps-script/Code.gs, dans une fausse feuille en
// mémoire (tests/helpers/fausse-feuille.js). Config fictive uniquement.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { PIN, environnement } = require('../helpers/fausse-feuille');

const RACINE = path.join(__dirname, '..', '..');
// Version testée : l'app compilée (dist/, par défaut) ou l'ancienne app à la
// racine du dépôt (CIBLE=ancienne), pour comparer les deux.
const CIBLE = process.env.CIBLE === 'ancienne' ? 'ancienne' : 'dist';
const DOSSIERS = { ancienne: RACINE, dist: path.join(RACINE, 'dist') };
if (CIBLE === 'dist' && !fs.existsSync(path.join(DOSSIERS.dist, 'index.html'))) {
  throw new Error('dist/ absent : lance « npx vite build » (ou npm run test:e2e)');
}
const URL_SCRIPT = 'https://script.test/macros/s/faux/exec';

// Config fictive couvrant les 10 catégories (aucune valeur réelle).
const CONFIG_E2E = {
  categories: {
    tranquille: { frais: 3, detail: 'bouchon et étiquette' },
    mousseux: { frais: 4 },
    demie: { frais: 2 },
    intermediaire: { frais: 5 },
    magnum_tranquille: { frais: 6 },
    magnum_mousseux: { frais: 8 },
    '3l_tranquille': { frais: 12 },
    '3l_mousseux': { frais: 16 },
    '4_5l_tranquille': { frais: 18 },
    '5l_tranquille': { frais: 20 },
  },
  tranches: [{ jusqua: 10, coef: 2 }, { jusqua: 30, coef: 1.5 }, { jusqua: null, coef: 1.25 }],
  arrondi: 0.1,
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css',
};

// remplacements : { '/chemin': 'contenu' } servi à la place du fichier (pour
// simuler une nouvelle version publiée).
// srv.dossier : version servie, modifiable en cours de test (mise à jour
// de l'ancienne app vers la nouvelle).
function serveur() {
  const remplacements = {};
  const etat = { dossier: DOSSIERS[CIBLE] };
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (chemin in remplacements) {
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(chemin)] || 'text/plain', 'Cache-Control': 'no-cache' });
        res.end(remplacements[chemin]); return;
      }
      const racine = etat.dossier;
      const fichier = path.join(racine, chemin === '/' ? 'index.html' : chemin);
      if (!fichier.startsWith(racine) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(fichier).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ url: `http://localhost:${srv.address().port}/`, remplacements, etat, fermer: () => srv.close() }));
  });
}

// Faux script Google partagé par tous les appareils d'un test.
//   mode : 'normal' | 'ancien' (script sans action « lot ») | 'html' (page
//   d'erreur Google) | 'http500' | 'coupure' (aucune réponse) | 'perdue'
//   (le script écrit, mais la réponse n'arrive jamais).
// suspendre() : les requêtes suivantes attendent reprendre().
function fauxScript(options = {}) {
  const env = environnement({ props: { CONFIG: JSON.stringify(options.config || CONFIG_E2E) } });
  const s = {
    env, mode: 'normal', requetes: [],
    suspendu: null,
    suspendre() { let lib; const p = new Promise(r => { lib = r; }); s.suspendu = p; s.reprendre = () => { s.suspendu = null; lib(); }; },
    reprendre() {},
    actions() { return s.requetes.map(r => r.action); },
    prive() { const o = env.onglet('Privé'); return o ? o.data.slice(1) : []; },
    public() { const o = env.onglet('Public'); return o ? o.data.slice(1) : []; },
    async brancher(context) {
      await context.route('https://script.test/**', async route => {
        const corps = route.request().postData() || '';
        let req = {};
        try { req = JSON.parse(corps); } catch { /* corps illisible : le script répondra « format » */ }
        s.requetes.push(req);
        if (s.suspendu) await s.suspendu;
        const mode = s.mode;
        if (mode === 'coupure') return route.abort('failed');
        if (mode === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Erreur Google</body></html>' });
        if (mode === 'http500') return route.fulfill({ status: 500, body: 'Erreur' });
        let texte;
        if (mode === 'ancien' && req.action === 'lot') texte = JSON.stringify({ ok: false, error: 'action' });
        else texte = env.postTexte(corps);
        if (mode === 'perdue') return route.abort('failed');
        return route.fulfill({ status: 200, contentType: 'application/json', body: texte });
      });
    },
  };
  return s;
}

async function lancer() {
  const srv = await serveur();
  const navigateur = await chromium.launch();
  return {
    url: srv.url,
    remplacements: srv.remplacements,
    servir(version) { srv.etat.dossier = DOSSIERS[version]; },
    // serviceWorkers : 'block' par défaut pour des tests déterministes ;
    // 'allow' pour les tests hors ligne / PWA.
    async appareil(script, options = {}) {
      const context = await navigateur.newContext({
        viewport: options.viewport || { width: 390, height: 844 },
        serviceWorkers: options.serviceWorkers || 'block',
      });
      // Pas de Google Fonts pendant les tests (réseau externe).
      await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      if (script) await script.brancher(context);
      else await context.route('https://script.test/**', r => r.abort('failed'));
      const page = await context.newPage();
      page.erreurs = [];
      page.on('pageerror', e => page.erreurs.push(e.message));
      if (options.stockage) {
        await page.addInitScript(donnees => {
          if (sessionStorage.getItem('__init')) return;
          sessionStorage.setItem('__init', '1');
          for (const [k, v] of Object.entries(donnees)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }, options.stockage);
      }
      return { context, page };
    },
    async fermer() { await navigateur.close(); srv.fermer(); },
  };
}

// Ouvre l'app et se connecte avec le PIN (sauf connecter:false).
async function ouvrir(app, page, { connecter = true, pin = PIN } = {}) {
  await page.goto(app.url);
  if (!connecter) return;
  await page.fill('#pin-url', URL_SCRIPT);
  await page.fill('#pin-input', pin);
  await page.click('#pin-ok');
}

async function attendreEtat(page, etat, delai = 5000) {
  await page.waitForSelector(`#pastille[data-etat="${etat}"]`, { timeout: delai });
}

async function calculer(page, cat, prix) {
  await page.click(`.cat[data-cat="${cat}"]`);
  await page.fill('#input-prix', prix);
  await page.waitForTimeout(50);   // calcul au prochain rafraîchissement d'écran
}

async function enregistrer(page, cat, prix, nom) {
  await calculer(page, cat, prix);
  await page.fill('#input-nom', nom);
  await page.click('#form-enregistrer button[type="submit"]');
}

// Stockage d'un appareil déjà connecté (PIN, adresse et config en cache).
function connecte(extra = {}) {
  return Object.assign({ pv_pin: PIN, pv_url: URL_SCRIPT, pv_config: CONFIG_E2E }, extra);
}

// Prix affiché par l'app pour un montant (même format que fmt()).
const fmtNombre = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prixAffiche = n => (fmtNombre.format(n) + ' €').replace(/\s+/g, ' ');

const lireJSON = (page, cle) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), cle);
const texte = (page, sel) => page.textContent(sel).then(t => (t || '').replace(/\s+/g, ' ').trim());

module.exports = { CIBLE, DOSSIERS, connecte, prixAffiche, PIN, URL_SCRIPT, CONFIG_E2E, fauxScript, lancer, ouvrir, attendreEtat, calculer, enregistrer, lireJSON, texte };
