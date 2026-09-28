// Étape 3 : la feuille comme source commune ; conflits entre appareils et
// leur résolution explicite ; produits retirés ; nom de l'appareil.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { lancer, ouvrir, fauxScript, connecte, enregistrer, attendreEtat, lireJSON, texte, PIN, URL_SCRIPT } = require('./outils');

let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

async function appareil(script, extra) {
  const d = await app.appareil(script, { stockage: connecte(extra) });
  await ouvrir(app, d.page, { connecter: false });
  await attendreEtat(d.page, 'ok');
  return d;
}
async function synchroniser(page, etatAttendu = 'ok') {
  await page.click('#onglet-history');
  await page.click('[data-action="sync"]');
  await attendreEtat(page, etatAttendu);
}
async function supprimer(page, nom) {
  await page.click('#onglet-list');
  await page.click(`.produit:has(.produit-nom:text-is("${nom}"))`);
  page.once('dialog', d => d.accept());
  await page.click('#modal-delete-btn');
}
// A et B connaissent « Partagé » en version 1.
async function deuxAppareils(script) {
  const a = await appareil(script, { pv_appareil: 'Comptoir' });
  const b = await appareil(script, { pv_appareil: 'Téléphone' });
  await enregistrer(a.page, 'tranquille', '8', 'Partagé');
  await attendreEtat(a.page, 'ok');
  await synchroniser(b.page);
  return { a, b };
}

