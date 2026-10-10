# On-Demand a son propre projet Supabase — 4 octobre 2026

**Projet `Quantinvo On-Demand`**, ref `lqgusznqcunjhrqslcug`, région `eu-west-1`
(la même que Quantinvo), organisation Devkaylab. **10 $/mois, permanent.**
⚠️ Le Spend Cap de l'organisation est actif : un dépassement bascule TOUTE
l'organisation en lecture seule, Quantinvo compris.

## ⚠️ Le dossier de migrations ne se rejoue PAS depuis zéro

C'est la découverte de la journée, et elle contredit une idée reçue : « le
dossier décrit la base » (note 067, 0 dérive mesurée) ne veut **pas** dire « le
dossier reconstruit la base ». Les deux se mesurent différemment, et seul le
premier a jamais été vérifié.

Le rejeu des 198 fichiers dans l'ordre des noms **s'arrête au 5ᵉ** :
`20260619000003_articles_ean_norm.sql` crée un index sur
`articles(session_id, ean_norm)` alors que la colonne `session_id` n'arrive que
plus tard dans l'ordre alphabétique. L'ordre des noms n'est pas l'ordre dans
lequel l'histoire s'est écrite.

**À retenir** : pour fabriquer une base jumelle, on **copie le schéma**, on ne
rejoue pas le dossier.

## Comment le jumeau a été fabriqué

```
supabase db dump --linked --dry-run --yes      # rend un script bash
bash ce-script > schema.sql                    # pg_dump --schema-only, 607 Ko
supabase db query --linked --project-ref lqgusznqcunjhrqslcug --file schema.sql
```

- `db dump --linked` **a besoin de Docker**, absent de ce Mac. D'où le
  `--dry-run`, qui imprime le script `pg_dump` que la CLI aurait exécuté : il
  crée un rôle de connexion temporaire, donc **aucun mot de passe à connaître**.
  `pg_dump` 17.11 est installé localement (Homebrew).
- `db query --project-ref` **exige `--linked`** avec lui, sinon la CLI refuse.
  Les deux ensemble visent bien l'autre projet, pas le projet lié.
- ⚠️ Le schéma `public` a dû être **remis à zéro** avant : les 4 migrations du
  rejeu avorté avaient laissé des tables, et le dump utilise
  `create table if not exists` — les tables existantes étaient sautées, et les
  index posés ensuite tombaient sur des colonnes manquantes.

## Mesuré : jumeau exact

Six empreintes `md5` comparées entre les deux bases — **toutes identiques** :

| | production | On-Demand |
|---|---|---|
| colonnes (412) | `9c9483a4…` | `9c9483a4…` |
| fonctions + droits (236) | `71b677d2…` | `71b677d2…` |
| policies (55) | `ca261ff9…` | `ca261ff9…` |
| index (93) | `ff7c5c91…` | `ff7c5c91…` |
| triggers (9) | `6e6215d6…` | `6e6215d6…` |
| contraintes | `e90708ba…` | `e90708ba…` |

44 tables, RLS active sur les 44. `get_advisors(security)` rend **exactement
les mêmes quatre catégories** des deux côtés.

**Une seule différence au premier passage** : `get_zone_dashboard` avait perdu
trois lignes de commentaire, que le `sed` de la CLI retire. Reposée depuis la
définition de production, droits compris (`create or replace` rend EXECUTE à
PUBLIC — voir AGENTS.md).

**Aucune donnée** : 0 entreprise, 0 magasin, 0 profil, 0 compte `auth.users`.
Le dump est `--schema-only`.

## ⚠️ Un écart VOULU avec la production, depuis le 4 octobre au soir

Le jumeau n'en est plus tout à fait un, et c'est la raison d'être de ce
projet : `20260928120001_la_grille_a_deux_axes.sql` y est **appliquée**, et
pas en production.

