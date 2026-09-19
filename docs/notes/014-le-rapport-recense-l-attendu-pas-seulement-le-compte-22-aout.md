# Le rapport recense l'attendu, pas seulement le compté (22 août 2026)

Deux écrans du même inventaire se contredisaient : sur « Test », l'onglet
Set up annonçait **1 015 pièces attendues** quand le Rapport en affichait
**395**, sur 11 lignes alors que le fichier théorique en compte 21.

`get_session_results` partait de `article_audit`, qui ne contient une ligne
que pour un SKU **déjà scanné**. Un article attendu et jamais trouvé n'avait
donc aucune ligne : son théorique n'était pas additionné, et son manque
n'entrait pas dans l'écart — les quatre tuiles du haut étant calculées en
additionnant les lignes affichées. **L'inventaire ne montrait pas la démarque
qu'il est censé révéler.**

Règle donnée par Julien : **le fichier qui fait foi est le stock théorique,
pas le référentiel**. Sans stock théorique, seuls les SKU comptés
apparaissent ; avec, tout l'attendu apparaît.

D'où l'**union** de `theoretical_stock` et des SKU comptés (migration
`20260822090001`), qui couvre les deux règles sans condition : quand aucun
fichier théorique n'est importé, l'union se réduit d'elle-même aux SKU
comptés. Ne pas la remplacer par un `from theoretical_stock` sec, ni par une
jointure interne — le rapport des inventaires sans fichier attendu se
viderait.

