# Compilation et publication de l'app

Depuis l'étape 2, l'app est écrite en modules dans `app/` et compilée par
Vite dans `dist/`. GitHub Actions teste puis publie `dist/` sur GitHub Pages.
L'adresse de l'app ne change pas : https://loicvers.github.io/Prix-de-vente/

## Organisation

| Chemin | Rôle |
| --- | --- |
| `app/index.html` | Page de l'app (structure HTML). |
| `app/src/main.js` | Démarrage : polices, styles, événements, service worker. |
| `app/src/config.js` | `SCRIPT_URL` : adresse `/exec` du script (facultative). |
| `app/src/core/` | Calcul (`calcul.js`), formats (`categories.js`), mise en forme. |
| `app/src/data/` | Stockage de l'appareil, état, appels au script, synchronisation. |
| `app/src/ui/` | Écrans : calculateur, produits, historique, PIN, onglets, messages. |
| `app/src/styles/app.css` | Styles. |
| `app/public/` | Manifeste et icônes, copiés tels quels. |
| `app/sw-modele.js` | Modèle du service worker (hors ligne). |
| `vite.config.mjs` | Compilation ; génère `dist/sw.js` avec la liste des fichiers et une version de cache calculée automatiquement. |
| `.github/workflows/publication.yml` | Tests à chaque demande de fusion ; publication sur `main`. |

Les fichiers `index.html`, `calcul.js`, `sw.js`, `manifest.json` et les
icônes **à la racine** sont l'ancienne app. Ils ne sont plus modifiés et
servent uniquement de solution de repli (voir plus bas). Ils seront supprimés
une fois la nouvelle publication validée.

## Commandes

```sh
npm install              # une fois
npm run dev              # app en développement (sans service worker)
npm run build            # compilation dans dist/
npm run apercu           # sert dist/ en local
npm test                 # calcul, script de la feuille, confidentialité
npm run test:e2e         # compile, puis teste l'app compilée dans Chromium
npm run test:e2e:ancienne  # mêmes tests sur l'ancienne app (comparaison)
```

Node 22.12 ou plus est nécessaire (Vite 8).

## Passage à la publication par GitHub Actions (une seule fois, Loïc)

À faire **après** la fusion de l'étape 2 dans `main`.

1. Ouvre https://github.com/Loicvers/Prix-de-vente › **Actions**. Le
   workflow « Tests et publication » a tourné sur `main` : l'étape `tests`
   doit être verte. L'étape `publication` peut être en échec à ce stade
   (GitHub Pages n'est pas encore réglé pour Actions) : c'est normal, et
   l'app en ligne n'a pas changé.
2. **Settings › Pages › Build and deployment › Source** : choisis
   **GitHub Actions** (au lieu de « Deploy from a branch »).
3. **Actions › Tests et publication › Run workflow** (branche `main`), puis
   attends que les deux étapes soient vertes (3 à 5 minutes).
4. Ouvre https://loicvers.github.io/Prix-de-vente/ sur un appareil déjà
   utilisé : l'ancienne version s'affiche encore une fois, puis le message
   « Nouvelle version disponible › Recharger » apparaît. Touche
   **Recharger**. Les produits en attente d'envoi sont conservés.
5. Contrôle rapide : calcule un prix, enregistre un produit d'essai,
   vérifie qu'il arrive dans la feuille, puis supprime-le.

À partir de là, chaque fusion dans `main` publie automatiquement l'app,
**seulement si tous les tests passent**.

## Revenir à l'ancienne app (en cas de problème)

1. **Settings › Pages › Source** : **Deploy from a branch**, branche `main`,
   dossier `/ (root)`, **Save**.
2. Attends 1 à 3 minutes : l'ancienne app (racine du dépôt) est de nouveau
   servie. Sur chaque appareil, elle remplace la nouvelle à l'ouverture
   suivante ; les données de l'appareil (produits, PIN, file d'attente) sont
   les mêmes pour les deux versions.

## Modifier l'adresse du script dans le code

Pour ne plus saisir l'adresse `/exec` sur chaque appareil, écris-la dans
`app/src/config.js` (`export const SCRIPT_URL = '…';`). L'adresse n'est pas
secrète : sans PIN, le script refuse tout.
