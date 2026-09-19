# Mode douchette : les chiffres, et l'écran qui reste allumé (25 août 2026)

Deux constats de Julien, en test réel avec une douchette Bluetooth.

## « Seulement des symboles s'affichent — &é"' au lieu de 1234 »

**Une douchette ne transmet pas des caractères, elle transmet des touches** —
les mêmes codes HID qu'un clavier physique. C'est iOS qui décide ensuite du
caractère, en suivant Réglages › Général › Clavier › **Clavier physique**.
Presque toutes les douchettes sortent d'usine en QWERTY ; un iPhone français
est en AZERTY. Les deux ne partagent pas la rangée du haut : la touche « 1 »
du QWERTY est la touche « & » de l'AZERTY. Les lettres sont touchées aussi
(A↔Q, Z↔W, M↔virgule) et le tiret d'une référence arrive en « ) ».

`src/lib/douchette.ts` repasse la saisie par la disposition inverse, à partir
des quatre rangées écrites touche par touche. Trois points à ne pas défaire :

- **⚠️ Les chiffres ne sont jamais retouchés.** Sur AZERTY ils s'obtiennent
  avec Majuscule : les exclure de la table fait qu'une saisie déjà correcte
  (pavé numérique, douchette bien réglée) traverse sans bouger. Sans cette
  exclusion, on casserait ce qui marche.
- **⚠️ Sinon, on ne convertit que si le décalage est prouvé** (« sinon »
  depuis que la clé de contrôle passe devant — section suivante). Deux
  preuves, et deux seulement : un **accent** (é è ç à ù ² ° § µ £ ¨,
  majuscules comprises), que la douchette ne peut pas produire et qu'aucun
  code-barres ne contient ; ou un code **entièrement fait de la rangée du
  haut**, qui est alors un nombre déformé — la balise 1 arrive en « & », et
  sans ce second volet elle ne serait jamais redressée. **Un « & » au milieu
  d'une référence alphanumérique ne prouve rien** : M&S existe, et redresser
  sa référence la détruirait. Quant à « - » et « _ », ils s'écrivent dans de
  vraies références : ils ne sont **dans aucune table ni dans les preuves**
  (le 25 août au soir les a sortis de la table — sur iOS ils ne portent aucun
  chiffre).
- **Le décalage constaté est retenu** (`clavierDecaleRef`) pour le reste du
  comptage : il ne se corrigera pas tout seul, et c'est ce qui rattrape les
  codes sans preuve — une référence sans chiffre, ou un nombre fait des seuls
  3, 4 et 5. ⚠️ Il ne peut plus abîmer un code-barres dont la clé est juste :
  celui-là est rendu tel quel (section suivante).

**Le champ de la balise reçoit le même traitement** : la douchette y écrit
comme dans l'autre, et son `keyboardType="number-pad"` ne contraint que le
clavier tactile — un clavier HID envoie ce qu'il veut.

Le vrai réglage reste côté matériel (passer la douchette en AZERTY par son
code-barres de configuration, ou changer la disposition du clavier physique
dans iOS) ; le correctif rend l'app juste dans les deux cas.

## ⚠️ La disposition d'iOS est celle du Mac, pas celle de Windows (25 août 2026)

Second test de Julien, douchette **Inateck Nano 160D** en Bluetooth :
*« ça ne fonctionne toujours pas correctement »*. L'EAN 8809652585598 du
produit photographié s'affichait `//09?52559/`.

Rejoué caractère par caractère, le constat est sans ambiguïté — **la table de
la première correction était celle d'un clavier français Windows**. Or les
deux dispositions françaises diffèrent sur deux touches, et ce sont justement
des chiffres :

| touche | Windows | **Mac, donc iOS** |
| --- | --- | --- |
| 6 | `-` | **`§`** |
| 8 | `_` | **`!`** |

Le scan arrivait donc en `!!ÀÇ§(É(!((Ç!`, et le module prenait le `!` et le
`§` pour la touche « / » du bas de clavier : onze chiffres redressés sur
treize, **les deux autres abîmés**. Les tables de `lib/douchette.ts` sont
maintenant celles d'iOS (`IOS_FR`), écrites à partir des touches d'une
douchette QWERTY (`US`).

