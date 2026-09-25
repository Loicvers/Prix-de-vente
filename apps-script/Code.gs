/**
 * Prix de vente – script Google Apps Script de la feuille de prix.
 *
 * À coller dans l'éditeur Apps Script de la feuille (voir INSTALL.md).
 * Aucun montant ici : le PIN et la config (frais, tranches, coefficients)
 * sont dans les propriétés du script (PIN et CONFIG).
 *
 * Requête : POST, corps JSON envoyé en text/plain :
 *   { pin, action: 'config' }
 *   { pin, action: 'produits' }                → { ok: true, produits: [ … ] }
 *   { pin, action: 'enregistrer', sku?, uid?, nom, categorie, prixAchat, prixTTC, version?, appareil? }
 *   { pin, action: 'retirer', sku, version?, appareil? }   (ou { nom } pour un ancien produit sans SKU)
 *   { pin, action: 'lot', appareil?, operations: [ { action: 'enregistrer', … }, { action: 'retirer', … } ] }
 *     → { ok: true, config, resultats: [ réponse de chaque opération ], produits: [ … ] }
 *     Une seule requête pour toute la file d'attente de l'app, config et
 *     liste des produits comprises.
 * Réponse : JSON { ok: true, … } ou { ok: false, error: '…' }.
 *
 * Versions et conflits : chaque produit de Privé a un numéro de Version,
 * augmenté à chaque écriture. Une app qui envoie « version » (la version
 * qu'elle connaissait) n'écrase jamais une modification faite ailleurs : si
 * la feuille a changé entre-temps, rien n'est écrit et la réponse est
 * { ok: false, error: 'conflit', sku, actuel: { … } }. Pour une nouvelle
 * fiche, l'app envoie version: 0. Sans « version » (ancienne app), l'écriture
 * se fait comme avant, et le Journal l'indique.
 * Chaque écriture, conflit ou réactivation est ajouté à l'onglet Journal.
 */

var ONGLET_PRIVE = 'Privé';
var ONGLET_PUBLIC = 'Public';
var ONGLET_HISTORIQUE = 'Historique';
var ONGLET_JOURNAL = 'Journal';

