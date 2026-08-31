# Les présentations Quantinvo

Six présentations PowerPoint, générées par six scripts qui partagent une même
charte (`charte.js`). Fond blanc, règle « Papier » de la charte v1.1 : encre en
texte, indigo profond pour les titres, indigo en accent, et le cyan réservé à
la ligne de scan sous l'en-tête.

| Script | Fichier produit | Pour qui | Pages |
|---|---|---|---|
| `build.js` | `Quantinvo-presentation.pptx` | Direction, achats : la présentation longue | 14 |
| `build-court.js` | `Quantinvo-essentiel.pptx` | Le prospect qui a déjà une solution : dix pages, vingt minutes | 10 |
| `build-dsi.js` | `Quantinvo-dossier-DSI.pptx` | Direction informatique : architecture, hébergement, téléchargement, déploiement, mise en place, prise en main, comptes, sécurité, audits, RGPD | 17 |
| `build-tarifs.js` | `Quantinvo-tarification.pptx` | Celui qui décide du budget : l'assiette, la grille, le dépassement, la souscription | 11 |
| `build-prise-en-main.js` | `Quantinvo-prise-en-main.pptx` | Superviseurs et compteurs, après la signature | 19 |
| `build-samaritaine.js` | `Quantinvo-Samaritaine.pptx` | La Samaritaine : l'inventaire rendu au floor | 15 |

Les six partagent `charte.js` (la mise en page), `blocs.js` (la grille des
offres) et `offres.js` (les prix).

## Générer

```
npm install pptxgenjs sharp
for f in build.js build-court.js build-dsi.js build-tarifs.js build-prise-en-main.js build-samaritaine.js; do
  node $f && FONT_MODE=brand node $f
done
```

`FONT_MODE=brand node build.js` produit la variante `-marque` (Sora et Inter,
les polices de la charte), à présenter depuis un poste où elles sont
installées — celui de Julien. La version sans suffixe est en Arial : c'est
celle qu'on envoie, elle s'affiche à l'identique partout.

Les fichiers `.pptx` sont **générés, jamais retouchés à la main** : une
retouche serait écrasée à la prochaine génération. On modifie le script.

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

## Poser une capture sur une diapositive

`node encadrer.js <capture>` écrit `<capture>-encadre.png` : la capture dans le
téléphone dessiné des decks, fond transparent, **téléphone entier**. Les decks
n'en ont pas besoin — `cadrer()` fait le même travail à la volée et coupe le bas
pour que le téléphone déborde de sa carte — mais une page dont le téléphone est
le sujet le veut complet.

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
- **Le deck La Samaritaine suit leur propre document** (« Déroulement
  inventaire tournant », août 2026) : la page « Aujourd'hui », la règle
  d'audit 100 % W&J / 30 %, la consolidation SKU Variance / stock théorique
  et le projet d'inventaire aléatoire en viennent tels quels. Si leur
  procédure change, la page 2 change. **L'angle, fixé par Julien le
  27 août 2026 : l'inventaire est RENDU au floor** — balisage compris —,
  chefs d'équipe en superviseurs, vendeurs en compteurs ; l'Inventory
  Control ne garde que le rapport, la validation et l'ajustement. Ne pas
  ramollir en « alléger la charge ». La page « Qui fait quoi » réutilise
  trois captures du guide de prise en main. **Jamais de prix Zebra** dans
  ce deck ni en présentation : l'ancre SmartCount est confidentielle. La
  page « Pourquoi pas Zebra » reste factuelle et garde son encadré honnête
  (terminaux durcis, flotte amortie).
- **Contact** : `contact@quantinvo.com` partout, jamais l'adresse Gmail.
- Les couleurs et le logo sont ceux de `web/app/globals.css` et de
  `web/components/Logo.tsx` : si la charte bouge, reprendre `charte.js`.
