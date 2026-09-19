# L'administrateur d'entreprise supervise tous les magasins (22 août 2026)

Précision de Julien, capture à l'appui : son compte d'administrateur affichait
« Vous n'êtes affecté à aucun magasin », et l'écran l'invitait à s'en affecter
un depuis /equipe. C'était la lecture inverse de la règle — **il les a tous, par
construction**. Rien à s'affecter.

**Le levier est l'affectation, pas l'affichage.** Tout ce que voit un
superviseur — ses magasins, son équipe, ses inventaires, sur le site comme dans
l'application — se lit dans `store_supervisors` (`get_my_stores`,
`my_team_by_store`, les tableaux de bord). Rendre l'affectation vraie corrige
tous les écrans d'un seul geste ; ajouter partout une condition « ou bien il est
administrateur » aurait multiplié les endroits où l'oublier. Migration
`20260822150001`.

Deux déclencheurs tiennent l'invariant dans le temps, et couvrent aussi les
chemins qu'on écrira demain :

- `stores` **après insertion** → tous les administrateurs de l'entreprise
  prennent le nouveau magasin (console Quantinvo comme demande de magasin) ;
- `profiles` **après insertion ou changement** de `is_company_admin` /
  `company_id`, avec un `when` — le déclencheur ne se réveille pas sur une
  modification de prénom — → le nouvel administrateur prend tous les magasins
  (promotion par `invite-company-admin` comme profil créé par
  `handle_new_user` sur invitation).

Plus le rattrapage de l'existant dans la même migration, sans quoi l'invariant
ne vaudrait que pour les magasins créés après.

**Deux refus le protègent, et ils sont nécessaires** : les déclencheurs ne
réparent pas un retrait — ils ne se réveillent qu'à la création ou à la
nomination. Sans eux, une croix sur /equipe rendrait l'invariant faux en
silence.

- `ca_set_supervisor_stores` refuse un profil `is_company_admin` ;
- `admin_unassign_supervisor` (console Quantinvo) aussi, en disant la marche à
  suivre : retirer d'abord le rôle d'administrateur.

Côté écrans : /equipe montre « Affecté à tous les magasins de l'entreprise (3) »
à la place des pastilles et du sélecteur — une croix qui ne marche pas est pire
que pas de croix ; l'état vide de Magasins (site et application) et celui de Mon
équipe (application) disent « Votre entreprise n'a encore aucun magasin » et
renvoient vers la demande d'ajout.

**Ce qui n'a pas changé** : révoquer le rôle d'administrateur ne retire pas ses
affectations. Il redevient un superviseur ordinaire de tous les magasins, et
c'est alors qu'on peut l'en retirer un par un — l'inverse effacerait au passage
des affectations légitimes d'avant sa nomination.

Vérifié en base le 22 août 2026, en transaction annulée : un magasin créé
affecte l'administrateur (4/4), un superviseur promu prend les quatre, et les
deux retraits sont refusés — celui d'un superviseur ordinaire passant toujours.
Rattrapage contrôlé sur les données réelles : l'administrateur d'Entreprise C
est passé de 0 à 3 magasins, le superviseur ordinaire est resté à 2 sur 3.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « l'administrateur
d'entreprise a tous les magasins ».
