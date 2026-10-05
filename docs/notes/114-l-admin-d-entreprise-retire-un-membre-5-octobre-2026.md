# L'administrateur d'entreprise retire un membre — 5 octobre 2026

## La question de Julien, avant le pilote

« Sur la prod j'ai passé Théo en admin, mais il se peut qu'il fasse également
des inventaires. Il doit pouvoir faire la même chose qu'un superviseur. »

Mesuré sur la base de production, en lecture.

## Ce qui allait déjà

Théo est **`role = supervisor` ET `is_company_admin`**, et
`sync_company_admin_stores` l'a inscrit comme superviseur des **deux** magasins
du groupe. Tout ce qui exige « être superviseur » passe donc à l'identique.

Et il va plus loin qu'un superviseur ordinaire : chaque règle d'accès aux
inventaires passe par `is_session_participant`, qui contient
`is_company_admin(s.company_id)`. Il voit et pilote **tous** les inventaires de
son entreprise, y compris ceux qu'il n'a pas créés et ceux qui sont clôturés.

| | |
|---|---|
| créer, importer, compter, auditer, clôturer | oui |
| voir ceux créés par d'autres | oui — un superviseur ordinaire, non |
| modifier un inventaire clôturé | oui |
| supprimer un inventaire | oui (`delete_session` a l'échappatoire) |
| inviter des compteurs | oui — l'edge `invite-to-session` garde par `is_session_participant` |

Appareils : 100 déclarés par magasin, plafond 100.

## ⚠️ Le seul trou, et c'était le dernier

`remove_session_member` : « **Seul le créateur peut retirer un membre.** »
La dernière fonction du produit à exiger d'être le créateur sans laisser passer
l'administrateur d'entreprise.

Le cas réel : un superviseur crée l'inventaire, un compteur est parti ou
affecté au mauvais magasin, et l'administrateur ne peut pas l'en sortir. **Il
pouvait supprimer l'inventaire entier, mais pas en retirer une personne** —
l'issue disponible était plus brutale que le geste demandé.

L'échappatoire reprise est celle de `delete_session`, **mot pour mot** :
`public.is_company_admin(v_company)`. Deux règles d'accès qui disent la même
chose de deux façons divergent à la première correction portée sur une seule.

La protection du créateur reste : on ne retire pas le créateur de son propre
inventaire, quel que soit l'appelant. Sans lui, personne ne peut clôturer.

## ⚠️ Aucune mise à jour de l'application

Question de Julien : « faire cette correction nécessiterait une MAJ de l'app
publiée non ? » **Non.** La signature ne bouge pas —
`(p_session_id uuid, p_user_id uuid)` — et l'app comme le site appellent la
même fonction. La règle vit en base : les téléphones déjà installés l'ont prise
immédiatement, sans passer par Apple.

C'est la raison d'être de ce choix d'architecture, et c'est la première fois
qu'elle sert vraiment.

## Vérifié

- **Appliquée en production**, définition précédente sauvegardée avant.
- **Éprouvée en se mettant dans la peau de Théo**, dans une transaction
  annulée : un inventaire créé par Julien, Théo membre, et
  `remove_session_member` rend `success: true`. Avant, c'était
  « Seul le créateur peut retirer un membre. »
- **La production n'a rien gardé de l'essai** : 0 trace, mêmes compteurs
  qu'avant.
- Trois sabotages, trois morsures : l'échappatoire retirée, le créateur rendu
  retirable, le `revoke` enlevé.
- Le refus neuf a sa traduction anglaise dans les deux jumeaux
  `erreursServeur`. ⚠️ L'ancienne phrase reste : d'autres chemins peuvent
  encore la rendre, et un message disparu devient un message brut à l'écran.
