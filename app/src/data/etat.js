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
  // Nom de cet appareil (« Comptoir »…), inscrit dans la feuille et le Journal.
  appareil: stockage.lire('pv_appareil', ''),
  ongletActif: 'calc',
  // Calculer en mode modification (parcours « Recalculer ») : produit lié par
  // son identité ({ id, sku }), jamais par son nom ni par l'objet (la
  // synchronisation remplace les objets de la liste). null : nouveau calcul.
  modification: null,
  aRedessiner: { list: true, history: true },
};
if (!configValide(etat.config)) etat.config = null;

// Chaque sauvegarde renvoie true si l'écriture sur l'appareil a réussi.
export function sauverProduits() { etat.aRedessiner.list = true; return stockage.ecrire('pv_produits_v2', JSON.stringify(etat.produits)); }
export function sauverHistorique() {
  if (etat.historique.length > HISTORIQUE_MAX) etat.historique.length = HISTORIQUE_MAX;
  etat.aRedessiner.history = true;
  return stockage.ecrire('pv_historique', JSON.stringify(etat.historique));
}
export function sauverRetraits() { return stockage.ecrire('pv_retraits', JSON.stringify(etat.retraits)); }
