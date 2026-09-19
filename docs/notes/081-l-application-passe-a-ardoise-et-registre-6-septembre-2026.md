# L'application passe à Ardoise et Registre (6 septembre 2026)

Le site est passé le matin, l'application l'après-midi. Elle portait encore
l'identité de mai, entière et cohérente avec elle-même — et c'est le même
abonnement : un superviseur ouvre le site puis le téléphone. Maquette validée
avant codage, deux décisions arbitrées par Julien :
https://claude.ai/code/artifact/36b3d9cb-e5d9-4fed-bee1-524bfa43e48b

| | Avant | Après |
|---|---|---|
| Accent | indigo #4F46E5 / #6366F1 | **vert forêt** #1E4D3B / #5FA88A |
| Fonds | bleu nuit #0B0F19, #151A27 | **gris minéraux** #141716, #1B1F1E |
| Bandeau du haut | #0B0F19 / #060910 | **encre d'Ardoise** #14181A / #0B0D0C |
| Police | Inter | **Archivo + Public Sans** |
| Une carte | bordure + ombre + rayon 16 | **ni bordure ni ombre**, rayon 4 |
| La marque | le cube isométrique et son faisceau | **le plan de magasin**, monochrome |

⚠️ **`src/constants/ink.ts` EST LA COPIE DU BLOC `:root` DE `globals.css`**, au
même titre que `presence.ts`, `import.ts` et `report.ts` : le site et
l'application ne compilent pas ensemble. Ils bougent **ensemble**, et un test
compare quatre jetons dans les deux thèmes.

## ⚠️ LE PIÈGE QUI COÛTAIT 5,2 Mo, ET QUI PRÉEXISTAIT

Le plus utile de la journée, et il n'a rien à voir avec le dessin.

**L'index de `@expo-google-fonts/<famille>` fait un `require()` de TOUTES ses
graisses et de toutes leurs italiques.** Importer depuis la racine du paquet
fait donc embarquer par Metro l'intégralité de la famille. Mesuré en exportant
le paquet iOS deux fois :

| | Fichiers de police | Poids |
|---|---|---|
| Import depuis la racine | **64** | **6,74 Mo** |
| Import par graisse | **8** | **0,77 Mo** |

⚠️ **ET LE DÉFAUT ÉTAIT LÀ DEPUIS LE PREMIER JOUR** : Inter était importée
depuis sa racine, donc l'application embarquait ses **18 fichiers, 5,93 Mo**,
pour cinq graisses réellement employées (1,68 Mo). Le changement de polices ne
l'a pas créé — il l'a rendu visible, parce que quatre familles font quatre fois
le bruit d'une seule.

La forme correcte est une ligne par graisse
(`from '@expo-google-fonts/archivo/700Bold'`), et `useFonts` vient alors
d'`expo-font` : les entrées par graisse n'exportent que la police. Une garde
balaie `src/` et refuse tout import depuis une racine de paquet.

**Bilan du changement de polices : l'application perd 5,2 Mo** en gagnant deux
familles.

## ⚠️ DÉCISION 1 — L'ENCRE D'ARDOISE POUR LE BANDEAU

Le bandeau du haut est **volontairement sombre dans les deux thèmes** — c'est
le « bandeau encre » de la charte, et c'est justement pour ça que le force-dark
d'Android le rendait blanc le 31 août. Il passe du bleu nuit à l'encre
d'Ardoise : deux noirs différents ne se voient pas isolément, ils se voient
quand on pose le téléphone à côté de l'écran — et la tuile du logo est déjà en
#14181A.

⚠️ Le test qui garde ce bandeau vérifie qu'il est **sombre**, pas sa valeur : il
n'a pas eu à changer, et il ne doit pas devenir une garde de couleur.

## ⚠️ DÉCISION 2 — ARCHIVO ET PUBLIC SANS

Inter est partie. C'est l'une des deux valeurs par défaut de l'époque (avec
Sora) et l'un des trois signes mesurés de l'air « fait par une IA ». Deux
raisons de terrain en plus de la cohérence : Archivo a des **chiffres
tabulaires** et une chasse étroite — sur l'écran de comptage, un libellé
d'article tient sur une ligne là où Inter le casse en deux.

`Font.serif` (Newsreader) et `Font.mono` (IBM Plex Mono) ne servent **que** sur
les deux écrans qui font foi. Une garde déduit la liste des fichiers qui les
emploient et la compare aux deux écrans : c'est la frontière de Registre.

