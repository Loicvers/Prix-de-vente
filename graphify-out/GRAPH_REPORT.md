# Graph Report - Prix-de-vente  (2026-10-02)

## Corpus Check
- 69 files · ~87,509 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .gs 1)

## Summary
- 547 nodes · 1157 edges · 38 communities (29 shown, 9 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e9cee565`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- outils.js
- calculateur.js
- format.js
- CALCULER_SPEC_V2.md
- synchro.js
- What You Must Do When Invoked
- core/calcul.js
- package.json
- categories.js
- fausse-feuille.js
- Installer le script de la feuille de prix
- public/manifest.json
- manifest.json
- ref_node_assert
- CALCULER_UI_MOCKUP.md
- calcul.test.js
- graphify reference: extra exports and benchmark
- Migration vers un dépôt neuf
- vite.config.mjs
- secrets.test.js
- calcul.js
- apps-script.test.js
- Compilation et publication de l'app
- Prix-de-vente
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- sw.js
- app/package.json
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- CLAUDE.md
- .claude/CLAUDE.md
- extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `$` - 37 edges
2. `sauvegarder()` - 19 edges
3. `fmt()` - 17 edges
4. `syncNow()` - 16 edges
5. `calculer()` - 16 edges
6. `categorie()` - 15 edges
7. `esc()` - 15 edges
8. `synchroniser()` - 14 edges
9. `rafraichir()` - 14 edges
10. `renderList()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `8.1 Moteur (existant, inchangé)` --references--> `fmt()`  [INFERRED]
  docs/CALCULER_SPEC_V2.md → app/src/core/format.js
- `10.1 Règle produit : même nom = même produit (D3)` --references--> `normNom()`  [INFERRED]
  docs/CALCULER_SPEC_V2.md → app/src/core/format.js
- `7.2 Règles de lecture (correction du bug B-01)` --references--> `lireMontant()`  [INFERRED]
  docs/CALCULER_SPEC_V2.md → app/src/core/format.js
- `4. Invalidation et courses` --references--> `sauvegarder()`  [INFERRED]
  docs/CALCULER_IMPLEMENTATION.md → app/src/ui/calculateur.js
- `10.4 Échec de l'enregistrement local` --references--> `sauvegarder()`  [INFERRED]
  docs/CALCULER_SPEC_V2.md → app/src/ui/calculateur.js

## Import Cycles
- 3-file cycle: `app/src/data/synchro.js -> app/src/ui/onglets.js -> app/src/ui/produits.js -> app/src/data/synchro.js`
- 3-file cycle: `app/src/ui/conflits.js -> app/src/ui/onglets.js -> app/src/ui/produits.js -> app/src/ui/conflits.js`
- 3-file cycle: `app/src/data/api.js -> app/src/ui/calculateur.js -> app/src/data/synchro.js -> app/src/data/api.js`
- 3-file cycle: `app/src/data/api.js -> app/src/ui/calculateur.js -> app/src/ui/pin.js -> app/src/data/api.js`
- 4-file cycle: `app/src/data/synchro.js -> app/src/ui/onglets.js -> app/src/ui/produits.js -> app/src/ui/conflits.js -> app/src/data/synchro.js`
- 4-file cycle: `app/src/data/api.js -> app/src/ui/calculateur.js -> app/src/ui/produits.js -> app/src/data/synchro.js -> app/src/data/api.js`
- 4-file cycle: `app/src/data/api.js -> app/src/ui/calculateur.js -> app/src/data/synchro.js -> app/src/ui/pin.js -> app/src/data/api.js`
- 5-file cycle: `app/src/data/api.js -> app/src/ui/calculateur.js -> app/src/ui/onglets.js -> app/src/ui/produits.js -> app/src/data/synchro.js -> app/src/data/api.js`
- 5-file cycle: `app/src/data/api.js -> app/src/ui/calculateur.js -> app/src/ui/produits.js -> app/src/ui/conflits.js -> app/src/data/synchro.js -> app/src/data/api.js`
- 5-file cycle: `app/src/data/api.js -> app/src/ui/calculateur.js -> app/src/ui/produits.js -> app/src/data/synchro.js -> app/src/ui/pin.js -> app/src/data/api.js`

## Communities (38 total, 9 thin omitted)

### Community 0 - "outils.js"
Cohesion: 0.05
Nodes (63): ACHATS, assert, Calcul, CATEGORIES, { describe, it, before, after }, { lancer, ouvrir, fauxScript, connecte, calculer, choisirFormat, texte, prixAffiche, CONFIG_E2E }, appareilConnecte(), assert (+55 more)

### Community 1 - "calculateur.js"
Cohesion: 0.11
Nodes (65): categorie(), cleAffichee(), estConnue(), typeDe(), esc(), fmt(), sauverProduits(), syncNow() (+57 more)

### Community 2 - "format.js"
Cohesion: 0.06
Nodes (38): Calcul, evaluerCalcul(), lignesDetail(), analyserMontant(), fmtCoef(), fmtNombre, fmtPct(), fmtPourcent (+30 more)

### Community 3 - "CALCULER_SPEC_V2.md"
Cohesion: 0.06
Nodes (33): 10.1 Règle produit : même nom = même produit (D3), 10.2 Conditions d'enregistrement, 10.4 Échec de l'enregistrement local, 10.5 Conflits, 10. Enregistrement et synchronisation, 12. États de l'écran, 14. Responsive, 15. Accessibilité (+25 more)

### Community 4 - "synchro.js"
Cohesion: 0.19
Nodes (22): SCRIPT_URL, configValide(), appelScript(), appliquerConfig(), chargerConfig(), lirePin(), scriptUrl(), etat (+14 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "core/calcul.js"
Cohesion: 0.17
Nodes (18): accises(), arrondir(), calculerPrixTTC(), coutRevient(), detailTranches(), estNombre(), frais(), marge() (+10 more)

### Community 7 - "package.json"
Cohesion: 0.11
Nodes (18): devDependencies, @fontsource/cormorant-garamond, @fontsource/jost, playwright, vite, name, private, scripts (+10 more)

### Community 8 - "categories.js"
Cohesion: 0.15
Nodes (15): CATEGORIES, cleValide(), contenanceDe(), CONTENANCES, GRILLE, GROUPES, INCONNUE, TYPES (+7 more)

### Community 9 - "fausse-feuille.js"
Cohesion: 0.15
Nodes (11): assert, { PIN, fausseFeuille, environnement }, test, VIN, assert, CODE, environnement(), fausseFeuille() (+3 more)

### Community 10 - "Installer le script de la feuille de prix"
Cohesion: 0.15
Nodes (12): 1. Coller le nouveau code, 2. Créer les propriétés PIN et CONFIG, 3. Créer le nouveau déploiement, 4. Archiver l'ancien déploiement, 5. Lancer la migration (une seule fois), 6. Contrôles, 7. Mise à jour : version 3 du script (versions, conflits, Journal), Ajouter une catégorie (par exemple les grands formats) (+4 more)

### Community 11 - "public/manifest.json"
Cohesion: 0.17
Nodes (11): background_color, description, display, icons, lang, name, orientation, scope (+3 more)

### Community 12 - "manifest.json"
Cohesion: 0.17
Nodes (11): background_color, description, display, icons, lang, name, orientation, scope (+3 more)

### Community 13 - "ref_node_assert"
Cohesion: 0.27
Nodes (8): dateCourte(), depuisServeur(), enSuspens(), fusionner(), assert, { fusionner, depuisServeur }, ligne(), test

### Community 14 - "CALCULER_UI_MOCKUP.md"
Cohesion: 0.18
Nodes (9): 1. Hiérarchie, 2. Mobile (< 600 px), une colonne, 3. Tablette (600–899 px), 4. Desktop (≥ 900 px), deux colonnes, 5. Composants, 6. États de l'étiquette, 7. Messages, 8. Accessibilité (+1 more)

### Community 15 - "calcul.test.js"
Cohesion: 0.18
Nodes (9): assert, Calcul, CAS, CAS_MAGNUM, config, FICTIVE, fs, path (+1 more)

### Community 16 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 17 - "Migration vers un dépôt neuf"
Cohesion: 0.22
Nodes (8): Contrôle final, Migration vers un dépôt neuf, Étape 1 – Installer le nouveau script (Loïc), Étape 2 – Renommer l'ancien dépôt et le passer en privé (Loïc), Étape 3 – Créer le nouveau dépôt, vide (Loïc), Étape 4 – Envoyer le code nettoyé (Claude Code), Étape 5 – Activer GitHub Pages (Loïc), Étape 6 – Premier lancement de l'app (Loïc)

### Community 18 - "vite.config.mjs"
Cohesion: 0.22
Nodes (3): APP, ICI, PUBLIC

### Community 19 - "secrets.test.js"
Cohesion: 0.22
Nodes (8): assert, fichiers(), fs, IGNORES, MOTIF, path, RACINE, test

### Community 20 - "calcul.js"
Cohesion: 0.43
Nodes (7): arrondir(), calculerPrixTTC(), configValide(), detailTranches(), estNombre(), frais(), prixTTC()

### Community 21 - "apps-script.test.js"
Cohesion: 0.25
Nodes (6): ANCIEN_FORMAT, assert, { PIN, CONFIG, fausseFeuille, environnement }, test, VIN, CONFIG

### Community 22 - "Compilation et publication de l'app"
Cohesion: 0.29
Nodes (6): Commandes, Compilation et publication de l'app, Modifier l'adresse du script dans le code, Organisation, Passage à la publication par GitHub Actions (une seule fois, Loïc), Revenir à l'ancienne app (en cas de problème)

### Community 23 - "Prix-de-vente"
Cohesion: 0.29
Nodes (6): Catégories, Contenu, Prix-de-vente, Synchronisation, Sécurité, Tests

### Community 24 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 25 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 26 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 27 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 28 - "sw.js"
Cohesion: 0.50
Nodes (3): COQUILLE, POLICES, local()

## Knowledge Gaps
- **253 isolated node(s):** `private`, `type`, `name`, `short_name`, `description` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 298 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `13. Contrats avec les modules existants` connect `format.js` to `calculateur.js`, `CALCULER_SPEC_V2.md`, `synchro.js`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `categorie()` connect `calculateur.js` to `categories.js`, `calcul.test.js`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `sauvegarder()` (e.g. with `2. Correspondance avec les responsabilités du plan 2.0` and `4. Invalidation et courses`) actually correct?**
  _`sauvegarder()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `fmt()` (e.g. with `13. Contrats avec les modules existants` and `8.1 Moteur (existant, inchangé)`) actually correct?**
  _`fmt()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `syncNow()` (e.g. with `finSync()` and `2. Correspondance avec les responsabilités du plan 2.0`) actually correct?**
  _`syncNow()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `private`, `type`, `name` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `outils.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05209274314965372 - nodes in this community are weakly interconnected._