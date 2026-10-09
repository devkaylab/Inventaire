# ⚠️⚠️ Le rôle sur un inventaire ne se choisit plus : il se calcule — 9 octobre 2026

Julien :

> « Ajouter une personne à son inventaire, je vois que l'on peut choisir si c'est
> un compteur ou un co-superviseur. Sauf que normalement un compteur ne peut pas
> être superviseur. En base je pense que c'est bon mais la sélection est toujours
> présente, il faut l'enlever sur l'application et sur le site. Ajouter un
> compteur = compteur, ajouter un superviseur = co-superviseur. Ajouter l'admin à
> son inventaire = co-superviseur. »

## ⚠️⚠️ « En base je pense que c'est bon » : non, et c'est tout l'enjeu

`invite-to-session` lisait le rôle **dans le corps de la requête** :

```ts
const role: Role = payload.role === 'supervisor' ? 'supervisor' : 'counter'
```

puis l'écrivait dans `session_members` avec la **clé de service**, donc hors RLS.
Autrement dit : **l'appelant choisissait**. Un appel direct à l'API faisait d'un
compteur un co-superviseur d'inventaire, et la seule garde côté serveur était
`is_session_participant` — qui, par ailleurs, ouvre tout inventaire de
l'entreprise à son administrateur.

**Retirer le sélecteur des écrans aurait donc caché le défaut sans le fermer.**
Une porte fermée à l'écran seulement s'ouvre avec une adresse.

D'où l'ordre des choses : la règle d'abord en base, les écrans ensuite.

## La règle, à un seul endroit

```sql
role_de_session(p_user) =
  case when profiles.role = 'supervisor' or profiles.is_company_admin
       then 'supervisor' else 'counter' end
```

Et un déclencheur `before insert OR UPDATE` sur `session_members` qui l'impose.

⚠️ **`or update` N'EST PAS DÉCORATIF** : `invite-to-session` fait un `upsert`,
donc une ligne existante passe par UPDATE. Sans lui, la porte restait ouverte à
une seconde invitation de la même personne. Le banc l'ouvre exprès.

⚠️ **LE DÉCLENCHEUR ÉCRASE, IL NE REFUSE PAS**, et c'est voulu : lever une
exception obligerait chaque appelant à connaître la règle pour ne pas tomber
dessus, donc à la recopier, donc à en diverger. Écraser veut dire « envoyez ce
que vous voulez, la base décide » — c'est ce qui permet aux écrans de **cesser
d'envoyer un rôle**.

⚠️ **`is_company_admin` est dans la règle bien qu'il soit redondant aujourd'hui**
(`admin_promouvoir_admin_entreprise` passe déjà le rôle à `supervisor`). Mais
c'est une coïncidence d'implémentation, pas la demande : Julien a dit « ajouter
l'admin = co-superviseur ». Si un administrateur reste `employee` un jour, la
règle tient quand même.

## Une promotion d'entreprise entraîne les inventaires

Sans ça, la règle serait vraie à l'ajout et fausse ensuite : un compteur promu
superviseur resterait « compteur » dans les inventaires où il est déjà — la même
incohérence, dans l'autre sens. `ca_set_user_role` fait donc suivre, en une
instruction, et le déclencheur recalcule.

## ⚠️ Trouvé au passage : le CRÉATEUR était enregistré compteur

`create_session` insère `(session_id, user_id)` **sans rôle**, et le défaut de la
colonne est `'counter'`. Une migration du 7 août 2026 avait corrigé les lignes
existantes (`where s.created_by = sm.user_id and sm.role <> 'supervisor'`)
**sans corriger la fonction** : le défaut revenait donc à chaque inventaire créé
depuis. Mesuré sur le jumeau avant correction — le seul membre, qui était le
créateur, superviseur et administrateur, portait `counter`.

⚠️ Et ça **n'accorde rien** : vérifié sur la base réelle, **aucune policy ni
fonction n'accorde quoi que ce soit sur `session_members.role = 'supervisor'`**.
Ce rôle est un libellé, pas un droit. Ce qui ouvre un inventaire, c'est
`is_session_participant`.

## Ce que les écrans font maintenant

Les deux — `src/app/(supervisor)/[sessionId]/invite.tsx` et
`web/components/dashboard/AddSessionMember.tsx` — affichent un **constat**, pas
un réglage :

- il n'apparaît **qu'une fois quelqu'un choisi**, parce qu'avant il n'y a rien à
  constater ;
- il lit `selected.role` / `choisi.role`, **l'annuaire** — la même source que la
  base, jamais une seconde règle ;
