// État de référence : PIN, synchronisation avec la feuille, états d'erreur,
// réessais et comportement entre plusieurs appareils.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Calcul = require('../../app/src/core/calcul.js');
const { lancer, ouvrir, fauxScript, connecte, enregistrer, attendreEtat, lireJSON, texte, URL_SCRIPT, CONFIG_E2E, PIN } = require('./outils');

let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

function enAttente(n, categorie = 'tranquille', debut = 1) {
  return Array.from({ length: n }, (_, i) => ({
    id: 1000 + debut + i, sku: '', nom: `Vin ${debut + i}`, categorie, prixAchat: 8,
    prixTTC: Calcul.prixTTC(8, categorie, CONFIG_E2E), date: '01/01/2026', synced: false, rev: 1,
  }));
}

async function appareilConnecte(script, extra) {
  const { page, context } = await app.appareil(script, { stockage: connecte(extra) });
  await ouvrir(app, page, { connecter: false });
  return { page, context };
}

describe('PIN', () => {
  it('premier lancement : adresse + PIN demandés ; PIN faux refusé et non gardé ; bon PIN gardé', async () => {
    const script = fauxScript();
    const { page, context } = await app.appareil(script);
    await ouvrir(app, page, { connecter: false });
    assert.equal(await page.isVisible('#pin-modal.ouvert'), true);
    await page.click('#pin-ok');
    assert.equal(await texte(page, '#pin-msg'), 'Colle l\'adresse du script.');
    await page.fill('#pin-url', URL_SCRIPT);
    await page.click('#pin-ok');
    assert.equal(await texte(page, '#pin-msg'), 'Entre ton PIN.');
    await page.fill('#pin-input', '0000');
    await page.click('#pin-ok');
    await page.waitForFunction(() => document.getElementById('pin-msg').textContent === 'PIN refusé');
    assert.equal(await page.evaluate(() => localStorage.getItem('pv_pin')), null);
    await page.fill('#pin-input', PIN);
    await page.click('#pin-ok');
    await attendreEtat(page, 'ok');
    assert.equal(await page.isVisible('#pin-modal.ouvert'), false);
    assert.equal(await page.evaluate(() => localStorage.getItem('pv_pin')), PIN);
    assert.equal(await page.evaluate(() => localStorage.getItem('pv_url')), URL_SCRIPT);
    assert.deepEqual(await lireJSON(page, 'pv_config'), CONFIG_E2E);
    assert.deepEqual(script.actions(), ['config', 'config', 'lot']);
    await context.close();
  });

  it('après 20 PIN faux, le script bloque tout le monde, même le bon PIN', async () => {
    const script = fauxScript();
    for (let i = 0; i < 20; i++) script.env.post({ action: 'config', pin: 'x' + i });
    const { page, context } = await app.appareil(script);
    await ouvrir(app, page);
    await page.waitForFunction(() => document.getElementById('pin-msg').textContent !== '');
    assert.equal(await texte(page, '#pin-msg'), 'Trop d\'essais de PIN : réessaie dans 15 minutes');
    await context.close();
  });

  it('validation du PIN : script injoignable → message, rien gardé ; hors ligne → PIN gardé sans vérification', async () => {
    const script = fauxScript();
    script.mode = 'coupure';
    const { page, context } = await app.appareil(script);
    await ouvrir(app, page);
    await page.waitForFunction(() => document.getElementById('pin-msg').textContent !== '');
    assert.match(await texte(page, '#pin-msg'), /^script injoignable/);
    assert.equal(await page.evaluate(() => localStorage.getItem('pv_pin')), null);
    await context.setOffline(true);
    await page.click('#pin-ok');
    await page.waitForFunction(() => !document.getElementById('pin-modal').classList.contains('ouvert'));
    assert.equal(await page.evaluate(() => localStorage.getItem('pv_pin')), PIN);
    assert.equal(await texte(page, '#pastille-texte'), 'Hors ligne');
    await context.close();
  });

  it('PIN changé côté script : l\'écran PIN se rouvre avec « PIN refusé »', async () => {
    const script = fauxScript();
    script.env.props.PIN = '999999';
    const { page, context } = await appareilConnecte(script);
    await page.waitForSelector('#pin-modal.ouvert');
    assert.equal(await texte(page, '#pin-msg'), 'PIN refusé');
    assert.match(await texte(page, '#sync-status'), /PIN refusé/);
    await context.close();
  });
});

