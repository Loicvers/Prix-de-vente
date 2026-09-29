// ===========================
// ENREGISTREMENT D'UN PRODUIT (couche données, sans écran)
// ===========================
// Règles (spec Calculer §10 et §11, décisions D3, D8, D14) :
// - nouveau calcul : le nom identifie le produit ; un nom déjà connu
//   (casse et espaces ignorés) met ce produit à jour, qui garde son SKU ;
// - mode modification (« Recalculer ») : le produit est lié par son identité
//   ({ id, sku }) ; changer le nom le renomme (même SKU) ; un nom déjà porté
//   par un AUTRE produit est refusé et rien n'est modifié (D8) ;
// - rien n'est confirmé si l'écriture sur l'appareil échoue (§10.4) : l'état
//   en mémoire est remis comme avant.
// Le produit modifié est mis à jour sur place (même objet) : une
// synchronisation en cours le reconnaît à son « rev » et le renverra.
import { normNom } from '../core/format.js';
import { estConnue } from '../core/categories.js';
import { etat, sauverProduits, sauverHistorique, sauverRetraits } from './etat.js';

const estRetire = p => p.disponibilite === 'retiré';

// Produit en cours de modification, retrouvé par son identité.
export function produitModifie(produits, modification) {
  if (!modification) return null;
  return produits.find(p => String(p.id) === String(modification.id)) ||
    (modification.sku ? produits.find(p => p.sku === modification.sku) : null) || null;
}

// Ce que deviendrait un enregistrement avec ce nom.
//   vide        aucun nom
//   nouveau     création d'un produit
//   existant    mise à jour d'un produit existant (aide D14)
//   renommage   mode modification, nouveau nom libre
//   collision   mode modification, nom d'un autre produit (bloqué, D8)
//   introuvable mode modification, le produit n'existe plus sur l'appareil
export function analyserNom(produits, nom, modification) {
  const n = normNom(nom || '');
  if (!n) return { statut: 'vide' };
  if (modification) {
    const cible = produitModifie(produits, modification);
    if (!cible) return { statut: 'introuvable' };
    if (normNom(cible.nom) === n) return { statut: 'existant', produit: cible, retire: estRetire(cible) };
    const autre = produits.find(p => p !== cible && normNom(p.nom) === n);
    if (autre) return { statut: 'collision', produit: autre };
    return { statut: 'renommage', produit: cible, retire: estRetire(cible) };
  }
  const existant = produits.find(p => normNom(p.nom) === n);
  if (existant) return { statut: 'existant', produit: existant, retire: estRetire(existant) };
  return { statut: 'nouveau' };
}

// Enregistre dans store ({ produits, historique, retraits }) et persiste avec
// les fonctions de persistance ({ produits, historique, retraits } → booléen).
// Renvoie { ok: true, produit, statut, remisEnVente, incomplet }
//      ou { ok: false, erreur: 'nom' | 'format' | 'prix' | 'collision' | 'introuvable' | 'stockage', produit? }.
export function enregistrerDans(store, demande, persistance, maintenant = new Date()) {
  const nom = String(demande.nom || '').trim();
  const { categorie, prixAchat, prixTTC, modification } = demande;
  if (!nom) return { ok: false, erreur: 'nom' };
  if (!estConnue(categorie)) return { ok: false, erreur: 'format' };
  if (!(typeof prixAchat === 'number' && prixAchat > 0 && isFinite(prixAchat)) ||
      !(typeof prixTTC === 'number' && isFinite(prixTTC))) return { ok: false, erreur: 'prix' };

  const analyse = analyserNom(store.produits, nom, modification || null);
  if (analyse.statut === 'introuvable') return { ok: false, erreur: 'introuvable' };
  if (analyse.statut === 'collision') return { ok: false, erreur: 'collision', produit: analyse.produit };

  const avant = {
    produits: store.produits,
    historique: store.historique,
    retraits: store.retraits,
    champs: analyse.produit ? Object.assign({}, analyse.produit) : null,
  };
  const date = maintenant.toLocaleDateString('fr-BE');
  let prod = analyse.produit || null;
  if (prod) Object.assign(prod, { nom, categorie, prixAchat, prixTTC, date });
  else prod = { id: maintenant.getTime(), sku: '', nom, categorie, prixAchat, prixTTC, date };
  prod.synced = false;
  delete prod.erreur;
  prod.rev = (prod.rev || 0) + 1;

  store.produits = [prod, ...store.produits.filter(p => p !== prod)];
  store.historique = [{ id: prod.id, nom, categorie, prixAchat, prixTTC, date }, ...store.historique];
  // Réenregistré après une suppression pas encore envoyée : on annule le retrait.
  const retraits = store.retraits.filter(r => normNom(r.nom) !== normNom(nom) && !(prod.sku && r.sku === prod.sku));
  store.retraits = retraits;

  if (!persistance.produits()) {
    store.produits = avant.produits;
    store.historique = avant.historique;
    store.retraits = avant.retraits;
    if (avant.champs) {
      for (const k of Object.keys(prod)) if (!(k in avant.champs)) delete prod[k];
      Object.assign(prod, avant.champs);
    }
    return { ok: false, erreur: 'stockage' };
  }
  const historiqueOk = persistance.historique();
  const retraitsOk = persistance.retraits();
  return {
    ok: true,
    produit: prod,
    statut: analyse.statut,
    remisEnVente: !!analyse.retire,
    incomplet: !(historiqueOk && retraitsOk),
  };
}

export function enregistrerProduit(demande) {
  return enregistrerDans(etat, demande, { produits: sauverProduits, historique: sauverHistorique, retraits: sauverRetraits });
}
