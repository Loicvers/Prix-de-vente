# État de référence de l'app (étape 0)

Photographie du comportement de l'app **avant** la refonte, établie le
25/09/2026 sur le commit `3a70305` (branche `main`). Aucune modification
fonctionnelle n'a été faite : seuls des tests ont été ajoutés.

Chaque comportement ci-dessous est vérifié par un test automatique. Pendant la
refonte, un test ne doit changer que si le changement de comportement est
voulu et validé ; les tests marqués **BUG CONNU**, **LIMITE CONNUE** ou
**RISQUE** décrivent le comportement actuel, pas le comportement souhaité.

## Suivi des étapes

| Étape | Statut | Effet sur les tests de référence |
| --- | --- | --- |
| 0. État de référence | Fait | — |
| 1. Script v3 : versions, conflits, Journal, réactivation, lecture des produits | Fait (à déployer dans Apps Script) | B-03 corrigé (test inversé volontairement) ; B-06 toujours présent avec l'app actuelle, mais tracé dans le Journal. Les 58 autres tests de l'app passent sans changement avec le nouveau script. |

## Lancer les tests

```sh
npm install          # une fois (installe Playwright)
npm test             # calcul, script de la feuille, confidentialité (~1 s)
npm run test:e2e     # l'app dans Chromium (~30 s)
npm run test:tout    # les deux
```

Les tests de l'app ouvrent `index.html` dans Chromium et remplacent le script
Google par **le vrai `apps-script/Code.gs`** exécuté dans une fausse feuille
en mémoire (`tests/helpers/fausse-feuille.js`), avec une config fictive
couvrant les 10 formats. Aucune valeur réelle n'est utilisée.

## Tests effectués et résultats

| Fichier | Domaine | Tests | Résultat |
| --- | --- | --- | --- |
| `tests/calcul.test.js` | Moteur de calcul, config fictive ; 11 cas réels avec `tests/config.local.json` | 15 | 3 réussis, 12 ignorés sans config réelle |
| `tests/apps-script.test.js` | Script de la feuille : PIN, upsert, lot, retrait, migration, diagnostic | 15 | 15 réussis |
| `tests/apps-script-versions.test.js` | Étape 1 : versions, conflits, Journal, réactivation, lecture des produits, ancien format de Privé | 12 | 12 réussis |
| `tests/secrets.test.js` | Aucune valeur confidentielle dans le dépôt | 1 | réussi |
| `tests/e2e/calcul.e2e.js` | 10 formats × 8 prix, saisie, détail, config absente ou invalide | 10 | 10 réussis |
| `tests/e2e/produits.e2e.js` | Ajout, modification, fiche, recalcul, retrait, réactivation, recherche, filtres, noms dangereux | 13 | 13 réussis |
| `tests/e2e/synchro.e2e.js` | PIN, lot, paquets de 40, ancien script, refus, réponse perdue, modification pendant l'envoi, 5 erreurs, réessais, 2 appareils | 19 | 19 réussis |
| `tests/e2e/pwa.e2e.js` | Service worker, cache, hors ligne, mise à jour, manifeste, en-tête | 5 | 5 réussis |
| `tests/e2e/navigation.e2e.js` | Onglets, fenêtres, clavier, badge, stockage (ancien format, abîmé, bloqué, plein), limites | 12 | 12 réussis |

Total : **102 tests, 90 réussis, 12 ignorés (config réelle absente), 0 échec** (état après l'étape 1 ; 90 tests à l'étape 0).
Suite de l'app exécutée 3 fois de suite sans échec (stabilité).

## Bugs et limites constatés

| Réf. | Constat | Test |
| --- | --- | --- |
| B-01 | « 1.234,56 » est lu 1,234 : le séparateur de milliers « . » n'est pas géré (« 1 234,56 » fonctionne). | `calcul.e2e.js` |
| B-02 | « Recalculer » puis changement de nom crée un second produit et un second SKU au lieu de renommer. | `produits.e2e.js` |
| B-03 | Un produit retiré puis réenregistré garde son SKU mais reste « retiré » dans l'onglet Public. **Corrigé à l'étape 1.** | `produits.e2e.js` |
| B-04 | Un produit de catégorie inconnue (ex. produit migré « à compléter ») s'affiche « Vin tranquille ». | `produits.e2e.js` |
| B-05 | Pas de synchronisation descendante : un produit créé sur un appareil n'apparaît jamais sur un autre. | `synchro.e2e.js` |
| B-06 | Modifications concurrentes : le dernier envoi écrase le précédent sans aucun signal (ex. appareil revenu en ligne après une modification faite ailleurs). **Étape 1 : le script sait refuser l'écrasement ; l'app le fera à l'étape 3. En attendant, chaque écriture est tracée dans le Journal.** | `synchro.e2e.js` |
| R-01 | Mémoire de l'appareil pleine hors ligne : l'alerte s'affiche, mais l'envoi en attente est perdu si l'app est fermée avant le retour du réseau. | `navigation.e2e.js` |

Constats sans test dédié (relevés à la lecture et aux mesures) :

