# Le scan dit ce qu'il a lu (7 septembre 2026)

Constat de Julien, capture à l'appui : viser un QR en phase balise affichait
**« Zone fermée — scannez d'abord une balise pour ouvrir une zone »**, « comme
si le scan voulait fermer la balise alors qu'on ne l'a pas encore ouverte ».
La saisie manuelle du même numéro, elle, ouvrait sans problème. Demande :
*« corrige et vérifie que le scan fonctionne à 100 % dans toutes les
situations, compte, audit »*.

## ⚠️ LE DÉFAUT EST LE MESSAGE, PAS LA LECTURE — et la nuance compte

Un seul refus répondait à **tout** code non reconnu, et il était écrit pour un
autre cas : l'article scanné avant d'avoir ouvert sa zone. Servi à un QR qu'on
croit être une balise, il ne dit ni ce qui a été lu, ni pourquoi ça ne marche
pas — et « fermée » laisse entendre qu'on vient de fermer quelque chose.

**La chaîne de lecture, elle, est saine, et c'est vérifié :** le QR que la
planche imprime encode `SCB1:1000` (relu sur la sortie de `QRCode.create`,
l'appel exact de `balises.ts`), et `parseBalise` le reconnaît. **Une vraie
balise Quantinvo ne peut donc pas produire ce refus** — ce qui, à l'inverse,
veut dire que le code scanné ce jour-là n'était pas une balise du produit.
C'est exactement ce que le nouveau message dit désormais, en une seconde.

⚠️ **Et c'est pour ça que la saisie manuelle marchait** : `openBaliseManual`
prend le numéro tel quel et n'appelle jamais `parseBalise`. Le contraste entre
les deux chemins n'était pas un défaut de la caméra — c'est qu'ils ne lisent
pas la même chose. Ne pas chercher le défaut du côté du cadre ou de la mise au
point sur ce symptôme-là.

## La décision est sortie du scanner : `src/lib/scan.ts`

Elle vivait au milieu de `resolveAndRecord`, entre deux `await` et trois
`useRef` — donc elle ne s'éprouvait qu'avec une caméra et une étiquette
imprimée. C'est pourtant la seule partie du scan qui porte des **règles** ; le
reste (viser, enregistrer) est de la plomberie.

`deciderScan(code, { parBalises, baliseOuverte, passe })` rend une action :
`cloturer`, `changer`, `ouvrir`, `article`, ou `refus` avec son titre et son
texte. Ce qui reste dans le composant est ce qui a besoin de la caméra ou du
réseau — la balise encore dans le champ (`ignoreBaliseRef`), l'ouverture,
l'enregistrement.

- **⚠️ Le format du QR a dû déménager dans `src/lib/baliseCode.ts`.**
  `balises.ts` dessine la planche PDF : il importe pdf-lib, `expo-file-system`
  et `expo-sharing`, donc il ne tourne pas sous vitest — `vitest.config.ts`
  s'en tient aux modules sans dépendance native. Or ces trois lignes décident
  si une étiquette ouvre une zone ou part en « article inconnu ». `balises.ts`
  les réexporte : aucun appelant n'a changé.
- **⚠️ Trois refus distincts, là où il n'y en avait qu'un :**
  · **« Ce n'est pas une balise »** — un QR qui n'a pas été produit par
    Quantinvo (adresse web, vCard, wifi…). C'est le cas de Julien.
  · **« Aucune zone ouverte »** — un code-barres d'article arrivé trop tôt.
    Le conseil est le même, la cause ne l'est pas.
  · **« Balise inutile ici »** — une balise scannée dans un inventaire **sans
    balises**. ⚠️ Défaut réel trouvé en balayant la matrice : elle partait en
    `resolveArticle`, ne trouvait rien, et ouvrait « Article inconnu » sur
    `SCB1:1` — on proposait donc de créer un **article portant le numéro d'une
    balise** dans le référentiel. Une saleté durable née d'un geste anodin.
- **⚠️ La passe ne change JAMAIS l'action, seulement les mots** (« comptez » /
  « auditez »). Compter et auditer se scannent pareil : c'est le même geste sur
  le même rayon, et l'écran n'a qu'un seul chemin. Un test le vérifie sur la
  matrice entière — si une décision divergeait un jour selon la passe, ce
  serait un défaut, pas une fonctionnalité.
