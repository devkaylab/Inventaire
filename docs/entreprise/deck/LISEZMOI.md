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
| `build-samaritaine.js` | `Quantinvo-Samaritaine.pptx` | La Samaritaine : l'inventaire rendu au floor | 12 |

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

## ⚠️ Ce qu'il reste à faire (au 2 septembre 2026)

Une seule chose, mais elle traîne : **les captures ont vieilli**, et c'est
exactement ce qui a tué le tutoriel intégré de l'application — il décrivait des
écrans disparus. Les recettes sont plus bas ; ce qui suit dit quoi refaire et
dans quel ordre.

**1. Les captures de l'application** (`captures/`, puis `encadrees/`). Leur
contenu date du **27 août 2026**, et l'écran de comptage a changé trois fois
depuis : cadre du viseur, liste des scans passée derrière un bouton, trace
« Dernier scan ». S'y ajoutent les quatre repères du compteur du 31 août.

- il faut le **simulateur iOS et une session connectée** — c'est le seul
  obstacle, aucun conteneur ne peut le faire ;
- `preparer-captures.js` réduit, masque les adresses du compte d'essai **et
  régénère `encadrees/` d'office** : une seule commande pour les deux jeux ;
- **dans le même commit**, passer `CAPTURES_A_REFAIRE` à `false` dans
  `web/lib/priseEnMain.ts` et avancer `CAPTURES_LE`. La page
  `/outils/prise-en-main` du site sert les mêmes images et porte le même
  aveu ; le drapeau ne se baisse jamais avant les captures.

**2. Les captures du site** (`web/screenshots/`). Les trois du tableau de bord
ont été **reconstituées depuis le `.pptx` précédent** : ce dossier est dans le
`.gitignore` et le harnais e2e ne démarrait pas dans le conteneur d'alors. Les
recadrages sont restés identiques, donc le document est fidèle — mais une
régénération sur un poste qui a les captures est ce qui le rendra vérifiable.
La fenêtre « détail d'une balise » du 2 septembre n'y figure pas encore.

**3. La pleine résolution des `encadrees/`** — seulement si un usage papier se
présente. Elles sortent à ~637 px parce que `captures/` est en demi-résolution ;
il faudrait encadrer les captures **brutes** du simulateur, avant
`preparer-captures.js`.

Rien d'autre n'est en attente : les six decks se génèrent, les douze pages du
deck Samaritaine ont été rendues et relues page à page.

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

## Le deck Samaritaine, récrit (1er septembre 2026)

**Deux passes le même jour, et la seconde corrige la première.** Il faut les
lire dans l'ordre : la première a réglé un problème réel, la seconde a réglé
celui qu'elle avait laissé.

### Première passe — la répétition, 15 pages à 11

Constat de Julien : *« il y a beaucoup de répétition »*. Elle était
structurelle : **quatre pages sur quinze racontaient le même avant / après** —
« Aujourd'hui » (leur journée en quatre étapes), « Le constat » (la même,
redécoupée en quatre casquettes), « La même journée conduite par le floor »
(la même, sujet des phrases changé) et « Sans, avec » (la même, en tableau).
Elles sont devenues deux, et deux autres fusions ont suivi : « Pendant le
comptage » + « L'audit » en une page mais **avec les deux captures**, et
« Pourquoi pas Zebra » + « Ce qu'on ne promet pas » en « Pour être clair ».

### Seconde passe — le deck parlait de leur process, pas de Quantinvo

*« Je voulais que tu t'inspires du document de la Samaritaine, pas que tu
fasses ton ppt autour que de ça »*, et *« n'oublie pas, le sujet c'est
Quantinvo, pas leur process d'inventaire »*. La première passe avait supprimé
la répétition **sans toucher au squelette** : une page citait leur procédure
étape par étape, la suivante la rejouait ligne à ligne en tableau. Deux pages
sur onze pour décrire le produit du client.

Le deck suit maintenant **trois temps**, dans cet ordre :

1. **Aujourd'hui** — le déroulement d'un inventaire tournant de grand magasin,
   écrit en général ;
2. **Ce que ça demande** — les irritants, hiérarchisés ;
3. **Avec Quantinvo** — les réponses, dans l'ordre des irritants.

Le tableau miroir a disparu. **Deux pages de mise en situation sur douze** :
le reste est le produit.

⚠️ **Une page de TRANSITION sépare le problème de la réponse** (page 5,
demande de Julien : « une transition qui annonce un peu la suite sans la
répétition »). Elle dit la **méthode**, jamais le contenu : le produit retire
au lieu d'ajouter, et les pages suivantes le montrent dans le même ordre. Y
reprendre les quatre irritants, ou nommer les quatre réponses, ferait de la
page 6 une redite — le défaut que tout ce deck a été récrit pour supprimer.
C'est la seule page qui ne démontre rien : ni capture, ni alinéas, ni encadré.
Le vide fait le travail.

