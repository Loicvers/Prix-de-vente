// ===========================
// CONFLITS (en tête de l'onglet Produits)
// ===========================
// Un conflit : ce produit a changé dans la feuille (depuis un autre appareil)
// après que cet appareil l'a modifié ou supprimé. Rien n'a été écrasé ; les
// deux versions sont montrées et l'utilisateur choisit. Le conflit est aussi
// inscrit dans l'onglet Journal de la feuille.
import { $ } from './dom.js';
import { toast } from './toast.js';
import { rafraichir } from './onglets.js';
import { categorie, cleAffichee } from '../core/categories.js';
import { fmt, esc } from '../core/format.js';
import { etat, sauverProduits, sauverRetraits } from '../data/etat.js';
import { depuisServeur, dateCourte } from '../data/fusion.js';
import { syncNow } from '../data/synchro.js';

function resume(x) {
  if (!x) return '—';
  const parties = [categorie(x.categorie).label, 'achat ' + fmt(x.prixAchat), fmt(x.prixTTC) + ' TTC'];
  if (x.disponibilite === 'retiré') parties.push('retiré');
  return parties.join(' · ');
}

function origine(actuel) {
  const qui = actuel.appareil ? ` (${esc(actuel.appareil)}${actuel.dateMaj ? ', le ' + esc(dateCourte(actuel.dateMaj)) : ''})` :
    (actuel.dateMaj ? ` (le ${esc(dateCourte(actuel.dateMaj))})` : '');
  return 'sur un autre appareil' + qui;
}

export function renderConflits() {
  const el = $('conflits');
  const produits = etat.produits.filter(p => p.conflit);
  const retraits = etat.retraits.filter(r => r.conflit);
  if (!produits.length && !retraits.length) { el.innerHTML = ''; return; }

  const cartes = produits.map(p => {
    const a = p.conflit.actuel;
    const texte = a.disponibilite === 'retiré'
      ? `Ce produit a été <strong>retiré</strong> ${origine(a)} pendant que tu le modifiais ici.`
      : `Ce produit a été modifié ${origine(a)} pendant que tu le modifiais ici.`;
    return `<div class="carte conflit" data-cat="${cleAffichee(p.categorie)}" role="group" aria-label="Conflit : ${esc(p.nom)}">
      <div class="conflit-titre">⚠ Conflit détecté · ${esc(p.nom)}</div>
      <p>${texte} Rien n'a été écrasé : choisis la version à garder.</p>
      <div class="conflit-versions">
        <div><strong>Ta version</strong><span>${esc(resume(p))}</span></div>
        <div><strong>Version de la feuille</strong><span>${esc(resume(a))}</span></div>
      </div>
      <div class="actions">
        <button class="btn btn-secondaire" data-action="conflit-feuille" data-id="${esc(String(p.id))}">Garder celle de la feuille</button>
        <button class="btn btn-principal" data-action="conflit-mien" data-id="${esc(String(p.id))}">Garder ma version</button>
      </div>
    </div>`;
  });
  cartes.push(...retraits.map(r => {
    const a = r.conflit.actuel;
    return `<div class="carte conflit" data-cat="${cleAffichee(a.categorie)}" role="group" aria-label="Conflit : ${esc(r.nom)}">
      <div class="conflit-titre">⚠ Conflit détecté · ${esc(a.nom || r.nom)}</div>
      <p>Tu as supprimé ce produit, mais il a été modifié ${origine(a)} entre-temps. Il n'a pas été retiré.</p>
      <div class="conflit-versions">
        <div><strong>Ta demande</strong><span>Retirer le produit</span></div>
        <div><strong>Version de la feuille</strong><span>${esc(resume(a))}</span></div>
      </div>
      <div class="actions">
        <button class="btn btn-secondaire" data-action="retrait-garder" data-sku="${esc(r.sku)}">Garder le produit</button>
        <button class="btn btn-danger" data-action="retrait-confirmer" data-sku="${esc(r.sku)}">Retirer quand même</button>
      </div>
    </div>`;
  }));
  el.innerHTML = `<div class="carte-titre">Conflits à résoudre</div>` + cartes.join('');
}

function terminer(message) {
  sauverProduits();
  sauverRetraits();
  rafraichir();
  toast(message);
  syncNow();
}

// Ma version : renvoyée en indiquant la version de la feuille qu'on a vue.
export function garderMaVersion(id) {
  const p = etat.produits.find(x => String(x.id) === id && x.conflit);
  if (!p) return;
  p.version = p.conflit.actuel.version;
  delete p.conflit;
  p.synced = false;
  p.rev = (p.rev || 0) + 1;
  terminer('Ta version va être envoyée');
}

// Version de la feuille : remplace la version de l'appareil.
export function garderVersionFeuille(id) {
  const i = etat.produits.findIndex(x => String(x.id) === id && x.conflit);
  if (i < 0) return;
  etat.produits[i] = depuisServeur(etat.produits[i].conflit.actuel, etat.produits[i]);
  terminer('Version de la feuille gardée');
}

export function confirmerRetrait(sku) {
  const r = etat.retraits.find(x => x.sku === sku && x.conflit);
  if (!r) return;
  r.version = r.conflit.actuel.version;
  delete r.conflit;
  terminer('Le produit va être retiré');
}

export function annulerRetrait(sku) {
  const r = etat.retraits.find(x => x.sku === sku && x.conflit);
  if (!r) return;
  etat.retraits = etat.retraits.filter(x => x !== r);
  if (!etat.produits.some(p => p.sku === sku)) etat.produits.unshift(depuisServeur(r.conflit.actuel, null));
  terminer('Produit gardé');
}
