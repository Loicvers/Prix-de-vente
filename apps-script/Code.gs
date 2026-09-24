/**
 * Prix de vente – script Google Apps Script de la feuille de prix.
 *
 * À coller dans l'éditeur Apps Script de la feuille (voir INSTALL.md).
 * Aucun montant ici : le PIN et la config (frais, tranches, coefficients)
 * sont dans les propriétés du script (PIN et CONFIG).
 *
 * Requête : POST, corps JSON envoyé en text/plain :
 *   { pin, action: 'config' }
 *   { pin, action: 'enregistrer', sku?, uid?, nom, categorie, prixAchat, prixTTC }
 *   { pin, action: 'retirer', sku }            (ou { nom } pour un ancien produit sans SKU)
 *   { pin, action: 'lot', operations: [ { action: 'enregistrer', … }, { action: 'retirer', … } ] }
 *     → { ok: true, config, resultats: [ réponse de chaque opération ] }
 *     Une seule requête pour toute la file d'attente de l'app, config comprise.
 * Réponse : JSON { ok: true, … } ou { ok: false, error: '…' }.
 */

var ONGLET_PRIVE = 'Privé';
var ONGLET_PUBLIC = 'Public';
var ONGLET_HISTORIQUE = 'Historique';

var ENTETES_PRIVE = ['SKU', 'Nom', 'Catégorie', "Prix d'achat HT", 'Frais', 'Prix TTC', 'Date MAJ'];
var ENTETES_PUBLIC = ['SKU', 'Nom', 'Catégorie', 'Prix TTC', 'Disponibilité'];

var DISPONIBLE = 'disponible';
var RETIRE = 'retiré';

var LIBELLES = {
  tranquille: 'Vin tranquille',
  mousseux: 'Vin mousseux / pétillant',
  demie: '37,5 cl',
  intermediaire: 'Produit intermédiaire 75cl',
  magnum_tranquille: 'Magnum tranquille (1,5 l)',
  magnum_mousseux: 'Magnum pétillant (1,5 l)',
  '3l_tranquille': 'Double magnum tranquille (3 l)',
  '3l_mousseux': 'Jéroboam pétillant (3 l)',
  '4_5l_tranquille': 'Tranquille 4,5 l',
  '5l_tranquille': 'Jéroboam tranquille (5 l)'
};

// Catégories de l'ancienne app : les seules possibles dans Historique.
var CATEGORIES_HISTORIQUE = ['tranquille', 'mousseux', 'demie', 'intermediaire'];

// Nombre maximal d'opérations dans un lot.
var MAX_LOT = 50;

// En-têtes reconnus dans l'ancien onglet (comparés sans majuscules ni
// accents). Les colonnes sont trouvées par leur en-tête, pas par leur place.
// « htva » : l'ancienne app y écrivait le prix de vente calculé.
var COLONNES_HIST = {
  nom: ['nom'],
  categorie: ['categorie'],
  prixAchat: ['pa', "prix d'achat", "prix d'achat ht", 'prixachat'],
  frais: ['frais'],
  prixTTC: ['htva', 'prix ttc', 'prixttc', 'ttc'],
  date: ['date', 'date maj'],
  id: ['id'],
  historique: ['historique']
};

// Anti-devinette du PIN : après MAX_ECHECS PIN faux, tout est refusé
// pendant DUREE_BLOCAGE secondes.
var MAX_ECHECS = 20;
var DUREE_BLOCAGE = 900;

// ===========================
// POINT D'ENTRÉE
// ===========================
function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ ok: false, error: 'format' });
  }
  if (!req || typeof req !== 'object') return json_({ ok: false, error: 'format' });

  var refus = verifierPin_(req.pin);
  if (refus) return json_({ ok: false, error: refus });

  try {
    switch (req.action) {
      case 'config': return json_({ ok: true, config: lireConfig_() });
      case 'enregistrer': return json_(enregistrer_(req));
      case 'retirer': return json_(retirer_(req));
      case 'lot': return json_(lot_(req));
      default: return json_({ ok: false, error: 'action' });
    }
  } catch (err) {
    return json_({ ok: false, error: 'serveur', message: String((err && err.message) || err) });
  }
}

