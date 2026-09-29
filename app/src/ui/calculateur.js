// ===========================
// CALCULATEUR (onglet Calculer)
// ===========================
// Rendu et interactions seulement (spec Calculer, docs/CALCULER_SPEC_V2.md) :
// - le calcul et son détail viennent de core/evaluation.js (moteur
//   core/calcul.js) ;
// - l'enregistrement et les règles de nom (D3, D8, D14) de data/produits.js ;
// - la synchronisation de data/synchro.js.
// Le calcul est local et synchrone : il n'y a pas d'état « calcul en cours ».
// Chaque changement d'entrée réévalue immédiatement ; l'enregistrement
// recalcule avec les entrées du moment, jamais avec un ancien résultat.
import { $ } from './dom.js';
import { toast } from './toast.js';
import { ouvrirPin } from './pin.js';
import { fermer } from './fenetres.js';
import { afficherBadge } from './produits.js';
import { switchTab } from './onglets.js';
import { CATEGORIES, GROUPES, categorie, estConnue, cleValide } from '../core/categories.js';
import { fmt, fmtCoef, esc } from '../core/format.js';
import { evaluerCalcul, lignesDetail } from '../core/evaluation.js';
import { etat } from '../data/etat.js';
import { stockage } from '../data/stockage.js';
import { syncNow } from '../data/synchro.js';
import { analyserNom, enregistrerProduit, produitModifie } from '../data/produits.js';

const DESKTOP = '(min-width: 900px)';
const DUREE_CONFIRMATION = 1600;

let calcul = { statut: 'vide' };      // dernière évaluation affichée
let formatAvantOuverture = null;
let enregistrement = 'repos';         // repos | encours | enregistre
let minuteurEnregistre = 0;
let minuteurAnnonce = 0;
let derniereAnnonce = '';

// ===========================
// FORMATS
// ===========================
const texteInfo = (cle, conf) => {
  const cat = CATEGORIES[cle];
  // Complément déjà contenu dans le libellé V2 (« 37,5 cl »…) : pas répété.
  const info = cat.info && !cat.libelle.toLowerCase().includes(cat.info.toLowerCase()) ? cat.info : '';
  if (!etat.config) return info;
  const frais = conf ? '+' + fmt(conf.frais) + ' de frais' : 'frais à charger';
  return info ? frais + ' · ' + info : frais;
};

export function renderCategories() {
  const config = etat.config;
  $('categories').innerHTML = GROUPES.map(([titre, cles], i) => `
    <div class="groupe" role="group" aria-labelledby="groupe-${i}">
      <div class="groupe-titre" id="groupe-${i}">${esc(titre)}</div>
      <div class="cats">${cles.map(cle => {
        const conf = config && config.categories[cle];
        return `<label class="cat" data-cat="${cle}">
          <input type="radio" name="format" value="${cle}"${cle === etat.currentCat ? ' checked' : ''}/>
          <span class="cat-nom">${esc(CATEGORIES[cle].libelle)}</span>
          <span class="cat-info${config && !conf ? ' manque' : ''}">${esc(texteInfo(cle, conf))}</span>
        </label>`;
      }).join('')}</div>
    </div>`).join('');
  afficherFormatCourant();
}

function afficherFormatCourant() {
  $('format-courant').textContent = etat.currentCat ? categorie(etat.currentCat).libelle : 'Choisis un format';
  document.querySelectorAll('#categories input[name="format"]').forEach(r => { r.checked = r.value === etat.currentCat; });
}

export function ouvrirFormats() {
  formatAvantOuverture = etat.currentCat;
  $('categories').hidden = false;
  $('format-bouton').setAttribute('aria-expanded', 'true');
  const coche = document.querySelector('#categories input[name="format"]:checked') ||
    document.querySelector('#categories input[name="format"]');
  if (coche) coche.focus();
}

