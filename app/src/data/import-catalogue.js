// ===========================
// IMPORT D'UN CATALOGUE (CSV exporté du logiciel de caisse)
// ===========================
// Seules les colonnes utiles sont lues : Nom et Prix d'achat. Groupe de
// produits, stock, prix de vente actuel, etc. sont ignorés. Le prix de vente
// est calculé par l'app avec la config privée (jamais écrit dans le dépôt) ;
// le format est déduit du nom, et un nom sans indication claire est
// signalé plutôt que deviné quand le format est ambigu.
import { analyserMontant, normNom } from '../core/format.js';
import { GRILLE } from '../core/categories.js';
import { prixTTC } from '../core/calcul.js';
import { etat, sauverProduits, sauverHistorique, sauverRetraits } from './etat.js';
import { enregistrerDans } from './produits.js';

// Lecture CSV à point-virgule, guillemets doublés (""), BOM ignoré.
export function lireCsv(texte) {
  const rows = [];
  let row = [], cell = '', q = false;
  const t = texte.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x !== '')) rows.push(row);
  return rows;
}

// Format déduit du nom. { cle } ou { erreur: 'taille' } (10 L : pas de
// catégorie dans l'app).
export function deviner(nom) {
  const n = nom.toLowerCase();
  if (/\b10\s*l\b/.test(n)) return { erreur: 'taille' };
  let type = 'tranquille';
  if (/cr[ée]mant|champagne|p[ée]tillant|mousseux|prosecco|cerdon/.test(n) && !/ratafia/.test(n)) type = 'petillant';
  else if (/maury|rivesaltes|banyuls|porto|vin doux|ratafia/.test(n)) type = 'vdn';
  let cont = '75';
  if (/1\/2|37[,.]5\s*cl|demi/.test(n)) cont = '37_5';
  else if (/double\s*magnum|\b3\s*l\b/.test(n)) cont = '300';
  else if (/j[ée]ro?boam/.test(n)) cont = '300';
  else if (/magnum|1[,.]5\s*l/.test(n)) cont = '150';
  else if (/\b4[,.]5\s*l\b/.test(n)) cont = '450';
  else if (/\b5\s*l\b/.test(n)) cont = '500';
  const cle = GRILLE[type][cont] || GRILLE[type]['75'];
  return { cle, type, cont };
}

// Lignes utiles : { nom, prixAchat, categorie } ou { nom, erreur }.
export function lignesCatalogue(texte) {
  const rows = lireCsv(texte);
  if (!rows.length) return { erreur: 'vide' };
  const tete = rows[0].map(h => h.trim().toLowerCase());
  const iNom = tete.indexOf('nom');
  const iAchat = tete.indexOf("prix d'achat");
  if (iNom < 0 || iAchat < 0) return { erreur: 'colonnes' };
  const lignes = rows.slice(1).map(r => {
    const nom = (r[iNom] || '').trim().replace(/\s+/g, ' ');
    const m = analyserMontant(r[iAchat]);
    if (!nom) return null;
    if (m.erreur) return { nom, erreur: 'prix' };
    const f = deviner(nom);
    if (f.erreur) return { nom, erreur: f.erreur };
    return { nom, prixAchat: m.valeur, categorie: f.cle };
  }).filter(Boolean);
  return { lignes };
}

// Importe dans le store ; persiste une seule fois. L'historique des calculs
// n'est pas rempli par un import. Renvoie un bilan.
export function importerDans(store, lignes, config, persistance, maintenant = new Date()) {
  const bilan = { crees: 0, misAJour: 0, ignores: [] };
  const historique = store.historique;
  const sansEcriture = { produits: () => true, historique: () => true, retraits: () => true };
  lignes.forEach((l, i) => {
    if (l.erreur) { bilan.ignores.push({ nom: l.nom, raison: l.erreur }); return; }
    if (!config.categories[l.categorie]) { bilan.ignores.push({ nom: l.nom, raison: 'config' }); return; }
    const r = enregistrerDans(store, {
      nom: l.nom, categorie: l.categorie, prixAchat: l.prixAchat,
      prixTTC: prixTTC(l.prixAchat, l.categorie, config),
    }, sansEcriture, new Date(maintenant.getTime() + i));
    if (!r.ok) { bilan.ignores.push({ nom: l.nom, raison: r.erreur }); return; }
    if (r.statut === 'nouveau') bilan.crees++; else bilan.misAJour++;
  });
  store.historique = historique;
  bilan.stockageOk = persistance.produits() && persistance.historique() && persistance.retraits();
  return bilan;
}

export function importerCatalogue(texte) {
  if (!etat.config) return { erreur: 'config' };
  const lu = lignesCatalogue(texte);
  if (lu.erreur) return lu;
  return importerDans(etat, lu.lignes, etat.config,
    { produits: sauverProduits, historique: sauverHistorique, retraits: sauverRetraits });
}
