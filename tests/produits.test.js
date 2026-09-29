// Enregistrement d'un produit depuis Calculer (couche données, sans écran) :
// même nom = même produit (D3), renommage en mode modification, collision
// bloquée (D8), aide D14, échec d'écriture sur l'appareil (spec §10.4).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyserNom, enregistrerDans, produitModifie } = require('../app/src/data/produits.js');

const MAINTENANT = new Date('2026-09-29T10:00:00Z');
const prod = (id, nom, extra) => Object.assign({ id, sku: 'UCP-000' + id, nom, categorie: 'tranquille', prixAchat: 8, prixTTC: 21.5, date: '01/01/2026', synced: true, rev: 1, version: 1 }, extra);
const demande = extra => Object.assign({ nom: 'Nouveau', categorie: 'mousseux', prixAchat: 9, prixTTC: 24.5, modification: null }, extra);
function persistance(resultats = {}) {
  const appels = [];
  const f = cle => () => { appels.push(cle); return resultats[cle] !== false; };
  return { appels, produits: f('produits'), historique: f('historique'), retraits: f('retraits') };
}
const copie = x => JSON.parse(JSON.stringify(x));

test('nouveau nom : création, historique, persistance dans l\'ordre produits → historique → retraits', () => {
  const store = { produits: [prod(1, 'A')], historique: [], retraits: [] };
  const p = persistance();
  const r = enregistrerDans(store, demande(), p, MAINTENANT);
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'nouveau');
  assert.deepEqual(store.produits.map(x => x.nom), ['Nouveau', 'A']);
  const n = store.produits[0];
  assert.deepEqual([n.id, n.sku, n.categorie, n.prixAchat, n.prixTTC, n.synced, n.rev], [MAINTENANT.getTime(), '', 'mousseux', 9, 24.5, false, 1]);
  assert.deepEqual(store.historique, [{ id: n.id, nom: 'Nouveau', categorie: 'mousseux', prixAchat: 9, prixTTC: 24.5, date: n.date }]);
  assert.deepEqual(p.appels, ['produits', 'historique', 'retraits']);
});

test('nouveau calcul, nom existant (casse et espaces ignorés) : même objet mis à jour, SKU gardé', () => {
  const a = prod(1, 'Côtes du Rhône', { erreur: 'prix' });
  const store = { produits: [prod(2, 'B'), a], historique: [], retraits: [] };
  const r = enregistrerDans(store, demande({ nom: '  côtes   du RHÔNE ' }), persistance(), MAINTENANT);
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'existant');
  assert.equal(store.produits[0], a);                 // même objet (synchronisation en cours)
  assert.deepEqual([a.nom, a.sku, a.categorie, a.rev, a.synced, a.erreur], ['côtes   du RHÔNE', 'UCP-0001', 'mousseux', 2, false, undefined]);
  assert.equal(store.produits.length, 2);
});

test('mode modification : renommage du même produit (même id, même SKU), sans second produit', () => {
  const a = prod(1, 'Vin A');
  const store = { produits: [a, prod(2, 'Vin B')], historique: [], retraits: [] };
  const r = enregistrerDans(store, demande({ nom: 'Vin A 2023', modification: { id: 1, sku: 'UCP-0001' } }), persistance(), MAINTENANT);
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'renommage');
  assert.deepEqual(store.produits.map(x => [x.id, x.sku, x.nom]), [[1, 'UCP-0001', 'Vin A 2023'], [2, 'UCP-0002', 'Vin B']]);
});

test('D8 : renommer vers le nom d\'un autre produit est refusé, rien n\'est modifié ni écrit', () => {
  const store = { produits: [prod(1, 'Vin A'), prod(2, 'Vin B')], historique: [{ id: 9 }], retraits: [{ sku: 'UCP-0009', nom: 'X' }] };
  const avant = copie(store);
  const p = persistance();
  const r = enregistrerDans(store, demande({ nom: ' vin  b', modification: { id: 1 } }), p, MAINTENANT);
  assert.equal(r.ok, false);
  assert.equal(r.erreur, 'collision');
  assert.equal(r.produit.nom, 'Vin B');
  assert.deepEqual(copie(store), avant);
  assert.deepEqual(p.appels, []);
});

