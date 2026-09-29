# CALCULER_UI_MOCKUP.md

## Maquette de l'écran « Calculer » — alignée sur `CALCULER_SPEC_V2.md` 2.2

**Version :** 2.2 — 29/09/2026
**Statut :** référence UI de l'écran implémenté (étape 4)

Cette version remplace la maquette dérivée de la spec 2.0 (recherche de
produit, formats par produit, zone de paramètres, calcul asynchrone), qui ne
correspondait pas à l'application (décision : option A). Elle décrit l'écran
tel qu'il est construit, sans nouvelle règle métier. Montants et noms des
schémas : placeholders.

Documents supérieurs : `00_MASTER_SYSTEM.md` → `DESIGN_SYSTEM_V2.md` →
`UI_COMPONENT_LIBRARY_V2.md` → `CALCULER_SPEC_V2.md`.

---

## 1. Hiérarchie

1. Prix de vente TTC (étiquette crème, serif, élément dominant)
2. Format
3. Prix d'achat HT
4. Action Enregistrer
5. Détail du calcul
6. Nom du produit, aides et messages

Ordre de lecture et de tabulation (D1) : **Format → Prix d'achat HT → Prix de
vente TTC → Détail → Nom → Enregistrer**. Pas de titre de page : l'onglet
actif et l'en-tête global suffisent (C9).

## 2. Mobile (< 600 px), une colonne

```text
┌──────────────────────────────┐
│ Prix de vente   ● Synchronisé 🔑│  en-tête global (inchangé)
├──────────────────────────────┤
│ [Tu modifies « … »]          │  seulement en mode modification
│  Nouveau calcul              │
│ Format                       │
│ [ Tranquille · 75 cl      ▾ ]│  fermé par défaut, sans frais (D12)
│ Prix d'achat HT              │
│ [ 12,50                   € ]│  serif, message d'erreur dessous
│ ┌──────────────────────────┐ │
│ │ PRIX DE VENTE TTC        │ │  étiquette crème
│ │ XX,XX €                  │ │  DM Serif Display 48 px
│ │ Tranquille · 75 cl       │ │
│ │ ──────────── (filet or)  │ │
│ │ › Détail du calcul       │ │  replié par défaut (D9)
│ └──────────────────────────┘ │
│ Nom du produit               │
│ [                          ] │  aide D14 / erreur D8 dessous
│ [       Enregistrer        ] │  or, texte sombre, ≥ 44 px
├──────────────────────────────┤
│ Calculer  Produits  Historique│
└──────────────────────────────┘
```

Sur 390 × 844, sélecteur fermé : le montant est visible sans défilement.

## 3. Tablette (600–899 px)

Même colonne, élargie ; grille des formats plus dense (colonnes auto, 120 px
minimum par option).

## 4. Desktop (≥ 900 px), deux colonnes

```text
┌──────────────────────────────┬───────────────────────────────┐
│ Format                       │ PRIX DE VENTE TTC             │
│ [ Tranquille · 75 cl      ▾ ]│ XX,XX €          (56 px)      │
│ Prix d'achat HT              │ Tranquille · 75 cl            │
│ [ 12,50                   € ]│ ─────────────── filet or      │
│ Nom du produit               │ ⌄ Détail du calcul (ouvert)   │
│ [                          ] │   Prix d'achat HT      …      │
│ [ Enregistrer ]              │   Frais fixes (…)      + …    │
│                              │   Base de calcul       …      │
│                              │   a → b × coef         …      │
│                              │   Prix de vente TTC    …      │
└──────────────────────────────┴───────────────────────────────┘
```

Largeur de page 960 px maximum ; étiquette collante (sticky).

## 5. Composants

| Zone | Composant | Rendu |
|---|---|---|
| Format | `FormatSelector` fermé : bouton pleine largeur « libellé V2 ▾ » | ouvert : 5 groupes (`GROUPES`), 10 options radio avec libellé V2 et « + x,xx € de frais » (ou « frais à charger ») |
| Prix d'achat | `PriceInput` | serif 36 px, « € » à droite, `inputmode="decimal"` |
| Prix de vente | `PriceLabel` | crème (`--color-label-surface`), texte sombre, libellé en capitales espacées |
| Détail | `CalculationDetail` (`<details>` + `<dl>`) | libellés à gauche, montants à droite, chiffres tabulaires, total séparé |
| Nom | `ProductNameInput` | label visible, message sous le champ |
| Action | `SaveAction` (Button Primary) | « Enregistrer » / « Enregistrer les modifications » / « Enregistré sur l'appareil » |
| Modification | bandeau | liseré or à gauche, « Tu modifies « nom » », « Nouveau calcul » |

## 6. États de l'étiquette

| Statut | Montant | Ligne d'état |
|---|---|---|
| valide | `XX,XX €` | — (détail disponible) |
| vide | — | Saisis un prix d'achat |
| invalide | — | Prix indisponible : corrige le prix d'achat |
| sans-config | — | Prix indisponible : connecte-toi avec ton PIN |
| format-manquant | — | Prix indisponible : frais de ce format non chargés |
| sans-format | — | Choisis un format |
| erreur | — | Calcul impossible avec la config actuelle. Reconnecte-toi avec ton PIN. |

Un montant non valide est affiché en couleur secondaire ; le détail est masqué.
Jamais d'ancien montant.

## 7. Messages

| Où | Texte |
|---|---|
| Sous le prix | Montant illisible : écris par exemple 12,50 · Le prix d'achat doit être supérieur à 0 |
| Sous le nom (aide) | Ce produit existe déjà : il sera mis à jour. · Ce produit existe déjà (retiré) : il sera mis à jour et remis en vente. |
| Sous le nom (erreur) | Un autre produit porte déjà ce nom. Choisis un autre nom. · Donne un nom au produit · Mémoire de l'appareil pleine : le produit n'est pas enregistré. |
| Sous le bouton | Saisis un prix d'achat valide pour enregistrer. · Choisis un format pour enregistrer. · Les frais de ce format ne sont pas chargés : connecte-toi avec ton PIN. · Change le nom pour enregistrer. |
| Bandeau | Ce produit est retiré : l'enregistrer le remet en vente. |
| Toast | « nom » enregistré · XX,XX € (Voir) · « nom » n'existe plus sur cet appareil : ce calcul sera enregistré comme un nouveau produit |

## 8. Accessibilité

- Labels visibles ; `aria-invalid` et `aria-describedby` sur prix et nom.
- Formats : bouton `aria-expanded`/`aria-controls`, groupe `radiogroup`, flèches,
  Entrée/Espace valident, Échap referme sans changer de format.
- Annonce polie (`aria-live="polite"`) du prix et du format, après une pause
  de frappe.
- Cibles ≥ 44 × 44 px ; focus 2 px or, sombre sur l'étiquette crème.
- Aucun état porté par la seule couleur ; contrastes ≥ 4,5:1 (vérifiés).
