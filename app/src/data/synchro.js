// ===========================
// SYNC GOOGLE SHEETS
// ===========================
// File d'attente : produits synced:false puis retraits, envoyés en un seul
// lot (action « lot », config comprise). Chaque envoi porte la version du
// produit que l'appareil connaissait : si la feuille a changé entre-temps, le
// script n'écrit rien et répond « conflit » ; le produit attend alors une
// décision explicite (ui/conflits.js). La réponse du lot contient la liste
// des produits de la feuille, fusionnée avec celle de l'appareil
// (data/fusion.js) : chaque appareil voit les mêmes produits.
// Un script pas encore mis à jour répond « action » au lot : on repasse alors
// à une requête par opération (sans relecture de la liste). Le voyant ne passe
// au vert que si le script a répondu ok:true, que la file est vide et qu'il
// n'y a aucun conflit.
import { $ } from '../ui/dom.js';
import { messageErreur } from '../ui/messages.js';
import { afficherSync, setSyncStatus } from '../ui/statut.js';
import { rafraichir } from '../ui/onglets.js';
import { ouvrirPin } from '../ui/pin.js';
import { etat, sauverProduits, sauverRetraits } from './etat.js';
import { appelScript, appliquerConfig, lirePin, scriptUrl } from './api.js';
import { fusionner } from './fusion.js';

// Erreurs propres à un produit : les autres envois continuent.
const ERREURS_PRODUIT = ['nom', 'categorie', 'prix', 'sku', 'introuvable', 'format', 'action', 'conflit', 'version'];
const TAILLE_LOT = 40;

const aEnvoyer = p => p.synced === false && !p.conflit;

export function enAttente() {
  return etat.produits.filter(aEnvoyer).length + etat.retraits.filter(r => !r.conflit).length;
}

export function nombreConflits() {
  return etat.produits.filter(p => p.conflit).length + etat.retraits.filter(r => r.conflit).length;
}

let lotDisponible = true;
async function executer(ops) {
  if (lotDisponible) {
    const rep = await appelScript('lot', { operations: ops, appareil: etat.appareil || undefined }, null, 45000);
    if (rep.error !== 'action') return rep;
    lotDisponible = false;   // ancien script : une requête par opération
  }
  const conf = await appelScript('config', {});
  if (conf.ok !== true) return conf;
  const resultats = [];
  for (const op of ops) {
    const r = await appelScript(op.action, Object.assign({ appareil: etat.appareil || undefined }, op));
    if (r.ok !== true && !ERREURS_PRODUIT.includes(r.error)) return Object.assign({}, r, { config: conf.config, resultats });
    resultats.push(r);
  }
  return { ok: true, config: conf.config, resultats };
}

let syncEnCours = null;
export function syncNow() {
  if (!syncEnCours) syncEnCours = synchroniser().finally(() => { syncEnCours = null; });
  return syncEnCours;
}

// Version connue de la feuille : 0 pour une fiche jamais confirmée (nouvelle
// fiche, ou produit d'avant les versions : le script vérifie alors qu'il
// n'écrase rien).
const versionConnue = x => (Number(x.version) > 0 ? Math.floor(Number(x.version)) : 0);

async function synchroniser() {
  if (!lirePin() || !scriptUrl()) return finSync({ ok: false, error: 'pin' });
  afficherSync('encours', 'Synchronisation…', 'Synchro…');
  const refuses = new Set();   // déjà tentés pendant cette synchro, refusés par le script

  for (let tour = 0; tour < 20; tour++) {
    const prods = etat.produits.filter(p => aEnvoyer(p) && !refuses.has(p)).slice(0, TAILLE_LOT);
    const rets = etat.retraits.filter(r => !r.conflit && !refuses.has(r)).slice(0, TAILLE_LOT - prods.length);
    const revs = prods.map(p => p.rev);
    const ops = prods.map(p => ({
      action: 'enregistrer',
      sku: p.sku || undefined,
      uid: String(p.id),
      nom: p.nom,
      categorie: p.categorie,
      prixAchat: p.prixAchat,
      prixTTC: p.prixTTC,
      version: versionConnue(p),
    })).concat(rets.map(r => ({ action: 'retirer', sku: r.sku || undefined, nom: r.nom, version: versionConnue(r) })));

    const rep = await executer(ops);
    if (rep.config) appliquerConfig(rep.config);
    const res = Array.isArray(rep.resultats) ? rep.resultats : [];
    if (rep.ok === true && res.length < ops.length) return finSync({ ok: false, error: 'format' });

    prods.forEach((p, i) => {
      const r = res[i];
      if (!r) return;
      if (r.ok === true && r.sku) {
        p.sku = r.sku;
        if (Number(r.version) > 0) p.version = Number(r.version);
        delete p.erreur;
        if (r.reactive || r.version !== undefined) p.disponibilite = 'disponible';
        if (p.rev === revs[i]) p.synced = true;   // modifié pendant l'envoi : renvoyé au tour suivant
      } else if (r.error === 'conflit' && r.actuel) {
        delete p.erreur;
        p.conflit = { actuel: r.actuel, le: new Date().toISOString() };
        if (r.sku && !p.sku) p.sku = r.sku;
        refuses.add(p);
      } else {
        p.erreur = r.error || 'format';
        refuses.add(p);
      }
    });
    rets.forEach((x, j) => {
      const r = res[prods.length + j];
      if (!r) return;
      // « introuvable » : jamais arrivé dans la feuille, rien à retirer.
      if (r.ok === true || r.error === 'introuvable' || r.error === 'sku') {
        etat.retraits = etat.retraits.filter(y => y !== x);
      } else if (r.error === 'conflit' && r.actuel) {
        x.conflit = { actuel: r.actuel, le: new Date().toISOString() };
        refuses.add(x);
      } else {
        refuses.add(x);
      }
    });
    // Liste de la feuille (script à jour) : même liste sur tous les appareils.
    if (Array.isArray(rep.produits)) etat.produits = fusionner(etat.produits, rep.produits, etat.retraits);
    if (prods.length || Array.isArray(rep.produits)) sauverProduits();
    if (rets.length) sauverRetraits();
    rafraichir();

    if (rep.ok !== true) return finSync(rep);
    const suite = etat.produits.some(p => aEnvoyer(p) && !refuses.has(p)) || etat.retraits.some(r => !r.conflit && !refuses.has(r));
    if (!suite) break;
  }
  return finSync({ ok: true });
}

// Réseau faible (le téléphone se croit connecté mais la requête échoue) :
// nouvel essai toutes les 2 minutes tant que des envois attendent.
let reessai = null;
function finSync(rep) {
  rafraichir();
  clearTimeout(reessai);
  if (['reseau', 'injoignable', 'delai', 'http'].includes(rep.error) && enAttente()) reessai = setTimeout(syncNow, 120000);
  if (rep.ok === true && enAttente() === 0 && nombreConflits() === 0) {
    setSyncStatus(true);
    return true;
  }
  setSyncStatus(false, rep.ok === true ? '' : messageErreur(rep.error));
  if ((rep.error === 'auth' || rep.error === 'pin') && !$('pin-modal').classList.contains('ouvert')) {
    ouvrirPin(rep.error === 'auth' ? 'PIN refusé' : '');
  }
  return false;
}