export function fermerFormats(focusSuivant) {
  $('categories').hidden = true;
  $('format-bouton').setAttribute('aria-expanded', 'false');
  if (focusSuivant === 'prix') $('input-prix').focus();
  else if (focusSuivant === 'bouton') $('format-bouton').focus();
}

// Choix d'un format : mémorisé, puis nouvelle évaluation immédiate.
export function selectCat(cle) {
  if (!estConnue(cle)) return;
  finConfirmation();
  etat.currentCat = cle;
  stockage.ecrire('pv_categorie', cle);
  afficherFormatCourant();
  calculer();
}

export function afficherConfig() {
  $('config-manquante').hidden = !!etat.config;
  renderCategories();
  calculer();
  etat.aRedessiner.list = true;
}

// ===========================
// CALCUL ET ÉTIQUETTE
// ===========================
const MESSAGES_ETAT = {
  vide: 'Saisis un prix d\'achat',
  invalide: 'Prix indisponible : corrige le prix d\'achat',
  'sans-config': 'Prix indisponible : connecte-toi avec ton PIN',
  'format-manquant': 'Prix indisponible : frais de ce format non chargés',
  'sans-format': 'Choisis un format',
  erreur: 'Calcul impossible avec la config actuelle. Reconnecte-toi avec ton PIN.',
};
const MESSAGES_PRIX = {
  illisible: 'Montant illisible : écris par exemple 12,50',
  negatif: 'Le prix d\'achat doit être supérieur à 0',
};

function ligneHtml(l, balises) {
  const [a, b] = balises;
  switch (l.type) {
    case 'achat': return `<div class="ligne"><${a}>Prix d'achat HT</${a}><${b}>${fmt(l.montant)}</${b}></div>`;
    case 'frais': return `<div class="ligne"><${a}>Frais fixes${l.texte ? ' (' + esc(l.texte) + ')' : ''}</${a}><${b}>+ ${fmt(l.montant)}</${b}></div>`;
    case 'base': return `<div class="ligne"><${a}>Base de calcul</${a}><${b}>${fmt(l.montant)}</${b}></div>`;
    case 'tranche': return `<div class="ligne"><${a}>${fmt(l.debut)} → ${fmt(l.fin)} × ${fmtCoef(l.coef)}</${a}><${b}>${fmt(l.montant)}</${b}></div>`;
    case 'total': return `<div class="ligne total"><${a}>Prix de vente TTC</${a}><${b}>${fmt(l.montant)}</${b}></div>`;
    default: return '';
  }
}

// Détail pour la fiche produit (sans la ligne de total, ajoutée par la fiche).
export function detailHtml(prixAchat, cle) {
  return lignesDetail(prixAchat, cle, etat.config).filter(l => l.type !== 'total').map(l => ligneHtml(l, ['span', 'span'])).join('');
}

function afficherManque(cle) {
  const manque = $('cat-manquante');
  const conf = etat.config && cle && etat.config.categories[cle];
  manque.hidden = !etat.config || !cle || !!conf;
  if (manque.hidden) return;
  // Cache d'avant l'ajout du format : une connexion recharge la config.
  manque.innerHTML = `<strong>Connecte-toi une première fois avec ton PIN</strong> pour charger les frais du format ` +
    `${esc(categorie(cle).libelle)}. <button data-action="pin">Entrer mon PIN</button><br/>` +
    `<small>Si ce message reste après connexion : ajoute <code>${esc(cle)}</code> dans la propriété CONFIG du script (INSTALL.md, « Ajouter une catégorie »).</small>`;
}

function annoncer(r) {
  clearTimeout(minuteurAnnonce);
  if (r.statut !== 'valide') return;
  const texte = `Prix de vente TTC ${fmt(r.prixTTC)}, ${categorie(r.categorie).libelle}`;
  if (texte === derniereAnnonce) return;
  // Annonce après une courte pause de frappe, pas à chaque touche.
  minuteurAnnonce = setTimeout(() => { derniereAnnonce = texte; $('resultat-annonce').textContent = texte; }, 500);
}

