// ===========================
// LISTE PRODUITS ET FICHE PRODUIT (onglet Produits)
// ===========================
// La liste est celle de la feuille (source commune), fusionnée avec ce que
// cet appareil n'a pas encore envoyé. Les produits retirés sont masqués, sauf
// avec le filtre « Retirés ».
import { $ } from './dom.js';
import { toast } from './toast.js';
import { ouvrir, fermer } from './fenetres.js';
import { messageErreur } from './messages.js';
import { detailHtml, ouvrirModification } from './calculateur.js';
import { rafraichir } from './onglets.js';
import { renderConflits } from './conflits.js';
import { CATEGORIES, categorie, cleAffichee } from '../core/categories.js';
import { fmt, esc, normNom } from '../core/format.js';
import { etat, sauverProduits, sauverRetraits } from '../data/etat.js';
import { syncNow } from '../data/synchro.js';

const estRetire = p => p.disponibilite === 'retiré';

export function renderFiltres() {
  const actifs = etat.produits.filter(p => !estRetire(p));
  const retires = etat.produits.length - actifs.length;
  const comptes = {};
  actifs.forEach(p => { const c = cleAffichee(p.categorie); comptes[c] = (comptes[c] || 0) + 1; });
  const cles = [...Object.keys(CATEGORIES), 'inconnue'].filter(c => comptes[c]);
  if (etat.filtreCat === 'retires' ? !retires : (etat.filtreCat !== 'tous' && !comptes[etat.filtreCat])) etat.filtreCat = 'tous';
  const filtreCat = etat.filtreCat;
  const filtres = cles.length < 2 && !retires ? [] : [
    `<button class="filtre" data-action="filtre" data-filtre="tous" aria-pressed="${filtreCat === 'tous'}">Tous<small>${actifs.length}</small></button>`,
    ...(cles.length < 2 ? [] : cles.map(c => `<button class="filtre" data-cat="${c}" data-action="filtre" data-filtre="${c}" aria-pressed="${filtreCat === c}">${esc(categorie(c).court)}<small>${comptes[c]}</small></button>`)),
    ...(retires ? [`<button class="filtre" data-action="filtre" data-filtre="retires" aria-pressed="${filtreCat === 'retires'}">Retirés<small>${retires}</small></button>`] : []),
  ];
  $('filtres').innerHTML = filtres.join('');
}

export function statutProduit(p) {
  if (p.conflit) return '<span class="statut-conflit">⚠ conflit : modifié sur un autre appareil</span>';
  if (p.erreur) return `<span class="statut-refus">⚠ refusé : ${esc(messageErreur(p.erreur))}</span>`;
  if (p.synced === false) return '<span class="statut-attente">en attente d\'envoi</span>';
  if (estRetire(p)) return '<span class="statut-retire">retiré</span>';
  return '';
}

export function renderList() {
  etat.aRedessiner.list = false;
  renderConflits();
  renderFiltres();
  const produits = etat.produits;
  const filtreCat = etat.filtreCat;
  const q = normNom($('search-input').value);
  const filtered = produits.filter(p =>
    (filtreCat === 'retires' ? estRetire(p) : !estRetire(p) && (filtreCat === 'tous' || cleAffichee(p.categorie) === filtreCat)) &&
    (!q || normNom(p.nom).includes(q) || (p.sku && p.sku.toLowerCase().includes(q))));
  const el = $('product-list');
  $('compte').textContent = produits.length ? `${filtered.length} produit${filtered.length > 1 ? 's' : ''}${filtreCat === 'retires' ? ' retiré' + (filtered.length > 1 ? 's' : '') : ''}` : '';

  if (!filtered.length) {
    el.innerHTML = `<div class="vide">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5h4v4.2c0 .9.4 1.7 1.1 2.3 1.2 1 1.9 2.4 1.9 4V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20v-7c0-1.6.7-3 1.9-4 .7-.6 1.1-1.4 1.1-2.3z"/></svg>
      <div>${produits.length ? 'Aucun produit ne correspond' : 'Aucun produit enregistré'}</div></div>`;
    return;
  }

  el.innerHTML = filtered.map(p => {
    const cle = cleAffichee(p.categorie);
    return `<button class="produit${estRetire(p) ? ' retire' : ''}" data-cat="${cle}" data-action="fiche" data-id="${esc(String(p.id))}">
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
  const n = etat.produits.filter(p => p.synced === false || p.conflit).length + etat.retraits.filter(r => r.conflit).length;
  const badge = $('badge-attente');
  badge.hidden = !n;
  badge.textContent = n;
}

// ===========================
// FICHE PRODUIT
// ===========================
export function openModal(id) {
  const p = etat.produits.find(x => String(x.id) === String(id));
  if (!p) return;
  const cle = cleAffichee(p.categorie);
  const fenetre = $('modal').querySelector('.fenetre');
  fenetre.dataset.cat = cle;

  $('modal-title').textContent = p.nom;
  const bouton = $('modal-delete-btn');
  if (estRetire(p)) {
    bouton.textContent = 'Remettre en vente';
    bouton.className = 'btn btn-secondaire';
    bouton.onclick = () => remettreEnVente(p);
  } else {
    bouton.textContent = 'Supprimer';
    bouton.className = 'btn btn-danger';
    bouton.onclick = () => supprimerProduit(p);
  }
  $('modal-modifier').onclick = () => recalculer(p);

  let html = `<div class="sous-titre">${esc(categorie(cle).label)}</div>
    <div class="prix-fiche">${fmt(p.prixTTC)}</div>`;
  if (etat.config && etat.config.categories[cle] && typeof p.prixAchat === 'number') {
    html += detailHtml(p.prixAchat, cle);
  } else {
    html += `<div class="ligne"><span>Prix d'achat HT</span><span>${fmt(p.prixAchat)}</span></div>`;
  }
  html += `<div class="ligne total"><span>Prix TTC</span><span>${fmt(p.prixTTC)}</span></div>`;
  if (p.sku) html += `<div class="ligne" style="margin-top:8px"><span>SKU</span><span>${esc(p.sku)}</span></div>`;
  html += `<div class="ligne"><span>${p.appareil ? 'Modifié le' : 'Enregistré le'}</span><span>${esc(p.date)}${p.appareil ? ' · ' + esc(p.appareil) : ''}</span></div>`;
  const statut = statutProduit(p);
  if (statut) html += `<div class="ligne"><span>Feuille Google</span>${statut}</div>`;

  $('modal-content').innerHTML = html;
  ouvrir('modal');
}

// Recharge le produit dans le calculateur, en mode modification (spec
// Calculer §11) : le produit est mis à jour, même renommé (même SKU).
export function recalculer(p) {
  ouvrirModification(p);
}

// Supprimer dans l'app = « retiré » dans l'onglet Public (rien n'est effacé).
export function supprimerProduit(p) {
  if (!confirm(`Supprimer « ${p.nom} » ?`)) return;
  etat.produits = etat.produits.filter(x => x !== p);
  etat.retraits.push({ sku: p.sku || '', nom: p.nom, version: p.version || 0 });
  sauverProduits();
  sauverRetraits();
  fermer('modal');
  rafraichir();
  toast('Produit supprimé');
  syncNow();
}

// Produit retiré : réenregistré tel quel, il redevient disponible (même SKU).
export function remettreEnVente(p) {
  p.synced = false;
  p.rev = (p.rev || 0) + 1;
  delete p.erreur;
  sauverProduits();
  fermer('modal');
  rafraichir();
  toast(`${p.nom} va être remis en vente`);
  syncNow();
}
