# Les présentations Quantinvo

## ⚠️ Les trois decks en service (19 septembre 2026)

Julien a supprimé tous les anciens `.pptx` (« trop anciens ») et demandé trois
decks neufs, **inspirés des pages du site**, en phrases courtes, sans terme
inventé ni répétition, et **sans signe ni mot coupé en début de ligne**.

| Script | Fichier produit | Pour qui | Pages |
|---|---|---|---|
| `build-commercial.js` | `Quantinvo-commercial.pptx` | Direction, contrôle de gestion, achats : l'inventaire et la loi, les problèmes, les solutions, pourquoi nous, les prix | 15 |
| `build-prise-en-main.js` | `Quantinvo-prise-en-main.pptx` | Administrateur, superviseurs, compteurs : un premier inventaire, geste par geste, site et application | 28 |
| `build-dsi.js` | `Quantinvo-dossier-DSI.pptx` | Direction informatique : architecture, hébergement, accès, réseau, appareils, données, sécurité, ce qu'il faut prévoir | 17 |
| `build-presentation.js` | `Quantinvo-presentation.pptx` | Présentation du 2 octobre 2026, 25 minutes puis démonstration — **le texte est celui de Julien, mot pour mot** | 18 |

Générer et contrôler, depuis ce dossier :

```
for f in build-commercial.js build-prise-en-main.js build-dsi.js build-presentation.js; do node $f && FONT_MODE=brand node $f; done
node verifier-typo.js Quantinvo-commercial.pptx Quantinvo-commercial-marque.pptx Quantinvo-prise-en-main.pptx Quantinvo-prise-en-main-marque.pptx Quantinvo-dossier-DSI.pptx Quantinvo-dossier-DSI-marque.pptx Quantinvo-presentation.pptx Quantinvo-presentation-marque.pptx
```

- **`charte.js` pose la typographie française partout** (`typo()`) : espace
  fine insécable avant `; : ! ? »` et dans les milliers, insécable après un
  nombre et avant `— % €`, et plus d'espace avant une virgule ou un point.
- **`verifier-typo.js` contrôle le RENDU**, pas le script : LibreOffice
  convertit en PDF, chaque ligne est relue ; il signale un signe en début de
  ligne et un mot coupé (avec ou sans tiret, en recollant la fin d'une ligne au
  début de la suivante). Il écrit aussi une image par page dans `verif/`
  (ignoré par git) : l'œil reste nécessaire pour ce qui déborde. PowerPoint
  compose un peu autrement que LibreOffice : regarder une fois dans PowerPoint
  avant d'envoyer.
- **Captures du site** : `../captures-site/2026-09-19-rayon-textile/` (compte
  de démo réel), jamais `web/screenshots/` (faux compte de test).
- **L'écart vaut compté − théorique**, le signe du rapport.

⚠️ **`captures/boite-a-outils.png` EST PÉRIMÉE** depuis le 24 septembre 2026 :
elle affiche « Avery L7160 », alors que la planche a changé de format
(35,6 × 16,9 mm, 80 par feuille — fiche 107) et que l'application dit
maintenant le format sans nommer une seule marque. `build-presentation.js`
l'écarte et montre `creer-balises.png`, qui porte le même en-tête sans
afficher de référence. **À reprendre à la prochaine passe de captures**, avec
`creer-balises` et `zones` qui en dépendent.

`captures/planche-balises.png` n'est PAS une capture d'écran : ce sont six
balises telles qu'elles sortent du générateur, rendues depuis le PDF réel le
26 septembre 2026. À refaire si le dessin change (`src/lib/baliseDessin.ts`).

