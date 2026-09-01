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
| `build-samaritaine.js` | `Quantinvo-Samaritaine.pptx` | La Samaritaine : l'inventaire rendu au floor | 11 |

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

## Le deck Samaritaine, resserré (1er septembre 2026)

Constat de Julien : *« il y a beaucoup de répétition »*. La répétition était
structurelle, pas rédactionnelle : **quatre pages sur quinze racontaient le
même avant / après**.

- « Aujourd'hui » déroulait leur journée en quatre étapes ;
- « Le constat » la redécoupait en quatre casquettes ;
- « La même journée, conduite par le floor » la rejouait à l'identique, seul
  le sujet des phrases changeant ;
- « Sans, avec » la reprenait une quatrième fois, en tableau.

Elles sont devenues **deux** : leur journée telle qu'elle est (page 3, leur
document mot pour mot), puis **un seul tableau** qui la remet en regard ligne
à ligne (page 4), dont la dernière rangée — « Au total » — porte les quatre
casquettes **et** le pivot de la proposition.

Deux autres fusions, même motif :

- « Pendant le comptage » et « L'audit » disaient toutes deux « le chef
  d'équipe voit et tranche en direct ». Une seule page, **avec les deux
  captures** : elles, montrent bien deux choses différentes.
- « Pourquoi pas Zebra » et « Ce qu'on ne promet pas » sont devenues « Pour
  être clair », en deux colonnes.

« Qu'est-ce que Quantinvo » a disparu : sa citation ouvre le deck, et son
seul fait neuf — application, tableau de bord, rapport — est la ligne
d'accroche de « Qui fait quoi ».

Ce qu'il ne faut pas défaire :

- **Ne pas réintroduire de page miroir.** Un déroulement raconté deux fois de
  suite se lit comme du remplissage — c'est exactement ce qui a été vu.
- **L'attaque en gras du tableau n'est portée QUE par la colonne de gauche.**
  Écrite des deux côtés, « La veille. » se lisait deux fois sur la même
  rangée. Les deux cellules sont alignées : cela suffit à dire de quelle
  étape on parle.
- **Les faits ne se répètent qu'à bon escient**, chaque fois dans un registre
  différent : « aucune flotte » dans le tableau puis dans la comparaison
  SmartCount, la règle d'audit dans leur journée puis sur la page qui la
  montre, le rapport croisé dans le tableau puis sur sa page. Tout le reste a
  été retiré de ses autres emplacements — c'est la moitié du travail.
- **La page 3 n'a volontairement aucune capture.** C'est leur document : y
  poser un écran de notre produit mettrait notre réponse avant leur constat.
- **⚠️ La page 9 est tendue.** Sept alinéas et un encadré : au premier rendu,
  le quatrième alinéa de droite passait *sous* le bloc gris. Les textes sont
  taillés pour trois lignes chacun ; les rallonger rouvre le défaut.

### L'écran d'entrée est l'écran de lancement

Demande de Julien : *« un screen d'entrée avec le logo de Quantinvo sur
l'écran de l'iPhone »*. La page 1 porte donc le téléphone **entier** — pas
débordant comme ailleurs : ici c'est le sujet de la page —, la marque, la
citation d'origine et sa signature. La couverture, avec le titre et le
sous-titre, suit en page 2.

⚠️ La capture est `captures/lancement.png`, et elle **ne s'obtient qu'en
Release** (voir plus bas). Ne pas la remplacer par une capture prise sur un
build de développement : le bandeau LogBox de React Native s'y afficherait
par-dessus.

### Une capture de plus, sur l'inventaire aléatoire

`nouvel-inventaire.png` illustre « un inventaire ciblé se crée en quelques
minutes » — l'écran le montre en trois champs. Le deck porte huit captures
sur onze pages, contre six sur quinze : la densité double.

⚠️ **Les captures de l'application datent du 27 août 2026**, et l'écran
de comptage a changé depuis (viseur, liste des scans derrière un bouton, trace
« Dernier scan »). C'est le même vieillissement que celui signalé par
`CAPTURES_A_REFAIRE` sur `/outils/prise-en-main` : une passe de captures les
remettra à jour d'un coup, decks et guide du site ensemble.

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
  procédure change, la page 3 change. **L'angle, fixé par Julien le
  27 août 2026 : l'inventaire est RENDU au floor** — balisage compris —,
  chefs d'équipe en superviseurs, vendeurs en compteurs ; l'Inventory
  Control ne garde que le rapport, la validation et l'ajustement. Ne pas
  ramollir en « alléger la charge ». La page « Qui fait quoi » réutilise
  trois captures du guide de prise en main. **Jamais de prix Zebra** dans
  ce deck ni en présentation : l'ancre SmartCount est confidentielle. La
  page « Pour être clair » reste factuelle et garde son encadré honnête
  (terminaux durcis, flotte amortie). Il a été **resserré de 15 à 11 pages
  le 1er septembre 2026** — voir la section qui suit.
- **Contact** : `contact@quantinvo.com` partout, jamais l'adresse Gmail.
- Les couleurs et le logo sont ceux de `web/app/globals.css` et de
  `web/components/Logo.tsx` : si la charte bouge, reprendre `charte.js`.
