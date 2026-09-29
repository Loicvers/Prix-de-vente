# CALCULER_IMPLEMENTATION.md

## Implémentation de l'écran « Calculer » — alignée sur `CALCULER_SPEC_V2.md` 2.2

**Version :** 2.3 — 29/09/2026 (marge D4 révisée, formats D15)
**Statut :** implémenté (étape 4)

Remplace le plan dérivé de la spec 2.0 (ProductSelector, formats par produit,
paramètres éditables, calcul asynchrone), sans objet dans Tarif (option A).

---

## 1. Architecture (existante, réutilisée)

```text
UI            app/index.html #page-calc, app/src/ui/calculateur.js
  ↓
État          app/src/data/etat.js (etat.currentCat, etat.modification, produits…)
  ↓
Données       app/src/data/produits.js (enregistrement, D3/D8/D14)
              app/src/data/stockage.js (localStorage, succès/échec)
              app/src/data/synchro.js → api.js → apps-script/Code.gs
  ↓
Métier        app/src/core/evaluation.js (statuts, détail)
              app/src/core/calcul.js (moteur : prix inchangé ; marge ajoutée :
                tauxTVA, accises, coutRevient, marge — D4 révisée)
              app/src/core/format.js (lecture et mise en forme)
              app/src/core/categories.js (table des 10 formats)
```

Aucun framework ajouté. Aucun accès à Google Sheets depuis l'UI.

## 2. Correspondance avec les responsabilités du plan 2.0

| Responsabilité | Réalisation réelle |
|---|---|
| ProductSelector / ProductSummary | Sans objet (C1). Produit = champ nom + mode modification ouvert par « Recalculer » (`ouvrirModification`) |
| FormatSelector | `renderCategories`, `ouvrirFormats`, `fermerFormats`, `selectCat` |
| CalculationInputs | `#input-prix` seul paramètre (C4) |
| Business engine | `evaluerCalcul()` → `Calcul.prixTTC`, `frais`, `detailTranches` |
| CalculationResult | `calculer()` : étiquette, statut `data-statut`, annonce `aria-live` |
| CalculationDetails | `lignesDetail()` (données) → rendu `<dl>` ; `detailHtml()` pour la fiche produit |
| SaveCalculationAction | `sauvegarder()` → `enregistrerProduit()` → `syncNow()` |
| Store | `etat` existant (pas de second store) |

## 3. États

- Calcul : `vide`, `invalide`, `sans-config`, `sans-format`, `format-manquant`,
  `erreur`, `valide` (`core/evaluation.js`). Pas de `loading` : le calcul est
  local et synchrone (C5) ; un état de chargement serait simulé.
- Enregistrement : `repos` → `encours` → `enregistre` (1,6 s) → `repos`.
  Succès = écriture sur l'appareil confirmée par `stockage.ecrire` (C6, §10.4).
  La synchronisation est un état distinct (voyant).

## 4. Invalidation et courses

- Chaque entrée (format, prix, config) réévalue immédiatement ; un statut non
  valide affiche « — », jamais l'ancien montant.
- Calcul planifié une fois par image (`requestAnimationFrame`, annulé à chaque
  frappe) : mécanisme existant conservé.
- `sauvegarder()` recalcule avec les entrées du moment : un ancien résultat ne
  peut pas être enregistré.
- Mode modification lié par `{ id, sku }`, relu dans `etat.produits` à chaque
  usage : les objets remplacés par la synchronisation (`fusion.js`) ne cassent
  pas le lien.
- Synchronisation : une seule à la fois (`syncEnCours`, existant) ; le produit
  modifié l'est sur place pour que le contrôle `rev` d'un envoi en cours
  fonctionne.

## 5. Règles dans la couche données (`data/produits.js`)

- `analyserNom` : `vide`, `nouveau`, `existant`, `renommage`, `collision`,
  `introuvable`.
- `enregistrerDans` refuse nom vide, format inconnu, prix invalide, collision
  (D8) et produit disparu, sans rien modifier ; en cas d'échec d'écriture des
  produits, l'état en mémoire est restauré.

## 6. Tests

| Fichier | Couverture |
|---|---|
| `tests/format.test.js` | lecture des montants (B-01, D11, compatibilité) |
| `tests/evaluation.test.js` | statuts, moteur réel, détail, changement d'entrée, échec du moteur |
| `tests/produits.test.js` | création, mise à jour, renommage, D8, D14, échec de stockage, retraits |
| `tests/e2e/calculer.e2e.js` | D1, responsive 320–1440, clavier, invalidation, local puis synchro, hors ligne, double soumission, D4 (coefficients issus de la config), D8, D14, format inconnu, mode modification, synchronisation pendant une modification |
| `tests/e2e/calcul.e2e.js`, `produits.e2e.js`, `navigation.e2e.js` | tests de référence adaptés aux changements voulus (libellés V2, B-01, B-02, D9, §10.4) |

## 7. Hors périmètre (non modifié)

Libellés V2 dans Produits, Historique et filtres (D2 au-delà de Calculer),
en-tête global élargi sur desktop et à 320 px, ancienne app à la racine.
