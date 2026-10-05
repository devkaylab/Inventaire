# ⚠️⚠️ Ajouter quelqu'un à un inventaire — 5 octobre 2026

> « Pourquoi quand je rajoute Théo à mon inventaire Beauté 051026, je ne le vois
> pas dans mon équipe et pourtant il a bien l'inventaire de son côté ? C'est
> parce qu'il est admin et qu'il n'a pas besoin d'être invité ? »

Sa question portait **deux** défauts, et sa réponse était à moitié juste.

## 1. Pourquoi Théo voit l'inventaire : oui, son statut d'admin

`is_session_participant` ouvre à trois titres : créateur, **administrateur
d'entreprise**, ou membre invité. Théo passe par le deuxième. Il n'a pas besoin
d'être ajouté pour voir, compter, arbitrer et clôturer.

## 2. Mais il n'avait pas été ajouté

Relevé sur la production : l'inventaire avait **un seul membre, Julien**, et
aucune invitation en attente. Théo n'était membre d'aucun inventaire, jamais.

Les journaux disent ce qui s'est passé. À 14 h 22, sept minutes après la
création de l'inventaire, un appel à **`invite-teammate`** — « créer un
équipier » — et pas à `invite-to-session`. Réponse 200, et rien de créé.

⚠️ **Déduction, pas supposition** : les quatre refus de `invite-teammate`
répondent 200 sans rien écrire, mais trois supposent un compte dans une AUTRE
entreprise ou une invitation en attente. Théo a un profil dans la MÊME
entreprise : la première branche l'emporte. C'est donc `already_in_team` —
« Cette personne fait déjà partie de votre équipe. »

Un message vrai, et trompeur ici : il ne dit pas que l'ajout à l'inventaire n'a
pas eu lieu.

## 3. ⚠️⚠️ Pourquoi il n'a pas pu faire le bon geste : l'app cachait la recherche

Capture à l'appui : « You have no team yet », le formulaire de création, et
**aucune barre de recherche**. La règle de l'écran :

```js
const equipeVide = directory !== undefined
  && directory.filter(d => d.user_id !== profile?.id && d.role !== 'supervisor').length === 0
```

On retire soi-même **et tous les superviseurs**. L'annuaire de La Samaritaine,
c'est Julien et Théo, **tous deux superviseurs**. Après les deux filtres :
personne. Donc « pas encore d'équipe », et `{!equipeVide && (<recherche>)}` la
cache.

L'auteur voulait s'exclure lui-même — son commentaire le dit : « l'annuaire
contient toujours au moins le superviseur lui-même, d'où le filtre sur les
compteurs ». Mais le test juste avant l'exclut déjà par son identifiant. Le
filtre sur le rôle était en trop, et il emportait tous les autres.

**Conséquence** : une entreprise dont l'équipe n'est faite que de superviseurs
ne peut ajouter personne à un inventaire depuis l'app. Jamais.

L'écran se contredisait lui-même : il propose un rôle « Co-superviseur » pour la
personne à ajouter. Il sait qu'on ajoute des superviseurs, et il cachait la
recherche qui le permet.

### ⚠️ Et une garde exigeait le défaut

`tests/compte.test.ts` demandait littéralement `d.role !== 'supervisor'` dans la
règle, sans dire pourquoi. Elle figeait une **ligne**, pas une décision — et
c'est exactement ce contre quoi la discipline du dépôt existe. Remplacée par une
garde qui porte la décision : on ne retire que soi.

## 4. Le site : l'échec de chargement était muet

Julien : « même sur le site quand je saisis Théo il n'apparaît pas », puis
« il apparaît maintenant, possible problème de réseau ». C'en était un — et le
vrai défaut est qu'on ne pouvait pas le savoir :

```js
getStoreDirectory(storeId)
  .then(rows => setAnnuaire(rows))
  .catch(() => setAnnuaire([]))     // ← l'échec devient une équipe vide
```

L'écran répondait alors « personne de l'équipe de ce magasin ne correspond ».
**Une coupure réseau et une équipe vide se ressemblaient exactement.**

Trois états maintenant — `chargement`, `pret`, `echec` — une phrase qui dit
laquelle des deux situations c'est, et un lien pour réessayer. « Rien trouvé »
ne s'affiche plus que si la liste est vraiment arrivée.

## Les gardes, et leurs sabotages

Cinq morsures :

- l'app recache la recherche aux superviseurs → mord
- l'app ne retire plus personne, même pas soi → mord
- le site ravale l'échec de chargement → mord
- le site dit « rien trouvé » sans avoir la liste → mord
- le message n'offre plus de réessayer → mord

⚠️ La garde de l'app lit le code **sans ses commentaires** : celui de l'écran
raconte le défaut, donc il cite la ligne qu'on interdit. Septième fois que ce
piège se présente sur ce dépôt.

## Ce qui reste à faire

⚠️ **L'app est publiée.** La correction ne part qu'avec un build, et le
déclenchement appartient à Julien. D'ici là, sur l'app, l'ajout reste
impossible quand l'équipe n'est faite que de superviseurs — le contournement est
le site, où la recherche a toujours fonctionné.

Le site, lui, part au push.

## Une piste pas suivie

Le message `already_in_team` pourrait dire « … mais pas encore à cet inventaire :
choisissez-la dans la liste ». Proposé, pas fait : la cause première était la
recherche cachée, et une phrase de plus n'aurait pas rendu le geste possible.