test('mode modification, produit disparu de l\'appareil : refusé (« introuvable »), rien n\'est créé', () => {
  const store = { produits: [prod(2, 'Vin B')], historique: [], retraits: [] };
  const r = enregistrerDans(store, demande({ nom: 'Vin A', modification: { id: 1, sku: 'UCP-0001' } }), persistance(), MAINTENANT);
  assert.deepEqual(r, { ok: false, erreur: 'introuvable' });
  assert.equal(store.produits.length, 1);
});

test('mode modification : retrouvé par SKU si l\'identifiant local a changé', () => {
  const produits = [prod('sku:UCP-0001', 'Vin A', { sku: 'UCP-0001' })];
  assert.equal(produitModifie(produits, { id: 1, sku: 'UCP-0001' }), produits[0]);
  assert.equal(produitModifie(produits, null), null);
});

test('§10.4 : échec d\'écriture des produits → tout est remis comme avant, pas de succès', () => {
  const a = prod(1, 'Vin A', { erreur: 'prix' });
  const store = { produits: [a], historique: [], retraits: [{ sku: 'UCP-0001', nom: 'Vin A' }] };
  const avant = copie(store);
  const listeAvant = store.produits;
  const p = persistance({ produits: false });
  const r = enregistrerDans(store, demande({ nom: 'Vin A' }), p, MAINTENANT);
  assert.deepEqual(r, { ok: false, erreur: 'stockage' });
  assert.equal(store.produits, listeAvant);
  assert.deepEqual(copie(store), avant);                 // champs du produit restaurés (erreur comprise)
  assert.deepEqual(p.appels, ['produits']);
});

test('historique ou retraits non écrits : produit enregistré, signalé « incomplet »', () => {
  const store = { produits: [], historique: [], retraits: [] };
  const r = enregistrerDans(store, demande(), persistance({ historique: false }), MAINTENANT);
  assert.equal(r.ok, true);
  assert.equal(r.incomplet, true);
});

test('réenregistré avant l\'envoi de sa suppression : le retrait en attente est annulé', () => {
  const store = { produits: [], historique: [], retraits: [{ sku: 'UCP-0001', nom: 'Hésitant' }, { sku: 'UCP-0002', nom: 'Autre' }] };
  enregistrerDans(store, demande({ nom: 'hésitant' }), persistance(), MAINTENANT);
  assert.deepEqual(store.retraits.map(r => r.nom), ['Autre']);
});

test('entrées refusées par la couche données, même si l\'écran les laissait passer', () => {
  const store = { produits: [], historique: [], retraits: [] };
  assert.equal(enregistrerDans(store, demande({ nom: '   ' }), persistance()).erreur, 'nom');
  assert.equal(enregistrerDans(store, demande({ categorie: 'inconnue' }), persistance()).erreur, 'format');
  assert.equal(enregistrerDans(store, demande({ categorie: null }), persistance()).erreur, 'format');
  assert.equal(enregistrerDans(store, demande({ prixAchat: 0 }), persistance()).erreur, 'prix');
  assert.equal(enregistrerDans(store, demande({ prixTTC: NaN }), persistance()).erreur, 'prix');
  assert.equal(store.produits.length, 0);
});

test('analyserNom : statuts de l\'aide D14 et de la collision D8', () => {
  const produits = [prod(1, 'Vin A'), prod(2, 'Vin B', { disponibilite: 'retiré' })];
  assert.equal(analyserNom(produits, '  ', null).statut, 'vide');
  assert.equal(analyserNom(produits, 'Vin C', null).statut, 'nouveau');
  assert.deepEqual(analyserNom(produits, 'VIN A', null), { statut: 'existant', produit: produits[0], retire: false });
  assert.deepEqual(analyserNom(produits, 'vin b', null), { statut: 'existant', produit: produits[1], retire: true });
  assert.equal(analyserNom(produits, 'vin a', { id: 1 }).statut, 'existant');     // nom du produit modifié : autorisé
  assert.equal(analyserNom(produits, 'Vin C', { id: 1 }).statut, 'renommage');
  assert.equal(analyserNom(produits, 'Vin B', { id: 1 }).statut, 'collision');    // autre produit, même retiré
  assert.equal(analyserNom(produits, 'Vin A', { id: 3 }).statut, 'introuvable');
});