describe('synchronisation', () => {
  it('toute la file part en une seule requête « lot » ; SKU attribués dans l\'ordre de la file', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script, { pv_produits_v2: enAttente(3) });
    await attendreEtat(page, 'ok');
    assert.deepEqual(script.actions(), ['lot']);
    assert.equal(script.requetes[0].operations.length, 3);
    assert.deepEqual(script.requetes[0].operations[0], {
      action: 'enregistrer', uid: '1001', nom: 'Vin 1', categorie: 'tranquille', prixAchat: 8, prixTTC: Calcul.prixTTC(8, 'tranquille', CONFIG_E2E),
    });
    const produits = await lireJSON(page, 'pv_produits_v2');
    assert.deepEqual(produits.map(p => [p.nom, p.sku, p.synced]), [['Vin 1', 'UCP-0001', true], ['Vin 2', 'UCP-0002', true], ['Vin 3', 'UCP-0003', true]]);
    assert.equal(await texte(page, '#sync-status'), 'Synchronisé avec Google Sheets');
    assert.equal(await page.isHidden('#badge-attente'), true);
    await context.close();
  });

  it('plus de 40 envois en attente : découpés en paquets de 40', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script, { pv_produits_v2: enAttente(41) });
    await attendreEtat(page, 'ok', 15000);
    assert.deepEqual(script.requetes.map(r => r.operations.length), [40, 1]);
    assert.equal(script.prive().length, 41);
    await context.close();
  });

  it('script pas à jour (sans « lot ») : repli sur une requête par opération, retenu pour la session', async () => {
    const script = fauxScript();
    script.mode = 'ancien';
    const { page, context } = await appareilConnecte(script, { pv_produits_v2: enAttente(2) });
    await attendreEtat(page, 'ok');
    assert.deepEqual(script.actions(), ['lot', 'config', 'enregistrer', 'enregistrer']);
    await enregistrer(page, 'tranquille', '9', 'Vin 3');
    await attendreEtat(page, 'ok');
    assert.deepEqual(script.actions().slice(4), ['config', 'enregistrer']);
    assert.equal(script.prive().length, 3);
    await context.close();
  });

  it('produit refusé par le script : signalé, n\'empêche pas les autres, renvoyé à chaque synchro', async () => {
    const config = JSON.parse(JSON.stringify(CONFIG_E2E));
    delete config.categories.magnum_mousseux;
    const script = fauxScript({ config });
    const file = [...enAttente(1, 'magnum_mousseux', 1), ...enAttente(1, 'tranquille', 2)];
    const { page, context } = await appareilConnecte(script, { pv_produits_v2: file });
    await attendreEtat(page, 'erreur');
    const produits = await lireJSON(page, 'pv_produits_v2');
    assert.deepEqual(produits.map(p => [p.nom, p.sku, p.synced, p.erreur]), [
      ['Vin 1', '', false, 'categorie'], ['Vin 2', 'UCP-0001', true, undefined]]);
    assert.equal(await texte(page, '#sync-status'), 'Non synchronisé (1 en attente) · 1 refusé par le script');
    assert.equal(await texte(page, '#pastille-texte'), '1 en attente');
    // La config du script (sans ce format) remplace celle en cache.
    assert.equal(await texte(page, '.cat[data-cat="magnum_mousseux"] .cat-info'), 'frais à charger');
    await page.click('#onglet-list');
    assert.match(await texte(page, '.produit:has(.produit-nom:text-is("Vin 1"))'), /⚠ refusé : catégorie inconnue du script/);
    await page.click('#onglet-history');
    await page.click('[data-action="sync"]');
    await attendreEtat(page, 'erreur');
    assert.equal(script.requetes.at(-1).operations.length, 1);
    await context.close();
  });

  it('réponse perdue après écriture : renvoi sans doublon (même SKU grâce à l\'identifiant local)', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await attendreEtat(page, 'ok');
    script.mode = 'perdue';
    await enregistrer(page, 'tranquille', '8', 'Réponse perdue');
    await attendreEtat(page, 'erreur');
    assert.equal(script.prive().length, 1);            // écrit côté feuille…
    assert.equal((await lireJSON(page, 'pv_produits_v2'))[0].synced, false);   // …mais pas confirmé
    script.mode = 'normal';
    await page.click('#onglet-history');
    await page.click('[data-action="sync"]');
    await attendreEtat(page, 'ok');
    assert.equal(script.prive().length, 1);
    assert.equal((await lireJSON(page, 'pv_produits_v2'))[0].sku, 'UCP-0001');
    await context.close();
  });

  it('produit modifié pendant son envoi : renvoyé avec la dernière version', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await attendreEtat(page, 'ok');
    script.suspendre();
    await enregistrer(page, 'tranquille', '8', 'Pendant');
    await attendreEtat(page, 'encours');
    assert.equal(await texte(page, '#pastille-texte'), 'Synchro…');
    await enregistrer(page, 'tranquille', '9', 'Pendant');
    script.reprendre();
    await attendreEtat(page, 'ok');
    const lots = script.requetes.filter(r => r.action === 'lot').slice(1).map(r => r.operations.map(o => o.prixAchat));
    assert.deepEqual(lots, [[8], [9]]);
    assert.equal(script.prive()[0][3], 9);
    assert.equal(script.prive().length, 1);
    await context.close();
  });

  for (const [mode, message, prepa] of [
    ['html', /réponse illisible du script/],
    ['http500', /erreur Google/],
    ['coupure', /script injoignable/],
    ['normal', /propriété CONFIG absente ou mal formée/, s => { s.env.props.CONFIG = null; }],
    ['normal', /Trop d'essais de PIN/, s => { for (let i = 0; i < 20; i++) s.env.post({ action: 'config', pin: 'x' + i }); }],
  ]) {
    it(`erreur « ${message.source} » : file conservée, message affiché, reprise ensuite`, async () => {
      const script = fauxScript();
      script.mode = mode;
      if (prepa) prepa(script);
      const { page, context } = await appareilConnecte(script, { pv_produits_v2: enAttente(1) });
      await attendreEtat(page, 'erreur');
      assert.match(await texte(page, '#sync-status'), message);
      assert.match(await texte(page, '#sync-status'), /\(1 en attente\)/);
      assert.equal(await texte(page, '#badge-attente'), '1');
      if (!prepa) {
        script.mode = 'normal';
        await page.click('#onglet-history');
        await page.click('[data-action="sync"]');
        await attendreEtat(page, 'ok');
      }
      await context.close();
    });
  }

  it('réseau faible : nouvel essai automatique au bout de 2 minutes', async () => {
    const script = fauxScript();
    script.mode = 'coupure';
    const { page, context } = await app.appareil(script, { stockage: connecte({ pv_produits_v2: enAttente(1) }) });
    await page.clock.install();
    await ouvrir(app, page, { connecter: false });
    await attendreEtat(page, 'erreur');
    script.mode = 'normal';
    await page.clock.fastForward('01:50');
    assert.equal(await page.getAttribute('#pastille', 'data-etat'), 'erreur');
    await page.clock.fastForward('00:15');
    await attendreEtat(page, 'ok');
    await context.close();
  });

  it('retour sur l\'app avec des envois en attente : synchro relancée', async () => {
    const script = fauxScript();
    script.mode = 'coupure';
    const { page, context } = await appareilConnecte(script, { pv_produits_v2: enAttente(1) });
    await attendreEtat(page, 'erreur');
    script.mode = 'normal';
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await attendreEtat(page, 'ok');
    await context.close();
  });
});

