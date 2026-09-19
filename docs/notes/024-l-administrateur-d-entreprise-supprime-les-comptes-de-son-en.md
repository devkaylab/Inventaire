# L'administrateur d'entreprise supprime les comptes de son entreprise (22 août 2026)

Décision de Julien, à ma question restée ouverte depuis la veille. Jusqu'ici il
ne pouvait que **retirer les accès** (`ca_remove_supervisor`) : le compte
survivait, sans magasin ni équipe, et sa suppression réelle supposait de nous
écrire — `admin_delete_user` est réservé à Quantinvo. Pour une entreprise qui
voit passer des saisonniers, c'était une file d'attente chez nous pour un geste
qui la regarde.

`ca_delete_user` (migration `20260822120001`), gardée par `is_company_admin()`
— donc l'exigence aal2 conditionnelle voyage avec. Trois bornes, arrêtées le
même jour et à ne pas relâcher :

- **Compteurs et superviseurs seulement.** Jamais soi-même, jamais un autre
  administrateur d'entreprise, jamais un compte hors de l'entreprise : ces cas
  restent chez Quantinvo, comme c'est déjà la règle du retrait des accès. Sans
  cette borne, deux administrateurs fâchés s'effacent l'un l'autre.
- **La suppression réussit même si la personne a compté**, et c'est le point
  qu'il faut savoir avant de la déclencher : les comptages sont conservés mais
  **détachés** (`on delete set null`, migration `20260818000001`), donc un
  inventaire clôturé garde ses chiffres justes mais **son rapport ne dira plus
  qui a compté ces lignes**. La confirmation le dit en toutes lettres.
  L'alternative — refuser la suppression aux personnes ayant compté — a été
  écartée : la plupart des comptes ont compté, le droit aurait été décoratif.
- **Immédiate.** Pas de délai de grâce. Le motif d'origine — `pg_cron` n'était
  pas installé, une suppression différée ne se serait jamais exécutée — a
  disparu le 28 août 2026 avec la planification de la purge. **La décision, en
  revanche, tient toujours** : le geste délibéré est demandé à l'écran, pas au
  calendrier. Un compte qu'on supprime doit disparaître quand on le dit.

Chaque suppression est journalisée dans `company_audit_log`
(`action = 'compte_supprime'`), **l'identité figée avant le `delete`** — après,
ni le profil ni l'adresse n'existent et le journal n'aurait qu'un identifiant à
montrer dans un an.

Côté écran (`/equipe`, le site seulement — l'app mobile ne montre pas les
superviseurs, y porter ce droit supposerait d'abord d'y porter l'écran
d'administration) :

- **La confirmation exige la recopie du nom** (`requireText` de
  `ConfirmDialog`). « Supprimer le compte » est à deux centimètres de
  « Retirer les accès » et n'a rien de commun avec lui ; un clic de travers ne
  doit pas suffire. Au passage, les quatre `window.confirm()` de la page sont
  passés à la même modale : deux boutons voisins dont l'un ouvre une boîte de
  dialogue du navigateur et l'autre une modale du produit, cela se voit.
- **Un bloc « Compteurs · autres magasins »** liste les compteurs de
  l'entreprise que la liste par magasin ne montre pas. Sans lui le droit serait
  décoratif : un administrateur de siège ne supervise aucun magasin, donc ne
  voyait aucun compteur. Le **retrait** d'un magasin, lui, reste le geste de
  leur superviseur — d'où la seule action de suppression sur ces lignes.
- Le bouton n'apparaît jamais sur sa propre ligne ni sur celle d'un autre
  administrateur : ils vivent dans la branche `!m.is_company_admin`, celle qui
  porte déjà le retrait des accès.

Vérifié en base le 22 août 2026, session simulée par `request.jwt.claims` : les
quatre refus répondent juste (soi-même, autre entreprise, administrateur
Quantinvo, cible nulle), un superviseur ordinaire est refusé, et le chemin
nominal — essayé **en transaction annulée** sur le compte de test
`jthiongkay+supc` — supprime bien compte, profil, affectations et
participations aux inventaires, en laissant au journal le nom figé, l'auteur et
l'adresse. Le compte était intact après l'annulation.

**Non vu à l'écran** : `/equipe` demande une session connectée, que je n'ai
pas. Seuls les tests, le typage, le lint et `next build` valident le rendu, en
plus de la maquette validée avant codage :
https://claude.ai/code/artifact/ee37b309-0266-4c3d-b890-c38979989132

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « supprimer un
compte de son entreprise ». Le test de `navigation.test.ts` qui vérifiait que
« Retirer » n'est réservé à personne a été **amendé, pas affaibli** : la garde
porte désormais sur ce qui précède la suppression, le retrait d'un magasin
restant ouvert à tout superviseur.
