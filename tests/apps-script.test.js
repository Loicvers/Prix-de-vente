// Code.gs exécuté contre une fausse feuille Google (en mémoire) : PIN,
// upsert par SKU, onglet Public sans prix d'achat, retrait, migration.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
const PIN = '482915';
// Config fictive : seule sa forme compte ici.
const CONFIG = {
  categories: { tranquille: { frais: 3 }, mousseux: { frais: 4 }, demie: { frais: 2 }, intermediaire: { frais: 5 } },
  tranches: [{ jusqua: 10, coef: 2 }, { jusqua: null, coef: 1.5 }],
  arrondi: 0.1,
};

function fausseFeuille(nom, lignes) {
  const sh = {
    nom, data: (lignes || []).map(r => r.slice()),
    getName: () => sh.nom,
    setName: n => { sh.nom = n; return sh; },
    getLastRow: () => sh.data.length,
    setFrozenRows: () => sh,
    getDataRange: () => sh.getRange(1, 1, Math.max(sh.data.length, 1), Math.max(1, ...sh.data.map(r => r.length))),
    getRange(ligne, col, nl = 1, nc = 1) {
      const range = {
        getValues: () => Array.from({ length: nl }, (_, i) =>
          Array.from({ length: nc }, (_, j) => { const v = (sh.data[ligne - 1 + i] || [])[col - 1 + j]; return v === undefined ? '' : v; })),
        getValue: () => range.getValues()[0][0],
        setValues(v) {
          assert.equal(v.length, nl); v.forEach(r => assert.equal(r.length, nc));
          v.forEach((r, i) => {
            const idx = ligne - 1 + i;
            while (sh.data.length <= idx) sh.data.push([]);
            r.forEach((x, j) => { sh.data[idx][col - 1 + j] = x; });
          });
          return range;
        },
        setValue: x => range.setValues([[x]]),
        setFontWeight: () => range,
      };
      return range;
    },
  };
  return sh;
}

function environnement(options = {}) {
  const props = Object.assign({ PIN, CONFIG: JSON.stringify(CONFIG) }, options.props);
  const cache = new Map();
  const onglets = options.onglets || [];
  const ss = {
    getSheets: () => onglets.slice(),
    getSheetByName: n => onglets.find(s => s.nom === n) || null,
    insertSheet: n => { const s = fausseFeuille(n); onglets.push(s); return s; },
  };
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getActive: () => ss },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: t => ({ texte: t, setMimeType() { return this; } }),
    },
    Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const post = corps => JSON.parse(ctx.doPost({ postData: { contents: typeof corps === 'string' ? corps : JSON.stringify(corps) } }).texte);
  return { ctx, ss, onglets, post, onglet: n => ss.getSheetByName(n) };
}

const VIN = { nom: 'Maury Grenat 2022', categorie: 'intermediaire', prixAchat: 9.5, prixTTC: 24.3 };

test('sans PIN, PIN faux ou PIN non configuré : ok:false et rien n\'est écrit', () => {
  const env = environnement();
  for (const corps of [
    Object.assign({ action: 'enregistrer' }, VIN),
    Object.assign({ action: 'enregistrer', pin: '0000' }, VIN),
    { action: 'config', pin: '' },
    { action: 'config' },
    'pas du json',
  ]) {
    const r = env.post(corps);
    assert.equal(r.ok, false);
    assert.equal(r.config, undefined);
  }
  assert.equal(env.onglets.length, 0);
  assert.equal(JSON.parse(env.ctx.doGet().texte).ok, false);

  const sansPin = environnement({ props: { PIN: null } });
  assert.deepEqual(sansPin.post({ action: 'config', pin: 'null' }), { ok: false, error: 'auth' });
});

test('trop de PIN faux : blocage temporaire', () => {
  const env = environnement();
  for (let i = 0; i < 20; i++) assert.equal(env.post({ action: 'config', pin: 'x' + i }).error, 'auth');
  assert.equal(env.post({ action: 'config', pin: PIN }).error, 'bloque');
});

test('config renvoyée avec le bon PIN', () => {
  const env = environnement();
  assert.deepEqual(env.post({ action: 'config', pin: PIN }), { ok: true, config: CONFIG });
});

