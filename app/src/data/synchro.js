// ===========================
// SYNC GOOGLE SHEETS
// ===========================
// File d'attente : produits synced:false puis retraits, envoyés en un seul
// lot (action « lot », config comprise). Un script pas encore mis à jour
// répond « action » : on repasse alors à une requête par opération. Le voyant
// ne passe au vert que si le script a répondu ok:true et que la file est vide.
import { $ } from '../ui/dom.js';
import { messageErreur } from '../ui/messages.js';
import { afficherSync, setSyncStatus } from '../ui/statut.js';
import { rafraichir } from '../ui/onglets.js';
import { ouvrirPin } from '../ui/pin.js';
import { etat, sauverProduits, sauverRetraits } from './etat.js';
import { appelScript, appliquerConfig, lirePin, scriptUrl } from './api.js';

// Erreurs propres à un produit : les autres envois continuent.
const ERREURS_PRODUIT = ['nom', 'categorie', 'prix', 'sku', 'introuvable', 'format', 'action'];
const TAILLE_LOT = 40;

export function enAttente() {
  return etat.produits.filter(p => p.synced === false).length + etat.retraits.length;
}

let lotDisponible = true;
async function executer(ops) {
  if (lotDisponible) {
    const rep = await appelScript('lot', { operations: ops }, null, 45000);
    if (rep.error !== 'action') return rep;
    lotDisponible = false;   // ancien script : une requête par opération
  }
  const conf = await appelScript('config', {});
  if (conf.ok !== true) return conf;
  const resultats = [];
  for (const op of ops) {
    const r = await appelScript(op.action, op);
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

async function synchroniser() {
  if (!lirePin() || !scriptUrl()) return finSync({ ok: false, error: 'pin' });
  afficherSync('encours', 'Synchronisation…', 'Synchro…');
  const refuses = new Set();   // déjà tentés pendant cette synchro, refusés par le script

  for (let tour = 0; tour < 20; tour++) {
    const prods = etat.produits.filter(p => p.synced === false && !refuses.has(p)).slice(0, TAILLE_LOT);
    const rets = etat.retraits.filter(r => !refuses.has(r)).slice(0, TAILLE_LOT - prods.length);
    const revs = prods.map(p => p.rev);
    const ops = prods.map(p => ({
      action: 'enregistrer',
      sku: p.sku || undefined,
      uid: String(p.id),
      nom: p.nom,
      categorie: p.categorie,
      prixAchat: p.prixAchat,
      prixTTC: p.prixTTC,
    })).concat(rets.map(r => ({ action: 'retirer', sku: r.sku || undefined, nom: r.nom })));

    const rep = await executer(ops);
    if (rep.config) appliquerConfig(rep.config);
    const res = Array.isArray(rep.resultats) ? rep.resultats : [];
    if (rep.ok === true && res.length < ops.length) return finSync({ ok: false, error: 'format' });

    prods.forEach((p, i) => {
      const r = res[i];
      if (!r) return;
      if (r.ok === true && r.sku) {
        p.sku = r.sku;
        delete p.erreur;
        if (p.rev === revs[i]) p.synced = true;   // modifié pendant l'envoi : renvoyé au tour suivant
      } else {
        p.erreur = r.error || 'format';
        refuses.add(p);
      }
    });
    rets.forEach((x, j) => {
      const r = res[prods.length + j];
      if (!r) return;
      // « introuvable » : jamais arrivé dans la feuille, rien à retirer.
      if (r.ok === true || r.error === 'introuvable' || r.error === 'sku') etat.retraits = etat.retraits.filter(y => y !== x);
      else refuses.add(x);
    });
    if (prods.length) sauverProduits();
    if (rets.length) sauverRetraits();
    rafraichir();

    if (rep.ok !== true) return finSync(rep);
    const suite = etat.produits.some(p => p.synced === false && !refuses.has(p)) || etat.retraits.some(r => !refuses.has(r));
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
  if (rep.ok === true && enAttente() === 0) {
    setSyncStatus(true);
    return true;
  }
  setSyncStatus(false, rep.ok === true ? '' : messageErreur(rep.error));
  if ((rep.error === 'auth' || rep.error === 'pin') && !$('pin-modal').classList.contains('ouvert')) {
    ouvrirPin(rep.error === 'auth' ? 'PIN refusé' : '');
  }
  return false;
}
