// Script de la feuille, étape 1 : versions, conflits, journal, réactivation
// et lecture des produits (source commune pour tous les appareils).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PIN, fausseFeuille, environnement } = require('./helpers/fausse-feuille');

const VIN = { nom: 'Côtes du Rhône', categorie: 'tranquille', prixAchat: 8, prixTTC: 21.5 };
const enr = (env, extra) => env.post(Object.assign({ action: 'enregistrer', pin: PIN }, VIN, extra));
const journal = env => env.onglet('Journal').data.slice(1);

test('chaque écriture augmente la version ; la version et l\'appareil sont dans Privé', () => {
  const env = environnement();
  assert.deepEqual(enr(env, { version: 0, appareil: 'Comptoir' }), { ok: true, sku: 'UCP-0001', version: 1 });
  assert.deepEqual(enr(env, { sku: 'UCP-0001', version: 1, prixAchat: 9, appareil: 'Téléphone' }), { ok: true, sku: 'UCP-0001', version: 2 });
  const ligne = env.onglet('Privé').data[1];
  assert.deepEqual(ligne.slice(7), [2, 'Téléphone']);
  assert.deepEqual(journal(env).map(r => [r[1], r[2], r[5]]), [['Comptoir', 'créer', 'ok'], ['Téléphone', 'modifier', 'ok']]);
});