Mesuré après coup : `prix_mission` rend désormais un prix de **tranche** côté
essai — 30 000 articles → **145 €**, 9 appareils imposés, version 2 — là où la
production garde l'ancien « coût + marge ». Le site calculait déjà la nouvelle
grille dans le navigateur ; les deux concordent enfin, côté essai.

⚠️ Ne pas lire une future mesure de dérive comme un accident : **cet écart-là
est volontaire**, et c'est le seul.

## ⚠️ Ce que le dump NE COPIE PAS — et qui se voit tard

`pg_dump --schema public` ne sort QUE `public`. Trois objets vitaux vivent
ailleurs, et leur absence ne se remarque qu'au premier compte créé :

- ⚠️ **Les trois déclencheurs sur `auth.users`** — `on_auth_user_created`
  (`handle_new_user`, qui crée le profil), `on_auth_user_deleted`
  (`anonymize_on_user_delete`) et `auth_users_notifier_premiere_connexion`.
  Leurs FONCTIONS sont dans `public`, donc copiées ; **les déclencheurs, non**.
  Sans eux, un compte se crée sans profil, et rien ne le dit. Reposés le
  4 octobre depuis `pg_get_triggerdef` de la production.
- **Les deux tâches `pg_cron`** (`alerte-paiement-sans-suite` horaire,
  `purge-donnees-expirees` à 3 h 15) : **volontairement PAS reposées**. Elles
  appellent des fonctions edge qui n'existent pas ici — elles échoueraient
  toutes les heures pour rien.
- **Les 20 fonctions edge** : le dépôt ne déploie rien (AGENTS.md). À pousser à
  la main, avec leurs secrets, si un parcours testé en a besoin. La connexion,
  elle, passe par `auth` et n'en dépend pas.
- **Aucun réglage d'authentification** n'a été recopié (gabarits d'e-mail,
  redirections). À faire le jour où un parcours d'invitation sera testé.

Vérifié par ailleurs : schémas, extensions et fonctions hors `public`
(78 des deux côtés) sont identiques.

## Le compte de test

`test.ondemand@quantinvo.com` — mot de passe dans la mémoire locale, hors
dépôt. Il est **admin Quantinvo, admin d'entreprise et superviseur** à la
fois, rattaché à l'entreprise « Essai On-Demand » et au « Magasin d'essai »
(**50 appareils**, les deux marqués `est_test`).

⚠️ **50 appareils, et ce n'est pas décoratif** : un magasin dont `devices` est
vide est plafonné à **2** depuis On-Demand, et le troisième téléphone se ferait
refuser le jour du test.

Connexion **éprouvée pour de vrai** contre `/auth/v1/token` : jeton rendu,
e-mail confirmé. Pas seulement « la requête a réussi ».

⚠️ Le premier compte d'une base vide passe par la branche de bascule de
`handle_new_user` — `if not exists (select 1 from public.profiles)` — et
devient superviseur sans entreprise. Tout le reste (entreprise, magasin,
droits) a été posé après, dans la même transaction.

## L'aperçu est branché — et deux pièges Vercel au passage

Fait le jour même, dans la console Vercel. **Deux choses que personne
n'aurait devinées :**

1. ⚠️ **La variable de la clé en Preview s'appelait
   `EXT_PUBLIC_SUPABASE_ANON_KEY`** — il manquait le `N`. Elle n'a donc
   jamais été lue par quoi que ce soit, et c'est pour ça que l'aperçu tournait
   sur la clé de production : `envAnonKey` était vide, et le repli prenait la
   main. Le défaut vivait là depuis le 12 août.
2. ⚠️ **Vercel refuse désormais qu'une variable `NEXT_PUBLIC_*` soit de type
   « Secret »**, et un Secret ne peut plus être converti en « Config » : il est
   en écriture seule, donc illisible, donc impossible à reprendre. Les anciennes
   ont dû être **supprimées puis recréées en Config**. Leurs valeurs d'origine
   sont perdues — elles pointaient sur la production, mesuré dans le bundle.

État posé, **portée Preview uniquement, type Config** :

