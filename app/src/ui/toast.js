// ===========================
// MESSAGE FLOTTANT
// ===========================
import { $ } from './dom.js';

let toastMinuteur = null;
export function toast(texte, action, auClic) {
  $('toast-texte').textContent = texte;
  const bouton = $('toast-action');
  bouton.hidden = !action;
  bouton.textContent = action || '';
  bouton.onclick = () => { $('toast').classList.remove('visible'); if (auClic) auClic(); };
  $('toast').classList.add('visible');
  clearTimeout(toastMinuteur);
  toastMinuteur = setTimeout(() => $('toast').classList.remove('visible'), action ? 5000 : 2600);
}
