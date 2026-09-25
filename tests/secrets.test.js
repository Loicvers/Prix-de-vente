// Aucun coefficient, frais ni ancienne URL de script dans les fichiers publiés.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
// package-lock.json : uniquement des numéros de version de dépendances (faux positifs).
const IGNORES = new Set(['.git', 'node_modules', 'config.local.json', 'package-lock.json']);
// Mêmes motifs que le critère d'acceptation (identifiant découpé pour que ce
// fichier ne se signale pas lui-même).
const MOTIF = new RegExp(['1[.,]714', '1[.,]35', '0[.,]56', '1[.,]92', '1[.,]18', '0[.,]27', 'AKfycb' + 'zfmTfy'].join('|'));

function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap(e => {
    if (IGNORES.has(e.name)) return [];
    const p = path.join(dossier, e.name);
    return e.isDirectory() ? fichiers(p) : [p];
  });
}

test('aucune valeur confidentielle dans le dépôt', () => {
  const trouves = [];
  for (const f of fichiers(RACINE)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((ligne, i) => {
      if (MOTIF.test(ligne)) trouves.push(`${path.relative(RACINE, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(trouves, []);
});