```
NEXT_PUBLIC_SUPABASE_URL      = https://lqgusznqcunjhrqslcug.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_ISjK0RBpXaogcU7fKrtJFw_GfNUbfx1
```

La production n'a pas été touchée : ses deux variables du 4 août sont
intactes.

## Mesuré après redéploiement

Les deux bundles servis, comptés script par script :

| | réf. On-Demand | réf. production |
|---|---|---|
| `quantinvo-git-on-demand…vercel.app` | **1** | **0** |
| `www.quantinvo.com` | **0** | **1** |

La séparation est donc effective, et dans les deux sens. Le formulaire de
connexion de la production répond normalement ; l'aperçu démarre sans
l'écran d'arrêt de la note 108, ce qui prouve au passage que les deux
variables sont bien lues.

⚠️ Le repli écrit en dur **disparaît du bundle** quand les variables existent :
`process.env.X || FALLBACK` se résout à la construction, et le minifieur jette
la branche morte. Zéro occurrence de la production dans l'aperçu ne veut donc
pas dire que le repli a été retiré du code — il est toujours là, pour la
production.

## ⚠️⚠️ « Une copie de Quantinvo + On-Demand » ? Non : une copie de la PRODUCTION, qui porte déjà On-Demand

Question de Julien, le 9 octobre 2026. La formule paraît juste et elle cache
l'essentiel : le jumeau n'a pas été fabriqué en empilant On-Demand sur un
Quantinvo propre. **Il a été fabriqué en copiant la production — et la
production portait déjà tout le schéma On-Demand**, 196 objets dont les
migrations ne vivent que sur la branche `on-demand`, appliqués pendant le
chantier de septembre (mesuré le 4 octobre, `scripts/mesurer-migrations.mjs`).

Donc : `jumeau = production`, et `production = Quantinvo + On-Demand`. Les deux
bases portent le même schéma ; ce qui les sépare n'est pas le schéma.

⚠️ **ET LE PONT EST VIVANT EN PRODUCTION.**
`20260920200001_on_demand_le_plafond_d_appareils.sql` — la seule migration qui
remplace une fonction de Quantinvo OS — **est appliquée en production** :
`prendre_place_appareil` y appelle `plafond_appareils_effectif`. Conséquence qui
ne se devine pas : un magasin dont `devices` n'est pas renseigné est **plafonné
à deux appareils**, là où `null` voulait dire « ne rien refuser ». Voir la
mémoire du projet ; ça a failli coûter le pilote du Groupe Bon Marché.

## L'état du jumeau au 9 octobre 2026

| | à la copie (4 oct.) | aujourd'hui | écart |
|---|---|---|---|
| tables | 44 | **45** | +1 |
| colonnes | 412 | **436** | +24 |
| fonctions | 236 | **248** | +12 |
| policies | 55 | **56** | +1 |
| index | 93 | **96** | +3 |
| déclencheurs | 9 | **10** | +1 |

RLS active sur les 45. L'écart, ce sont les migrations d'On-Demand des 4, 5 et
7 octobre — appliquées **au jumeau seulement** : la fenêtre d'accès, le prix
validé, un inventaire à la fois, et le chemin du paiement (fiche 122).

## ⚠️ Ce qui N'EST PAS copié, et c'est ce qui rend le jumeau inoffensif

- **Aucune fonction edge.** Vérifié le 9 octobre : `list_edge_functions` rend
  une liste **vide**. La production en porte vingt et une. Donc sur le jumeau,
  aucune invitation, aucun courriel, aucun appel à Stripe ne peut partir — même
  si une fonction en base essayait de les déclencher.
- **Le coffre est vide.** Zéro secret : ni clé Stripe, ni clé Resend, ni
  `prelevement_cle`. C'est ce qui rend `declencher_le_prelevement()` inerte, et
  ce n'est pas une précaution de plus — c'est la MÊME précaution, écrite une
  fois dans la fonction (« tant que les valeurs sont absentes, rien ne part »).
