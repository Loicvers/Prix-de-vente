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

// Arrondi au pas SUPÉRIEUR (74,71 → 74,80) : la marge n'est jamais rognée.
// La tolérance évite qu'une erreur de virgule flottante (17,1400000001)
// fasse monter d'un pas un prix déjà rond.
function arrondir(prix, pas) {
  const facteur = Math.round(1 / pas);
  return Math.ceil(prix * facteur - 1e-9) / facteur;
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

// ===========================
// MARGE (décision D4 révisée)
// ===========================
// Calculée après coup à partir du prix de vente : elle ne change rien au
// calcul du prix. Données facultatives de la config :
//   tva      taux de TVA (ex. 0.21), au premier niveau de la config ;
//   accises  par format, PARTIE des frais (« dont accises ») : jamais
//            ajoutées une seconde fois au coût.
// Coût de revient HT = prix d'achat HT + frais (accises comprises)
// Prix de vente HT   = prix de vente TTC / (1 + tva)
// Marge €            = prix de vente HT − coût de revient HT
// Marge %            = marge € / prix de vente HT × 100

// Taux de TVA : { taux } ou { erreur: 'absente' | 'invalide' }.
export function tauxTVA(config) {
  if (!config || config.tva === undefined || config.tva === null) return { erreur: 'absente' };
  return estNombre(config.tva) && config.tva >= 0 && config.tva < 1 ? { taux: config.tva } : { erreur: 'invalide' };
}

// Accises du format : { montant }, { erreur: 'invalide' } ou null si la
// config ne les distingue pas des autres frais.
export function accises(categorie, config) {
  const cat = config.categories[categorie];
  if (!cat) throw new Error('Catégorie inconnue : ' + categorie);
  if (cat.accises === undefined || cat.accises === null) return null;
  return estNombre(cat.accises) && cat.accises >= 0 && cat.accises <= cat.frais ? { montant: cat.accises } : { erreur: 'invalide' };
}

export function coutRevient(prixAchat, categorie, config) {
  return prixAchat + frais(categorie, config);
}

// { prixTTC, prixHT, cout, marge, margePct } ou { erreur } (TVA absente ou invalide).
export function marge(prixAchat, categorie, config) {
  const tva = tauxTVA(config);
  if (tva.erreur) return { erreur: 'tva-' + tva.erreur };
  const ttc = prixTTC(prixAchat, categorie, config);
  const prixHT = ttc / (1 + tva.taux);
  const cout = coutRevient(prixAchat, categorie, config);
  const m = prixHT - cout;
  return { prixTTC: ttc, prixHT, cout, marge: m, margePct: prixHT > 0 ? m / prixHT * 100 : null };
}

const Calcul = { configValide, detailTranches, calculerPrixTTC, frais, prixTTC, tauxTVA, accises, coutRevient, marge };
export default Calcul;
