// ===========================
// PIN
// ===========================
import { $ } from './dom.js';
import { ouvrir, fermer } from './fenetres.js';
import { toast } from './toast.js';
import { messageErreur } from './messages.js';
import { SCRIPT_URL } from '../config.js';
import { stockage } from '../data/stockage.js';
import { chargerConfig } from '../data/api.js';
import { syncNow } from '../data/synchro.js';

export function ouvrirPin(message) {
  $('pin-url-zone').hidden = !!SCRIPT_URL;
  $('pin-url').value = stockage.lire('pv_url', '');
  $('pin-input').value = '';
  $('pin-msg').textContent = message || '';
  ouvrir('pin-modal');
  (SCRIPT_URL || $('pin-url').value ? $('pin-input') : $('pin-url')).focus();
}

export async function validerPin() {
  const pin = $('pin-input').value.trim();
  const url = SCRIPT_URL || $('pin-url').value.trim();
  const msg = $('pin-msg');
  if (!url) { msg.textContent = 'Colle l\'adresse du script.'; return; }
  if (!pin) { msg.textContent = 'Entre ton PIN.'; return; }
  const bouton = $('pin-ok');
  bouton.disabled = true;
  bouton.textContent = 'Vérification…';
  msg.textContent = '';
  const rep = await chargerConfig({ url, pin });
  bouton.disabled = false;
  bouton.textContent = 'Valider';
  if (rep.ok === true || rep.error === 'reseau') {
    // Hors ligne : le PIN est gardé et sera vérifié au retour du réseau.
    stockage.ecrire('pv_pin', pin);
    if (!SCRIPT_URL) stockage.ecrire('pv_url', url);
    fermer('pin-modal');
    if (rep.ok === true) toast('Connecté');
    syncNow();
    return;
  }
  msg.textContent = messageErreur(rep.error);
}
