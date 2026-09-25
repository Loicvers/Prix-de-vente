// ===========================
// CATÉGORIES
// ===========================
// Frais, tranches et coefficients : uniquement dans la config du script,
// mise en cache dans localStorage (pv_config). Une catégorie absente de la
// config reste visible mais ne peut pas être calculée.
// Les clés doivent correspondre à LIBELLES dans apps-script/Code.gs.
export const CATEGORIES = {
  tranquille:        { label: 'Vin tranquille',             nom: 'Tranquille',     court: 'Tranquille' },
  mousseux:          { label: 'Vin mousseux / pétillant',   nom: 'Pétillant',      court: 'Pétillant' },
  magnum_tranquille: { label: 'Magnum tranquille (1,5 l)',  nom: 'Tranquille',     court: 'Magnum tranquille' },
  magnum_mousseux:   { label: 'Magnum pétillant (1,5 l)',   nom: 'Pétillant',      court: 'Magnum pétillant' },
  '3l_tranquille':   { label: 'Double magnum tranquille (3 l)', nom: 'Double magnum', court: 'Double magnum', info: 'tranquille' },
  '3l_mousseux':     { label: 'Jéroboam pétillant (3 l)',   nom: 'Jéroboam',       court: 'Jéroboam 3 l', info: 'pétillant' },
  '4_5l_tranquille': { label: 'Tranquille 4,5 l',           nom: '4,5 l',          court: 'Tranquille 4,5 l', info: 'tranquille' },
  '5l_tranquille':   { label: 'Jéroboam tranquille (5 l)',  nom: 'Jéroboam 5 l',   court: 'Jéroboam 5 l', info: 'tranquille' },
  demie:             { label: '37,5 cl',                    nom: 'Demi-bouteille', court: '37,5 cl', info: '37,5 cl' },
  intermediaire:     { label: 'Produit intermédiaire 75cl', nom: 'Intermédiaire',  court: 'Intermédiaire', info: 'Maury, Porto, VDN…' },
};
export const GROUPES = [
  ['Bouteille 75 cl', ['tranquille', 'mousseux']],
  ['Magnum 1,5 l', ['magnum_tranquille', 'magnum_mousseux']],
  ['3 litres', ['3l_tranquille', '3l_mousseux']],
  ['4,5 et 5 litres', ['4_5l_tranquille', '5l_tranquille']],
  ['Autres formats', ['demie', 'intermediaire']],
];
export function categorie(cle) { return CATEGORIES[cle] || CATEGORIES.tranquille; }
export function cleValide(cle) { return CATEGORIES[cle] ? cle : 'tranquille'; }