Les six anciens scripts (`build.js`, `build-court.js`, `build-tarifs.js`,
`build-samaritaine.js`, `build-histoire.js`, `build-pourquoi.js`) ont été
**supprimés le 19 septembre 2026**, à la demande de Julien, avec leurs decks.
Ils restent dans l'historique git ; le texte de terrain de Julien du
14 septembre (onze constats, cinq obstacles), qui vivait dans
`build-pourquoi.js`, est repris dans `build-commercial.js`. Le dossier
`histoire/` (écrans d'avant, tirés de git) n'est plus lu par aucun script.

## La charte

Fond blanc, charte **« Ardoise » v2** (9 septembre 2026), dans `charte.js` :
encre pour le texte ET pour les titres, des gris minéraux, et un vert forêt en
accent qui ne sert qu'à ce qui engage — une pastille numérotée, un grand
chiffre, un bouton dessiné. Coins nets, aucune ombre, aucun contour sur un bloc.
Le logo est **la zone** : un plan de magasin monochrome, de la même géométrie
que `web/components/Logo.tsx`. `build-commercial.js` lit aussi `blocs.js` (la
grille des offres) et `offres.js` (les prix, depuis `web/lib/offres.ts`).

⚠️ **`npm install` sans argument, jamais `npm install <paquet>`.** Les
dépendances sont déclarées dans `package.json` depuis le 2 septembre 2026 :
lancer `npm install docx` dans ce dossier quand il n'y avait pas de
`package.json` a **élagué `node_modules`** — pptxgenjs et sharp avaient
disparu, plus aucun deck ne se générait.

`FONT_MODE=brand` produit la variante `-marque` (**Archivo** et **Public
Sans**, les polices du produit), à présenter depuis un poste où elles sont
installées (posées dans `~/Library/Fonts` le 9 septembre, Regular et Bold avec
leurs italiques). La version sans suffixe est en Arial : c'est celle qu'on
envoie, elle s'affiche à l'identique partout.

Les fichiers `.pptx` sont **générés, jamais retouchés à la main** : une
retouche serait écrasée à la prochaine génération. On modifie le script.

## La passe de captures d’Ardoise (9 et 10 septembre 2026)

Les vingt-deux captures de `captures/` — et les `encadrees/` qui en
découlent — ont été reprises sur un **build Release** de l'iPhone 17 du
simulateur, compte de démonstration : vingt et une le 9 septembre 2026, la
dernière (`balise-terminee`) le 10. Les six decks et la fiche produit montrent
donc l'application telle qu'elle est depuis Ardoise : encre, gris minéraux,
vert forêt, et « Registre » sur le rapport et les écarts.

**Zéro écriture en base le 9 septembre**, contrôlé après coup : 0 comptage,
0 article, 0 zone créée, 0 statut de balise déplacé. La vingt-deuxième, elle,
en a coûté une — voir plus bas, elle a été défaite. Ce qui a permis les vingt
et une premières, et qu'il faut savoir pour refaire la passe :

- ⚠️ **On rouvre une balise DÉJÀ CLÔTURÉE, jamais une balise en attente.**
  L'ouverture est alors *différée* (règle du 25 août) : elle ne devient réelle
  qu'au premier scan, donc la clôture qui suit ne rappelle même pas
  `set_balise`. Ouvrir une balise `pending` écrirait, elle, deux fois.
- ⚠️ **`balise-hors-plage` se prend avec « Annuler », jamais « Ajouter »** —
  ce second bouton crée une zone.
- ⚠️ **Ne toucher ni à « Créer l'inventaire », ni à « Clôturer
  l'inventaire », ni à « Quitter l'inventaire », ni à « Supprimer ».**

### `balise-terminee`, prise le 10 septembre 2026 — et elle a coûté une écriture

C'est la célébration « Première balise terminée », et **c'était la seule
capture qui manquait à la passe**. Elle se déclenche dans la branche du serveur
de `closeBalise` (`scanner.tsx`), donc uniquement après une ouverture
*matérialisée* — celle d'une balise `pending`, jamais la réouverture différée
d'une balise déjà clôturée. Il n'existe aucun chemin qui n'écrive pas : la
passe du 9 s'y était refusée, Julien a donné le feu vert le 10.

Ce qui a été écrit, puis défait, sur la balise **1018** de « Rayon textile » :

1. ouverture de la balise (`pending` → `open`) ;
2. douze pièces sur trois références (TF-1001 ×5, AC-3001 ×4, AC-3002 ×3) ;
3. clôture → la célébration s'affiche, capture prise ;
4. **restauration par les gestes du produit, pas par du SQL** : réouverture,
   « Recompter à zéro » (`vider_balise`, qui efface les douze lignes et remet
   le cycle de comptage à faire), puis « Annuler le comptage »
   (`annuler_balise`, qui repasse la balise de `open` à `pending`).

⚠️ **« Recompter à zéro » ne suffit PAS à remettre l'état d'origine** : il
laisse la balise **ouverte**, puisqu'on est censé la recompter dans la foulée.
C'est « Annuler le comptage » qui la rend à `pending`. Il faut les deux, dans
cet ordre.

Contrôlé après coup, à l'identique de l'avant : 52 balises `pending/pending`,
12 `done/pending`, 6 `done/done` ; 72 comptages, 23 articles, 70 zones,
23 lignes de stock théorique, et `count_done_at` de 1018 à nul. **Ce qui
reste** : une ligne `balise_videe` dans `company_audit_log` — c'est une trace,
elle ne se défait pas, et c'est normal.

### `audit` reprise le 11 septembre 2026 — un défaut d'écran, pas de capture

Constat de Julien sur la capture encadrée : **les deux aplats de couleur
touchaient le filet rouge** de la carte d'écart. C'était l'écran, pas la prise
de vue — `styles.card` d'`audits.tsx` n'avait aucun `paddingLeft`, donc tous
ses enfants commençaient au bord du `borderLeftWidth`.

Corrigé (12 points d'inset), **mesuré** sur la capture brute avant et après :
**0 px, puis 36 px**. Reprise sur un build **Debug** de l'iPhone 17 — le
Release n'est nécessaire que pour `lancement`, à cause du bandeau LogBox —, et
**sans aucune écriture** : l'écran des écarts se consulte, il n'ouvre rien.

Les quatre decks qui la montrent (`build.js`, `build-court.js`,
`build-prise-en-main.js`, `build-samaritaine.js`) et la fiche produit ont été
régénérés. ⚠️ **Le ré-encadrement des vingt et une autres captures rend des
octets identiques** — `git status` ne montre qu'`audit.png`, ce qui confirme
que le pipeline est déterministe.

### ⚠️ Le clavier du simulateur mange les chiffres — sauf en mode Douchette

Piège du jour, et il fait perdre un quart d'heure. Le champ **Manuel** reçoit
la frappe telle quelle : `TF-1001` y arrive en `TF)&ÀÀ&` (disposition AZERTY du
Mac), et l'application ouvre « Article inconnu » sur ce charabia.

**Le mode Douchette, lui, redresse** — c'est exactement ce pour quoi
`lib/douchette.ts` a été écrit, et la clé de contrôle d'un EAN-13 tranche sans
ambiguïté. On saisit donc les articles par leur **code-barres, en mode
Douchette**, avec un saut de ligne final qui vaut validation :

```
3701000010017\n   → T-shirt coton blanc, M
```

⚠️ **Et un repère qui s'ouvre avale les frappes suivantes.** Au deuxième scan
du même article, le volet « Une erreur se corrige » se pose sur l'écran : neuf
saisies enchaînées derrière lui n'ont rien enregistré. Refermer le volet,
retoucher le champ, et **contrôler le compte en base** avant de clôturer.

### Comment se connecter sans que le mot de passe passe par la conversation

Il ne se tape pas : il se **copie dans le presse-papiers du simulateur** par un
tube, ce qui l'empêche d'apparaître où que ce soit.

```bash
sed -n '<ligne>p' <fichier-mémoire> | grep -o '`[^`]*`' | head -1 | tr -d '`' \
  | xcrun simctl pbcopy <UDID>
```

Puis, dans l'application : **appui long** sur le champ (`duration: 1`) →
« Paste ». Vider le presse-papiers ensuite. C'est la règle du projet — un
secret ne se recopie jamais dans une conversation, compte de démonstration
compris.

### Trois pièges de cette passe

- ⚠️ **Le simulateur doit être un iPhone 17** (1206 × 2622). Les coordonnées de
  masquage de `preparer-captures.js` sont calées dessus ; sur un 17 Pro Max
  (1320 × 2868) le masque tombe à côté et l'adresse réelle du compte d'essai
  partirait chez le client.
- ⚠️ **`mon-equipe` n'a plus de masque**, et c'est délibéré : l'écran n'affiche
  l'adresse d'un membre que **tant qu'il ne s'est jamais connecté**. Nadia
  s'est connectée depuis ; la ligne porte maintenant « 1 inventaire compté ».
  Un masque laissé là peindrait une fausse adresse par-dessus une phrase juste.
- ⚠️ **Les captures des boutiques ne remplacent pas cette passe.** Celles de
  `../boutiques/captures-app-store/` et `../boutiques/captures-google-play/`
  (8 septembre, déposées sur les deux fiches) montrent bien la nouvelle
  application, mais ce sont des **visuels de fiche** : accroche incrustée, fond
  coloré, téléphone en perspective. Elles n'entrent ni dans le cadre de
  téléphone des decks ni dans le bandeau de la fiche produit, et ne couvrent
  que cinq écrans sur vingt-deux.
  ⚠️ **Elles ont vécu cinq jours sur le Bureau plutôt que dans le dépôt**, et
  cela a suffi à faire annoncer le 13 septembre qu'elles étaient « à refaire » —
  alors que cette ligne-ci disait déjà le contraire. Elles y sont depuis.

### Ce que la passe a montré au passage

- **La boîte à outils de l'application annonce encore « Prise en main ·
  Bientôt »**, alors que le parcours existe sur le site depuis le
  1er septembre 2026 (`/outils/prise-en-main`). À reprendre.
- **Les captures du site (`web/screenshots/`) restent d'avant Ardoise** : le
  harnais Playwright est cassé — sous le faux Supabase, `useAuthGuard` ne passe
  jamais à `ready` et les vingt tests de `dashboard.spec.ts` échouent de la
  même façon. ⚠️ Et le chemin du navigateur est à passer à la main :
  `playwright.config.ts` cherche `/opt/pw-browsers/chromium`, absent de cette
  machine — voir `CHROMIUM_PATH`.

## Ce qui a été décidé en les écrivant (23 août 2026)

Julien : *« les decks ne doivent pas ressembler à une génération IA, pas
d'empreinte IA, ajoute de l'humanité »*. Un premier jet avait les tics du
genre : surtitres en capitales espacées, rangées de trois cartes identiques
avec une icône dans un rond, titres-slogans. Tout a été repris, et la charte
`charte.js` fixe le parti :

- **des pages de document, pas des grilles de cartes** — une colonne de
  titre à gauche, du texte courant à droite, des filets, un tableau
  avant / après, une grande citation. Aucune icône décorative ;
- **de vraies captures du produit** — celles du site depuis
  `web/screenshots/`, celles de l'application prises au simulateur (voir la
  recette plus bas). Aucun écran n'est dessiné ni maquetté ;
- **des pages qu'une machine n'écrit pas** : « D'où ça vient » (signée
  Julien), « Ce qu'on ne vous promet pas », « Ce qui n'existe pas encore »,
  « Quand ça ne se passe pas comme prévu ». Elles disent les limites avant
  qu'on les découvre ;
- **une voix** : « nous », des phrases courtes, des détails de terrain (la
  réserve sans réseau, le fichier à reformater, le mardi matin avant
  l'ouverture). Les notes du présentateur sont écrites pour être lues par
  Julien, pas pour être projetées.

## Refaire les captures du site

⚠️ **Les recadrages sont calés sur la mise en page AU RAIL** (30 août 2026).
Ceux d'avant visaient la barre du haut, qui n'existe plus : réutilisés tels
quels, ils décalent toutes les captures d'une centaine de pixels.

Deux jeux de captures, tous deux dans `web/screenshots/` :

- **le tableau de bord** (`light-desktop-suivi/ecarts/rapport/setup`), par
  `npx playwright test screenshots -g "light desktop"` ;
- **les pages publiques** (`light-desktop-tarifs/souscrire`,
  `light-mobile-telechargement`), par `npx playwright test captures-publiques`.

Depuis `web/`, avec un `next dev` déjà lancé :

```bash
CHROMIUM_PATH="$HOME/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  npx playwright test -c playwright.captures.config.ts
```

Trois pièges, tous rencontrés :

- **la config principale démarre son propre serveur sur le port 3100**, ce que
  Next 16 refuse tant qu'un `next dev` tourne pour le même dossier. D'où
  `playwright.captures.config.ts`, qui se branche sur celui du port 3000 ;
- **`CHROMIUM_PATH` n'est pas facultatif** : la config principale vise le
  navigateur d'une image Docker, absent d'un Mac ;
- **l'indicateur de développement de Next** (la pastille « N » en bas à
  gauche) et le bouton de thème sont **masqués à la capture** par le CSS
  `MASQUE` de `captures-publiques.spec.ts`. Sans lui, ils partent chez le
  client — c'est arrivé sur la capture du hub de téléchargement.

⚠️ **Le magasin d'essai s'appelle « Oberlin Lyon »**, comme celui des captures
de l'application. Il portait le nom d'un prospect réel jusqu'au 30 août 2026 :
montrer le nom d'un client dans le deck d'un autre n'est pas une option. Le nom
vit dans `web/tests-e2e/fixtures.ts`.

## Refaire les captures de l'application

Les vingt captures de `captures/` viennent du simulateur, sur un compte
d'essai (entreprise « Maison Oberlin », magasin « Oberlin Lyon », superviseur
Camille Roux, compteuse Nadia Benali). Pour les refaire :