- **⚠️ L'heuristique QR / code-barres ne décide QUE d'une phrase.** Elle ne
  choisit jamais un enregistrement : au pire on affiche l'un des deux refus à
  la place de l'autre, et les deux disent d'aller chercher la balise. Un SKU
  peut ressembler à n'importe quoi ; on ne retient donc que ce qu'un
  code-barres d'article ne porte jamais — un schéma d'URL, plusieurs lignes,
  ou plus de 32 caractères.

## La matrice, en entier

C'est la réponse à « 100 % dans toutes les situations » : deux modes
d'inventaire × zone ouverte ou non × deux passes × dix natures de code, toutes
parcourues. Le balayage vérifie qu'aucune combinaison ne tombe dans un trou —
action connue, refus jamais muet, code jamais vide — et les cas nommés disent
ce qu'on attend.

Quatre cas que seule la matrice a fait écrire : `SCB1:1:2` (le numéro contient
un deux-points — il ne doit pas être coupé en deux, sinon on ouvre **une autre
balise** que celle qu'on vise), le code vide, les préfixes voisins
(`SCB:1`, `SCB2:1`, `scb1:1`, `SCB1:`), et le QR quelconque **dans** une zone
ouverte — qui redevient un article, parce qu'on ne devine plus à la place de
quelqu'un qui a ouvert sa zone.

## ⚠️ Deux gardes réorientées, et un piège de sabotage

- `web/tests/balises.test.ts` lisait `src/lib/balises.ts` **nommé en dur** pour
  y trouver le préfixe. Elle est tombée quand le format en est sorti — sans
  rien avoir détecté de faux : elle décrivait où le code habitait la veille.
  Elle balaie désormais `src/lib/` et exige **une seule** déclaration du
  préfixe côté app. Ce qu'elle défend n'a pas changé : le site et l'app
  encodent le même.
- **⚠️ Un sabotage `perl -0pi -e` sur une apostrophe typographique ne remplace
  rien.** Perl travaille en octets ; `’` en fait trois, donc `.` n'en matche
  qu'un tiers. Deux sabotages sur quatre sont passés « au vert » sans avoir
  modifié une seule ligne — c'est-à-dire qu'ils ne prouvaient rien. Rejoués en
  Python (UTF-8), avec une assertion `motif présent` avant d'écrire : les
  quatre mordent (7, 2, 1 et 2 échecs). **Un sabotage doit échouer bruyamment
  s'il ne trouve pas son motif.**

## Vérifications

- 32 tests neufs, 483 pour l'application, 1 345 pour le site, `tsc --noEmit`
  des deux côtés.
- **Le QR imprimé décodé** : `SCB1:1`, `SCB1:42`, `SCB1:1000`, `SCB1:99999` —
  la charge exacte que `parseBalise` relit.
- **Lint** : les cinq erreurs `react-hooks/set-state-in-effect` de
  `scanner.tsx` sont **préexistantes** (mesuré : cinq avant, cinq après, sur la
  version `HEAD` du fichier), tout comme le `eslint-disable` inutile de
  `balises.ts`. Rien d'ajouté.
- **Sur le Pixel** : APK reconstruit, l'écran de comptage se charge sans casse
  après le refactor (phase balise, cadre carré, conseil temporisé). **Zéro
  écriture** : 165 comptages et 142 articles, inchangés.

⚠️ **CE QUI N'EST PAS PROUVÉ, ET NE PEUT PAS L'ÊTRE ICI : le scan caméra
lui-même.** Ni l'appareil piloté par `adb` ni un simulateur ne peuvent viser
une étiquette, et en phase balise le mode douchette est fermé — c'est donc le
seul chemin qui n'a pas de porte d'entrée depuis l'agent. Ce qui est prouvé,
c'est que la décision est juste sur toute la matrice, et que le QU'ON IMPRIME
est bien ce QU'ON LIT. Le rescan revient à Julien : le message lui dira
lui-même si son QR était une balise.
