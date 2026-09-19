# La vitrine, refondue (5 septembre 2026)

*« Attaque surtout la page d'accueil du site. C'est notre vitrine, il manque du
contenu je trouve. Donc toujours avec Qonto, compare leur hiérarchie dans le
contenu et fais de même. »* Maquette validée point par point avant codage :
https://claude.ai/code/artifact/a75510df-1bd2-4f14-94ea-3efec20c06f9

## Ce que la comparaison a MESURÉ

Notre accueil faisait 3 229 px de haut, celui de Qonto 10 140. Le nombre de
pixels n'est pas le sujet : ce sont **les types de contenu qu'on n'avait pas**,
et le fait qu'**aucune de nos huit sections n'avait de fond**.

| Ce que Qonto pose | Chez nous, avant |
|---|---|
| Une preuve tout de suite | rien |
| Le produit se voit | aucune image |
| Comment ça se passe | rien |
| Les offres sur l'accueil | une phrase |
| Des bandes qui alternent | tout transparent |
| Une phrase par idée | jusqu'à quatre |

## Les règles, qui valent pour toute page vitrine

1. **Une bande, un fond.** Quatre alternances — page, surface, encre, accent.
   **⚠️ L'accent ne sert QU'UNE FOIS, à la fin** : un accent qui revient trois
   fois ne conclut plus rien. Un test le compte.
2. **Un surtitre annonce chaque bande** : on sait où on est avant de lire le
   titre.
3. **Une phrase par idée.** Le détail vit sur les pages dédiées.
4. **La preuve est chiffrée, vraie, et n'annonce JAMAIS le plafond.**
   400 000 références est la limite mesurée, et le produit s'alerte lui-même dès
   150 000 : l'écrire sur la vitrine, c'est vendre le point de rupture. On
   annonce 100 000. **⚠️ Et pas de client inventé** — on n'en a aucun.
   **« Jusqu'à » fait le travail** : cent compteurs est vrai sur un inventaire
   ordinaire ; sur 400 000 références le treizième appel simultané dépasse déjà
   le délai. Le mot dit le plafond sans promettre les deux ensemble.
5. **À l'impératif, sans négation.** « Préparez », « Comptez », « Arbitrez ».
6. **Un bouton dit le bénéfice, pas la démarche** — « Fiabiliser mon stock »
   plutôt qu'« Inscrire mon entreprise ». **La barre garde le libellé
   explicite** : c'est un repère de navigation, pas un argument. Qonto fait
   exactement ce partage, et un test fige les deux moitiés.
7. **Le prix est sur l'accueil**, public depuis le 30 août : le cacher derrière
   un lien fait douter. **Les montants viennent tous de `lib/offres.ts`.**

## ⚠️ DEUX DÉFAUTS TROUVÉS EN REGARDANT, PAS EN TESTANT

