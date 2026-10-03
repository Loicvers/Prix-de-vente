// Bouton « Importer un catalogue » de l'onglet Produits.
import { $ } from './dom.js';
import { toast } from './toast.js';
import { rafraichir } from './onglets.js';
import { importerCatalogue } from '../data/import-catalogue.js';
import { afficherBadge } from './produits.js';
import { syncNow } from '../data/synchro.js';

export function choisirCatalogue() { $('import-fichier').click(); }

const RAISONS = { taille: 'format 10 L non géré', prix: 'prix d\'achat illisible', config: 'format absent de la config' };

export async function importerFichier(input) {
  const fichier = input.files && input.files[0];
  input.value = '';
  if (!fichier) return;
  const bilan = importerCatalogue(await fichier.text());
  if (bilan.erreur === 'config') return toast('Config absente : synchronisez d\'abord');
  if (bilan.erreur) return toast('Fichier illisible : colonnes « Nom » et « Prix d\'achat » attendues');
  rafraichir();
  afficherBadge();
  const n = bilan.crees + bilan.misAJour;
  let msg = `${n} produit${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}`;
  if (bilan.ignores.length) {
    msg += ` · ${bilan.ignores.length} ignoré${bilan.ignores.length > 1 ? 's' : ''}`;
    alert('Produits ignorés :\n' + bilan.ignores.map(i => `- ${i.nom} (${RAISONS[i.raison] || i.raison})`).join('\n'));
  }
  if (bilan.stockageOk === false) msg += ' · mémoire pleine, non enregistré';
  toast(msg);
  syncNow();
}
