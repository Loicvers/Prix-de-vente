// Fausse feuille Google (en mémoire) et exécution du vrai Code.gs dedans.
// Partagé par les tests du script et les tests de l'app (tests/e2e).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CODE = fs.readFileSync(path.join(__dirname, '..', '..', 'apps-script', 'Code.gs'), 'utf8');
const PIN = '482915';
// Config fictive : seule sa forme compte ici.
const CONFIG = {
  categories: { tranquille: { frais: 3 }, mousseux: { frais: 4 }, demie: { frais: 2 }, intermediaire: { frais: 5 } },
  tranches: [{ jusqua: 10, coef: 2 }, { jusqua: null, coef: 1.5 }],
  arrondi: 0.1,
};

function fausseFeuille(nom, lignes) {
  const sh = {
    nom, data: (lignes || []).map(r => r.slice()),
    getName: () => sh.nom,
    setName: n => { sh.nom = n; return sh; },
    getLastRow: () => sh.data.length,
    setFrozenRows: () => sh,
    getDataRange: () => sh.getRange(1, 1, Math.max(sh.data.length, 1), Math.max(1, ...sh.data.map(r => r.length))),
    getRange(ligne, col, nl = 1, nc = 1) {
      const range = {
        getValues: () => Array.from({ length: nl }, (_, i) =>
          Array.from({ length: nc }, (_, j) => { const v = (sh.data[ligne - 1 + i] || [])[col - 1 + j]; return v === undefined ? '' : v; })),
        getValue: () => range.getValues()[0][0],
        setValues(v) {
          assert.equal(v.length, nl); v.forEach(r => assert.equal(r.length, nc));
          v.forEach((r, i) => {
            const idx = ligne - 1 + i;
            while (sh.data.length <= idx) sh.data.push([]);
            r.forEach((x, j) => { sh.data[idx][col - 1 + j] = x; });
          });
          return range;
        },
        setValue: x => range.setValues([[x]]),
        setFontWeight: () => range,
      };
      return range;
    },
  };
  return sh;
}

function environnement(options = {}) {
  const props = Object.assign({ PIN, CONFIG: JSON.stringify(CONFIG) }, options.props);
  const cache = new Map();
  const onglets = options.onglets || [];
  const ss = {
    getSheets: () => onglets.slice(),
    getSheetByName: n => onglets.find(s => s.nom === n) || null,
    insertSheet: n => { const s = fausseFeuille(n); onglets.push(s); return s; },
  };
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getActive: () => ss },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: t => ({ texte: t, setMimeType() { return this; } }),
    },
    Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  // Réponse brute (texte JSON), telle que l'app la reçoit.
  const postTexte = corps => ctx.doPost({ postData: { contents: typeof corps === 'string' ? corps : JSON.stringify(corps) } }).texte;
  const post = corps => JSON.parse(postTexte(corps));
  return { ctx, ss, onglets, post, postTexte, props, onglet: n => ss.getSheetByName(n) };
}

module.exports = { CODE, PIN, CONFIG, fausseFeuille, environnement };
