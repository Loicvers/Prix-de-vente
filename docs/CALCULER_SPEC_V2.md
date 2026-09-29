# CALCULER_SPEC_V2.md

## Spécification fonctionnelle et UX — écran « Calculer »

**Projet :** Tarif (Prix de vente — Une Autre Clé du Paradis)
**Version :** 2.3 — 29/09/2026 (D4 révisée : marge ; D15 : formats pétillants 4,5 l et 5 l)
**Statut :** spécification fonctionnelle définitive — base de `CALCULER_UI_MOCKUP.md`
**Références :** `00_MASTER_SYSTEM.md`, `DESIGN_SYSTEM_V2.md`, `UI_COMPONENT_LIBRARY_V2.md`,
`docs/ETAT-DE-REFERENCE.md`, code de `app/src/`

Ce document remplace la version 2.0, qui décrivait un parcours générique
(recherche de produit, paramètres modifiables, calcul asynchrone) ne
correspondant pas à Tarif. Tout ce qui suit est vérifié dans le code actuel
ou issu d'une décision validée (C1 à C12, D1 à D14, récapitulées en §19).
Aucun point fonctionnel n'est laissé ouvert.

En cas de conflit : `00_MASTER_SYSTEM.md` puis `DESIGN_SYSTEM_V2.md`
prévalent sur ce document. Un conflit est signalé, jamais résolu en silence.

---

## 1. Objectif et mission de l'écran

Calculer le **prix de vente TTC** d'une bouteille à partir de son **format**
et de son **prix d'achat HT**, montrer **comment ce prix est obtenu**, puis,
si l'utilisateur le souhaite, **enregistrer** le produit sous un nom.

L'écran répond immédiatement à trois questions :

1. Pour quel format est-ce que je calcule ?
2. Quel est le prix de vente TTC ?
3. Comment ce prix a-t-il été obtenu ?

Le prix de vente TTC est l'élément visuel dominant. Le nom du produit n'est
**pas** une donnée du calcul : il n'intervient qu'à l'enregistrement.

## 2. Périmètre

### Inclus

- Choix du format parmi les 10 formats de référence (§6).
- Saisie du prix d'achat HT (§7).
- Affichage immédiat du prix de vente TTC (§8).
- Détail du calcul fidèle au moteur (§9).
- Saisie du nom et enregistrement sur l'appareil, puis synchronisation (§10).
- Parcours secondaire « Recalculer » depuis la fiche produit (§11).
- États : config absente, format sans frais, saisie vide ou invalide,
  résultat valide, enregistrement, échec d'enregistrement local (§12).
- Responsive 320 à 1440 px et accessibilité (§14, §15).

### Hors périmètre

- Recherche ou sélection d'un produit dans Calculer (la recherche reste dans
  l'onglet Produits).
- Modification des frais, tranches, coefficients ou arrondi : ils viennent
  uniquement de la propriété `CONFIG` du script et sont en lecture seule.
