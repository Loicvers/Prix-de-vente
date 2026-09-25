// ===========================
// CALCUL DU PRIX DE VENTE
// ===========================
// Aucun montant ici : frais, tranches, coefficients et arrondi viennent de la
// config renvoyée par le script Google (action « config »), mise en cache
// localement. Format attendu :
// {
//   categories: { tranquille: { frais: <nombre>, detail: '<texte optionnel>' }, … },
//   tranches:   [ { jusqua: <borne haute>, coef: <nombre> }, …, { jusqua: null, coef: <nombre> } ],
//   arrondi:    <pas d'arrondi, ex. 0.1>
// }
// Les tranches sont cumulées : chaque part de la base (achat HT + frais) est
// multipliée par le coefficient de sa tranche.

function estNombre(n) { return typeof n === 'number' && isFinite(n); }

export function configValide(config) {
  if (!config || typeof config !== 'object') return false;
  const cats = config.categories;
  if (!cats || typeof cats !== 'object' || !Object.keys(cats).length) return false;
  for (const cle of Object.keys(cats)) {
    if (!cats[cle] || !estNombre(cats[cle].frais) || cats[cle].frais < 0) return false;
  }
  const t = config.tranches;
  if (!Array.isArray(t) || !t.length) return false;
  let precedente = 0;
  for (let i = 0; i < t.length; i++) {
    if (!t[i] || !estNombre(t[i].coef) || t[i].coef <= 0) return false;
    const derniere = i === t.length - 1;
    if (derniere) {
      if (t[i].jusqua !== null && t[i].jusqua !== undefined) return false;
    } else {
      if (!estNombre(t[i].jusqua) || t[i].jusqua <= precedente) return false;
      precedente = t[i].jusqua;
    }
  }
  return estNombre(config.arrondi) && config.arrondi > 0;
}

// Parts de la base par tranche : [{ debut, fin, coef, montant }]
export function detailTranches(base, config) {
  const rows = [];
  let debut = 0;
  for (const t of config.tranches) {
    const borne = (t.jusqua === null || t.jusqua === undefined) ? Infinity : t.jusqua;
    const fin = Math.min(base, borne);
    rows.push({ debut, fin, coef: t.coef, montant: (fin - debut) * t.coef });
    if (base <= borne) break;
    debut = borne;
  }
  return rows;
}

function arrondir(prix, pas) {
  const facteur = Math.round(1 / pas);
  return Math.round(prix * facteur) / facteur;
}

export function calculerPrixTTC(base, config) {
  let prix = 0;
  for (const r of detailTranches(base, config)) prix += r.montant;
  return arrondir(prix, config.arrondi);
}

export function frais(categorie, config) {
  const cat = config.categories[categorie];
  if (!cat) throw new Error('Catégorie inconnue : ' + categorie);
  return cat.frais;
}

export function prixTTC(prixAchat, categorie, config) {
  return calculerPrixTTC(prixAchat + frais(categorie, config), config);
}

const Calcul = { configValide, detailTranches, calculerPrixTTC, frais, prixTTC };
export default Calcul;
