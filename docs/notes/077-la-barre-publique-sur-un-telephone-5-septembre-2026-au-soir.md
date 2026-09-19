# La barre publique sur un téléphone (5 septembre 2026, au soir)

Trois constats de Julien en parcourant le site sur son téléphone : *« ouvrir le
menu burger n'affiche pas la croix par moment »*, *« ouvrir le menu burger
depuis le milieu de la page ne l'affiche pas »*, et *« en scrollant vers le
haut l'en-tête ne disparaît jamais — je veux qu'ils disparaissent quand on
descend et que ça revienne quand on remonte, smooth fading in and fading
out »*.

## ⚠️ LES DEUX PREMIERS N'EN FONT QU'UN, ET LA CAUSE EST EN CSS

Ouvrir le menu pose `overflow: hidden` sur `<html>` et `<body>` pour bloquer le
défilement derrière le panneau. Or **un ancêtre en `overflow: hidden` casse
`position: sticky`** : la barre retombait à sa position statique, c'est-à-dire
en haut du **document**. Depuis le milieu de la page elle partait donc hors
écran — avec la croix ET le panneau.

« Par moment » avait sa raison : en haut de page, la position statique coïncide
avec l'écran, et tout marchait.

**La barre passe en `position: fixed` sous 780 px.** Elle ne dépend plus du
contexte de défilement, donc plus rien ne peut la faire retomber.

- **⚠️ Le panneau reste en ABSOLU sur elle**, et c'est toujours une contrainte,
  pas un choix : `backdrop-filter` fait de `.site-header` un bloc conteneur,
  un descendant `fixed` s'y calerait (mesuré le 5 septembre au matin : le
  panneau sortait à 32 px de haut). Ce qui a changé, c'est que la barre est
  maintenant calée sur l'écran — donc « sous la barre » veut enfin dire « sous
  la barre, à l'écran ».
- **Un espaceur de 64 px** (`.site-header-espace`) rend au contenu la hauteur
  que la barre ne prend plus dans le flux. Sans lui, la première section de
  chaque page passerait dessous. Il vaut 0 sur un écran large, où la barre
  reste collante.

## La barre s'efface en descendant, revient en remontant

`transform: translateY(-100%)` **et** `opacity: 0` — le fondu seul laisse une
barre translucide par-dessus le texte à mi-chemin, et ce sont les deux seules
propriétés qu'un navigateur anime sans repeindre la page.

Trois cas où elle RESTE, et chacun a sa raison :

- **écran large** : la place ne manque pas, et une barre qui va et vient sous
  la souris agace plus qu'elle ne sert. **Mobile seulement, donc** ;
- **menu ouvert** : on retirerait la croix sous le doigt ;
- **haut de page** (90 px) : rien à gagner, et le rebond élastique d'iOS ferait
  clignoter la barre à chaque arrivée.

⚠️ **La référence de position ne bouge QUE lorsqu'on a tranché.** Sinon une
suite de micro-défilements sous le pas de 6 px la ferait avancer pixel par
pixel, le seuil ne serait jamais franchi, et la barre ne bougerait plus jamais.

`prefers-reduced-motion` annule le tout : une barre qui bouge sans qu'on le
demande est exactement ce que cette préférence vise.

## ⚠️ LA DÉCISION VIT DANS `lib/enTete.ts`, PAS DANS LE COMPOSANT

**Quatrième variante du piège du volet navigateur sur ce dépôt.** Le composant
regroupe ses lectures dans un `requestAnimationFrame` — et un onglet masqué
n'en produit **aucun** : mesuré, `rafTourne: false`. Mon premier essai a donc
montré une barre qui ne bougeait jamais, et **le code n'y était pour rien**.

Une règle qui ne tient qu'à des nombres se teste sans navigateur : elle est
sortie dans un module pur (`barreRetiree`, `retenirPosition`), et le composant
ne fait plus que la brancher. Ce qui reste à voir de ses yeux, c'est le fondu.

Les trois autres variantes, pour mémoire : `getAnimations()` qui rend une liste
vide, les apparitions `.reveal` qui ne se déclenchent jamais, et le `body` à
0 × 0 quand le volet est masqué.

## Vérifications

- **Au volet, à 375 px** : barre `fixed` à y = 0 **avec 4 375 px de
  défilement** (c'est le défaut de Julien, fermé), croix visible, panneau à
  64 px sur 748, les quatre liens atteignables au clic (`elementFromPoint`),
  espaceur à 64 px, contenu qui commence à 64 en haut de page, débordement nul.
- **À 1280 px** : barre toujours collante, espaceur à 0, jamais retirée. Les
  40 px de débordement mesurés ce jour-là étaient le cube décoratif rogné par
  `overflow-x: clip` ; **le cube est parti le 6 septembre**, le débordement
  vaut zéro. La règle du `clip` reste, elle.
- **Cinq sabotages, cinq échecs** : la barre redevenue collante, l'espaceur
  retiré, la barre qui s'efface menu ouvert, la référence qui avance à chaque
  pixel, le fondu sans le glissement.
- 1 257 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur, `next build`
  avec la table de routes inchangée.

**⚠️ Non vu bouger** : le fondu lui-même, faute de frames dans le volet. C'est
le seul point que le téléphone de Julien tranchera.

Tests de garde : `web/tests/entete-mobile.test.ts`.
