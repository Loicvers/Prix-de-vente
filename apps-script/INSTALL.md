# Installer le script de la feuille de prix

Ce guide remplace le script de ta feuille Google par la nouvelle version
(`Code.gs`), qui refuse toute requête sans ton PIN et sépare la feuille en
un onglet **Privé** et un onglet **Public**.

Prévois 20 minutes, sur ordinateur. Fais-le en une fois, et **n'enregistre
aucun produit dans l'app** pendant ce temps, ni ensuite, tant que la nouvelle
version de l'app n'est pas en ligne (voir `MIGRATION.md`).

> Les valeurs de la config (frais, tranches, coefficients) ne sont **pas**
> dans ce guide : ce dépôt est public. Elles t'ont été remises à part, dans
> le fichier privé `config-privee.json`. Ne les copie jamais dans le dépôt.

---

## 1. Coller le nouveau code

1. Ouvre ta feuille Google de prix.
2. Menu **Extensions › Apps Script**. L'éditeur s'ouvre dans un nouvel onglet.
3. À gauche, clique sur le fichier **Code.gs**.
4. Sélectionne tout son contenu (Ctrl+A, ou Cmd+A sur Mac) et efface-le.
   L'ancien code n'est pas perdu : il reste dans la version utilisée par
   l'ancien déploiement.
5. Ouvre le fichier `apps-script/Code.gs` de ce dépôt sur GitHub, clique sur
   l'icône **Copier** (deux carrés) en haut à droite du fichier, puis colle
   dans l'éditeur (Ctrl+V).
6. Clique sur l'icône **Enregistrer** (disquette).

## 2. Créer les propriétés PIN et CONFIG

1. Dans l'éditeur Apps Script, clique sur la **roue dentée** à gauche
   (**Paramètres du projet**).
2. Tout en bas : **Propriétés du script › Ajouter une propriété du script**.
3. Première propriété :
   - Propriété : `PIN`
   - Valeur : ton PIN, **au moins 6 chiffres**, que tu n'utilises nulle part
     ailleurs (ni carte bancaire ni téléphone).
4. Clique à nouveau sur **Ajouter une propriété du script** :
   - Propriété : `CONFIG`
   - Valeur : colle **tout** le contenu du fichier privé `config-privee.json`
     (il commence par `{"categories":` et se termine par `}`).
5. Clique sur **Enregistrer les propriétés du script**.

La valeur de CONFIG a cette forme (les `…` sont remplacés par les vrais
montants dans le fichier privé) :

```json
{"categories":{"tranquille":{"frais":…,"detail":"…"},"mousseux":{"frais":…,"detail":"…"},"demie":{"frais":…,"detail":"…"},"intermediaire":{"frais":…,"detail":"…"}},"tranches":[{"jusqua":…,"coef":…},{"jusqua":…,"coef":…},{"jusqua":null,"coef":…}],"arrondi":…}
```

Pour changer plus tard un frais ou un coefficient : modifie seulement cette
propriété. L'app récupère la nouvelle config à sa prochaine synchronisation.

## 3. Créer le nouveau déploiement

1. En haut à droite : **Déployer › Nouveau déploiement**.
2. À côté de « Sélectionner le type », clique sur la roue dentée et choisis
   **Application Web**.
3. Remplis :
   - Description : `v2 avec PIN`
   - Exécuter en tant que : **Moi** (ton adresse)
   - Qui peut accéder : **Tout le monde**
4. Clique sur **Déployer**.
5. Google demande une autorisation : **Autoriser l'accès**, choisis ton
   compte. Si un écran dit « Google n'a pas validé cette application » :
   **Paramètres avancés › Accéder à … (non sécurisé)**, puis **Autoriser**.
   C'est ton propre script, c'est normal.
6. Copie l'**URL de l'application Web** (elle se termine par `/exec`) et
   garde-la : l'app te la demandera avec ton PIN.
7. Vérification : colle cette URL dans la barre d'adresse du navigateur. La
   page doit afficher `{"ok":false,"error":"auth"}`, preuve que le script
   refuse sans PIN.

## 4. Archiver l'ancien déploiement

