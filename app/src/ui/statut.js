// Voyant et texte de l'état de synchronisation.
import { $ } from './dom.js';
import { etat } from '../data/etat.js';
import { enAttente } from '../data/synchro.js';

export function afficherSync(etatSync, texte, court) {
  $('pastille').dataset.etat = etatSync;
  $('pastille-texte').textContent = court;
  $('sync-status').textContent = texte;
}

export function setSyncStatus(ok, raison) {
  if (ok) return afficherSync('ok', 'Synchronisé avec Google Sheets', 'Synchronisé');
  const n = enAttente();
  const refuses = etat.produits.filter(p => p.erreur).length;
  let texte = 'Non synchronisé' + (raison ? ' – ' + raison : '') + (n ? ` (${n} en attente)` : '');
  if (refuses) texte += ` · ${refuses} refusé${refuses > 1 ? 's' : ''} par le script`;
  const court = raison === 'hors ligne' ? 'Hors ligne' : (n ? n + ' en attente' : 'Non synchronisé');
  afficherSync(refuses || (raison && raison !== 'hors ligne') ? 'erreur' : 'off', texte, court);
}