export function calculer() {
  const r = evaluerCalcul({ saisie: $('input-prix').value, categorie: etat.currentCat, config: etat.config });
  calcul = r;
  const valide = r.statut === 'valide';

  $('resultat').dataset.statut = r.statut;
  $('resultat-prix').textContent = valide ? fmt(r.prixTTC) : '—';
  $('resultat-cat').textContent = r.categorie ? categorie(r.categorie).libelle : '';
  const etatTexte = MESSAGES_ETAT[r.statut] || '';
  $('resultat-etat').textContent = etatTexte;
  $('resultat-etat').hidden = !etatTexte;
  $('resultat-detail').innerHTML = valide ? r.lignes.map(l => ligneHtml(l, ['dt', 'dd'])).join('') : '';
  $('detail').hidden = !valide;

  const champ = $('input-prix');
  const msg = $('prix-message');
  const erreurPrix = r.statut === 'invalide' ? MESSAGES_PRIX[r.erreur] : '';
  msg.textContent = erreurPrix;
  msg.hidden = !erreurPrix;
  if (erreurPrix) champ.setAttribute('aria-invalid', 'true'); else champ.removeAttribute('aria-invalid');

  afficherManque(r.categorie);
  annoncer(r);
  afficherModification();
  afficherNom();
}

// ===========================
// MODE MODIFICATION (« Recalculer »)
// ===========================
// Fiche produit → Recalculer : format, prix d'achat et nom préremplis, lié au
// produit par son identité. Format inconnu : aucun format imposé (§11.3).
export function ouvrirModification(p) {
  fermer('modal');
  finConfirmation();
  etat.modification = { id: p.id, sku: p.sku || '' };
  if (estConnue(p.categorie)) {
    etat.currentCat = p.categorie;
    stockage.ecrire('pv_categorie', p.categorie);
  } else {
    etat.currentCat = null;
  }
  $('input-prix').value = typeof p.prixAchat === 'number' ? String(p.prixAchat).replace('.', ',') : '';
  $('input-nom').value = p.nom;
  afficherFormatCourant();
  calculer();
  switchTab('calc');
  if (etat.currentCat) $('input-prix').focus();
  else ouvrirFormats();
}

export function quitterModification() {
  etat.modification = null;
  if (!etat.currentCat) selectCat(cleValide(stockage.lire('pv_categorie', 'tranquille')));
  $('input-nom').value = '';
  calculer();
}

// Le produit modifié a disparu de l'appareil (supprimé, retiré de la feuille) :
// on repasse en nouveau calcul en le disant, sans rien enregistrer.
function modificationPerdue() {
  const nom = $('modification-nom').textContent;
  etat.modification = null;
  toast(`« ${nom} » n'existe plus sur cet appareil : ce calcul sera enregistré comme un nouveau produit`);
}

function afficherModification() {
  const bandeau = $('modification');
  let p = produitModifie(etat.produits, etat.modification);
  if (etat.modification && !p) { modificationPerdue(); p = null; }
  bandeau.hidden = !p;
  $('btn-enregistrer').dataset.libelle = p ? 'Enregistrer les modifications' : 'Enregistrer';
  const enregistre = $('prix-enregistre');
  if (!p) { enregistre.hidden = true; return; }
  $('modification-nom').textContent = p.nom;
  const info = $('modification-info');
  info.hidden = p.disponibilite !== 'retiré';
  info.textContent = info.hidden ? '' : 'Ce produit est retiré : l\'enregistrer le remet en vente.';
  const different = calcul.statut === 'valide' && typeof p.prixTTC === 'number' && p.prixTTC !== calcul.prixTTC;
  enregistre.hidden = !different;
  enregistre.textContent = different ? 'Prix enregistré : ' + fmt(p.prixTTC) : '';
}

