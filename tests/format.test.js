// Lecture des montants saisis (spec Calculer §7.2, décisions D5 et D11).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyserMontant, lireMontant, fmtPct } = require('../app/src/core/format.js');

test('saisies acceptées avant la V2 : même valeur', () => {
  const cas = {
    '12,5': 12.5, '12.5': 12.5, '12,50 €': 12.5, ' 12,50 ': 12.5, '12€': 12,
    '1 234,56': 1234.56, '10,805': 10.805, ',5': 0.5, '.5': 0.5, '12,': 12, '12.': 12,
    '1.234': 1.234,                     // un seul point, sans virgule : décimal (compatibilité)
    '1 234,56': 1234.56, '1 234,56': 1234.56,   // espaces insécables
  };
  for (const [saisie, attendu] of Object.entries(cas)) assert.equal(lireMontant(saisie), attendu, saisie);
});

test('B-01 corrigé : point de milliers avec une virgule décimale', () => {
  assert.equal(lireMontant('1.234,56'), 1234.56);
  assert.equal(lireMontant('12.345,6'), 12345.6);
  assert.equal(lireMontant('1.234.567,89'), 1234567.89);
  assert.equal(lireMontant('1.234,56 €'), 1234.56);
});

test('D11 et saisies ambiguës : illisible, jamais deviné', () => {
  for (const saisie of ['1.234.567', '1.23,50', '1234.5,6', '12,5.0', '1,2,3', '12,5abc', 'abc', ',', '.', '1e3', '0x10', '+5', '12-3']) {
    assert.deepEqual(analyserMontant(saisie), { erreur: 'illisible' }, saisie);
    assert.ok(Number.isNaN(lireMontant(saisie)), saisie);
  }
});

test('vide, zéro et négatif : erreurs distinctes (messages différents dans l\'écran)', () => {
  for (const saisie of ['', '   ', ' € ', null, undefined]) assert.deepEqual(analyserMontant(saisie), { erreur: 'vide' }, String(saisie));
  for (const saisie of ['0', '0,00', '-3', '-0,5', '- 2']) assert.deepEqual(analyserMontant(saisie), { erreur: 'negatif' }, saisie);
});

test('pourcentage de marge : une décimale, format belge', () => {
  assert.equal(fmtPct(34.567).replace(/\s/g, ' '), '34,6 %');
  assert.equal(fmtPct(-5).replace(/\s/g, ' '), '-5,0 %');
  assert.equal(fmtPct(null), '—');
});
