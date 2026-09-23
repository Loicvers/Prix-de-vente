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
| `tests/` | Tests (`node --test`, Node 18 ou plus). |

## Catégories

Bouteille 75 cl (tranquille, pétillant), magnum 150 cl (tranquille,
pétillant), 37,5 cl et produit intermédiaire. Les frais des magnums sont à
ajouter dans `CONFIG` : voir `apps-script/INSTALL.md`, « Ajouter les magnums ».

## Synchronisation

L'app envoie toute sa file d'attente (enregistrements et retraits) en une
seule requête `lot`, qui renvoie aussi la config. Un produit refusé par le
script est signalé dans la liste sans bloquer les autres. Avec un script pas
encore mis à jour, l'app repasse automatiquement à une requête par opération.

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
node --test
```

Les 4 cas de prix de référence ont besoin de la vraie config : copie la
valeur de la propriété `CONFIG` dans `tests/config.local.json` (ignoré par
git). Sans ce fichier, ces cas sont indiqués comme ignorés (« skipped »).

Les autres tests tournent sans config : calcul avec une config fictive,
script de la feuille contre une fausse feuille Google, et recherche de
valeurs confidentielles dans tous les fichiers du dépôt.