describe('plusieurs appareils (même feuille)', () => {
  it('LIMITE CONNUE B-05 : un produit créé sur A n\'apparaît jamais sur B', async () => {
    const script = fauxScript();
    const a = await appareilConnecte(script);
    const b = await appareilConnecte(script);
    await attendreEtat(a.page, 'ok');
    await enregistrer(a.page, 'tranquille', '8', 'Créé sur A');
    await attendreEtat(a.page, 'ok');
    await b.page.click('#onglet-history');
    await b.page.click('[data-action="sync"]');
    await attendreEtat(b.page, 'ok');
    await b.page.click('#onglet-list');
    assert.equal(await texte(b.page, '#product-list'), 'Aucun produit enregistré');
    assert.equal(script.prive().length, 1);
    await a.context.close(); await b.context.close();
  });

  it('LIMITE CONNUE B-06 (app actuelle) : modifications concurrentes, le dernier envoi écrase, désormais tracé dans le Journal', async () => {
    const script = fauxScript();
    const a = await appareilConnecte(script);
    const b = await appareilConnecte(script);
    await attendreEtat(a.page, 'ok'); await attendreEtat(b.page, 'ok');
    await enregistrer(a.page, 'tranquille', '8', 'Disputé');
    await attendreEtat(a.page, 'ok');
    // A modifie hors ligne ; B modifie en ligne ; A revient en ligne.
    await a.context.setOffline(true);
    await enregistrer(a.page, 'tranquille', '10', 'Disputé');
    await enregistrer(b.page, 'tranquille', '20', 'Disputé');
    await attendreEtat(b.page, 'ok');
    assert.equal(script.prive()[0][3], 20);
    await a.context.setOffline(false);
    await attendreEtat(a.page, 'ok');
    assert.equal(script.prive().length, 1);
    assert.equal(script.prive()[0][3], 10);             // la modification de B est perdue
    assert.equal(await texte(b.page, '#pastille-texte'), 'Synchronisé');   // et B n'en sait rien
    assert.equal((await lireJSON(b.page, 'pv_produits_v2'))[0].prixAchat, 20);
    // Script v3 : l'app actuelle n'envoie pas de version, l'écrasement a
    // encore lieu, mais le Journal garde les deux modifications.
    const journal = script.env.onglet('Journal').data.slice(1);
    assert.deepEqual(journal.map(r => [r[2], r[7]]), [
      ['créer', 'Vin tranquille · achat 8 · TTC 21.5 · disponible'],
      ['modifier', 'Vin tranquille · achat 20 · TTC 39.5 · disponible'],
      ['modifier', 'Vin tranquille · achat 10 · TTC 24.5 · disponible'],
    ]);
    assert.ok(journal.slice(1).every(r => r[8] === 'sans contrôle de version (ancienne app)'));
    await a.context.close(); await b.context.close();
  });
});
