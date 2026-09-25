// Vérifie que le calcul (calcul.js + config du script) redonne exactement les
// prix de l'ancienne version.
//
// La config n'est pas dans le dépôt. Pour lancer les cas de référence :
//   - copier la valeur de la propriété CONFIG dans tests/config.local.json
//     (fichier ignoré par git), ou
//   - PV_CONFIG=/chemin/vers/config.json node --test
// Sans config, ces cas sont signalés « skipped ».
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Calcul = require('../app/src/core/calcul.js');

function chargerConfig() {
  const fichier = process.env.PV_CONFIG || path.join(__dirname, 'config.local.json');
  if (!fs.existsSync(fichier)) return null;
  const json = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  return json.config || json;   // accepte aussi une réponse { ok, config }
}

const config = chargerConfig();
const sansConfig = config ? false : 'config absente : créer tests/config.local.json (voir en-tête)';

// Catégorie, prix d'achat HT → prix TTC attendu (ancienne version).
const CAS = [
  ['tranquille', 3.00, 6.90],
  ['tranquille', 12.00, 21.60],
  ['mousseux', 20.00, 35.10],
  ['tranquille', 30.00, 47.70],
];

test('la config chargée est valide', { skip: sansConfig }, () => {
  assert.ok(Calcul.configValide(config));
  for (const cle of ['tranquille', 'mousseux', 'demie', 'intermediaire']) {
    assert.ok(config.categories[cle], 'catégorie manquante : ' + cle);
  }
  // Magnums : facultatifs tant que leurs frais ne sont pas ajoutés.
  for (const cle of Object.keys(config.categories)) {
    assert.ok(['tranquille', 'mousseux', 'demie', 'intermediaire', 'magnum_tranquille', 'magnum_mousseux',
      '3l_tranquille', '3l_mousseux', '4_5l_tranquille', '5l_tranquille'].includes(cle),
      'catégorie inconnue de l\'app : ' + cle);
  }
});

for (const [categorie, achat, attendu] of CAS) {
  test(`${categorie} ${achat.toFixed(2)} → ${attendu.toFixed(2)} €`, { skip: sansConfig }, () => {
    assert.equal(Calcul.prixTTC(achat, categorie, config), attendu);
  });
}

// Grands formats (ticket T0.4), attendus calculés avec les frais proposés : à
// recalculer si d'autres frais sont retenus. Ignorés tant que la config
// locale ne contient pas la catégorie.
const CAS_MAGNUM = [
  ['magnum_tranquille', 8.00, 17.10],
  ['magnum_tranquille', 20.00, 35.10],
  ['magnum_mousseux', 30.00, 51.80],
  ['3l_tranquille', 20.00, 38.10],
  ['3l_mousseux', 50.00, 84.20],
  ['4_5l_tranquille', 40.00, 68.00],
  ['5l_tranquille', 40.00, 68.90],
];

for (const [categorie, achat, attendu] of CAS_MAGNUM) {
  const skip = sansConfig || (config.categories[categorie] ? false : `catégorie ${categorie} absente de la config`);
  test(`${categorie} ${achat.toFixed(2)} → ${attendu.toFixed(2)} €`, { skip }, () => {
    assert.equal(Calcul.prixTTC(achat, categorie, config), attendu);
  });
}

// Moteur de calcul, avec une config fictive (aucune valeur réelle).
const FICTIVE = {
  categories: { a: { frais: 2 }, b: { frais: 0 } },
  tranches: [{ jusqua: 5, coef: 2 }, { jusqua: 20, coef: 1.25 }, { jusqua: null, coef: 1.1 }],
  arrondi: 0.1,
};

test('tranches cumulées', () => {
  assert.equal(Calcul.calculerPrixTTC(4, FICTIVE), 8);            // 4×2
  assert.equal(Calcul.calculerPrixTTC(5, FICTIVE), 10);           // borne incluse dans la 1re tranche
  assert.equal(Calcul.calculerPrixTTC(10, FICTIVE), 16.3);        // 10 + 5×1,25 = 16,25 → 16,3
  assert.equal(Calcul.calculerPrixTTC(30, FICTIVE), 39.8);        // 10 + 18,75 + 11
  assert.equal(Calcul.prixTTC(3, 'a', FICTIVE), 10);              // frais ajoutés avant les tranches
});

test('détail des tranches', () => {
  const rows = Calcul.detailTranches(30, FICTIVE);
  assert.deepEqual(rows.map(r => [r.debut, r.fin, r.coef]), [[0, 5, 2], [5, 20, 1.25], [20, 30, 1.1]]);
  assert.equal(Calcul.detailTranches(5, FICTIVE).length, 1);
});

test('config invalide refusée', () => {
  assert.equal(Calcul.configValide(null), false);
  assert.equal(Calcul.configValide({}), false);
  assert.equal(Calcul.configValide(Object.assign({}, FICTIVE, { arrondi: 0 })), false);
  assert.equal(Calcul.configValide(Object.assign({}, FICTIVE, { tranches: [{ jusqua: 5, coef: 2 }] })), false);
  assert.equal(Calcul.configValide(Object.assign({}, FICTIVE, { tranches: [{ jusqua: 5, coef: 2 }, { jusqua: 4, coef: 1 }, { jusqua: null, coef: 1 }] })), false);
  assert.throws(() => Calcul.prixTTC(1, 'inconnue', FICTIVE));
});
