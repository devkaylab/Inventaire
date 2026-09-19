# Changer le rôle d'un membre : superviseur ⇄ compteur (23 août 2026)

Demande de Julien. Il n'existait **aucun chemin** : `profiles.role` est figé
par le déclencheur `profiles_pin_privileged` pour `authenticated`, et les
seules fonctions qui l'écrivaient étaient `handle_new_user` (à l'inscription)
et la console Quantinvo. Une personne embauchée compteur puis promue chef de
rayon devait donc être supprimée et réinvitée — en perdant au passage
l'attribution de ses comptages.

`ca_set_user_role(p_user, p_role, p_store_ids default null)`, migration
`20260823120001`, gardée par `is_company_admin()`. Les deux gestes sont sur
/equipe, un lien par ligne : « Passer compteur » chez les superviseurs,
« Passer superviseur » chez les compteurs.

⚠️ **Le rôle ne se change pas seul : les affectations suivent.** Un
superviseur est rattaché par `store_supervisors`, un compteur par
`store_team`. Écrire `profiles.role` sans déplacer les lignes donnerait
quelqu'un qui a un rôle et **ne voit rien** — l'impasse exacte que la règle
« un superviseur a au moins un magasin » avait fermée le matin même. La
personne garde donc ses magasins dans les deux sens, seule la table change.

Trois refus, tous nécessaires :

- **soi-même** — un administrateur qui se rétrograde enferme son entreprise ;
- **un autre administrateur d'entreprise** — son rôle et son drapeau se
  tiennent, et ils se gèrent chez Quantinvo (même règle que
  `ca_remove_supervisor` et `ca_delete_user`) ;
- **une promotion sans magasin** — la règle du matin. Le message dit quoi
  faire : affecter un magasin d'abord.

Ce qui ne bouge pas, et n'a pas à bouger : les comptages (`counts.counted_by`),
les inventaires créés (`inventory_sessions.created_by`) et les participations
(`session_members`). `delete_session` prévoyait déjà le créateur rétrogradé —
« une rétrogradation en compteur retire le droit avec le rôle ».

**Pas de recopie du nom** dans la confirmation, contrairement à la
suppression : c'est réversible d'un clic. Elle dit en revanche les deux
conséquences qui se remarquent — les magasins qui suivent, et ce que la
personne pourra ou ne pourra plus faire.

**Deux actions au journal plutôt qu'une** (`promu_superviseur`,
`retrograde_compteur`) : « rôle modifié » obligerait à ouvrir le détail.
⚠️ Le garde-fou des libellés balaie les migrations à la regex et **ne voit pas
un `case … end`** : les deux libellés sont donc nommés explicitement dans
`web/tests/admin-entreprise.test.ts`.

Vérifié en base, en transactions annulées : les quatre refus (soi-même, autre
entreprise, rôle inconnu, superviseur ordinaire), le second clic
(`already: true`), et les deux sens sur les données réelles — un compteur à
1 magasin devient superviseur de ce magasin, un superviseur à 1 magasin
devient compteur de ce magasin, journal écrit dans les deux cas. Et à l'écran
par route jetable (retirée, `git status` contrôlé), clair et sombre.

Tests de garde : `web/tests/admin-entreprise.test.ts`.
