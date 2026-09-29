// État de référence : calcul du prix dans l'app (formats, saisie, détail).
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Calcul = require('../../app/src/core/calcul.js');
const { lancer, ouvrir, fauxScript, connecte, calculer, choisirFormat, texte, prixAffiche, CONFIG_E2E } = require('./outils');

let app;
before(async () => { app = await lancer(); });
after(async () => { await app.fermer(); });

const CATEGORIES = Object.keys(CONFIG_E2E.categories);
const ACHATS = ['0,5', '8', '10', '12,34', '29,99', '30', '57,8', '250'];

describe('calcul', () => {
  // V2 (spec Calculer §6, §8.2) : libellé V2 de la table unique ; le prix
  // n'est plus coloré selon le format (plus de data-cat sur le résultat).
  it('les 10 formats donnent le prix de calcul.js, avec leur libellé V2', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    const libelles = Object.fromEntries(Object.entries(require('../../app/src/core/categories.js').CATEGORIES).map(([k, v]) => [k, v.libelle]));
    assert.deepEqual(Object.keys(libelles).sort(), CATEGORIES.slice().sort());
    for (const cat of CATEGORIES) {
      for (const achat of ACHATS) {
        await calculer(page, cat, achat);
        const attendu = Calcul.prixTTC(Number(achat.replace(',', '.')), cat, CONFIG_E2E);
        assert.equal(await texte(page, '#resultat-prix'), prixAffiche(attendu), `${cat} ${achat}`);
        assert.equal(await texte(page, '#resultat-cat'), libelles[cat]);
        assert.equal(await texte(page, '#format-courant'), libelles[cat]);
        assert.equal(await page.getAttribute('#resultat', 'data-cat'), null);
        assert.equal(await page.getAttribute('#resultat', 'data-statut'), 'valide');
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
    // D9 : sur mobile (390 px), replié par défaut ; le choix de
    // l'utilisateur est mémorisé (« ouvert » / « ferme »).
    assert.equal(await page.$eval('#detail', d => d.open), false);
    await page.click('#detail summary');
    await page.waitForFunction(() => localStorage.getItem('pv_detail') === 'ouvert');
    await page.reload();
    assert.equal(await page.$eval('#detail', d => d.open), true);
    await calculer(page, 'tranquille', '40');       // détail affiché avec un résultat valide
    await page.click('#detail summary');
    await page.waitForFunction(() => localStorage.getItem('pv_detail') === 'ferme');
    await page.reload();
    assert.equal(await page.$eval('#detail', d => d.open), false);
    await context.close();
  });

  it('D9 : détail ouvert par défaut à partir de 900 px ; valeurs héritées « 1 » (sans choix) et « 0 » (replié)', async () => {
    const cas = [
      [{ width: 1024, height: 768 }, undefined, true],
      [{ width: 899, height: 800 }, undefined, false],
      [{ width: 768, height: 1024 }, undefined, false],   // tablette : replié (seuil 900 px)
      [{ width: 390, height: 844 }, '1', false],      // « 1 » : écrit par l'ancienne app à chaque démarrage
      [{ width: 1440, height: 900 }, '1', true],
      [{ width: 1440, height: 900 }, '0', false],     // « 0 » : l'utilisateur avait replié
      [{ width: 390, height: 844 }, 'ouvert', true],
    ];
    for (const [viewport, valeur, attendu] of cas) {
      const stockage = connecte(valeur === undefined ? {} : { pv_detail: valeur });
      const { page, context } = await app.appareil(null, { stockage, viewport });
      await ouvrir(app, page, { connecter: false });
      assert.equal(await page.$eval('#detail', d => d.open), attendu, `${viewport.width} px, pv_detail=${valeur}`);
      // L'état initial n'écrit aucune préférence.
      assert.equal(await page.evaluate(() => localStorage.getItem('pv_detail')), valeur === undefined ? null : valeur);
      await context.close();
    }
  });

  // V2 (spec Calculer §7.3, §12) : l'étiquette reste affichée avec un état
  // explicite (« — », jamais l'ancien montant) et un message sous le champ.
  // « 12,5abc » n'est plus lu 12,5 (caractères parasites refusés).
  it('saisie du prix : virgule, point, symbole €, espaces ; valeurs invalides : état explicite et message', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    const attendu = prixAffiche(Calcul.prixTTC(12.5, 'tranquille', CONFIG_E2E));
    for (const saisie of ['12,5', '12.5', '12,50 €', ' 12,50 ']) {
      await calculer(page, 'tranquille', saisie);
      assert.equal(await texte(page, '#resultat-prix'), attendu, saisie);
      assert.equal(await page.getAttribute('#input-prix', 'aria-invalid'), null);
    }
    const cas = [
      ['', 'vide', null, 'Saisis un prix d\'achat'],
      ['abc', 'invalide', 'Montant illisible : écris par exemple 12,50', 'Prix indisponible : corrige le prix d\'achat'],
      ['12,5abc', 'invalide', 'Montant illisible : écris par exemple 12,50', null],
      [',', 'invalide', 'Montant illisible : écris par exemple 12,50', null],
      ['0', 'invalide', 'Le prix d\'achat doit être supérieur à 0', null],
      ['0,00', 'invalide', 'Le prix d\'achat doit être supérieur à 0', null],
      ['-3', 'invalide', 'Le prix d\'achat doit être supérieur à 0', null],
    ];
    for (const [saisie, statut, message, etat] of cas) {
      await calculer(page, 'tranquille', '10');       // un résultat valide d'abord…
      await calculer(page, 'tranquille', saisie);     // …qui ne doit pas rester affiché
      assert.equal(await page.getAttribute('#resultat', 'data-statut'), statut, saisie);
      assert.equal(await texte(page, '#resultat-prix'), '—', saisie);
      assert.equal(await page.isHidden('#detail'), true, saisie);
      if (message) {
        assert.equal(await texte(page, '#prix-message'), message, saisie);
        assert.equal(await page.getAttribute('#input-prix', 'aria-invalid'), 'true');
      } else {
        assert.equal(await page.isHidden('#prix-message'), true, saisie);
      }
      if (etat) assert.equal(await texte(page, '#resultat-etat'), etat);
      assert.equal(await page.isDisabled('#btn-enregistrer'), true, saisie);
      assert.equal(await page.inputValue('#input-prix'), saisie, 'la saisie n\'est jamais effacée');
    }
    await context.close();
  });

  it('B-01 CORRIGÉ (D5) : « 1.234,56 » est lu 1234,56 ; « 1.234.567 » est refusé (D11)', async () => {
    const { page, context } = await app.appareil(null, { stockage: connecte() });
    await ouvrir(app, page, { connecter: false });
    await calculer(page, 'tranquille', '1.234,56');
    assert.equal(await texte(page, '#resultat-prix'), prixAffiche(Calcul.prixTTC(1234.56, 'tranquille', CONFIG_E2E)));
    await calculer(page, 'tranquille', '1.234.567');
    assert.equal(await page.getAttribute('#resultat', 'data-statut'), 'invalide');
    // Un seul point, sans virgule : toujours décimal (compatibilité).
    await calculer(page, 'tranquille', '1.234');
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
    assert.equal(await page.getAttribute('#resultat', 'data-statut'), 'format-manquant');
    assert.equal(await texte(page, '#resultat-prix'), '—');
    assert.match(await texte(page, '#cat-manquante'), /Connecte-toi une première fois avec ton PIN.*Magnum pétillant · 1,5 l.*magnum_mousseux/);
    assert.equal(await page.isDisabled('#btn-enregistrer'), true);
    assert.match(await texte(page, '#enregistrer-raison'), /frais de ce format ne sont pas chargés/);
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
    assert.equal(await page.getAttribute('#resultat', 'data-statut'), 'sans-config');
    assert.equal(await texte(page, '#resultat-prix'), '—');
    // Enregistrer rouvre l'écran PIN au lieu d'enregistrer.
    await page.fill('#input-nom', 'Sans config');
    await page.click('#btn-enregistrer');
    assert.equal(await page.isVisible('#pin-modal.ouvert'), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('pv_produits_v2')), null);
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
    await choisirFormat(page, '3l_mousseux');
    await page.reload();
    assert.equal(await page.isChecked('.cat[data-cat="3l_mousseux"] input'), true);
    assert.equal(await texte(page, '#format-courant'), 'Jéroboam pétillant · 3 l');
    await page.evaluate(() => localStorage.setItem('pv_categorie', 'inconnue'));
    await page.reload();
    assert.equal(await page.isChecked('.cat[data-cat="tranquille"] input'), true);
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
    // Complément déjà dans le libellé V2 : pas répété.
    assert.equal(await texte(page, '.cat[data-cat="demie"] .cat-info'), `+${prixAffiche(2)} de frais`);
    // D12 : sélecteur fermé, aucun frais affiché.
    assert.equal(await page.isHidden('#categories'), true);
    assert.equal(await texte(page, '#format-bouton'), 'Tranquille · 75 cl');
    await context.close();
  });
});