1. lancer l'application dans le simulateur et se connecter au compte voulu ;
2. figer la barre d'état, sinon l'heure et la batterie changent d'une capture
   à l'autre :
   `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4` ;
3. prendre chaque écran : `xcrun simctl io booted screenshot <nom>.png`, en
   reprenant **exactement** les noms attendus par `preparer-captures.js` ;
4. `node preparer-captures.js <dossier>` — demi-résolution, masquage des
   adresses, écriture dans `captures/`.

⚠️ **Le masquage n'est pas cosmétique.** Le compte d'essai porte de vraies
adresses (`jthiongkay+demo-…@gmail.com`) : sans ce passage, elles partiraient
chez le client sur deux écrans (Mon compte, Mon équipe). Les remplacements
utilisent le domaine réservé `.example`, qui ne peut appartenir à personne.
Une capture nouvelle qui montre une adresse doit être ajoutée à `MASQUES`.

### ⚠️ L'écran de lancement ne s'obtient qu'en Release

`lancement.png` (le logo animé sur fond sombre) est le seul écran qui **ne peut
pas** être capturé sur le build habituel : en Debug, le bandeau LogBox « Open
debugger to view warnings » de React Native s'affiche par-dessus, et il partirait
chez le client. Il faut donc un build Release, où LogBox n'existe pas :

