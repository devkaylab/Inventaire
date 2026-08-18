# vendor/ — SheetJS versionné dans le dépôt

Ce dossier existe pour une seule raison : **npm ne distribue plus de version
saine de `xlsx`**, la bibliothèque qui lit les fichiers Excel importés
(référentiel articles, stock théorique) et écrit le rapport d'inventaire.

## Pourquoi

`npm install xlsx` sert `0.18.5`, publiée en 2022. Elle porte deux failles,
toutes deux dans la **partie lecture** — celle qui traite des fichiers fournis
par l'utilisateur :

- **CVE-2023-30533** — pollution de prototype, corrigée en 0.19.3 ;
- **CVE-2024-22363** — déni de service par expression régulière (ReDoS),
  corrigée en 0.20.2.

SheetJS a quitté npm. Le paquet y est figé, et `npm audit` le dit sans détour :
« No fix available ». Les versions corrigées ne sont publiées que sur
<https://cdn.sheetjs.com/>.

Trois issues existaient ; voici pourquoi celle-ci a été retenue :

| Voie | Écartée parce que |
|---|---|
| Republication npm (`@e965/xlsx`, `xlsx-republish`) | ajoute un tiers inconnu à la chaîne d'approvisionnement — pour corriger une faille de sécurité |
| URL du CDN dans `package.json` | chaque build (Vercel, EAS) dépend de la disponibilité d'un site tiers |
| Abandon de SheetJS | aucune autre bibliothèque npm ne lit le `.xls` historique, que les deux sélecteurs de fichiers acceptent |

L'archive versionnée n'a aucun de ces défauts : c'est le code officiel des
auteurs, il est installé hors ligne, et le `package-lock.json` enregistre son
empreinte `integrity` — l'archive est donc scellée, toute altération fait
échouer l'installation.

## Mettre à jour la version

1. Ouvrir <https://cdn.sheetjs.com/> et télécharger `xlsx-<version>.tgz`
   (**≥ 0.20.2**).
2. Déposer l'archive ici, **sans la renommer ni l'ouvrir**, et supprimer
   l'ancienne : le script refuse d'en trouver deux.
3. Lancer, depuis la racine du dépôt :

   ```
   node scripts/installer-sheetjs.mjs
   ```

   Il vérifie le contenu de l'archive, branche les deux `package.json` en
   `file:`, installe des deux côtés, puis contrôle ce qui a réellement atterri
   dans `node_modules`.

4. Versionner : l'archive, les deux `package.json`, les deux
   `package-lock.json`.

## À ne pas faire

- **Ne jamais réinstaller `xlsx` depuis npm** (`npm install xlsx`) : cela
  ramènerait 0.18.5 et ses deux failles, en écrasant silencieusement le
  `file:`. Après tout ajout de dépendance, vérifier que les deux
  `package.json` pointent toujours sur `vendor/`.
- Ne pas décompresser l'archive dans le dépôt : npm installe une copie propre
  depuis le `.tgz`, et un dossier versionné serait lié par symlink — ce que le
  bundler de l'application mobile ne suit pas.

## Point à surveiller au déploiement

Le site est déployé avec `web/` pour racine, mais l'archive vit à la racine du
dépôt (`file:../vendor/…`). Le réglage Vercel **« Include files outside of the
Root Directory »** doit rester activé, sans quoi l'installation échouera au
build. Un déploiement de vérification suffit à le confirmer.
