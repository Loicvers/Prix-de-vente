// État de référence : calcul du prix dans l'app (formats, saisie, détail).
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Calcul = require('../../calcul.js');
const { lancer, ouvrir, fauxScript, connecte, calculer, texte, prixAffiche, CONFIG_E2E } = require('./outils');

let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

const CATEGORIES = Object.keys(CONFIG_E2E.categories);
const ACHATS = ['0,5', '8', '10', '12,34', '29,99', '30', '57,8', '250'];

describe('calcul', () => {
  it('les 10 formats donnent le prix de calcul.js, avec leur libellé', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    const libelles = await page.evaluate(() => Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])));
    assert.deepEqual(Object.keys(libelles).sort(), CATEGORIES.slice().sort());
    for (const cat of CATEGORIES) {
      for (const achat of ACHATS) {
        await calculer(page, cat, achat);
        const attendu = Calcul.prixTTC(Number(achat.replace(',', '.')), cat, CONFIG_E2E);
        assert.equal(await texte(page, '#resultat-prix'), prixAffiche(attendu), `${cat} ${achat}`);
        assert.equal(await texte(page, '#resultat-cat'), libelles[cat]);
        assert.equal(await page.getAttribute('#resultat', 'data-cat'), cat);
      }
    }
    assert.deepEqual(page.erreurs, []);
    await context.close();
  });

  it('valeurs de contrôle écrites en dur (tranches cumulées et arrondi)', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    // base 8+3=11 → 10×2 + 1×1,5 = 21,5
    await calculer(page, 'tranquille', '8');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(21.5));
    // base 57,8+4=61,8 → 20 + 30 + 31,8×1,25 = 89,75 → 89,8
    await calculer(page, 'mousseux', '57,8');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(89.8));
    await context.close();
  });

  it('détail du calcul : achat, frais (avec leur texte), base, une ligne par tranche, total', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await calculer(page, 'tranquille', '40');
    const lignes = await page.$$eval('#resultat-detail .ligne', ls => ls.map(l => [...l.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' | ')));
    assert.deepEqual(lignes, [
      `Prix d'achat HT | ${prixAffiche(40)}`,
      `Frais fixes (bouchon et étiquette) | + ${prixAffiche(3)}`,
      `Base de calcul | ${prixAffiche(43)}`,
      `${prixAffiche(0)} → ${prixAffiche(10)} × 2,000 | ${prixAffiche(20)}`,
      `${prixAffiche(10)} → ${prixAffiche(30)} × 1,500 | ${prixAffiche(30)}`,
      `${prixAffiche(30)} → ${prixAffiche(43)} × 1,250 | ${prixAffiche(16.25)}`,
      `Prix de vente TTC | ${prixAffiche(66.3)}`,
    ]);
    // Ouvert par défaut ; état mémorisé.
    assert.equal(await page.$eval('#detail', d => d.open), true);
    await page.click('#detail summary');
    await page.waitForFunction(() => localStorage.getItem('pv_detail') === '0');
    await page.reload();
    assert.equal(await page.$eval('#detail', d => d.open), false);
    await context.close();
  });

  it('saisie du prix : virgule, point, symbole €, espaces ; valeurs invalides masquent le résultat', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    const attendu = prixAffiche(Calcul.prixTTC(12.5, 'tranquille', CONFIG_E2E));
    for (const saisie of ['12,5', '12.5', '12,50 €', ' 12,50 ', '12,5abc']) {
      await calculer(page, 'tranquille', saisie);
      assert.equal(await texte(page, '#resultat-prix'), attendu, saisie);
    }
    for (const saisie of ['', 'abc', '0', '-3', '0,00', ',']) {
      await calculer(page, 'tranquille', saisie);
      assert.equal(await page.isHidden('#resultat'), true, `« ${saisie} » devrait masquer le résultat`);
    }
    await context.close();
  });

  it('BUG CONNU B-01 : « 1.234,56 » est lu 1,234 (séparateur de milliers)', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await calculer(page, 'tranquille', '1.234,56');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(1.234, 'tranquille', CONFIG_E2E)));
    // « 1 234,56 » (espace) est bien lu 1234,56.
    await calculer(page, 'tranquille', '1 234,56');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(1234.56, 'tranquille', CONFIG_E2E)));
    await context.close();
  });

  it('catégorie absente de la config : « frais à charger », message PIN, aucun prix, enregistrement refusé', async () => {
    const config = JSON.parse(JSON.stringify(CONFIG_E2E));
    delete config.categories.magnum_mousseux;
    const script = fauxScript({ config });
    const { page, context } = await app.appareil(script, { stockage: connecte({ pv_config: config }) });
    await ouvrir(app, page, { connecter: false });
    assert.match(await texte(page, '.cat[data-cat="magnum_mousseux"] .cat-info'), /^frais à charger$/);
    await calculer(page, 'magnum_mousseux', '20');
    assert.equal(await page.isHidden('#resultat'), true);
    assert.match(await texte(page, '#cat-manquante'), /Connecte-toi une première fois avec ton PIN.*Magnum pétillant \(1,5 l\).*magnum_mousseux/);
    await context.close();
  });

  it('sans config (jamais connecté) : alerte PIN, aucun prix, écran PIN ouvert', async () => {
    const { page, context } = await app.appareil(null);
    await ouvrir(app, page, { connecter: false });
    assert.equal(await page.isVisible('#config-manquante'), true);
    assert.equal(await page.isVisible('#pin-modal.ouvert'), true);
    assert.equal(await page.isVisible('#pin-url-zone'), true);
    await page.click('[data-action="fermer-pin"]');
    await calculer(page, 'tranquille', '10');
    assert.equal(await page.isHidden('#resultat'), true);
    await context.close();
  });

  it('config en cache invalide : ignorée comme s\'il n\'y en avait pas', async () => {
    const { page, context } = await app.appareil(null, { stockage: { pv_config: { categories: {}, tranches: [], arrondi: 0 } } });
    await ouvrir(app, page, { connecter: false });
    assert.equal(await page.isVisible('#config-manquante'), true);
    await context.close();
  });

  it('la catégorie choisie est mémorisée ; une catégorie inconnue en mémoire revient à « tranquille »', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await page.click('.cat[data-cat="3l_mousseux"]');
    await page.reload();
    assert.equal(await page.getAttribute('.cat[data-cat="3l_mousseux"]', 'aria-pressed'), 'true');
    await page.evaluate(() => localStorage.setItem('pv_categorie', 'inconnue'));
    await page.reload();
    assert.equal(await page.getAttribute('.cat[data-cat="tranquille"]', 'aria-pressed'), 'true');
    await context.close();
  });

  it('libellés des boutons de format (groupes et infos de frais)', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    const groupes = await page.$$eval('.groupe', gs => gs.map(g => [g.querySelector('.groupe-titre').textContent,
      [...g.querySelectorAll('.cat')].map(c => c.dataset.cat)]));
    assert.deepEqual(groupes, [
      ['Bouteille 75 cl', ['tranquille', 'mousseux']],
      ['Magnum 1,5 l', ['magnum_tranquille', 'magnum_mousseux']],
      ['3 litres', ['3l_tranquille', '3l_mousseux']],
      ['4,5 et 5 litres', ['4_5l_tranquille', '5l_tranquille']],
      ['Autres formats', ['demie', 'intermediaire']],
    ]);
    assert.equal(await texte(page, '.cat[data-cat="intermediaire"] .cat-info'), `+${prixAffiche(5)} de frais · Maury, Porto, VDN…`);
    await context.close();
  });
});