```bash
xcodebuild -workspace ios/Inventaire.xcworkspace -scheme Inventaire \
  -configuration Release -destination "platform=iOS Simulator,id=<UDID>" \
  -derivedDataPath ios/build/dd-release build
node node_modules/expo-constants/scripts/getAppConfig.js "$PWD" \
  ios/build/dd-release/Build/Products/Release-iphonesimulator/Inventaire.app/EXConstants.bundle
xcrun simctl install <UDID> ios/build/dd-release/Build/Products/Release-iphonesimulator/Inventaire.app
```

⚠️ **Ne pas sauter l'étape `getAppConfig.js`** : en Release, l'application se
ferme sans rien dire si `app.config` n'est pas déposé dans `EXConstants.bundle`
(c'est le piège que `scripts/simulateur.sh` règle pour le build Debug).

⚠️ **Remettre le build Debug ensuite** — sinon le rechargement par Metro ne
fonctionne plus, et une modification du code semble sans effet :
`xcrun simctl install <UDID> ios/build/dd/Build/Products/Debug-iphonesimulator/Inventaire.app`.

### Capturer sans pouvoir taper

⚠️ **L'outil qui fait les appuis tombe en panne, et il ne se répare pas.** Le
simulateur répond alors `No Legacy HID port found` : la connexion est morte, et
elle survit à l'extinction de l'appareil comme au redémarrage de Simulator.app.
Seul le redémarrage de la session la rend. `xcrun simctl io … screenshot`,
lui, continue de marcher.

Ce qui sauve la passe dans ce cas — c'est ainsi que les deux écrans du
2 septembre ont été pris — : **détourner la route d'accueil**. L'application
tourne en Debug, donc le code vient de Metro et se recharge tout seul.

1. dans `src/app/index.tsx`, remplacer le `<Redirect href="/(supervisor)/" />`
   par la route visée, par exemple
   `<Redirect href="/(supervisor)/<id>/audits" />` ;
2. `pkill -f "Inventaire.app/Inventaire"` puis `xcrun simctl launch` — le
   `terminate` de simctl ne tue pas toujours l'application ;
3. laisser Metro reconstruire (le premier écran affiche « Downloading… » —
   prendre une rafale de captures et garder la dernière), puis capturer ;
4. **remettre `index.tsx`** et le vérifier au `git status`.

Il ne couvre que les écrans qu'une route atteint : un scan en cours, une
balise ouverte ou une feuille dépliée demandent toujours un doigt.

Deux pièges de la capture elle-même :

- **`xcrun simctl terminate` ne tue pas toujours l'application** — il rend 0, et
  le `launch` qui suit rend le MÊME identifiant de processus, donc pas de
  démarrage, donc pas d'écran de lancement. Le processus tourne sur le Mac :
  `pkill -f "Inventaire.app/Inventaire"` le termine pour de bon ;
- **l'écran ne dure que 2,8 s** (650 ms d'entrée, 1,7 s de maintien, 450 ms de
  sortie), et il faut d'abord attendre que le splash natif blanc s'efface. On
  prend donc une rafale — `for i in $(seq 1 40); do xcrun simctl io <UDID>
  screenshot f$i.png; done`, environ 0,17 s par image — et on garde une image
  du maintien. Elles se repèrent à leur poids : le dégradé sombre compresse mal
  (~1,9 Mo), le reste de l'application fait le quart.

