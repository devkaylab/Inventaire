# Deux superviseurs sur la même balise (2 septembre 2026)

Test de Julien sur l'inventaire « Seouliste 020926 » : deux superviseurs ont
compté la même balise, et **leurs relevés se sont additionnés sans que rien ne
les prévienne**. Il attendait que le second remplace le premier. Maquette
validée avant codage :
https://claude.ai/code/artifact/7b9d1fb4-ab13-4a9f-bfac-a47d6e9218b8

## Le défaut n'était pas l'addition, c'était le silence

L'addition est le modèle, et elle ne change pas : `counts` est un journal en
**ajout pur** — aucune policy UPDATE, une correction est une ligne négative.
C'est ce qui permet à deux personnes de finir le même rayon ensemble, et c'est
ce qui a été défendu deux fois pour raison de sécurité (VR-007, et le retrait du
bouton « Supprimer » des écarts le 29 août).

Le garde-fou existait — « 13 pièces y sont déjà enregistrées, vos scans
viendront s'ajouter » — mais **il ne se déclenchait que sur une balise
CLÔTURÉE** (`status !== 'done' → return null`). Un collègue qui laisse la sienne
ouverte n'était donc signalé nulle part. Rien côté serveur non plus :
`set_balise` n'a aucune notion de propriétaire, deux personnes ouvrent la même
balise sans le savoir.

## ⚠️ « Par quelqu'un d'autre » — RENVERSÉ LE 8 SEPTEMBRE 2026

**Cette section décrit un comportement qui n'existe plus.** La carte lit
désormais le total de la balise, pas les seules pièces d'autrui — décision de
Julien : *« qu'importe si c'est moi ou une autre personne qui a scanné la
balise initialement, celui qui rescanne le fait pour tout le monde »*. Voir
« Annuler ou recompter » en fin de fichier.

Ce qui suit reste vrai du RAISONNEMENT (pourquoi pas de colonne
« propriétaire », pourquoi `is distinct from`), et les quatre colonnes `*_autres`
sont toujours servies par `get_zone_dashboard` — plus personne ne les lit.

## ⚠️ « Par quelqu'un d'autre », et pas une colonne « propriétaire »

Le premier réflexe — ajouter à `zones` qui a ouvert la balise — **a été écarté,
et il faut savoir pourquoi** : deux personnes qui se relaient sur un rayon
rendraient cette colonne fausse immédiatement. Ce que l'écran veut savoir, c'est
« est-ce que quelqu'un d'autre a compté ici ? » — donc une **somme**, pas un
propriétaire.

`get_zone_dashboard` (migration `20260902180001`) rend donc quatre colonnes de
plus : `count_units_autres`, `count_lines_autres` et leurs jumelles d'audit,
filtrées sur `counted_by is distinct from auth.uid()`.

- **⚠️ `is distinct from`, jamais `<>`.** Une ligne dont l'auteur a été supprimé
  porte `null` (détachée par `on delete set null`) : elle vient bien de
  quelqu'un d'autre, et un `<>` la laisserait passer pour la nôtre.
- **Aucune migration de schéma**, et le cas qui compte le plus vient gratuitement :
  **rouvrir SA PROPRE balise ne demande rien.** Une carte qui s'affiche à chaque
  retour devient une carte qu'on ferme sans lire.
- **⚠️ Les colonnes s'ajoutent À LA FIN** : les applications déjà installées
  lisent les neuf premières et ignorent le reste. Elles continuent de
  fonctionner sans être reconstruites.
- **⚠️ DROP puis CREATE** — on ne change pas un type de retour par un
  `create or replace`. Les droits sont reposés dans la même migration, `anon`
  nommément : `create` rend EXECUTE à PUBLIC, et un `revoke … from public` ne
  suffit pas. Constat n°6 du 28 août, qui se reproduit à chaque recréation.

## La carte à trois choix

