# ⚠️ Un inventaire à la fois, celui qui paie, et une porte trop grande — 5 octobre 2026

Julien déroule le parcours de la location à voix haute, pour vérifier qu'il tient :

> « Je suis client, je réserve un inventaire, mon profil admin est créé, je peux
> donc créer mon équipe de superviseur + compteur, je peux créer mon inventaire,
> imprimer mes balises, arbitrer les écarts d'audit, extraire mon rapport, mon
> inventaire reste ouvert 7 jours et se clôture tout seul après, mais je peux
> tout de même le clôturer avant si je le veux. Et comme j'ai réservé pour un
> inventaire sur deux magasins, je peux n'avoir qu'une session d'inventaire à la
> fois par magasin. Et je suis facturé au bout de 7 jours automatiquement sur
> mon mode de paiement déjà renseigné avant l'inventaire. »

Tout était vrai sauf les deux dernières phrases. Le reste a été **joué**, pas
relu : `create_session` appelée au nom du compte d'essai rend `success: true`,
les deux fonctions d'invitation ne regardent ni offre ni abonnement, la fenêtre
dure sept jours pile et la tâche de clôture tourne à l'heure.

## 1. Ce qui n'existait pas

**« Un inventaire à la fois par magasin » : rien ne l'empêchait.**
`create_session` vérifie le rôle, l'entreprise et l'affectation du magasin —
jamais le nombre d'inventaires déjà ouverts. Dix sur le même magasin passaient.

**La facturation automatique : rien du tout.** Pas de carte demandée avant, pas
de vérification de validité, pas de prélèvement au septième jour. Il existe une
colonne `missions.stripe_payment_intent_id`, vide, que rien ne remplit : aucune
fonction edge ne connaît les missions, et la seule tâche planifiée est celle de
la clôture. Le chantier reste ouvert, et il dépend de Stripe en live — donc de
la publication sur les deux boutiques.

## 2. La règle du « un à la fois » ne vaut que pour les locations

C'est **son choix**, posé en connaissance de la contrepartie. La question lui a
été rendue parce qu'elle n'était pas technique : `create_session` est du
Quantinvo OS pur, appelée par l'application (`src/lib/queries.ts`) ET par le
site de tous les abonnés (`web/lib/inventory.ts`). Y glisser la règle l'aurait
imposée à Bon Marché.

> Un abonné paie un abonnement avec des appareils, pas « un inventaire ».