- **En thème sombre, la bande encre avait la couleur de la page.** `--encre`
  valait `#0b0f19` dans les deux thèmes — c'est-à-dire, en sombre, exactement
  `--bg`. La seule section qui doit trancher était la seule qu'on ne voyait
  pas. **Les deux valeurs étaient justes prises isolément ; c'est leur RAPPORT
  qui était faux** — même famille que les champs de saisie posés sur un fond de
  leur propre couleur (22 août, 4 septembre). L'encre descend d'un cran en
  sombre (`#060910`, le `headerBg` de l'app) et garde le bleu-nuit en clair. La
  garde compare désormais encre et fond **dans les deux thèmes**.
- **Les trois boutons d'offre menaient au même écran.** `/souscrire` retombe sur
  son offre par défaut : « Commencer avec Enterprise » ouvrait Essential. Ils
  portent `?offre=<cle>`, comme le fait déjà `TarifsGrille`. Trouvé en
  parcourant les liens un par un, à la demande de Julien — pas par un test.

## ⚠️ Une garde qui NOMME une ancre protège l'ancre d'hier

`navigation.test.ts` exigeait `href="#rythmes"` en dur. La refonte a glissé
cette section en cinquième position et l'indice de défilement a dû viser la
première : la garde est tombée **alors que rien n'était cassé**. Elle déduit
maintenant la cible de l'indice et vérifie qu'une section la porte. Même
doctrine que la garde des portes de `(compte)` le 4 septembre.

## ⚠️ Vérifier une page longue dans le volet navigateur

Deux pièges, tous deux coûteux :

- **le volet ne photographie que ce qui est à l'ordonnée zéro.** `scrollTo` et
  `scrollIntoView` déplacent bien le DOM (et les styles pilotés par le
  défilement suivent), mais la capture reste au sommet — d'où des écrans
  uniformément vides qu'on prend pour un défaut de rendu. **Remonter la page
  par une marge négative sur `<main>`** met la section voulue sous l'en-tête ;
- **les apparitions `.reveal` ne se déclenchent jamais** : l'onglet est
  « hidden », l'`IntersectionObserver` ne part pas. Injecter
  `.reveal{opacity:1!important;transform:none!important}` avant toute lecture.

## Vérifications

Au navigateur, **clair et sombre**, à **1568 px** (l'écran de Julien), 900 et
390 px : les huit bandes, **aucun débordement de contenu** — `scrollX` reste à
zéro, et les 40 px mesurés à l'époque étaient le cube décoratif que la racine
rognait en `clip` (retiré le 6 septembre, le débordement vaut zéro depuis) — et
aucune erreur de console.

**Chaque bouton cliqué pour de vrai**, écran d'arrivée relu : les trois offres
présélectionnent bien la leur, les cinq liens de la barre et les cinq du pied
répondent 200. **Onze sabotages, onze échecs.** 1 140 tests, `tsc --noEmit`,
`eslint .` à zéro erreur, `next build` avec la table de routes inchangée.

⚠️ **Ce qui reste** : la section « Du rayon au tableau de bord » montre une
capture réelle du téléphone et un tableau de bord **redessiné**
(`components/ApercuTableauDeBord.tsx`) — les treize captures de
`public/prise-en-main/` sont toutes mobiles, et une capture réelle du site
porterait les données du compte d'essai. Julien apporte une vraie photo de
terrain ; le jour où une capture présentable existe, elle remplace ce bloc sans
toucher au reste.

Tests de garde : `web/tests/vitrine-accueil.test.ts`.

## La version mobile de la vitrine (5 septembre 2026)

Constat de Julien, capture d'iPhone à l'appui, une heure après la mise en ligne
de la refonte : *« peux revoir la version mobile stp »*. Deux défauts, et le
second était un trou, pas un détail.

### ⚠️ 1. Le bouton de la barre sortait du bandeau

`.site-header .inner` a une hauteur **figée** de 64 px : « Inscrire mon
entreprise » passait à trois lignes, débordait du bandeau et dépassait le bord
droit de l'écran. Les deux moitiés du correctif vont ensemble — `white-space:
nowrap` sur le bouton, **parce que** la rangée ne peut pas grandir.

**⚠️ ET MA MESURE NE L'AVAIT PAS VU.** Le contrôle de la veille à 390 px
filtrait `main *` : il n'a jamais regardé l'en-tête. **Une mesure de débordement
porte sur `body`, jamais sur une seule branche.**

### ⚠️ 2. Sur un téléphone, les quatre liens du site DISPARAISSAIENT

Sous 780 px, `.nav-links` passait en `display: none` — et rien ne les
remplaçait. Un visiteur de téléphone ne pouvait atteindre ni les tarifs ni les
pages produit autrement qu'en devinant l'adresse. Julien a envoyé la version
mobile de Qonto : mot-symbole, **un** bouton, et tout le reste derrière un
burger. `components/MenuMobile.tsx`.

Ce que la comparaison a donné, et qu'il ne faut pas défaire :

- **le panneau prend TOUT L'ÉCRAN sous la barre**, il ne pend pas dessous. Un
  menu court laisse voir la page derrière et se lit comme une infobulle ;
- **les liens sont grands, avec un chevron** — on parcourt en haut, on agit en
  bas ;
- **les deux actions sont en pied, dans leurs rangs** : le bouton plein sur
  toute la largeur, puis « Se connecter » en lien souligné. La barre garde deux
  rangs sur un écran large ; sur 390 px il n'y a pas la place, et c'est le rang
  **secondaire** qui entre au menu — jamais le bouton principal ;
- **le bouton de la barre s'efface tant que le menu est ouvert** : il est déjà
  dans le panneau, et le même geste offert deux fois à trente centimètres
  d'écart fait douter qu'il s'agisse du même ;
- **⚠️ et le burger reprend alors la marge des actions effacées.** C'est
  `.header-actions` qui porte le `margin-left: auto` : sans reprise, la croix
  venait se coller au mot-symbole. **Ce défaut ne se voit QUE menu ouvert** —
  aucune capture de la page au repos ne le montre (constat de Julien).

### ⚠️ Ce qui cède quand la place manque, c'est MESURÉ

À 390 px : mot-symbole (143) + « Inscrire mon entreprise » (187) + burger (44)
+ écarts = **408 px pour 395 disponibles**. Avec la forme courte du libellé,
326 : il reste de la marge. Pour une marque jeune, le mot-symbole vaut mieux que
deux mots de plus sur un bouton — et **« Inscription » reste explicite**, c'est
le nom de la page où il mène. Sous 360 px seulement, le logo suffit.

⚠️ **Le libellé long et le court sont TOUS DEUX dans le balisage**, et c'est
`display: none` qui tranche : un lecteur d'écran n'en annonce qu'un. Ne pas
remplacer par un pseudo-élément, dont le texte n'est pas fiable pour
l'accessibilité.

### ⚠️ `backdrop-filter` fait un bloc conteneur

Le panneau est sorti à **32 px de haut** au premier essai. `.site-header` porte
un `backdrop-filter` : il devient donc un bloc conteneur pour ses descendants en
`position: fixed`, qui se calent sur la barre et non sur l'écran. Le panneau est
en **absolu sur la barre elle-même** — qui est pleine largeur, contrairement à
`.inner`. À connaître avant de poser quoi que ce soit de fixe dans un en-tête
flouté.

### ⚠️ UN STYLE D'AUTEUR BAT L'ATTRIBUT `hidden`

*« Le site s'ouvre directement avec le menu ouvert sur le téléphone. »* Constat
de Julien, une heure après la mise en ligne du burger.

Ce n'était pas l'état React : `.menu-mobile` porte `display: flex`, et **une
feuille d'AUTEUR passe avant celle du navigateur, quelle que soit la
spécificité**. Le `display: none` que le navigateur pose sur un élément `hidden`
était simplement écrasé — le panneau était donc affiché en permanence, plein
écran, dès l'arrivée sur le site.

⚠️ **Et j'ai introduit ce défaut le jour même**, en passant le panneau en plein
écran : la version d'avant n'avait aucun `display`, donc `hidden` suffisait.
**Après cette réécriture je n'ai regardé que l'état OUVERT** — j'ai vérifié
Échap, le clic ailleurs, la navigation, jamais l'état au repos. *Un composant
qui bascule se regarde dans ses deux états, et celui qu'on oublie est celui
qu'on vient de quitter.*

Le remède tient en une ligne (`.menu-mobile[hidden] { display: none; }`), la
garde est plus large : elle balaie les composants, retient les éléments
réellement pilotés par `hidden`, et exige le pendant pour ceux dont le CSS
impose un `display`. Le prochain se signalera tout seul.

### Une seule liste de liens

`lib/navigation.ts` porte `LIENS_PUBLICS`, lue par la barre **et** par le menu.
Deux listes recopiées divergeraient au premier lien ajouté — et c'est le menu
mobile, celui qu'on regarde le moins, qui garderait l'ancienne. Une garde refuse
un lien de navigation écrit en dur dans l'un ou l'autre.

⚠️ **Une garde a dû être récrite pour ça** : `offres.test.ts` comptait DEUX
`href="/tarifs"` dans SiteChrome. Depuis que l'en-tête lit la liste partagée, ce
compte ne mesurait plus l'accessibilité de la page — seulement sa façon d'être
écrite. Elle vérifie désormais les deux chemins, chacun à sa source.

### Vérifications

Mesuré à **320, 360, 375, 390, 430, 480, 500, 768 et 1280 px**, clair et sombre :
la barre garde 64 px de haut partout, aucun débordement (`scrollWidth` égal à
`clientWidth` sur la barre comme sur le document), la croix tombe au pixel où
était le burger (bord droit 374, centre 32). Le menu ouvert, parcouru pour de
vrai : Échap referme, un clic ailleurs referme, un lien navigue **et** referme,
et la classe de verrouillage quitte `<html>`. Neuf sabotages, neuf échecs.
1 146 tests, `tsc`, `eslint .` à zéro erreur, `next build` inchangé.
