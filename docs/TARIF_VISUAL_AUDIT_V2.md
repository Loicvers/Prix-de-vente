# TARIF — Visual Audit V2

Audit visuel de l'app « Prix de vente » (Tarif) d'Une Autre Clé du Paradis,
selon le cadre *Claude Creative Design Agent V2* (Master System + modules
Visual Intelligence). Cette version reprend les constats de
`docs/AUDIT-VISUEL.md` dans une structure en 20 parties et les complète
(densité de données, tableaux et formulaires, matrice de priorités,
évolution proposée).

**Aucune modification du code.** Seuls des documents et des captures sont
ajoutés.

| | |
| --- | --- |
| Commit audité | `62462eb` (`main`, étape 3) — app `app/` compilée par Vite |
| Date | 28/09/2026 |
| Méthode | App compilée ouverte dans Chromium (Playwright), fausse feuille des tests, **config fictive** (les frais et coefficients visibles ne sont pas les vrais). Captures en 320×568, 390×844 (référence), 768×1024, 1440×900. Positions, tailles et contrastes (WCAG 2.x) mesurés. |
| Captures | `docs/audit-visuel/*.png` |
| Confiance | **confirmé** = mesuré ou vu ; **probable** = déduit du code ; **possible** = hypothèse d'usage à valider |
| Hors périmètre | Ancienne app à la racine (repli), Apps Script, logique de calcul |

---

## 1. Executive Summary

Tarif est un **outil de comptoir mono-tâche** : choisir un format, taper un
prix d'achat, lire un prix de vente TTC, l'enregistrer dans la feuille Google
commune. Il est utilisé souvent, vite, principalement sur téléphone.

**Ce qui marche.** L'app a une vraie identité, cohérente avec une cave :
fond nuit brun-bordeaux, or de capsule, montants en serif comme sur une
étiquette. Elle est sobre, sans les tics des interfaces générées (pas de hero,
pas de dégradé violet, pas de glassmorphism décoratif). Les composants sont
homogènes, le mouvement est mesuré et respecte `prefers-reduced-motion`, la
synchronisation et les conflits sont expliqués en clair.

**Ce qui freine.** Deux problèmes structurels, pas de style :

1. **La hiérarchie ne sert pas la tâche.** Sur un téléphone 390×844, le prix
   de vente — la seule chose qu'on vient chercher — commence à 865 px, sous la
   barre d'onglets. La grille des 10 formats occupe 532 px en tête d'écran
   alors que le format change rarement (il est mémorisé). *(confirmé)*
2. **La couleur n'a plus de sens fiable.** 10 teintes de catégorie, toutes
   dans un arc rose-or, partagent l'espace des couleurs d'état : « en attente
   d'envoi » a presque la couleur de « magnum pétillant » (ΔE 4,8) ; l'erreur
   a presque la couleur de « tranquille » (ΔE 10,8). Le prix principal change
   de teinte à chaque format. *(confirmé)*

S'y ajoutent des défauts d'accessibilité ciblés (texte tertiaire à 3,8–4,2:1,
trois cibles tactiles < 44 px, fenêtre produit sans gestion du focus) et
**aucune adaptation** aux grands écrans.

> **Mise à jour après validation (28/09/2026).** Usage : smartphone,
> 75 cl dans la majorité des cas, Historique utilisé pour **vérifier les
> augmentations par rapport au prix précédent**, marge souhaitée, pas de
> charte de la maison. Conséquences : la recomposition de Calculer est
> confirmée (75 cl en accès direct) ; deux besoins métier montent en P1 —
> **voir l'écart avec le prix précédent avant d'enregistrer** et **afficher
> la marge** ; l'onglet Historique devient « Évolution des prix » ;
> l'adaptation ordinateur passe en P3. Détail en parties 15 à 20.

**Aucun P0.** Six P1. Direction recommandée : **évolution contrôlée**
(« Étiquette de cave ») — garder l'univers, recomposer l'écran Calculer
autour du résultat, réduire la couleur à un rôle clair.

---

## 2. Current Visual Identity

### Visual DNA