**Les règles d'audit ne bougent pas**, et c'est délibéré : la quantité qui
fait foi reste `final_qty → qty_pass2 → qty_pass1` (une quantité arbitrée
l'emporte sur l'audit, qui l'emporte sur le comptage), et la priorité des
statuts reste `failed > pending > resolved > validated`. Le seul ajout est
`uncounted` (« Non compté »), qui ne peut jamais écraser un statut d'audit :
il ne s'applique qu'aux SKU **sans aucune ligne d'audit**, donc jamais
comptés. Il n'entre pas dans le décompte « articles présentant encore un
écart ».

Un article compté mais **absent** du fichier théorique garde sa ligne, en
écart positif : c'est un surplus, le cacher serait l'erreur inverse.

Ordre de mise en ligne, à respecter si le sujet est repris : **les libellés
d'abord, la base ensuite** — sans `uncounted: 'Non compté'` dans
`web/lib/inventory.ts` et `src/lib/report.ts`, ces lignes s'affichent avec le
mot technique brut. Les builds mobiles antérieurs le montreront dans leur
export jusqu'au prochain build : c'est la contrepartie assumée.

Vérifié après application sur « LA Bruket » : 101 lignes au lieu de 5, dont 96
« Non compté », stock théorique 719 (contre 328) et écart −650 (contre −259).

Tests de garde : `web/tests/charge.test.ts`, bloc « le rapport d'inventaire ».

## Les totaux de l'app, vérifiés le 22 août 2026

Deux écrans additionnaient des lignes **téléchargées sur le téléphone**, et
les deux sont passés au serveur.

- **Écran d'un inventaire (superviseur)** : `getSessionCounts` rapatriait
  *toutes* les lignes de `counts` de l'inventaire, toutes colonnes, à chaque
  ouverture et à chaque rafraîchissement — pour en tirer deux nombres. C'est
  le motif que le site avait retiré pour la tenue en charge, resté en place
  côté mobile. Il appelle maintenant `get_session_count_totals`. La fonction
  `getSessionCounts` n'existe plus : **ne pas la réintroduire**.
- **Écran d'un compteur** : `getMyCounts` ne filtre pas sur l'utilisateur —
  c'est la policy `counts_select_own` qui limite un compteur à ses lignes.
  Un **superviseur** relève de `counts_select_supervisor` et aurait vu *toute
  l'équipe*, affichée comme son travail à lui. Le groupe `(employee)` ne
  vérifie que la présence d'un profil, pas le rôle, donc rien ne l'en
  empêchait ; c'est le routage par rôle qui l'évitait en pratique. Nouvelle
  fonction `get_my_count_totals` (migration `20260822110001`), qui ne compte
  que `auth.uid()` quel que soit le rôle. `getMyCounts` reste utilisé par
  `CountedBalisesList`, qui a besoin des lignes et non d'un total.

Le risque commun aux deux : au-delà d'un certain nombre de lignes, l'API peut
en rendre moins que demandé, et le total baisse **sans rien signaler**. Aucun
inventaire actuel n'est assez gros pour l'observer — c'est précisément
pourquoi il fallait le corriger avant.

Vérifié depuis le site avec une session réelle : `get_session_count_totals`
rend 70 / 11 / 5 / 1 sur « LA Bruket », `get_my_count_totals` rend 1 / 11 pour
le compte connecté — conforme à la base. Et depuis le simulateur non connecté,
les deux répondent `42501` : `anon` est bien refusé.

## Les autres totaux, vérifiés le 22 août 2026

Recalculés en SQL indépendamment et comparés aux fonctions, sur les données
réelles. **Rien d'autre n'est faux** — voici ce qui a été contrôlé et les deux
limites trouvées, qui ne sont pas des défauts mais des choix.

Contrôles passés :

- **aucun comptage orphelin** : sur le seul inventaire en mode balises, les
  32 pièces sont toutes rattachées à une zone existante (0 `zone is null`,
  0 code inconnu). Le risque reste ouvert structurellement — rien n'interdit
  un comptage sans zone —, il ne s'est simplement jamais produit ;
- **la somme des totaux par zone égale le total global**, passe par passe ;
- **la progression** est bien un pourcentage de **balises** (6 comptées sur
  10 = 60 %, 2 auditées = 20 %), pas de pièces. En mode classique, elle
  rapporte les pièces scannées au stock théorique attendu, et le dit quand
  celui-ci vaut zéro ;
- **l'onglet Écarts** : 4 écarts affichés sur « Test », 5 lignes arbitrées
  exclues — conforme au calcul refait à la main.

Deux limites à connaître :

1. **En mode classique, un article compté mais jamais retrouvé à l'audit
   n'apparaît pas dans les écarts.** Sa quantité d'audit est nulle, et rien ne
   distingue « l'auditeur ne l'a pas trouvé » de « l'auditeur n'est pas encore
   passé ». C'est un choix délibéré de `computeDiscrepancies` — pas de faux
   positifs, au prix de ce silence. En mode balises le problème n'existe pas :
   clôturer une balise dit « j'ai fini ici ». Sur « LA Bruket », 4 lignes sont
   dans ce cas.
2. **`counted_skus` n'était affiché nulle part** — il traversait la RPC, le
   hook et les types sans jamais être rendu. Il l'est depuis le 22 août 2026 :
   tuile « Références comptées », à droite de « Pièces comptées », avec les
   références auditées en sous-titre. Les pièces disent le volume, les
   références disent l'étendue — 300 pièces sur 4 références n'est pas le même
   inventaire que 300 pièces sur 250.

   **Le décompte ne retient que les références dont il reste quelque chose**
   (décision de Julien, migration `20260822100001`). `counts` est append-only :
   une correction est une ligne négative, donc un article scanné puis
   entièrement corrigé avait des lignes mais un net nul, et gonflait le
   chiffre — « 25 références comptées » là où il n'en restait que 23 avec du
   stock. Le décompte porte sur le **net par SKU, strictement positif** ; un
   net négatif est exclu par la même condition. Même règle pour les références
   auditées, les deux se lisant côte à côte.

   **Les totaux de pièces ne bougent pas** : sommer par SKU puis additionner
   donne le même résultat que sommer directement — vérifié après application
   sur les cinq inventaires.

   La rangée passe à cinq tuiles : `.dash-stats-5` remplace la grille de
   quatre colonnes fixes par `auto-fit` à 116 px minimum, faute de quoi la
   cinquième se retrouvait seule sur une deuxième ligne entre 900 et 1100 px
   de large. Sous 900 px, la règle générale à deux colonnes reprend la main —
   elle est plus bas dans la feuille, donc elle gagne.
