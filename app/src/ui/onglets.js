// ===========================
// ONGLETS
// ===========================
import { renderList, afficherBadge } from './produits.js';
import { renderHistory } from './historique.js';
import { rafraichirCalculateur } from './calculateur.js';
import { etat } from '../data/etat.js';

// Redessine les pages visibles seulement ; les autres le seront à l'ouverture.
export function rafraichir() {
  if (etat.ongletActif === 'list' && etat.aRedessiner.list) renderList();
  if (etat.ongletActif === 'history' && etat.aRedessiner.history) renderHistory();
  if (etat.ongletActif === 'calc') rafraichirCalculateur();
  afficherBadge();
}

export function switchTab(name) {
  etat.ongletActif = name;
  document.querySelectorAll('.onglet').forEach(t => t.setAttribute('aria-selected', String(t.dataset.onglet === name)));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  rafraichir();
  window.scrollTo(0, 0);
}
