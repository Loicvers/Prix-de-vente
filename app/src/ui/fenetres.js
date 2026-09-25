// Ouverture et fermeture des fenêtres (fiche produit, PIN).
import { $ } from './dom.js';

export function ouvrir(id) { $('toast').classList.remove('visible'); $(id).classList.add('ouvert'); }
export function fermer(id) { $(id).classList.remove('ouvert'); }
