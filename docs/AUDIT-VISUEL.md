# Visual Intelligence Audit – app « Prix de vente »

Audit visuel de l'app existante (`app/`, compilée par Vite), mené avec le cadre
*Claude Creative Design Agent V2* (Master System + modules Visual Intelligence :
Core, Analysis Engine, Design Direction, UI Visual System, Brand & Art
Direction, Visual QA & Critique).

**Aucun fichier de code n'a été modifié.** Ce document et les captures de
`docs/audit-visuel/` sont les seuls ajouts.

- Date : 28/09/2026 — commit audité : `62462eb` (`main`, étape 3).
- Méthode : app compilée (`vite build`), ouverte dans Chromium (Playwright)
  avec la fausse feuille des tests et la **config fictive** de
  `tests/e2e/outils.js` (les frais et coefficients visibles sur les captures
  ne sont pas les vrais). 17 écrans capturés en 390×844 (téléphone de
  référence), 320×568, 768×1024 et 1440×900 ; mesures de position, de taille
  des zones tactiles et de contraste (formule WCAG 2.x) calculées sur les
  jetons de `app/src/styles/app.css`.
- Hors périmètre : l'ancienne app à la racine (`index.html`, gardée en repli),
  le script Apps Script, la logique de calcul.
- Niveau de confiance (Analysis Engine §15) : **confirmé** = mesuré ou vu sur
  capture ; **probable** = déduit du code ; **possible** = hypothèse d'usage.

---

## 1. Synthèse