- le message de succès lit le rôle **que la fonction edge renvoie**, lui-même
  relu de `session_members` après écriture. Le recalculer en TypeScript ferait
  deux règles, qui divergeraient à la première correction.

Partis avec : le composant `RolePill`, ses styles `pill*`, le `<select>` du site,
les deux `SessionRole` devenus inutiles. **Un style orphelin survit à la
fonctionnalité qu'il habillait et finit par la ressusciter.**

## Ce qui a été mesuré

`scripts/replique/71-le-role-ne-se-choisit-plus.sql` — et le point du banc est
qu'**on envoie exprès le mauvais rôle à chaque fois** :

| | |
|---|---|
| la règle seule : admin / superviseur / compteur / sans profil | `supervisor` / `supervisor` / `counter` / `null` |
| le créateur, après création | **`supervisor`** (c'était `counter`) |
| compteur ajouté en demandant « supervisor » | **`counter`** |
| admin ajouté en demandant « counter » | **`supervisor`** |
| compteur promu par un `UPDATE` direct | **`counter`** |
| — et par un `upsert`, comme la fonction edge | **`counter`** |

Puis, **sur la vraie base d'essai**, dans un bloc `do` terminé par un `raise
exception` (donc rien d'écrit), la chaîne complète que la réplique ne pouvait pas
jouer — son socle n'a ni `store_team` ni `ca_set_user_role` :

| | |
|---|---|
| profil créé par l'invitation | `employee` |
| ajouté en demandant `supervisor` | **`counter`** |
| promotion par `ca_set_user_role` | succès |
| rôle d'entreprise → rôle dans l'inventaire | `supervisor` → **`supervisor`** |
| rétrogradation → rôle dans l'inventaire | `employee` → **`counter`** |

Et le banc complet : **34 migrations rejouées, parcours de Quantinvo OS
identiques avant/après, retrait propre.**

## ⚠️⚠️ Une garde du 5 octobre gelait le sélecteur — troisième fois

`tests/compte.test.ts` exigeait, mot pour mot :

```ts
expect(code).toMatch(/active=\{role === 'supervisor'\}/)
```

Elle avait été écrite quatre jours plus tôt pour montrer que l'écran savait
ajouter un superviseur (fiche 119) — et elle **gelait le choix du rôle**, c'est-à-
dire précisément ce que Julien fait retirer. Remplacée par une garde qui tient ce
qu'elle voulait vraiment dire : la recherche n'est pas cachée aux superviseurs,
**et** aucun écran ne rouvre le choix.

⚠️ Deux autres gardes ont dû suivre, et les trois tombaient sur du code juste :
celle qui citait `role: 'counter'` dans l'appel, et les deux de séparation OS —
qui avaient raison : cette migration **touche Quantinvo OS** (elle remplace
`ca_set_user_role` et pose un déclencheur sur `session_members`), donc elle le
dit en tête et le retrait la connaît.

⚠️ **ET `role_de_session` N'EST PAS SUPPRIMÉE PAR LE RETRAIT**, délibérément :
`ca_set_user_role`, une fonction d'OS, l'appelle. La supprimer referait le piège
de `prendre_place_appareil` — une fonction d'OS qui appelle une fonction
disparue, et un changement de rôle qui échoue **pour tout le monde**. Une garde
tient ce « ne pas supprimer ».

## Quatorze sabotages, quatorze gardes qui mordent

Et **deux gardes resserrées parce qu'elles rataient la même chose écrite
autrement** :

- `not.toMatch(/payload\.role/)` restait verte face à
  `(payload as { role?: string }).role`. Ce qui ne se contourne pas, c'est le
  **type** du corps de requête : si `role` n'y est pas déclaré, il n'y a rien à
  lire. La garde lit donc le type, et exige en plus que **toute** liaison de
  `role` dans le fichier vienne de la réponse de la base.
- Le premier sabotage de l'écran n'enlevait qu'une des deux occurrences du
  constat. Rejoué en les enlevant toutes : la garde mord.

## ⚠️ Ce qui n'est pas vérifié

**L'écran connecté du site n'a pas été regardé.** La préversion de la branche
renvoie vers la connexion dans un onglet neuf, et je ne me connecte pas au compte
de Julien. Ce qui est tenu à sa place : les types, le lint, 1 754 gardes côté
site, 552 côté app, et une garde qui exige que le `<option>` de rôle ait disparu
du gabarit. Reste à poser l'œil dessus.

**Et rien n'est en production** : la migration est appliquée **au jumeau
seulement**, et l'app publiée garde son sélecteur jusqu'à la mise à jour unique.
C'est le plan de la fiche 109 — tout s'accumule sur `on-demand` jusqu'au jour J.
