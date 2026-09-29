// Écran Calculer V2 (docs/CALCULER_SPEC_V2.md) : ordre D1, sélecteur de
// format, mode modification (Recalculer, B-02, D8, D14), enregistrement
// local puis synchronisation, double soumission, responsive, clavier.
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Calcul = require('../../app/src/core/calcul.js');
const {
  lancer, ouvrir, fauxScript, connecte, calculer, choisirFormat, enregistrer, attendreEtat, lireJSON, texte, prixAffiche, CONFIG_E2E,
} = require('./outils');

let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

async function appareilConnecte(script, extra, options = {}) {
  const { page, context } = await app.appareil(script, Object.assign({ stockage: connecte(extra) }, options));
  await ouvrir(app, page, { connecter: false });
  if (script) await attendreEtat(page, 'ok');
  return { page, context };
}

async function recalculer(page, nom) {
  await page.click('#onglet-list');
  if (await page.$('.filtre[data-filtre="retires"][aria-pressed="false"]') && !(await page.$(`.produit:has(.produit-nom:text-is("${nom}"))`))) {
    await page.click('.filtre[data-filtre="retires"]');
  }
  await page.click(`.produit:has(.produit-nom:text-is("${nom}"))`);
  await page.click('#modal-modifier');
}

const PRODUIT = (id, nom, extra) => Object.assign({
  id, sku: 'UCP-000' + id, nom, categorie: 'tranquille', prixAchat: 8, prixTTC: Calcul.prixTTC(8, 'tranquille', CONFIG_E2E),
  date: '01/01/2026', synced: true, rev: 1, version: 1,
}, extra);

