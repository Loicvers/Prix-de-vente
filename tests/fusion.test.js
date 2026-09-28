// Fusion de la liste de l'appareil avec celle de la feuille (étape 3).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fusionner, depuisServeur } = require('../app/src/data/fusion.js');

const ligne = (sku, nom, extra) => Object.assign({
  sku, nom, categorie: 'tranquille', libelle: 'Vin tranquille', prixAchat: 8, prixTTC: 21.5,
  dateMaj: '2026-09-20T10:00:00.000Z', version: 1, appareil: 'Comptoir', disponibilite: 'disponible',
}, extra);
const local = (id, sku, nom, extra) => Object.assign({ id, sku, nom, categorie: 'tranquille', prixAchat: 8, prixTTC: 21.5, date: '01/01/2026', synced: true }, extra);

test('la feuille remplace les produits confirmés, garde leur identifiant local', () => {
  const r = fusionner([local(7, 'UCP-0001', 'Ancien nom')], [ligne('UCP-0001', 'Nouveau nom', { prixAchat: 9, version: 3 })], []);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].id, r[0].nom, r[0].prixAchat, r[0].version, r[0].synced], [7, 'Nouveau nom', 9, 3, true]);
});

test('produits de la feuille inconnus de l\'appareil : ajoutés avec un identifiant « sku: »', () => {
  const r = fusionner([], [ligne('UCP-0002', 'Nouveau'), ligne('UCP-0003', 'Retiré', { disponibilite: 'retiré' })], []);
  assert.deepEqual(r.map(p => [p.id, p.disponibilite]), [['sku:UCP-0002', 'disponible'], ['sku:UCP-0003', 'retiré']]);
});

test('non envoyé ou en conflit : la version de l\'appareil est gardée, pas de doublon', () => {
  const enAttente = local(1, 'UCP-0001', 'A', { prixAchat: 15, synced: false, rev: 2 });
  const nouveau = local(2, '', 'b', { synced: false });            // pas encore de SKU, même nom que UCP-0002
  const conflit = local(3, 'UCP-0003', 'C', { conflit: { actuel: {} } });
  const r = fusionner([enAttente, nouveau, conflit], [ligne('UCP-0001', 'A'), ligne('UCP-0002', 'B'), ligne('UCP-0003', 'C', { prixAchat: 30 })], []);
  assert.equal(r.length, 3);
  assert.ok(r.includes(enAttente) && r.includes(nouveau) && r.includes(conflit));
});

test('suppression en attente d\'envoi : le produit ne réapparaît pas', () => {
  const r = fusionner([], [ligne('UCP-0001', 'A'), ligne('UCP-0002', 'B')], [{ sku: 'UCP-0001', nom: 'A' }]);
  assert.deepEqual(r.map(p => p.sku), ['UCP-0002']);
});

test('absent de la feuille : retiré de l\'appareil, sauf liste vide (prudence) ou produit jamais relié', () => {
  const produits = [local(1, 'UCP-0001', 'Effacé'), local(2, '', 'Ancien sans SKU')];
  assert.deepEqual(fusionner(produits, [ligne('UCP-0009', 'Autre')], []).map(p => p.nom), ['Autre', 'Ancien sans SKU']);
  assert.deepEqual(fusionner(produits, [], []).map(p => p.nom), ['Effacé', 'Ancien sans SKU']);
  assert.equal(fusionner(produits, undefined, []), produits);
});

test('ordre : en attente d\'abord, puis du plus récent au plus ancien', () => {
  const r = fusionner([local(9, '', 'Brouillon', { synced: false })], [
    ligne('UCP-0001', 'Vieux', { dateMaj: '2026-01-01T00:00:00.000Z' }),
    ligne('UCP-0002', 'Récent', { dateMaj: '2026-09-01T00:00:00.000Z' }),
  ], []);
  assert.deepEqual(r.map(p => p.nom), ['Brouillon', 'Récent', 'Vieux']);
});

test('catégorie à compléter et montants absents : conservés tels quels (pas devinés)', () => {
  const p = depuisServeur(ligne('UCP-0004', 'Mystère', { categorie: null, prixAchat: null }), null);
  assert.deepEqual([p.categorie, p.prixAchat, p.date], ['', null, new Date('2026-09-20T10:00:00.000Z').toLocaleDateString('fr-BE')]);
});