// Version et Appareil ajoutés en fin de ligne : les colonnes existantes ne
// bougent pas (les en-têtes manquants sont complétés à la première écriture).
var ENTETES_PRIVE = ['SKU', 'Nom', 'Catégorie', "Prix d'achat HT", 'Frais', 'Prix TTC', 'Date MAJ', 'Version', 'Appareil'];
var ENTETES_PUBLIC = ['SKU', 'Nom', 'Catégorie', 'Prix TTC', 'Disponibilité'];
// Onglet privé, jamais à publier : il contient les prix d'achat.
var ENTETES_JOURNAL = ['Date', 'Appareil', 'Action', 'SKU', 'Nom', 'Résultat', 'Avant', 'Après', 'Détail'];
var COL_VERSION = 8;
var COL_APPAREIL = 9;

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
      case 'produits': return json_({ ok: true, produits: listerProduits_() });
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
// ENREGISTRER (upsert par SKU, avec contrôle de version)
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
  var versionBase = lireVersionDemandee_(req.version);
  if (versionBase === false) return { ok: false, error: 'version' };
  var appareil = nomAppareil_(req.appareil);

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

    // Un envoi répété (réponse perdue) retrouve le SKU déjà attribué, et la
    // version que cet envoi avait écrite.
    var dejaEcrit = uid ? lireCacheUid_(cache.get(uid)) : null;
    if (!sku && dejaEcrit) sku = dejaEcrit.sku;
    var lignePrive = sku ? trouverLigne_(prive, sku) : -1;
    var parNom = false;
    // Produit sans SKU mais déjà connu sous ce nom : même SKU.
    if (!sku) {
      lignePrive = trouverLigneParNom_(prive, nom);
      if (lignePrive > 0) { sku = String(prive.getRange(lignePrive, 1).getValue()); parNom = true; }
    }

    var propose = { nom: nom, categorie: cle, prixAchat: prixAchat, prixTTC: prixTTC, disponibilite: DISPONIBLE };
    var actuel = lignePrive > 0 ? lireProduit_(prive, pub, lignePrive) : null;
    var nouvelleVersion = 1;

    if (actuel) {
      // Relecture sous verrou avant d'écrire : la feuille a-t-elle changé
      // depuis la version connue de l'appareil ?
      var base = versionBase;
      if (base !== null && dejaEcrit && dejaEcrit.sku === sku && dejaEcrit.version === actuel.version) base = actuel.version;
      if (base !== null && base !== actuel.version) {
        if (memesValeurs_(actuel, propose)) {
          return { ok: true, sku: sku, version: actuel.version, inchange: true };
        }
        journaliser_(ss, appareil, 'enregistrer', sku, nom, 'conflit', resume_(actuel), resume_(propose),
          (parNom ? 'même nom déjà enregistré ailleurs ; ' : '') + 'version connue ' + base + ', version de la feuille ' + actuel.version + ' ; rien n\'a été écrit');
        return { ok: false, error: 'conflit', sku: sku, actuel: produitPublic_(actuel) };
      }
      nouvelleVersion = actuel.version + 1;
    } else if (!sku) {
      sku = nouveauSku_(prive);
    }

    var libelle = LIBELLES[cle];
    var maintenant = new Date();
    var valeursPrive = [[sku, texte_(nom), libelle, prixAchat, cat.frais, prixTTC, maintenant, nouvelleVersion, appareil]];
    if (lignePrive > 0) prive.getRange(lignePrive, 1, 1, ENTETES_PRIVE.length).setValues(valeursPrive);
    else prive.getRange(prive.getLastRow() + 1, 1, 1, ENTETES_PRIVE.length).setValues(valeursPrive);

    // Public : un produit réenregistré redevient disponible.
    var lignePublic = trouverLigne_(pub, sku);
    var reactive = lignePublic > 0 && String(pub.getRange(lignePublic, 5).getValue()) === RETIRE;
    if (lignePublic > 0) {
      pub.getRange(lignePublic, 1, 1, ENTETES_PUBLIC.length).setValues([[sku, texte_(nom), libelle, prixTTC, DISPONIBLE]]);
    } else {
      pub.getRange(pub.getLastRow() + 1, 1, 1, ENTETES_PUBLIC.length)
        .setValues([[sku, texte_(nom), libelle, prixTTC, DISPONIBLE]]);
    }

    if (uid) cache.put(uid, JSON.stringify({ sku: sku, version: nouvelleVersion }), 21600);
    var details = [];
    if (versionBase === null) details.push('sans contrôle de version (ancienne app)');
    if (reactive) details.push('ancien statut : retiré ; nouveau statut : disponible');
    journaliser_(ss, appareil, reactive ? 'réenregistrer' : (actuel ? 'modifier' : 'créer'), sku, nom, 'ok',
      actuel ? resume_(actuel) : '', resume_(propose), details.join(' ; '));
    var reponse = { ok: true, sku: sku, version: nouvelleVersion };
    if (reactive) reponse.reactive = true;
    return reponse;
  } finally {
    verrou.releaseLock();
  }
}

