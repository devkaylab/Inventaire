# La balise rétrécit, et le dessin devient unique (24 septembre 2026)

La balise d'avant faisait **63,5 × 38,1 mm** (21 par planche) et ne portait
que deux choses : un QR et un numéro. Deux reproches, de Julien : elle est
trop grosse pour une étagère de magasin, et elle ne dit rien de la marque.

La nouvelle fait **35,6 × 16,9 mm, 80 par planche** — un quart de la surface —
et porte cinq choses : le QR, le numéro, une case **COMPTÉ**, une case
**AUDITÉ**, et l'adresse du site dressée dans la gouttière de droite, au-dessus
d'une bande verte qui prend toute la largeur du pied.

## Le format a été imprimé AVANT d'être codé

Quatre planches d'essai A4 sont passées par l'imprimante et par le téléphone
avant qu'une ligne ne soit écrite : quatre tailles d'étiquette, puis QR contre
Code 128 sur les deux plus petites, toutes avec un témoin de 100 mm pour
vérifier que l'imprimante n'avait pas « ajusté à la page ». Tout s'est scanné,
même de loin. C'est ce qui a permis de **figer le QR à 12,7 mm**, module
0,44 mm — et de ne plus y toucher.

⚠️ **Sous 0,40 mm de module, un téléphone décroche.** C'est physique, et ça ne
se voit pas à l'écran : une planche paraît parfaite et ne se lit pas. Le test
prend le plus grand numéro que chaque format de `BALISE_FORMATS` peut produire
(un numéro plus long fait grossir le QR d'une version, donc rétrécir chaque
carré) et vérifie qu'on reste au-dessus. Il **déduit** la liste, il ne l'écrit
pas : ajouter un format à six chiffres ferait tomber la garde toute seule.

Le code-barres 1D a été essayé et écarté — non pour le scan, qui marchait,
mais parce qu'il n'a pas de correction d'erreur, qu'un Pixel avait déjà mal lu
un code linéaire le 15 septembre (`98733` lu `987FF`), et qu'un numéro nu fait
perdre le passage d'une balise à l'autre sans clôturer.

## Le gabarit n'appartient à aucune marque

35,6 × 16,9, 80 par feuille, 5 colonnes sur 16 rangées : Avery le vend en
**L4732REV**, Herma en **4336** et **10701**, et une douzaine de fabricants
sans nom sous « 80 étiquettes par planche ». Deux sources indépendantes
donnent la même grille, et elle tient pour une seule raison : **elle est
centrée sur la feuille**. C'est ce que le test vérifie — marge gauche 11 mm,
marge haute 13,3 mm, pas de 38,1 × 16,9 — et non une référence de catalogue.
L'interface ne dit donc plus « Avery L7160 » mais le format, avec deux
références citées en exemple.

## Un seul dessin, copié des deux côtés

Le dessin vivait en double, écrit deux fois à la main (`src/lib/balises.ts` et
`web/lib/balisePdf.ts`), et **il avait déjà dérivé** : l'app savait imprimer un
nom d'étiquette, le site non. Il est maintenant dans **`baliseDessin.ts`**, qui
ne connaît ni Expo ni le navigateur — il rend un `PDFDocument`, et chaque côté
le sauve comme il veut (base64 pour le cache du téléphone, octets pour le blob
du navigateur). Ce qui reste dans les deux enveloppes est exactement ce qui les
distingue : écrire un fichier et ouvrir la feuille de partage d'un côté,
fabriquer un blob et le donner à télécharger de l'autre.

Trois modules sont désormais des jumeaux exacts : `baliseCode.ts` (le format du
QR), `baliseSeries.ts` (les numérotations) et `baliseDessin.ts` (le dessin).

⚠️ **La garde déduit sa liste d'une marque dans l'en-tête**, pas de trois noms
en dur : le quatrième jumeau sera couvert sans qu'on y pense. Elle a été
sabotée quatre fois avant d'être gardée — un jumeau qui diverge d'un seul
caractère, un QR rétréci sous la limite, une grille décentrée, la marque
retirée des en-têtes. Les quatre ont mordu.

Le `name` optionnel d'une balise a disparu : à 16,9 mm de haut il n'y avait
plus la place, et **aucun appelant ne s'en servait**. Mieux valait le retirer
que le laisser tomber en silence.

## Ce qui reste à vérifier sur la première vraie planche

La bande verte va jusqu'au bord de l'étiquette. Les étiquettes sont prédécoupées
avec un coin arrondi de 1,5 à 2 mm : si l'imprimante décale de quelques
dixièmes, la bande peut laisser un liseré blanc d'un côté ou déborder de
l'autre. Rien ne permet de le savoir sans imprimer sur du vrai support —
à regarder à la première planche achetée, et à rentrer ici.