// Aucune lecture sans PIN.
function doGet() {
  return json_({ ok: false, error: 'auth' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===========================
// AUTORISATION
// ===========================
// Renvoie null si le PIN est bon, sinon le code d'erreur.
function verifierPin_(pin) {
  var attendu = PropertiesService.getScriptProperties().getProperty('PIN');
  if (!attendu) return 'auth'; // PIN pas encore créé : on refuse tout
  if (pin === undefined || pin === null || pin === '') return 'auth';

  var cache = CacheService.getScriptCache();
  var echecs = Number(cache.get('echecs_pin') || 0);
  if (echecs >= MAX_ECHECS) return 'bloque';

  if (String(pin) !== String(attendu)) {
    cache.put('echecs_pin', String(echecs + 1), DUREE_BLOCAGE);
    return 'auth';
  }
  return null;
}

// ===========================
// CONFIG
// ===========================
function lireConfig_() {
  var brut = PropertiesService.getScriptProperties().getProperty('CONFIG');
  if (!brut) throw new Error('Propriété CONFIG absente');
  var config = JSON.parse(brut);
  if (!config.categories || !config.tranches || !config.arrondi) throw new Error('Propriété CONFIG incomplète');
  return config;
}

// ===========================
// ENREGISTRER (upsert par SKU)
// ===========================
function enregistrer_(req, config) {
  var nom = String(req.nom || '').trim();
  if (!nom) return { ok: false, error: 'nom' };
  var cle = cleCategorie_(req.categorie);
  if (!cle) return { ok: false, error: 'categorie' };
  var prixAchat = Number(req.prixAchat);
  var prixTTC = Number(req.prixTTC);
  if (!isFinite(prixAchat) || prixAchat <= 0 || !isFinite(prixTTC) || prixTTC <= 0) return { ok: false, error: 'prix' };
  var sku = String(req.sku || '').trim();
  if (sku && !/^UCP-\d{4,}$/.test(sku)) return { ok: false, error: 'sku' };

  config = config || lireConfig_();
  var cat = config.categories[cle];
  if (!cat) return { ok: false, error: 'categorie' };

  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var prive = onglet_(ss, ONGLET_PRIVE, ENTETES_PRIVE);
    var pub = onglet_(ss, ONGLET_PUBLIC, ENTETES_PUBLIC);
    var cache = CacheService.getScriptCache();
    var uid = req.uid ? 'uid_' + String(req.uid).slice(0, 60) : '';

    // Un envoi répété (réponse perdue) retrouve le SKU déjà attribué.
    if (!sku && uid) sku = cache.get(uid) || '';
    var lignePrive = sku ? trouverLigne_(prive, sku) : -1;
    // Produit sans SKU mais déjà connu sous ce nom : même SKU.
    if (!sku) {
      lignePrive = trouverLigneParNom_(prive, nom);
      if (lignePrive > 0) sku = String(prive.getRange(lignePrive, 1).getValue());
    }
    if (!sku) sku = nouveauSku_(prive);

    var libelle = LIBELLES[cle];
    var valeursPrive = [[sku, texte_(nom), libelle, prixAchat, cat.frais, prixTTC, new Date()]];
    if (lignePrive > 0) prive.getRange(lignePrive, 1, 1, ENTETES_PRIVE.length).setValues(valeursPrive);
    else prive.getRange(prive.getLastRow() + 1, 1, 1, ENTETES_PRIVE.length).setValues(valeursPrive);

    // Public : SKU, Nom, Catégorie, Prix TTC ; la Disponibilité n'est écrite qu'à la création.
    var lignePublic = trouverLigne_(pub, sku);
    if (lignePublic > 0) {
      pub.getRange(lignePublic, 1, 1, 4).setValues([[sku, texte_(nom), libelle, prixTTC]]);
    } else {
      pub.getRange(pub.getLastRow() + 1, 1, 1, ENTETES_PUBLIC.length)
        .setValues([[sku, texte_(nom), libelle, prixTTC, DISPONIBLE]]);
    }

    if (uid) cache.put(uid, sku, 21600);
    return { ok: true, sku: sku };
  } finally {
    verrou.releaseLock();
  }
}

// ===========================
// RETIRER (sans rien supprimer)
// ===========================
function retirer_(req) {
  var sku = String(req.sku || '').trim();
  var nom = String(req.nom || '').trim();
  if (!sku && !nom) return { ok: false, error: 'sku' };

  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var pub = onglet_(SpreadsheetApp.getActiveSpreadsheet(), ONGLET_PUBLIC, ENTETES_PUBLIC);
    var ligne = sku ? trouverLigne_(pub, sku) : -1;
    if (ligne < 1 && nom) ligne = trouverLigneParNom_(pub, nom);
    if (ligne < 1) return { ok: false, error: 'introuvable' };
    pub.getRange(ligne, 5).setValue(RETIRE);
    return { ok: true, sku: String(pub.getRange(ligne, 1).getValue()) };
  } finally {
    verrou.releaseLock();
  }
}

// ===========================
// LOT (toute la file d'attente en une requête)
// ===========================
// Chaque opération a sa propre réponse : un produit refusé (nom, catégorie…)
// n'empêche pas l'envoi des autres.
function lot_(req) {
  var ops = req.operations;
  if (!Array.isArray(ops) || ops.length > MAX_LOT) return { ok: false, error: 'lot' };
  var config = lireConfig_();
  var resultats = ops.map(function (op) {
    if (!op || typeof op !== 'object') return { ok: false, error: 'format' };
    try {
      if (op.action === 'enregistrer') return enregistrer_(op, config);
      if (op.action === 'retirer') return retirer_(op);
      return { ok: false, error: 'action' };
    } catch (err) {
      return { ok: false, error: 'serveur', message: String((err && err.message) || err) };
    }
  });
  return { ok: true, config: config, resultats: resultats };
}

// ===========================
// MIGRATION (à lancer une fois à la main)
// ===========================
// Renomme l'onglet existant en Historique (contenu intact) et crée Privé et
// Public à partir de ses lignes, dédoublonnées par nom (ligne la plus récente
// retenue). Ne supprime rien. Refuse de tourner deux fois.
function migrer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(ONGLET_HISTORIQUE)) {
    throw new Error('Migration déjà faite : un onglet « Historique » existe. ' +
      'Si Privé et Public sont faux, lance refaireMigration().');
  }
  if (ss.getSheetByName(ONGLET_PRIVE) || ss.getSheetByName(ONGLET_PUBLIC)) {
    throw new Error('Un onglet « Privé » ou « Public » existe déjà : migration annulée.');
  }
  var onglets = ss.getSheets();
  if (onglets.length !== 1) {
    throw new Error('La feuille doit contenir un seul onglet (l\'onglet existant) ; elle en contient ' + onglets.length + '.');
  }

  var source = onglets[0];
  var valeurs = source.getDataRange().getValues();
  var produits = preparerMigration_(valeurs);   // erreur ici = rien n'a été modifié
  source.setName(ONGLET_HISTORIQUE);
  ecrireMigration_(ss, produits, valeurs.length - 1);
}