- **Les données.** Un compte, une entreprise, un inventaire, deux réservations.
  Aucune donnée réelle, jamais.
- **Les tâches planifiées.** Deux sur le jumeau, les deux d'On-Demand
  (`cloturer-hors-fenetre`, `prelever-les-locations`). La production a les
  siennes, qui n'existent pas ici.

⚠️ Et dans les deux sens : **le dossier de migrations ne reconstruit NI l'une NI
l'autre depuis zéro** (voir plus haut). Pour refaire un jumeau, on recopie le
schéma.

## Peut-on continuer sur le jumeau et ne livrer l'app qu'une fois ?

Question de Julien, le 9 octobre 2026 : « savoir si on peut faire d'autres
modifs sur le projet sans affecter le projet initial Quantinvo. Comme ça une
fois On-Demand clôturé et les autres modifs faites, on lance une seule mise à
jour de l'app. »

**Oui. Et pour deux des trois morceaux, c'est déjà le cas.**

| | isolé ? | pourquoi |
|---|---|---|
| **La base** | ✅ oui | deux projets Supabase sans lien. Ce qu'on applique au jumeau ne touche rien. |
| **Le site** | ✅ oui | `main` déploie `www.quantinvo.com` ; `on-demand` n'a qu'une préversion Vercel. |
| **L'app** | ⚠️ non, par construction | **un seul identifiant** (`com.quantinvo.app`) et l'adresse de la base est **figée dans le bundle** (`EXPO_PUBLIC_SUPABASE_URL`, voir `src/lib/baseConnectee.ts`). L'app publiée parle donc TOUJOURS à la production. |

La conséquence est simple et elle commande tout le reste : **une mise à jour
unique livre un binaire pointé sur la production, donc ce jour-là la production
doit déjà porter tout ce dont l'app a besoin.** Le développement sur le jumeau
n'est pas le risque ; **le rejeu vers la production l'est.**

### Ce que ce rejeu représente, mesuré le 9 octobre 2026

- **31 fichiers** vivent sur `on-demand` et pas sur `main`.
- **196 objets** sont en production sans migration sur `main` : c'est le
  chantier de SEPTEMBRE, déjà appliqué. Le retard réel à rejouer, ce sont les
  **17 migrations d'octobre**, appliquées au jumeau seulement.
- **Un seul corps divergent sur 236** : `prendre_place_appareil`. La production
  exécute la version On-Demand ; `main` décrit encore celle d'OS.

### ⚠️ Les deux choses qui peuvent mal tourner

**1. Une migration qui remplace une fonction d'OS frappe l'app PUBLIÉE tout de
suite, sans attendre aucune mise à jour.** C'est déjà arrivé, et c'est
exactement ce qu'est `prendre_place_appareil` aujourd'hui : le plafond
d'appareils d'un magasin sans `devices` est passé d'illimité à deux, en
production, pour des clients qui n'ont rien installé. Donc une migration de ce
genre ne part en production que **le jour où on le décide**, répétée d'avance —
jamais « au passage ».

**2. Plus le tas grossit, plus l'ordre compte.** Note 109 l'a montré : l'ordre
des NOMS n'est pas l'ordre dans lequel l'histoire s'est écrite, et le rejeu du
dossier depuis zéro meurt au 5ᵉ fichier. Un rejeu de 17 migrations se répète
avant de se jouer.

### Ce qu'il manque pour que le plan soit sûr

`scripts/replique/verifier.sh` fait **déjà** la bonne mesure — rejouer les
migrations, puis vérifier que les parcours de Quantinvo OS se comportent à
l'identique avant/après, et que le retrait ramène OS exactement à son état.
33 migrations, vert au 7 octobre.