**Et surtout, la clé de contrôle tranche avant toute heuristique.**
`gtinValide` (EAN-8, UPC-A, EAN-13, ITF-14) rend le redressement
**indépendant de la disposition exacte du téléphone** — c'est ce qui manquait,
et c'est ce qui évitera le prochain aller-retour :

- un code **déjà valide n'est jamais converti**, même après un scan décalé
  (le drapeau `force` ne peut plus abîmer ce qui est juste) ;
- un code dont la conversion **tombe juste** est converti, sans avoir besoin
  d'accent ni de rangée du haut. La table Windows est gardée pour ce seul
  arbitrage : son résultat n'est retenu que s'il porte une clé valide, donc
  elle ne peut rien corrompre ;
- les heuristiques (accents, rangée du haut) restent **pour ce qui n'a pas de
  clé** : un numéro de balise, un SKU.

⚠️ **`-` et `_` ne sont dans aucune table de redressement** (`AMBIGUS`) :
« REF-12 » et « SKU_01 » existent, les redresser les détruirait. Sur iOS ils
ne portent plus aucun chiffre de toute façon.

## ⚠️ iOS remplace les apostrophes — donc les touches 3 et 4 (31 août 2026)

Constat de Julien, douchette sur son iPhone : le code **045496428280** arrivait
dans le champ en `À’(’Ç§’é!é!À` et ressortait en **`0’5’96’28280`** — dix
chiffres sur douze redressés, les trois « 4 » perdus, fiche « Article inconnu ».

**Ce n'était pas la table, c'était le champ de saisie.** iOS applique sa
**ponctuation intelligente** au texte tapé : `'` devient `’`, `"` devient `«` ou
`»`. Or sur la disposition française ces deux touches sont **les chiffres 4 et
3**. Le caractère qui arrivait n'était donc dans aucune table, il traversait le
redressement sans bouger, et le code sortait mutilé.

- **⚠️ `autoCorrect={false}` ne la désactive pas**, et React Native n'expose pas
  le réglage iOS (`UITextSmartQuotesType`) qui le ferait. La correction ne peut
  vivre que dans le module — ce qui la rend testable, et vraie sur les deux
  champs (douchette et ouverture de balise).
- **⚠️ Ce n'est pas une régression : le défaut était là depuis le premier jour.**
  Le scan qui avait servi de preuve le 25 août — 8809652585598 — ne porte **ni 3
  ni 4**. Il ne pouvait pas le montrer. À retenir : un code d'essai ne vaut que
  s'il contient les dix chiffres, ou au moins ceux dont la touche est
  substituable.
- **⚠️ La normalisation passe AVANT tout le reste**, clé de contrôle comprise :
  un code ainsi maquillé n'est ni valide ni convertible, donc les trois règles
  suivantes ne peuvent rien pour lui. `normaliserPonctuation` est appelée à
  l'entrée de `redresserSaisie` **et** de `clavierDecale`.
- Le signe indiqué par l'ancienne note du simulateur (« la touche 3 peut arriver
  en `»` ») décrivait déjà ce défaut ; il avait été classé comme une bizarrerie
  du simulateur, alors que c'est le comportement d'iOS.

Tests de garde : `tests/douchette.test.ts`, blocs « défait la ponctuation
typographique d'iOS » et « normalise les quatre substitutions ».

### ⚠️ Et iOS pose une ESPACE avec ses guillemets (31 août 2026, au soir)

Seconde moitié du même défaut, trouvée par Julien après validation d'Android :
*« le mode douchette n'est pas capable de lire tous les codes-barres, problème
uniquement sous iOS »*. Le code **5056635611789** (Blu-ray PM Studios) arrivait
en `50566 35611789`.

**Les treize chiffres étaient justes.** Rien n'était perdu, rien n'était faux :
une **espace** s'était insérée entre le cinquième et le sixième. Ce n'est pas un
défaut de lecture, c'est un caractère de trop — et l'article restait inconnu.