## `encadrees/` — les captures dans le téléphone, prêtes à l'emploi

**Toutes les captures existent aussi encadrées**, dans `encadrees/` : la même
image posée dans le téléphone dessiné des decks, fond transparent, téléphone
entier. Elles se reprennent telles quelles dans un document, un e-mail, une
page ou une diapositive, sans repasser par une présentation.

```
node encadrer.js                      # encadrees/, toutes les captures
node encadrer.js lancement            # lancement-encadre.png, à la racine
node encadrer.js lancement mon-titre  # mon-titre.png
```

⚠️ **`preparer-captures.js` les régénère d'office**, à la fin de son passage
(demande de Julien, 1er septembre 2026). C'est volontairement automatique : un
jeu encadré qu'il faut penser à refaire finit toujours par montrer un écran que
l'application n'a plus.

⚠️ **La géométrie du téléphone n'est pas recopiée dans `encadrer.js`** — bezel,
rayon et filet viennent de `cadrer()`, comme pour les decks. Deux dessins du
même téléphone divergeraient au premier ajustement, et les images remises au
client cesseraient de ressembler aux présentations.

⚠️ **La résolution de sortie est celle de l'entrée**, jamais plus. `captures/`
est en demi-résolution (603 px), donc les téléphones sortent à **~637 px de
large**. C'est assez pour un écran, juste pour du papier. Pour une version
pleine résolution, encadrer les captures **brutes** du simulateur, avant leur
passage par `preparer-captures.js`.

