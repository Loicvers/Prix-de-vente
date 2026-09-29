// Mise en forme et lecture des montants et des noms.
const fmtNombre = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Montant absent ou illisible (cellule vide dans la feuille) : « — ».
export function fmt(n) { return typeof n === 'number' && isFinite(n) ? fmtNombre.format(n) + ' €' : '—'; }
export function fmtCoef(n) { return n.toFixed(3).replace('.', ','); }
const fmtPourcent = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function fmtPct(n) { return typeof n === 'number' && isFinite(n) ? fmtPourcent.format(n) + ' %' : '—'; }
export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function normNom(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); }

// Lecture d'un montant saisi (spec Calculer §7.2, décisions D5 et D11).
// Espaces (y compris insécables) et « € » ignorés, puis :
// - une virgule : elle est décimale ; les points avant elle séparent les
//   milliers, par groupes de 3 chiffres (« 1.234,56 » → 1234,56) ;
// - un seul point, sans virgule : décimal, comme avant (« 12.50 ») ;
// - plusieurs points sans virgule (« 1.234.567 »), plusieurs virgules ou tout
//   autre caractère : illisible, jamais deviné.
// Renvoie { valeur } ou { erreur: 'vide' | 'illisible' | 'negatif' }.
export function analyserMontant(s) {
  const t = String(s ?? '').replace(/[\s€]/g, '');
  if (!t) return { erreur: 'vide' };
  const negatif = t.startsWith('-');
  const corps = negatif ? t.slice(1) : t;
  if (!/^[\d.,]+$/.test(corps) || !/\d/.test(corps)) return { erreur: 'illisible' };
  const virgules = corps.split(',').length - 1;
  let texte;
  if (virgules > 1) return { erreur: 'illisible' };
  if (virgules === 1) {
    const [entier, decimales] = corps.split(',');
    if (decimales.includes('.')) return { erreur: 'illisible' };
    if (entier.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(entier)) return { erreur: 'illisible' };
    texte = entier.replace(/\./g, '') + '.' + decimales;
  } else {
    if (corps.split('.').length - 1 > 1) return { erreur: 'illisible' };
    texte = corps;
  }
  const n = Number(texte);
  if (!isFinite(n)) return { erreur: 'illisible' };
  if (negatif || n <= 0) return { erreur: 'negatif' };
  return { valeur: n };
}

// Montant strictement positif, ou NaN.
export function lireMontant(s) {
  const r = analyserMontant(s);
  return r.erreur ? NaN : r.valeur;
}