iOS ne se contente pas de remplacer `"` par `«` ou `»` : en français, la
typographie veut une **espace insécable à l'intérieur des guillemets**, et le
champ l'insère. La touche `"` étant celle du **chiffre 3**, tout code-barres
contenant un 3 arrivait avec une espace parasite.

- **⚠️ C'est le sens du guillemet qui place l'espace**, et c'est ce qui a permis
  de trancher : elle était **avant** le 3, donc iOS avait choisi un guillemet
  **fermant** (`»`), qui prend son espace devant. Un ouvrant (`«`) l'aurait
  posée derrière. `normaliserPonctuation` traite les deux sens.
- **⚠️ Les insécables partent sans condition** (U+00A0, U+202F, U+2009, U+2007,
  U+2060) : une douchette transmet de l'ASCII, elle ne peut pas en produire.
- **⚠️ Une espace ORDINAIRE ne part que collée à un guillemet qu'on convertit.**
  Elle s'écrit dans de vraies désignations — même arbitrage que « - » et « _ ».
  Un test le fige (`normaliserPonctuation('REF 001')` inchangé).
- **⚠️ Le correctif du matin ne pouvait pas le voir** : il rendait bien `"` à
  partir de `»`, et s'arrêtait là. Et le code d'essai du matin — 045496428280 —
  **ne porte pas de 3**. Troisième fois que le code d'essai décide de ce qu'on
  trouve : 8809652585598 n'avait ni 3 ni 4, 045496428280 n'a pas de 3. **Un
  code d'essai ne vaut que s'il porte les dix chiffres.**

Tests de garde : `tests/douchette.test.ts`, blocs « retire l'espace qu'iOS pose
avec les guillemets » et « mais une espace ordinaire reste dans une
désignation ».

### Et sur Android (même jour)

**La ponctuation intelligente est propre à iOS** : Android ne substitue rien à
la frappe d'un clavier physique. La normalisation y est une non-opération, elle
ne casse rien.

**Mais Android a sa propre disposition, et c'est celle du PC** — l'AZERTY
d'AOSP, où les touches **6 et 8** donnent « - » et « _ », là où iOS donne « § »
et « ! ». Conséquences, dans l'ordre où elles comptent :

- **Tout code-barres réel passe déjà** : la clé de contrôle arbitre, et la table
  Windows est essayée pour ça depuis le 25 août (test « rattrape aussi un
  clavier français Windows »). Rien à faire de ce côté.
- **⚠️ Restait le numéro de balise**, qui n'a pas de clé : « 168 » arrivait en
  `&-_` et ne se redressait pas, parce que « - » et « _ » ne sont dans aucune
  table — ils s'écrivent dans de vraies références (SKU_01, REF-12) et les
  convertir à l'aveugle les détruirait.
  · `redresserNumero` lève l'ambiguïté **par l'attente du champ** : il n'accepte
    qu'un nombre, donc une table qui en rend un a raison. C'est le seul endroit
    du module où ces deux signes se convertissent, et ça ne doit pas s'étendre
    à `redresserSaisie`.
  · **L'ordre des tables compte** : iOS d'abord, pour qu'un iPhone n'emprunte
    jamais celle du PC.
- **Un SKU contenant un 6 ou un 8 scanné sur Android reste ambigu**, et le
  reste volontairement — même arbitrage que « - » et « _ » sur iOS.

⚠️ **Rien de tout cela n'a été vérifié avec une douchette sur un Android** : la
table du PC est celle d'AOSP, déduite, pas observée. Le jour où une douchette
tourne sur le Pixel, c'est le premier point à contrôler — et un code d'essai
doit porter un **6 et un 8**.

## « Est-ce qu'elle lit TOUS les EAN ? » — le balayage (31 août 2026)

