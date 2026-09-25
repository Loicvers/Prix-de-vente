// État de référence : navigation, fenêtres, clavier, stockage local
// (compatibilité, données abîmées, mémoire pleine, limites).
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { lancer, ouvrir, fauxScript, connecte, enregistrer, attendreEtat, lireJSON, texte } = require('./outils');

let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

const PRODUIT = { id: 1, sku: 'UCP-0001', nom: 'Vin Test', categorie: 'tranquille', prixAchat: 8, prixTTC: 21.5, date: '01/01/2026', synced: true };

describe('navigation', () => {
  it('onglets : état sélectionné, page affichée ; la pastille mène à l\'onglet Historique', async () => {
    const { page, context } = await app.appareil(fauxScript(), { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    const etat = () => page.evaluate(() => ({
      onglets: [...document.querySelectorAll('.onglet')].map(o => o.getAttribute('aria-selected')),
      pages: [...document.querySelectorAll('.page')].map(p => p.classList.contains('active')),
    }));
    assert.deepEqual(await etat(), { onglets: ['true', 'false', 'false'], pages: [true, false, false] });
    await page.click('#onglet-list');
    assert.deepEqual(await etat(), { onglets: ['false', 'true', 'false'], pages: [false, true, false] });
    await page.click('#onglet-history');
    assert.deepEqual(await etat(), { onglets: ['false', 'false', 'true'], pages: [false, false, true] });
    await page.click('#onglet-calc');
    await page.click('#pastille');
    assert.deepEqual(await etat(), { onglets: ['false', 'false', 'true'], pages: [false, false, true] });
    await context.close();
  });

  it('fiche produit : fermée par Échap, par un clic sur le fond, par « Fermer » ; le message « Voir » ouvre la liste', async () => {
    const script = fauxScript();
    const { page, context } = await app.appareil(script, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await attendreEtat(page, 'ok');
    await enregistrer(page, 'tranquille', '8', 'Vin Test');
    await page.click('#toast-action');
    assert.equal(await page.getAttribute('#onglet-list', 'aria-selected'), 'true');
    const ouverte = () => page.evaluate(() => document.getElementById('modal').classList.contains('ouvert'));
    await page.click('.produit');
    assert.equal(await ouverte(), true);
    await page.keyboard.press('Escape');
    assert.equal(await ouverte(), false);
    await page.click('.produit');
    await page.mouse.click(195, 40);          // sur le fond assombri
    assert.equal(await ouverte(), false);
    await page.click('.produit');
    await page.click('[data-action="fermer"]');
    assert.equal(await ouverte(), false);
    await context.close();
  });

  it('écran PIN : bouton clé pour le rouvrir, « Plus tard » et Échap le ferment', async () => {
    const { page, context } = await app.appareil(fauxScript(), { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await page.click('.icone-btn[data-action="pin"]');
    assert.equal(await page.isVisible('#pin-modal.ouvert'), true);
    assert.equal(await page.isVisible('#pin-url-zone'), true);    // adresse modifiable (SCRIPT_URL vide)
    assert.equal(await page.inputValue('#pin-input'), '');
    await page.click('[data-action="fermer-pin"]');
    assert.equal(await page.isVisible('#pin-modal.ouvert'), false);
    await page.click('.icone-btn[data-action="pin"]');
    await page.keyboard.press('Escape');
    assert.equal(await page.isVisible('#pin-modal.ouvert'), false);
    await context.close();
  });

  it('clavier : Entrée dans le prix passe au nom, Entrée dans le nom enregistre', async () => {
    const script = fauxScript();
    const { page, context } = await app.appareil(script, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await attendreEtat(page, 'ok');
    await page.fill('#input-prix', '8');
    await page.waitForTimeout(50);          // le champ nom n'existe à l'écran qu'une fois le prix calculé
    await page.press('#input-prix', 'Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-nom');
    await page.keyboard.type('Au clavier');
    await page.keyboard.press('Enter');
    await attendreEtat(page, 'ok');
    assert.equal(script.prive()[0][1], 'Au clavier');
    await context.close();
  });

  it('badge de l\'onglet Produits = nombre de produits en attente d\'envoi', async () => {
    const attente = [2, 3].map(id => Object.assign({}, PRODUIT, { id, sku: '', nom: 'Vin ' + id, synced: false, rev: 1 }));
    const { page, context } = await app.appareil(null, { stockage: connecte({ pv_produits_v2: [PRODUIT, ...attente] }) });
    await ouvrir(app, page, { connecter: false });
    assert.equal(await texte(page, '#badge-attente'), '2');
    await context.close();
  });
});

describe('stockage local', () => {
  it('données de l\'ancienne version (sans rev ni synced) relues ; retrait en attente envoyé', async () => {
    const script = fauxScript();
    const ancien = { id: 1700000000000, sku: 'UCP-0007', nom: 'Ancien format', categorie: 'mousseux', prixAchat: 6, prixTTC: 17, date: '05/03/2026' };
    const { page, context } = await app.appareil(script, { stockage: connecte({
      pv_produits_v2: [ancien],
      pv_historique: [{ id: 1, nom: 'Ancien format', categorie: 'mousseux', prixAchat: 6, prixTTC: 17, date: '05/03/2026' }],
      pv_retraits: [{ sku: 'UCP-0005', nom: 'Déjà supprimé' }],
    }) });
    await ouvrir(app, page, { connecter: false });
    await attendreEtat(page, 'ok');
    assert.deepEqual(script.requetes[0].operations, [{ action: 'retirer', sku: 'UCP-0005', nom: 'Déjà supprimé' }]);
    assert.deepEqual(await lireJSON(page, 'pv_retraits'), []);           // « introuvable » : abandonné
    await page.click('#onglet-list');
    assert.equal(await texte(page, '.produit-nom'), 'Ancien format');
    await page.click('#onglet-history');
    assert.equal(await texte(page, '.histo-nom'), 'Ancien format');
    await context.close();
  });

  it('données abîmées dans le stockage : l\'app démarre quand même, listes vides', async () => {
    const { page, context } = await app.appareil(null, { stockage: { pv_produits_v2: '{oops', pv_historique: '[', pv_config: 'x' } });
    await ouvrir(app, page, { connecter: false });
    assert.deepEqual(page.erreurs, []);
    assert.equal(await page.isVisible('#config-manquante'), true);
    await page.click('[data-action="fermer-pin"]');
    await page.click('#onglet-list');
    assert.equal(await texte(page, '#product-list'), 'Aucun produit enregistré');
    await context.close();
  });

  it('stockage inaccessible (navigation privée stricte) : l\'app démarre, écran PIN affiché', async () => {
    const { page, context } = await app.appareil(null);
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('bloqué'); };
      Storage.prototype.setItem = () => { throw new Error('bloqué'); };
    });
    await ouvrir(app, page, { connecter: false });
    assert.deepEqual(page.erreurs, []);
    assert.equal(await page.isVisible('#pin-modal.ouvert'), true);
    await context.close();
  });

  it('mémoire pleine en ligne : « enregistré » puis l\'alerte revient après l\'envoi (le produit est dans la feuille)', async () => {
    const script = fauxScript();
    const { page, context } = await app.appareil(script, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await attendreEtat(page, 'ok');
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'pv_produits_v2') throw new Error('QuotaExceededError'); return orig.call(this, k, v); };
    });
    await enregistrer(page, 'tranquille', '8', 'Plein');
    await attendreEtat(page, 'ok');
    assert.equal(await texte(page, '#toast-texte'), 'Mémoire de l\'appareil pleine : donnée non enregistrée');
    assert.equal(script.prive()[0][1], 'Plein');
    await context.close();
  });

  it('RISQUE R-01 : mémoire pleine hors ligne, alerte affichée mais l\'envoi en attente est perdu au rechargement', async () => {
    const script = fauxScript();
    const { page, context } = await app.appareil(script, { stockage: connecte(), serviceWorkers: 'allow' });
    await ouvrir(app, page, { connecter: false });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await attendreEtat(page, 'ok');
    await context.setOffline(true);
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'pv_produits_v2') throw new Error('QuotaExceededError'); return orig.call(this, k, v); };
    });
    await enregistrer(page, 'tranquille', '8', 'Perdu');
    await page.waitForTimeout(300);
    // « Perdu enregistré » s'affiche d'abord, puis l'alerte (la synchro, hors ligne, réécrit la liste).
    assert.equal(await texte(page, '#toast-texte'), 'Mémoire de l\'appareil pleine : donnée non enregistrée');
    assert.equal(await texte(page, '#badge-attente'), '1');
    await page.reload();
    assert.equal(await lireJSON(page, 'pv_produits_v2'), null);   // envoi en attente perdu
    await context.setOffline(false);
    await attendreEtat(page, 'ok');
    assert.equal(script.prive().length, 0);                        // jamais arrivé dans la feuille
    await context.close();
  });

  it('historique local limité à 300 calculs, 100 affichés', async () => {
    const histo = Array.from({ length: 305 }, (_, i) => ({ id: i, nom: 'H' + i, categorie: 'tranquille', prixAchat: 8, prixTTC: 21.5, date: '01/01/2026' }));
    const { page, context } = await app.appareil(fauxScript(), { stockage: connecte({ pv_historique: histo }) });
    await ouvrir(app, page, { connecter: false });
    await enregistrer(page, 'tranquille', '8', 'Nouveau');
    const stocke = await lireJSON(page, 'pv_historique');
    assert.equal(stocke.length, 300);
    assert.equal(stocke[0].nom, 'Nouveau');
    await page.click('#onglet-history');
    assert.equal(await page.$$eval('.histo', h => h.length), 100);
    await context.close();
  });

  it('clés de stockage utilisées par l\'app (contrat à préserver)', async () => {
    const script = fauxScript();
    const { page, context } = await app.appareil(script);
    await ouvrir(app, page);
    await attendreEtat(page, 'ok');
    await enregistrer(page, 'mousseux', '8', 'Clés');
    await page.click('#detail summary');
    await attendreEtat(page, 'ok');
    const cles = await page.evaluate(() => Object.keys(localStorage).sort());
    assert.deepEqual(cles, ['pv_categorie', 'pv_config', 'pv_detail', 'pv_historique', 'pv_pin', 'pv_produits_v2', 'pv_retraits', 'pv_url']);
    await context.close();
  });
});
