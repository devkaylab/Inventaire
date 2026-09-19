# La tuile Progression prend une couleur (7 septembre 2026)

*« Retirer l'effet halo de la tuile progression sur le site, je veux plutôt y
mettre une couleur pour la différencier des autres. Attention au mode dark, et
les deux barres de progression ne doivent pas changer. »* Trois variantes
proposées sur maquette, **la B retenue** :
https://claude.ai/code/artifact/db6b08a8-ec91-42b7-a582-c17ae31d49f2

## ⚠️ CE QUE LE HALO CACHAIT, ET C'EST LA LEÇON DU CHANTIER

La tuile était en verre dépoli depuis le 25 août : fond translucide,
`backdrop-filter`, et deux lueurs radiales dans son `::before`. Ces lueurs
étaient **l'indigo et le cyan d'AVANT Ardoise** — `rgba(99,102,241)` et
`rgba(56,201,255)` en sombre, `rgba(79,70,229)` et `rgba(10,165,216)` en clair.

**Elles ont survécu à la passe d'identité du 6 septembre parce qu'elles sont
écrites EN DUR, hors des jetons** — et cette passe balaie les jetons. C'est la
même famille que le `#8A82B8` du mot-symbole de l'application, trouvé par Julien
le lendemain : *une valeur écrite sur place est invisible à un changement
d'identité*. Le seul remède est une garde qui refuse nommément les couleurs
mortes, et il en existe désormais une pour le site comme pour l'application.

Second constat, moins visible : **le verre ne floutait rien.** Un
`backdrop-filter` ne floute que ce qui est peint DERRIÈRE l'élément, et le fond
de la page est uni. Ce qu'on voyait n'était donc pas un flou mais une tache
colorée sous une carte blanchâtre — ce qui explique exactement le constat de
Julien : elle ne se distinguait pas de ses voisines.

## Ce que la tuile est devenue

Fond `--accent-soft` — le vert que le produit emploie déjà pour le rang actif du
rail et la pastille « Vous ». **Aucun jeton nouveau, aucune valeur de teinte
écrite sur place** : la tuile devient littéralement « le bloc actif » du rail,
ce qu'elle est.

- **⚠️ LES DEUX BARRES NE CHANGENT PAS.** Comptage = dégradé
  `--accent → --cyan`, audit = `--success`, reflet « Flux » compris. Un test
  vérifie les deux déclarations **à la lettre**, et qu'aucune règle sous
  `.dash-progress` ne les repeint — le reflet vit sur le `::after` du
  remplissage, pas sur le remplissage.
- **⚠️ Ce qui suit le fond, c'est la GOUTTIÈRE de barre.** Elle était écrite en
  dur en bleu nuit (`rgba(11,15,25,.55)`) : sur un aplat vert, une entaille.
  Elle est désormais une transparence, donc elle se creuse dans n'importe quel
  fond — mais il en faut **deux**, une seule ne creusant pas également sur un
  pastel et sur un fond déjà sombre.
- **⚠️ Le filet est une INCRUSTATION (`inset 0 0 0 1px`), jamais une `border`.**
  `.panel` est à `border: 0` avec 24 px de rembourrage : une vraie bordure
  ajouterait 2 px et décalerait la tuile de ses voisines dans le rail. Un test
  refuse `border:` dans cette règle.
- **⚠️ Et ce filet ne contredit pas la règle d'Ardoise** (« une carte ne se
  détache pas parce qu'on l'a détourée ») : cette règle vise le contour posé sur
  **chaque** bloc, alors qu'ici une seule carte du rail le porte, précisément
  pour dire qu'elle n'est pas une carte comme les autres. En sombre,
  `--accent-2` plein serait criard sur un aplat déjà vert : le filet s'y atténue.
- **Le grand pourcentage perd son dégradé de texte.** Sur un fond teinté, un
  texte peint par `background-clip: text` se lit moins bien qu'un aplat. Le
  dégradé reste là où il dit quelque chose : dans la barre de comptage.
- **« Reste à compter » passe en surface plutôt qu'en ambre** : deux pastels
  côte à côte — un vert pâle et un beige — ne se distinguent plus. Le blanc
  tranche, et le compte garde son ocre, qui est ce qui porte l'alerte.

## ⚠️ PAS DE `prefers-color-scheme` DANS CETTE FEUILLE

Le site pose **toujours** `data-theme` : le script de `layout.tsx` retombe sur
« dark » même s'il lève. Il n'y a donc jamais d'état non marqué, contrairement à
un artifact. La règle de base sert le sombre, `[data-theme="light"]` sert le
clair — et les deux seules requêtes `prefers-color-scheme` que j'avais d'abord
écrites (par réflexe d'artifact) auraient été les seules du fichier. Un test les
refuse dans ce bloc.

## ⚠️ UN CONTRASTE TROUVÉ EN MESURANT, ET PLUS ANCIEN QUE LE CHANTIER

Le libellé « PROGRESSION » est en `--text-3`, le troisième gris. Mesuré au
navigateur sur le nouvel aplat : **2,68:1 en clair, 2,78:1 en sombre** — loin
sous AA. Il passe en `--text-2` (**5,53** et **4,97**).

Le défaut est antérieur : sur la surface blanche il valait déjà **3,22:1**. Un
fond teinté n'a pas le droit de l'aggraver, mais la cause est le troisième gris
sur du petit texte — la même famille que les relèvements du 5 septembre et la
règle « pas de troisième gris dans un document » du 6. **Les autres
`.dash-section-label` de la page restent sur `--surface` et sortent du périmètre
de cette tuile** ; à reprendre le jour où on refait le tableau de bord.

## Vérifications

- **Mesuré au navigateur**, par route jetable (retirée, `rm -rf web/.next`,
  `git status` contrôlé), à 1 440 px, **clair et sombre** : trois valeurs de fond
  distinctes (page / tuile / carte voisine), les deux remplissages inchangés au
  canal près, la gouttière qui creuse dans les deux thèmes, et **cinq rôles de
  texte tous au-dessus de 4,5:1**. Débordement horizontal nul.
- **Huit sabotages, huit échecs** : halo revenu, couleur morte, remplissage
  repeint, gouttière bleu nuit, vraie bordure, dégradé de texte, thème clair
  retiré, mouvement non coupé.
- 1 341 tests du site, `tsc --noEmit`, `eslint .` à **zéro erreur** (47
  avertissements, la famille `react-hooks/*` déjà documentée), `next build` avec
  la table de routes **inchangée**.

Tests de garde : `web/tests/tuile-progression.test.ts`.
