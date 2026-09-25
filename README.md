# Prix-de-vente

Calculateur de prix de vente (PWA) d'Une Autre Clé du Paradis, servi par
GitHub Pages : https://loicvers.github.io/Prix-de-vente/

## Contenu

| Fichier | Rôle |
| --- | --- |
| `index.html` | L'app : calcul, liste des produits, synchronisation avec la feuille Google. |
| `calcul.js` | Le calcul par tranches cumulées. Aucun montant : tout vient de la config. |
| `sw.js` | Service worker : l'app s'ouvre instantanément, même hors ligne. |
| `manifest.json`, `icon*.png`, `icon.svg` | Installation sur l'écran d'accueil (PWA). |
| `apps-script/Code.gs` | Script de la feuille Google (à coller dans Apps Script). |
| `apps-script/INSTALL.md` | Installation du script, pas à pas. |
| `MIGRATION.md` | Passage au dépôt neuf, pas à pas. |
| `tests/` | Tests (`npm test`, `npm run test:e2e`, Node 18 ou plus). |
| `docs/ETAT-DE-REFERENCE.md` | Comportement de référence avant la refonte. |

## Catégories

Bouteille 75 cl (tranquille, pétillant), grands formats (magnum 1,5 l
tranquille et pétillant, double magnum tranquille 3 l, jéroboam pétillant
3 l, tranquille 4,5 l, jéroboam tranquille 5 l), 37,5 cl et produit
intermédiaire. Les frais des grands formats sont à
ajouter dans `CONFIG` : voir `apps-script/INSTALL.md`, « Ajouter une
catégorie ». Aucun montant de frais dans ce dépôt.

## Synchronisation

L'app envoie toute sa file d'attente (enregistrements et retraits) en une
seule requête `lot`, qui renvoie aussi la config et la liste des produits.
Un produit refusé par le script est signalé dans la liste sans bloquer les
autres. Avec un script pas encore mis à jour, l'app repasse automatiquement à
une requête par opération.

La feuille Google est la source commune des produits (script version 3) :

- chaque produit de Privé a une **Version**, augmentée à chaque écriture, et
  l'**Appareil** qui l'a modifié en dernier ;
- une écriture qui porte la version connue de l'appareil est refusée si la
  feuille a changé entre-temps (`error: 'conflit'`, avec la version de la
  feuille) : rien n'est écrasé sans le savoir ;
- l'onglet **Journal** (privé) trace chaque écriture et chaque conflit ;
- un produit retiré puis réenregistré redevient disponible, sous le même SKU ;
- l'action `produits` (et la réponse de `lot`) renvoie la liste complète.

Le détail du protocole est en tête de `apps-script/Code.gs`.

## Sécurité

- Aucun frais, coefficient ni prix d'achat dans ce dépôt : la config est dans
  la propriété `CONFIG` du script, et l'app la reçoit après vérification du
  PIN, puis la garde en cache sur l'appareil (`pv_config`).
- Le PIN est saisi dans l'app et gardé sur l'appareil (`pv_pin`), jamais
  dans le code. Le script refuse toute requête sans le bon PIN.
- Le voyant de synchronisation ne passe au vert que si le script a répondu
  `ok: true` et que plus rien n'attend d'être envoyé.

## Tests

```sh
npm install          # une fois (Playwright, pour les tests de l'app)
npm test             # calcul, script de la feuille, confidentialité
npm run test:e2e     # l'app dans Chromium, contre le vrai Code.gs
```

L'état de référence de l'app (comportements vérifiés, bugs et risques connus)
est décrit dans `docs/ETAT-DE-REFERENCE.md`.

Les 4 cas de prix de référence ont besoin de la vraie config : copie la
valeur de la propriété `CONFIG` dans `tests/config.local.json` (ignoré par
git). Sans ce fichier, ces cas sont indiqués comme ignorés (« skipped »).

Les autres tests tournent sans config : calcul avec une config fictive,
script de la feuille contre une fausse feuille Google, et recherche de
valeurs confidentielles dans tous les fichiers du dépôt.