## Ce que j'ai tranché moi-même

- **Plus d'ombre ni de bordure sous les cartes.** Une carte se détache parce
  que son fond diffère de celui de la page. ⚠️ **Ce qui FLOTTE garde sa
  profondeur** — feuille modale, menu, voile : là, l'ombre dit vrai.
  `shadowElevated` reste, et lui seul. Sur Android, `elevation` fait la même
  chose : retirer les deux à la fois est nécessaire, sinon les cartes se
  détachent sur un système et pas sur l'autre.
- **Rayon 4 au lieu de 16 sur les BLOCS.** Les clés (`sm`, `md`, `lg`, `xl`)
  gardent leurs noms — une centaine de styles les emploient — mais ne portent
  plus que deux valeurs. `pill` reste une capsule : c'est une forme.
  ⚠️ **MAIS UN BOUTON GARDE SES COINS RONDS** (`Radius.bouton`, 12) — décision
  de Julien le 7 septembre, l'application en main : « use rounded corners
  buttons for the app, as it was previously ». C'est un écart assumé avec le
  site, et il tient à la nature du support : un bouton de téléphone se
  **touche**, et ce qui dit « ceci se presse » sur une surface tactile, c'est
  sa forme — pas un survol, pas un curseur qui change. À 4 px, ils se lisaient
  comme des bandeaux d'information.
  · **C'est le SEUL écart** : cartes, blocs, champs et tableaux restent à
    3-4 px comme sur le site. Le jour où tout redevient rond, Ardoise n'a plus
    d'objet — une garde refuse un bloc au-delà de 4 px, et une autre refuse
    qu'un contrôle qui se touche reprenne un rayon de bloc.
  · ⚠️ **ET LA SECONDE GARDE DÉDUIT SA LISTE DU NOM DES STYLES**, ce qui n'est
    pas un raffinement : j'avais converti 54 styles à la main et j'en avais
    **oublié six** — le bouton flottant, les deux boutons de la carte des
    notifications, les deux bascules de mode du scanner, le pas-à-pas. Le
    balayage les a nommés en une seconde.
- **⚠️ LE BOUTON D'EXPORT PORTE L'ACCENT, PLUS LE VERT DU SUCCÈS.** Depuis
  qu'Ardoise a fait de l'accent un vert forêt, deux verts voisins sur le même
  écran ne se distinguent plus — et le succès doit rester ce qui a RÉUSSI.