// Pour une migration déjà lancée dont Privé et Public sont faux : les renomme
// en « … (ancien essai) » (rien n'est supprimé) et les recrée à partir
// d'Historique, qui n'est pas modifié.
function refaireMigration() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var historique = ss.getSheetByName(ONGLET_HISTORIQUE);
  if (!historique) throw new Error('Pas d\'onglet « Historique » : lance migrer().');
  var valeurs = historique.getDataRange().getValues();
  var produits = preparerMigration_(valeurs);
  [ONGLET_PRIVE, ONGLET_PUBLIC].forEach(function (nom) {
    var sh = ss.getSheetByName(nom);
    if (sh) sh.setName(nomLibre_(ss, nom + ' (ancien essai)'));
  });
  ecrireMigration_(ss, produits, valeurs.length - 1);
}

// Lit l'ancien onglet (1re ligne = en-têtes) et renvoie un produit par nom.
function preparerMigration_(valeurs) {
  if (!valeurs.length) throw new Error('L\'onglet existant est vide.');
  var col = colonnesHistorique_(valeurs[0]);
  var config = col.categorie < 0 || col.frais < 0 ? lireConfig_() : null;

  var retenues = {};
  var ordre = [];
  for (var i = 1; i < valeurs.length; i++) {
    var row = valeurs[i];
    var nom = String(row[col.nom] || '').trim();
    if (!nom) continue;
    var cle = normaliser_(nom);
    var candidate = { row: row, date: dateLigne_(row, col) };
    var actuelle = retenues[cle];
    if (!actuelle) {
      ordre.push(cle);
      retenues[cle] = candidate;
    } else if (plusRecente_(candidate, actuelle)) {
      retenues[cle] = candidate;
    }
  }

  return ordre.map(function (cle) {
    var r = retenues[cle].row;
    var prixAchat = nombre_(r[col.prixAchat]);
    var prixTTC = nombre_(r[col.prixTTC]);
    // Sans colonne catégorie : celle dont la formule redonne le prix de vente.
    var cat = col.categorie >= 0 ? cleCategorie_(r[col.categorie]) : deduireCategorie_(prixAchat, prixTTC, config);
    var frais = col.frais >= 0 ? r[col.frais] : (cat && config.categories[cat] ? config.categories[cat].frais : '');
    return {
      nom: String(r[col.nom]).trim(),
      libelle: cat ? LIBELLES[cat] : (col.categorie >= 0 ? r[col.categorie] : ''),
      prixAchat: prixAchat === null ? r[col.prixAchat] : prixAchat,
      frais: frais,
      prixTTC: prixTTC === null ? r[col.prixTTC] : prixTTC,
      date: retenues[cle].date || '',
      aVerifier: !cat
    };
  });
}