// ===========================
// RETIRER (sans rien supprimer, avec contrôle de version)
// ===========================
function retirer_(req) {
  var sku = String(req.sku || '').trim();
  var nom = String(req.nom || '').trim();
  if (!sku && !nom) return { ok: false, error: 'sku' };
  var versionBase = lireVersionDemandee_(req.version);
  if (versionBase === false) return { ok: false, error: 'version' };
  var appareil = nomAppareil_(req.appareil);

  var verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pub = onglet_(ss, ONGLET_PUBLIC, ENTETES_PUBLIC);
    var prive = ss.getSheetByName(ONGLET_PRIVE);
    var ligne = sku ? trouverLigne_(pub, sku) : -1;
    if (ligne < 1 && nom) ligne = trouverLigneParNom_(pub, nom);
    if (ligne < 1) return { ok: false, error: 'introuvable' };
    sku = String(pub.getRange(ligne, 1).getValue());

    var lignePrive = prive ? trouverLigne_(prive, sku) : -1;
    var actuel = lignePrive > 0 ? lireProduit_(prive, pub, lignePrive) : null;
    var dejaRetire = String(pub.getRange(ligne, 5).getValue()) === RETIRE;
    if (dejaRetire) return { ok: true, sku: sku, version: actuel ? actuel.version : 0, inchange: true };

    if (actuel && versionBase !== null && versionBase !== actuel.version) {
      journaliser_(ss, appareil, 'retirer', sku, actuel.nom, 'conflit', resume_(actuel), 'retiré',
        'version connue ' + versionBase + ', version de la feuille ' + actuel.version + ' ; rien n\'a été écrit');
      return { ok: false, error: 'conflit', sku: sku, actuel: produitPublic_(actuel) };
    }

    pub.getRange(ligne, 5).setValue(RETIRE);
    var nouvelleVersion = actuel ? actuel.version + 1 : 0;
    if (actuel) {
      prive.getRange(lignePrive, COL_VERSION, 1, 2).setValues([[nouvelleVersion, appareil]]);
    }
    journaliser_(ss, appareil, 'retirer', sku, actuel ? actuel.nom : String(pub.getRange(ligne, 2).getValue()), 'ok',
      actuel ? resume_(actuel) : DISPONIBLE, RETIRE, versionBase === null ? 'sans contrôle de version (ancienne app)' : '');
    return { ok: true, sku: sku, version: nouvelleVersion };
  } finally {
    verrou.releaseLock();
  }
}

// ===========================
// PRODUITS (lecture de la source commune)
// ===========================
// Tous les produits de Privé, avec leur disponibilité (Public), pour que
// chaque appareil ait la même liste.
function listerProduits_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var prive = ss.getSheetByName(ONGLET_PRIVE);
  var pub = ss.getSheetByName(ONGLET_PUBLIC);
  if (!prive || prive.getLastRow() < 2) return [];
  var dispo = {};
  if (pub && pub.getLastRow() > 1) {
    pub.getRange(2, 1, pub.getLastRow() - 1, ENTETES_PUBLIC.length).getValues().forEach(function (r) {
      dispo[String(r[0])] = String(r[4]) === RETIRE ? RETIRE : DISPONIBLE;
    });
  }
  var lignes = prive.getRange(2, 1, prive.getLastRow() - 1, ENTETES_PRIVE.length).getValues();
  var produits = [];
  lignes.forEach(function (r) {
    var sku = String(r[0]).trim();
    if (!sku) return;
    produits.push(produitPublic_(ligneVersProduit_(r, dispo[sku] || DISPONIBLE)));
  });
  return produits;
}

function lireProduit_(prive, pub, ligne) {
  var r = prive.getRange(ligne, 1, 1, ENTETES_PRIVE.length).getValues()[0];
  var lignePublic = trouverLigne_(pub, String(r[0]));
  var dispo = lignePublic > 0 && String(pub.getRange(lignePublic, 5).getValue()) === RETIRE ? RETIRE : DISPONIBLE;
  return ligneVersProduit_(r, dispo);
}

