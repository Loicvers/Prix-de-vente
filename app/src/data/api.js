// ===========================
// APPEL DU SCRIPT GOOGLE
// ===========================
import { SCRIPT_URL } from '../config.js';
import { stockage } from './stockage.js';
import { etat } from './etat.js';
import { configValide } from '../core/calcul.js';
import { afficherConfig } from '../ui/calculateur.js';

export function scriptUrl() { return SCRIPT_URL || stockage.lire('pv_url', ''); }
export function lirePin() { return stockage.lire('pv_pin', ''); }

// Content-Type text/plain : pas de requête préalable CORS, et la réponse
// JSON est lue. Toute erreur renvoie { ok:false, error }.
export async function appelScript(action, donnees, acces, delai) {
  const url = (acces && acces.url) || scriptUrl();
  const pin = (acces && acces.pin) || lirePin();
  if (!url || !pin) return { ok: false, error: 'pin' };
  if (navigator.onLine === false) return { ok: false, error: 'reseau' };
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), delai || 20000);
  let rep;
  try {
    rep = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({}, donnees, { action, pin })),
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch {
    clearTimeout(minuteur);
    if (ctrl.signal.aborted) return { ok: false, error: 'delai' };
    // En ligne mais aucune réponse lisible : adresse fausse ou déploiement
    // pas ouvert à « Tout le monde » (Google renvoie vers sa page de connexion).
    return { ok: false, error: navigator.onLine === false ? 'reseau' : 'injoignable' };
  }
  clearTimeout(minuteur);
  if (!rep.ok) return { ok: false, error: 'http' };
  // Une page HTML au lieu de JSON : erreur dans le code collé ou autorisation
  // Google manquante.
  try {
    const json = await rep.json();
    return (json && typeof json === 'object') ? json : { ok: false, error: 'format' };
  } catch {
    return { ok: false, error: 'format' };
  }
}

export function appliquerConfig(c) {
  if (!configValide(c)) return false;
  const texte = JSON.stringify(c);
  if (etat.config && texte === JSON.stringify(etat.config)) return true;
  etat.config = c;
  stockage.ecrire('pv_config', texte);
  afficherConfig();
  return true;
}

export async function chargerConfig(acces) {
  const rep = await appelScript('config', {}, acces);
  if (rep.ok === true && !appliquerConfig(rep.config)) return { ok: false, error: 'config' };
  return rep;
}
