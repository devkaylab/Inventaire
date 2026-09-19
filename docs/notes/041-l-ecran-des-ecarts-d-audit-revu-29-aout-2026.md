# L'écran des écarts d'audit, revu (29 août 2026)

*« Revois l'interface de la page écarts d'audit, la section écarts arbitrés ne
convient pas. »* Capture à l'appui : en mode sombre, la section s'affichait dans
un **bandeau blanc**. Maquette validée avant codage, variante retenue par
Julien : https://claude.ai/code/artifact/ffce86dc-d20c-4eee-aef0-0a8cfb4d1e53

## ⚠️ Le bandeau blanc venait du gabarit Expo

`components/ui/collapsible.tsx` était un **reste du gabarit de départ** :
`ThemedView`, `@/constants/theme`, `@/hooks/use-theme`, `expo-symbols` — un
autre système de thème que celui de l'app (`@/constants/ink`, `@/lib/theme`).
Il ne pouvait donc pas suivre le mode sombre, et il n'avait **aucun autre
appelant**. Supprimé, pas adapté : une pièce qu'un seul écran utilise et qui
vient d'ailleurs se retire.

À retenir : quand un composant ne respecte pas le thème, regarder **d'où il
importe ses couleurs** avant de le corriger.

## Ce que la section est devenue

Une **liste**, pas une pile de cartes — ce sont des affaires réglées, elles
doivent peser moins qu'un écart ouvert. Un titre `baliseTitle` et une pastille
de compte, comme les groupes de balises juste au-dessus ; une seule carte, des
lignes séparées par un filet ; les trois chiffres nommés (Compteur, Auditeur,
Retenu en accent) et « Annuler l'arbitrage » en gris à droite.

- **Le badge « Arbitré » a disparu** : il répétait le titre de la section.
- **La ligne porte sa date** (« hier »), comme sur le site, et **le SKU ne se
  répète pas quand il EST déjà le titre** — un article sans libellé s'affiche
  sous sa référence.
- Au-delà de cinq, la liste se replie derrière « Voir les N autres ».

## ⚠️ Annuler un arbitrage se confirme

Le site demandait confirmation, l'app annulait **au premier appui** — sur une
liste qu'on fait défiler, et pour défaire une décision. `confirmAnnuler` pose
la question ; **le bouton de refus dit « Garder »**, parce que deux « Annuler »
dans la même carte ne se distinguent pas l'un de l'autre.

**⚠️ Et la cible fait 44 pt** (`hitSlop={{ top: 14, bottom: 14, … }}`). Le
libellé ne fait que 18 pt de haut : au simulateur, un appui posé dessus ratait
la cible **sans que rien ne le signale**. Un mot n'est pas un bouton tant qu'on
ne lui a pas donné sa hauteur.

## Le reste de la page

- **« Corrigés » devient « Arbitrés »** : c'était le même nombre que la section,
  sous deux noms.
- **⚠️ Un zéro ne porte aucune couleur, des deux côtés.** En rouge, « aucun
  écart » se lisait comme un problème ; en vert, un « 0 arbitré » annonçait une
  réussite qui n'a pas eu lieu.
- **La consigne ne s'affiche que s'il y a quelque chose à corriger** — sinon
  elle explique un geste que personne n'a à faire — et une carte verte
  « Aucun écart à traiter » prend sa place, au lieu d'une phrase grise reléguée
  **sous** la section arbitrés.
- **Les quatre chiffres d'un écart tiennent sur une ligne** (demande de Julien
  sur la maquette) : `minWidth: 72` poussait « Écart valeur » au rang suivant
  alors que la largeur de la carte suffit quand chacun se dimensionne sur son
  contenu. `flexWrap` retiré, `gap` à 12, `space-between`.
- `Chiffre` faisait doublon avec `Fig` : une seule définition.

## Deux trouvailles au passage

- **`depuis()` vit dans `src/lib/temps.ts`**, une seule définition pour les deux
  écrans qui datent un événement. `PendingBalisesView` avait sa copie.
  ⚠️ **La précision aux minutes reste là où elle sert** (`{ minutes: true }`) :
  une balise hors ligne surveille un retard qui dure (« il y a 3 h 05 »), un
  arbitrage se date en jours (« hier »).
- **⚠️ `audits.tsx` contenait trois octets nuls**, séparateurs de clé invisibles
  hérités d'une session précédente. Git traitait donc le fichier comme
  **binaire** et n'en montrait plus aucun diff. Remplacés par une espace ; un
  test l'interdit désormais.

## ⚠️ Un écart d'audit s'arbitre, il ne se supprime pas

*« On ne doit pas avoir de bouton supprimer sur la page écarts d'audit, ni sur
l'app, ni sur le site. »* (Julien, 29 août 2026, après avoir demandé à quoi il
servait.) La corbeille effaçait **tous les comptages** de l'article dans la
balise — ceux du compteur comme ceux de l'auditeur — pour couvrir le scan
d'un mauvais article. Ce cas se traite désormais comme les autres : on retient
**0**, et la ligne garde sa trace au lieu de disparaître.

Retiré des deux écrans (`audits.tsx`, `EcartsTab.tsx`) et des deux enveloppes
clientes. **La RPC `delete_audit_line` reste en base** : on retire les appels
d'abord, on supprime l'objet plus tard — règle du projet. Le garde-fou de
VR-007 qui la citait comme « le geste légitime de retrait d'une ligne » a été
récrit : c'est `resolve_audit` qui porte désormais l'arbitrage d'un superviseur
invité, et un test vérifie qu'aucun écran ne rejoint plus `delete_audit_line`.

