// Code.gs exécuté contre une fausse feuille Google (en mémoire) : PIN,
// upsert par SKU, onglet Public sans prix d'achat, retrait, migration.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { PIN, CONFIG, fausseFeuille, environnement } = require('./helpers/fausse-feuille');

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
  assert.deepEqual(r1, { ok: true, sku: 'UCP-0001', version: 1 });
  const r2 = env.post(Object.assign({ action: 'enregistrer', pin: PIN, sku: r1.sku }, VIN, { prixAchat: 10, prixTTC: 25.5 }));
  assert.deepEqual(r2, { ok: true, sku: 'UCP-0001', version: 2 });
  // Sans SKU mais même nom : même produit.
  assert.equal(env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN, { nom: '  maury grenat 2022 ' })).sku, 'UCP-0001');
  // Réponse perdue puis renvoi du même produit local (uid) : même SKU.
  const r3 = env.post({ action: 'enregistrer', pin: PIN, uid: '17', nom: 'Crémant', categorie: 'mousseux', prixAchat: 6, prixTTC: 17 });
  assert.equal(env.post({ action: 'enregistrer', pin: PIN, uid: '17', nom: 'Crémant brut', categorie: 'mousseux', prixAchat: 6, prixTTC: 17 }).sku, r3.sku);
  assert.equal(r3.sku, 'UCP-0002');

  const prive = env.onglet('Privé').data;
  const pub = env.onglet('Public').data;
  assert.deepEqual(prive[0], ['SKU', 'Nom', 'Catégorie', "Prix d'achat HT", 'Frais', 'Prix TTC', 'Date MAJ', 'Version', 'Appareil']);
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

test('retirer : Disponibilité = retiré, aucune ligne supprimée ; réenregistré, il redevient disponible (même SKU)', () => {
  const env = environnement();
  const { sku } = env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN));
  assert.deepEqual(env.post({ action: 'retirer', pin: PIN, sku }), { ok: true, sku, version: 2 });
  assert.equal(env.onglet('Public').data[1][4], 'retiré');
  // Déjà retiré : rien ne change.
  assert.deepEqual(env.post({ action: 'retirer', pin: PIN, sku }), { ok: true, sku, version: 2, inchange: true });
  assert.deepEqual(env.post(Object.assign({ action: 'enregistrer', pin: PIN, sku }, VIN, { prixTTC: 30 })),
    { ok: true, sku, version: 3, reactive: true });
  const pub = env.onglet('Public').data;
  assert.equal(pub.length, 2);
  assert.deepEqual(pub[1], [sku, VIN.nom, 'Produit intermédiaire 75cl', 30, 'disponible']);
  const journal = env.onglet('Journal').data;
  assert.deepEqual(journal.slice(1).map(r => [r[2], r[3], r[5]]), [['créer', sku, 'ok'], ['retirer', sku, 'ok'], ['réenregistrer', sku, 'ok']]);
  assert.match(journal[3][8], /ancien statut : retiré ; nouveau statut : disponible/);
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

test('lot : toute la file en une requête, config comprise, erreurs par opération', () => {
  const env = environnement({ props: { CONFIG: JSON.stringify(Object.assign({}, CONFIG, {
    categories: Object.assign({}, CONFIG.categories, { magnum_tranquille: { frais: 6 } }),
  })) } });
  const r = env.post({ action: 'lot', pin: PIN, operations: [
    Object.assign({ action: 'enregistrer', uid: '1' }, VIN),
    { action: 'enregistrer', uid: '2', nom: 'Magnum Rouge', categorie: 'magnum_tranquille', prixAchat: 12, prixTTC: 30 },
    { action: 'enregistrer', uid: '3', nom: 'Magnum Bulles', categorie: 'magnum_mousseux', prixAchat: 12, prixTTC: 30 },
    { action: 'retirer', sku: 'UCP-0001' },
    { action: 'retirer', sku: 'UCP-9999' },
    { action: 'supprimer' },
    null,
  ] });
  assert.equal(r.ok, true);
  assert.equal(r.config.categories.magnum_tranquille.frais, 6);
  assert.deepEqual(r.resultats, [
    { ok: true, sku: 'UCP-0001', version: 1 },
    { ok: true, sku: 'UCP-0002', version: 1 },
    { ok: false, error: 'categorie' },     // frais du magnum pétillant absents de CONFIG
    { ok: true, sku: 'UCP-0001', version: 2 },
    { ok: false, error: 'introuvable' },
    { ok: false, error: 'action' },
    { ok: false, error: 'format' },
  ]);
  const pub = env.onglet('Public').data;
  assert.deepEqual(pub.slice(1), [
    ['UCP-0001', VIN.nom, 'Produit intermédiaire 75cl', VIN.prixTTC, 'retiré'],
    ['UCP-0002', 'Magnum Rouge', 'Magnum tranquille (1,5 l)', 30, 'disponible'],
  ]);
  assert.equal(env.onglet('Privé').data[2][4], 6);

  assert.equal(env.post({ action: 'lot', pin: PIN, operations: 'x' }).error, 'lot');
  assert.equal(env.post({ action: 'lot', pin: PIN, operations: new Array(51).fill({ action: 'retirer', sku: 'UCP-0001' }) }).error, 'lot');
  assert.equal(env.post({ action: 'lot', pin: '0000', operations: [] }).error, 'auth');
  assert.deepEqual(env.post({ action: 'lot', pin: PIN, operations: [] }).resultats, []);
});

