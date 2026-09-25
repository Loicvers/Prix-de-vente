// ===========================
// LISTE PRODUITS ET FICHE PRODUIT (onglet Produits)
// ===========================
import { $ } from './dom.js';
import { toast } from './toast.js';
import { ouvrir, fermer } from './fenetres.js';
import { messageErreur } from './messages.js';
import { selectCat, calculer, detailHtml } from './calculateur.js';
import { switchTab, rafraichir } from './onglets.js';
import { CATEGORIES, categorie, cleValide } from '../core/categories.js';
import { fmt, esc, normNom } from '../core/format.js';
import { etat, sauverProduits, sauverRetraits } from '../data/etat.js';
import { syncNow } from '../data/synchro.js';

export function renderFiltres() {
  const produits = etat.produits;
  const comptes = {};
  produits.forEach(p => { const c = cleValide(p.categorie); comptes[c] = (comptes[c] || 0) + 1; });
  const cles = Object.keys(CATEGORIES).filter(c => comptes[c]);
  if (etat.filtreCat !== 'tous' && !comptes[etat.filtreCat]) etat.filtreCat = 'tous';
  const filtreCat = etat.filtreCat;
  $('filtres').innerHTML = cles.length < 2 ? '' :
    `<button class="filtre" data-action="filtre" data-filtre="tous" aria-pressed="${filtreCat === 'tous'}">Tous<small>${produits.length}</small></button>` +
    cles.map(c => `<button class="filtre" data-cat="${c}" data-action="filtre" data-filtre="${c}" aria-pressed="${filtreCat === c}">${esc(categorie(c).court)}<small>${comptes[c]}</small></button>`).join('');
}

export function statutProduit(p) {
  if (p.erreur) return `<span class="statut-refus">⚠ refusé : ${esc(messageErreur(p.erreur))}</span>`;
  if (p.synced === false) return '<span class="statut-attente">en attente d\'envoi</span>';
  return '';
}

export function renderList() {
  etat.aRedessiner.list = false;
  renderFiltres();
  const produits = etat.produits;
  const filtreCat = etat.filtreCat;
  const q = normNom($('search-input').value);
  const filtered = produits.filter(p =>
    (filtreCat === 'tous' || cleValide(p.categorie) === filtreCat) &&
    (!q || normNom(p.nom).includes(q) || (p.sku && p.sku.toLowerCase().includes(q))));
  const el = $('product-list');
  $('compte').textContent = produits.length ? `${filtered.length} produit${filtered.length > 1 ? 's' : ''}` : '';

  if (!filtered.length) {
    el.innerHTML = `<div class="vide">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5h4v4.2c0 .9.4 1.7 1.1 2.3 1.2 1 1.9 2.4 1.9 4V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20v-7c0-1.6.7-3 1.9-4 .7-.6 1.1-1.4 1.1-2.3z"/></svg>
      <div>${produits.length ? 'Aucun produit ne correspond' : 'Aucun produit enregistré'}</div></div>`;
    return;
  }

  el.innerHTML = filtered.map(p => {
    const cle = cleValide(p.categorie);
    return `<button class="produit" data-cat="${cle}" data-action="fiche" data-id="${Number(p.id)}">
      <div class="produit-corps">
        <div class="produit-nom">${esc(p.nom)}</div>
        <div class="produit-meta">
          <span class="etiquette">${esc(categorie(cle).label)}</span>
          <span>Achat ${fmt(p.prixAchat)}</span>
          ${p.sku ? `<span>${esc(p.sku)}</span>` : ''}
          ${statutProduit(p)}
        </div>
      </div>
      <div class="produit-prix">${fmt(p.prixTTC)}</div>
    </button>`;
  }).join('');
}

export function afficherBadge() {
  const n = etat.produits.filter(p => p.synced === false).length;
  const badge = $('badge-attente');
  badge.hidden = !n;
  badge.textContent = n;
}

// ===========================
// FICHE PRODUIT
// ===========================
export function openModal(id) {
  const p = etat.produits.find(x => Number(x.id) === id);
  if (!p) return;
  const cle = cleValide(p.categorie);
  const fenetre = $('modal').querySelector('.fenetre');
  fenetre.dataset.cat = cle;

  $('modal-title').textContent = p.nom;
  $('modal-delete-btn').onclick = () => supprimerProduit(p);
  $('modal-modifier').onclick = () => recalculer(p);

  let html = `<div class="sous-titre">${esc(categorie(cle).label)}</div>
    <div class="prix-fiche">${fmt(p.prixTTC)}</div>`;
  if (etat.config && etat.config.categories[cle]) {
    html += detailHtml(p.prixAchat, cle);
  } else {
    html += `<div class="ligne"><span>Prix d'achat HT</span><span>${fmt(p.prixAchat)}</span></div>`;
  }
  html += `<div class="ligne total"><span>Prix TTC</span><span>${fmt(p.prixTTC)}</span></div>`;
  if (p.sku) html += `<div class="ligne" style="margin-top:8px"><span>SKU</span><span>${esc(p.sku)}</span></div>`;
  html += `<div class="ligne"><span>Enregistré le</span><span>${esc(p.date)}</span></div>`;
  const statut = statutProduit(p);
  if (statut) html += `<div class="ligne"><span>Feuille Google</span>${statut}</div>`;

  $('modal-content').innerHTML = html;
  ouvrir('modal');
}

// Recharge le produit dans le calculateur (même nom = même SKU à l'enregistrement).
export function recalculer(p) {
  fermer('modal');
  selectCat(p.categorie);
  $('input-prix').value = String(p.prixAchat).replace('.', ',');
  $('input-nom').value = p.nom;
  calculer();
  switchTab('calc');
  $('input-prix').focus();
}

// Supprimer dans l'app = « retiré » dans l'onglet Public (rien n'est effacé).
export function supprimerProduit(p) {
  if (!confirm(`Supprimer « ${p.nom} » ?`)) return;
  etat.produits = etat.produits.filter(x => x !== p);
  etat.retraits.push({ sku: p.sku || '', nom: p.nom });
  sauverProduits();
  sauverRetraits();
  fermer('modal');
  rafraichir();
  toast('Produit supprimé');
  syncNow();
}