function ecrireMigration_(ss, produits, lignesLues) {
  var lignesPrive = [];
  var lignesPublic = [];
  produits.forEach(function (p, n) {
    var sku = formatSku_(n + 1);
    lignesPrive.push([sku, texte_(p.nom), p.libelle, p.prixAchat, p.frais, p.prixTTC, p.date]);
    lignesPublic.push([sku, texte_(p.nom), p.libelle, p.prixTTC, DISPONIBLE]);
  });
  var prive = onglet_(ss, ONGLET_PRIVE, ENTETES_PRIVE);
  var pub = onglet_(ss, ONGLET_PUBLIC, ENTETES_PUBLIC);
  if (lignesPrive.length) {
    prive.getRange(2, 1, lignesPrive.length, ENTETES_PRIVE.length).setValues(lignesPrive);
    pub.getRange(2, 1, lignesPublic.length, ENTETES_PUBLIC.length).setValues(lignesPublic);
  }
  var aVerifier = produits.filter(function (p) { return p.aVerifier; }).map(function (p) { return p.nom; });
  Logger.log('Migration terminée : ' + lignesLues + ' lignes lues dans Historique, ' +
    lignesPrive.length + ' produits créés dans Privé et Public.' +
    (aVerifier.length ? ' Catégorie à compléter à la main pour : ' + aVerifier.join(', ') + '.' : ''));
}

// Position de chaque colonne d'après les en-têtes (-1 si absente).
function colonnesHistorique_(entetes) {
  var noms = entetes.map(function (e) { return sansAccents_(normaliser_(e)); });
  var col = {};
  Object.keys(COLONNES_HIST).forEach(function (champ) {
    col[champ] = -1;
    for (var i = 0; i < noms.length && col[champ] < 0; i++) {
      if (COLONNES_HIST[champ].indexOf(noms[i]) >= 0) col[champ] = i;
    }
  });
  ['nom', 'prixAchat', 'prixTTC'].forEach(function (champ) {
    if (col[champ] < 0) {
      throw new Error('Colonne introuvable (' + champ + ') dans les en-têtes : ' + entetes.join(', ') +
        '. Rien n\'a été modifié.');
    }
  });
  return col;
}