- **⚠️ LE VISEUR PREND L'ACCENT SOMBRE DANS LES DEUX THÈMES.** Il était en cyan
  #38C9FF, le filet de scan d'avant. Les coins du cadre sont tracés **par-dessus
  la caméra**, qui est toujours une surface sombre : le vert forêt du thème
  clair (#1E4D3B) y disparaîtrait.
- **L'or de l'audit (#FFC349) et le vert du comptage ne bougent pas** : ce sont
  les deux passes, et le site les porte à l'identique depuis le 29 août.

## ⚠️ AUCUNE ENCRE UNIQUE NE TIENT SUR LE BANDEAU HORS LIGNE — MESURÉ

Trouvé en écrivant la garde, et j'avais d'abord annoncé le contraire dans un
commentaire : « 5,3:1 », alors que la mesure disait **3,88**.

Le bandeau « hors ligne » portait une encre écrite en dur, et ça marchait tant
que l'orange d'alerte était vif dans les deux thèmes. Ardoise a **assombri**
celui du thème clair (#A06A12) pour qu'il tienne l'AA sur du blanc :

| sur… | encre #14181A | blanc |
|---|---|---|
| orange clair #A06A12 | 3,88 | **4,60** |
| orange sombre #D69A3C | **7,27** | 2,46 |

La couleur du texte suit donc le thème. C'est le seul endroit de l'application
où elle le fait dans ce sens, et c'est parce que le fond, lui, ne suit pas le
thème de la même façon. **Ne pas « simplifier » en une constante.**

## La marque, et les deux moments où elle balaie

Le cube isométrique et son faisceau bleu ont disparu de l'icône, de l'écran de
démarrage, de la connexion et de la porte de bienvenue. La géométrie est celle
du site **au dixième près** — un test compare les quatre rectangles entre
`web/components/Logo.tsx`, `src/components/AppLogo.tsx` et
`scripts/generate-icons.mjs`. Si l'un bouge, les trois bougent.

- **⚠️ ELLE BALAIE À L'OUVERTURE ET PENDANT LA GÉNÉRATION DES BALISES**
  (demande de Julien). Ce sont les deux moments où l'application fait attendre.
  Une roue dit « ça charge » ; ceci dit « Quantinvo travaille ».
- **⚠️ LE DÉCALAGE EST EN PIXELS, PAS EN UNITÉS DE VIEWBOX.** Le SVG est rendu
  à `size` : une unité vaut `size / 36`. C'est le piège symétrique du
  `transform-box: view-box` qu'il a fallu poser côté web.
- **⚠️ `ReduceMotion.Always`** : la préférence système coupe l'animation, comme
  le `prefers-reduced-motion` du site.
- Les deux halos indigo qui restaient — sous le logo de connexion et sous celui
  du démarrage, tous deux en #6C5CE7, le même que celui retiré du site le matin
  — sont partis. Une marque monochrome n'a pas besoin d'un fond pour exister.
- **Les icônes des deux boutiques sont régénérées** (`node scripts/generate-icons.mjs`).
  Elles ne prennent effet qu'à la prochaine **publication**, pas à la prochaine
  installation.

## Registre, sur les deux écrans qui font foi

`results.tsx` (le rapport) et `audits.tsx` (les écarts) prennent la grammaire du
site : filets au lieu de cartes, titre en serif, nombres en chasse fixe, rayon
zéro, libellé au-dessus du chiffre dans la bande de synthèse.

⚠️ **PAS DE `textMuted` DANS UN DOCUMENT.** Mesuré sur le site : ce gris donne
3,06:1 sur le papier, sous AA — et il portait les codes-barres, les en-têtes et
les libellés, c'est-à-dire ce qu'on **lit**. Une garde lit le bloc de styles de
ces deux écrans et le refuse.

## ⚠️ DEUX DÉFAUTS TROUVÉS PAR JULIEN AU PREMIER BUILD

Les deux sont instructifs, et le second était de ma main.

### 1. « L'icône de l'app n'a pas changé »

Elle avait bien changé — **dans `assets/images/`, et nulle part ailleurs**.
Les deux projets natifs ne lisent pas ce dossier au build : ils en gardent
leur propre copie.

| | Nature | Ce qui s'y trouvait |
|---|---|---|
| `ios/…/AppIcon.appiconset/` | **versionné**, jamais régénéré | l'icône du **19 juin** |
| `android/app/src/main/res/mipmap-*` | **généré et gitignoré** | celle du 2 septembre |

⚠️ **`pixel.sh` ne régénère `android/` QUE S'IL MANQUE.** C'est écrit plus haut
dans ce fichier, et ça veut dire que ses icônes ne suivent jamais toutes
seules. Deux remèdes, de natures différentes :

- **iOS** : `generate-icons.mjs` recopie désormais l'icône dans le projet
  versionné. Elle passe par git comme le reste d'`ios/`, et **un test compare
  les deux fichiers à l'octet près** — c'est ce qui aurait attrapé le défaut.
- **Android** : le script ne peut rien y faire, il **rappelle en clair** à la
  fin de son exécution qu'il faut relancer
  `npx expo prebuild --platform android --clean`. Fait le 7 septembre : les
  `mipmap-*` et le `splashscreen_logo` portent la nouvelle marque, et
  `iconBackground` est passé à l'encre d'Ardoise.

### 2. ⚠️ « L'écran d'ouverture logo non animé » — ET MA GARDE FIGEAIT LE DÉFAUT

`reduceMotion: ReduceMotion.Always`. Dans Reanimated, **`Always` veut dire
« toujours RÉDUIRE », donc toujours DÉSACTIVER** — pas « toujours respecter le
réglage ». La marque ne balayait sur aucun téléphone : elle sautait
instantanément à sa valeur finale, allée pleine à droite, immobile. La valeur
qui SUIT le réglage de l'appareil est **`ReduceMotion.System`**.

⚠️ **Et le test le certifiait.** Il exigeait `ReduceMotion.Always`, la valeur
que je venais d'écrire — donc il confirmait que tout allait bien pendant que
rien ne bougeait. **Une garde qui recopie une valeur sans savoir ce qu'elle
fait ne garde rien : elle certifie l'erreur.** Elle vise maintenant `System` et
refuse nommément les deux autres.

Au passage : **l'écran de démarrage natif est une image fixe et ne peut pas
s'animer** — il s'affiche avant que le JavaScript existe. C'est
`SplashAnimation` qui le recouvre et qui balaie, ~2,8 s, soit trois cycles.
Deux écrans, deux natures ; ne pas chercher à animer le premier.

### 3. ⚠️ « Attention à Quantinvo ici, toujours sous ancien format »

Troisième constat, au build du 7 septembre, capture à l'appui. Le mot-symbole
de l'écran d'ouverture s'écrivait `QUANTINVO`, en capitales espacées de six
points et en **#8A82B8** — un mauve.

- **C'était le DERNIER indigo de l'application**, et il avait survécu à la
  passe du 6 septembre pour une raison instructive : la garde qui balaie tout
  `src/` déduit bien son **périmètre**, mais sa liste de couleurs mortes est
  écrite à la main, et ne nommait pas cette valeur. **Une garde qui balaie
  large et cite une liste courte ne voit rien.** `#8A82B8` l'a rejointe.
- **⚠️ ET LA MISE EN FORME COMPTAIT AUTANT QUE LA COULEUR.** Partout où le nom
  s'écrit — barre publique, pied de page, mentions légales — c'est
  « Quantinvo », en Archivo gras, chasse resserrée, de la couleur du tracé.
  Deux mises en forme du même mot, c'est déjà deux marques.
- **La marque passe de la moitié de la largeur à 28 %** (plafond 200 → 120 pt),
  seconde demande de Julien : « une taille de logo naturellement moins
  intrusive ». C'est la première chose que l'application montre — à 50 % elle
  n'accueille pas, elle barre le passage. Elle reste largement lisible : à
  120 pt une allée fait encore 10 pt.

## Vérifications

- **Le paquet iOS s'exporte** (`expo export --platform ios`) : tous les imports
  se résolvent, les huit polices sont là et huit seulement, le bundle fait
  7,3 Mo. C'est ce qui prouve que l'application démarrera.
- **Les icônes sont dessinées et relues** — l'icône de démarrage a été regardée.
- **Le poids des polices, mesuré dans les deux sens** : import racine contre
  import par graisse, et le paquet Inter réinstallé le temps de le peser.
- **Onze sabotages, onze échecs** — dont **deux qui ont d'abord passé** :
  · la garde des ombres cherchait UNE occurrence de `shadowCard: aucuneOmbre` :
    en remettre une sur le seul thème clair passait, et le défaut ne se serait
    vu que sur la moitié des téléphones. Elle COMPTE désormais les palettes.
    **Une garde qui cherche une occurrence ne garde que la première** — même
    correction que le filtre des exports, le matin même ;
  · la garde de géométrie comptait les rectangles de fond du script d'icônes.
- 433 tests de l'application, 1 315 du site, `tsc --noEmit` des deux côtés.

## ⚠️ CE QUI N'EST PAS VÉRIFIÉ, ET POURQUOI

**Rien n'a été vu à l'écran DEPUIS L'AGENT** — Julien, lui, a construit et a
trouvé les deux défauts ci-dessus en deux minutes.

⚠️ **LA PANNE DÉCRITE CI-DESSOUS EST PASSÉE : `./scripts/simulateur.sh`
FONCTIONNE À NOUVEAU** (relancé le 8 septembre 2026, build complet, application
lancée). Elle est gardée ici parce que le diagnostic vaut si elle revient — et
parce qu'elle a fait dire deux fois « la chaîne iOS est cassée » alors qu'il
suffisait de réessayer. **Relancer avant d'annoncer une panne d'outillage.**

L'échec de l'époque n'avait rien à voir avec le code :

```
*** -[__NSDictionaryM setObject:forKey:]: object cannot be nil
    (key: IDEDerivedDataPathOverride)
```

C'est `xcodebuild` qui s'arrête en analysant ses options, avant toute
compilation. Deux essais, même erreur. ⚠️ **Ne pas contourner en appelant
`xcodebuild` à la main** : la règle du projet est que `simulateur.sh` est le
seul chemin de build (il pose `app.config`, sans quoi l'application s'ouvre sur
un écran rouge).

Restent donc à voir, et c'est à toi : le rendu au doigt, le balayage du logo à
l'ouverture, et les deux écrans de superviseur — le téléphone de test est
connecté en compteur. Le Pixel (`./scripts/pixel.sh`) est le plus rapide.

Tests de garde : `tests/ardoise-app.test.ts`.
