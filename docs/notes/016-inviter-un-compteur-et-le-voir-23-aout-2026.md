# Inviter un compteur, et le voir (23 août 2026)

Constat de Julien, en test réel : *« n'ayant personne dans mon équipe, j'ai
envoyé une invitation au compteur, puis retour auto sur page mon équipe mais
elle est vide, ce qui peut perturber le superviseur qui retentera »*. Il a
effectivement recommencé — deux comptes créés à cinq minutes d'intervalle.

Deux causes, indépendantes.

**1. Rien n'était rechargé.** `new-member.tsx` invalidait
`['team-invitations']` — la clé d'une requête **supprimée le 21 août 2026**
avec l'ancien écran de profil. Plus personne ne l'écoutait. « Mon équipe »
reste montée sous l'écran d'ajout, et le cache tient 30 s : le retour
affichait donc l'ancienne réponse, vide. La bonne clé est `['my-team']`.
⚠️ **Une clé de cache qui ne correspond à rien ne fait échouer aucun test et
ne lève aucune erreur.** Vérifier la clé, pas seulement la présence d'un
`invalidateQueries`.

**2. La personne apparaît comme compteur, pas comme invitation.**
`generateLink` crée l'utilisateur `auth` immédiatement, donc `handle_new_user`
se déclenche, crée le profil, l'affecte au magasin **et consomme la ligne
`team_invitations`**. Le bloc « Invitations en attente » ne montre donc rien
dans le cas nominal (il reste un filet pour le cas où la création auth
échoue). C'est la ligne de compteur qu'il faut savoir lire.

**⚠️ `is_active` veut dire « s'est déjà connecté », rien d'autre.** Le badge
mobile affichait « Accès retiré » — un contresens, et sur le cas le plus
courant : quelqu'un qu'on vient d'inviter. Une personne réellement retirée
n'a plus de ligne du tout, `remove_counter_from_store` efface son
`store_team`. Le libellé est désormais celui du site (`BadgeEnAttente`,
/equipe) : **« Mot de passe à créer »**.

Deux choix de mise en page, vérifiés au simulateur :

- **la pastille se pose sous le nom**, pas à côté. Sur la largeur d'un
  téléphone, la rangée nom + pastille + « Retirer » cassait le nom sur deux
  lignes et tronquait l'adresse (« jthiongkay+… ») — or c'est précisément
  l'adresse qu'on veut relire ;
- **la ligne porte l'adresse tant que la personne n'a pas ouvert
  l'application**, et son activité ensuite. C'est là qu'est parti le lien :
  c'est ce qu'on veut vérifier quand on doute d'une faute de frappe.

Vérifié au simulateur le 23 août 2026, clair et sombre, sur les données
réelles du compte d'essai — et l'état « en attente » photographié en forçant
temporairement la branche d'affichage, puis rétabli (`git diff` contrôlé).

Tests de garde : `tests/compte.test.ts`, bloc « une personne invitée apparaît
tout de suite ».