// Même calcul que calcul.js (tranches cumulées, arrondi), avec la config.
function prixConfig_(base, config) {
  var prix = 0;
  var debut = 0;
  for (var i = 0; i < config.tranches.length; i++) {
    var t = config.tranches[i];
    var borne = (t.jusqua === null || t.jusqua === undefined) ? Infinity : t.jusqua;
    prix += (Math.min(base, borne) - debut) * t.coef;
    if (base <= borne) break;
    debut = borne;
  }
  var facteur = Math.round(1 / config.arrondi);
  return Math.round(prix * facteur) / facteur;
}

function deduireCategorie_(prixAchat, prixTTC, config) {
  if (prixAchat === null || prixTTC === null) return null;
  var trouvees = CATEGORIES_HISTORIQUE.filter(function (cle) {
    var cat = config.categories[cle];
    return cat && Math.abs(prixConfig_(prixAchat + cat.frais, config) - prixTTC) < 0.001;
  });
  return trouvees.length === 1 ? trouvees[0] : null;
}

// Date de la ligne : colonne date, sinon dernier « ts » de la colonne
// historique, sinon l'id s'il s'agit d'un horodatage.
function dateLigne_(row, col) {
  var d = col.date >= 0 ? lireDate_(row[col.date]) : null;
  if (d) return d;
  if (col.historique >= 0) {
    try {
      var h = JSON.parse(row[col.historique]);
      var ts = Array.isArray(h) ? Math.max.apply(null, h.map(function (x) { return Number(x && x.ts) || 0; })) : 0;
      if (ts > 0) return new Date(ts);
    } catch (e) { /* colonne illisible : on passe */ }
  }
  var id = col.id >= 0 ? Number(row[col.id]) : 0;
  return id > 1e12 ? new Date(id) : null;
}

function nomLibre_(ss, nom) {
  var candidat = nom;
  for (var n = 2; ss.getSheetByName(candidat); n++) candidat = nom + ' ' + n;
  return candidat;
}

// ===========================
// OUTILS
// ===========================
function onglet_(ss, nom, entetes) {
  var sh = ss.getSheetByName(nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    sh.getRange(1, 1, 1, entetes.length).setValues([entetes]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Numéro de ligne (1 = en-tête) du SKU en colonne A, ou -1.
function trouverLigne_(sh, sku) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  var col = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]) === sku) return i + 2;
  }
  return -1;
}

// Dernière ligne dont le nom (colonne B) correspond, ou -1.
function trouverLigneParNom_(sh, nom) {
  var n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  var cible = normaliser_(nom);
  var col = sh.getRange(2, 2, n, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (normaliser_(col[i][0]) === cible) return i + 2;
  }
  return -1;
}

function nouveauSku_(prive) {
  var max = 0;
  var n = prive.getLastRow() - 1;
  if (n > 0) {
    prive.getRange(2, 1, n, 1).getValues().forEach(function (r) {
      var m = /^UCP-(\d+)$/.exec(String(r[0]));
      if (m) max = Math.max(max, Number(m[1]));
    });
  }
  return formatSku_(max + 1);
}

function formatSku_(n) {
  var s = String(n);
  while (s.length < 4) s = '0' + s;
  return 'UCP-' + s;
}

// Accepte la clé (« tranquille ») ou le libellé (« Vin tranquille »).
function cleCategorie_(valeur) {
  var v = normaliser_(valeur);
  for (var cle in LIBELLES) {
    if (v === cle || v === normaliser_(LIBELLES[cle])) return cle;
  }
  return null;
}

function normaliser_(s) {
  return String(s === undefined || s === null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Empêche un nom commençant par =, +, - ou @ d'être lu comme une formule.
function texte_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function nombre_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var n = Number(String(v === undefined || v === null ? '' : v).trim().replace(',', '.'));
  return String(v).trim() !== '' && isFinite(n) ? n : null;
}

function sansAccents_(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Date d'une cellule : objet Date, ou texte jj/mm/aaaa (format de l'ancienne app).
function lireDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || '').trim());
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

// À date égale ou inconnue, la ligne la plus basse (ajoutée plus tard) l'emporte.
function plusRecente_(candidate, actuelle) {
  if (candidate.date && actuelle.date) return candidate.date.getTime() >= actuelle.date.getTime();
  return true;
}