- Le champ de prix est sous la ligne de flottaison (755 px sur un écran de
  844 px ; hors écran sur 320 × 568) ; le prix de vente n'est jamais visible
  sans défiler.
- Pastille de synchronisation (31 px) et bouton PIN (36 px) sous les 44 px
  recommandés ; texte secondaire au contraste 3,8 à 4,6 (4,5 requis).
- Sur un iPhone antérieur à iOS 16.2, la catégorie choisie n'est plus mise en
  évidence (`color-mix`).
- Le nom de cache hors ligne (`pv-v7`) se change à la main.
- Après 20 PIN faux, toute la boutique est bloquée 15 minutes.
- Les prix enregistrés ne sont jamais recalculés si la config change.

## Comportements actuels à préserver

**Calcul**
- Prix identique à `calcul.js` pour les 10 formats (80 combinaisons testées),
  tranches cumulées, arrondi au pas de la config.
- Saisie acceptant virgule, point, « € » et espaces ; résultat masqué si le
  prix est vide, nul, négatif ou illisible.
- Format absent de la config : « frais à charger », message « Connecte-toi une
  première fois avec ton PIN », aucun prix, enregistrement refusé.
- Détail : achat, frais (avec leur texte), base, une ligne par tranche, total ;
  état ouvert/fermé mémorisé.

**Produits**
- Même nom (casse et espaces ignorés) = même produit = même SKU ; le nom le
  plus récent est gardé.
- SKU attribués par le script dans l'ordre d'envoi (UCP-0001…).
- Retrait = « retiré » dans Public, Privé intact, rien d'effacé ; confirmation
  demandée.
- Retrait hors ligne annulé si le produit est réenregistré avant l'envoi.
- Nom HTML affiché tel quel, jamais exécuté ; nom commençant par « = »
  neutralisé dans la feuille.
- Public ne contient jamais prix d'achat ni frais.

**Synchronisation**
- Toute la file en une requête `lot` (config comprise), par paquets de 40 ;
  un lot vide au démarrage pour relire la config.
- Repli automatique sur une requête par opération avec un script sans `lot`.
- Un produit refusé est signalé (« ⚠ refusé : … ») sans bloquer les autres,
  et renvoyé à chaque synchronisation.
- Réponse perdue après écriture : renvoi sans doublon (identifiant local).
- Produit modifié pendant son envoi : renvoyé avec la dernière version.
- Messages distincts : PIN refusé, trop d'essais, hors ligne, script
  injoignable, réponse illisible, erreur Google, CONFIG absente.
- Réessai au retour du réseau, au retour sur l'app, et toutes les 2 minutes
  sur réseau faible.
- Voyant vert seulement si tout est envoyé et confirmé.

**PIN**
- Premier lancement : adresse du script et PIN demandés ; PIN faux jamais
  gardé ; hors ligne, PIN gardé sans vérification ; PIN changé côté script :
  l'écran PIN se rouvre.

**Hors ligne et PWA**
- Service worker : les 8 fichiers de l'app en cache ; ouverture, calcul et
  enregistrement hors ligne ; envoi au retour du réseau ; appels au script
  jamais mis en cache.
- Nouvelle version : ancien cache supprimé, message « Nouvelle version
  disponible » avec « Recharger » (à partir de la deuxième ouverture).
- Manifeste : nom, `standalone`, `./`, icônes 192, 512 (maskable) et 180 px.

**Stockage local (contrat)**
- Clés : `pv_categorie`, `pv_config`, `pv_detail`, `pv_historique`, `pv_pin`,
  `pv_produits_v2`, `pv_retraits`, `pv_url`.
- Données de l'ancienne version (sans `rev` ni `synced`) relues ; données
  abîmées ou stockage bloqué : l'app démarre quand même.
- Historique local limité à 300 calculs, 100 affichés.

**Navigation**
- 3 onglets avec état sélectionné ; la pastille mène à l'onglet Historique ;
  badge = produits en attente ; fiche fermée par Échap, clic sur le fond ou
  « Fermer » ; Entrée dans le prix passe au nom, Entrée dans le nom
  enregistre.

## Risques identifiés pour la refonte

1. **Perte d'envois en attente** lors du passage à la nouvelle version si les
   clés `pv_*` ou leur format changent : la migration doit relire l'existant.
2. **Appareils bloqués sur une ancienne version** si le nouveau service
   worker n'est pas publié à la même adresse (`sw.js`) ou si l'ancien cache
   n'est pas remplacé.
3. **Double source de vérité** pendant la transition vers la synchronisation
   descendante (produits locaux vs feuille) : la fusion doit être testée avant
   toute mise en ligne.
4. **Script et app déployés séparément** : chaque version de l'app doit
   rester compatible avec le script précédent, et inversement.
5. **Identifiants numériques** : l'app convertit les identifiants en nombres ;
   les produits relus depuis la feuille (identifiés par SKU) casseraient cette
   logique.
6. **Changement du mode de publication GitHub Pages** (branche → GitHub
   Actions) : une erreur de réglage rend l'app indisponible ; le retour
   arrière doit être documenté.
7. **Confidentialité** : la version compilée doit aussi être vérifiée par le
   test de recherche de valeurs confidentielles.
