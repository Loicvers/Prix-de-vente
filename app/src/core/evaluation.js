// ===========================
// ÉVALUATION D'UN CALCUL (écran Calculer, fiche produit)
// ===========================
// Fonction pure, sans écran ni stockage : à partir de la saisie, du format et
// de la config, dit si un prix peut être calculé et le calcule avec le moteur
// (core/calcul.js), seule autorité du résultat. Le détail est construit à
// partir des mêmes appels au moteur que le prix : il ne peut pas diverger.
//
// Statuts (spec Calculer §12) :
//   sans-config      config absente (jamais connecté) ou invalide
//   sans-format      aucun format choisi (produit « à compléter » recalculé)
//   format-manquant  format absent de la config en cache
//   vide             prix d'achat pas encore saisi
//   invalide         prix illisible (erreur 'illisible') ou ≤ 0 ('negatif')
//   erreur           le moteur a échoué (résultat indisponible)
//   valide           prix calculé
import Calcul from './calcul.js';
import { analyserMontant } from './format.js';

// Lignes du détail : achat, frais, base, une ligne par tranche, total.
export function lignesDetail(prixAchat, cle, config) {
  const frais = Calcul.frais(cle, config);
  const base = prixAchat + frais;
  const lignes = [
    { type: 'achat', montant: prixAchat },
    { type: 'frais', montant: frais, texte: config.categories[cle].detail || '' },
    { type: 'base', montant: base },
  ];
  for (const t of Calcul.detailTranches(base, config)) {
    lignes.push({ type: 'tranche', debut: t.debut, fin: t.fin, coef: t.coef, montant: t.montant });
  }
  lignes.push({ type: 'total', montant: Calcul.prixTTC(prixAchat, cle, config) });
  return lignes;
}

export function evaluerCalcul({ saisie, categorie, config }) {
  if (!config || !Calcul.configValide(config)) return { statut: 'sans-config', categorie };
  if (!categorie) return { statut: 'sans-format', categorie: null };
  if (!config.categories[categorie]) return { statut: 'format-manquant', categorie };
  const lecture = analyserMontant(saisie);
  if (lecture.erreur === 'vide') return { statut: 'vide', categorie };
  if (lecture.erreur) return { statut: 'invalide', erreur: lecture.erreur, categorie };
  try {
    const prixTTC = Calcul.prixTTC(lecture.valeur, categorie, config);
    if (typeof prixTTC !== 'number' || !isFinite(prixTTC)) return { statut: 'erreur', categorie, prixAchat: lecture.valeur };
    return {
      statut: 'valide',
      categorie,
      prixAchat: lecture.valeur,
      prixTTC,
      lignes: lignesDetail(lecture.valeur, categorie, config),
    };
  } catch {
    return { statut: 'erreur', categorie, prixAchat: lecture.valeur };
  }
}