test('enregistrer deux fois le même vin : une seule ligne dans Privé et dans Public', () => {
  const env = environnement();
  const r1 = env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN));
  assert.deepEqual(r1, { ok: true, sku: 'UCP-0001' });
  const r2 = env.post(Object.assign({ action: 'enregistrer', pin: PIN, sku: r1.sku }, VIN, { prixAchat: 10, prixTTC: 25.5 }));
  assert.deepEqual(r2, { ok: true, sku: 'UCP-0001' });
  // Sans SKU mais même nom : même produit.
  assert.equal(env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN, { nom: '  maury grenat 2022 ' })).sku, 'UCP-0001');
  // Réponse perdue puis renvoi du même produit local (uid) : même SKU.
  const r3 = env.post({ action: 'enregistrer', pin: PIN, uid: '17', nom: 'Crémant', categorie: 'mousseux', prixAchat: 6, prixTTC: 17 });
  assert.equal(env.post({ action: 'enregistrer', pin: PIN, uid: '17', nom: 'Crémant brut', categorie: 'mousseux', prixAchat: 6, prixTTC: 17 }).sku, r3.sku);
  assert.equal(r3.sku, 'UCP-0002');

  const prive = env.onglet('Privé').data;
  const pub = env.onglet('Public').data;
  assert.deepEqual(prive[0], ['SKU', 'Nom', 'Catégorie', "Prix d'achat HT", 'Frais', 'Prix TTC', 'Date MAJ']);
  assert.deepEqual(pub[0], ['SKU', 'Nom', 'Catégorie', 'Prix TTC', 'Disponibilité']);
  assert.equal(prive.length, 3);
  assert.equal(pub.length, 3);
  assert.deepEqual(prive[1].slice(0, 6), ['UCP-0001', '  maury grenat 2022 '.trim(), 'Produit intermédiaire 75cl', 9.5, 5, 24.3]);
  assert.equal(Object.prototype.toString.call(prive[1][6]), '[object Date]');
  assert.deepEqual(pub[1], ['UCP-0001', 'maury grenat 2022', 'Produit intermédiaire 75cl', 24.3, 'disponible']);
});

test('l\'onglet Public ne contient ni prix d\'achat ni frais', () => {
  const env = environnement();
  env.post({ action: 'enregistrer', pin: PIN, nom: 'Test', categorie: 'tranquille', prixAchat: 7.77, prixTTC: 19.9 });
  const pub = env.onglet('Public').data;
  assert.ok(pub.every(r => r.length === 5));
  assert.ok(!pub.flat().includes(7.77));
  assert.ok(!pub.flat().includes(CONFIG.categories.tranquille.frais));
});

test('retirer : Disponibilité = retiré, aucune ligne supprimée, jamais réécrite ensuite', () => {
  const env = environnement();
  const { sku } = env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN));
  assert.deepEqual(env.post({ action: 'retirer', pin: PIN, sku }), { ok: true, sku });
  env.post(Object.assign({ action: 'enregistrer', pin: PIN, sku }, VIN, { prixTTC: 30 }));
  const pub = env.onglet('Public').data;
  assert.equal(pub.length, 2);
  assert.deepEqual(pub[1], [sku, VIN.nom, 'Produit intermédiaire 75cl', 30, 'retiré']);
  assert.equal(env.onglet('Privé').data.length, 2);
  assert.equal(env.post({ action: 'retirer', pin: PIN, sku: 'UCP-9999' }).error, 'introuvable');
  assert.equal(env.post({ action: 'retirer', sku }).ok, false);
});

test('entrées invalides refusées sans écriture', () => {
  const env = environnement();
  assert.equal(env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN, { nom: ' ' })).error, 'nom');
  assert.equal(env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN, { categorie: 'bière' })).error, 'categorie');
  assert.equal(env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN, { prixAchat: -1 })).error, 'prix');
  assert.equal(env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN, { sku: 'X' })).error, 'sku');
  assert.equal(env.post({ action: 'supprimer', pin: PIN }).error, 'action');
  assert.equal(env.onglets.length, 0);
});

test('migrer : Historique intact, Privé et Public dédoublonnés par nom', () => {
  const lignes = [
    ['Nom', 'Catégorie', "Prix d'achat", 'Frais', 'Prix TTC', 'Date'],
    ['Maury Grenat', 'Produit intermédiaire 75cl', 9, 5, 22, '02/03/2026'],
    ['Crémant', 'Vin mousseux / pétillant', 6, 4, 17, '05/03/2026'],
    ['maury grenat ', 'Produit intermédiaire 75cl', 10, 5, 23.5, '10/04/2026'],
    ['Crémant', 'Vin mousseux / pétillant', 5, 4, 15, '01/01/2026'],
    ['', '', '', '', '', ''],
  ];
  const ancien = fausseFeuille('Feuille 1', lignes);
  const env = environnement({ onglets: [ancien] });
  env.ctx.migrer();

  assert.equal(ancien.nom, 'Historique');
  assert.deepEqual(ancien.data, lignes);
  const prive = env.onglet('Privé').data;
  const pub = env.onglet('Public').data;
  assert.equal(prive.length, 3);
  assert.deepEqual(prive[1].slice(0, 6), ['UCP-0001', 'maury grenat', 'Produit intermédiaire 75cl', 10, 5, 23.5]);
  assert.deepEqual(prive[2].slice(0, 6), ['UCP-0002', 'Crémant', 'Vin mousseux / pétillant', 6, 4, 17]);
  assert.deepEqual(pub.slice(1), [
    ['UCP-0001', 'maury grenat', 'Produit intermédiaire 75cl', 23.5, 'disponible'],
    ['UCP-0002', 'Crémant', 'Vin mousseux / pétillant', 17, 'disponible'],
  ]);

  // Après migration, les SKU continuent et les noms connus gardent le leur.
  assert.equal(env.post({ action: 'enregistrer', pin: PIN, nom: 'Crémant', categorie: 'mousseux', prixAchat: 6.5, prixTTC: 18 }).sku, 'UCP-0002');
  assert.equal(env.post({ action: 'enregistrer', pin: PIN, nom: 'Nouveau', categorie: 'demie', prixAchat: 4, prixTTC: 12 }).sku, 'UCP-0003');

  // Une seconde exécution refuse sans rien toucher.
  assert.throws(() => env.ctx.migrer(), /déjà faite/);
  assert.deepEqual(ancien.data, lignes);
});

