// Import d'un catalogue CSV : colonnes utiles seulement, format déduit du nom.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { lireCsv, deviner, lignesCatalogue, importerDans } = require('../app/src/data/import-catalogue.js');

const CONFIG = { categories: { tranquille: { frais: 1 }, mousseux: { frais: 1 }, magnum_tranquille: { frais: 1 }, demie: { frais: 1 }, '5l_tranquille': { frais: 1 }, intermediaire: { frais: 1 } }, tranches: [{ jusqua: null, coef: 2 }], arrondi: 0.1 };
const CSV = 'ID;Groupe de produits;Nom;Prix d\'achat;Stock actuel\n' +
  '1;"Dom A";"AOC Test ""Cuvée"" rouge";4,5;12\n' +
  '2;"Dom A";"AOC Test Magnum";9;3\n' +
  '3;"Dom A";"Crémant Test";5;0\n' +
  '4;"Dom A";"AOC Test 10 L";16;1\n' +
  '5;"Dom A";"Sans prix";;1\n';
const persistance = { produits: () => true, historique: () => true, retraits: () => true };

test('lireCsv : point-virgule, guillemets doublés, BOM', () => {
  assert.deepEqual(lireCsv('﻿a;"b ""c""";d\r\n1;2;3'), [['a', 'b "c"', 'd'], ['1', '2', '3']]);
});

test('deviner : format et type depuis le nom', () => {
  assert.equal(deviner('AOC Test').cle, 'tranquille');
  assert.equal(deviner('Crémant de Loire').cle, 'mousseux');
  assert.equal(deviner('AOC Test Magnum').cle, 'magnum_tranquille');
  assert.equal(deviner('AOC Test 1/2 bouteille(s)').cle, 'demie');
  assert.equal(deviner('IGP Blanc 5L').cle, '5l_tranquille');
  assert.equal(deviner('AOC Maury sec').cle, 'intermediaire');
  assert.equal(deviner('IGP Blanc 10 L').erreur, 'taille');
});

test('import : seules les colonnes utiles, prix calculé, anomalies signalées', () => {
  const lu = lignesCatalogue(CSV);
  assert.equal(lu.lignes.length, 5);
  const store = { produits: [], historique: [], retraits: [] };
  const b = importerDans(store, lu.lignes, CONFIG, persistance, new Date('2026-10-03T10:00:00Z'));
  assert.equal(b.crees, 3);
  assert.deepEqual(b.ignores.map(i => i.raison), ['taille', 'prix']);
  const p = store.produits.find(x => x.nom === 'AOC Test "Cuvée" rouge');
  assert.deepEqual([p.prixAchat, p.prixTTC, p.categorie, p.synced], [4.5, 11, 'tranquille', false]);
  assert.deepEqual(Object.keys(p).filter(k => /stock|groupe/i.test(k)), []);
  assert.deepEqual(store.historique, []);
  // Ré-importer ne crée pas de doublons.
  const b2 = importerDans(store, lu.lignes, CONFIG, persistance);
  assert.deepEqual([b2.crees, b2.misAJour, store.produits.length], [0, 3, 3]);
});

test('colonnes manquantes', () => {
  assert.equal(lignesCatalogue('a;b\n1;2').erreur, 'colonnes');
});