describe('conflits', () => {
  it('« Garder celle de la feuille » : la version de l\'autre appareil remplace la mienne, rien n\'est envoyé', async () => {
    const script = fauxScript();
    const { a, b } = await deuxAppareils(script);
    await a.context.setOffline(true);
    await enregistrer(a.page, 'tranquille', '10', 'Partagé');
    await enregistrer(b.page, 'mousseux', '20', 'Partagé');
    await attendreEtat(b.page, 'ok');
    await a.context.setOffline(false);
    await attendreEtat(a.page, 'conflit');
    // L'origine du changement est indiquée.
    await a.page.click('#onglet-list');
    assert.match(await texte(a.page, '#conflits'), /modifié sur un autre appareil \(Téléphone, le \d{2}\/\d{2}\/\d{4}\)/);
    const avant = script.requetes.length;
    await a.page.click('[data-action="conflit-feuille"]');
    await attendreEtat(a.page, 'ok');
    const [p] = await lireJSON(a.page, 'pv_produits_v2');
    assert.deepEqual([p.categorie, p.prixAchat, p.version, p.synced, p.conflit], ['mousseux', 20, 2, true, undefined]);
    assert.ok(script.requetes.slice(avant).every(r => r.action !== 'lot' || r.operations.length === 0));
    assert.deepEqual([script.prive()[0][3], script.prive()[0][7]], [20, 2]);
    await a.context.close(); await b.context.close();
  });

  it('produit retiré ailleurs pendant que je le modifie : conflit « retiré », « Garder ma version » le remet en vente', async () => {
    const script = fauxScript();
    const { a, b } = await deuxAppareils(script);
    await a.context.setOffline(true);
    await enregistrer(a.page, 'tranquille', '11', 'Partagé');
    await supprimer(b.page, 'Partagé');
    await attendreEtat(b.page, 'ok');
    assert.equal(script.public()[0][4], 'retiré');
    await a.context.setOffline(false);
    await attendreEtat(a.page, 'conflit');
    await a.page.click('#onglet-list');
    assert.match(await texte(a.page, '#conflits'), /a été retiré sur un autre appareil/);
    await a.page.click('[data-action="conflit-mien"]');
    await attendreEtat(a.page, 'ok');
    assert.equal(script.public()[0][4], 'disponible');
    assert.equal(script.prive()[0][3], 11);
    await a.context.close(); await b.context.close();
  });

  it('suppression d\'un produit modifié ailleurs : conflit ; « Garder le produit » puis, sur un autre cas, « Retirer quand même »', async () => {
    const script = fauxScript();
    const { a, b } = await deuxAppareils(script);
    await a.context.setOffline(true);
    await supprimer(a.page, 'Partagé');
    await enregistrer(b.page, 'tranquille', '12', 'Partagé');
    await attendreEtat(b.page, 'ok');
    await a.context.setOffline(false);
    await attendreEtat(a.page, 'conflit');
    assert.equal(script.public()[0][4], 'disponible');           // pas retiré
    await a.page.click('#onglet-list');
    assert.match(await texte(a.page, '#conflits'), /Tu as supprimé ce produit, mais il a été modifié sur un autre appareil \(Téléphone/);
    await a.page.click('[data-action="retrait-garder"]');
    await attendreEtat(a.page, 'ok');
    assert.deepEqual((await lireJSON(a.page, 'pv_produits_v2')).map(p => [p.nom, p.prixAchat]), [['Partagé', 12]]);
    assert.deepEqual(await lireJSON(a.page, 'pv_retraits'), []);
    assert.equal(script.public()[0][4], 'disponible');

    // Même situation, cette fois « Retirer quand même ».
    await a.context.setOffline(true);
    await supprimer(a.page, 'Partagé');
    await synchroniser(b.page);
    await enregistrer(b.page, 'tranquille', '13', 'Partagé');
    await attendreEtat(b.page, 'ok');
    await a.context.setOffline(false);
    await attendreEtat(a.page, 'conflit');
    await a.page.click('#onglet-list');
    await a.page.click('[data-action="retrait-confirmer"]');
    await attendreEtat(a.page, 'ok');
    assert.equal(script.public()[0][4], 'retiré');
    await a.context.close(); await b.context.close();
  });

  it('même nom créé sur deux appareils avec des prix différents : conflit (pas de doublon, rien d\'écrasé)', async () => {
    const script = fauxScript();
    const a = await appareil(script);
    const b = await appareil(script);
    await b.context.setOffline(true);
    await enregistrer(b.page, 'tranquille', '9', 'Jumeau');
    await enregistrer(a.page, 'tranquille', '8', 'Jumeau');
    await attendreEtat(a.page, 'ok');
    await b.context.setOffline(false);
    await attendreEtat(b.page, 'conflit');
    assert.equal(script.prive().length, 1);
    assert.equal(script.prive()[0][3], 8);
    await a.context.close(); await b.context.close();
  });
});

describe('source commune', () => {
  it('produits retirés : masqués, filtre « Retirés », « Remettre en vente » (même SKU, de nouveau disponible)', async () => {
    const script = fauxScript();
    const { page, context } = await appareil(script);
    await enregistrer(page, 'tranquille', '8', 'Pause');
    await enregistrer(page, 'mousseux', '9', 'Actif');
    await attendreEtat(page, 'ok');
    await supprimer(page, 'Pause');
    await attendreEtat(page, 'ok');
    await page.click('#onglet-list');
    assert.deepEqual(await page.$$eval('.produit-nom', n => n.map(x => x.textContent)), ['Actif']);
    assert.deepEqual(await page.$$eval('.filtre', f => f.map(x => x.textContent.replace(/\s+/g, ''))), ['Tous1', 'Retirés1']);
    await page.click('.filtre[data-filtre="retires"]');
    await page.click('.produit');
    assert.equal(await texte(page, '#modal-delete-btn'), 'Remettre en vente');
    await page.click('#modal-delete-btn');
    await attendreEtat(page, 'ok');
    assert.deepEqual(script.public().map(r => [r[0], r[1], r[4]]), [['UCP-0001', 'Pause', 'disponible'], ['UCP-0002', 'Actif', 'disponible']]);
    assert.equal(script.env.onglet('Journal').data.at(-1)[2], 'réenregistrer');
    await page.click('#onglet-list');
    assert.equal(await page.$$eval('.produit', p => p.length), 2);
    await context.close();
  });

  it('nom de l\'appareil : saisi avec le PIN, inscrit dans Privé, le Journal et la fiche', async () => {
    const script = fauxScript();
    const { page, context } = await app.appareil(script);
    await page.goto(app.url);
    await page.fill('#pin-url', URL_SCRIPT);
    await page.fill('#pin-input', PIN);
    await page.fill('#pin-appareil', '  Comptoir   boutique ');
    await page.click('#pin-ok');
    await attendreEtat(page, 'ok');
    assert.equal(await page.evaluate(() => localStorage.getItem('pv_appareil')), 'Comptoir boutique');
    await enregistrer(page, 'tranquille', '8', 'Signé');
    await attendreEtat(page, 'ok');
    assert.equal(script.prive()[0][8], 'Comptoir boutique');
    assert.equal(script.env.onglet('Journal').data.at(-1)[1], 'Comptoir boutique');
    await page.click('#onglet-list');
    await page.click('.produit');
    assert.match(await texte(page, '#modal-content'), /Modifié le\s*\d{2}\/\d{2}\/\d{4} · Comptoir boutique/);
    await context.close();
  });

  it('produit effacé de la feuille à la main : il disparaît de l\'appareil ; une feuille vide ne vide pas l\'appareil', async () => {
    const script = fauxScript();
    const { page, context } = await appareil(script);
    await enregistrer(page, 'tranquille', '8', 'Gardé');
    await enregistrer(page, 'tranquille', '9', 'Effacé');
    await attendreEtat(page, 'ok');
    // Loïc supprime la ligne « Effacé » dans Privé et Public.
    script.env.onglet('Privé').data.splice(2, 1);
    script.env.onglet('Public').data.splice(2, 1);
    await synchroniser(page);
    assert.deepEqual((await lireJSON(page, 'pv_produits_v2')).map(p => p.nom), ['Gardé']);
    // Onglets vidés (erreur de manipulation) : la liste de l'appareil est gardée.
    script.env.onglet('Privé').data.splice(1);
    script.env.onglet('Public').data.splice(1);
    await synchroniser(page);
    assert.deepEqual((await lireJSON(page, 'pv_produits_v2')).map(p => p.nom), ['Gardé']);
    await context.close();
  });

  it('modification faite ici puis relecture avant l\'envoi : la version de l\'appareil n\'est pas écrasée par la feuille', async () => {
    const script = fauxScript();
    const { page, context } = await appareil(script);
    await enregistrer(page, 'tranquille', '8', 'Local');
    await attendreEtat(page, 'ok');
    script.mode = 'coupure';
    await enregistrer(page, 'tranquille', '15', 'Local');
    await attendreEtat(page, 'erreur');
    script.mode = 'normal';
    await synchroniser(page);
    assert.equal(script.prive()[0][3], 15);
    assert.equal((await lireJSON(page, 'pv_produits_v2'))[0].prixAchat, 15);
    await context.close();
  });
});