`Question` gagne `alternative` (libellé d'un troisième bouton, destructeur), et
`demanderChoix` rend `'action' | 'alternative' | 'annuler'`.

- **⚠️ `demander` rend toujours un booléen** (`demanderChoix(...).then(r => r === 'action')`) :
  **aucun appel existant ne change**. Le troisième choix n'existe que pour les
  cartes qui portent une `alternative`.
- **⚠️ Trois choix s'EMPILENT, deux restent côte à côte.** Trois pastilles sur la
  largeur d'un téléphone cassent leurs libellés sur trois lignes — constaté sur
  la barre de sélection multiple en août. Empilés, ils gardent leur texte et
  leur cible de 48 dp.
- **⚠️ `flexDirection: 'row-reverse'` sur la rangée, et ce n'est pas une
  coquetterie.** Le balisage écrit le bouton plein EN PREMIER, parce que c'est
  l'ordre d'une colonne ; en rangée il doit rester à DROITE comme partout
  ailleurs. L'inversion évite d'écrire deux fois les mêmes boutons. Vérifié à
  l'écran : une carte à deux boutons est inchangée.
- **L'ordre du triptyque** : le geste qui ne détruit rien d'abord (plein), le
  destructeur qu'on va chercher ensuite (contour rouge), la sortie en dernier.
  Même règle que les volets de la liste d'inventaires.
- **La carte ne nomme personne** — « Quelqu'un compte sur la balise 1000 ». Dire
  le nom rouvrirait par l'interface ce que la base ferme (`counts_select_own`),
  et le suivi a été dépersonnalisé le 19 août. Un test le vérifie.
- Deux textes, parce que ce ne sont pas les mêmes faits : **« déjà comptée »**
  (clôturée) et **« quelqu'un compte sur »** (en cours, surtitre « Attention »).

## « Reprendre à zéro »

Le remplacement devient un **choix explicite**, jamais le défaut. Il appelle
`vider_balise` — la fonction écrite le matin même pour le site — et repasse par
sa propre confirmation, en ton `danger`, qui **nomme ce qu'on perd** : « 13
pièces sur 3 références comptées par l'équipe seront effacées, audits compris. »

- **⚠️ Pas de recopie du numéro sur le téléphone**, contrairement au site — et
  c'est un écart assumé. L'exiger ici serait **plus strict sur une balise que
  sur l'inventaire entier**, que l'application supprime avec une seule
  confirmation nommée ; et ça ferait monter le clavier par-dessus la carte sur
  l'écran même où il pose déjà problème. Ce qui protège, c'est la distance (deux
  cartes) et le décompte.
- **⚠️ Rien ne part en file d'attente.** `viderBalise` vient de `@/lib/queries`,
  pas d'`offlineSync` : la file sert à ne rien perdre, y mettre un effacement
  ferait l'inverse — on ne saurait pas, au moment de l'envoi, ce qu'il détruit.
  Sans réseau on refuse et on n'ouvre pas. Un test vérifie l'absence du nom dans
  `offlineSync.ts`.

## Vérifications

- **En base**, sur les données réelles de « Rayon textile » (deux auteurs de
  comptages) : la même balise rend `autres = 15 u / 3 réf` à Camille et
  `autres = 0` à Nadia, qui les a comptées. C'est exactement le comportement
  voulu — l'une est prévenue, l'autre non.
- **Au simulateur**, par route jetable (retirée, `git status` contrôlé) :
  la carte à trois boutons en **clair et en sombre**, dans les deux cas
  (ouverte / clôturée), et **la non-régression d'une carte à deux boutons** —
  « Annuler » à gauche, l'action pleine à droite.
- **⚠️ Non vérifié appareil en main** : le parcours complet à deux comptes
  simultanés, qui demande deux téléphones. Ce qui est prouvé, c'est que la
  donnée dit vrai et que la carte s'affiche juste.

Tests de garde : `tests/compte.test.ts`, bloc « quelqu'un d'autre a compté sur
cette balise ».

⚠️ **Un garde-fou trouvé faux en chemin** : `web/tests/backend-durcissement.test.ts`
vérifiait qu'aucun écran ne cite `delete_audit_line` — en lisant le texte brut.
Le commentaire de `viderBalise`, qui EXPLIQUE la différence avec cette
fonction, le faisait échouer. La garde retire désormais les commentaires avant
d'assertir, comme `formulaires-publics.test.ts`. Troisième fois que ce piège se
présente sur ce projet.