test('conflit : version dépassée → rien n\'est écrit, version de la feuille renvoyée, conflit journalisé', () => {
  const env = environnement();
  enr(env, { version: 0, appareil: 'A' });
  enr(env, { sku: 'UCP-0001', version: 1, prixAchat: 9, prixTTC: 23, appareil: 'B' });   // B modifie
  const avant = JSON.stringify(env.onglet('Privé').data) + JSON.stringify(env.onglet('Public').data);
  const r = enr(env, { sku: 'UCP-0001', version: 1, prixAchat: 10, prixTTC: 25, appareil: 'A' }); // A ne le sait pas
  assert.equal(r.ok, false);
  assert.equal(r.error, 'conflit');
  assert.equal(r.sku, 'UCP-0001');
  assert.deepEqual(Object.assign({}, r.actuel, { dateMaj: 'x' }), {
    sku: 'UCP-0001', nom: 'Côtes du Rhône', categorie: 'tranquille', libelle: 'Vin tranquille', prixAchat: 9, prixTTC: 23,
    dateMaj: 'x', version: 2, appareil: 'B', disponibilite: 'disponible',
  });
  assert.match(r.actuel.dateMaj, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(JSON.stringify(env.onglet('Privé').data) + JSON.stringify(env.onglet('Public').data), avant);
  const c = journal(env).at(-1);
  assert.deepEqual([c[1], c[2], c[3], c[5]], ['A', 'enregistrer', 'UCP-0001', 'conflit']);
  assert.equal(c[6], 'Vin tranquille · achat 9 · TTC 23 · disponible');
  assert.equal(c[7], 'Vin tranquille · achat 10 · TTC 25 · disponible');
  assert.match(c[8], /version connue 1, version de la feuille 2 ; rien n'a été écrit/);
  // Résolution « garder ma version » : l'app renvoie avec la version actuelle.
  assert.deepEqual(enr(env, { sku: 'UCP-0001', version: 2, prixAchat: 10, prixTTC: 25, appareil: 'A' }), { ok: true, sku: 'UCP-0001', version: 3 });
});

test('version dépassée mais valeurs identiques : pas de conflit, rien d\'écrit', () => {
  const env = environnement();
  enr(env, { version: 0 });
  enr(env, { sku: 'UCP-0001', version: 1, prixAchat: 9 });
  assert.deepEqual(enr(env, { sku: 'UCP-0001', version: 1, nom: ' côtes  du rhône', prixAchat: 9 }), { ok: true, sku: 'UCP-0001', version: 2, inchange: true });
  assert.equal(journal(env).length, 2);
});

test('nouvelle fiche (version 0) portant le nom d\'un produit existant : conflit si les valeurs diffèrent, sinon même produit', () => {
  const env = environnement();
  enr(env, { version: 0, appareil: 'A' });
  const r = enr(env, { version: 0, prixAchat: 11, appareil: 'B' });
  assert.equal(r.error, 'conflit');
  assert.match(journal(env).at(-1)[8], /même nom déjà enregistré ailleurs/);
  assert.deepEqual(enr(env, { version: 0, appareil: 'C' }), { ok: true, sku: 'UCP-0001', version: 1, inchange: true });
  assert.equal(env.onglet('Privé').data.length, 2);
});

test('réponse perdue puis renvoi (même uid, version 0) : pas de faux conflit, pas de doublon', () => {
  const env = environnement();
  const r1 = enr(env, { uid: '42', version: 0 });
  // L'app n'a pas reçu r1 ; elle renvoie la même fiche, modifiée entre-temps.
  const r2 = enr(env, { uid: '42', version: 0, prixAchat: 8.5 });
  assert.deepEqual(r2, { ok: true, sku: r1.sku, version: 2 });
  assert.equal(env.onglet('Privé').data.length, 2);
  // Un autre appareil modifie ensuite : le renvoi suivant de l'uid 42 est un vrai conflit.
  enr(env, { sku: r1.sku, version: 2, prixAchat: 12 });
  assert.equal(enr(env, { uid: '42', version: 0, prixAchat: 8.7 }).error, 'conflit');
});

test('ancienne app (sans version) : écrit comme avant, le Journal le signale', () => {
  const env = environnement();
  enr(env, { version: 0 });
  enr(env, { sku: 'UCP-0001', version: 1, prixAchat: 9 });
  assert.deepEqual(enr(env, { sku: 'UCP-0001', prixAchat: 10 }), { ok: true, sku: 'UCP-0001', version: 3 });
  assert.equal(journal(env).at(-1)[8], 'sans contrôle de version (ancienne app)');
  // Cache de réponse perdue au format de l'ancien script (SKU seul) : relu.
  env.ctx.CacheService.getScriptCache().put('uid_ancien', 'UCP-0001');
  assert.equal(enr(env, { uid: 'ancien', prixAchat: 11 }).sku, 'UCP-0001');
});

test('retrait : version contrôlée ; conflit si le produit a changé ; réactivation par réenregistrement', () => {
  const env = environnement();
  enr(env, { version: 0 });
  enr(env, { sku: 'UCP-0001', version: 1, prixAchat: 9 });
  const r = env.post({ action: 'retirer', pin: PIN, sku: 'UCP-0001', version: 1, appareil: 'A' });
  assert.equal(r.error, 'conflit');
  assert.equal(r.actuel.version, 2);
  assert.equal(env.onglet('Public').data[1][4], 'disponible');
  assert.deepEqual(env.post({ action: 'retirer', pin: PIN, sku: 'UCP-0001', version: 2, appareil: 'A' }), { ok: true, sku: 'UCP-0001', version: 3 });
  assert.equal(env.onglet('Public').data[1][4], 'retiré');
  assert.deepEqual(env.onglet('Privé').data[1].slice(7), [3, 'A']);
  // Réenregistré (version à jour) : redevient disponible, même SKU.
  assert.deepEqual(enr(env, { sku: 'UCP-0001', version: 3 }), { ok: true, sku: 'UCP-0001', version: 4, reactive: true });
  assert.equal(env.onglet('Public').data[1][4], 'disponible');
  // Réenregistré par nom depuis un appareil qui l'avait supprimé (nouvelle fiche, version 0) :
  env.post({ action: 'retirer', pin: PIN, sku: 'UCP-0001', version: 4 });
  const r2 = enr(env, { version: 0 });
  assert.equal(r2.error, 'conflit');                // retiré ailleurs : décision explicite demandée
  assert.equal(r2.actuel.disponibilite, 'retiré');
  assert.deepEqual(enr(env, { version: 5 }), { ok: true, sku: 'UCP-0001', version: 6, reactive: true });
  assert.equal(env.onglet('Privé').data.length, 2);
});

test('produits : liste complète depuis Privé et Public, catégorie à compléter signalée', () => {
  const prive = fausseFeuille('Privé', [
    ['SKU', 'Nom', 'Catégorie', "Prix d'achat HT", 'Frais', 'Prix TTC', 'Date MAJ'],       // ancien format : 7 colonnes
    ['UCP-0001', 'Maury', 'Produit intermédiaire 75cl', 9, 5, 26, new Date(Date.UTC(2026, 2, 5))],
    ['UCP-0002', 'Mystère', '', '5,5', '', 12, '01/02/2026'],
    ['', '', '', '', '', '', ''],
  ]);
  const pub = fausseFeuille('Public', [
    ['SKU', 'Nom', 'Catégorie', 'Prix TTC', 'Disponibilité'],
    ['UCP-0001', 'Maury', 'Produit intermédiaire 75cl', 26, 'disponible'],
    ['UCP-0002', 'Mystère', '', 12, 'retiré'],
  ]);
  const env = environnement({ onglets: [prive, pub] });
  const r = env.post({ action: 'produits', pin: PIN });
  assert.equal(r.ok, true);
  assert.deepEqual(r.produits, [
    { sku: 'UCP-0001', nom: 'Maury', categorie: 'intermediaire', libelle: 'Produit intermédiaire 75cl', prixAchat: 9, prixTTC: 26,
      dateMaj: '2026-03-05T00:00:00.000Z', version: 0, appareil: '', disponibilite: 'disponible' },
    { sku: 'UCP-0002', nom: 'Mystère', categorie: null, libelle: '', prixAchat: 5.5, prixTTC: 12,
      dateMaj: new Date(2026, 1, 1).toISOString(), version: 0, appareil: '', disponibilite: 'retiré' },
  ]);
  assert.ok(r.produits.every(p => !('frais' in p)));
  assert.equal(env.post({ action: 'produits', pin: 'faux' }).error, 'auth');
  assert.deepEqual(environnement().post({ action: 'produits', pin: PIN }).produits, []);
});

test('onglet Privé de l\'ancien format : en-têtes Version et Appareil ajoutés, lignes existantes intactes', () => {
  const lignes = [
    ['SKU', 'Nom', 'Catégorie', "Prix d'achat HT", 'Frais', 'Prix TTC', 'Date MAJ'],
    ['UCP-0001', 'Maury', 'Produit intermédiaire 75cl', 9, 5, 26, 'd'],
  ];
  const prive = fausseFeuille('Privé', lignes);
  const env = environnement({ onglets: [prive, fausseFeuille('Public', [['SKU', 'Nom', 'Catégorie', 'Prix TTC', 'Disponibilité']])] });
  // Ancienne app, produit existant sans version : écrit en version 1.
  assert.deepEqual(env.post({ action: 'enregistrer', pin: PIN, nom: 'Autre', categorie: 'mousseux', prixAchat: 6, prixTTC: 17 }),
    { ok: true, sku: 'UCP-0002', version: 1 });
  assert.deepEqual(prive.data[0], ['SKU', 'Nom', 'Catégorie', "Prix d'achat HT", 'Frais', 'Prix TTC', 'Date MAJ', 'Version', 'Appareil']);
  assert.deepEqual(prive.data[1], lignes[1]);
  // App à jour, produit sans version (0) : contrôle possible.
  assert.equal(env.post({ action: 'enregistrer', pin: PIN, sku: 'UCP-0001', version: 0, nom: 'Maury', categorie: 'intermediaire', prixAchat: 10, prixTTC: 28 }).version, 1);
});

test('lot : liste des produits dans la réponse, appareil transmis à chaque opération', () => {
  const env = environnement();
  const r = env.post({ action: 'lot', pin: PIN, appareil: 'Comptoir', operations: [
    Object.assign({ action: 'enregistrer', version: 0 }, VIN),
    { action: 'enregistrer', version: 0, appareil: 'Autre', nom: 'Crémant', categorie: 'mousseux', prixAchat: 6, prixTTC: 17 },
  ] });
  assert.deepEqual(r.resultats, [{ ok: true, sku: 'UCP-0001', version: 1 }, { ok: true, sku: 'UCP-0002', version: 1 }]);
  assert.deepEqual(r.produits.map(p => [p.sku, p.nom, p.appareil, p.version]), [['UCP-0001', 'Côtes du Rhône', 'Comptoir', 1], ['UCP-0002', 'Crémant', 'Autre', 1]]);
  assert.deepEqual(env.post({ action: 'lot', pin: PIN, operations: [] }).produits.length, 2);
});

test('entrées invalides : version et appareil', () => {
  const env = environnement();
  assert.equal(enr(env, { version: -1 }).error, 'version');
  assert.equal(enr(env, { version: 1.5 }).error, 'version');
  assert.equal(enr(env, { version: 'abc' }).error, 'version');
  assert.equal(env.onglets.length, 0);
  enr(env, { version: 0, appareil: '=HYPERLINK("x")   ' + 'z'.repeat(60) });
  const appareil = env.onglet('Privé').data[1][8];
  assert.ok(appareil.startsWith("'="));
  assert.equal(appareil.length, 41);
});

test('le Journal n\'apparaît jamais dans Public, qui garde 5 colonnes', () => {
  const env = environnement();
  enr(env, { version: 0 });
  env.post({ action: 'retirer', pin: PIN, sku: 'UCP-0001', version: 1 });
  enr(env, { version: 2, sku: 'UCP-0001' });
  assert.ok(env.onglet('Public').data.every(r => r.length === 5));
  assert.deepEqual(env.onglets.map(o => o.nom), ['Privé', 'Public', 'Journal']);
  assert.deepEqual(env.onglet('Journal').data[0], ['Date', 'Appareil', 'Action', 'SKU', 'Nom', 'Résultat', 'Avant', 'Après', 'Détail']);
});