Question de Julien après le troisième correctif. Elle méritait mieux qu'un
exemple : les trois défauts avaient été trouvés un par un, chaque fois avec le
code-barres qu'il avait sous la main, et **chaque code d'essai révélait le
défaut que le précédent ne pouvait pas montrer** (8809652585598 n'a ni 3 ni 4 ;
045496428280 n'a pas de 3). On ne répond donc plus par un exemple.

`tests/douchette.test.ts` passe **les dix chiffres à tous les rangs** d'un
EAN-13 (220 codes : chaque chiffre × chaque position, plus les cent couples),
sur les deux dispositions, sous **six modèles de ponctuation** (guillemet
ouvrant et fermant, insécable étroite, insécable, espace ordinaire), plus les
quatre longueurs normalisées (EAN-8, UPC-A, EAN-13, ITF-14).

**Réponse : oui pour tout ce qui est un EAN.** Et deux gains au passage.

### Règle 2 bis : la rangée du haut, tirets compris

Le balayage a montré un vrai trou, hors EAN : un nombre **sans clé de
contrôle** contenant un 6 ou un 8 restait faux sur Android — `20000-_` au lieu
de `2000068`. Cela vise les codes internes, les compléments EAN-5 des livres,
et les étiquettes maison dont la clé est fausse.

- **⚠️ Ce qui autorise la conversion, c'est que rien d'autre qu'un nombre ne
  s'écrit avec ces seuls signes.** Une vraie référence porte des lettres
  (REF-12, SKU_01, M&S-001) : elle sort de l'ensemble, on n'y touche pas.
- **Deux gardes, et il faut les deux** : au moins un caractère de la rangée
  STRICTE (un « - » seul ne prouve rien), et la conversion n'est retenue que si
  elle rend **des chiffres et rien d'autre**.

### ⚠️ La limite qui reste, et pourquoi on la garde

Sur Android, un nombre **sans clé** composé des **seuls chiffres 6 et 8**
arrive en « -_ » et n'est pas redressé : ces deux signes s'écrivent dans de
vraies références, et aucun autre chiffre n'est là pour prouver le décalage.
Aucune longueur normalisée n'est concernée — la clé les arbitre toutes — et le
champ d'une balise tranche par `redresserNumero`. Sur iOS la question ne se
pose pas : « § » et « ! » n'ont aucun autre sens. Un test fige cette limite
plutôt que de la taire.

### ⚠️ Ce que le balayage ne prouve pas

Il vérifie la conformité à **notre modèle** du clavier et de la ponctuation
d'iOS, pas au comportement réel d'iOS. Ce modèle a été corrigé trois fois en une
journée par des scans réels. Un quatrième écart reste possible ; ce qui a changé,
c'est qu'il ne pourra plus venir d'un chiffre ou d'une position non essayés.

## ⚠️ Le champ de la douchette ne se vidait pas (31 août 2026)

Constat de Julien sur le **Pixel** : *« android : mode douchette non
fonctionnel »*, capture à l'appui — le code s'inscrivait dans le champ
(`à'('ç-'é_é_à`) **et y restait**.

### Le faux diagnostic, et ce qu'il a coûté

J'ai lu ce texte resté à l'écran comme la preuve que le scan n'avait pas été
soumis, et j'ai écrit une validation de secours « fin de rafale » (une
temporisation après la dernière frappe). **C'était faux, et la base le
disait** : les comptages correspondants étaient bien enregistrés — ABC1236 à
12:36:06 et 12:36:11 quand le champ montrait 045496428280, ABC1235 à 13:00:13
quand il montrait 045496425425.

⚠️ **La temporisation a donc été retirée le jour même**, et il ne faut pas la
réintroduire : elle **couperait un code en deux** dès qu'une douchette marque
un temps au milieu de sa transmission, et fabriquerait un article inconnu à
partir d'un code valide. Le suffixe « Entrée » arrive, sur les deux systèmes.
Vérifié au passage sur l'appareil, touches injectées par `adb` :
`KEYCODE_ENTER` **et** `KEYCODE_NUMPAD_ENTER` déclenchent `onSubmitEditing`.