// Format réel de l'ancienne feuille : id, nom, pa, htva (prix de vente), pct,
// historique. Noms et montants fictifs.
const ANCIEN_FORMAT = [
  ['id', 'nom', 'pa', 'htva', 'pct', 'historique'],
  [1700000000300, 'Vin A', 4, 14, 250, '[{"ts":1700000000300,"pa":4,"htva":14}]'],
  [1700000000200, 'Vin B', 10, 24.5, 145, '[{"ts":1700000000200,"pa":10,"htva":24.5}]'],
  [1700000000100, 'Bulles C', 4, 16, 300, '[{"ts":1700000000100,"pa":4,"htva":16}]'],
  [1700000000050, 'Essai', 5, 99, 1880, '[{"ts":1700000000050,"pa":5,"htva":99}]'],
  [1700000000400, 'vin a', 5, 16, 220, '[{"ts":1700000000350,"pa":4,"htva":14},{"ts":1700000000400,"pa":5,"htva":16}]'],
];

test('migrer, ancien format : colonnes lues par en-tête, catégorie déduite du prix', () => {
  const ancien = fausseFeuille('Feuille 1', ANCIEN_FORMAT);
  const env = environnement({ onglets: [ancien] });
  env.ctx.migrer();

  assert.equal(ancien.nom, 'Historique');
  assert.deepEqual(ancien.data, ANCIEN_FORMAT);
  const prive = env.onglet('Privé').data;
  assert.deepEqual(prive.slice(1).map(r => r.slice(0, 6)), [
    ['UCP-0001', 'vin a', 'Vin tranquille', 5, 3, 16],          // doublon : ligne la plus récente
    ['UCP-0002', 'Vin B', 'Vin tranquille', 10, 3, 24.5],
    ['UCP-0003', 'Bulles C', 'Vin mousseux / pétillant', 4, 4, 16],
    ['UCP-0004', 'Essai', '', 5, '', 99],                       // aucune catégorie ne redonne ce prix
  ]);
  assert.equal(prive[1][6].getTime(), 1700000000400);
  assert.deepEqual(env.onglet('Public').data.slice(1), [
    ['UCP-0001', 'vin a', 'Vin tranquille', 16, 'disponible'],
    ['UCP-0002', 'Vin B', 'Vin tranquille', 24.5, 'disponible'],
    ['UCP-0003', 'Bulles C', 'Vin mousseux / pétillant', 16, 'disponible'],
    ['UCP-0004', 'Essai', '', 99, 'disponible'],
  ]);
});

test('migrer : en-têtes inconnus, rien n\'est modifié', () => {
  const lignes = [['a', 'b', 'c'], [1, 2, 3]];
  const ancien = fausseFeuille('Feuille 1', lignes);
  const env = environnement({ onglets: [ancien] });
  assert.throws(() => env.ctx.migrer(), /Colonne introuvable/);
  assert.equal(ancien.nom, 'Feuille 1');
  assert.deepEqual(ancien.data, lignes);
  assert.equal(env.onglets.length, 1);
});

test('refaireMigration : anciens Privé et Public renommés, recréés depuis Historique', () => {
  const historique = fausseFeuille('Historique', ANCIEN_FORMAT);
  const privéFaux = fausseFeuille('Privé', [['SKU'], ['UCP-0001', '1700000000300']]);
  const publicFaux = fausseFeuille('Public', [['SKU'], ['UCP-0001', '1700000000300']]);
  const env = environnement({ onglets: [historique, privéFaux, publicFaux] });
  env.ctx.refaireMigration();

  assert.deepEqual(env.onglets.map(o => o.nom), ['Historique', 'Privé (ancien essai)', 'Public (ancien essai)', 'Privé', 'Public']);
  assert.deepEqual(historique.data, ANCIEN_FORMAT);
  assert.deepEqual(privéFaux.data, [['SKU'], ['UCP-0001', '1700000000300']]);
  assert.equal(env.onglet('Privé').data.length, 5);
  assert.equal(env.onglet('Public').data[1][1], 'vin a');

  // Une seconde fois : nouveaux noms, toujours rien de supprimé.
  env.ctx.refaireMigration();
  assert.equal(env.onglets.length, 7);
  assert.ok(env.ss.getSheetByName('Privé (ancien essai) 2'));
});

test('le calcul du script est identique à celui de l\'app', () => {
  const Calcul = require('../calcul.js');
  const env = environnement();
  for (let c = 1; c <= 5000; c++) {
    assert.equal(env.ctx.prixConfig_(c / 100 + 3, CONFIG), Calcul.calculerPrixTTC(c / 100 + 3, CONFIG));
  }
});

