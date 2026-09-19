# Les cubes du décor sont partis (6 septembre 2026)

*« Retire-les, et ne répète pas le logo sur la page ; retire l'effet halo qui
se trouve derrière le logo en même temps. »* Trois restes de l'ancienne
identité, tombés d'un seul geste.

## ⚠️ CE QUI PARTAIT, ET POURQUOI ÇA NE VOULAIT PLUS RIEN DIRE

- **Les cubes filaires** (`CubeFilaire`) étaient l'esquisse au trait du logo
  d'avant. La marque est un **plan de magasin vu du dessus** depuis la veille :
  trois cubes isométriques flottant autour d'un plan carré, c'est deux
  identités sur le même écran. Sept couches en tout — trois dans le héros de
  l'accueil, quatre en décor de section — plus deux par page sur `/tarifs`,
  `/inventaire` et `/pourquoi-nous-choisir`.
- **Le logo du héros** faisait la **troisième** occurrence de la marque sur la
  page d'accueil, après la barre du haut et le pied de page. Une vitrine nomme
  la marque, elle ne la martèle pas.
- **Le halo**, c'est-à-dire deux choses qu'il fallait retirer ensemble : le
  `drop-shadow` **indigo en dur** (`rgba(108,92,231,0.5)`) de `.logo-glow`, un
  reste de la palette d'avant Ardoise, et la couche `.hero-voile` — le
  commentaire du fichier disait lui-même « le halo devient une couche animée ».

## ⚠️ ET LES DEUX RESTES SONT PARTIS DANS LA FOULÉE

J'avais laissé deux choses en les signalant plutôt qu'en les retirant, et
Julien a répondu « oui, retire-les aussi ». Elles comptent parce qu'elles
étendent la décision à **toutes** les pages vitrines :

- **`.scan-trait`** — le trait horizontal de 420 px sous le titre de l'accueil,
  en `--cyan` à 35 % d'opacité ;
- **`.hero::before`** — la lueur d'accent que **tous** les héros portaient,
  celle des pages intérieures comprise. `.hero-plein::before { content: none }`
  n'avait plus rien à annuler : il est parti avec.

⚠️ **UN HÉROS N'A DONC PLUS NI DÉCOR NI LUEUR, ET C'EST LA RÈGLE.** Il ne tient
que par sa typographie — ce qui est la doctrine Ardoise, où l'accent ne sert
qu'à ce qui engage. Remettre un dégradé derrière un titre, c'est refaire ce qui
a été défait ; une garde le refuse. `overflow: hidden` reste sur `.hero`, il
borne les couches de parallaxe.

## Ce qui reste, et c'est délibéré

- **`.band-glow`** — la lueur de la bande d'appel à l'action, qui n'a jamais eu
  de rapport avec le logo ni avec un héros.
- **`Parallaxe`** elle-même : elle sert encore cette couche et la sortie du
  héros de l'accueil (`data-hero-exit`). L'accueil, lui, n'a plus **aucune**
  couche `.plx`.

## ⚠️ LA GARDE DÉDUIT SA LISTE DE PAGES, ELLE N'EN CITE AUCUNE

Elle balaie tout `app/` et `components/` — `.tsx` **et** `.css` — et refuse
treize mots (`CubeFilaire`, `cube-a`, `logo-glow`, `hero-voile`, `flotte`,
`scan-trait`, `.hero::before`…). La page
vitrine qu'on écrira demain est couverte sans qu'on y pense ; une garde qui
nommerait `page.tsx` ne protégerait que la page d'aujourd'hui. Même doctrine
que les portes de `(compte)` et que la mention de TVA.

⚠️ **Et elle lit le code SANS SES COMMENTAIRES** — huitième fois sur ce dépôt.
Le commentaire de `globals.css` cite `.hero-voile` précisément pour dire qu'on
ne le remet pas, et le verbe « flotte » se trouve dans une phrase française
ailleurs dans la feuille. Une garde d'absence se lit elle-même si on l'oublie.

⚠️ **Une garde existante a dû être amendée, pas affaiblie** : elle citait
`.flotte, .flotte-lent, .scroll-cue svg { animation: none; }` mot pour mot. Les
deux premières classes n'existent plus ; elle vérifie désormais que la règle de
`prefers-reduced-motion` éteint bien ce qui bouge encore.

## Vérifications

- **Au navigateur**, clair et sombre, sur les quatre pages publiques : plus un
  seul cube, plus de logo dans le `<main>` de l'accueil, `::before` du héros à
  `none` partout, et **zéro couche `.plx` sur l'accueil**. **Débordement
  horizontal nul sur les quatre** — c'était 40 px sur `/tarifs`, et c'était
  justement le cube.
- **Trois sabotages, trois échecs** : une couche `cube-a` remise dans le héros,
  le `drop-shadow` du halo remis dans la feuille, la lueur `.hero::before`
  remise.
- 1 296 tests du site, `tsc --noEmit`, `eslint .` à **zéro erreur** (47
  avertissements, la famille `react-hooks/*` déjà documentée), `next build`
  avec la table de routes **inchangée**.

Tests de garde : `web/tests/navigation.test.ts`, blocs « le cube isométrique a
quitté le décor, et le halo avec lui » et « le logo ne se répète pas dans le
héros de l'accueil ».