| Dimension | Constat |
| --- | --- |
| **Atmosphère** | Cave la nuit : fond `#16100f`, halo bordeaux `#3a1d22` en haut de page, surfaces brunes superposées. |
| **Typographie** | DM Serif Display pour les montants et titres (étiquette), DM Sans pour l'interface. Polices embarquées, disponibles hors ligne. |
| **Couleur** | Or `#d4ad6a` comme accent unique d'action ; 10 couleurs de catégorie ; couleurs d'état chaudes. |
| **Forme** | Rayons 12 / 18 / 22 px, pilules pour les filtres et le voyant ; **liseré vertical coloré** à gauche des formats et produits. |
| **Iconographie** | Trait 1,8 px, extrémités arrondies (calculatrice, bouteille, horloge, clé, loupe). |
| **Icône d'app** | Bouteille dorée en dégradé, « € » en serif, fond bordeaux — alignée sur l'UI. |
| **Ton** | Tutoiement, phrases courtes et explicites (« Rien n'a été écrasé : choisis la version à garder »). |
| **Mouvement** | Apparitions 0,18–0,24 s, pression `scale(.98)`, point de synchro qui pulse. |

### Positionnement (axes du Design Direction Engine)

| Axe | Position |
| --- | --- |
| Éditorial ↔ Corporate | ●●○○○ légèrement éditorial (serif) |
| Artisanal ↔ Industriel | ●●●○○ |
| Minimal ↔ Expressif | ●●○○○ |
| Classique ↔ Contemporain | ●●●○○ |
| Chaud ↔ Froid | ●○○○○ entièrement chaud |
| Dense ↔ Aéré | ●●●○○ aéré sur Calculer, moyen sur Produits |
| Luxe ↔ Accessible | ●●○○○ premium discret |
| Technique ↔ Humain | ●●●○○ |

### Lecture

L'identité est **pertinente** (Brand & Art Direction §10 : la pertinence
avant l'effet). Le lien avec le nom de la maison existe (clé du bouton PIN,
bouteille de l'icône) mais reste implicite. Le **seul élément graphique
propriétaire** est le liseré coloré ; tout le reste est un bon standard
mobile sombre.

---

## 3. Visual Hierarchy Audit

### Écran Calculer (390×844, `02-calcul-vide-390.png`, `04-calcul-resultat-390-full.png`)

Mesures *(confirmé)* :

| Bloc | Haut | Hauteur |
| --- | --- | --- |
| En-tête collant | 0 | 64 |
| Grille des formats | 128 | 532 |
| Champ prix d'achat | 737 | ≈ 70 |
| Carte résultat | 846 | 366 |
| Champ « Nom du produit » | 1 143 | 50 |
| Barre d'onglets (fixe) | 776 | 68 |
| Page totale | — | 1 322 |

Ordre de lecture réel :

1. Le format sélectionné (seul bouton teinté et bordé) et le titre or.
2. Les 9 autres formats, de poids identique.
3. Le haut du champ prix, tronqué par la barre d'onglets.
4. *(après défilement)* le prix de vente, 50 px serif.
5. *(après défilement)* « Enregistrer ».

**Diagnostic** : l'ordre suit la *logique du calcul* (format → prix →
résultat) et non la *fréquence d'usage* (prix à chaque fois, format rarement).
Le premier regard tombe sur un choix déjà fait.

### Écran Produits (`06-produits-liste-390.png`)

Nom (15 px / 600) → méta (12 px, gris + étiquette colorée) → prix serif
22 px aligné à droite. **Bonne hiérarchie** : le prix domine. Faiblesse : le
nom se tronque sur une ligne alors que la méta passe sur deux, ce qui donne
des lignes de 68 ou 90 px.

### Fiche produit (`08-fiche-produit.png`)

Titre serif 24 px → catégorie colorée → prix 40 px → tableau de détail →
actions. **Très bonne lecture**, sauf l'ordre des actions : « Fermer »
(pleine largeur) pèse plus que « Recalculer » et « Supprimer ».

### Conflit (`10-conflit.png`)

Titre ambre avec ⚠, explication, deux versions côte à côte, deux choix ; le
choix « Garder ma version » est en or (principal). **Hiérarchie claire**,
mais le toast recouvre la ligne suivante.

### Voyant de synchronisation

Toujours visible, texte explicite. Mais « Hors ligne » (gris) n'indique pas
qu'un produit attend : l'information est portée par le badge de l'onglet
Produits, à l'autre bout de l'écran (`09-historique.png`).

---

## 4. Typography Audit

### Inventaire mesuré à l'écran

| Famille | Tailles / graisses utilisées |
| --- | --- |
| DM Serif Display 400 | 21 (titre app), 22 (prix liste), 24 (titre fenêtre), 26 (€), 34 (saisie), 40 (prix fiche), 50 / 58 (résultat) |
| DM Sans | 10,5/700 (badge), 11/400 (baseline), 11,5/400-500 (infos format, onglets), 12/400-600, 13/400-600, 14/400-600, 15/400-600, 16/400 (champs) |

**15 combinaisons** taille/graisse différentes sur un seul écran.

### Constats

| # | Observation | Impact | Confiance |
| --- | --- | --- | --- |
| T1 | Rôles stricts : serif = montants et titres, sans = interface. | Signature forte, lisible. **À garder.** | confirmé |
| T2 | Pas d'échelle : 11 / 11,5 / 12 / 13 px coexistent sans rôle distinct. | Bruit, décisions au cas par cas. | confirmé |
| T3 | Tailles < 12 px (badge 10,5, baseline 11, infos de format et onglets 11,5). | Difficiles à lire debout, bras tendu, en boutique. | confirmé |
| T4 | Montants en serif dans les listes, non alignés à la virgule. | Comparaison verticale des prix moins rapide. | probable (DM Serif Display sans chiffres tabulaires réels) |
| T5 | En 320 px, titre sur 2 lignes, baseline coupée « UNE AUTRE CLÉ DU… », noms de format coupés (« Demi- / bouteille »). | En-tête qui gonfle, perte de la marque. | confirmé (`11-calc-320x568.png`) |
| T6 | Capitales espacées (Catégorie, Prix de vente TTC, Conflits…) à 12 px / .09 em. | Bon repère de section, cohérent. | confirmé |

### Échelle proposée (pour discussion)

| Rôle | Famille | Taille / graisse |
| --- | --- | --- |
| display | Serif | 48–56 |
| price-lg | Serif | 36–40 |
| title | Serif | 22–24 |
| body-strong | Sans | 15 / 600 |
| body | Sans | 15 / 400 |
| label | Sans | 13 / 600 (capitales pour les sections) |
| caption | Sans | 12 / 400 — **minimum** |
| price-list | Sans tabulaire | 16 / 600 |

---

## 5. Color Audit

### Rôles actuels