Ce qui reste de cet épisode : un suffixe reçu **comme caractère** (CR dans le
texte plutôt qu'en touche, ce que font certaines douchettes) vaut validation.

### Le vrai défaut

Julien, une fois les deux systèmes en marche : *« le code-barres affiché est en
symbole, pas en chiffre, ce qui laisse penser que le scan n'est pas passé […]
un code inconnu reste dans la barre et impossible à supprimer, donc se cumule
avec le scan suivant, créant un inconnu »*.

`hwInputRef.current?.clear()` **ne tient pas** : la re-render qui suit
`resolveAndRecord` le défait. Deux conséquences, et ce sont exactement les deux
qu'il décrit :

1. on croit que le scan a échoué, et on rescanne ;
2. **le scan suivant se colle au précédent** et fabrique un article inconnu à
   partir de deux codes valides.

Et **aucun moyen de l'effacer à la main** : `showSoftInputOnFocus={false}`, et
un clavier physique appairé empêche de toute façon le clavier tactile
d'apparaître. Pas de retour arrière, pas de croix.

Trois gestes :

- **⚠️ Le champ se vide par REMONTAGE** (`key={\`hw-${hwSeq}\`}`), pas par
  `clear()`. Une vue neuve part de `defaultValue=""` : c'est la seule remise à
  zéro qui ne dépende pas de la synchronisation JS ↔ natif. `clear()` reste, il
  ne coûte rien et suffit le plus souvent. **Ne pas « simplifier » en le
  retirant.**
- **Une ligne de confirmation sous le champ** — « Dernier scan · 045496425425 ·
  <libellé> ». Le champ montre la frappe brute et continuera de le faire ; c'est
  cette ligne, pas lui, qui répond à « est-ce que ça a pris ? ». Le mode
  douchette n'avait **aucun** retour, contrairement au viseur.
- **« Effacer le champ »**, visible seulement quand il y a quelque chose à
  effacer. `hwPlein` est un booléen — il bascule une fois par scan, pas à chaque
  frappe : ce n'est pas le `value` que la note du 25 août interdit.

⚠️ **Et le focus ne revient pas derrière « Article inconnu »** : reprendre la
main sous la feuille y renverrait le scan suivant, qui se collerait au code déjà
saisi. C'est la seconde moitié du même défaut. `illisibleRef` sert à ça — l'état
capturé au rendu ne dit plus la vérité après l'`await`.

### Vérifié

**Par Julien, sur le Pixel puis sur son iPhone, le 31 août 2026** : « le test
est bon, ça marche sur Android », puis, après le correctif de l'espace des
guillemets et un build iOS, « le scan passe, c'est bon des deux côtés » — le
Blu-ray 5056635611789, celui qui porte un 3, servant de preuve. C'est la seule
preuve qui vaille pour ces défauts : un simulateur n'a pas de douchette, et la
capture du champ ne dit rien (voir juste après).

De mon côté, sur l'appareil : APK à jour (source 13:37, APK 13:40, installé à
13:40:09), aucun crash, et **zéro résidu** de mes essais en base — les touches
injectées et le « Ignorer » n'ont écrit ni comptage ni article.

### Piège de méthode : le champ affiche le brut, toujours

Le champ de capture est **non contrôlé** depuis le 25 août : ce qu'on y lit est
la frappe telle qu'elle arrive, jamais le résultat du redressement. Une capture
du champ ne dit donc **rien** sur le redressement — et, on l'a vu ici, rien non
plus sur la validation. **La base tranche en une requête ; l'écran, non.**
Interroger `counts` AVANT de conclure aurait évité tout le détour ci-dessus.

Le redressement de clavier, lui, n'était en cause à aucun moment : la chaîne
reçue sur Android se redresse correctement en `045496428280` (vérifié en
rejouant le module dessus), et elle confirmait même l'analyse de la veille —
apostrophes **droites** (pas de ponctuation intelligente hors iOS), `-` et `_`
pour les touches 6 et 8 (AZERTY de PC).

## ⚠️ Un champ de capture ne se pilote pas par un état React (25 août 2026)

Deux caractères sur treize **manquaient** dans le même scan (`//09?52559/`
contre les treize attendus) : ce n'est pas la table, c'est la capture.

