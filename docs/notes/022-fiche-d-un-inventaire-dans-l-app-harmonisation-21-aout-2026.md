# Fiche d'un inventaire dans l'app : harmonisation (21 août 2026)

Capture à l'appui, Julien : *« peux-tu faire le même travail d'harmonisation
sur cette page ? […] harmoniser la taille des différents textes, et bouger
set up au-dessus de membres »*. La feuille d'informations d'un inventaire
(`(supervisor)/[sessionId]/index.tsx`, le panneau qui s'ouvre sur le bouton
« i ») portait quatre défauts de la même famille.

- **« Créateur » et « Retirer » étaient dessinés pareil** — deux pastilles
  colorées de même taille, alors que l'une dit un état et l'autre supprime
  quelqu'un. C'était le plus grave. L'étiquette est passée en gris neutre,
  l'action en texte rouge sans fond : ça se touche, ça ne se lit pas. Ne pas
  redonner un fond coloré à `memberTag`, ni une pastille à `removeBtn`.
- **Une seule échelle de texte**, `Texte` en tête du fichier : 20 titre ·
  18 valeurs (numéro, code) · 15 courant · 13 second plan · 11 étiquettes. La
  feuille en employait sept — 10, 11, 13, 14, 15, 17, 18 — et son titre (17)
  était plus petit que le code qu'elle affiche (18). **Aucune taille en clair
  dans les styles** : un test échoue si un `fontSize:` numérique réapparaît
  (56, le grand nombre de la progression, est le seul toléré — c'est un
  chiffre d'affichage).
- **Une seule hauteur de bouton pleine largeur**, `BTN_H = 48`, partagée par
  « Compter », « Auditer », « Partager les identifiants » et « Inviter une
  personne ». Il y avait quatre géométries pour le même genre de travail.
  « Copier » passe en contour : deux boutons pleins violets étaient les objets
  les plus saturés de l'écran alors que l'information est **le code lui-même**.
- **Le motif de menu vient de `components/ui/MenuList`** et n'est plus
  redessiné ici. C'est la duplication que la refonte de « Mon compte » avait
  prétendu régler : `ActionRow`, `ChevronIcon`, `menuCard`, `menuRow`,
  `menuLabel` et `sectionLabel` vivaient encore en double dans cet écran.

**Configuration passe au-dessus de Membres** : on prépare un inventaire avant
d'y mettre des gens, et c'est l'ordre du site où Set up précède Équipe.

Les cartes de la feuille (identifiants, membres) sont passées de `background`
à `surface` : elles étaient de la couleur du fond, donc de simples contours
posés dessus.

Vérifié dans le simulateur, en clair et en sombre. **Comment atteindre cette
feuille sans pouvoir taper** (l'intégration simulateur qui ferait les appuis
refuse toujours de démarrer) : exporter temporairement `InfoPanel` et
`makeStyles`, poser une route jetable qui les rend avec des données factices,
faire pointer `src/app/index.tsx` dessus — un `openurl` ne suffit pas, iOS
demande une confirmation qu'on ne peut pas toucher — puis tout retirer et
vérifier au `git diff`.

Maquette validée avant codage :
https://claude.ai/code/artifact/a6b06896-74e0-479c-828b-93f9a3ad1159

Tests de garde : `tests/compte.test.ts`, bloc « fiche d'un inventaire ».