// ===========================
// NOM ET ENREGISTREMENT
// ===========================
function afficherNom(erreurForcee) {
  const champ = $('input-nom');
  const msg = $('nom-message');
  const a = analyserNom(etat.produits, champ.value, etat.modification);
  let texte = '';
  let erreur = false;
  if (erreurForcee) { texte = erreurForcee; erreur = true; }
  else if (a.statut === 'collision') { texte = 'Un autre produit porte déjà ce nom. Choisis un autre nom.'; erreur = true; }
  else if (a.statut === 'existant') {
    texte = a.retire ? 'Ce produit existe déjà (retiré) : il sera mis à jour et remis en vente.'
      : 'Ce produit existe déjà : il sera mis à jour.';
  }
  msg.textContent = texte;
  msg.hidden = !texte;
  msg.classList.toggle('erreur', erreur);
  if (erreur) champ.setAttribute('aria-invalid', 'true'); else champ.removeAttribute('aria-invalid');
  afficherBouton(a.statut === 'collision');
}

// Enregistrement possible : calcul valide, pas de collision (D8), pas
// d'enregistrement en cours. Sans config, le bouton ouvre l'écran PIN.
function raisonBlocage(collision) {
  switch (calcul.statut) {
    case 'valide': return collision ? 'Change le nom pour enregistrer.' : '';
    case 'sans-config': return '';
    case 'sans-format': return 'Choisis un format pour enregistrer.';
    case 'format-manquant': return 'Les frais de ce format ne sont pas chargés : connecte-toi avec ton PIN.';
    case 'erreur': return 'Calcul indisponible : rien ne peut être enregistré.';
    default: return 'Saisis un prix d\'achat valide pour enregistrer.';
  }
}

function afficherBouton(collision) {
  const bouton = $('btn-enregistrer');
  const raison = raisonBlocage(collision);
  $('enregistrer-raison').textContent = raison;
  $('enregistrer-raison').hidden = !raison;
  bouton.disabled = !!raison || enregistrement !== 'repos';
  bouton.setAttribute('aria-busy', String(enregistrement === 'encours'));
  bouton.textContent = enregistrement === 'encours' ? 'Enregistrement…'
    : enregistrement === 'enregistre' ? 'Enregistré sur l\'appareil'
    : (bouton.dataset.libelle || 'Enregistrer');
  bouton.dataset.etat = enregistrement;
}

// La confirmation « Enregistré sur l'appareil » bloque une seconde soumission
// immédiate ; toute nouvelle action (saisie, Recalculer) la termine.
function finConfirmation() {
  if (enregistrement !== 'enregistre') return;
  clearTimeout(minuteurEnregistre);
  enregistrement = 'repos';
}

const MESSAGES_ENREGISTREMENT = {
  collision: 'Un autre produit porte déjà ce nom. Choisis un autre nom.',
  stockage: 'Mémoire de l\'appareil pleine : le produit n\'est pas enregistré.',
  format: 'Choisis un format pour enregistrer.',
  prix: 'Saisis un prix d\'achat valide pour enregistrer.',
};