D'où `20261005170001` : un **déclencheur à côté**, et non une ligne dedans.
Contrepartie annoncée avant de choisir : le refus remonte en exception, donc à
l'écran avec son code technique entre crochets, au lieu du `{success:false,
error}` soigné que rendrait `create_session`.

### Ce qui désigne un magasin loué : la fenêtre

Deux fausses pistes écartées avant d'écrire la bonne.

**`plafond_appareils() is null`** rend `null` pour un magasin sans appareils
déclarés — mais aussi pour une entreprise au plan `standard`, qui n'est pas dans
sa liste de cas. S'en servir seul aurait plafonné un abonné. Le test reste, mais
pour une autre raison : **relâcher la règle le jour où le client s'abonne**.

**Énumérer les états morts** (`missions_etat_check` en compte seize) : inutile.
Dès qu'une mission tombe dans l'un d'eux, `missions_acces` appelle
`fermer_les_acces_mission`, qui pose `acces_expirent_le = least(coalesce(…,
now()), now())` — une date passée. La fenêtre dit déjà tout :

| `acces_expirent_le` | ce que c'est |
|---|---|
| `null` | réservée, pas encore ouverte : la préparation |
| `> now()` | la semaine court |
| `<= now()` | fini, quelle qu'en soit la raison |

Vérifié sur les deux réservations de la base d'essai : l'annulée porte bien une
date passée sans avoir jamais été ouverte.

### Mesuré, pas déduit

Sept situations, dans une transaction annulée, sur une entreprise et un magasin
créés **comme `reserver_ma_mission` les crée** (plan `standard`, aucun appareil
déclaré — donc `plafond_appareils` = `null`) :

| situation | issue |
|---|---|
| le premier inventaire du magasin loué | ACCEPTÉ |
| un second pendant que le premier est ouvert | **REFUSÉ** |
| un autre après avoir clôturé le premier | ACCEPTÉ |
| deux ouverts sur un magasin jamais loué (OS) | ACCEPTÉ |
| un second après abonnement (`devices = 20`) | ACCEPTÉ |
| un second après la fin de la fenêtre | ACCEPTÉ |

## 3. Celui qui paie devient le client

Le cas soumis à Julien : un pro déjà connu de Quantinvo comme **compteur** chez
un de ses clients, qui loue à son tour pour son propre inventaire. Sa
réservation partait au nom de l'entreprise qui l'avait invité, puis
`create_session` lui répondait « Accès refusé » — elle exige le rôle
superviseur. **Argent pris, inventaire impossible.**

> « C'est le compte client que l'on garde, celui qui a payé, pas celui qui
> participe à un inventaire. »

Une ligne dans `reserver_ma_mission` (`20261005180001`) : le rôle est lu, et un
compteur voit son entreprise remise à zéro — ce qui rouvre l'embranchement qui
existait déjà et le fait superviseur + administrateur de la sienne. Rien à
effacer de son côté participant : `is_session_participant` exige
`s.company_id = get_my_company()`, donc ses anciennes participations ne lui
montrent plus rien.

### ⚠️⚠️ Le rôle s'écrit `employee`, pas `counter`

Première version écrite avec `counter` — le vocabulaire de
`session_members.role` et de `session_invitations.role`, **pas celui de
`profiles`**, dont `profiles_role_check` ne connaît que `supervisor` et
`employee` depuis le schéma initial. La règle compilait, s'appliquait, et ne
mordait **jamais**.

Rien dans le code ne le disait. C'est la base qui l'a dit, en refusant le
`update` de préparation du contrôle. **Lire le code ne l'aurait pas trouvé ; le
jouer l'a trouvé en une fois.**

La garde déduit donc maintenant le rôle de la contrainte du schéma initial, et
mord sur `counter` comme sur `supervisor`.

Joué en entier ensuite, dans une transaction annulée :

```
RÉSERVATION  → true, entreprise créée : true
AVANT        → rôle employee,  admin false, entreprise « Essai On-Demand »
APRÈS        → rôle supervisor, admin true,  entreprise « Cabinet du pro »
LA LOCATION  → au nom de « Cabinet du pro », magasin Chez son client
SON INVENTAIRE → true
```

## 4. ⚠️⚠️ La porte des missions était trop grande — et c'est moi qui l'ai ouverte

Le 4 octobre, pour réparer un « permission denied for table missions », j'avais
écrit dans `20261004180001` :

```sql
grant select on public.missions to authenticated;
```

**Un `grant select` sans liste de colonnes porte sur TOUTES les colonnes, et il
supersède le grant nominatif posé la veille.** Le client qui ouvrait « Vos
inventaires » lisait donc aussi `cout_cents` (ce que la location nous coûte),
`calcul` (le détail, dont la rémunération d'une équipe), `reglages_version` et
`stripe_payment_intent_id`. Mesuré : `information_schema.column_privileges`
rendait les 47 colonnes.

La migration du 20 septembre disait pourtant l'intention mot pour mot :

> « le client qui lit sa mission lirait aussi ce qu'elle nous coûte, ce que
> touche chaque inventoriste et quelle marge nous prenons. "Le prix affiché est
> le prix payé" est une promesse sur le montant, pas l'ouverture de la
> comptabilité. »

**Aucune exposition réelle** : On-Demand n'est pas en production. Le défaut n'a
vécu qu'un jour, sur la base d'essai. `20261005190001` referme la porte : les
quatre colonnes de comptabilité sont de nouveau hors de portée, et les 44 autres
restent lisibles — dont les deux nées depuis, `appareils` et `formule`.

### Ce qui l'a vu, et ce qui ne l'a pas vu

Ni la garde de séparation, ni l'analyseur de sécurité de Supabase : **un grant
trop large n'est pas un défaut de RLS**. C'est un SCÉNARIO de la réplique qui a
répondu `1900` à la question « CLIENT NON ABONNÉ — ne voit PAS ce qu'elle nous
coûte ».

Et il ne posait plus la question **depuis un jour**, parce qu'il mourait seize
lignes plus haut sur une transition devenue interdite. Un scénario qui s'arrête
tôt ne dit pas qu'il ne mesure plus.

La garde rejoue désormais tous les `grant`/`revoke` de `missions` **dans l'ordre
des fichiers** — c'est le seul moyen de connaître le droit effectif, trois
migrations parlant de cette table. Elle refuse un droit sur la table entière,
refuse une liste qui énumérerait les 47 colonnes, et exige que les colonnes
nommées par `web/lib/onDemandClient.ts` soient toutes dans le droit.

## 5. La garde du déclencheur : de « jamais » à « déclaré et retirable »

`on-demand-separation.test.ts` interdisait tout net un déclencheur sur une table
de Quantinvo OS. Un « jamais » absolu, ici, aurait poussé la règle **dans**
`create_session` — exactement le contraire de ce que la garde protège. C'est la
leçon déjà écrite deux portes plus haut dans le même fichier : ce qui protège
n'est pas l'interdiction, c'est que la migration l'annonce et sache se défaire.

Reste interdit, et c'est l'essentiel : un déclencheur posé **en silence**.

Et la garde **déduit** maintenant les tables d'OS au lieu d'en citer sept. Sept
sur la centaine qu'OS possède : un déclencheur sur `articles`, `counts_audit` ou
`store_supervisors` passait sans rien dire. Saboté : il est attrapé.

## 6. Quatre défauts dans les outils de vérification

Trouvés en faisant tourner la réplique sur les migrations d'octobre, ce qui
n'avait jamais été fait (le motif par défaut s'arrête à septembre).

**La tâche horaire n'était pas dans le retrait.**
`cloturer_les_inventaires_hors_fenetre` ÉCRIT dans `inventory_sessions` toutes
les heures : laissée programmée après un retrait d'On-Demand, elle échoue chaque
heure sur une table `missions` disparue — exactement ce que `90-retirer.sql`
existe pour empêcher. Oubli de ma migration de la veille.

**Un `and` au lieu de deux `if` imbriqués.** Écrit
`if exists(pg_namespace…) and exists(cron.job…)` : PL/pgSQL prépare
l'expression **entière** comme une seule requête SQL, donc `cron.job` est résolu
même quand le premier membre est faux. Un court-circuit de langage ne protège
pas d'une analyse de requête. Même correction appliquée à la migration qui
programme la tâche, pour qu'elle se rejoue sur une base sans `pg_cron`.

**L'installation de la réplique avalait ses échecs.** Elle écrivait
`q replique -f "$f" 2>&1 | grep -vi notice || true`. Quand `10-donnees.sql` est
mort sur une clé dupliquée à la ligne 29, le contrôle a continué **sans
inventaire, sans zones et sans comptages** — et c'est un scénario, trois écrans
plus loin, qui l'a trahi par une clé étrangère. Règle du dépôt : ne jamais
filtrer la sortie d'un contrôle. Même chose pour la boucle de réapplication, qui
envoyait `2>&1` vers `/dev/null`.

**Un libellé qui récitait un chiffre.** `40-ondemand.sql` affirmait
« (20 d'abonnement + 7 de mission) » en dur pendant que la mesure juste à côté
rendait `20`. Vrai le jour où il a été écrit, faux depuis que
`plafond_mission_en_cours` exige un état avancé ET une fenêtre ouverte. Les deux
parts se calculent maintenant.

## 7. Ce que la réplique sait faire de plus

Le socle modélise Quantinvo OS, et il lui manquait **le** chemin par lequel un
client d'On-Demand crée désormais son inventaire : `create_session` et le
déclencheur `sync_company_admin_stores` qui l'affecte à son magasin. Sans eux,
`50-sans-abonnement.sql` ne mesurait rien de ce parcours.

Ce scénario déroulait d'ailleurs encore la formule ÉQUIPE — `confirmee →
en_constitution`, une équipe constituée, un inventoriste qui vient compter.
Réécrit sur ce qu'On-Demand est aujourd'hui, il rend :

```
RÉSERVATION — sans compte ni entreprise préexistants     : 12900
L'entreprise créée a-t-elle un abonnement ?              : plan=standard abonnement=aucun
A-t-elle le droit Quantinvo OS ?                         : AUCUN — non abonnée
A-t-elle le droit On-Demand ?                            : actif
Le magasin a-t-il des appareils déclarés ?               : aucun
La fenêtre d'accès s'est-elle ouverte ?                  : 7 jours
Le plafond d'appareils AVANT la date choisie             : 2 (dont 0 de location)
— et PENDANT la fenêtre, la date venue                   : 8 (dont 6 de location)
CLIENT NON ABONNÉ — crée son inventaire                  : true
— et un SECOND sur le même magasin                       : REFUSÉ (Un inventaire est déjà ouvert…)
— puis un autre, APRÈS avoir clôturé                     : true
CLIENT NON ABONNÉ — compte dans son inventaire           : 1
CLIENT NON ABONNÉ — voit ses inventaires                 : 2
CLIENT NON ABONNÉ — voit sa réservation et son prix      : 12900
CLIENT NON ABONNÉ — ne voit PAS ce qu'elle nous coûte    : REFUSÉ (permission denied)
```

Les 29 migrations du chantier se rejouent, Quantinvo OS se comporte à
l'identique avant et après, et il revient exactement à son état d'avant une fois
On-Demand retiré.

## 8. Les gardes, et leurs sabotages

Seize sabotages, seize morsures. Les plus utiles :

- la règle cite un état de mission → mord
- l'ordre des tests inversé (le test « a-t-il loué ? » ne sort plus en premier) → mord
- plus de relâche pour l'abonné → mord
- la règle écrit ou efface au lieu de refuser → mord
- le marqueur `TOUCHE QUANTINVO OS` retiré de l'en-tête → mord
- le déclencheur absent de `90-retirer.sql` → mord
- un déclencheur muet sur `articles`, hors des sept tables citées autrefois → mord
- `pg_cron` redevient obligatoire → mord
- le rôle redevient `counter`, ou vise `supervisor` → mord
- le droit redevient la table entière → mord
- la liste énumère les 47 colonnes → mord
- une colonne que le client lit retirée du droit → mord
- la traduction anglaise du refus retirée → mord

Et la garde i18n lit désormais aussi les `raise exception` des migrations : une
exception remonte à l'écran par `errorMessage()`, qui traduit à la lecture comme
pour un `'error'`, mais la garde ne les lisait pas. Les vingt messages littéraux
déjà écrits étaient tous traduits — elle est passée verte du premier coup, et
c'est la **prochaine** qu'elle attrape.

## Ce qui reste ouvert

- **La facturation** : rien n'existe (§1). Dépend de Stripe en live.
- **L'inscription d'un client neuf** passe par la fonction edge `inscription`,
  donc par `VENTE_OUVERTE`, fermé tant que `web/lib/legal.ts` est incomplet. Et
  cette fonction répond « vous avez déjà un compte » à une adresse connue : le
  pro qui revient comme client par ce chemin-là n'arrive pas jusqu'à
  `reserver_ma_mission`. La règle du §3 couvre le compte déjà connecté, pas
  l'inscription.
- `scripts/replique/verifier.sh` ne peut pas rejouer les migrations d'OS
  d'octobre : son socle ne modélise pas `team_invitations`. Le motif passé à la
  main contourne, il ne corrige pas.
