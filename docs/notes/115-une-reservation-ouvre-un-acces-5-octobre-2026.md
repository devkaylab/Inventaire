# Une réservation ouvre un accès. Rien de plus — 5 octobre 2026

## Le recadrage de Julien

> « Je pense que nous nous compliquons la vie. Je me répète peut-être mais on
> veut juste que On-Demand donne accès à Quantinvo OS juste le temps d'un
> inventaire, c'est tout, le reste doit être la même chose que pour un
> utilisateur lambda Quantinvo OS. Ce qui change c'est **la facturation et la
> durée d'utilisation**. »
>
> « Une réservation ne crée pas automatiquement l'inventaire, c'est le client
> qui créera son inventaire. »
>
> « L'accès reste ouvert 7 j oui, l'inventaire est automatiquement clôturé
> au-delà de ce délai, pas supprimé. »

## ⚠️ Ce que je construisais était plus compliqué que le produit

La veille, j'avais proposé deux sorties au problème des « deux inventaires » et
fait naître l'inventaire avec la réservation. Puis j'ai débattu du mode de
comptage **« puisque personne n'est là pour choisir »** — alors qu'il y a
toujours quelqu'un : le client. Julien : « pourquoi il n'y aurait personne ? »

Trois migrations pour une question qui ne se posait pas.

Une réservation, c'est deux choses :

- une **fenêtre d'accès** sur un magasin, avec des appareils en plus ;
- un **montant**.

Tout le reste — créer l'inventaire, le nommer, choisir les zones, importer,
compter, clôturer — c'est Quantinvo OS, à l'identique, fait par le client.

## Ce qui a été défait

| | |
|---|---|
| `reserver_ma_mission` | ne crée plus d'inventaire |
| `admin_avancer_mission` | n'en crée plus non plus |
| l'écran du client | ne mène plus à un inventaire désigné, mais à son tableau de bord |

`creer_la_session_de_mission` reste en base, inerte : la formule équipe est
fermée, pas effacée.

## ⚠️⚠️ Deux défauts que le recadrage a mis à nu

**1. L'accès ne se serait jamais ouvert.** `ouvrir_les_acces_mission` sortait
en premier si la mission n'avait pas d'inventaire — un héritage du modèle où
l'on donnait accès à des inventoristes sur une session précise. Sans inventaire
créé d'office, la fenêtre ne se serait ouverte **jamais**, donc aucun appareil
en plus, jamais.

**2. La fenêtre durait une nuit, et on vend une semaine.** Elle valait
`début + durée estimée + 2 h` : le modèle de l'équipe qui vient un soir et
repart. La page de réservation promet pourtant « vous comptez quand vous voulez
dans cette semaine, autant de fois qu'il le faut ».

⚠️ Et elle partait du jour où **Quantinvo** appuie sur le bouton, pas du jour
choisi par le client : mesuré, une réservation du 20 octobre ouverte le 5 en
donnait **22**. Elle court maintenant de `debut_prevu` à `debut_prevu + 7 j`,
et ne s'ouvre pas avant la date — préparer ne demande aucun appareil, et ouvrir
la veille offrirait une journée qui n'a pas été vendue.

## La fenêtre se referme, et clôture

`cloturer_les_inventaires_hors_fenetre()`, planifiée **toutes les heures**
(`5 * * * *`). Une fenêtre se referme à l'heure près — sept jours après un
créneau qui est souvent 20:00 ou 22:00 ; une tâche nocturne laisserait
l'inventaire ouvert jusqu'au matin, et le client compterait dans un inventaire
qu'il croit encore à lui alors que ses appareils ont déjà disparu.

⚠️ **Clôturer, pas supprimer** : les comptages, le rapport et les écarts
restent — c'est ce que le client a payé. L'archivage vient un an plus tard, par
une autre fonction.

⚠️ **Et seulement ce qui est né dans la fenêtre** : la borne basse est
`acces_ouverts_le`, pas le magasin. Un inventaire d'avant la réservation ne la
regarde pas.

## Vérifié

- Réservation : **aucun inventaire créé**.
- Quatre transitions, puis fenêtre = **exactement 7 jours**, et **0 appareil
  tant que la date n'est pas venue**.
- Clôture : l'inventaire né dans la fenêtre passe à `closed` avec sa date ;
  celui né avant **ne bouge pas**.
- Quatre sabotages, quatre morsures : l'accès qui redemande un inventaire, la
  fenêtre ramenée à une nuit, la tâche qui archive au lieu de clôturer, la
  tâche passée en nocturne.
- Deux gardes remplacées — « un seul inventaire, et il naît avec la
  réservation » et « toujours par zones » — par celle de la décision qui les a
  renversées, le remplacement écrit dans son commentaire.