⚠️ **Mais son socle est un SOUS-ENSEMBLE écrit à la main**, extrait du catalogue
le 20 septembre (voir l'en-tête du script). La répétition est donc partielle :
elle ne dit rien d'un objet de production que le socle ne contient pas.

**Pour la rendre vraie, le jour du rejeu** : refaire le `db dump` de la
production (procédure plus haut, sans mot de passe) dans une base jetable,
rejouer les 17 migrations dessus, mesurer. C'est la même recette qui a fabriqué
le jumeau ; elle sert une seconde fois.

**Ordre à tenir le jour J**, et il n'est pas interchangeable :

1. dump de la production → base jetable ;
2. rejeu des 17 migrations dessus, et mesure avant/après ;
3. seulement alors, application sur la production ;
4. déploiement du site, puis des fonctions edge ;
5. **et en dernier le build de l'app** — qui appartient à Julien.

## Les secrets du jumeau — `scripts/secrets-jumeau.sh` (10 octobre 2026)

Le jumeau portait **9 secrets**, tous posés automatiquement par Supabase (plus
`APP_PUBLIC_URL` et `SITE_URL`). La production en porte **23**. Les 22 fonctions
edge du jumeau étaient déployées depuis le 9 octobre et ne pouvaient donc rien
faire : ni e-mail, ni Stripe, ni prélèvement.

Le script les pose, et il existe pour une raison précise : **aucune valeur ne
doit passer par l'agent ni par le chat**. Saisie à l'aveugle, fichier
temporaire en 0600, un seul envoi, effacement par `trap` (y compris sur
Ctrl-C). Rien dans la ligne de commande, donc rien dans `ps` ni dans
l'historique du shell.

### Ce que la mesure a appris

⚠️ **Il n'y a RIEN à créer dans Stripe, sauf un webhook.** `STRIPE_LIVE_PRET`
vaut `false` : le compte est encore en mode test, donc les secrets Stripe de la
PRODUCTION *sont déjà* des valeurs de test. Les huit `STRIPE_PRICE_*` et
`STRIPE_SECRET_KEY` se recopient tels quels. Croire qu'il fallait créer huit
Price de test aurait fait fabriquer des doublons et, pire, mélangé deux jeux
d'identifiants pour les mêmes tarifs.

⚠️ **Sauf `STRIPE_WEBHOOK_SECRET` : une signature appartient à une ADRESSE, pas
à un compte.** Celle de la production ne validera jamais un appel reçu par le
jumeau. Il faut un second point d'entrée dans Stripe (mode test) vers
`https://<jumeau>.supabase.co/functions/v1/stripe-webhook`, avec les quatre
évènements que la fonction traite : `checkout.session.completed`,
`invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.

⚠️ **`ALERTE_CLE`, `METRICS_KEY`, `PRELEVEMENT_CLE` sont tirés au hasard, et
DIFFÉRENTS de la production.** Ce sont nos propres mots de passe partagés : les
recopier ferait qu'une fuite d'un côté ouvre l'autre. Personne n'a besoin de
les lire, donc personne ne les lit.

⚠️ **Et deux valeurs ne sont PAS des secrets de fonction.** La tâche horaire
`prelever-les-locations` (`15 * * * *`) tourne dans la base : elle ne voit pas
l'environnement des fonctions edge. `prelevement_url` et `prelevement_cle`
vivent dans le **coffre** (`vault`), et le coffre du jumeau était vide — c'est
pour ça que la tâche n'a appelé personne depuis le 7 octobre. Le script écrit
les deux, avec la même valeur que `PRELEVEMENT_CLE`, dans le même passage :
séparés, ils dérivent.

### ⚠️ Deux pièges du CLI, payés en direct

**`supabase link` change la cible du dépôt, en silence.** Un `link` vers le
jumeau laisse `db query --linked` pointer sur le jumeau pour tout ce qui suit.
Le lien a changé deux fois dans la même journée. Le script écrit donc le
`project-ref` **en dur** et ne dépend d'aucun état du dépôt.

**`db query --project-ref` seul est refusé** (« only applies when targeting the
linked project ») et `--linked` seul viserait le projet lié — la production la
plupart du temps. Il faut **les deux ensemble** : `--linked --project-ref`.

### ⚠️ Ce qui reste à vérifier, et que je ne peux pas lire

`APP_PUBLIC_URL` et `SITE_URL` du jumeau ont été posés le 9 octobre, et les
valeurs ne sont pas lisibles par le CLI (seules des empreintes sortent). **S'ils
pointent sur `www.quantinvo.com`**, les e-mails et les retours Stripe du jumeau
enverraient les gens sur la production. À regarder dans la console avant
d'éprouver le paiement.

### Ce que la pose a vraiment appris (10 octobre, après-midi)

⚠️⚠️ **J'AI ENVOYÉ JULIEN DANS UNE IMPASSE : Supabase ne redonne JAMAIS la
valeur d'un secret.** Sa page n'affiche qu'une empreinte SHA-256. Je lui ai
écrit « révèle la valeur côté production » pour quinze lignes — il n'y a rien à
révéler. Les valeurs se prennent **à la source** : Stripe pour la clé et les
tarifs, Resend pour la sienne. Le script le dit maintenant en tête.

⚠️ **Et l'aide ne doit pas ressembler à une valeur déjà saisie.** La ligne
d'explication de `CONTACT_EMAIL` commençait par `contact@quantinvo.com — …` :
Julien l'a lue comme un champ pré-rempli et a attendu. « c'est déjà écrit ».
L'aide se préfixe désormais par `↳`, et ce qu'il faut taper se donne après
`↳ tape :`.

#### ⚠️⚠️ L'inversion mensuel/annuel a bien eu lieu — et l'empreinte l'a attrapée

`STRIPE_PRICE_ESSENTIAL_YEARLY` a reçu **l'identifiant du tarif MENSUEL**. Une
page de paiement se serait ouverte, parfaitement valide, à **89 € par an au lieu
de 950 €**. C'est exactement le piège de la fiche 061 — « c'est le montant qui
fait foi, pas le fait que la session s'ouvre » — et il s'est reproduit au
premier recopiage manuel.

**Ce qui l'a vu : la comparaison des empreintes.** La page de chaque projet
publie le SHA-256 de chaque secret. En les comparant deux à deux on apprend,
**sans lire une seule valeur**, lesquelles sont identiques à la production,
lesquelles diffèrent, et — en inversant la table — *quelle autre valeur* a été
collée par erreur. C'est ce dernier point qui a nommé le défaut : « c'est la
valeur de `ESSENTIAL_MONTHLY` ».

Le même procédé a servi à retrouver deux valeurs sans les révéler :
`INVITE_FROM_EMAIL` (lu sur un e-mail envoyé dans Resend, puis confirmé par son
empreinte) et les deux URL du jumeau, déjà posées le 9 octobre et justes.

**Retenir le procédé, pas l'incident** : une empreinte publiée est un moyen de
VÉRIFIER une valeur qu'on ne doit pas lire. Candidat → hash → comparaison.

Le script rappelle désormais **le montant à chaque tarif** (« Essential,
950,00 € par AN ») : c'est le seul garde-fou qui tienne, puisque les deux
identifiants se ressemblent et que les deux sessions s'ouvrent.

#### État final, mesuré

Les huit tarifs, `CONTACT_EMAIL` et `INVITE_FROM_EMAIL` identiques à la
production ; `ALERTE_CLE`, `METRICS_KEY`, `PRELEVEMENT_CLE` et
`STRIPE_WEBHOOK_SECRET` propres au jumeau ; le coffre écrit, `prelevement_url`
exacte et `prelevement_cle` **dont l'empreinte s'accorde** avec le secret de
fonction (vérifié par `extensions.digest` côté base contre le digest publié).

⚠️ `STRIPE_SECRET_KEY` et `RESEND_API_KEY` **diffèrent** de la production, et
c'est attendu : Julien a pris la clé secrète standard du compte Stripe (la
production porte vraisemblablement une clé restreinte) et une clé Resend à
lui. Les deux commencent par le bon préfixe. **Le premier appel réel tranchera**
— c'est la seule vérification qui vaille, et elle n'a pas encore été faite.