Les decks, eux, n'utilisent pas `encadrees/` : `cadrer()` fait le même travail à
la volée et coupe le bas pour que le téléphone déborde de sa carte. Une page
dont le téléphone est le sujet, elle, le veut complet — c'est le cas de la
page 1 du deck Samaritaine.

⚠️ **Le simulateur doit être en français.** Sinon la feuille de partage et les
menus système sortent en anglais au milieu d'un document français
(`xcrun simctl spawn booted defaults write .GlobalPreferences AppleLanguages -array fr-FR en`,
puis relancer l'application).

À savoir sur la mise en page : `cadrer()` calcule le recadrage à partir de la
**place disponible**, jamais d'une fraction fixée d'avance — un téléphone
taillé pour une autre hauteur débordait de sa carte. Et un écran dont
l'essentiel est en bas (une feuille qui monte, une alerte) ne peut pas passer
dans un téléphone qui déborde : il lui faut `ecranEntier`, plus étroit mais
complet.

## ⚠️ Aucun prix ne s'écrit dans un deck (30 août 2026)

`offres.js` **lit la grille dans `web/lib/offres.ts`**, la source du site, et
`blocs.js` la dessine — les quatre decks qui l'affichent la dessinent donc à
l'identique. Ce n'est pas une élégance : les decks du 24 août ont porté la
grille au volume de stock pendant une semaine **après son remplacement**, et
le deck Samaritaine promettait encore « compteurs illimités » et « pas
d'abonnement par appareil », soit l'inverse de ce qu'on facture.

La lecture à la source fait qu'un deck régénéré dit forcément le prix en
vigueur, et qu'une grille remaniée sans que le module suive **fait échouer la
génération** au lieu de sortir un document faux. Ne jamais recopier un montant
à la main, même « juste pour cette page ».

Ce qui reste à savoir sur l'offre : le prix suit le nombre d'appareils qui
comptent **en même temps dans un magasin** (Essential / Advanced / Enterprise),
une licence couvre **un** magasin, le mensuel est annoncé par défaut et
l'annuel se présente comme une économie **en euros**, jamais en pourcentage.
Le plafond est **souple** — on ne refuse jamais un appareil pendant un
comptage, et les decks le disent. Le raisonnement complet vit dans
`hypotheses-tarifaires.md` (hypothèse 4).

## ⚠️ La baseline, pour les documents à venir (2 septembre 2026)

**« La fiabilité du stock au quotidien »**, posée par Julien en créant le
bandeau Google Play. Tout **nouveau** document la porte.

⚠️ **Les six decks existants ne sont PAS à reprendre.** Ils portent « Outil
d'inventaire » et Julien a explicitement écarté l'alignement — il a retravaillé
ces documents ailleurs. Ne pas les « harmoniser » en croyant rattraper un
oubli ; c'est une décision, pas une dette.

La règle de vocabulaire, elle, ne bouge pas : Quantinvo est un **outil
d'inventaire**, jamais « une app » ; « application » ne désigne que le
composant mobile.

## Ce qu'il faut savoir avant de modifier
- **Le dossier DSI recopie des faits** de `deploiement-mdm.md` (identifiants,
  adresses réseau), de `docs/privacy.html` (sous-traitants) et d'AGENTS.md
  (audit, mots de passe, sessions). Si l'un bouge, la page correspondante
  bouge. Il dit aussi ce qui n'existe pas (SSO, AppConfig, Android, API,
  codes de secours TOTP) et qu'aucun test d'intrusion externe n'a été fait.
