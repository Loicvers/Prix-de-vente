// ===========================
// ÉTAT DE L'APP
// ===========================
// Un seul objet partagé par tous les modules (lu au démarrage depuis le
// stockage de l'appareil).
import { stockage } from './stockage.js';
import { cleValide } from '../core/categories.js';
import { configValide } from '../core/calcul.js';

export const HISTORIQUE_MAX = 300;

export const etat = {
  currentCat: cleValide(stockage.lire('pv_categorie', 'tranquille')),
  filtreCat: 'tous',
  produits: stockage.json('pv_produits_v2', []),
  historique: stockage.json('pv_historique', []),
  retraits: stockage.json('pv_retraits', []),   // produits supprimés à retirer côté feuille
  config: stockage.json('pv_config', null),
  ongletActif: 'calc',
  aRedessiner: { list: true, history: true },
};
if (!configValide(etat.config)) etat.config = null;

export function sauverProduits() { stockage.ecrire('pv_produits_v2', JSON.stringify(etat.produits)); etat.aRedessiner.list = true; }
export function sauverHistorique() {
  if (etat.historique.length > HISTORIQUE_MAX) etat.historique.length = HISTORIQUE_MAX;
  stockage.ecrire('pv_historique', JSON.stringify(etat.historique));
  etat.aRedessiner.history = true;
}
export function sauverRetraits() { stockage.ecrire('pv_retraits', JSON.stringify(etat.retraits)); }
