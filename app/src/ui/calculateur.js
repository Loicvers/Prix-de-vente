// ===========================
// CALCULATEUR (onglet Calculer)
// ===========================
import { $ } from './dom.js';
import { toast } from './toast.js';
import { ouvrirPin } from './pin.js';
import { afficherBadge } from './produits.js';
import { switchTab } from './onglets.js';
import { CATEGORIES, GROUPES, categorie, cleValide } from '../core/categories.js';
import { fmt, fmtCoef, esc, normNom, lireMontant } from '../core/format.js';
import Calcul from '../core/calcul.js';
import { etat, sauverProduits, sauverHistorique, sauverRetraits } from '../data/etat.js';
import { stockage } from '../data/stockage.js';
import { syncNow } from '../data/synchro.js';

export function renderCategories() {
  const config = etat.config;
  $('categories').innerHTML = GROUPES.map(([titre, cles]) => `
    <div class="groupe">
      <div class="groupe-titre">${esc(titre)}</div>
      <div class="cats">${cles.map(cle => {
        const cat = CATEGORIES[cle];
        const conf = config && config.categories[cle];
        const info = conf ? '+' + fmt(conf.frais) + ' de frais' + (cat.info ? ' · ' + cat.info : '')
          : (config ? 'frais à charger' + (cat.info ? ' · ' + cat.info : '') : (cat.info || ''));
        return `<button type="button" class="cat" data-cat="${cle}" data-action="categorie" aria-pressed="${cle === etat.currentCat}">
          <span class="cat-nom">${esc(cat.nom)}</span>
          <span class="cat-info${config && !conf ? ' manque' : ''}">${esc(info)}</span>
        </button>`;
      }).join('')}</div>
    </div>`).join('');
}

export function selectCat(cle) {
  etat.currentCat = cleValide(cle);
  stockage.ecrire('pv_categorie', etat.currentCat);
  document.querySelectorAll('.cat').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === etat.currentCat)));
  calculer();
}

export function afficherConfig() {
  $('config-manquante').hidden = !!etat.config;
  renderCategories();
  calculer();
  etat.aRedessiner.list = true;
}

// ===========================
// CALCUL
// ===========================
export function detailHtml(prixAchat, cle) {
  const config = etat.config;
  const frais = Calcul.frais(cle, config);
  const base = prixAchat + frais;
  const conf = config.categories[cle];
  let html = '';
  html += `<div class="ligne"><span>Prix d'achat HT</span><span>${fmt(prixAchat)}</span></div>`;
  html += `<div class="ligne"><span>Frais fixes${conf.detail ? ' (' + esc(conf.detail) + ')' : ''}</span><span>+ ${fmt(frais)}</span></div>`;
  html += `<div class="ligne"><span>Base de calcul</span><span>${fmt(base)}</span></div>`;
  Calcul.detailTranches(base, config).forEach(t => {
    html += `<div class="ligne"><span>${fmt(t.debut)} → ${fmt(t.fin)} × ${fmtCoef(t.coef)}</span><span>${fmt(t.montant)}</span></div>`;
  });
  return html;
}

export function calculer() {
  const config = etat.config;
  const currentCat = etat.currentCat;
  const val = lireMontant($('input-prix').value);
  const zone = $('resultat');
  const manque = $('cat-manquante');
  const conf = config && config.categories[currentCat];
  manque.hidden = !config || !!conf;
  if (config && !conf) {
    // Cache d'avant l'ajout de la catégorie : une connexion recharge la config.
    manque.innerHTML = `<strong>Connecte-toi une première fois avec ton PIN</strong> pour charger les frais de la catégorie ` +
      `${esc(categorie(currentCat).label)}. <button data-action="pin">Entrer mon PIN</button><br/>` +
      `<small>Si ce message reste après connexion : ajoute <code>${esc(currentCat)}</code> dans la propriété CONFIG du script (INSTALL.md, « Ajouter une catégorie »).</small>`;
  }
  if (!conf || isNaN(val)) { zone.hidden = true; return; }

  const prixTTC = Calcul.prixTTC(val, currentCat, config);
  zone.hidden = false;
  zone.dataset.cat = currentCat;
  $('resultat-cat').textContent = categorie(currentCat).label;
  $('resultat-prix').textContent = fmt(prixTTC);
  $('resultat-detail').innerHTML = detailHtml(val, currentCat) +
    `<div class="ligne total"><span>Prix de vente TTC</span><span>${fmt(prixTTC)}</span></div>`;
}

// ===========================
// SAUVEGARDER
// ===========================
export function sauvegarder() {
  const config = etat.config;
  const currentCat = etat.currentCat;
  const champNom = $('input-nom');
  const nom = champNom.value.trim();
  const prixAchat = lireMontant($('input-prix').value);
  if (!config) { ouvrirPin('Connecte-toi une première fois avec ton PIN'); return; }
  if (!config.categories[currentCat]) { toast('Frais de cette catégorie absents de la config'); return; }
  if (isNaN(prixAchat)) { $('input-prix').focus(); return; }
  if (!nom) { toast('Donne un nom au produit'); champNom.focus(); return; }

  const prixTTC = Calcul.prixTTC(prixAchat, currentCat, config);
  const date = new Date().toLocaleDateString('fr-BE');

  // Même nom = même produit : on met à jour sa fiche (et on garde son SKU).
  let prod = etat.produits.find(p => normNom(p.nom) === normNom(nom));
  if (prod) {
    etat.produits = etat.produits.filter(p => p !== prod);
    Object.assign(prod, { nom, categorie: currentCat, prixAchat, prixTTC, date });
  } else {
    prod = { id: Date.now(), sku: '', nom, categorie: currentCat, prixAchat, prixTTC, date };
  }
  prod.synced = false;
  delete prod.erreur;
  prod.rev = (prod.rev || 0) + 1;
  etat.produits.unshift(prod);
  etat.historique.unshift({ id: prod.id, nom, categorie: currentCat, prixAchat, prixTTC, date });
  // Réenregistré après une suppression pas encore envoyée : on annule le retrait.
  etat.retraits = etat.retraits.filter(r => normNom(r.nom) !== normNom(nom) && !(prod.sku && r.sku === prod.sku));
  sauverProduits();
  sauverHistorique();
  sauverRetraits();

  champNom.value = '';
  champNom.blur();
  toast(`${nom} enregistré · ${fmt(prixTTC)}`, 'Voir', () => switchTab('list'));
  afficherBadge();
  syncNow();
}