- **Le guide de prise en main décrit les écrans du code** : libellés
  « Compter des articles », « Auditer des articles », « Clôturer la balise »,
  « Revenir sur une balise », « Rejoindre un inventaire », « Balise hors
  plage », les onglets Suivi / Set up / Écarts d'audit / Rapport / Équipe.
  Un libellé qui change dans l'application change ici — et la capture avec.
- **Le deck La Samaritaine s'INSPIRE de leur document** (« Déroulement
  inventaire tournant », août 2026) sans se bâtir dessus : la page
  « Aujourd'hui » décrit un inventaire tournant de grand magasin en général,
  et n'en garde que des touches — la règle d'audit, le rapport d'inventaire,
  le projet d'inventaire aléatoire. **Leur vocabulaire interne n'y figure
  pas** : « horlogerie et joaillerie », pas leur sigle ; « rapport
  d'inventaire », pas le nom de leur extraction. **L'angle, fixé par Julien le
  27 août 2026 : l'inventaire est RENDU au floor** — balisage compris —,
  chefs d'équipe en superviseurs, vendeurs en compteurs ; l'Inventory
  Control ne garde que le rapport, la validation et l'ajustement. Ne pas
  ramollir en « alléger la charge ». La page « Qui fait quoi » réutilise
  trois captures du guide de prise en main. **Jamais de prix Zebra** dans
  ce deck ni en présentation : l'ancre SmartCount est confidentielle. La
  page « Pourquoi nous » reste factuelle et garde son encadré honnête
  (terminaux durcis, flotte amortie). Le deck a été **entièrement récrit le
  1er septembre 2026** — voir la section qui suit.
- **Contact** : `contact@quantinvo.com` partout, jamais l'adresse Gmail.
- Les couleurs et le logo sont ceux de `web/app/globals.css` et de
  `web/components/Logo.tsx` : si la charte bouge, reprendre `charte.js`.
