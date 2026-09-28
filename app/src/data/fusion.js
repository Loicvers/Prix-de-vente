// ===========================
// FUSION AVEC LA FEUILLE (source commune)
// ===========================
// La liste renvoyée par le script (onglets Privé + Public) remplace la liste
// de l'appareil, sauf pour ce qui n'a pas encore été confirmé par la feuille :
// - un produit modifié ici et pas encore envoyé (synced:false) garde la
//   version de l'appareil : il sera envoyé avec la version qu'il connaissait,
//   et le script signalera un conflit si la feuille a changé entre-temps ;
// - un produit en conflit reste tel quel jusqu'à la décision de l'utilisateur ;
// - un produit supprimé ici mais pas encore retiré de la feuille reste masqué.
// Fonctions pures (sans accès à l'écran ni au stockage) : testées à part.
import { normNom } from '../core/format.js';

export function dateCourte(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('fr-BE') : '';
}

// Produit de l'appareil construit depuis une ligne de la feuille.
// local : produit de l'appareil correspondant (garde son identifiant).
export function depuisServeur(s, local) {
  return {
    id: local ? local.id : 'sku:' + s.sku,
    sku: s.sku,
    nom: s.nom,
    categorie: s.categorie || '',
    prixAchat: s.prixAchat,
    prixTTC: s.prixTTC,
    date: dateCourte(s.dateMaj) || (local && local.date) || '',
    dateMaj: s.dateMaj || '',
    version: Number(s.version) || 0,
    appareil: s.appareil || '',
    disponibilite: s.disponibilite === 'retiré' ? 'retiré' : 'disponible',
    synced: true,
    rev: (local && local.rev) || 0,
  };
}

const enSuspens = p => p.synced === false || !!p.conflit;

export function fusionner(locaux, serveur, retraits) {
  if (!Array.isArray(serveur)) return locaux;
  const lignes = serveur.filter(s => s && typeof s.sku === 'string' && s.sku);
  const parSku = new Map(lignes.map(s => [s.sku, s]));
  const retraitsEnAttente = new Set((retraits || []).filter(r => r.sku).map(r => r.sku));
  const vus = new Set();
  const resultat = [];

  for (const p of locaux) {
    const s = p.sku ? parSku.get(p.sku) : lignes.find(x => !vus.has(x.sku) && normNom(x.nom) === normNom(p.nom));
    if (enSuspens(p)) {
      resultat.push(p);
      if (s) vus.add(s.sku);
    } else if (s) {
      resultat.push(depuisServeur(s, p));
      vus.add(s.sku);
    } else if (!p.sku || !lignes.length) {
      // Jamais relié à la feuille, ou liste vide (prudence : on ne vide pas
      // l'appareil sur une réponse vide).
      resultat.push(p);
    }
    // Sinon : supprimé de la feuille, il disparaît de l'appareil.
  }

  for (const s of lignes) {
    if (vus.has(s.sku) || retraitsEnAttente.has(s.sku)) continue;
    resultat.push(depuisServeur(s, null));
    vus.add(s.sku);
  }

  // En attente ou en conflit d'abord, puis du plus récent au plus ancien.
  return resultat
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const sa = enSuspens(a.p) ? 0 : 1;
      const sb = enSuspens(b.p) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const da = a.p.dateMaj || '';
      const db = b.p.dateMaj || '';
      if (da !== db) return da < db ? 1 : -1;
      return a.i - b.i;
    })
    .map(x => x.p);
}