describe('Calculer V2', () => {
  it('D1 : format → prix d\'achat → prix de vente → détail → nom → enregistrer (écran et tabulation), sans titre de page', async () => {
    const { page, context } = await appareilConnecte(null);
    await page.fill('#input-prix', '12,5');
    await page.waitForTimeout(50);
    const ordre = ['#format-bouton', '#input-prix', '#resultat-prix', '#detail summary', '#input-nom', '#btn-enregistrer'];
    const hauts = [];
    for (const sel of ordre) hauts.push((await page.$eval(sel, e => e.getBoundingClientRect().top)));
    assert.deepEqual([...hauts].sort((a, b) => a - b), hauts, 'ordre visuel');
    // Tabulation : même ordre (le montant n'est pas un contrôle).
    await page.focus('#format-bouton');
    const focus = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); focus.push(await page.evaluate(() => document.activeElement.id || document.activeElement.tagName)); }
    assert.deepEqual(focus, ['input-prix', 'SUMMARY', 'input-nom', 'btn-enregistrer']);
    assert.equal(await page.$('#page-calc h1, #page-calc h2'), null);
    await context.close();
  });

  it('390 × 844 : prix de vente visible sans défilement ; aucune largeur ne déborde (320 à 1440 px)', async () => {
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
      const { page, context } = await appareilConnecte(null, {}, { viewport: { width, height } });
      await page.fill('#input-prix', '1 234,56');
      await page.waitForTimeout(50);
      const m = await page.evaluate(() => ({
        deborde: document.documentElement.scrollWidth > window.innerWidth,
        prix: document.getElementById('resultat-prix').getBoundingClientRect(),
        nav: document.querySelector('nav.onglets').getBoundingClientRect().top,
        bouton: document.getElementById('btn-enregistrer').getBoundingClientRect(),
        entree: document.getElementById('input-prix').getBoundingClientRect(),
      }));
      assert.equal(m.deborde, false, `${width} px : débordement horizontal`);
      assert.ok(m.bouton.width >= 44 && m.bouton.height >= 44, `${width} px : bouton ≥ 44 px`);
      if (width === 390) assert.ok(m.prix.bottom <= m.nav, 'prix visible sans défilement à 390 × 844');
      // ≥ 900 px : deux colonnes, étiquette à droite de la saisie.
      if (width >= 900) assert.ok(m.prix.left > m.entree.right, `${width} px : deux colonnes`);
      else assert.ok(m.prix.top > m.entree.bottom, `${width} px : une colonne`);
      await context.close();
    }
  });

  it('sélecteur de format : fermé par défaut, clavier (flèches, Entrée, Échap), recalcul immédiat', async () => {
    const { page, context } = await appareilConnecte(null);
    await page.fill('#input-prix', '8');
    await page.waitForTimeout(50);
    assert.equal(await page.isHidden('#categories'), true);
    await page.focus('#format-bouton');
    await page.keyboard.press('Enter');
    assert.equal(await page.getAttribute('#format-bouton', 'aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.value), 'tranquille');
    // Flèche : le format change et le prix est recalculé tout de suite.
    await page.keyboard.press('ArrowRight');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(8, 'mousseux', CONFIG_E2E)));
    // Échap : on revient au format d'avant l'ouverture, sélecteur fermé.
    await page.keyboard.press('Escape');
    assert.equal(await page.isHidden('#categories'), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'format-bouton');
    assert.equal(await texte(page, '#format-courant'), 'Tranquille · 75 cl');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(8, 'tranquille', CONFIG_E2E)));
    // Entrée valide le choix et passe au prix.
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.isHidden('#categories'), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-prix');
    assert.equal(await texte(page, '#format-courant'), 'Pétillant · 75 cl');
    // Au doigt : le choix referme le sélecteur et passe au prix.
    await choisirFormat(page, 'demie');
    await page.waitForTimeout(20);
    assert.equal(await page.isHidden('#categories'), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'input-prix');
    assert.equal(await texte(page, '#resultat-cat'), 'Demi-bouteille · 37,5 cl');
    await context.close();
  });

  it('changement de format ou de prix : l\'ancien prix ne reste jamais affiché ; annonce accessible du nouveau prix', async () => {
    const { page, context } = await appareilConnecte(null);
    await calculer(page, 'tranquille', '8');
    const a = await texte(page, '#resultat-prix');
    await choisirFormat(page, 'magnum_mousseux');
    const b = await texte(page, '#resultat-prix');
    assert.equal(b, prixAffiche(Calcul.prixTTC(8, 'magnum_mousseux', CONFIG_E2E)));
    assert.notEqual(a, b);
    await page.fill('#input-prix', '9');
    await page.waitForTimeout(50);
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(9, 'magnum_mousseux', CONFIG_E2E)));
    await page.waitForFunction(() => document.getElementById('resultat-annonce').textContent.startsWith('Prix de vente TTC'));
    assert.equal(await texte(page, '#resultat-annonce'), `Prix de vente TTC ${prixAffiche(Calcul.prixTTC(9, 'magnum_mousseux', CONFIG_E2E))}, Magnum pétillant · 1,5 l`);
    assert.equal(await page.getAttribute('#resultat-annonce', 'aria-live'), 'polite');
    await context.close();
  });

  it('enregistrement : « Enregistré sur l\'appareil » tout de suite, « Synchronisé » seulement après le script', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    script.suspendre();                                 // le script ne répond pas encore
    await enregistrer(page, 'tranquille', '8', 'Vin local');
    assert.equal(await texte(page, '#btn-enregistrer'), 'Enregistré sur l\'appareil');
    assert.equal(await page.isDisabled('#btn-enregistrer'), true);
    assert.equal((await lireJSON(page, 'pv_produits_v2'))[0].nom, 'Vin local');
    assert.notEqual(await page.getAttribute('#pastille', 'data-etat'), 'ok');
    assert.equal(script.prive().length, 0);
    script.reprendre();
    await attendreEtat(page, 'ok');
    assert.equal(script.prive()[0][1], 'Vin local');
    // Retour à l'état normal ; format et prix conservés, nom vidé.
    await page.waitForFunction(() => document.getElementById('btn-enregistrer').textContent === 'Enregistrer');
    assert.equal(await page.inputValue('#input-prix'), '8');
    assert.equal(await page.inputValue('#input-nom'), '');
    await context.close();
  });

  it('hors ligne : l\'enregistrement n\'est jamais bloqué ; voyant « en attente » avec le nombre exact', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await enregistrer(page, 'tranquille', '8', 'Hors ligne 1');
    await enregistrer(page, 'mousseux', '9', 'Hors ligne 2');
    assert.match(await texte(page, '#toast-texte'), /^Hors ligne 2 enregistré · /);
    assert.equal(await texte(page, '#badge-attente'), '2');
    assert.notEqual(await page.getAttribute('#pastille', 'data-etat'), 'ok');
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await attendreEtat(page, 'ok');
    assert.equal(script.prive().length, 2);
    await context.close();
  });

  it('double soumission (double clic, Entrée répétée) : un seul enregistrement', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await calculer(page, 'tranquille', '8');
    await page.fill('#input-nom', 'Une fois');
    await page.dblclick('#btn-enregistrer');
    await page.press('#input-nom', 'Enter');
    await attendreEtat(page, 'ok');
    const [p] = await lireJSON(page, 'pv_produits_v2');
    assert.equal(p.rev, 1);
    assert.equal((await lireJSON(page, 'pv_historique')).length, 1);
    assert.equal(script.prive().length, 1);
    await context.close();
  });

  it('D14 : aide « Ce produit existe déjà » avant l\'enregistrement (et variante « retiré »)', async () => {
    const produits = [PRODUIT(1, 'Château A'), PRODUIT(2, 'Château R', { disponibilite: 'retiré' })];
    const { page, context } = await appareilConnecte(null, { pv_produits_v2: produits });
    await calculer(page, 'tranquille', '8');
    await page.fill('#input-nom', 'château  a ');
    assert.equal(await texte(page, '#nom-message'), 'Ce produit existe déjà : il sera mis à jour.');
    assert.equal(await page.getAttribute('#input-nom', 'aria-invalid'), null);
    assert.equal(await page.isDisabled('#btn-enregistrer'), false);
    await page.fill('#input-nom', 'Château R');
    assert.equal(await texte(page, '#nom-message'), 'Ce produit existe déjà (retiré) : il sera mis à jour et remis en vente.');
    await page.fill('#input-nom', 'Château Z');
    assert.equal(await page.isHidden('#nom-message'), true);
    await context.close();
  });

  it('D8 : en modification, le nom d\'un autre produit est bloqué (message, aria-invalid, bouton, Entrée) ; rien n\'est écrit', async () => {
    const script = fauxScript();
    const { page, context } = await appareilConnecte(script);
    await enregistrer(page, 'tranquille', '8', 'Vin A');
    await enregistrer(page, 'tranquille', '9', 'Vin B');
    await attendreEtat(page, 'ok');
    const avant = await lireJSON(page, 'pv_produits_v2');
    await recalculer(page, 'Vin A');
    await page.fill('#input-nom', 'vin b');
    assert.equal(await texte(page, '#nom-message'), 'Un autre produit porte déjà ce nom. Choisis un autre nom.');
    assert.equal(await page.getAttribute('#input-nom', 'aria-invalid'), 'true');
    assert.equal(await page.isDisabled('#btn-enregistrer'), true);
    await page.press('#input-nom', 'Enter');
    assert.deepEqual(await lireJSON(page, 'pv_produits_v2'), avant);
    // Son propre nom (casse différente) : autorisé, aide D14.
    await page.fill('#input-nom', 'VIN A');
    assert.equal(await texte(page, '#nom-message'), 'Ce produit existe déjà : il sera mis à jour.');
    await page.fill('#input-nom', 'Vin A 2024');
    await page.click('#btn-enregistrer');
    await attendreEtat(page, 'ok');
    assert.deepEqual(script.prive().map(r => r.slice(0, 2)).sort(), [['UCP-0001', 'Vin A 2024'], ['UCP-0002', 'Vin B']]);
    await context.close();
  });

  it('Recalculer un produit au format inconnu : aucun format imposé, enregistrement impossible avant le choix', async () => {
    const produits = [PRODUIT(1, 'Migré', { categorie: '', prixAchat: 12 })];
    const { page, context } = await appareilConnecte(null, { pv_produits_v2: produits });
    await recalculer(page, 'Migré');
    assert.equal(await texte(page, '#format-courant'), 'Choisis un format');
    assert.equal(await page.getAttribute('#format-bouton', 'aria-expanded'), 'true');
    assert.equal(await page.$('#categories input:checked'), null);
    assert.equal(await page.getAttribute('#resultat', 'data-statut'), 'sans-format');
    assert.equal(await page.isDisabled('#btn-enregistrer'), true);
    assert.equal(await texte(page, '#enregistrer-raison'), 'Choisis un format pour enregistrer.');
    await page.click('.cat[data-cat="intermediaire"]');
    await page.waitForTimeout(20);
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(12, 'intermediaire', CONFIG_E2E)));
    await page.click('#btn-enregistrer');
    const [p] = await lireJSON(page, 'pv_produits_v2');
    assert.deepEqual([p.id, p.nom, p.categorie], [1, 'Migré', 'intermediaire']);
    await context.close();
  });

  it('mode modification : produit retiré signalé ; « Nouveau calcul » quitte le mode sans rien enregistrer', async () => {
    const produits = [PRODUIT(1, 'Ancien', { disponibilite: 'retiré' })];
    const { page, context } = await appareilConnecte(null, { pv_produits_v2: produits });
    await recalculer(page, 'Ancien');
    assert.equal(await texte(page, '#modification-info'), 'Ce produit est retiré : l\'enregistrer le remet en vente.');
    await page.click('[data-action="nouveau-calcul"]');
    assert.equal(await page.isHidden('#modification'), true);
    assert.equal(await page.inputValue('#input-nom'), '');
    assert.equal(await texte(page, '#btn-enregistrer'), 'Enregistrer');
    assert.deepEqual(await lireJSON(page, 'pv_produits_v2'), produits);
    await context.close();
  });

  it('mode modification : produit supprimé entre-temps → retour en nouveau calcul, annoncé, rien d\'écrasé', async () => {
    const produits = [PRODUIT(1, 'Éphémère'), PRODUIT(2, 'Autre')];
    const { page, context } = await appareilConnecte(null, { pv_produits_v2: produits });
    await recalculer(page, 'Éphémère');
    // Suppression pendant la modification (autre onglet de l'app).
    await page.evaluate(() => document.querySelector('[data-onglet="list"]').click());
    await page.click('.produit:has(.produit-nom:text-is("Éphémère"))');
    page.once('dialog', d => d.accept());
    await page.click('#modal-delete-btn');
    await page.click('#onglet-calc');
    assert.equal(await page.isHidden('#modification'), true);
    assert.match(await texte(page, '#toast-texte'), /« Éphémère » n'existe plus sur cet appareil/);
    await context.close();
  });
});