function ligneVersProduit_(r, disponibilite) {
  var date = estDate_(r[6]) ? r[6] : lireDate_(r[6]);
  return {
    sku: String(r[0]).trim(),
    nom: String(r[1]).replace(/^'/, ''),
    categorie: cleCategorie_(r[2]),            // null : catégorie à compléter
    libelle: String(r[2] || ''),
    prixAchat: nombre_(r[3]),
    frais: nombre_(r[4]),
    prixTTC: nombre_(r[5]),
    dateMaj: date ? date.toISOString() : '',
    version: Number(r[7]) > 0 ? Math.floor(Number(r[7])) : 0,
    appareil: String(r[8] || ''),
    disponibilite: disponibilite
  };
}

// Champs renvoyés à l'app (sans les frais : elle les tient de la config).
function produitPublic_(p) {
  return {
    sku: p.sku, nom: p.nom, categorie: p.categorie, libelle: p.libelle, prixAchat: p.prixAchat,
    prixTTC: p.prixTTC, dateMaj: p.dateMaj, version: p.version, appareil: p.appareil, disponibilite: p.disponibilite
  };
}

// Même contenu : l'envoi n'apporte rien de nouveau (pas un conflit).
function memesValeurs_(actuel, propose) {
  return normaliser_(actuel.nom) === normaliser_(propose.nom) && actuel.categorie === propose.categorie &&
    actuel.prixAchat === propose.prixAchat && actuel.prixTTC === propose.prixTTC && actuel.disponibilite === propose.disponibilite;
}

// null : pas de contrôle (ancienne app) ; false : valeur invalide.
function lireVersionDemandee_(v) {
  if (v === undefined || v === null || v === '') return null;
  var n = Number(v);
  return isFinite(n) && n >= 0 && Math.floor(n) === n ? n : false;
}

// Ancien format du cache (SKU seul) ou nouveau ({ sku, version }).
function lireCacheUid_(valeur) {
  if (!valeur) return null;
  try {
    var o = JSON.parse(valeur);
    if (o && typeof o === 'object' && o.sku) return { sku: String(o.sku), version: Number(o.version) || 0 };
  } catch (e) { /* ancien format */ }
  return { sku: String(valeur), version: -1 };
}

function nomAppareil_(v) {
  var s = String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 40);
  return s ? texte_(s) : '';
}

// ===========================
// JOURNAL (on n'y fait qu'ajouter des lignes)
// ===========================
function journaliser_(ss, appareil, action, sku, nom, resultat, avant, apres, detail) {
  var j = onglet_(ss, ONGLET_JOURNAL, ENTETES_JOURNAL);
  j.getRange(j.getLastRow() + 1, 1, 1, ENTETES_JOURNAL.length)
    .setValues([[new Date(), appareil || '', action, sku || '', texte_(String(nom || '')), resultat, avant || '', apres || '', detail || '']]);
}

function resume_(p) {
  if (!p) return '';
  return [LIBELLES[p.categorie] || p.libelle || '?', 'achat ' + p.prixAchat, 'TTC ' + p.prixTTC, p.disponibilite].join(' · ');
}