⚠️ **La colonne « Ce qu'on ne vous promet pas » a été retirée** le même jour
(décision de Julien). Elle listait l'inventaire fiscal certifié, la connexion
à l'ERP, l'annuaire d'entreprise et Google Play. Ces limites ne disparaissent
pas du corpus — `build-dsi.js` les porte pour l'audience qui les demande —
mais elles ne sont plus dans le deck commercial. Ne pas les y réintroduire.

### ⚠️ Les quatre irritants, et celui qui n'en est pas un

Confirmés un par un par Julien, dans cet ordre — le service mobilisé en tête,
les trois autres comme ses causes :

1. un service mobilisé du début à la fin ;
2. une flotte de terminaux à préparer avant chaque session ;
3. un briefing à chaque équipe, à chaque inventaire ;
4. un balisage la veille.

⚠️ **Le rapprochement avec le stock théorique N'EN FAIT PAS PARTIE.** Une
version l'avait mis en tête, comme « le plus long et le plus dur » : c'est
faux, et Julien l'a donné en exemple de ce qu'il ne faut pas exagérer. Il se
cite **en demi-phrase, sans rang ni adjectif**, à la fin du premier alinéa, et
se montre côté Quantinvo comme un gain, platement (« le recoupement n'est plus
à faire »). Ne pas lui redonner de page, ni d'adjectif.

Même règle partout ailleurs : la page du rapport ne parle plus de « la
démarque que l'inventaire est censé révéler », la page de l'aléatoire ne dit
plus « ce qui rend l'aléatoire réellement aléatoire ». **Ce qui ne se ramollit
pas, en revanche, c'est l'angle** : l'inventaire est rendu au floor, décision
de Julien du 27 août — la mesure porte sur les promesses, pas sur la thèse.

### Ce qu'il ne faut pas défaire

- **Ne pas réintroduire de citation étape par étape de leur procédure**, ni de
  tableau qui la rejoue. Deux versions successives l'ont fait.
- **Ne pas réintroduire de page miroir** : un déroulement raconté deux fois de
  suite se lit comme du remplissage.
- **Pas de vocabulaire interne du client.** « Horlogerie et joaillerie », pas
  leur sigle maison ; « rapport d'inventaire », pas le nom de leur extraction.
- **Les pages de réponse suivent l'ordre des irritants** : les trois cartes de
  la page 5 répondent au balisage, au briefing puis à la conduite, la flotte
  étant réglée par la phrase d'accroche ; la page 6 finit le premier irritant
  (la surveillance) ; la page 7 le fichier.
- **Une page à deux colonnes d'alinéas et un encadré ne tient pas.** C'était
  la forme de « Pour être clair » : au rendu, le quatrième alinéa de droite
  passait *sous* le bloc gris. La page est passée à une colonne pleine largeur
  en perdant sa seconde moitié ; si l'envie revient d'y remettre deux
  colonnes, se souvenir que ça ne rentre pas.

### L'écran d'entrée est l'écran de lancement, et il ne dit rien

Demande de Julien : *« un screen d'entrée avec le logo de Quantinvo sur
l'écran de l'iPhone »*. La page 1 porte le téléphone **entier** — pas
débordant comme ailleurs : ici c'est le sujet de la page —, la marque, le
filet cyan. **Rien d'autre.** La couverture suit en page 2.

⚠️ **Aucune phrase sur cette page, et c'est une décision.** Elle a d'abord
porté une citation signée sur l'origine du produit, puis sept variantes
centrées sur l'application : aucune ne tenait. Une page d'entrée n'a rien à
démontrer. Ne pas y remettre de baseline, de citation ni de signature — ce
qui n'est pas dit ne peut pas sonner faux.

⚠️ La capture est `captures/lancement.png`, et elle **ne s'obtient qu'en
Release** (voir plus bas). Ne pas la remplacer par une capture prise sur un
build de développement : le bandeau LogBox de React Native s'y afficherait
par-dessus.

### Les captures

Huit captures sur douze pages, contre six sur quinze : `nouvel-inventaire.png`
a rejoint la page de l'inventaire aléatoire, et l'écran de lancement ouvre le
deck. Les deux pages de mise en situation et la transition n'en portent
**aucune**, et c'est voulu : une capture du produit sur la page du problème
donnerait la réponse avant que la question soit posée.

⚠️ **Les captures de l'application datent du 27 août 2026**, et l'écran de
comptage a changé depuis (viseur, liste des scans derrière un bouton, trace
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