- Affichage d'un coefficient global (la marge est affichée dans le détail depuis D4 révisée, §9.1).
- Affichage du SKU dans Calculer (**D3**).
- Action « réinitialiser / revenir aux valeurs de référence » (n'existe pas).
- Recalcul automatique des prix déjà enregistrés quand la config change
  (limite connue, hors écran).
- Modification des libellés écrits dans la feuille Google (`LIBELLES` de
  `apps-script/Code.gs`) ; la table du §6 ne concerne que l'affichage de l'app.
- Correction du risque R-01 (perte de la file d'attente quand la mémoire est
  pleine) au-delà de ce qu'exige le §10.4.

## 3. Principes fonctionnels

1. **Le prix d'abord.** Rien ne repousse le prix de vente derrière une grille
   de formats ; le sélecteur de format est fermé par défaut.
2. **Aucune donnée inventée.** Pas de résultat d'exemple, pas de zéro ni de
   format par défaut substitué en silence à une donnée absente.
3. **Un seul moteur.** Le prix affiché, le détail et le prix enregistré
   viennent du même appel à `core/calcul.js`, avec les mêmes entrées.
4. **Local d'abord.** Enregistrer ne dépend jamais du réseau ; la
   synchronisation est un état distinct, affiché par le voyant.
5. **Jamais d'ancien résultat trompeur.** Si l'entrée devient invalide, le
   montant est remplacé par un état explicite, pas conservé.
6. **Pas de logique métier dans l'UI.** Les composants reçoivent des données
   et émettent des événements.

## 4. Parcours principal

1. L'utilisateur ouvre l'onglet Calculer. Le format mémorisé (`pv_categorie`)
   est affiché, sélecteur fermé ; le champ prix d'achat est vide.
2. Il change de format si besoin (sélecteur ouvert à la demande, refermé dès
   le choix, focus renvoyé au champ prix).
3. Il saisit le prix d'achat HT. À chaque frappe valide, le prix de vente TTC
   est recalculé et affiché.
4. Il consulte le détail du calcul s'il le souhaite.
5. Il saisit un nom et enregistre (bouton ou Entrée dans le champ nom).
6. L'app confirme « enregistré sur l'appareil » ; le voyant indique ensuite
   l'état réel de la synchronisation.

Les étapes 5 et 6 sont facultatives : calculer sans enregistrer est un usage
normal, sans trace dans l'Historique (**D6**).

## 5. Structure de l'écran (D1)

Ordre fonctionnel, identique à l'ordre de tabulation :

| # | Zone | Composant (bibliothèque) | Contenu |
|---|---|---|---|
| 0 | Alerte config | `Status` (danger) | Seulement si la config est absente (§12.1). |
| 1 | Format | `FormatSelector` / `FormatOption` | Format courant, fermé par défaut. |
| 2 | Prix d'achat HT | `PriceInput` | Champ décimal, unité €. |
| 3 | Prix de vente TTC | `PriceLabel` (+ `CalculationResult`) | Étiquette crème, montant dominant, libellé du format. |
| 4 | Détail du calcul | `CalculationDetail` | Repliable, dans l'étiquette (sous le filet or). |
| 5 | Nom du produit | `ProductNameInput` | Label visible. |
| 6 | Enregistrer | `SaveAction` (Button Primary) | États §10.3. |

Règles de structure :

- **Pas de titre de page** « Calculer » ni de description : l'onglet actif et
  l'en-tête global (≈ 64 px) suffisent (C9).
- Le voyant de synchronisation et le bouton PIN restent dans l'en-tête global ;
  ils ne sont pas dupliqués dans l'écran.
- **Condition de D1 :** placer le format en premier n'est acceptable que parce
  que le sélecteur est compact. Sur 390 × 844, sélecteur fermé et clavier
  masqué, le montant du prix de vente doit être visible sans défilement.
  L'ouverture du sélecteur ne doit pas laisser la grille ouverte après le
  choix.
- Les zones 5 et 6 restent visibles et utilisables quand le détail est
  replié ; le détail ouvert ne doit jamais masquer l'action (clavier compris).

Arbitrage documentaire : D1 retient l'ordre de `UI_COMPONENT_LIBRARY_V2` §40
(format avant étiquette) et non celui de `DESIGN_SYSTEM_V2` §18 (résultat
avant format). `DESIGN_SYSTEM_V2` §18 et `UI_COMPONENT_LIBRARY_V2` §72 sont à
mettre à jour en conséquence (§18 de ce document).

## 6. Formats — table de référence unique (D2)

### 6.1 Règles

- Les **clés** sont un contrat : elles sont stockées (`pv_categorie`,
  `pv_produits_v2`, `pv_historique`), envoyées au script et présentes dans
  `CONFIG`. Elles ne changent pas.
- La table vit à un seul endroit : `app/src/core/categories.js` (objet
  `CATEGORIES`, déjà source unique), enrichi d'un libellé V2 et d'une famille.
  Calculer, Produits, Historique, filtres et fiche produit l'utilisent tous ;
  aucun libellé de format n'est écrit ailleurs.
- L'ordre et les regroupements restent ceux de `GROUPES`.
- Le libellé V2 est non ambigu : aucun autre format ne porte le même texte.

### 6.2 Table

| Clé | Libellé actuel (`label`) | Libellé V2 | Famille | Groupe |
|---|---|---|---|---|
| `tranquille` | Vin tranquille | Tranquille · 75 cl | tranquille | Bouteille 75 cl |
| `mousseux` | Vin mousseux / pétillant | Pétillant · 75 cl | pétillant | Bouteille 75 cl |
| `magnum_tranquille` | Magnum tranquille (1,5 l) | Magnum tranquille · 1,5 l | tranquille | Magnum 1,5 l |
| `magnum_mousseux` | Magnum pétillant (1,5 l) | Magnum pétillant · 1,5 l | pétillant | Magnum 1,5 l |
| `3l_tranquille` | Double magnum tranquille (3 l) | Double magnum tranquille · 3 l | tranquille | 3 litres |
| `3l_mousseux` | Jéroboam pétillant (3 l) | Jéroboam pétillant · 3 l | pétillant | 3 litres |
| `4_5l_tranquille` | Tranquille 4,5 l | Tranquille · 4,5 l | tranquille | 4,5 et 5 litres |
| `5l_tranquille` | Jéroboam tranquille (5 l) | Jéroboam tranquille · 5 l | tranquille | 4,5 et 5 litres |
| `demie` | 37,5 cl | Demi-bouteille · 37,5 cl | autre (D10) | Autres formats |
| `intermediaire` | Produit intermédiaire 75cl | Intermédiaire · 75 cl | autre | Autres formats |

Contenances écrites en minuscules, « cl » et « l », partout (D13).

Informations complémentaires conservées : `intermediaire` garde sa mention
« Maury, Porto, VDN… » comme aide sous le libellé.

Catégorie absente ou inconnue (produit migré) : libellé « Format à
compléter », famille « autre ». Elle n'est **jamais** remplacée par
`tranquille` dans Calculer (voir §11.3).

Familles et couleur (`DESIGN_SYSTEM_V2` §6) : la famille peut porter une
couleur discrète (`--color-category-still`, `-sparkling`, `-other`), jamais
seule, jamais sur le prix de vente, jamais sur l'or.

### 6.3 Sélecteur de format

- **Fermé** : libellé « Format » + libellé V2 du format courant + chevron.
- **Ouvert** : les 10 options groupées selon `GROUPES`, choix unique
  (sémantique radio), cibles ≥ 44 × 44 px, sélection visible sans couleur.
- Sélecteur ouvert : chaque option affiche, sous le libellé, les frais du
  format (« + x,xx € de frais ») quand la config est chargée — comportement
  actuel conservé — ou « frais à charger » si le format manque dans la config.
- Sélecteur fermé : **pas de frais** (D12). Les frais du format choisi
  figurent dans le détail du calcul (ligne « Frais fixes »).
- Le choix est mémorisé dans `pv_categorie`, recalcule immédiatement,
  referme le sélecteur et renvoie le focus au champ prix d'achat.
- Échap referme le sélecteur sans changer de format.

## 7. Saisie du prix d'achat HT (D5)

### 7.1 Champ

- Label visible « Prix d'achat HT », unité « € » à côté du champ.
- `inputmode="decimal"`, `enterkeyhint` conservé, taille de saisie ≥ 16 px.
- Recalcul à chaque saisie (au plus une fois par image, comme aujourd'hui).
- Entrée dans le champ prix → focus sur le champ nom (comportement conservé).

### 7.2 Règles de lecture (correction du bug B-01)

La fonction `lireMontant` (`core/format.js`) est la seule à lire un montant.
Avant analyse, on retire les espaces (y compris insécables) et le symbole €.

| Cas | Règle | Exemples |
|---|---|---|
| Une virgule, aucun point | la virgule est décimale | `12,50` → 12,50 ; `10,8` → 10,80 |
| Un point, aucune virgule | le point est décimal (compatibilité) | `12.50` → 12,50 |
| Virgule et point(s) | les points sont des séparateurs de milliers, la virgule est décimale | `1.234,56` → 1234,56 |
| Espaces de milliers | ignorés | `1 234,56` → 1234,56 |
| Aucun séparateur | entier | `12` → 12,00 |

Sont **invalides** :

- plusieurs virgules ;
- un point de milliers qui ne sépare pas un groupe de 3 chiffres
  (`1.23,50`) ou un point placé après la virgule ;
- plusieurs points sans virgule (`1.234.567`) : une suite de séparateurs de
  milliers sans partie décimale n'est pas une saisie valide (D11) ;
- tout caractère autre que chiffres, séparateurs, espaces et € (aujourd'hui
  `parseFloat` accepte « 12abc » comme 12 : ce ne sera plus le cas) ;
- zéro ou négatif (règle actuelle conservée).

Les saisies acceptées aujourd'hui restent acceptées, à l'exception des
chaînes contenant des caractères parasites. Le test `BUG CONNU B-01` est
inversé volontairement.

### 7.3 Messages de saisie

| Situation | Affichage |
|---|---|
| Champ vide | Pas d'erreur. L'étiquette affiche un état d'attente : « Saisis un prix d'achat », sans montant. |
| Illisible | Sous le champ, associé par `aria-describedby` : « Montant illisible : écris par exemple 12,50 ». |
| Zéro ou négatif | « Le prix d'achat doit être supérieur à 0 ». |

Dans les deux derniers cas, l'étiquette n'affiche aucun montant (« — » et
« Prix indisponible »), jamais l'ancien résultat. La saisie n'est pas
effacée. Le message apparaît sans interrompre la frappe (pas de `role="alert"`
à chaque touche).

## 8. Moteur de calcul et prix de vente TTC

### 8.1 Moteur (existant, inchangé)

`app/src/core/calcul.js` :

1. `base = prix d'achat HT + frais du format` (`frais(categorie, config)`) ;
2. la base est découpée en tranches cumulées (`detailTranches`) ; chaque part
   est multipliée par le coefficient de sa tranche ;
3. la somme est arrondie au pas `config.arrondi` (`calculerPrixTTC`) ;
4. le résultat est le **prix de vente TTC**.

Le calcul est local, synchrone et instantané : il n'y a **pas** d'état
« calcul en cours ». Aucune valeur (frais, tranche, coefficient, arrondi)
n'apparaît dans le code ni dans ce document.

Le formatage (`fmt`, `Intl.NumberFormat('fr-BE')`, 2 décimales, « € ») ne
modifie jamais la valeur métier.

### 8.2 Étiquette « Prix de vente TTC » (D7)

- Composant `PriceLabel` : surface crème, texte sombre, montant en
  DM Serif Display (`--type-display` ou `--type-price-lg`), filet or.
- Libellé fixe : **« Prix de vente TTC »** ; dessous, le libellé V2 du format.
- Le prix n'est **plus coloré selon le format** (abandon de
  `data-cat` sur le résultat).
- L'étiquette est toujours présente (pas de saut de mise en page) ; son
  contenu suit les états du §12.
- Mise à jour annoncée par une zone `aria-live="polite"` limitée au montant
  et au format (pas au détail), par exemple « Prix de vente TTC 24,90 € ».

## 9. Détail du calcul

- Généré à partir du **même** appel au moteur que le prix affiché.
- Lignes, dans l'ordre (D4 révisée) :
  1. Prix d'achat HT ;
  2. Frais fixes (+ texte `detail` de la config s'il existe) ;
  3. dont accises — seulement si la config les distingue (§9.1) ;
  4. Coût de revient HT (= ancienne « base de calcul ») ;
  5. une ligne par tranche utilisée : « début → fin × coefficient » et montant ;
  6. Prix de vente TTC arrondi, séparé visuellement ;
  7. Prix de vente HT ;
  8. Marge (€) ;
  9. Marge % (une décimale).
- Libellés à gauche, montants à droite, chiffres tabulaires.
- Pas de « coefficient global ».
- Repliable. On distingue **l'état initial** et **la préférence mémorisée**
  (D9) :
  - sans préférence mémorisée : replié sous 900 px, ouvert à partir de 900 px
    (largeur lue à l'ouverture de l'écran) ;
  - dès que l'utilisateur ouvre ou ferme le détail, ce choix est mémorisé dans
    `pv_detail` et s'applique ensuite quelle que soit la largeur ;
  - seule une action de l'utilisateur écrit la préférence ; une ouverture ou
    fermeture faite par l'app (état initial) n'écrit rien.
- Reprise de l'existant : aujourd'hui, l'app ouvre le détail au démarrage par
  programme, ce qui déclenche l'écriture de `pv_detail = '1'` chez **tous**
  les utilisateurs, sans action de leur part. Une valeur `'1'` héritée ne
  prouve donc aucun choix. Règle retenue, avec la même clé :
  - V2 écrit `pv_detail` = `'ouvert'` ou `'ferme'` ;
  - valeur héritée `'0'` (écrite seulement quand l'utilisateur a replié) :
    lue comme « fermé » ;
  - valeur héritée `'1'`, absente ou illisible : aucune préférence, état
    initial responsive.
### 9.1 Marge, TVA et accises (D4 révisée)

- Coût de revient HT = prix d'achat HT + frais fixes HT, **accises comprises**.
- Prix de vente HT = prix de vente TTC arrondi / (1 + taux de TVA).
- Marge € = prix de vente HT − coût de revient HT.
- Marge % = marge € / prix de vente HT × 100.
- La marge est calculée **après** le prix : elle ne change rien au calcul du
  prix de vente (moteur `core/calcul.js`, fonctions `tauxTVA`, `accises`,
  `coutRevient`, `marge`).
- Données de la propriété `CONFIG` du script, jamais du code :
  - `"tva"` au premier niveau (taux, ex. `0.21` pour 21 %) ;
  - `"accises"` par format, facultatives, **partie des `"frais"`** (« dont
    accises ») : elles ne sont jamais ajoutées une seconde fois ; des accises
    plus grandes que les frais sont refusées.
- TVA absente ou invalide : prix calculé normalement, ligne « Marge :
  indisponible : taux de TVA absent (ou invalide) de la config ».
- Accises invalides : ligne « dont accises : invalides dans la config » ; le
  coût reste achat + frais.
- La fiche produit reprend le détail jusqu'aux tranches (avec « dont
  accises » et « Coût de revient HT »), sans la marge.
- Les montants réels des frais et accises sont confidentiels : jamais dans le
  dépôt (tests avec des valeurs fictives).

- Sémantique : liste de paires libellé / montant (`dl`) ou tableau à deux
  colonnes ; le choix final se fait en maquette, avec en-têtes associés si
  tableau.
- La formulation de l'exemple de `UI_COMPONENT_LIBRARY_V2` §16 est à corriger
  (lignes « Frais fixes » et « Base de calcul » manquantes).

## 10. Enregistrement et synchronisation

### 10.1 Règle produit : même nom = même produit (D3)

- Hors parcours « Recalculer », le nom identifie le produit : un nom identique
  à un produit existant (comparaison `normNom` : casse et espaces ignorés) met
  à jour ce produit, qui garde son SKU. Comportement actuel conservé.
- Ce comportement est rendu **visible sans parler de SKU** (D14) : quand le
  nom saisi correspond à un produit existant, une ligne d'aide sous le champ
  indique, avant l'enregistrement, « Ce produit existe déjà : il sera mis à
  jour. » Elle se met à jour pendant la frappe (comparaison `normNom`) et
  n'est pas une erreur.
- Le SKU n'est jamais affiché dans Calculer.

Règle complète du champ nom (D8 + D14) :

| Mode | Nom saisi | Résultat | Message sous le champ |
|---|---|---|---|
| Nouveau calcul | Nom d'aucun produit | Création | — |
| Nouveau calcul | Nom d'un produit existant | Mise à jour de ce produit | Aide : « Ce produit existe déjà : il sera mis à jour. » |
| Modification (§11) | Nom du produit en cours de modification (inchangé ou casse / espaces différents) | Mise à jour de ce produit | Aide : « Ce produit existe déjà : il sera mis à jour. » |
| Modification (§11) | Nom d'aucun produit | Renommage de ce produit, SKU conservé | — |
| Modification (§11) | Nom d'un **autre** produit existant | **Bloqué** (D8) : rien n'est enregistré, ni sur l'appareil ni dans la file d'envoi | Erreur : « Un autre produit porte déjà ce nom. Choisis un autre nom. » |

Les produits retirés comptent comme existants, comme aujourd'hui : enregistrer
leur nom en nouveau calcul les met à jour et les remet en vente ; l'aide le
précise alors (« Ce produit existe déjà (retiré) : il sera mis à jour et remis
en vente. »).

### 10.2 Conditions d'enregistrement

| Condition | Comportement |
|---|---|
| Config absente | Enregistrer ouvre l'écran PIN (« Connecte-toi une première fois avec ton PIN »). |
| Format sans frais dans la config | Bouton désactivé, raison affichée (§12.2). |
| Prix d'achat vide ou invalide | Bouton désactivé ; si activé au clavier, focus sur le champ prix. |
| Nom vide | Message associé au champ : « Donne un nom au produit », focus sur le champ. |
| Mode modification, nom d'un autre produit | Bouton désactivé, erreur sous le champ (D8). |
| Format « à compléter » (§11.3) | Bouton désactivé tant qu'aucun format n'est choisi. |
| Hors ligne | **Aucun blocage.** L'enregistrement local se fait normalement. |

### 10.3 Déroulé et états de `SaveAction`

1. Le prix est recalculé par le moteur avec les entrées courantes (même
   calcul que l'affichage).
2. Le produit est écrit dans `pv_produits_v2`, l'entrée ajoutée à
   `pv_historique`, un éventuel retrait en attente du même produit annulé
   (`pv_retraits`) — logique actuelle de `sauvegarder()`.
3. **Seulement si l'écriture locale a réussi** :
   - confirmation « Enregistré sur l'appareil » (état du bouton, puis toast
     « <nom> enregistré · <prix> » avec l'action « Voir » ≥ 44 × 44 px) ;
   - champ nom vidé, format et prix d'achat conservés ;
   - badge Produits mis à jour ;
   - synchronisation lancée (`syncNow`).
4. Le voyant de l'en-tête affiche ensuite l'état réel : en cours, en attente
   (avec le nombre exact), hors ligne, erreur, conflit, puis « Synchronisé »
   seulement après `ok: true` du script et file vide (règle actuelle).

États du bouton : `Enregistrer` → `Enregistré sur l'appareil` (bref, puis
retour à `Enregistrer`) ; pas d'état « Enregistrement… » long, l'écriture
étant locale. Les doubles soumissions rapprochées créent une seule mise à
jour (même nom = même produit), sans doublon.

« Enregistré sur l'appareil » et « Synchronisé » ne sont jamais confondus :
le premier ne promet rien sur la feuille Google.

### 10.4 Échec de l'enregistrement local

Aujourd'hui, `stockage.ecrire` signale « Mémoire de l'appareil pleine » mais
`sauvegarder()` affiche quand même le succès. En V2 :

- `stockage.ecrire` indique si l'écriture a réussi ;
- en cas d'échec : pas de confirmation de succès, message « Mémoire de
  l'appareil pleine : le produit n'est pas enregistré. », nom et prix
  conservés dans les champs ;
- l'état en mémoire ne doit pas faire croire à un produit enregistré après
  rechargement.

### 10.5 Conflits

Un conflit (modification faite sur un autre appareil) est détecté par le
script et résolu dans l'onglet Produits (carte de conflit). Calculer ne le
résout pas ; il n'écrase rien : le voyant affiche « n conflit(s) » et mène à
sa résolution.

## 11. Parcours secondaire « Recalculer »

### 11.1 Entrée

Fiche produit → « Recalculer » → onglet Calculer prérempli avec :

- le format du produit ;
- le prix d'achat HT enregistré (champ vide si absent dans la feuille) ;
- le nom.

Le focus est placé sur le champ prix d'achat ; le prix de vente est recalculé
avec la config **actuelle** (il peut donc différer du prix enregistré).

### 11.2 Mode modification (correction du bug B-02)

Aujourd'hui, « Recalculer » ne fait que remplir les champs ; changer le nom
crée un second produit avec un nouveau SKU (B-02). En V2 :

- Calculer passe en **mode modification**, lié au produit par son identité
  (`id`, et `sku` s'il existe), plus par son nom.
- Un bandeau l'indique : « Tu modifies « <nom> » » avec l'action
  « Nouveau calcul » (quitte le mode, vide le nom, garde format et prix).
- Si le prix enregistré diffère du prix recalculé, les deux sont montrés
  (« Prix enregistré : x,xx € »).
- Le bouton devient « Enregistrer les modifications ».
- À l'enregistrement, **ce** produit est mis à jour, même si son nom a
  changé : c'est un renommage, le SKU est conservé. Le script le permet déjà
  (il identifie par SKU quand il est fourni) ; seule l'app change.
- Si le nouveau nom est celui d'**un autre** produit existant : enregistrement
  bloqué, aucune modification enregistrée, message d'erreur (§10.1, D8).
- Produit retiré : le bandeau précise « Ce produit est retiré :
  l'enregistrer le remet en vente. » (comportement actuel du script).
- Le mode se termine après l'enregistrement, avec « Nouveau calcul », ou si le
  produit est supprimé entre-temps (le bandeau l'indique, l'enregistrement
  recrée alors un produit après confirmation).
- Le test `BUG CONNU B-02` est inversé volontairement.

### 11.3 Données absentes

- Format inconnu ou vide (« à compléter ») : aucun format n'est présélectionné
  (aujourd'hui `cleValide` impose `tranquille` en silence) ; le sélecteur
  s'ouvre et l'enregistrement reste impossible tant qu'un format n'est pas
  choisi.
- Prix d'achat absent : champ vide, état « Saisis un prix d'achat ».

## 12. États de l'écran

| # | État | Format | Étiquette | Enregistrer |
|---|---|---|---|---|
| 12.1 | **Config absente** (jamais connecté, ou config invalide) | Options visibles sans frais | « Prix indisponible » + « Connecte-toi une première fois avec ton PIN » + action « Entrer mon PIN » | Ouvre l'écran PIN |
| 12.2 | **Format sans frais** (config en cache antérieure au format) | Option marquée « frais à charger » | « Prix indisponible » + message PIN actuel et aide « ajoute la clé dans CONFIG » | Désactivé, raison affichée |
| 12.3 | **Prix vide** | Normal | « Saisis un prix d'achat » | Désactivé |
| 12.4 | **Prix invalide** | Normal | « — » / « Prix indisponible » ; message sous le champ (§7.3) | Désactivé |
| 12.5 | **Résultat valide** | Normal | Montant + format + détail | Actif |
| 12.6 | **Enregistré** | Normal | Inchangée | « Enregistré sur l'appareil », puis retour |
| 12.7 | **Échec local** | Normal | Inchangée | Message §10.4, saisies conservées |
| 12.8 | **Mode modification** | Prérempli | Résultat + prix enregistré si différent | « Enregistrer les modifications » |

États volontairement **absents** : chargement du calcul, calcul en cours,
calcul asynchrone (le calcul est instantané). Hors ligne n'est pas un état de
l'écran : il n'empêche rien et s'affiche dans le voyant.

## 13. Contrats avec les modules existants

| Module | Rôle pour Calculer | Évolution demandée |
|---|---|---|
| `core/calcul.js` | Seule autorité du calcul et du détail des tranches | Aucune |
| `core/categories.js` | Table unique des formats | Ajouter libellé V2 et famille (§6) ; ne plus substituer `tranquille` à un format inconnu hors démarrage |
| `core/format.js` | `fmt`, `fmtCoef`, `lireMontant`, `normNom` | Nouvelle lecture de `lireMontant` (§7.2) |
| `data/etat.js` | État partagé : `currentCat`, `config`, `produits`, `historique`, `retraits` | Ajouter le produit en cours de modification (§11.2) |
| `data/stockage.js` | Accès à `localStorage` | `ecrire` renvoie un succès ou un échec (§10.4) |
| `data/synchro.js` | File d'attente, `syncNow`, `enAttente`, `nombreConflits` | Aucune |
| `ui/calculateur.js` | Rendu et événements | Sortir de `sauvegarder()` et `detailHtml()` la logique métier (recherche du produit, construction de l'enregistrement, lignes du détail) vers un module sans DOM |
| `ui/statut.js` | Voyant | Aucune pour Calculer |

Contrat de stockage conservé : `pv_categorie`, `pv_config`, `pv_detail`,
`pv_historique`, `pv_produits_v2`, `pv_retraits` (mêmes clés, mêmes formats,
anciennes données relues). Seule exception : les valeurs de `pv_detail`
(§9, D9), avec relecture des anciennes valeurs.

Événements UI (noms indicatifs, alignés sur `UI_COMPONENT_LIBRARY_V2` §58) :
`onFormatChange`, `onPriceChange`, `onDetailToggle`, `onNameChange`,
`onSave`, `onRecalculate` (entrée du mode modification), `onNewCalculation`.

## 14. Responsive

Seuils de `DESIGN_SYSTEM_V2` §16 : < 600, 600–899, ≥ 900, ≥ 1200 px.

- **< 600 px** : une colonne, ordre du §5. Marges latérales 16 px. Aucune
  ligne critique coupée à 320 px (libellés de format longs compris :
  « Double magnum tranquille · 3 l » passe à la ligne, jamais tronqué).
  Sur 390 × 844, sélecteur fermé : prix d'achat et prix de vente visibles sans
  défilement. La barre d'onglets ne masque ni le champ nom ni « Enregistrer ».
- **600–899 px** : une colonne élargie, largeur de lecture maîtrisée ;
  sélecteur ouvert en grille plus dense.
- **≥ 900 px** : deux colonnes. Gauche : format, prix d'achat, nom,
  enregistrer. Droite : étiquette et détail, sticky. L'ordre de tabulation
  suit l'ordre du DOM (§5) ; on accepte que le détail (droite) vienne après
  « Enregistrer » au clavier, ou on place le détail avant le nom dans le DOM :
  choix à faire en maquette, en gardant ordre visuel = ordre de tabulation.
- **≥ 1200 px** : même composition, colonnes plafonnées, pas d'étirement.

## 15. Accessibilité

- Labels visibles pour le prix, le nom et le groupe de formats.
- Sélecteur : bouton `aria-expanded` + groupe radio ; flèches entre options.
- Messages d'erreur liés au champ (`aria-describedby`), textuels.
- Annonce polie du nouveau prix, sans annonces à chaque frappe invalide.
- Focus visible 2 px `--color-focus` ; **sur l'étiquette crème, le focus or
  n'est pas assez contrasté** : un token de focus sur surface claire est
  nécessaire (voir §18).
- Cibles ≥ 44 × 44 px (options de format, bouton, action du toast, résumé du
  détail).
- Aucun état porté par la seule couleur ; texte informatif ≥ 12 px.
- `prefers-reduced-motion` : ouverture du sélecteur et du détail sans
  animation.

## 16. Bugs et limites à traiter

| Réf. | Constat | Traitement |
|---|---|---|
| B-01 | « 1.234,56 » lu 1,234 | Corrigé (§7.2), test inversé |
| B-02 | Recalculer puis renommer crée un second produit | Corrigé (§11.2), test inversé |
| — | Succès affiché malgré un échec d'écriture locale | Corrigé (§10.4), test ajouté |
| — | Format inconnu remplacé par `tranquille` au Recalculer | Corrigé (§11.3), test ajouté |
| — | Prix coloré selon le format | Supprimé (§8.2) |
| — | Saisie invalide : résultat masqué sans explication | Message (§7.3) |
| R-01 | File d'attente perdue si mémoire pleine hors ligne | Hors périmètre, hormis §10.4 |

## 17. Critères d'acceptation

1. L'écran suit l'ordre Format → Prix d'achat HT → Prix de vente TTC →
   Détail → Nom → Enregistrer, sans titre de page.
2. Sur 390 × 844, sélecteur fermé, le prix de vente est visible sans
   défilement après saisie.
3. Les 10 formats utilisent les libellés V2 de la table unique, identiques
   dans Calculer, Produits, Historique, filtres et fiche.
4. Le prix de vente est identique à `Calcul.prixTTC` pour les 10 formats
   (tests de référence actuels inchangés).
5. Le détail contient achat, frais, base, tranches et total, et son total est
   égal au prix affiché.
6. `1.234,56`, `1 234,56`, `1234,56`, `12.50`, `12,50`, `12 €` sont lus
   correctement ; `12abc`, `0`, `-5`, `1,2,3` sont refusés avec un message.
7. Une saisie invalide n'affiche jamais un ancien montant.
8. Aucune marge, aucun coefficient global, aucun SKU dans Calculer.
9. Hors ligne, l'enregistrement réussit et le voyant indique « en attente »
   avec le nombre exact.
10. « Synchronisé » n'apparaît qu'après confirmation du script.
11. Un échec d'écriture locale n'affiche aucun succès et conserve la saisie.
12. Recalculer préremplit format, prix et nom ; renommer met à jour le même
    produit (même SKU) ; aucun second produit n'est créé.
13. Recalculer un produit au format inconnu n'impose aucun format.
14. En modification, un nom déjà porté par un autre produit bloque
    l'enregistrement : aucune donnée locale ni envoi n'est modifié.
15. L'aide « Ce produit existe déjà : il sera mis à jour. » apparaît avant
    l'enregistrement dès que le nom correspond à un produit existant
    (ou au produit modifié).
16. Sans préférence mémorisée, le détail est replié sous 900 px et ouvert à
    partir de 900 px ; après une ouverture ou fermeture par l'utilisateur, ce
    choix est conservé au rechargement ; une valeur `pv_detail = '1'` héritée
    ne compte pas comme un choix.
17. Aucun frais n'apparaît dans le sélecteur fermé ; `1.234.567` est refusé.
18. L'Historique ne reçoit que les calculs enregistrés.
19. Clavier : tout l'écran est utilisable ; Entrée prix → nom, Entrée nom →
    enregistrer ; Échap ferme le sélecteur.
20. Mise en page correcte à 320, 390, 768, 900 et 1440 px, sans défilement
    horizontal.
21. Tous les tests existants passent, hormis B-01 et B-02 inversés
    volontairement.

## 18. Impacts sur les documents de référence

À reporter avant ou pendant la maquette :

- `DESIGN_SYSTEM_V2` §18 et `UI_COMPONENT_LIBRARY_V2` §72 : ordre D1.
- `DESIGN_SYSTEM_V2` : tokens de l'étiquette crème (surface, texte, filet,
  focus sur surface claire), aujourd'hui non définis.
- `DESIGN_SYSTEM_V2` §21 et `UI_COMPONENT_LIBRARY_V2` §12 : table complète
  des 10 libellés (§6.2), contenances « cl » / « l » en minuscules (D13).
- `UI_COMPONENT_LIBRARY_V2` §6 : ajouter l'état `conflit` à `SyncStatus`.
- `UI_COMPONENT_LIBRARY_V2` §16 : exemple du détail avec frais et base.
- `UI_COMPONENT_LIBRARY_V2` §18 : états de `SaveAction` (« Enregistré sur
  l'appareil ») et variante « Enregistrer les modifications ».

## 19. Décisions

### Validées

| Réf. | Décision |
|---|---|
| D1 | Ordre : Format → Prix d'achat HT → Prix de vente TTC → Détail → Nom → Enregistrer |
| D2 | Table de référence unique des 10 formats (libellé + famille), réutilisée partout |
| D3 | SKU non exposé ; « même nom = même produit » clarifié ; renommage via Recalculer corrigé |
| D4 (révisée) | Détail : tranches et coefficients, puis prix HT, marge € et marge % ; TVA et accises dans `CONFIG` ; accises comprises dans les frais (§9.1) |
| D5 | Correction de B-01, compatibilité des saisies actuelles |
| D6 | Historique = calculs enregistrés uniquement |
| D7 | Étiquette de cave crème pour le prix de vente TTC |
| D8 | En modification, un nom déjà porté par un **autre** produit bloque l'enregistrement (message explicite, rien d'enregistré) ; le nom du produit modifié reste autorisé |
| D9 | Détail : état initial replié < 900 px, ouvert ≥ 900 px ; préférence de l'utilisateur mémorisée dans `pv_detail` après interaction |
| D10 | 37,5 cl : famille « autre » |
| D11 | `1.234.567` (séparateurs de milliers sans partie décimale) refusé |
| D12 | Pas de frais dans le sélecteur fermé ; frais dans les options ouvertes et dans le détail |
| D13 | Contenances en minuscules : « cl », « l » |
| D14 | Aide « Ce produit existe déjà : il sera mis à jour. » sous le champ nom, avant l'enregistrement |
| D15 | Formats « Réhoboam pétillant · 4,5 l » (`4_5l_mousseux`) et « Pétillant · 5 l » (`5l_mousseux`), proposés dans Calculer seulement s'ils sont dans `CONFIG` |
| C1–C12 | Corrections de la revue de la version 2.0 |

---

**Règle finale :** la qualité visuelle ne masque jamais une incertitude
métier. Toute nouvelle question apparue en maquette ou en développement est
ajoutée au §19 et tranchée avant d'être implémentée.
