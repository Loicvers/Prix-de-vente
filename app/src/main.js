// ===========================
// DÉMARRAGE DE L'APP
// ===========================
// Polices servies avec l'app (plus d'appel à Google Fonts) : disponibles hors
// ligne dès la première ouverture.
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-serif-display/400.css';
import './styles/app.css';

import { $ } from './ui/dom.js';
import { fermer } from './ui/fenetres.js';
import { toast } from './ui/toast.js';
import { ouvrirPin, validerPin } from './ui/pin.js';
import { afficherConfig, initCalculateur, quitterModification } from './ui/calculateur.js';
import { renderList, openModal, afficherBadge } from './ui/produits.js';
import { switchTab } from './ui/onglets.js';
import { setSyncStatus } from './ui/statut.js';
import { etat } from './data/etat.js';
import { lirePin, scriptUrl } from './data/api.js';
import { syncNow, enAttente, nombreConflits } from './data/synchro.js';
import { garderMaVersion, garderVersionFeuille, confirmerRetrait, annulerRetrait } from './ui/conflits.js';

// ===========================
// ÉVÉNEMENTS (délégués)
// ===========================
document.addEventListener('click', e => {
  const cible = e.target.closest('[data-action]');
  if (!cible) {
    if (e.target.classList.contains('voile') && e.target.id === 'modal') fermer('modal');
    return;
  }
  switch (cible.dataset.action) {
    case 'onglet':
      // Pastille en conflit : directement vers les conflits à résoudre.
      switchTab(cible.id === 'pastille' && nombreConflits() ? 'list' : cible.dataset.onglet);
      break;
    case 'nouveau-calcul': quitterModification(); break;
    case 'filtre': etat.filtreCat = cible.dataset.filtre; renderList(); break;
    case 'fiche': openModal(cible.dataset.id); break;
    case 'conflit-mien': garderMaVersion(cible.dataset.id); break;
    case 'conflit-feuille': garderVersionFeuille(cible.dataset.id); break;
    case 'retrait-confirmer': confirmerRetrait(cible.dataset.sku); break;
    case 'retrait-garder': annulerRetrait(cible.dataset.sku); break;
    case 'fermer': fermer('modal'); break;
    case 'pin': ouvrirPin(); break;
    case 'fermer-pin': fermer('pin-modal'); break;
    case 'sync': syncNow(); break;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { fermer('modal'); fermer('pin-modal'); }
});

$('form-pin').addEventListener('submit', e => { e.preventDefault(); validerPin(); });

let recherchePrevue = 0;
$('search-input').addEventListener('input', () => {
  clearTimeout(recherchePrevue);
  recherchePrevue = setTimeout(renderList, 80);
});


window.addEventListener('online', () => syncNow());
window.addEventListener('offline', () => setSyncStatus(false, 'hors ligne'));
// Retour sur l'app (téléphone) : on renvoie ce qui attend.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && enAttente()) syncNow();
});

// ===========================
// HORS LIGNE (service worker)
// ===========================
// Généré à la compilation (voir vite.config.mjs) ; absent en développement.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  const avaitControleur = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (avaitControleur) toast('Nouvelle version disponible', 'Recharger', () => location.reload());
  });
}

// ===========================
// INIT
// ===========================
initCalculateur();
afficherConfig();
afficherBadge();
setSyncStatus(false, navigator.onLine === false ? 'hors ligne' : '');
if (!lirePin() || !scriptUrl()) ouvrirPin();
else syncNow();
