// Évaluation d'un calcul pour l'écran Calculer (spec Calculer §8, §9, §12) :
// toujours le moteur réel (core/calcul.js), config fictive uniquement.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Calcul = require('../app/src/core/calcul.js');
const { evaluerCalcul, lignesDetail } = require('../app/src/core/evaluation.js');

// Valeurs fictives (aucun montant réel).
const CONFIG = {
  categories: { tranquille: { frais: 3, accises: 1, detail: 'bouchon' }, mousseux: { frais: 4 } },
  tva: 0.2,
  tranches: [{ jusqua: 10, coef: 2 }, { jusqua: 30, coef: 1.5 }, { jusqua: null, coef: 1.25 }],
  arrondi: 0.1,
};

test('contexte valide : prix = moteur, détail construit par le moteur (D4 révisée), total = prix', () => {
  const r = evaluerCalcul({ saisie: '40', categorie: 'tranquille', config: CONFIG });
  assert.equal(r.statut, 'valide');
  assert.equal(r.prixAchat, 40);
  assert.equal(r.prixTTC, Calcul.prixTTC(40, 'tranquille', CONFIG));
  const tranches = Calcul.detailTranches(43, CONFIG);
  const ht = r.prixTTC / 1.2;
  assert.deepEqual(r.lignes.slice(0, -3), [
    { type: 'achat', montant: 40 },
    { type: 'frais', montant: 3, texte: 'bouchon' },
    { type: 'accises', montant: 1 },
    { type: 'cout', montant: 43 },
    ...tranches.map(t => ({ type: 'tranche', debut: t.debut, fin: t.fin, coef: t.coef, montant: t.montant })),
    { type: 'total', montant: r.prixTTC },
  ]);
  const [prixHT, m, pct] = r.lignes.slice(-3);
  assert.equal(prixHT.type, 'prix-ht');
  assert.ok(Math.abs(prixHT.montant - ht) < 1e-9);
  assert.equal(m.type, 'marge');
  assert.ok(Math.abs(m.montant - (ht - 43)) < 1e-9);
  assert.equal(pct.type, 'marge-pct');
  assert.ok(Math.abs(pct.valeur - (ht - 43) / ht * 100) < 1e-9);
});

test('marge : accises comptées une seule fois (comprises dans les frais), prix de vente inchangé', () => {
  const sansAccises = JSON.parse(JSON.stringify(CONFIG));
  delete sansAccises.categories.tranquille.accises;
  // Même prix et même marge, que la config distingue les accises ou non.
  assert.equal(Calcul.prixTTC(12, 'tranquille', CONFIG), Calcul.prixTTC(12, 'tranquille', sansAccises));
  assert.deepEqual(Calcul.marge(12, 'tranquille', CONFIG), Calcul.marge(12, 'tranquille', sansAccises));
  assert.equal(Calcul.coutRevient(12, 'tranquille', CONFIG), 12 + 3);
  // Sans accises distinguées : pas de ligne « dont accises ».
  assert.equal(lignesDetail(12, 'tranquille', sansAccises).some(l => l.type === 'accises'), false);
});

test('marge indisponible si la TVA manque ou est invalide ; le prix reste calculé', () => {
  for (const [tva, raison] of [[undefined, 'tva-absente'], [null, 'tva-absente'], [21, 'tva-invalide'], [-0.1, 'tva-invalide'], ['0.21', 'tva-invalide']]) {
    const config = Object.assign({}, CONFIG, { tva });
    const r = evaluerCalcul({ saisie: '12', categorie: 'mousseux', config });
    assert.equal(r.statut, 'valide', String(tva));
    assert.equal(r.prixTTC, Calcul.prixTTC(12, 'mousseux', CONFIG));
    assert.deepEqual(r.lignes.at(-1), { type: 'marge-indisponible', raison }, String(tva));
    assert.equal(r.lignes.some(l => l.type === 'marge' || l.type === 'prix-ht'), false);
  }
});

test('accises invalides (non numériques, négatives, plus grandes que les frais) : signalées, jamais utilisées', () => {
  for (const accises of ['1', -1, 4]) {
    const config = JSON.parse(JSON.stringify(CONFIG));
    config.categories.tranquille.accises = accises;
    assert.deepEqual(Calcul.accises('tranquille', config), { erreur: 'invalide' });
    assert.deepEqual(lignesDetail(10, 'tranquille', config)[2], { type: 'accises', invalide: true });
    assert.equal(Calcul.coutRevient(10, 'tranquille', config), 13);
  }
});

test('contextes invalides : aucun prix, statut explicite', () => {
  const cas = [
    [{ saisie: '10', categorie: 'tranquille', config: null }, { statut: 'sans-config', categorie: 'tranquille' }],
    [{ saisie: '10', categorie: 'tranquille', config: { categories: {}, tranches: [], arrondi: 0 } }, { statut: 'sans-config', categorie: 'tranquille' }],
    [{ saisie: '10', categorie: null, config: CONFIG }, { statut: 'sans-format', categorie: null }],
    [{ saisie: '10', categorie: 'magnum_mousseux', config: CONFIG }, { statut: 'format-manquant', categorie: 'magnum_mousseux' }],
    [{ saisie: '', categorie: 'tranquille', config: CONFIG }, { statut: 'vide', categorie: 'tranquille' }],
    [{ saisie: 'abc', categorie: 'tranquille', config: CONFIG }, { statut: 'invalide', erreur: 'illisible', categorie: 'tranquille' }],
    [{ saisie: '0', categorie: 'tranquille', config: CONFIG }, { statut: 'invalide', erreur: 'negatif', categorie: 'tranquille' }],
  ];
  for (const [entree, attendu] of cas) assert.deepEqual(evaluerCalcul(entree), attendu, JSON.stringify(entree));
});

test('changement de format ou de prix : nouveau résultat, jamais l\'ancien', () => {
  const a = evaluerCalcul({ saisie: '8', categorie: 'tranquille', config: CONFIG });
  const b = evaluerCalcul({ saisie: '8', categorie: 'mousseux', config: CONFIG });
  const c = evaluerCalcul({ saisie: '9', categorie: 'mousseux', config: CONFIG });
  assert.equal(a.prixTTC, Calcul.prixTTC(8, 'tranquille', CONFIG));
  assert.equal(b.prixTTC, Calcul.prixTTC(8, 'mousseux', CONFIG));
  assert.equal(c.prixTTC, Calcul.prixTTC(9, 'mousseux', CONFIG));
  assert.notEqual(a.prixTTC, b.prixTTC);
  assert.notEqual(b.prixTTC, c.prixTTC);
});

test('échec du moteur : statut « erreur », saisie conservée, aucun prix', () => {
  // Config valide à la vérification, qui échoue ensuite pendant le calcul.
  let lectures = 0;
  const config = {
    categories: CONFIG.categories,
    get tranches() { lectures++; if (lectures > 1) throw new Error('config abîmée'); return CONFIG.tranches; },
    arrondi: 0.1,
  };
  const r = evaluerCalcul({ saisie: '10', categorie: 'tranquille', config });
  assert.deepEqual(r, { statut: 'erreur', categorie: 'tranquille', prixAchat: 10 });
});

test('lignesDetail : texte des frais vide s\'il n\'y en a pas', () => {
  assert.equal(lignesDetail(5, 'mousseux', CONFIG)[1].texte, '');
});