| Rôle | Jeton | Valeur |
| --- | --- | --- |
| Background | `--bg` | `#16100f` |
| Surface | `--surface` / `2` / `3` | `#211817` / `#2b201e` / `#362826` |
| Text | `--text` / `2` / `3` | `#f5eee6` / `#b8a898` / `#8a7a6c` |
| Border | `--border` / `-fort` | `#3d2e2b` / `#574240` |
| Primary / accent | `--accent` | `#d4ad6a` |
| Error | `--danger` | `#ec8a80` |
| Success | `--success` | `#7fd19b` |
| Warning | `--attente` | `#e6b85c` |
| Catégories (10) | `--c` | `#e0848c` `#e8c97c` `#c9607a` `#d9b05a` `#e06a8c` `#e0aa55` `#d77aa8` `#c98ac0` `#86c2ad` `#b196e8` |

Pas de rôle **secondary** ni **info** ; les rôles d'état sont dans le même
arc que les catégories.

### Contrastes texte (mesurés)

| Jeton | sur bg | sur surface | sur surface2 |
| --- | --- | --- | --- |
| text | 16,4 | 15,1 | 13,8 ✅ |
| text2 | 8,2 | 7,5 | 6,9 ✅ |
| **text3** | 4,56 | **4,21 ❌** | **3,83 ❌** |
| accent | 9,0 | 8,3 | 7,5 ✅ |
| texte sur bouton or | — | 8,8 ✅ | — |
| **magnum tranquille** | — | **4,50** | **4,09 ❌** |
| 3 l tranquille | — | 5,5 | 4,98 ⚠️ |

Non-texte : bordure / surface **1,22–1,34:1**, bordure forte 1,7–2:1
(WCAG 1.4.11 vise 3:1 pour les limites de champs).

### Collisions de sens (ΔE CIE76 ; < 10 ≈ confondables à l'œil)

| Paire | ΔE | Effet observé |
| --- | --- | --- |
| attente / magnum pétillant | **4,8** | « en attente d'envoi » = couleur de l'étiquette voisine |
| magnum pétillant / 3 l pétillant | **6,1** | deux formats indiscernables |
| attente / 3 l pétillant | 6,3 | idem statut |
| magnum tranquille / 3 l tranquille | 7,8 | deux formats indiscernables |
| accent / magnum pétillant | 9,5 | sélection, focus et bouton principal = couleur d'un format |
| danger / tranquille | 10,8 | un prix de vin tranquille ressemble à une erreur ; voyant rouge ≈ format le plus courant |

### Rôle de la couleur (Analysis Engine §4)

La couleur de catégorie est à la fois **structurelle** (liseré), **sémantique**
(identifier le format), **décorative** (dégradé de la carte résultat) et
porte le **chiffre principal**. Trop de métiers pour 10 teintes voisines.
Remarque culturelle *(possible)* : le rose de « tranquille » évoque le rosé
alors que la catégorie couvre rouges et blancs.

---

## 6. Spacing & Grid Audit

### Grille

- Une colonne, `max-width: 560px`, centrée, marges 16 px. Identique de 320 à
  1 440 px. En 1440×900, **61 % de la largeur reste vide** (`13-calc-1440.png`,
  `17-produits-1440-20.png`).
- Grille interne : formats en 2 colonnes, gouttière 8 px ; versions de conflit
  en 2 colonnes ; actions de fenêtre en 2 colonnes + une pleine largeur.
- Pas de débordement horizontal à aucune taille *(confirmé)*.

### Espacements relevés dans le CSS

2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16, 18, 20, 22, 28, 48, 96 px.
**Aucune échelle** ; plusieurs valeurs à 1 px d'écart (6/7, 10/11, 12/13/14).

### Rythme

| Zone | Valeur | Commentaire |
| --- | --- | --- |
| Entre cartes | 14 | cohérent |
| Padding carte | 18 | cohérent |
| Entre lignes produit | 8 | cohérent |
| Groupe de formats → groupe | 14 | = entre cartes : la grille de formats se lit comme une suite de mini-sections sans respiration |
| Titre de groupe → boutons | 7 | serré |
| Bas de page | 96 + safe area | réservé à la barre |

**Lecture** : visuellement régulier, mais tenu « à l'œil ». C'est ce qui
explique que chaque nouvel écran (conflits, retirés) ait introduit ses
propres valeurs.

Échelle proposée : **4 · 8 · 12 · 16 · 24 · 32 · 48** (+ 64 pour les
grands écrans).

---

## 7. Component Audit

| Composant | Anatomie / états observés | Constat | Priorité |
| --- | --- | --- | --- |
| **Bouton format** (`.cat`) | Nom 14/600, info 11,5, liseré 3 px ; `aria-pressed`, teinte + bordure si choisi ; `scale(.98)` | Clair, ≥ 62 px. Libellés dupliqués (« Tranquille » en 75 cl **et** en magnum). Sélection invisible avant iOS 16.2 (`color-mix`). | P2 |
| **Champ prix** | Serif 34 px, « € » serif gris à droite | Belle idée, identitaire. Placé sous la ligne de flottaison. | P1 (position) |
| **Carte résultat** | Libellé capitales, catégorie, prix 50 px, détail repliable, champ nom + Enregistrer | Bon regroupement « résultat → action ». Prix coloré par catégorie. | P1 |
| **Boutons** | principal (or), secondaire (surface), danger (contour), large, petit | Système cohérent, 5 variantes. Pas d'état *loading* visuel (texte « Vérification… » seulement sur PIN). | P3 |
| **Champs** | 16 px (pas de zoom iOS), bordure 1,5 px, focus = bordure or | Limite de champ vide à 1,2:1. | P3 |
| **Voyant** (`.pastille`) | 5 états, point 8 px, texte | Très bon principe. 31 px de haut ; « Hors ligne » masque l'attente. | P1 (cible) / P2 |
| **Bouton PIN** | 36×36, icône clé | Trop petit. | P1 |
| **Filtres** | Pilules défilantes, compteur | Débordent à droite sans indice de défilement (dernier filtre coupé). | P3 |
| **Ligne produit** | Liseré, nom, méta, prix | Bien. Hauteur variable 68/90 px. | P2 |
| **Ligne historique** | Point 6 px, nom, prix, méta | Visuellement presque identique à Produits. | P2 |
| **Fiche produit** (bottom sheet) | Poignée, titre, prix, tableau, 3 actions | Poignée **décorative** (aucun glissement géré) ; focus non déplacé ; « Fermer » dominant. | P1 |
| **Suppression** | `confirm()` natif | Rupture visuelle complète avec l'app. | P1 |
| **Fenêtre PIN** | 3 champs, Valider / Plus tard | Claire. Zone d'erreur réservée vide (18 px). Pas d'affichage du PIN. | P3 |
| **Carte conflit** | Bordure ambre, 2 versions, 2 choix | Excellente. « ⚠ » en caractère texte. | P3 |
| **Toast** | Pilule flottante, action | Action 27×20 px ; recouvre la liste. | P1 (cible) |
| **Barre d'onglets** | 3 onglets icône + texte, badge | Bien. Rôles ARIA `tab` sans navigation aux flèches. | P3 |
| **État vide** | Icône bouteille + phrase | Sobre, cohérent. | — |