## Deux boutons tranchent en un appui

*« Sur l'app ajoute les deux boutons Compteur Auditeur pour valider le bon
compte. »* **Le site les avait déjà** ; l'app obligeait à retaper la quantité
à la main. Deux boutons en contour, à largeur égale, portant chacun sa valeur.

- **⚠️ Ils reprennent les couleurs des deux passes.** Premier jet en contour,
  avec une étiquette en capitales et un gros nombre : *« je n'ai pas
  l'impression que ce soient des boutons, intuitivement j'irais saisir la
  quantité dans autre quantité »* (Julien). Ils empruntaient le dessin des
  **cellules de chiffres** — donc ils se lisaient comme de l'affichage, et le
  seul objet qui ressemblait à un bouton était « Retenir », juste à côté du
  champ. Ce sont maintenant deux aplats, dans les couleurs que l'app emploie
  déjà pour les deux passes : **accent pour compter, or (`AUDIT_COLOR`) pour
  auditer** — la paire exacte des boutons « Compter des articles » / « Auditer
  des articles » de l'écran d'inventaire. On réutilise une association déjà
  apprise plutôt que d'en inventer une.
- **⚠️ EMPILÉS, PAS CÔTE À CÔTE.** Le libellé porte les unités
  (« Compteur 3 unités » — un nombre seul ne dit pas ce qu'il compte), et
  « Auditeur 100000 unités » demande ~171 pt. Côte à côte il ne reste que
  **136 pt de texte par bouton** : il faudrait descendre à 11 pt. Sur toute la
  largeur il en reste 300, et la ligne tient quel que soit le nombre — vérifié
  à l'écran en forçant 100000 et 123456, à taille pleine et sans
  rétrécissement. `numberOfLines={1} adjustsFontSizeToFit` reste le filet pour
  les valeurs absurdes.
- **« Retenir » cède le premier plan** et passe en contour : saisir une autre
  quantité est le cas rare, il n'a pas à être le bouton le plus lourd de la
  carte.
- **Le singulier est géré** (`unites()`) : « 1 unité », « 0 unité »,
  « 3 unités ».
- **⚠️ Le site porte les mêmes deux couleurs** (`.btn-compteur` / `.btn-auditeur`
  dans `globals.css`), et « Retenir » y est passé en `btn-ghost` pour la même
  raison qu'ici. **L'or n'est pas un jeton de palette mais une couleur de
  mode** : la même valeur dans les deux thèmes et des deux côtés du produit —
  c'est pourquoi il est écrit en dur (`#FFC349` / `#1A1A1A`) plutôt que dérivé
  d'une variable. Un test compare la valeur du CSS à `AUDIT_COLOR` de
  `src/constants/colors.ts` : les deux bougent ensemble. Le bouton Compteur,
  lui, suit `var(--accent)`, qui vaut déjà l'accent de l'app dans chaque thème
  (vérifié au navigateur : `#6366F1` en sombre, `#4F46E5` en clair).
- **⚠️ Chaque nombre ne s'affiche qu'une fois.** Premier jet vu au simulateur :
  la rangée de chiffres affichait « Compteur 3 · Auditeur 2 » et les boutons
  juste dessous répétaient les mêmes deux nombres à quarante points d'écart.
  La rangée ne garde donc que ce qui se lit **sans se choisir** — Écart et
  Écart valeur.
- **⚠️ « Retenir » ne retient plus l'auditeur en douce.** Un champ vide valait
  la quantité de l'auditeur ; avec un bouton « Auditeur » à côté, cela ferait
  deux contrôles pour le même geste, dont un invisible. Le champ vide demande
  maintenant une saisie.
- La **virgule** du clavier français est acceptée, comme sur le site.

Six styles sans aucun appelant (`passes`, `passChip*`, `badge*`) ont été
retirés au passage.

## Vérifications

Au simulateur, sur les données réelles de « Rayon textile », clair et sombre :
la section sans bandeau blanc, l'état « Aucun écart à traiter » avec deux lignes
arbitrées, la confirmation (« Garder » ne change rien, « Annuler l'arbitrage »
remet la ligne en écart), et **un appui sur « Compteur » qui retient bien 3 là
où le champ retenait 2**. Tous les arbitrages d'essai ont été annulés :
`article_audit` est revenue à l'identique (TF-1003 et TF-1005 en `failed`,
`final_qty` nul, zéro ligne `resolved`).

**Confirmé par Julien sur son iPhone le 29 août 2026**, build refait : « ça a
l'air tout bon ». C'est la seule preuve qui vaille pour les deux boutons de
passe — un simulateur ne dit rien de ce qu'on touche au doigt.

⚠️ **Piège de méthode du jour** : le bouton d'annulation a semblé inerte pendant
plusieurs essais. Ce n'était pas le code — **la cible de 18 pt était trop petite
pour l'appui du simulateur**. Une sonde (fond magenta + `signaler.info`) a
tranché en un essai là où la relecture du code tournait en rond. Quand un appui
ne produit rien, rendre la cible visible avant de suspecter la logique.

Tests de garde : `tests/compte.test.ts`, blocs « les écarts arbitrés se lisent
comme une liste » et « “il y a 3 h” a une seule définition ».
