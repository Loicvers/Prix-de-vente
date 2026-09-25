# Migration vers un dépôt neuf

L'ancien code de l'app contenait les frais et les coefficients. Même effacés
aujourd'hui, ils resteraient lisibles dans l'historique git du dépôt public.
On repart donc d'un dépôt neuf, dont l'historique ne contient que le code
nettoyé. **Rien n'est supprimé** : l'ancien dépôt est renommé et passé en
privé, intact.

L'adresse de l'app ne change pas : https://loicvers.github.io/Prix-de-vente/

Qui fait quoi :
- **Loïc** : étapes 1, 2, 3, 5 et 6, sur github.com et dans la feuille Google.
- **Claude Code** : étape 4 (envoi du code dans le nouveau dépôt).

Prévois environ 45 minutes en une fois, sur ordinateur. Pendant ce temps,
n'enregistre aucun produit dans l'app (l'ancienne version ne pourra plus
écrire dans la feuille, et elle ne le signalerait pas).

---

## Étape 1 – Installer le nouveau script (Loïc)

Suis `apps-script/INSTALL.md` jusqu'au bout. À la fin, tu as :
- les propriétés `PIN` et `CONFIG`,
- l'URL `/exec` du nouveau déploiement « v2 avec PIN » (note-la),
- l'ancien déploiement archivé,
- les onglets Historique, Privé et Public.

## Étape 2 – Renommer l'ancien dépôt et le passer en privé (Loïc)

1. Ouvre https://github.com/Loicvers/Prix-de-vente
2. Onglet **Settings** (roue dentée, en haut à droite du dépôt).
3. Section **General**, champ **Repository name** : remplace `Prix-de-vente`
   par `Prix-de-vente-archive`, puis clique sur **Rename**.
4. Toujours dans **Settings › General**, descends tout en bas jusqu'à la
   **Danger Zone** : **Change repository visibility › Change visibility ›
   Make private**, puis confirme en recopiant le nom demandé.
5. Ne supprime ni le dépôt, ni aucune branche.

L'ancienne app n'est plus servie (GitHub Pages s'arrête sur un dépôt privé
gratuit) : c'est normal, la nouvelle prend le relais à l'étape 5.

## Étape 3 – Créer le nouveau dépôt, vide (Loïc)

1. Ouvre https://github.com/new
2. Owner : **Loicvers** ; Repository name : **`Prix-de-vente`** (exactement).
3. Visibilité : **Public**.
4. Laisse **tout décoché** : pas de README, pas de .gitignore, pas de licence.
   Le dépôt doit être complètement vide.
5. Clique sur **Create repository**.

Préviens ensuite Claude Code que le dépôt est prêt, et donne-lui accès au
nouveau dépôt `Loicvers/Prix-de-vente` dans sa session.

## Étape 4 – Envoyer le code nettoyé (Claude Code)

Le code nettoyé est un commit unique, sans parent, préparé sur la branche
`claude/secure-prix-de-vente-pwa-0ata00` de l'ancien dépôt (devenu
`Loicvers/Prix-de-vente-archive`).

```sh
git clone --branch claude/secure-prix-de-vente-pwa-0ata00 --single-branch \
  https://github.com/Loicvers/Prix-de-vente-archive prix-de-vente-neuf
cd prix-de-vente-neuf
git log --oneline                       # une seule ligne attendue
git push https://github.com/Loicvers/Prix-de-vente HEAD:refs/heads/main
```

Contrôles sur le nouveau dépôt :

```sh
git clone https://github.com/Loicvers/Prix-de-vente controle && cd controle
git rev-list --count HEAD               # 1 (commit initial seul)
git log -p | grep -E "1[.,]714|AKfycb""zfmTfy"   # ne doit rien afficher
grep -rE "1[.,]714|1[.,]35|0[.,]56|1[.,]92|1[.,]18|0[.,]27|AKfycb""zfmTfy" . --exclude-dir=.git   # rien
```

Si Loïc veut éviter de saisir l'adresse du script sur chaque appareil, elle
peut être écrite dans `const SCRIPT_URL = '';` de `app/src/config.js` (depuis
l'étape 2 ; avant : `index.html`), dans un
second commit (l'adresse n'est pas secrète : sans PIN, le script refuse
tout).

## Étape 5 – Activer GitHub Pages (Loïc)

1. Ouvre https://github.com/Loicvers/Prix-de-vente › **Settings › Pages**.
2. **Source** : **Deploy from a branch**.
3. **Branch** : `main`, dossier **`/ (root)`**, puis **Save**.
4. Attends 1 à 3 minutes, puis ouvre https://loicvers.github.io/Prix-de-vente/

## Étape 6 – Premier lancement de l'app (Loïc)

Sur chaque appareil (téléphone, ordinateur) :
1. Ouvre https://loicvers.github.io/Prix-de-vente/ (recharge la page si
   l'ancienne version s'affiche encore).
2. L'écran **Ton PIN** s'affiche : colle l'adresse `/exec` notée à l'étape 1,
   tape ton PIN, **Valider**.
3. Dans l'onglet **Historique**, le voyant doit être vert : « Synchronisé
   avec Google Sheets ».
4. Test : calcule un prix, enregistre un produit « Test migration », puis
   vérifie qu'il apparaît une seule fois dans les onglets Privé et Public de
   la feuille, avec un SKU. Supprime-le dans l'app : dans Public, sa
   Disponibilité passe à « retiré » (la ligne reste).

Le bouton **Changer de PIN**, en haut de l'app, permet de retaper le PIN
(par exemple après l'avoir changé dans les propriétés du script).

## Contrôle final

- [ ] `Prix-de-vente-archive` est **privé**, avec tout son historique.
- [ ] `Prix-de-vente` est public et son historique part du commit initial nettoyé.
- [ ] https://loicvers.github.io/Prix-de-vente/ affiche la nouvelle app.
- [ ] La feuille a les onglets Historique (intact), Privé et Public.
- [ ] Dans Apps Script, seul le déploiement « v2 avec PIN » est actif.
