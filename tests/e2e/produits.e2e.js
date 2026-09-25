// État de référence : produits (ajout, modification, retrait, réactivation,
// recherche, cas limites), vérifiés dans l'app ET dans la fausse feuille.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Calcul = require('../../calcul.js');
const { lancer, ouvrir, fauxScript, connecte, enregistrer, attendreEtat, lireJSON, texte, prixAffiche, CONFIG_E2E } = require('./outils');

let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

async function appareilConnecte(script, extra) {
  const { page, context } = await app.appareil(script, { stockage: connecte(extra) });
  await ouvrir(app, page, { connecter: false });
  await attendreEtat(page, 'ok');
  return { page, context };
}

async function ouvrirFiche(page, nom) {
  await page.click('#onglet-list');
  await page.click(`.produit:has(.produit-nom:text-is("${nom}"))`);
}

async function supprimer(page, nom, accepter = true) {
  await ouvrirFiche(page, nom);
  page.once('dialog', d => (accepter ? d.accept() : d.dismiss()));
  await page.click('#modal-delete-btn');
}

const estDate = v => Object.prototype.toString.call(v) === '[object Date]';

describe('produits', () => {
  it('ajout : produit local, SKU attribué, lignes Privé et Public', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'magnum_tranquille', '12,5', 'Château Test 2020');
    assert.match(await texte(page, '#toast-texte'), /Château Test 2020 enregistré · /);
    await attendreEtat(page, 'ok');
    const ttc = Calcul.prixTTC(12.5, 'magnum_tranquille', CONFIG_E2E);

    const [p] = await lireJSON(page, 'pv_produits_v2');
    assert.equal(typeof p.id, 'number');
    assert.deepEqual({ sku: p.sku, nom: p.nom, categorie: p.categorie, prixAchat: p.prixAchat, prixTTC: p.prixTTC, synced: p.synced, rev: p.rev },
      { sku: 'UCP-0001', nom: 'Château Test 2020', categorie: 'magnum_tranquille', prixAchat: 12.5, prixTTC: ttc, synced: true, rev: 1 });
    assert.match(p.date, /^\d{2}\/\d{2}\/\d{4}$/);

    const [prive] = script.prive();
    assert.deepEqual(prive.slice(0, 6), ['UCP-0001', 'Château Test 2020', 'Magnum tranquille (1,5 l)', 12.5, 6, ttc]);
    assert.ok(estDate(prive[6]));
    assert.deepEqual(script.public(), [['UCP-0001', 'Château Test 2020', 'Magnum tranquille (1,5 l)', ttc, 'disponible']]);

    // Historique local, champ nom vidé, retour à l'onglet Calculer.
    assert.equal((await lireJSON(page, 'pv_historique')).length, 1);
    assert.equal(await page.inputValue('#input-nom'), '');
    assert.equal(await page.getAttribute('#onglet-calc', 'aria-selected'), 'true');
    assert.deepEqual(page.erreurs, []);
    await context.close();
  });

  it('modification : même nom (casse et espaces ignorés) = même produit et même SKU', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'tranquille', '8', 'Côtes du Rhône');
    await attendreEtat(page, 'ok');
    await enregistrer(page, 'mousseux', '9', '  côtes   du RHÔNE ');
    await attendreEtat(page, 'ok');
    const produits = await lireJSON(page, 'pv_produits_v2');
    assert.equal(produits.length, 1);
    assert.equal(produits[0].nom, 'côtes   du RHÔNE');   // nom le plus récent, tel que saisi (trim)
    assert.equal(produits[0].categorie, 'mousseux');
    assert.equal(produits[0].rev, 2);
    assert.equal(script.prive().length, 1);
    assert.deepEqual(script.public()[0].slice(0, 4), ['UCP-0001', 'côtes   du RHÔNE', 'Vin mousseux / pétillant', Calcul.prixTTC(9, 'mousseux', CONFIG_E2E)]);
    assert.equal((await lireJSON(page, 'pv_historique')).length, 2);
    await context.close();
  });

  it('fiche produit : détail, SKU, date ; « Recalculer » recharge format, prix et nom', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, '3l_mousseux', '20', 'Jéroboam Test');
    await attendreEtat(page, 'ok');
    await ouvrirFiche(page, 'Jéroboam Test');
    assert.equal(await texte(page, '#modal-title'), 'Jéroboam Test');
    assert.match(await texte(page, '#modal-content'), /Jéroboam pétillant \(3 l\).*SKU\s*UCP-0001.*Enregistré le\s*\d{2}\/\d{2}\/\d{4}/);
    await page.click('#modal-modifier');
    assert.equal(await page.getAttribute('#onglet-calc', 'aria-selected'), 'true');
    assert.equal(await page.getAttribute('.cat[data-cat="3l_mousseux"]', 'aria-pressed'), 'true');
    assert.equal(await page.inputValue('#input-prix'), '20');
    assert.equal(await page.inputValue('#input-nom'), 'Jéroboam Test');
    await page.fill('#input-prix', '22');
    await page.click('#form-enregistrer button[type="submit"]');
    await attendreEtat(page, 'ok');
    assert.equal(script.prive().length, 1);
    assert.equal(script.prive()[0][3], 22);
    await context.close();
  });

  it('BUG CONNU B-02 : « Recalculer » puis changement de nom crée un second produit (pas un renommage)', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'tranquille', '8', 'Vin A');
    await attendreEtat(page, 'ok');
    await ouvrirFiche(page, 'Vin A');
    await page.click('#modal-modifier');
    await page.fill('#input-nom', 'Vin A 2023');
    await page.click('#form-enregistrer button[type="submit"]');
    await attendreEtat(page, 'ok');
    assert.equal((await lireJSON(page, 'pv_produits_v2')).length, 2);
    assert.deepEqual(script.prive().map(r => r[0]), ['UCP-0001', 'UCP-0002']);
    await context.close();
  });

  it('retrait : confirmation, produit retiré de l\'app, « retiré » dans Public, Privé intact', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'tranquille', '8', 'À retirer');
    await attendreEtat(page, 'ok');
    await supprimer(page, 'À retirer', false);          // annulé
    assert.equal((await lireJSON(page, 'pv_produits_v2')).length, 1);
    await page.click('[data-action="fermer"]');
    await supprimer(page, 'À retirer', true);
    await attendreEtat(page, 'ok');
    assert.deepEqual(await lireJSON(page, 'pv_produits_v2'), []);
    assert.deepEqual(await lireJSON(page, 'pv_retraits'), []);
    assert.equal(script.public()[0][4], 'retiré');
    assert.equal(script.prive().length, 1);
    // Un lot au démarrage (vide : sert à relire la config), un par action.
    assert.equal(script.actions().filter(a => a === 'lot').length, 3);
    assert.deepEqual(script.requetes.map(r => (r.operations || []).map(o => o.action)), [[], ['enregistrer'], ['retirer']]);
    await context.close();
  });

  it('B-03 CORRIGÉ (script v3) : réenregistré après retrait, le produit garde son SKU et redevient « disponible »', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'tranquille', '8', 'Revenant');
    await attendreEtat(page, 'ok');
    await supprimer(page, 'Revenant');
    await attendreEtat(page, 'ok');
    await page.click('#onglet-calc');
    await enregistrer(page, 'tranquille', '9', 'Revenant');
    await attendreEtat(page, 'ok');
    assert.equal(script.prive().length, 1);
    assert.deepEqual(script.public(), [['UCP-0001', 'Revenant', 'Vin tranquille', Calcul.prixTTC(9, 'tranquille', CONFIG_E2E), 'disponible']]);
    assert.deepEqual(script.env.onglet('Journal').data.slice(1).map(r => r[2]), ['créer', 'retirer', 'réenregistrer']);
    await context.close();
  });

  it('retrait hors ligne puis réenregistrement avant l\'envoi : le retrait est annulé', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'tranquille', '8', 'Hésitant');
    await attendreEtat(page, 'ok');
    await context.setOffline(true);
    await supprimer(page, 'Hésitant');
    assert.equal((await lireJSON(page, 'pv_retraits')).length, 1);
    await page.click('#onglet-calc');
    await enregistrer(page, 'tranquille', '8', 'Hésitant');
    assert.deepEqual(await lireJSON(page, 'pv_retraits'), []);
    await context.setOffline(false);
    await attendreEtat(page, 'ok');
    assert.equal(script.public()[0][4], 'disponible');
    assert.equal(script.prive().length, 1);
    await context.close();
  });

  it('saisie incomplète : sans nom ou sans prix, rien n\'est enregistré', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'tranquille', '8', '   ');
    assert.equal(await texte(page, '#toast-texte'), 'Donne un nom au produit');
    assert.equal(await lireJSON(page, 'pv_produits_v2'), null);
    await page.fill('#input-prix', '');
    await page.waitForTimeout(50);
    assert.equal(await page.isHidden('#form-enregistrer'), true);   // le formulaire est dans le résultat masqué
    assert.equal(script.prive().length, 0);
    await context.close();
  });

  it('noms dangereux : HTML affiché tel quel (pas exécuté), formule neutralisée dans la feuille', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    const html = '<img src=x onerror="window.__xss=1">';
    await enregistrer(page, 'tranquille', '8', html);
    await attendreEtat(page, 'ok');
    await enregistrer(page, 'tranquille', '8', '=SOMME(A1)');
    await attendreEtat(page, 'ok');
    await page.click('#onglet-list');
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.deepEqual(await page.$$eval('.produit-nom', ns => ns.map(n => n.textContent)), ['=SOMME(A1)', html]);
    assert.deepEqual(script.prive().map(r => r[1]), [html, "'=SOMME(A1)"]);
    await context.close();
  });

  it('liste : recherche par nom ou SKU, filtres par format avec compteurs, états vides', async () => {
    const produits = [
      { id: 3, sku: 'UCP-0003', nom: 'Crémant Rosé', categorie: 'mousseux', prixAchat: 7, prixTTC: 21, date: '02/02/2026', synced: true },
      { id: 2, sku: 'UCP-0002', nom: 'Maury Grenat', categorie: 'intermediaire', prixAchat: 9, prixTTC: 26, date: '01/02/2026', synced: true },
      { id: 1, sku: 'UCP-0001', nom: 'Crémant Brut', categorie: 'mousseux', prixAchat: 6, prixTTC: 20, date: '01/01/2026', synced: true },
    ];
    const { page, context } = await app.appareil(null, { stockage: connecte({ pv_produits_v2: produits }) });
    await ouvrir(app, page, { connecter: false });
    await page.click('#onglet-list');
    assert.equal(await texte(page, '#compte'), '3 produits');
    assert.deepEqual(await page.$$eval('.filtre', fs => fs.map(f => f.textContent.replace(/\s+/g, ' ').trim())),
      ['Tous3', 'Pétillant2', 'Intermédiaire1']);
    await page.click('.filtre[data-filtre="mousseux"]');
    assert.equal(await texte(page, '#compte'), '2 produits');
    await page.fill('#search-input', 'rosé');
    await page.waitForTimeout(150);
    assert.deepEqual(await page.$$eval('.produit-nom', ns => ns.map(n => n.textContent)), ['Crémant Rosé']);
    await page.click('.filtre[data-filtre="tous"]');
    await page.fill('#search-input', 'ucp-0002');
    await page.waitForTimeout(150);
    assert.deepEqual(await page.$$eval('.produit-nom', ns => ns.map(n => n.textContent)), ['Maury Grenat']);
    await page.fill('#search-input', 'introuvable');
    await page.waitForTimeout(150);
    assert.equal(await texte(page, '#product-list'), 'Aucun produit ne correspond');
    assert.equal(await texte(page, '#compte'), '0 produit');
    await context.close();
  });

  it('liste vide et un seul format : pas de filtres', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await page.click('#onglet-list');
    assert.equal(await texte(page, '#product-list'), 'Aucun produit enregistré');
    assert.equal(await page.$$eval('.filtre', fs => fs.length), 0);
    await context.close();
  });

  it('BUG CONNU B-04 : un produit de catégorie inconnue s\'affiche comme « Vin tranquille »', async () => {
    const produits = [{ id: 1, sku: 'UCP-0009', nom: 'Mystère', categorie: '', prixAchat: 5, prixTTC: 12, date: '01/01/2026', synced: true }];
    const { page, context } = await app.appareil(null, { stockage: connecte({ pv_produits_v2: produits }) });
    await ouvrir(app, page, { connecter: false });
    await page.click('#onglet-list');
    assert.equal(await texte(page, '.produit .etiquette'), 'Vin tranquille');
    assert.equal(await page.getAttribute('.produit', 'data-cat'), 'tranquille');
    await context.close();
  });

  it('prix affichés dans la liste = prix enregistrés (pas recalculés si la config change)', async () => {
    const produits = [{ id: 1, sku: 'UCP-0001', nom: 'Ancien prix', categorie: 'tranquille', prixAchat: 8, prixTTC: 99, date: '01/01/2026', synced: true }];
    const { page, context } = await app.appareil(null, { stockage: connecte({ pv_produits_v2: produits }) });
    await ouvrir(app, page, { connecter: false });
    await page.click('#onglet-list');
    assert.equal(await texte(page, '.produit-prix'), prixAffiche(99));
    await context.close();
  });
});