---

## 8. Data Density Audit

| Écran | Mesure *(confirmé)* | Lecture |
| --- | --- | --- |
| Calculer, 390×844 | 0 donnée utile (prix) visible sans défiler ; 10 boutons de format | Densité **mal répartie** : forte là où l'on ne décide rien. |
| Produits, 390×844 | **6 produits** visibles sur 20 ; lignes de 68–90 px | Correct pour un téléphone. |
| Produits, 1440×900 | **8 produits** visibles, lignes de 560 px de large | **Trop faible** pour un ordinateur : une liste de téléphone étirée. |
| Historique, 390×844 | 9 lignes visibles (62 px) | Plus dense que Produits, pour une information presque identique. |
| Fiche produit | 9 lignes de détail + 3 actions dans ≈ 510 px | Bonne densité. |
| Détail du calcul | 5–7 lignes, 13 px | Bon, lisible, tabulaire. |

**Informations absentes** qui aideraient à décider : **marge (€ et %)** et
**écart avec le prix précédent** — toutes deux confirmées comme besoins
(partie 20, Q4 et Q5) ; *possible, non validé* : coefficient global, date de
dernière modification dans la liste, tri (nom, prix, date).

**Informations redondantes** : la catégorie apparaît trois fois sur une ligne
produit (liseré, étiquette colorée, couleur du prix).

---

## 9. Table & Form Audit

### Tableaux

L'app n'a **aucun `<table>`**. Deux structures tabulaires sont faites en
flex :

| Structure | Constat |
| --- | --- |
| **Détail du calcul** (`.ligne`) | Libellé à gauche, montant à droite, chiffres tabulaires, ligne de total séparée. Lecture excellente. Les lignes de tranche « 0,00 € → 10,00 € × 2,000 » mélangent intervalle et coefficient dans le libellé : dense mais compréhensible pour l'usager. Pas de sémantique de tableau pour un lecteur d'écran *(probable)*. |
| **Liste de produits** | Liste de cartes, pas de colonnes. Suffisant sur téléphone ; sur ordinateur, un vrai tableau (nom · format · achat · vente · SKU · date) permettrait comparaison et tri. |

### Formulaires

| Formulaire | Points forts | Points faibles |
| --- | --- | --- |
| **Prix d'achat** | `inputmode="decimal"`, `enterkeyhint="done"`, accepte « , » « . » « € » ; calcul en direct | « 1.234,56 » mal lu (B-01 connu) ; aucun message si la saisie est illisible (le résultat disparaît simplement). |
| **Nom du produit** | Placé dans la carte résultat, juste avant Enregistrer | Libellé uniquement visuellement caché (placeholder seul visible) ; aucun indice que « même nom = même produit = même SKU ». |
| **Recherche** | Icône, placeholder explicite, filtrage à 80 ms | — |
| **PIN** | Libellés visibles, `inputmode="numeric"`, message d'erreur `role="alert"` | Pas d'œil pour afficher le PIN ; URL longue dans un champ court ; « Plus tard » aussi massif que « Valider ». |
| **Choix de format** | Boutons `aria-pressed` groupés sous titres | Sémantiquement un choix unique : un groupe radio serait plus juste *(probable)*. |

---

## 10. Responsive Audit

| Taille | Observé | Problèmes |
| --- | --- | --- |
| **320×568** (`11-calc-320x568.png`) | Champ prix à 507 px pour ≈ 500 px visibles ; résultat à 678 | Champ prix **caché** sous la barre ; titre sur 2 lignes ; baseline coupée ; noms de format coupés. |
| **390×844** (référence) | Champ prix à 737, résultat à 865 pour 776 visibles | Résultat hors écran. |
| **768×1024** | Même colonne de 560 px, résultat à 833 pour ≈ 956 visibles | Résultat tout juste visible, 27 % de largeur perdue de chaque côté. |
| **1440×900** (`13`, `17`) | Colonne de 560 px, résultat à 833 pour ≈ 832 visibles | Résultat caché ; 61 % de largeur vide ; liste de 8 lignes. |

Aucune règle ne réorganise la page : seule media query `≥ 700px` (marge du
haut + prix à 58 px). C'est le cas décrit par le Master System §18 :
« desktop = mobile agrandi ». Pas de débordement horizontal ; safe areas iOS
gérées (`env(safe-area-inset-*)`).

---

## 11. Accessibility Audit

