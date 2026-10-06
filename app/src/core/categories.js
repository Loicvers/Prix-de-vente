// ===========================
// CATÉGORIES (formats)
// ===========================
// Frais, tranches et coefficients : uniquement dans la config du script,
// mise en cache dans localStorage (pv_config). Une catégorie absente de la
// config reste visible mais ne peut pas être calculée.
// Les clés doivent correspondre à LIBELLES dans apps-script/Code.gs.
//
// Table de référence unique (spec Calculer §6.2, décisions D2, D10, D13) :
// - label : libellé historique (identique à celui écrit dans la feuille) ;
// - libelle : libellé V2, non ambigu, contenances en minuscules ;
// - famille : tranquille | petillant | autre (jamais une couleur d'état) ;
// - optionnel : format proposé dans Calculer seulement s'il est dans la
//   config (formats ajoutés après coup, décision D15).
export const CATEGORIES = {
  tranquille:        { label: 'Vin tranquille',             nom: 'Tranquille',     court: 'Tranquille',        libelle: 'Tranquille · 75 cl',             famille: 'tranquille' },
  mousseux:          { label: 'Vin mousseux / pétillant',   nom: 'Pétillant',      court: 'Pétillant',         libelle: 'Pétillant · 75 cl',              famille: 'petillant' },
  magnum_tranquille: { label: 'Magnum tranquille (1,5 l)',  nom: 'Tranquille',     court: 'Magnum tranquille', libelle: 'Magnum tranquille · 1,5 l',      famille: 'tranquille' },
  magnum_mousseux:   { label: 'Magnum pétillant (1,5 l)',   nom: 'Pétillant',      court: 'Magnum pétillant',  libelle: 'Magnum pétillant · 1,5 l',       famille: 'petillant' },
  '3l_tranquille':   { label: 'Double magnum tranquille (3 l)', nom: 'Double magnum', court: 'Double magnum', libelle: 'Double magnum tranquille · 3 l', famille: 'tranquille', info: 'tranquille' },
  '3l_mousseux':     { label: 'Jéroboam pétillant (3 l)',   nom: 'Jéroboam',       court: 'Jéroboam 3 l',      libelle: 'Jéroboam pétillant · 3 l',       famille: 'petillant', info: 'pétillant' },
  '4_5l_tranquille': { label: 'Tranquille 4,5 l',           nom: '4,5 l',          court: 'Tranquille 4,5 l',  libelle: 'Tranquille · 4,5 l',             famille: 'tranquille', info: 'tranquille' },
  '5l_tranquille':   { label: 'Jéroboam tranquille (5 l)',  nom: 'Jéroboam 5 l',   court: 'Jéroboam 5 l',      libelle: 'Jéroboam tranquille · 5 l',      famille: 'tranquille', info: 'tranquille' },
  '4_5l_mousseux':   { label: 'Réhoboam pétillant (4,5 l)', nom: 'Réhoboam',       court: 'Réhoboam 4,5 l',    libelle: 'Réhoboam pétillant · 4,5 l',     famille: 'petillant', info: 'pétillant', optionnel: true },
  '5l_mousseux':     { label: 'Pétillant (5 l)',            nom: 'Pétillant 5 l',  court: 'Pétillant 5 l',     libelle: 'Pétillant · 5 l',                famille: 'petillant', info: 'pétillant', optionnel: true },
  cubi_10l:          { label: 'Cubi tranquille (10 l)',     nom: 'Cubi 10 l',      court: 'Cubi 10 l',         libelle: 'Cubi tranquille · 10 l',         famille: 'tranquille', info: 'tranquille', optionnel: true },
  demie:             { label: '37,5 cl',                    nom: 'Demi-bouteille', court: '37,5 cl',           libelle: 'Demi-bouteille · 37,5 cl',       famille: 'autre', info: '37,5 cl' },
  intermediaire:     { label: 'Produit intermédiaire 75cl', nom: 'Vin doux naturel', court: 'Vin doux 75 cl',  libelle: 'Vin doux naturel · 75 cl',       famille: 'autre', info: 'Maury, Porto, VDN…' },
  intermediaire_50cl: { label: 'Produit intermédiaire 50cl', nom: 'Vin doux naturel', court: 'Vin doux 50 cl', libelle: 'Vin doux naturel · 50 cl',       famille: 'autre', info: 'Maury, Porto, VDN…', optionnel: true },
};
export const GROUPES = [
  ['Bouteille 75 cl', ['tranquille', 'mousseux']],
  ['Magnum 1,5 l', ['magnum_tranquille', 'magnum_mousseux']],
  ['3 litres', ['3l_tranquille', '3l_mousseux']],
  ['4,5 et 5 litres', ['4_5l_tranquille', '5l_tranquille', '4_5l_mousseux', '5l_mousseux']],
  ['Cubi 10 litres', ['cubi_10l']],
  ['Vins doux naturels', ['intermediaire', 'intermediaire_50cl']],
  ['Autres formats', ['demie']],
];