// ===========================
// DIAGNOSTIC (à lancer à la main)
// ===========================
// Vérifie les propriétés PIN et CONFIG et les onglets, puis écrit le
// résultat dans le journal d'exécution. Ne modifie rien. N'affiche aucun
// montant, sauf l'extrait de CONFIG autour d'une erreur de syntaxe.
function diagnostic() {
  var props = PropertiesService.getScriptProperties();
  var ok = [];
  var problemes = [];

  var pin = props.getProperty('PIN');
  if (!pin) problemes.push('Propriété PIN absente : ajoute-la (Paramètres du projet › Propriétés du script).');
  else if (String(pin) !== String(pin).trim()) problemes.push('PIN : espace au début ou à la fin, à retirer.');
  else ok.push('PIN présent (' + String(pin).length + ' caractères).');

  var brut = props.getProperty('CONFIG');
  var config = null;
  if (!brut) {
    problemes.push('Propriété CONFIG absente.');
  } else {
    try {
      config = JSON.parse(brut);
      ok.push('CONFIG lisible.');
    } catch (err) {
      var message = String((err && err.message) || err);
      var m = /position (\d+)/.exec(message);
      var extrait = '';
      if (m) {
        var pos = Number(m[1]);
        extrait = ' Autour de l\'erreur : « ' + brut.slice(Math.max(0, pos - 25), pos) + ' ⟶ ' + brut.slice(pos, pos + 25) + ' ».';
      }
      problemes.push('CONFIG illisible (virgule, guillemet ou accolade en trop ou manquant ; décimales avec un point, pas une virgule).' +
        extrait + ' Détail : ' + message);
    }
  }

  if (config) {
    var cats = config.categories && typeof config.categories === 'object' ? config.categories : null;
    if (!cats) {
      problemes.push('CONFIG : "categories" manquant.');
    } else {
      Object.keys(cats).forEach(function (cle) {
        if (!LIBELLES[cle]) problemes.push('CONFIG : catégorie inconnue « ' + cle + ' » (faute de frappe ?). Clés possibles : ' + Object.keys(LIBELLES).join(', ') + '.');
        var frais = cats[cle] && cats[cle].frais;
        if (typeof frais !== 'number' || !isFinite(frais) || frais < 0) {
          problemes.push('CONFIG : les frais de « ' + cle + ' » doivent être un nombre sans guillemets, avec un point (ex. 6.7).');
        }
      });
      var presentes = Object.keys(LIBELLES).filter(function (cle) { return cats[cle]; });
      var absentes = Object.keys(LIBELLES).filter(function (cle) { return !cats[cle]; });
      ok.push('Catégories avec frais : ' + presentes.join(', ') + '.');
      if (absentes.length) ok.push('Catégories sans frais (affichées « frais à charger » dans l\'app) : ' + absentes.join(', ') + '.');
      CATEGORIES_HISTORIQUE.forEach(function (cle) {
        if (!cats[cle]) problemes.push('CONFIG : la catégorie de base « ' + cle + ' » a disparu.');
      });
    }
    var t = config.tranches;
    var tranchesOk = Array.isArray(t) && t.length > 0 && t.every(function (x, i) {
      var derniere = i === t.length - 1;
      return x && typeof x.coef === 'number' && x.coef > 0 &&
        (derniere ? x.jusqua === null || x.jusqua === undefined : typeof x.jusqua === 'number');
    });
    if (!tranchesOk) problemes.push('CONFIG : "tranches" abîmées (chaque tranche : "jusqua" et "coef" ; la dernière a "jusqua":null).');
    if (typeof config.arrondi !== 'number' || !(config.arrondi > 0)) problemes.push('CONFIG : "arrondi" manquant ou invalide.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [ONGLET_PRIVE, ONGLET_PUBLIC].forEach(function (nom) {
    if (ss.getSheetByName(nom)) ok.push('Onglet « ' + nom + ' » présent.');
    else problemes.push('Onglet « ' + nom + ' » absent (il sera recréé vide au prochain enregistrement : vérifie son nom).');
  });
  var privePresent = ss.getSheetByName(ONGLET_PRIVE);
  if (privePresent && String(privePresent.getRange(1, COL_VERSION).getValue()) !== 'Version') {
    ok.push('Colonnes « Version » et « Appareil » : elles seront ajoutées à Privé au prochain enregistrement.');
  }
  ok.push(ss.getSheetByName(ONGLET_JOURNAL)
    ? 'Onglet « Journal » présent (privé : ne jamais le publier).'
    : 'Onglet « Journal » : il sera créé au prochain enregistrement.');

  var texte = (problemes.length ? '❌ ' + problemes.length + ' problème(s) :\n- ' + problemes.join('\n- ') + '\n\n' : '✅ Aucun problème trouvé.\n\n') +
    'Vérifié :\n- ' + ok.join('\n- ') +
    '\n\nRappel : après avoir collé un nouveau Code.gs, il faut Déployer › Gérer les déploiements › crayon › Nouvelle version › Déployer.';
  Logger.log(texte);
  return { ok: problemes.length === 0, problemes: problemes, verifie: ok };
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
    if (op.appareil === undefined && req.appareil !== undefined) op.appareil = req.appareil;
    try {
      if (op.action === 'enregistrer') return enregistrer_(op, config);
      if (op.action === 'retirer') return retirer_(op);
      return { ok: false, error: 'action' };
    } catch (err) {
      return { ok: false, error: 'serveur', message: String((err && err.message) || err) };
    }
  });
  return { ok: true, config: config, resultats: resultats, produits: listerProduits_() };
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
    lignesPrive.push([sku, texte_(p.nom), p.libelle, p.prixAchat, p.frais, p.prixTTC, p.date, 1, 'migration']);
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
    return sh;
  }
  // Onglet d'une version précédente : on complète les en-têtes manquants en
  // fin de ligne, sans jamais toucher à ceux qui existent.
  var actuels = sh.getRange(1, 1, 1, entetes.length).getValues()[0];
  for (var i = 0; i < entetes.length; i++) {
    if (actuels[i] === '' || actuels[i] === null || actuels[i] === undefined) {
      sh.getRange(1, i + 1).setValue(entetes[i]);
    }
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

function estDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
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