| Critère | État | Détail |
| --- | --- | --- |
| Contraste texte | ❌ | `--text3` 3,83–4,21:1 sur cartes ; magnum tranquille 4,09:1 ; 3 l tranquille 4,98 (limite). |
| Contraste non-texte | ⚠️ | Bordures de champs 1,2–1,3:1. |
| Couleur seule | ⚠️ | Presque toujours doublée par du texte ; historique : catégorie = point de 6 px + texte ✅ ; collisions état/catégorie (§5). |
| Taille de texte | ⚠️ | 10,5–11,5 px sur badge, baseline, infos de format, onglets. |
| Cibles tactiles | ❌ | Voyant 82×31, PIN 36×36, action du toast 27×20. |
| Focus visible | ✅ | Contour or 2 px sur boutons (`15-focus-clavier.png`) ; bordure or sur champs. Or sur or pour les formats pétillants. |
| Gestion du focus des fenêtres | ❌ | Fiche : focus non déplacé ni piégé, non rendu à la fermeture *(probable, `fenetres.js`)* ; PIN : focus sur le bon champ ✅. |
| Clavier | ⚠️ | Échap ferme ✅ ; Entrée dans le prix passe au nom ✅ ; onglets sans flèches. |
| Sémantique | ✅ / ⚠️ | `tablist`/`tab`/`tabpanel`, `aria-live` sur résultat et conflits, `role="alert"` PIN, `role="status"` toast ✅ ; détail du calcul sans sémantique de tableau. |
| Mouvement | ✅ | `prefers-reduced-motion` coupe animations et transitions. |
| Langue | ✅ | `lang="fr"`. |
| Zoom | ✅ | Champs à 16 px, pas de blocage du zoom. |

---

## 12. Visual Consistency Issues

| # | Incohérence | Où |
| --- | --- | --- |
| C1 | Même couleur, sens différents : or = accent, focus, formats pétillants, statut « attente ». | Partout |
| C2 | Même couleur, sens différents : rose-rouge = erreur **et** vin tranquille. | Voyant, liste, fiche |
| C3 | Chiffre principal en couleur variable (5 teintes selon le format), alors que les autres montants sont en blanc. | Résultat, liste, historique, fiche |
| C4 | Deux marqueurs de catégorie : liseré (formats, produits) vs point (historique). | Produits vs Historique |
| C5 | Deux styles de confirmation : cartes intégrées pour les conflits, `confirm()` système pour la suppression. | Conflits vs Fiche |
| C6 | Deux traitements des alertes : `.alerte` (fond surface2) vs `.carte.conflit` (bordure ambre). | Calculer vs Produits |
| C7 | Icônes SVG au trait vs « ⚠ » typographique. | Conflits, statuts |
| C8 | Libellés d'un même format différents selon l'endroit : « Tranquille » (bouton), « Vin tranquille » (résultat, liste), « Tranquille » (filtre). « Magnum tranquille » s'appelle « Tranquille » dans la grille. | Calculer, Produits |
| C9 | Prix en serif dans les listes, montants en sans dans le détail : deux typographies pour la même donnée. | Liste vs Détail |
| C10 | Montants de liste 22 px (Produits) vs 15 px/600 (Historique) pour la même information. | Produits vs Historique |
| C11 | Espacements à 1 px d'écart (6/7, 10/11, 12/13/14). | CSS |
| C12 | Affordance sans comportement : poignée de glissement. | Fiche |

---

## 13. Visual Strengths

1. **Identité juste et sobre** — l'univers cave/étiquette sert la marque,
   sans décor gratuit.
2. **Serif réservé aux montants** — le chiffre est traité comme sur une
   étiquette de prix ; c'est la signature de l'app.
3. **Un seul accent d'action (or)** — le bouton principal se trouve sans
   chercher.
4. **États de synchronisation explicites** — jamais « vert » à tort, texte
   distinct pour chaque cas.
5. **Carte de conflit exemplaire** — deux versions côte à côte, origine
   datée, deux choix clairs, rien d'écrasé.
6. **Fiche produit** — hiérarchie titre → prix → détail très lisible.
7. **Détail du calcul** — transparent, tabulaire, repliable, état mémorisé.
8. **Robustesse de rendu** — aucun débordement, polices locales hors ligne,
   safe areas, mouvement réduit respecté.
9. **Ton rédactionnel** — tutoiement cohérent, messages précis.
10. **Iconographie homogène** — un seul trait, une seule famille.

## 14. Visual Weaknesses

1. **Résultat hors du premier écran** à toutes les tailles testées.
2. **Grille de formats surdimensionnée** et toujours dépliée.
3. **Couleur surchargée** : 10 teintes voisines + états dans le même arc.
4. **Prix principal de couleur variable**.
5. **Texte tertiaire sous 4,5:1** et tailles sous 12 px.
6. **Cibles tactiles < 44 px** dans l'en-tête et le toast.
7. **Fenêtre produit** : poignée factice, focus non géré, « Fermer »
   dominant, suppression par boîte système.
8. **Aucun responsive réel** : colonne de téléphone sur ordinateur.
9. **Historique et Produits** visuellement redondants.
10. **Pas d'échelle d'espacement ni de typographie**.
11. **Augmentations invisibles** — l'Historique liste les calculs sans les
    relier : pour voir une hausse, il faut retrouver deux lignes et
    soustraire de tête ; Calculer n'affiche jamais le prix précédent.

---

## 15. Design Opportunities

Mises à jour après les réponses de la partie 20 : **O1 renforcée, O6 et O10
validées, O5 déclassée, O9 facultative.**