// Sélection dans Calculer (direction « Maison noire », 01/10/2026, validée
// par Loïc) : une rangée « type de vin », puis une rangée de contenances.
// La grille donne la catégorie de chaque paire ; une paire absente n'existe
// pas (ex. pétillant 50 cl). La demi-bouteille n'a qu'une catégorie : elle
// est proposée quel que soit le type.
export const TYPES = [
  { id: 'tranquille', nom: 'Tranquille' },
  { id: 'petillant', nom: 'Pétillant' },
  { id: 'vdn', nom: 'Vin doux', long: 'Vin doux naturel' },
];
export const CONTENANCES = [
  { id: '37_5', nom: '37,5 cl' },
  { id: '50', nom: '50 cl' },
  { id: '75', nom: '75 cl' },
  { id: '150', nom: '1,5 l' },
  { id: '300', nom: '3 l' },
  { id: '450', nom: '4,5 l' },
  { id: '500', nom: '5 l' },
  { id: '1000', nom: '10 l' },
];
export const GRILLE = {
  tranquille: { '37_5': 'demie', '75': 'tranquille', '150': 'magnum_tranquille', '300': '3l_tranquille', '450': '4_5l_tranquille', '500': '5l_tranquille', '1000': 'cubi_10l' },
  petillant:  { '37_5': 'demie', '75': 'mousseux', '150': 'magnum_mousseux', '300': '3l_mousseux', '450': '4_5l_mousseux', '500': '5l_mousseux' },
  vdn:        { '37_5': 'demie', '50': 'intermediaire_50cl', '75': 'intermediaire' },
};
// Type d'une catégorie (null pour la demi-bouteille, commune aux trois, et
// pour une catégorie inconnue).
export function typeDe(cle) {
  if (!cle || cle === 'demie') return null;
  const t = TYPES.find(t => Object.values(GRILLE[t.id]).includes(cle));
  return t ? t.id : null;
}
export function contenanceDe(cle) {
  for (const t of TYPES) {
    const c = Object.keys(GRILLE[t.id]).find(c => GRILLE[t.id][c] === cle);
    if (c) return c;
  }
  return null;
}
// Catégorie absente ou inconnue (ex. produit migré dont la catégorie est
// restée vide dans la feuille) : affichée « à compléter », jamais devinée.
export const INCONNUE = { label: 'Catégorie à compléter', nom: 'À compléter', court: 'À compléter', libelle: 'Format à compléter', famille: 'autre' };
export function categorie(cle) { return CATEGORIES[cle] || INCONNUE; }
export function cleAffichee(cle) { return CATEGORIES[cle] ? cle : 'inconnue'; }
export function estConnue(cle) { return Object.prototype.hasOwnProperty.call(CATEGORIES, cle); }
// Au démarrage, le calculateur reprend le format mémorisé (pv_categorie) ;
// absent ou inconnu en mémoire : « tranquille », comme avant.
export function cleValide(cle) { return CATEGORIES[cle] ? cle : 'tranquille'; }