L'ancien déploiement fait encore tourner l'ancien code, sans PIN, et son
adresse est publique : il faut le couper.

1. **Déployer › Gérer les déploiements**.
2. À gauche, sélectionne l'**ancien** déploiement (pas celui que tu viens de
   créer, « v2 avec PIN »).
3. Clique sur l'icône **Archiver** (boîte), puis confirme.
4. Il ne doit plus rester, dans la liste active, que « v2 avec PIN ».

Archiver ne supprime rien : l'ancien déploiement reste consultable dans les
archives, mais son adresse ne répond plus.

## 5. Lancer la migration (une seule fois)

`migrer()` réorganise le fichier :
- la feuille existante est renommée **Historique** (son contenu n'est pas
  touché) ;
- deux feuilles sont créées : **Privé** (tout, y compris prix d'achat et
  frais) et **Public** (nom, catégorie, prix de vente, disponibilité) ;
- chaque vin reçoit un SKU fixe (UCP-0001, UCP-0002…). Un vin présent
  plusieurs fois n'a qu'une ligne, avec son prix le plus récent.

Le script trouve les colonnes grâce à leurs en-têtes (ligne 1) :
`id, nom, pa, htva, pct, historique` sont reconnus, et la catégorie de chaque
vin est retrouvée à partir de son prix. Tu n'as rien à modifier dans le code.

1. En bas du fichier, vérifie qu'il n'y a qu'**une seule feuille**.
2. Dans l'éditeur Apps Script, en haut, à côté de **▷ Exécuter**, une liste
   déroulante affiche un nom de fonction : choisis **migrer**.
3. Clique sur **▷ Exécuter**. Si Google redemande une autorisation, fais
   comme à l'étape 3.5.
4. En bas de l'éditeur, le journal affiche « Migration terminée : … ». S'il
   cite des vins dont la « catégorie est à compléter », ouvre la feuille
   **Privé** et tape leur catégorie à la main (colonne C).

Si une colonne n'est pas reconnue, le script s'arrête avec « Colonne
introuvable » **sans rien modifier** : envoie le message à Claude Code.

### Tu as déjà lancé une ancienne version de `migrer()` ?

Si Privé et Public existent mais contiennent des erreurs (des numéros à la
place des noms, par exemple) :

1. Colle la dernière version de `Code.gs` (étape 1), puis enregistre.
2. Dans la liste déroulante, choisis **refaireMigration**, puis
   **▷ Exécuter**.
3. Les feuilles fausses sont renommées « Privé (ancien essai) » et « Public
   (ancien essai) » (rien n'est supprimé), et de nouvelles feuilles Privé et
   Public sont créées à partir d'Historique, qui n'est pas modifiée.
4. Vérifie les nouvelles feuilles. Tu pourras ensuite masquer les deux
   anciens essais (clic droit sur la feuille › **Masquer la feuille**).

## 6. Contrôles

- **Public** a exactement 5 colonnes : SKU, Nom, Catégorie, Prix TTC,
  Disponibilité. Aucun prix d'achat, aucun frais.
- **Privé** a les colonnes : SKU, Nom, Catégorie, Prix d'achat HT, Frais,
  Prix TTC, Date MAJ.
- **Historique** est identique à l'ancien onglet.
- Ne partage jamais la feuille entière. Si un jour elle doit alimenter le
  site, ne publie que l'onglet **Public** (Fichier › Partager › Publier sur
  le Web › choisir « Public »).

## En cas de souci

- L'app dit « PIN refusé » : vérifie la propriété `PIN` (pas d'espace avant
  ou après).
- L'app dit « Trop d'essais de PIN » : après 20 PIN faux, le script refuse
  tout pendant 15 minutes. Attends, puis réessaie.
- L'app dit « erreur du script (serveur) » : la propriété `CONFIG` est
  absente ou mal collée. Recolle tout le contenu du fichier privé.
- Tu as modifié le code : **Déployer › Gérer les déploiements**, crayon sur
  « v2 avec PIN », Version : **Nouvelle version**, **Déployer**. L'URL ne
  change pas.