| | |
| --- | --- |
| **Ce qu'est l'app** | Un outil de comptoir, mono-tâche, pour une cave : choisir un format, taper un prix d'achat, lire un prix de vente, l'enregistrer. Usage répété, rapide, souvent au téléphone. |
| **Test des 5 secondes** | Réussi pour le *thème* (« Prix de vente », vin, premium), **raté pour l'action** : en 390×844, l'écran d'accueil est occupé aux trois quarts par la grille des 10 formats ; le champ de prix commence à 737 px et le prix de vente à 865 px, donc sous la barre d'onglets. Le résultat — la seule chose qu'on vient chercher — n'est jamais visible sans défiler. *(confirmé)* |
| **Identité** | Cohérente et plutôt réussie : nuit de cave (brun-bordeaux très sombre), or de capsule, serif d'étiquette pour les chiffres. L'icône (bouteille dorée + €) et la clé du bouton PIN font écho au nom « Une Autre Clé du Paradis ». |
| **Système** | Jetons de couleur et de rayon présents, mais pas de jetons d'espacement ni d'échelle typographique (15 combinaisons taille/graisse différentes à l'écran, de 10,5 à 50 px). |
| **Point faible structurel** | Le langage de couleur est **surchargé** : 10 teintes de catégorie, presque toutes chaudes (roses et ors), partagent le même espace que les couleurs d'état (danger, attente, accent). Plusieurs sont quasi identiques ; la couleur ne peut donc plus rien signifier de sûr. |

**Verdict** : belle surface, direction artistique juste, mais la hiérarchie
ne sert pas la tâche principale et le système de couleurs a atteint sa limite.
Les corrections prioritaires sont de **composition** (ramener saisie et
résultat dans le premier écran) et de **sémantique des couleurs**, pas de
style.

---

## 2. Composition

Captures : `02-calcul-vide-390.png`, `04-calcul-resultat-390-full.png`,
`11-calc-320x568.png`, `13-calc-1440.png`.

**Observé**
- Colonne unique de 560 px max, centrée, à toutes les tailles. Cartes empilées :
  Catégorie (10 boutons en 2 colonnes, 5 groupes titrés) → Prix d'achat →
  Résultat (détail + nom + Enregistrer).
- Position verticale mesurée des deux éléments clés :

  | Écran | Champ prix (haut) | Prix de vente (haut) | Hauteur visible* |
  | --- | --- | --- | --- |
  | 320×568 | 507 px | 678 px | ≈ 500 px |
  | 390×844 | 737 px | 865 px | ≈ 776 px |
  | 768×1024 | 705 px | 833 px | ≈ 956 px |
  | 1440×900 | 705 px | 833 px | ≈ 832 px |

  \* hauteur au-dessus de la barre d'onglets fixe (≈ 68 px).
- En 1440×900, 61 % de la largeur est vide ; le prix de vente reste caché sous
  la barre d'onglets alors que la place latérale est disponible.
- Aucune largeur de débordement horizontal (scrollWidth = largeur d'écran à
  toutes les tailles) — bon point.

**Interprété**
- L'ordre suit la *logique du calcul* (format → prix → résultat) et non la
  *fréquence d'usage* : on change de prix à chaque bouteille, mais de format
  bien plus rarement (le format est même mémorisé, `pv_categorie`). L'élément
  le moins changeant occupe l'espace le plus précieux.
- Le responsive est un « téléphone agrandi » : même colonne, même ordre, seul
  le prix passe de 50 à 58 px au-delà de 700 px (UI Visual System §13 : pas de
  transformation du composant).

## 3. Typographie

**Observé** (valeurs calculées à l'écran)
- DM Serif Display (400) : titre 21 px, champ prix 34 px, prix résultat 50/58 px,
  prix de liste 22 px, prix de fiche 40 px, titres de fenêtre 24 px.
- DM Sans (400/500/600/700) : 10,5 · 11 · 11,5 · 12 · 13 · 14 · 15 · 16 px.
  Corps à 15 px, métadonnées à 11,5–12 px, badge à 10,5 px.
- Polices embarquées (`@fontsource`, woff2), disponibles hors ligne ;
  `font-variant-numeric: tabular-nums` sur les montants.

**Interprété**
- Le couple serif d'étiquette / sans géométrique est *fonctionnel* : le serif
  est réservé aux montants et aux titres, il désigne « ce qui compte ». C'est
  la signature la plus forte de l'app. **À garder.**
- Mais le serif des montants n'a pas de chiffres tabulaires réels (DM Serif
  Display n'en propose probablement pas : *probable*) — dans la liste, les
  prix ne s'alignent pas à la virgule.
- Trop de pas intermédiaires (11 / 11,5 / 12 / 13) sans rôle distinct ; les
  plus petits (10,5–11,5 px) sont trop petits pour un usage debout au comptoir.
- En 320 px, le titre « Prix de vente » passe sur deux lignes et la baseline
  est coupée (« UNE AUTRE CLÉ DU… ») ; les noms de format se coupent
  (« Demi- / bouteille », « Double / magnum »). *(confirmé, `11-calc-320x568.png`)*

## 4. Couleur

**Rôles** (Master System §16) : fond `#16100f`, surfaces `#211817 / #2b201e /
#362826`, texte `#f5eee6 / #b8a898 / #8a7a6c`, accent or `#d4ad6a`, danger
`#ec8a80`, succès `#7fd19b`, attente `#e6b85c`, + **10 couleurs de catégorie**.

**Contrastes mesurés (texte)**

| Jeton | sur fond | sur surface | sur surface2 | Verdict |
| --- | --- | --- | --- | --- |
| text | 16,4 | 15,1 | 13,8 | ✅ |
| text2 | 8,2 | 7,5 | 6,9 | ✅ |
| **text3** | 4,56 | **4,21** | **3,83** | ❌ en dessous de 4,5 sur les cartes (métadonnées, infos de format, placeholders, onglets inactifs) |
| accent | 9,0 | 8,3 | 7,5 | ✅ |
| **magnum tranquille** `#c9607a` | — | **4,50** | **4,09** | ❌ nom du format sélectionné, étiquette de liste |
| 3 l tranquille `#e06a8c` | — | 5,5 | 4,98 | limite |

**Contrastes non textuels** : bordure de carte / surface = **1,22 à 1,34:1**,
bordure forte = 1,7 à 2:1 (3:1 visé par WCAG 1.4.11). Les boutons de format
sont identifiables par leur texte, donc toléré, mais les champs de saisie vides
(`01-pin-premier-lancement.png`) sont à peine délimités.

**Collisions sémantiques** (différence de couleur ΔE, < 10 = très proche ;
rapport de luminance ≈ 1 = aucune différence en niveaux de gris)

| Paire | ΔE | Conséquence observée |
| --- | --- | --- |
| attente `#e6b85c` / magnum pétillant `#d9b05a` | **4,8** | « en attente d'envoi » a la même couleur que l'étiquette de catégorie juste à côté (`06-produits-liste-390.png`, ligne Prosecco). |
| attente / 3 l pétillant `#e0aa55` | 6,3 | idem |
| magnum pétillant / 3 l pétillant | 6,1 | deux formats indiscernables |
| magnum tranquille / 3 l tranquille | 7,8 | idem |
| accent / magnum pétillant | 9,5 | la sélection, le focus et le bouton principal ont la couleur d'une catégorie |
| danger `#ec8a80` / tranquille `#e0848c` | 10,8 | le **prix d'un vin tranquille** a la couleur d'une **erreur** ; le voyant « Non synchronisé » (rouge) et la catégorie la plus fréquente se confondent (`16-sans-config.png`). |

**Interprété**
- La couleur de catégorie fait trois métiers à la fois : *identifier* un format,
  *colorer le résultat* (le chiffre principal change de couleur selon le format)
  et *décorer* (liserés, dégradé de la carte résultat). Avec 10 valeurs sur un
  arc chaud étroit, elle ne peut plus identifier (on ne distingue pas 10 roses
  et ors), et elle parasite les couleurs d'état.
- Rose pour « tranquille » évoque le rosé alors que la catégorie couvre rouges
  et blancs *(possible : lecture culturelle, à valider avec l'utilisateur)*.
- La couleur est l'unique porteur d'information sur plusieurs points
  (catégorie dans l'historique = pastille de 6 px ; état du voyant = point de
  8 px) — mais un texte l'accompagne presque toujours, ce qui limite le risque.

## 5. Imagerie et graphisme

- Aucune photo ; icônes au trait 1,8 px, arrondies, cohérentes entre elles
  (calculatrice, bouteille, horloge, loupe, clé). Icône d'app : bouteille
  dorée en dégradé + « € » en Georgia sur fond bordeaux — cohérente avec l'UI.
- Motif graphique récurrent : **liseré vertical coloré** à gauche (formats,
  produits) et **pastille ronde** (historique). C'est le seul élément de
  « langage graphique » propre ; il est utile (repère de catégorie) mais porte
  la même faiblesse que la couleur qu'il affiche.
- Le « € » du champ prix, en serif gris, est une bonne idée (affordance +
  identité) ; il est cependant masqué sous la barre d'onglets en 390×844.

## 6. Formes et espacements

**Observé** : rayons 18 (cartes), 12 (boutons, champs, formats), 22
(fenêtres), 99 (pastilles, filtres, toast), 50 % (bouton icône). Espacements
relevés dans le CSS : 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16, 18, 20, 22,
28, 48 px — pas d'échelle.

**Interprété** : les formes sont cohérentes (deux rayons dominants) ; les
espacements sont faits « à l'œil » (Analysis Engine §7). Visuellement cela
tient, mais c'est la raison pour laquelle chaque nouvel écran (conflits,
retirés) ajoute ses propres valeurs.

## 7. Hiérarchie (Analysis Engine §8)

Écran Calculer, 390×844, état initial :

1. **Premier regard** : le format sélectionné (seul élément teinté et bordé
   de couleur) et le titre doré.
2. **Deuxième** : les neuf autres formats, de poids identique.
3. **Ce qui explique l'offre** : rien — le champ prix est tronqué au bas de
   l'écran, sans libellé visible au-dessus de la ligne de flottaison.
4. **Ce qui aide à décider** : le détail du calcul, *sous* la ligne de
   flottaison.
5. **Ce qui déclenche l'action** : « Enregistrer », vers 1 170 px.

Écran Produits : la hiérarchie est bonne — nom (600) → méta (petite, grise)
→ prix serif coloré à droite. Le prix domine, comme il faut. Seule faiblesse :
les noms longs sont tronqués sur une ligne alors que la méta passe, elle, sur
deux lignes.

Fiche produit (`08-fiche-produit.png`) : excellente lecture — titre serif, prix
40 px, puis détail en tableau. « Fermer » est pourtant le bouton le plus large
de la fenêtre, plus visible que les deux actions réelles.

## 8. Interaction et états

| Élément | Observé | Remarque |
| --- | --- | --- |
| Format | `aria-pressed`, bordure + teinte + nom coloré ; `scale(.98)` au toucher | Bon. Avant iOS 16.2, `color-mix` absent ⇒ la teinte de sélection disparaît (relevé dans `ETAT-DE-REFERENCE.md`). |
| Focus clavier | Contour or 2 px sur boutons (`15-focus-clavier.png`) ; sur les champs, seule la bordure change | Visible. Sur un format « pétillant », l'or du focus ≈ l'or du format. |
| Voyant de synchro | 5 états distincts en texte ; point animé en cours | Bon principe. « Hors ligne » (gris) masque qu'un produit attend — le badge de l'onglet Produits le dit, pas le voyant. |
| Fenêtre produit | Poignée de glissement dessinée | **Aucun glissement n'est géré** (`.poignee` purement décorative *confirmé*) : affordance trompeuse. Le focus n'est pas déplacé dans la fenêtre à l'ouverture *(probable, `fenetres.js`)*. |
| Suppression | `confirm()` natif | Rupture visuelle totale avec l'app (boîte système grise). |
| Toast | Pilule flottante, action « Voir » | Bouton d'action 27×20 px ; recouvre la liste et le bas des fiches (`06`, `10`). |
| Conflits | Carte bordée d'ambre, deux versions côte à côte, deux choix | Bien construit ; ⚠ en caractère texte plutôt qu'en icône cohérente. |
| Mouvement | Apparition 0,22 s, fenêtres 0,24 s, `prefers-reduced-motion` respecté | Juste dosé. |

**Zones tactiles < 44 px (confirmé)** : voyant 82×31, bouton PIN 36×36,
action du toast 27×20. Les formats (≥ 62 px) et onglets sont confortables.

## 9. Personnalité de marque (Brand & Art Direction)

| Axe | Position actuelle |
| --- | --- |
| Traditionnel ↔ Contemporain | ●●●○○ — serif classique, UI mobile moderne |
| Minimal ↔ Expressif | ●●○○○ |
| Technique ↔ Artisanal | ●●●○○ — l'outil est technique, l'habillage évoque la cave |
| Formel ↔ Amical | ●●●●○ — tutoiement (« Ton PIN », « choisis la version à garder ») |
| Luxe ↔ Accessible | ●●○○○ — « premium discret » |
| Chaud ↔ Froid | ●○○○○ — entièrement chaud |

L'univers « cave la nuit, or de capsule, étiquette serif » est **pertinent**
(Brand rule §10 : la pertinence plutôt que l'effet). Les motifs génériques de
l'Anti-template Engine sont peu présents : pas de dégradé violet, pas de
glassmorphism décoratif (le flou de l'en-tête et de la barre a une fonction
de lisibilité), pas de hero. Le seul « réflexe de template » est le
**tout-en-cartes** : chaque bloc est une carte bordée, y compris quand il n'y a
qu'un élément (carte « Prix d'achat » contenant un seul champ).

## 10. Design DNA extrait

| DNA | Contenu |
| --- | --- |
| Typographie | Serif d'étiquette = montants et titres ; sans géométrique = interface. |
| Couleur | Nuit brun-bordeaux + or ; couleur par format. |
| Forme | Rayon 12/18, liseré vertical coloré à gauche. |
| Espacement | Colonne 560 px, marges 16 px, cartes 18 px de padding. |
| Image | Aucune photo ; icônes au trait arrondi ; bouteille dorée. |
| Mise en page | Colonne unique, barre d'onglets en bas, en-tête collant flouté. |
| Interaction | Retours discrets (toast, voyant), choix explicites en cas de conflit. |
| Marque | Premium discret, ton complice (tutoiement). |

### Keep / Adapt / Avoid

- **KEEP** — le couple serif/sans à rôles stricts ; la palette nuit + or ;
  le voyant de synchro à états textuels ; la carte de conflit à deux versions ;
  le tutoiement ; la sobriété du mouvement.
- **ADAPT** — la couleur de catégorie (la réduire à 2–3 familles et la sortir
  du chiffre principal) ; l'ordre de l'écran Calculer ; la fiche (actions
  réelles en premier) ; la grille des formats (compacte une fois un format
  choisi).
- **AVOID** — une nouvelle teinte par nouveau format ; des couleurs d'état
  dans l'arc rose/or ; les cartes « contenant un seul élément » ; les
  affordances sans comportement (poignée).
- **INSIGHT** — ce qui rend l'app agréable, c'est que *le chiffre est traité
  comme sur une étiquette de vin*. Tout ce qui renforce cette idée (grand
  serif, calme, or) est juste ; tout ce qui la dilue (10 couleurs, chiffre qui
  change de teinte) l'affaiblit.

---

## 11. Critique priorisée (Visual QA §14)

Format : **Observation → Impact → Cause → Recommandation**.

### P1 — importants

**P1-1 · Le résultat n'est jamais dans le premier écran.**
Obs. : prix de vente à 865 px pour 776 px visibles (390×844) ; champ prix
caché sous la barre en 320×568 ; même en 1440×900. → Impact : un défilement
à chaque calcul, sur la tâche principale ; en 320 px, on ne voit pas où
taper. → Cause : ordre « format → prix → résultat » et grille de formats
toujours déployée (≈ 600 px). → Reco. : placer **le prix d'achat et le
résultat en haut**, et le format choisi sous forme d'un sélecteur compact
(ligne « Tranquille · 75 cl ▾ » qui déplie la grille) ; en ≥ 900 px, deux
colonnes (formats à gauche, saisie + résultat à droite, collants).

**P1-2 · Couleurs d'état et couleurs de catégorie se confondent.**
Obs. : ΔE 4,8 entre « attente » et magnum pétillant ; ΔE 10,8 entre
« danger » et tranquille ; « en attente d'envoi » indiscernable de
l'étiquette voisine. → Impact : un statut d'envoi (information critique) se
lit comme une décoration ; un prix se lit comme une erreur. → Cause : toutes
les teintes dans le même arc chaud. → Reco. : réserver **une famille** aux
états (ex. danger nettement plus saturé/froid, attente ambre avec icône
horloge) et ramener les catégories à **2 familles tonales** (tranquille /
pétillant) + une neutre (autres), le format étant dit par le texte.

**P1-3 · Le chiffre principal change de couleur selon le format.**
Obs. : résultat rose, or, vert, violet selon la catégorie (`04`, `06`, `09`).
→ Impact : la donnée la plus importante n'a pas de couleur stable ; en
magnum tranquille elle tombe à 4,1:1. → Reco. : prix toujours en
`--text` (ou en or `--accent` pour le seul résultat du calculateur) ; la
catégorie reste signalée par le liseré et l'étiquette.

**P1-4 · Contraste du texte tertiaire insuffisant sur les cartes.**
Obs. : `--text3` = 4,21 sur surface, 3,83 sur surface2, utilisé en 11,5–12 px.
→ Reco. : éclaircir `--text3` vers ≈ `#9d8c7d` (4,9:1 sur surface2, 5,4:1 sur surface ; reste distinct de
`--text2`) et supprimer les tailles < 12 px.

**P1-5 · Zones tactiles trop petites dans l'en-tête et le toast.**
Obs. : 82×31, 36×36, 27×20. → Reco. : 44 px de hauteur minimum (zone
invisible étendue si l'on veut garder l'aspect).

**P1-6 · La fenêtre produit n'est pas un vrai dialogue.**
Obs. : poignée sans glissement ; focus non déplacé ; « Fermer » plus large que
les actions ; suppression par `confirm()` natif. → Reco. : retirer la poignée
ou gérer le glissement ; focus sur le titre à l'ouverture et retour sur la
ligne à la fermeture ; actions réelles en premier, « Fermer » en lien ou en
croix ; confirmation de suppression dans la fenêtre (deuxième appui
« Confirmer la suppression »).

### P2 — améliorations

- **P2-1 · Libellés de format répétés.** « Tranquille » / « Pétillant »
  apparaissent deux fois (75 cl et magnum), seul le titre de groupe les
  distingue. Afficher la contenance dans le bouton (« Tranquille 1,5 l »), ou
  passer à une matrice *type × contenance*.
- **P2-2 · Historique ≈ Produits.** Même liste, même ordre, mêmes prix
  (`09` vs `06`). L'onglet sert surtout à héberger le bouton « Synchroniser ».
  Clarifier la différence (historique = *calculs*, y compris non enregistrés ?)
  ou fusionner et déplacer la synchro dans le voyant.
- **P2-3 · Voyant « Hors ligne » muet sur l'attente.** Afficher « Hors ligne ·
  1 en attente » quand c'est le cas.
- **P2-4 · Aucun responsive réel.** Voir P1-1 ; en tablette, la liste de
  produits pourrait passer en tableau (nom, format, achat, vente, SKU).
- **P2-5 · Alignement des prix.** Aligner les montants à droite sur la virgule
  (chiffres tabulaires du sans pour la liste, serif réservé au résultat).
- **P2-6 · En-tête en 320 px.** Titre sur deux lignes, baseline tronquée :
  masquer la baseline ou réduire le titre sous 360 px.
- **P2-7 · Pas de jetons d'espacement ni d'échelle typographique.** Définir
  une échelle 4/8/12/16/24/32/48 et 6 niveaux de texte (caption 12, label 13,
  body 15, body-strong 15/600, title 24 serif, display 50 serif).

### P3 — raffinements

- **P3-1** Remplacer les « ⚠ » typographiques par une icône du même trait que
  le reste.
- **P3-2** Bordures de champs vides plus lisibles (`--border-fort`).
- **P3-3** Réserver le dégradé radial de la carte résultat à l'état
  « nouveau calcul » (moment de révélation), pas en permanence.
- **P3-4** Le focus or sur un format pétillant (or) se voit mal : décaler le
  contour (offset 3 px) ou utiliser `--text`.
- **P3-5** Carte « Prix d'achat » : une carte pour un seul champ ; le champ
  peut vivre directement dans la page ou fusionner avec le résultat.

### Aucun P0

Rien de bloquant : toutes les fonctions sont atteignables, lisibles et
testées (102 tests). Les défauts sont de hiérarchie, de sémantique et de
confort.

---

## 12. Pistes de direction (Master System §10)

Trois directions, à arbitrer ; aucune n'est implémentée.

**A — Controlled (évolution).** Même univers. Corrige P1-1 à P1-6 : saisie +
résultat en haut, sélecteur de format compact, prix en couleur stable,
couleurs d'état séparées, contrastes et zones tactiles. Risque : faible.
Différenciation : inchangée, mais l'app devient nettement plus rapide.

**B — Distinctive « étiquette ».** Le résultat devient une *étiquette de
prix* : bloc crème sur fond nuit, serif noir, filet or, format et contenance
composés comme sur une contre-étiquette. Les catégories perdent leurs
couleurs au profit de pictogrammes de contenance (silhouettes 37,5 cl →
5 l à l'échelle). Risque : moyen (travail d'icônes). Différenciation : forte,
et l'image de marque passe dans l'outil.

**C — Experimental « pavé de caisse ».** Écran unique : pavé numérique
intégré (plus de clavier système), prix de vente en direct au-dessus, formats
en rangée défilante sous le pavé, « Enregistrer » dans le pavé. Pensé pour
une main, au comptoir. Risque : élevé (saisie non standard, accessibilité à
reconstruire). Différenciation : maximale sur la vitesse.

Recommandation : **A maintenant**, puis intégrer l'idée d'étiquette de **B**
pour la carte résultat et la fiche produit.

---

## 13. Risques

- Toute modification visuelle doit repasser la suite e2e : plusieurs tests
  ciblent des sélecteurs et des libellés (`.cat[data-cat]`, `#resultat-prix`,
  textes du voyant).
- Réduire les couleurs de catégorie touche la mémoire visuelle acquise des
  utilisateurs actuels : à faire en une fois, pas par petites touches.
- `color-mix` reste non supporté sur les iPhone antérieurs à iOS 16.2.

## 14. Grille de QA finale (Visual QA §17)

| Critère | État |
| --- | --- |
| Marque cohérente | ✅ |
| Typographie cohérente | ⚠️ trop de tailles intermédiaires |
| Couleur intentionnelle | ❌ collisions état / catégorie |
| Mise en page alignée | ✅ |
| Espacements systématiques | ⚠️ pas d'échelle |
| Composants cohérents | ✅ boutons, champs, cartes homogènes |
| Responsive validé | ⚠️ pas de débordement, mais aucune adaptation |
| Accessibilité vérifiée | ⚠️ text3, magnum tranquille, zones tactiles, focus des fenêtres |
| Imagerie cohérente | ✅ |
| Interactions cohérentes | ⚠️ poignée factice, `confirm()` natif |
| Identité reconnaissable | ✅ |
| Rendu technique stable | ✅ aucun débordement, polices locales, mouvement réduit respecté |

## Captures

| Fichier | Écran |
| --- | --- |
| `audit-visuel/01-pin-premier-lancement.png` | Premier lancement, fenêtre PIN |
| `audit-visuel/02-calcul-vide-390.png` | Calculer, premier écran (390×844) |
| `audit-visuel/04-calcul-resultat-390-full.png` | Calculer avec résultat, page entière (la barre d'onglets fixe apparaît au milieu : artefact de capture) |
| `audit-visuel/06-produits-liste-390.png` | Produits, dont un en attente d'envoi, toast |
| `audit-visuel/08-fiche-produit.png` | Fiche produit |
| `audit-visuel/09-historique.png` | Historique, hors ligne |
| `audit-visuel/10-conflit.png` | Conflit entre deux appareils |
| `audit-visuel/11-calc-320x568.png` | Petit téléphone |
| `audit-visuel/13-calc-1440.png` | Ordinateur |
| `audit-visuel/15-focus-clavier.png` | Focus clavier sur un format |
| `audit-visuel/16-sans-config.png` | Sans config (PIN jamais saisi) |