test('grands formats : enregistrés avec leur libellé dans Privé et Public', () => {
  const grands = {
    magnum_tranquille: 'Magnum tranquille (1,5 l)',
    magnum_mousseux: 'Magnum pétillant (1,5 l)',
    '3l_tranquille': 'Double magnum tranquille (3 l)',
    '3l_mousseux': 'Jéroboam pétillant (3 l)',
    '4_5l_tranquille': 'Tranquille 4,5 l',
    '5l_tranquille': 'Jéroboam tranquille (5 l)',
  };
  const categories = Object.assign({}, CONFIG.categories);
  Object.keys(grands).forEach((cle, i) => { categories[cle] = { frais: 10 + i }; });
  const env = environnement({ props: { CONFIG: JSON.stringify(Object.assign({}, CONFIG, { categories })) } });
  Object.keys(grands).forEach((cle, i) => {
    assert.equal(env.post({ action: 'enregistrer', pin: PIN, nom: 'Vin ' + i, categorie: cle, prixAchat: 20, prixTTC: 40 }).ok, true);
    // Le libellé est aussi accepté à la place de la clé.
    assert.equal(env.post({ action: 'enregistrer', pin: PIN, nom: 'Vin ' + i, categorie: grands[cle], prixAchat: 20, prixTTC: 40 }).ok, true);
  });
  const prive = env.onglet('Privé').data.slice(1);
  const pub = env.onglet('Public').data.slice(1);
  assert.deepEqual(prive.map(r => [r[2], r[4]]), Object.keys(grands).map((cle, i) => [grands[cle], 10 + i]));
  assert.deepEqual(pub.map(r => r[2]), Object.values(grands));
});

test('diagnostic : config correcte, puis erreurs typiques d\'une modification à la main', () => {
  const onglets = [fausseFeuille('Privé'), fausseFeuille('Public')];
  assert.equal(environnement({ onglets }).ctx.diagnostic().ok, true);

  // Virgule décimale collée dans CONFIG : JSON illisible, extrait montré.
  const casse = JSON.stringify(CONFIG).replace('"demie":{"frais":2}', '"demie":{"frais":2,5}');
  let d = environnement({ onglets, props: { CONFIG: casse } }).ctx.diagnostic();
  assert.equal(d.ok, false);
  assert.match(d.problemes[0], /CONFIG illisible/);
  assert.match(d.problemes[0], /⟶/);

  // Faute de frappe dans une clé, frais entre guillemets, PIN avec espace.
  const faute = Object.assign({}, CONFIG, { categories: Object.assign({}, CONFIG.categories, { magnum_tranquile: { frais: 2 }, '3l_mousseux': { frais: '8' } }) });
  d = environnement({ props: { CONFIG: JSON.stringify(faute), PIN: PIN + ' ' } }).ctx.diagnostic();
  const tout = d.problemes.join('\n');
  assert.match(tout, /PIN : espace/);
  assert.match(tout, /inconnue « magnum_tranquile »/);
  assert.match(tout, /frais de « 3l_mousseux »/);
  assert.match(tout, /Onglet « Privé » absent/);

  d = environnement({ props: { CONFIG: null, PIN: null } }).ctx.diagnostic();
  assert.deepEqual(Array.from(d.problemes.slice(0, 2)), ['Propriété PIN absente : ajoute-la (Paramètres du projet › Propriétés du script).', 'Propriété CONFIG absente.']);
});

test('le calcul du script est identique à celui de l\'app', () => {
  const Calcul = require('../calcul.js');
  const env = environnement();
  for (let c = 1; c <= 5000; c++) {
    assert.equal(env.ctx.prixConfig_(c / 100 + 3, CONFIG), Calcul.calculerPrixTTC(c / 100 + 3, CONFIG));
  }
});