Une douchette écrit treize touches en moins d'un dixième de seconde. Avec
`value={état}` sur le `TextInput`, chaque frappe renvoie au natif un texte
**déjà périmé** — et des caractères disparaissent au milieu du code, sans que
rien ne le signale. Le champ douchette **et** le champ d'ouverture d'une
balise sont donc passés en non contrôlés : `defaultValue=""`, un tampon
`useRef` mis à jour à chaque frappe, lu au moment de valider, et `.clear()`
pour vider. Ne pas y remettre de `value`.

Deux effets remettent les tampons à zéro au changement de mode et de phase :
le champ est démonté, un scan resté en cours ne doit pas ressortir plus tard.

Vérifié par `tests/douchette.test.ts` (16 cas), qui rejoue **le scan réel du
25 août** — `!!àç§(é(!((ç!` → `8809652585598`, majuscules accentuées
comprises — et le même code déformé par un clavier Windows.

**Confirmé par Julien sur son iPhone, douchette Inateck, le 25 août 2026 :
« ça marche, les 13 chiffres passent ».** C'est la seule preuve qui valait
pour la capture — un simulateur n'envoie pas treize touches en un dixième de
seconde.

## « Le téléphone doit rester sur la page et ne pas se verrouiller »

`useKeepAwake('comptage')` dans `Scanner`, donc **un seul point pour les deux
écrans de comptage**. Compter, c'est poser le téléphone sur une étagère : au
verrouillage la page se perd — et une douchette, qui écrit dans un champ, perd
son champ. Le verrou est repris au démontage, en quittant l'écran de comptage,
ce qui évite de vider la batterie une fois le travail fini.

`expo-keep-awake` était déjà installé (dépendance du paquet `expo`, pod
présent) : il n'est déclaré dans `package.json` que pour l'honnêteté, **aucun
`pod install` n'a été nécessaire**.

## Vérifications, et la limite du simulateur

Au simulateur, sur les données réelles : « & » saisi dans le champ balise
ouvre **la balise 1**, et une sonde temporaire a rendu `dispo=true
activation=OK` pour le keep-awake (sonde retirée, `git diff` contrôlé). Rien
n'a été laissé en base — la balise rouverte a été reclôturée, aucun comptage
ni article créé.

**Et sur le téléphone de Julien, le 25 août 2026, les deux points confirmés
en vrai** : « ça marche, les 13 chiffres passent », puis « l'écran ne se
verrouille plus non plus ». Un simulateur ne verrouille jamais son écran : le
keep-awake ne pouvait pas se prouver autrement qu'avec l'appareil en main.

**Le simulateur rejoue le défaut fidèlement, et c'est le meilleur banc
d'essai qu'on ait sans douchette** — corrigé le 25 août 2026, une première
version de cette note disait l'inverse. Son injection de texte passe par la
disposition du **Mac**, celle-là même que suit iOS : taper `8809652585598`
dans le champ douchette fait arriver `!!àç§(é(!((Ç!`, **exactement la chaîne
que la douchette de Julien a produite sur son iPhone**. C'est ce qui a permis
de vérifier la table iOS à l'écran avant qu'il ne reconstruise.

Deux précautions d'emploi, et une seule vraie limite :

- **taper le code voulu, pas le code déformé** : c'est le simulateur qui
  déforme. Les caractères non ASCII envoyés sont de toute façon écartés ;
- la touche 3 peut arriver en `»` plutôt qu'en `"` — ce sont les guillemets
  typographiques de macOS, une substitution du champ de saisie et non une
  différence de disposition ;
- **la rafale, elle, ne se prouve qu'avec la douchette** : l'injection du
  simulateur est trop lente pour reproduire treize touches en un dixième de
  seconde. C'est le défaut de capture, et il a fallu l'iPhone de Julien.

Au passage, confirmé à l'écran : `autoCapitalize="characters"` **fait bien
remonter `À` plutôt que `à`** — d'où les majuscules accentuées ajoutées à la
table et aux preuves. Sans elles, un scan sur deux serait resté faux.
