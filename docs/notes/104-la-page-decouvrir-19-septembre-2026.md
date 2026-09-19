# La page « Découvrir » : ce qu'est Quantinvo (19 septembre 2026)

Demande de Julien : une page qui définit Quantinvo, ton professionnel, sans
jargon, **sans paragraphes** — des tuiles ou un diaporama, la hiérarchie de
la page commerçant de Qonto. Adresse : `/decouvrir` (et `/en/decouvrir`),
premier lien de la barre et du pied.

## La correspondance avec Qonto (relevée dans son Chrome, pas de mémoire)

héros à gauche → mosaïque « Plus qu'un scanner. » → « Adapté à chaque
rôle » → bande encre avec cartes qui défilent (du fichier au rapport) → « Votre
logiciel et Quantinvo, côte à côte » → « Un magasin, puis tout le réseau » →
« Pour aller plus loin » → questions (titre à gauche) → accent final.

**Pas de logos clients ni de témoignage** : on n'a aucun client, et on n'en
invente pas (même règle que les preuves de l'accueil).

## Ce qui tient la page

- `components/vitrine/Decouvrir.tsx`, styles `.dq-*` et `.carrousel*` en fin
  de `globals.css`. Titres de section **à gauche**.
- `components/Carrousel.tsx` : défilement natif (`scroll-snap`), flèches et
  pastilles, **pas d'avance automatique**. Dans le volet navigateur (onglet
  « hidden »), le défilement doux ne s'anime pas : la carte ne bouge pas au
  clic, c'est la mesure, pas le code — vérifié avec `behavior: 'instant'`.
- Aucune capture deux fois sur la page. Le rapport et les magasins de la
  tuile « réseau » sont **dessinés**, avec des noms génériques.
- Les listes à mot en gras sont découpées en `[gras, suite]`, jamais en
  fragments du type « Un » / « Des » : l'anglais n'a pas les mêmes articles
  (« Des » n'a pas de traduction, et le test refuse une traduction vide).
- `« Inventaire en cours »` a une entrée PLURIELLE dans `en.ts` : `t()` la
  rendrait en français. D'où « Comptage en cours ».
