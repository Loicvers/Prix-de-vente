// Mise en forme et lecture des montants et des noms.
const fmtNombre = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmt(n) { return fmtNombre.format(n) + ' €'; }
export function fmtCoef(n) { return n.toFixed(3).replace('.', ','); }
export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function normNom(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); }
// Accepte « 10,80 », « 10.80 » et « 10,80 € ».
export function lireMontant(s) {
  const n = parseFloat(String(s).replace(/\s|€/g, '').replace(',', '.'));
  return isFinite(n) && n > 0 ? n : NaN;
}
