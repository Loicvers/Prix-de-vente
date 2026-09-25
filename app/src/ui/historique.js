// ===========================
// HISTORIQUE (onglet Historique : derniers calculs de cet appareil)
// ===========================
import { $ } from './dom.js';
import { categorie, cleValide } from '../core/categories.js';
import { fmt, esc } from '../core/format.js';
import { etat } from '../data/etat.js';

export function renderHistory() {
  etat.aRedessiner.history = false;
  const el = $('history-list');
  if (!etat.historique.length) {
    el.innerHTML = '<div class="vide">Aucun historique</div>';
    return;
  }
  el.innerHTML = etat.historique.slice(0, 100).map(p => {
    const cle = cleValide(p.categorie);
    return `<div class="histo" data-cat="${cle}">
      <div class="histo-nom">${esc(p.nom)}</div>
      <div class="histo-prix">${fmt(p.prixTTC)}</div>
      <div class="histo-meta">${esc(categorie(cle).label)} · achat ${fmt(p.prixAchat)} · ${esc(p.date)}</div>
    </div>`;
  }).join('');
}