export function sauvegarder() {
  if (enregistrement !== 'repos') return;            // double soumission
  if (!etat.config) { ouvrirPin('Connecte-toi une première fois avec ton PIN'); return; }
  // Toujours recalculer avec les entrées du moment.
  calculer();
  const r = calcul;
  if (r.statut === 'format-manquant') { toast('Frais de cette catégorie absents de la config'); return; }
  if (r.statut !== 'valide') {
    if (r.statut === 'sans-format') ouvrirFormats(); else $('input-prix').focus();
    return;
  }
  const champNom = $('input-nom');
  const nom = champNom.value.trim();
  if (!nom) {
    afficherNom('Donne un nom au produit');
    toast('Donne un nom au produit');
    champNom.focus();
    return;
  }

  enregistrement = 'encours';
  afficherBouton(false);
  const res = enregistrerProduit({
    nom, categorie: r.categorie, prixAchat: r.prixAchat, prixTTC: r.prixTTC, modification: etat.modification,
  });
  enregistrement = 'repos';

  if (!res.ok) {
    if (res.erreur === 'introuvable') { modificationPerdue(); calculer(); return; }
    const message = MESSAGES_ENREGISTREMENT[res.erreur] || 'Le produit n\'est pas enregistré.';
    toast(message);
    afficherNom(res.erreur === 'collision' || res.erreur === 'stockage' ? message : '');
    if (res.erreur === 'collision') champNom.focus();
    return;
  }

  // Écriture sur l'appareil confirmée : « enregistré sur l'appareil ».
  // La synchronisation (voyant) est un état distinct.
  etat.modification = null;
  champNom.value = '';
  champNom.blur();
  enregistrement = 'enregistre';
  calculer();
  clearTimeout(minuteurEnregistre);
  minuteurEnregistre = setTimeout(() => { enregistrement = 'repos'; afficherNom(); }, DUREE_CONFIRMATION);
  const suite = res.incomplet ? ' (mémoire presque pleine : historique non mis à jour)' : '';
  toast(`${nom} enregistré · ${fmt(r.prixTTC)}${suite}`, 'Voir', () => switchTab('list'));
  afficherBadge();
  syncNow();
}

// Après une synchronisation : la liste des produits a pu changer (aide D14,
// produit modifié supprimé ailleurs…).
export function rafraichirCalculateur() {
  afficherModification();
  afficherNom();
}

// ===========================
// DÉTAIL : état initial et préférence (D9)
// ===========================
// Sans préférence : replié sous 900 px, ouvert au-delà. Seule une action de
// l'utilisateur écrit la préférence (« ouvert » / « ferme »). Valeurs
// héritées : « 0 » (écrit seulement quand l'utilisateur repliait) = fermé ;
// « 1 » (écrit par l'ancienne app à chaque démarrage) = aucune préférence.
export function detailOuvertInitial(valeur, desktop) {
  if (valeur === 'ouvert') return true;
  if (valeur === 'ferme' || valeur === '0') return false;
  return desktop;
}

// ===========================
// ÉVÉNEMENTS
// ===========================
export function initCalculateur() {
  const detail = $('detail');
  const desktop = typeof matchMedia === 'function' && matchMedia(DESKTOP).matches;
  detail.open = detailOuvertInitial(stockage.lire('pv_detail', null), desktop);
  detail.querySelector('summary').addEventListener('click', () => {
    stockage.ecrire('pv_detail', detail.open ? 'ferme' : 'ouvert');
  });

  let calculPrevu = 0;
  $('input-prix').addEventListener('input', () => {
    finConfirmation();
    cancelAnimationFrame(calculPrevu);
    calculPrevu = requestAnimationFrame(calculer);
  });
  $('input-prix').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('input-nom').focus(); } });
  $('input-nom').addEventListener('input', () => { finConfirmation(); afficherNom(); });
  $('form-enregistrer').addEventListener('submit', e => { e.preventDefault(); sauvegarder(); });

  const formats = $('categories');
  $('format-bouton').addEventListener('click', () => {
    if (formats.hidden) ouvrirFormats(); else fermerFormats('bouton');
  });
  formats.addEventListener('change', e => { if (e.target.name === 'format') selectCat(e.target.value); });
  // Choix au doigt ou à la souris : on referme et on passe au prix. Au
  // clavier, les flèches parcourent les formats ; Entrée ou Espace valident.
  formats.addEventListener('click', e => {
    if (e.detail > 0 && e.target.closest('.cat')) setTimeout(() => fermerFormats('prix'), 0);
  });
  formats.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); fermerFormats('prix'); }
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (formatAvantOuverture && formatAvantOuverture !== etat.currentCat) selectCat(formatAvantOuverture);
      fermerFormats('bouton');
    }
  });
  formats.addEventListener('keyup', e => { if (e.key === ' ') fermerFormats('prix'); });

  calculer();
}