| # | Opportunité | Fonction servie (Master §3.4) | Statut |
| --- | --- | --- | --- |
| O1 | **Saisie et résultat en tête ; 75 cl en accès direct.** Deux gros boutons « Tranquille · Pétillant » (75 cl) toujours visibles, et une puce « Autres formats ▾ » qui déplie les 8 autres (et affiche le format choisi quand ce n'en est pas un de 75 cl). Environ 60 px au lieu de 532. | vitesse, compréhension | **validée** (Q1) |
| O2 | **Résultat en « étiquette de prix »** : bloc clair (crème) sur fond nuit, serif sombre, filet or. Signature propre à l'app, puisqu'il n'y a pas de charte à reprendre. | mémorisation, identité | à maquetter |
| O3 | **Formats par silhouettes de contenance** (37,5 cl → 5 l) dans le panneau « Autres formats ». | compréhension | facultative |
| O4 | **Couleur réduite à deux familles** (tranquille / pétillant) + neutre ; états sortis de l'arc chaud, avec icône. | accessibilité, clarté | recommandée |
| O5 | Deux colonnes ≥ 900 px ; Produits en tableau triable. | densité | **déclassée** (Q2 : smartphone) |
| O6 | **Marge affichée** dans le résultat et la fiche : marge € et % sous le prix de vente, et dans le détail du calcul. | décision | **validée** (Q5) — définition à confirmer (Q12) |
| O7 | Synchronisation déplacée dans le voyant (panneau d'état) ; l'onglet Historique libéré pour sa vraie fonction (O10). | architecture d'information | recommandée |
| O8 | **Fiche en vraie feuille** : pas de poignée factice, confirmation de suppression intégrée, focus géré. | cohérence, accessibilité | recommandée |
| O9 | Clé comme motif discret (état vide, écran PIN). | identité | facultative (Q7 : pas de charte) |
| **O10** | **Voir l'augmentation avant d'enregistrer, et la retrouver ensuite.** (1) Dans Calculer : dès que le nom saisi correspond à un produit existant (ou après « Recalculer »), afficher sous le nouveau prix « Avant : 21,80 € · ▲ +1,20 € (+5,5 %) ». (2) L'onglet Historique devient **« Évolution des prix »** : une ligne par produit, *ancien → nouveau*, écart en € et en %, date, avec accès à tous les changements du produit. | décision, compréhension | **nouvelle** (Q4) |

**Constats de code qui fondent O10** *(confirmé à la lecture)* :
- Chaque enregistrement ajoute une ligne à l'historique avec l'identifiant du
  produit (`sauvegarder()`, `calculateur.js`), mais l'onglet affiche ces
  lignes **séparément, sans lien entre elles ni écart** : pour voir une
  augmentation, il faut aujourd'hui retrouver à l'œil deux lignes du même nom
  et faire la soustraction.
- L'historique est **propre à chaque appareil** (`pv_historique`, 300 lignes
  au plus) ; un calcul fait sur un autre appareil n'y figure pas.
- En revanche, le **prix actuel de la feuille** (onglet Produits) est commun à
  tous les appareils : c'est la bonne référence pour l'écart affiché *avant*
  d'enregistrer, quel que soit l'appareil.
- Rappel de `ETAT-DE-REFERENCE.md` : les prix enregistrés ne sont jamais
  recalculés si la config change. « Évolution des prix » pourrait aussi
  signaler les produits dont le prix recalculé avec la config actuelle
  diffère du prix enregistré *(possible, à valider)*.

---

## 16. Recommended Design Direction

### Directions explorées (Master §10)

| | A — Controlled | B — Distinctive | C — Experimental |
| --- | --- | --- | --- |
| **Concept** | Même univers, hiérarchie et couleurs corrigées | « Étiquette de cave » : le résultat devient une étiquette | « Pavé de caisse » : un seul écran, pavé numérique intégré |
| **Typographie** | Actuelle + échelle | Serif plus présente (étiquette), sans tabulaire pour les listes | Chiffres géants, sans condensé |
| **Couleur** | 2 familles + neutre, états séparés | Nuit + crème + or ; catégories en monochrome | Quasi monochrome, or pour l'action |
| **Formats** | 75 cl en accès direct + « Autres formats » | Silhouettes de contenance | Rangée défilante sous le pavé |
| **Risque** | Faible | Moyen (icônes, test utilisateurs) | Élevé (saisie non standard, accessibilité) |
| **Différenciation** | Faible | Forte | Très forte |

### Recommandation confirmée : **A, enrichie de l'étiquette de B** — « Étiquette de cave », 100 % smartphone

Les réponses renforcent cette direction :

- **Q1 (75 cl majoritaire)** : la grille complète des formats n'a pas à
  occuper l'écran ; 75 cl en accès direct, le reste à la demande.
- **Q2 (smartphone)** : on conçoit pour 360–430 px de large, à une main ;
  l'adaptation ordinateur sort des priorités.
- **Q4 (vérifier les augmentations)** : l'écart avec le prix précédent
  devient une information de premier rang, au même niveau que le prix.
- **Q5 (marge : oui)** : la marge rejoint le résultat.
- **Q7 (pas de charte)** : l'identité actuelle (nuit, or, DM Serif / DM Sans)
  **devient** la charte ; on la stabilise au lieu d'en importer une.

**Écran Calculer visé (smartphone, de haut en bas)**

1. En-tête compact (titre, voyant).
2. Format : `[ Tranquille ] [ Pétillant ]` 75 cl + `Autres formats ▾`.
3. Prix d'achat HT (serif, gros).
4. **Étiquette résultat** : prix de vente TTC ; en dessous, marge € / % ;
   si le produit existe, « Avant : … · ▲ +… € (+… %) ».
5. Nom du produit + Enregistrer, dans la zone du pouce.
6. Détail du calcul, replié.

Objectif mesurable : **prix de vente, marge et écart visibles sans défiler
en 390×844 et en 360×740**, clavier fermé.

**Principes de direction**

1. **Le prix d'abord** — le résultat est visible dès qu'un prix est tapé.
2. **Comparer sans calculer** — l'écart avec le prix précédent et la marge
   sont affichés, jamais à reconstituer de tête.
3. **Une couleur, un sens** — l'or agit, l'ambre attend, le rouge alerte ;
   une hausse de prix n'est **pas** une erreur (▲ + texte, couleur neutre).
4. **L'étiquette comme signature** — serif et filet or pour les montants qui
   comptent.
5. **Une main, un pouce** — cibles ≥ 44 px, texte ≥ 12 px, action principale
   en bas.

**Do / Don't**

| Do | Don't |
| --- | --- |
| Prix principal en couleur stable | Colorer le chiffre selon le format |
| 75 cl en un geste | Faire défiler 10 formats pour le cas courant |
| Écart signalé par ▲ / ▼ + montant + % | Hausse en rouge (confusion avec une erreur) |
| Marge à côté du prix, en plus petit | Marge qui concurrence le prix de vente |
| Nouvelles catégories rangées dans une famille existante | Une teinte par nouveau format |
| Icône + texte pour chaque état | Un état signalé par la seule couleur |
| Affordance = comportement | Poignée ou chevron décoratif |

---

## 17. Priority Matrix

Impact (sur la tâche et l'accessibilité) × Effort (estimation). Mise à jour
avec les réponses : **smartphone seulement**, **75 cl majoritaire**,
**comparaison au prix précédent** et **marge** demandées.

| Priorité | Constat / action | Impact | Effort | Quadrant |
| --- | --- | --- | --- | --- |
| **P1** | Calculer recomposé : 75 cl en accès direct, saisie + résultat dans le premier écran | Élevé | Moyen | **En premier** |
| **P1** | Écart avec le prix précédent affiché avant d'enregistrer (O10-1) | Élevé | Moyen | **En premier** |
| **P1** | Historique → « Évolution des prix » (O10-2) | Élevé | Moyen | À planifier |
| **P1** | Marge € / % dans le résultat et la fiche (O6) | Élevé | Faible à moyen (selon Q12) | À planifier après Q12 |
| **P1** | Prix principal en couleur stable | Élevé | Faible | **Gain rapide** |
| **P1** | Séparer couleurs d'état et de catégorie | Élevé | Moyen | À planifier |
| **P1** | `--text3` ≥ 4,5:1 (ex. `#9d8c7d` : 4,9 / 5,4), tailles ≥ 12 px | Moyen | Faible | **Gain rapide** |
| **P1** | Cibles ≥ 44 px (voyant, PIN, toast) | Moyen | Faible | **Gain rapide** |
| **P1** | Fiche : focus, poignée, ordre des actions, suppression intégrée | Moyen | Moyen | À planifier |
| P2 | Réduire les catégories à 2 familles + neutre | Moyen | Moyen | Avec le P1 couleur |
| P2 | Libellés de format non ambigus | Moyen | Faible | Gain rapide (en partie absorbé par la recomposition) |
| P2 | Voyant « Hors ligne · n en attente » ; synchro dans le voyant | Moyen | Faible | Gain rapide |
| P2 | Échelles d'espacement et de typographie | Moyen | Moyen | Socle |
| P2 | En-tête en 320–360 px | Faible | Faible | Gain rapide |
| P2 | Montants de liste alignés (sans tabulaire) | Faible | Faible | Gain rapide |
| P3 | Deux colonnes ≥ 900 px ; tableau Produits | Faible (Q2) | Élevé | **Déclassé** |
| P3 | « ⚠ » → icône ; bordures de champs ; focus sur formats pétillants ; indice de défilement des filtres ; carte « Prix d'achat » supprimée ; dégradé du résultat au seul moment du calcul | Faible | Faible | Finitions |

---

## 18. Proposed Visual Evolution

Évolution par étapes, chacune publiable seule et vérifiée par la suite e2e
existante (plusieurs tests ciblent `.cat[data-cat]`, `#resultat-prix`, les
textes du voyant). Ordre revu après validation.

| Étape | Contenu | Visible pour l'utilisateur |
| --- | --- | --- |
| **V1 — Socle** | Jetons : échelle d'espacement, échelle typographique, rôles de couleur sémantiques (primary, warning, danger, success, info, category-still, category-sparkling, category-other, **delta-up, delta-down**). Aucun changement de mise en page. | Presque rien |
| **V2 — Gains rapides** | Prix en couleur stable ; `--text3` éclairci ; tailles ≥ 12 px ; cibles ≥ 44 px ; voyant avec compte d'attente ; en-tête 360 px. | Lisibilité, calme |
| **V3 — Calculer recomposé** | 75 cl en accès direct + « Autres formats » ; saisie et étiquette résultat en tête ; nom + Enregistrer dans la zone du pouce. | Le changement majeur |
| **V4 — Comparer et décider** | Écart avec le prix précédent avant d'enregistrer ; marge € / % (selon Q12) ; mêmes informations dans la fiche produit. | Nouvelle valeur métier |
| **V5 — Évolution des prix** | Onglet Historique transformé : une ligne par produit, ancien → nouveau, écart, date ; détail des changements ; synchronisation déplacée dans le voyant. | Nouvelle valeur métier |
| **V6 — Couleur rationalisée** | Catégories en 2 familles + neutre ; états avec icône ; repli pour `color-mix` (iOS < 16.2). | Cohérence |
| **V7 — Fenêtres et confirmations** | Fiche : actions en tête, focus géré, poignée retirée, suppression confirmée dans la fiche. | Finition |
| ~~Grands écrans~~ | Retiré du plan (Q2). La colonne actuelle reste utilisable sur ordinateur. | — |

---

## 19. Before / After Principles

| Sujet | Avant | Après (principe) |
| --- | --- | --- |
| Premier écran | 10 formats, champ prix tronqué, résultat invisible | Prix d'achat, prix de vente, marge et écart visibles sans défiler |
| Format | Grille toujours dépliée (532 px) pour un usage à 75 cl surtout | 75 cl en un geste ; 8 autres formats à la demande |
| Prix précédent | Introuvable dans Calculer ; dans l'Historique, deux lignes séparées à comparer de tête | « Avant : … · ▲ +… € (+… %) » sous le nouveau prix |
| Historique | Liste de calculs ≈ liste de produits | « Évolution des prix » : ancien → nouveau, écart, date |
| Marge | Absente | € et % sous le prix, en plus petit |
| Prix principal | Couleur du format (5 teintes) | Couleur stable, serif « étiquette » |
| Catégories | 10 teintes voisines | 2 familles + neutre ; le texte nomme le format |
| États | Ambre ≈ or ≈ pétillant ; rouge ≈ tranquille | Teintes réservées + icône ; hausse ≠ erreur |
| Texte secondaire | 3,8–4,2:1, 10,5–11,5 px | ≥ 4,5:1, ≥ 12 px |
| Cibles | 31 / 36 / 20 px | ≥ 44 px |
| Fiche produit | « Fermer » dominant, poignée factice, `confirm()` | Actions réelles d'abord, confirmation intégrée, focus géré |
| Espacements | 19 valeurs | 7 valeurs d'échelle |
| Typographie | 15 combinaisons | 8 rôles |
| Cartes | Tout est carte | Une carte quand elle regroupe |

**Invariants** (à ne pas perdre) : fond nuit, or unique pour l'action,
serif pour les montants, DM Serif Display / DM Sans (pas de charte à
reprendre), tutoiement, carte de conflit, voyant textuel, sobriété du
mouvement, fonctionnement hors ligne, aucun montant de config dans le dépôt.

---

## 20. Questions Requiring Validation

### Réponses reçues (28/09/2026)

| # | Question | Réponse | Conséquence |
| --- | --- | --- | --- |
| Q1 | Fréquence de changement de format | **La majorité des calculs sont en 75 cl.** | 75 cl en accès direct, autres formats repliés (O1, V3). |
| Q2 | Appareil principal | **Smartphone.** | Conception pour 360–430 px à une main ; grands écrans déclassés (O5, P3). |
| Q4 | Rôle de l'Historique | **Vérifier les augmentations par rapport au prix précédent.** | Écart affiché avant d'enregistrer ; Historique → « Évolution des prix » (O10, V4–V5). |
| Q5 | Afficher la marge | **Oui.** | Marge € / % dans le résultat et la fiche (O6, V4). |
| Q7 | Charte de la maison | **Non, pas vraiment.** | L'identité actuelle devient la charte ; O9 facultative. |

### Questions ouvertes

Les numéros Q3, Q6, Q8 à Q11 sont ceux de la première liste ; Q12 à Q15
découlent des réponses.

- **Q3 · Couleurs de catégorie** : servent-elles à reconnaître un format
  d'un coup d'œil, ou sont-elles décoratives ? Le rose pour « tranquille »
  gêne-t-il ?
- **Q6 · Lisibilité en boutique** : lumière, distance de lecture, autres
  utilisateurs ?
- **Q8 · Mode clair** : utile en plein jour, ou le sombre suffit ?
- **Q9 · iPhone antérieurs à iOS 16.2** encore utilisés ?
- **Q10 · Suppression** : la boîte de confirmation système gêne-t-elle ?
- **Q11 · Direction** : valider « Étiquette de cave » telle que décrite en
  partie 16, ou voir d'abord des maquettes ?
- **Q12 · Définition de la marge** : la config ne contient pas de taux de
  TVA et l'app ne calcule qu'un prix TTC. Quelle marge veux-tu voir ?
  - (a) prix de vente HT − prix d'achat HT (il faut alors le taux de TVA :
    21 % pour tous les formats ?) ;
  - (b) prix de vente HT − (prix d'achat HT + frais fixes) ;
  - (c) en % du prix de vente (taux de marque) ou du prix d'achat (taux de
    marge) ?
- **Q13 · Prix précédent de référence** : le prix actuel de la feuille
  (commun à tous les appareils), ou le dernier calcul de *cet* appareil ?
  (recommandation : la feuille)
- **Q14 · Écart à signaler** : faut-il attirer l'attention au-delà d'un seuil
  (par exemple hausse > 10 %), ou toujours afficher l'écart de la même façon ?
- **Q15 · Évolution des prix** : suffit-il de voir le dernier changement de
  chaque produit, ou faut-il tout l'historique de ses prix (sur plusieurs
  années, ce qui demanderait de le conserver dans la feuille plutôt que sur
  l'appareil) ?

---

### Captures de référence

`docs/audit-visuel/` : `01-pin-premier-lancement`, `02-calcul-vide-390`,
`04-calcul-resultat-390-full` (la barre d'onglets fixe apparaît au milieu :
artefact de capture pleine page), `06-produits-liste-390`, `08-fiche-produit`,
`09-historique`, `10-conflit`, `11-calc-320x568`, `13-calc-1440`,
`15-focus-clavier`, `16-sans-config`, `17-produits-1440-20`.
