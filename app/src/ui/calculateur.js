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
import { CATEGORIES, TYPES, CONTENANCES, GRILLE, typeDe, contenanceDe, categorie, estConnue, cleValide } from '../core/categories.js';
import { fmt, fmtCoef, fmtPct, esc } from '../core/format.js';
import { evaluerCalcul, lignesDetail } from '../core/evaluation.js';
import { etat } from '../data/etat.js';
import { stockage } from '../data/stockage.js';
import { syncNow } from '../data/synchro.js';
import { analyserNom, enregistrerProduit, produitModifie } from '../data/produits.js';

const DESKTOP = '(min-width: 900px)';
const DUREE_CONFIRMATION = 1600;

let calcul = { statut: 'vide' };      // dernière évaluation affichée
let typeCourant = null;                // type de vin affiché (la demi-bouteille n'en impose pas)
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

// Sélection en deux rangées (type de vin, puis contenance), construite une
// fois puis mise à jour sur place : le focus clavier reste sur le bouton
// radio en cours (les flèches parcourent une rangée, les contenances
// indisponibles pour ce type sont sautées).
// Format « optionnel » absent de la config : pas proposé (D15).
const proposee = cle => !!cle && estConnue(cle) &&
  (!CATEGORIES[cle].optionnel || !!(etat.config && etat.config.categories[cle]) || cle === etat.currentCat);

export function renderCategories() {
  if (!typeCourant) typeCourant = typeDe(etat.currentCat) || 'tranquille';
  $('types').innerHTML = TYPES.map(t => `
    <label class="choix-option" data-type="${t.id}"${t.long ? ` title="${esc(t.long)}"` : ''}>
      <input type="radio" name="type" value="${t.id}"/>
      <span>${esc(t.nom)}</span>
    </label>`).join('');
  $('categories').innerHTML = CONTENANCES.map(c => `
    <label class="choix-option cat" data-format="${c.id}">
      <input type="radio" name="format" value="${c.id}"/>
      <span>${esc(c.nom)}</span>
    </label>`).join('');
  afficherFormatCourant();
}

function afficherFormatCourant() {
  const cle = etat.currentCat;
  const choisi = !!cle && estConnue(cle);
  document.querySelectorAll('#types .choix-option').forEach(l => {
    l.querySelector('input').checked = choisi && l.dataset.type === typeCourant;
  });
  document.querySelectorAll('#categories .choix-option').forEach(l => {
    const c = l.dataset.format;
    const ici = GRILLE[typeCourant][c];
    // Contenance proposée par aucun type (ex. 50 cl hors config) : masquée.
    l.hidden = !TYPES.some(t => proposee(GRILLE[t.id][c]));
    const dispo = proposee(ici);
    l.dataset.cat = dispo ? ici : '';
    const radio = l.querySelector('input');
    radio.disabled = !dispo;
    radio.checked = choisi && dispo && ici === cle;
  });
  $('format-courant').textContent = choisi ? categorie(cle).libelle : 'Choisis un format';
  const conf = etat.config && choisi && etat.config.categories[cle];
  const info = choisi ? texteInfo(cle, conf) : '';
  $('format-info').textContent = info;
  $('format-info').hidden = !info;
  $('format-info').classList.toggle('manque', !!(etat.config && choisi && !conf));
}

// Changement de type : même contenance si elle existe pour ce type, sinon
// 75 cl. Sans format choisi (produit au format inconnu), on attend la
// contenance.
function choisirType(type) {
  typeCourant = type;
  if (!etat.currentCat || !estConnue(etat.currentCat)) { afficherFormatCourant(); return; }
  const c = contenanceDe(etat.currentCat);
  const cle = proposee(GRILLE[type][c]) ? GRILLE[type][c] : GRILLE[type]['75'];
  selectCat(cle);
}

function choisirContenance(c) {
  const cle = GRILLE[typeCourant][c];
  if (proposee(cle)) selectCat(cle);
}

// Choix d'un format : mémorisé, puis nouvelle évaluation immédiate.
export function selectCat(cle) {
  if (!estConnue(cle)) return;
  finConfirmation();
  etat.currentCat = cle;
  typeCourant = typeDe(cle) || typeCourant;
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

const RAISONS_MARGE = {
  'tva-absente': 'indisponible : taux de TVA absent de la config',
  'tva-invalide': 'indisponible : taux de TVA invalide dans la config',
};

function ligneHtml(l, balises) {
  const [a, b] = balises;
  const ligne = (classe, libelle, valeur) => `<div class="ligne${classe ? ' ' + classe : ''}"><${a}>${libelle}</${a}><${b}>${valeur}</${b}></div>`;
  switch (l.type) {
    case 'achat': return ligne('', 'Prix d\'achat HT', fmt(l.montant));
    case 'frais': return ligne('', `Frais fixes${l.texte ? ' (' + esc(l.texte) + ')' : ''}`, '+ ' + fmt(l.montant));
    case 'accises': return ligne('sous', 'dont accises', l.invalide ? 'invalides dans la config' : fmt(l.montant));
    case 'cout': return ligne('', 'Coût de revient HT', fmt(l.montant));
    case 'tranche': return ligne('', `${fmt(l.debut)} → ${fmt(l.fin)} × ${fmtCoef(l.coef)}`, fmt(l.montant));
    case 'total': return ligne('total', 'Prix de vente TTC', fmt(l.montant));
    case 'prix-ht': return ligne('marge-debut', 'Prix de vente HT', fmt(l.montant));
    case 'marge': return ligne('', 'Marge', fmt(l.montant));
    case 'marge-pct': return ligne('', 'Marge %', fmtPct(l.valeur));
    case 'marge-indisponible': return ligne('marge-debut', 'Marge', RAISONS_MARGE[l.raison] || 'indisponible');
    default: return '';
  }
}

const LIGNES_FICHE = ['achat', 'frais', 'accises', 'cout', 'tranche'];
// Détail pour la fiche produit : jusqu'aux tranches (la fiche ajoute son
// propre total, le prix enregistré ; la marge reste propre à Calculer).
export function detailHtml(prixAchat, cle) {
  return lignesDetail(prixAchat, cle, etat.config).filter(l => LIGNES_FICHE.includes(l.type)).map(l => ligneHtml(l, ['span', 'span'])).join('');
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
  const montant = $('resultat-prix');
  const nouveau = valide ? fmt(r.prixTTC) : '—';
  if (montant.textContent !== nouveau) {
    montant.textContent = nouveau;
    // Changement de prix : fondu lent (direction « Maison noire »).
    montant.classList.remove('maj');
    void montant.offsetWidth;
    montant.classList.add('maj');
  }
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
    typeCourant = typeDe(p.categorie) || typeCourant;
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
  else document.querySelector('#types input')?.focus();
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
    if (r.statut === 'sans-format') document.querySelector('#types input')?.focus(); else $('input-prix').focus();
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

  $('types').addEventListener('change', e => { if (e.target.name === 'type') choisirType(e.target.value); });
  $('categories').addEventListener('change', e => { if (e.target.name === 'format') choisirContenance(e.target.value); });

  calculer();
}
