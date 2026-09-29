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
  demie:             { label: '37,5 cl',                    nom: 'Demi-bouteille', court: '37,5 cl',           libelle: 'Demi-bouteille · 37,5 cl',       famille: 'autre', info: '37,5 cl' },
  intermediaire:     { label: 'Produit intermédiaire 75cl', nom: 'Intermédiaire',  court: 'Intermédiaire',     libelle: 'Intermédiaire · 75 cl',          famille: 'autre', info: 'Maury, Porto, VDN…' },
};
export const GROUPES = [
  ['Bouteille 75 cl', ['tranquille', 'mousseux']],
  ['Magnum 1,5 l', ['magnum_tranquille', 'magnum_mousseux']],
  ['3 litres', ['3l_tranquille', '3l_mousseux']],
  ['4,5 et 5 litres', ['4_5l_tranquille', '5l_tranquille', '4_5l_mousseux', '5l_mousseux']],
  ['Autres formats', ['demie', 'intermediaire']],
];
// Catégorie absente ou inconnue (ex. produit migré dont la catégorie est
// restée vide dans la feuille) : affichée « à compléter », jamais devinée.
export const INCONNUE = { label: 'Catégorie à compléter', nom: 'À compléter', court: 'À compléter', libelle: 'Format à compléter', famille: 'autre' };
export function categorie(cle) { return CATEGORIES[cle] || INCONNUE; }
export function cleAffichee(cle) { return CATEGORIES[cle] ? cle : 'inconnue'; }
export function estConnue(cle) { return Object.prototype.hasOwnProperty.call(CATEGORIES, cle); }
// Au démarrage, le calculateur reprend le format mémorisé (pv_categorie) ;
// absent ou inconnu en mémoire : « tranquille », comme avant.
export function cleValide(cle) { return CATEGORIES[cle] ? cle : 'tranquille'; }
