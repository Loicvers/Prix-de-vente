// Grille de sélection de Calculer (type de vin × contenance).
'use strict';
const { it } = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORIES, TYPES, CONTENANCES, GRILLE, typeDe, contenanceDe } = require('../app/src/core/categories.js');

it('chaque catégorie est atteignable par une paire type × contenance, et une seule contenance', () => {
  const atteintes = new Set();
  for (const t of TYPES) {
    for (const [c, cle] of Object.entries(GRILLE[t.id])) {
      assert.ok(CATEGORIES[cle], `${t.id} ${c} → ${cle} inconnue`);
      assert.ok(CONTENANCES.some(x => x.id === c), `contenance ${c} inconnue`);
      atteintes.add(cle);
    }
  }
  assert.deepEqual([...atteintes].sort(), Object.keys(CATEGORIES).sort());
});

it('typeDe et contenanceDe retrouvent la paire ; la demi-bouteille n\'impose pas de type', () => {
  assert.deepEqual([typeDe('magnum_mousseux'), contenanceDe('magnum_mousseux')], ['petillant', '150']);
  assert.deepEqual([typeDe('intermediaire_50cl'), contenanceDe('intermediaire_50cl')], ['vdn', '50']);
  assert.deepEqual([typeDe('5l_tranquille'), contenanceDe('5l_tranquille')], ['tranquille', '500']);
  assert.deepEqual([typeDe('demie'), contenanceDe('demie')], [null, '37_5']);
  assert.equal(typeDe('inconnue'), null);
  for (const t of TYPES) assert.equal(GRILLE[t.id]['37_5'], 'demie');
  // Chaque type propose au moins le 75 cl (repli quand on change de type).
  for (const t of TYPES) assert.ok(GRILLE[t.id]['75']);
});
