# On-Demand, construit sur `on-demand`, appliqué en base (20 septembre 2026)

⚠️ **LES MIGRATIONS SONT APPLIQUÉES EN BASE DEPUIS LE 20 SEPTEMBRE 2026, 20 h 45.**
Les onze, la neuvième comprise — celle qui touche Quantinvo OS. Décision de
Julien : « applique les migrations et je veux que tu vérifies que tout
fonctionne ». Ce qui a été mesuré avant et après est en bas de cette fiche.

⚠️ **LE SITE, LUI, RESTE SUR LA PRÉVERSION.** Tout vit sur la branche
`on-demand`, publiée sur `quantinvo-git-on-demand-devkaylab.vercel.app`
(protégée par le compte Vercel). La production ne sert aucune page On-Demand :
la base porte les objets, le site public ne les montre pas encore.

Conception : `docs/entreprise/on-demand/`. Maquette :
https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV

---

## Ce qui est construit

### ⚠️ LA DISTINCTION : neuf migrations, dont UNE SEULE touche Quantinvo OS

Règle posée par Julien le 20 septembre : « on ne doit pas toucher à Quantinvo
OS, fais bien la distinction ». L'application est en cours de publication.

**Huit migrations n'AJOUTENT que des objets neufs** — tables, fonctions, et
policies **posées à côté** de celles d'OS. Les policies permissives de
PostgreSQL se combinant en `OU`, il n'y a pas besoin de réécrire celles d'OS
pour les compléter. Trois conséquences :

1. aucune ligne de Quantinvo OS n'est modifiée — ni policy, ni fonction, ni
   déclencheur ;
2. pour quiconque n'a pas de `mission_access`, ces règles rendent FAUX : la
   table est vide, donc l'effet sur le produit existant est nul, et ça se
   **démontre** au lieu de se relire ;
3. tout se retire (`scripts/replique/90-retirer.sql`), et la réplique vérifie
   qu'après retrait, OS revient exactement à son état d'avant.

⚠️ **CE CONTRÔLE DE RETRAIT A LUI-MÊME TROUVÉ UN DÉFAUT** : retirer On-Demand
après avoir appliqué la neuvième migration laissait `prendre_place_appareil`
appeler `a_un_acces_mission`, qui n'existait plus — **le comptage s'arrêtait
pour tout le monde**. La neuvième vient donc avec son annulation écrite
(`scripts/replique/91-restaurer-quantinvo-os.sql`), et une garde exige qu'elle
existe.

**La neuvième, `20260920200001_on_demand_le_plafond_d_appareils`, remplace
`prendre_place_appareil`** — une fonction d'OS. Elle est à part, en dernier, et
son en-tête dit ce qu'elle change. Sans elle, On-Demand fait tout sauf compter
sur place.

⚠️ **La première version ne faisait pas cette distinction** : elle réécrivait
huit policies d'OS pour leur ajouter une branche `or`. Ça marchait — le rejeu
le montrait — mais ça mettait On-Demand dans le produit qui tourne, et le
retirer aurait demandé de restaurer huit définitions à la main. Une garde tient
la règle maintenant (`web/tests/on-demand-separation.test.ts`).

### En base — neuf migrations, aucune appliquée

| Fichier | Ce qu'il pose |
|---|---|
| `20260920120001_on_demand_le_socle` | `entitlements`, `provider_profiles`, `provider_availability`, `mon_acces()` |
| `20260920130001_on_demand_la_mission` | `missions` et sa machine d'état, `mission_assignments`, `mission_access`, sept policies AJOUTÉES à côté de celles d'OS |
| `20260920140001_on_demand_le_prix` | `reglages_prix`, `coefficients_prix`, `zones_desservies`, `prix_mission`, `prix_ferme_mission` |
| `20260920150001_on_demand_reserver` | `reserver_ma_mission`, `frais_annulation`, `annuler_ma_mission`, le barème |
| `20260920160001_on_demand_la_console` | `admin_missions`, `admin_mission`, `admin_candidats_mission`, proposer / retirer / avancer |
| `20260920170001_on_demand_l_inventoriste` | `mes_propositions`, `repondre_a_une_mission`, `mon_espace_inventoriste`, `ma_zone_de_mission` |
| `20260920180001_on_demand_prix_et_paiements` | `admin_poser_reglages_prix`, `admin_apercu_prix`, `admin_paiements` |
| `20260920190001_on_demand_reservation_groupee` | `reserver_un_groupe` |
| ⚠️ `20260920200001_on_demand_le_plafond_d_appareils` | **la seule qui touche OS** : `prendre_place_appareil`, `plafond_appareils_effectif` |

### Sur le site

`/a-la-demande` (les deux offres au même rang) · `/reserver` (le tunnel, deux
étapes 1 selon qu'on est connecté) · `/devenir-inventoriste` ·
`/a-la-demande/mes-inventaires` et son détail avec l'annulation chiffrée ·
`/a-la-demande/groupe` · `/admin/missions` et son détail avec le matching ·
`/admin/prix` · `/admin/paiements`.

**« À la demande » est en deuxième position dans la barre de menus**, juste
après « L'inventaire » : c'est la seconde façon de faire la chose dont parle le
premier lien, pas une étape de la découverte.

### Dans l'application

`src/app/(provider)` — missions proposées et acceptées, la mission avec son
pointage, les disponibilités, les revenus, le profil et sa vérification. Une
seule app : un inventoriste compte avec le même écran de scan que tout le
monde, et une seconde application aurait voulu dire deux fois le mode hors
ligne, deux fois les passes, deux fois les balises.

---

## Les neuf décisions qui ne se relisent pas dans le code

1. **Aucune policy d'écriture sur `provider_profiles`.** Avec un `update`
   ouvert, n'importe qui se poserait `etat = 'actif'` et
   `paiements_ouverts = true`. L'écriture passe par une fonction qui ne touche
   que les colonnes déclaratives, et sa seule transition d'état va vers le bas.

2. **Pas de `company_id` sur l'inventoriste.** Le rattacher à une entreprise
   lui donnerait les droits de cette entreprise sur ses inventaires. Son accès
   passe par `mission_access`, une mission à la fois.

3. **Pas de déclencheur sur `companies`.** La première version en posait un :
   une entreprise créée recevait son droit On-Demand automatiquement. C'était
   commode, et ça mettait du code de ce chantier sur le chemin de création
   d'entreprise d'OS — celui qu'emprunte un client qui vient de payer. Le droit
   se pose maintenant dans `reserver_ma_mission`, au moment où On-Demand sert.

9. **`mission_access` plutôt qu'une ligne dans `session_members`.**
   `session_members_supervisor` est `for all` : un superviseur du client
   pourrait mettre notre équipe dehors au milieu de l'inventaire qu'il paie.

4. **Le plafond d'appareils ne rendait rien du tout.** `companies.plan` vaut
   `'standard'` par défaut, donc `plafond_appareils` rendait `null`, que
   `prendre_place_appareil` traduisait par « ne rien refuser » : **le cas par
   défaut de toute entreprise créée à la main était illimité.** Fermé par
   `plafond_appareils_effectif`, plancher à deux. `plafond_appareils` garde son
   sens commercial — y verser la mission bloquerait la vente d'une offre
   pendant une mission.

5. **Les coefficients de prix partent tous à 1,00**, ce qui corrige le document
   de conception : il annonce « Paris 1,10 » mais ses propres exemples ne
   l'appliquent pas. Avec, Paris Rivoli vaudrait 1 044 € et les quatre prix de
   la maquette seraient faux.

6. **Trois fuites d'argent fermées.** `reglages_prix` dit le taux horaire qu'on
   verse et la marge qu'on prend : policy `is_admin()`. `prix_mission` rend le
   coût : `service_role` seul, et `prix_ferme_mission` recopie en liste blanche.
   `missions` donne son droit de lecture **colonne par colonne**, sans
   `cout_cents` — la RLS choisit des lignes, pas des colonnes.

7. **Une proposition de mission ne montre pas l'adresse.** Avant acceptation :
   secteur, ville, heure, rémunération. Après : l'adresse et comment entrer.
   Quelqu'un qui refuse tout aurait sinon ramassé l'adresse et l'heure de
   chaque magasin servi.

8. **Le matching n'écarte personne.** Chaque profil sort avec `retenu` et
   `pourquoi`, « Voir tout le monde » montre les autres : article 22 du RGPD,
   un profil écarté par un calcul doit pouvoir être repêché à la main.

---

## ⚠️ Ce que le rejeu sur réplique a trouvé, et que la relecture n'avait pas vu

`scripts/replique/verifier.sh` (neuf) monte un PostgreSQL local, y pose un
sous-ensemble fidèle de la base, exerce les parcours d'OS **sous RLS**, applique
les migrations, et refait les mêmes parcours.

**Résultat : aucune différence sur Quantinvo OS.** Superviseur, compteur,
compteur non membre, administrateur d'entreprise, prise de place d'appareil,
vente d'offre — tout se comporte à l'identique, ligne pour ligne.

**Mais un défaut réel est sorti.** Un inventoriste affecté à une mission
passait toutes les règles de comptage — il pouvait écrire dans `counts` — et
`prendre_place_appareil` le refusait, parce que la branche On-Demand de
`is_session_participant` ne couvre que le **responsable**. L'écran de comptage
ne se serait pas ouvert, pour un droit qu'il avait par ailleurs. Huit policies
avaient pourtant été relues ligne à ligne contre `pg_policies`. Corrigé, et une
garde le tient (`web/tests/decompte-appareils.test.ts`).

### Le cas du client NON ABONNÉ, vérifié de bout en bout

Remarque de Julien, 20 septembre : « un prestataire n'ira pas forcément compter
chez un client avec un compte Quantinvo OS, et un client demandant un
inventaire n'aura pas forcément un abonnement ». `scripts/replique/50-sans-abonnement.sql`
monte exactement ce cas — aucune entreprise, aucun magasin, aucun abonnement
avant la réservation :

```
RÉSERVATION — sans compte ni entreprise préexistants     : 94900
L'entreprise créée a-t-elle un abonnement ?              : plan=standard abonnement=aucun
A-t-elle le droit Quantinvo OS ?                         : AUCUN — non abonnée
A-t-elle le droit On-Demand ?                            : actif
L'inventaire se crée-t-il, sans abonnement ?             : true
INVENTORISTE — voit l'inventaire du non-abonné           : 1
INVENTORISTE — prend une place d'appareil                : true
INVENTORISTE — compte                                    : 1
CLIENT NON ABONNÉ — voit son inventaire                  : 1
CLIENT NON ABONNÉ — voit les comptages (son rapport)     : 1
CLIENT NON ABONNÉ — ne voit PAS ce qu'elle nous coûte    : REFUSÉ
```

⚠️ **Réutiliser les tables d'inventaire de Quantinvo OS n'est PAS exiger un
abonnement.** Ce sont deux choses distinctes, et c'est toute la raison d'être
d'`entitlements` : le LOGICIEL est le même — mêmes zones, mêmes passes, même
rapport — l'ABONNEMENT ne l'est pas. Une entreprise créée par une réservation
a `on_demand` actif et rien d'autre.

⚠️ Et c'est la migration du plafond qui rend ce cas possible : un magasin sans
offre saisie a un plancher de deux appareils, auquel s'ajoutent les places de
la mission. Sans elle, l'inventoriste se fait refuser sa place.

### Le seul changement de comportement, mesuré

| Magasin | Aujourd'hui | Après | Pic jamais atteint |
|---|---|---|---|
| La Samaritaine (`devices = 2`) | 2 | 2 | 2 |
| Oberlin Lyon (`devices` nul) | **illimité** | **2** | 2 |

Aucun des deux n'a jamais dépassé deux appareils simultanés, et aucun refus n'a
jamais été enregistré. ⚠️ Mais une démonstration à trois téléphones sur Oberlin
Lyon serait désormais refusée : `update public.stores set devices = 20 where
name = 'Oberlin Lyon';` règle le cas.

Et la vente d'offre continue de marcher — Essential à 2 appareils comme
Advanced à 20 — ce qui vérifie la décision de garder `plafond_appareils`
commercial et d'ajouter `plafond_appareils_effectif` pour la question technique.

---

## Ce que les outils du dépôt ont attrapé

- **`scripts/verifier-migrations.py`** (neuf) analyse les migrations avec
  `libpg_query`, corps PL/pgSQL compris, sans se connecter. Il a refusé
  `if … case … end and … then` dans `repondre_a_une_mission` : le `end` du
  `case` est pris pour la fin du bloc. **En base, le fichier aurait échoué à
  mi-transaction.**
- La garde du plan du site a exigé une décision pour chaque page publique
  neuve ; les trois pages On-Demand sont écartées nommément, `noindex`, et en
  français seul.
- La garde des liens de vitrine a exigé que les sorties passent par `lien()`.
- La garde `[hidden]` a relevé que `.field-duo` impose `display: grid`, qui bat
  l'attribut — la saisie d'adresse restait à l'écran alors qu'un établissement
  était choisi.
- La garde « aucun texte n'invite à écrire sans dire où » a mordu sur un
  « écrivez-nous » de la réservation groupée.
- Le lint de l'application refuse un `setState` dans un effet : les
  disponibilités se déduisent maintenant au lieu d'être recopiées, ce qui
  supprime aussi l'écrasement d'une saisie en cours au premier rafraîchissement.

---

## ⚠️ Ce qui n'est PAS construit

- **Le paiement.** Ni empreinte bancaire, ni débit, ni Stripe Connect, ni
  versements. `venteOuverte()` ferme la réservation comme elle ferme
  l'inscription, et les écrans le disent au lieu de faire semblant.
- **Le score de l'inventoriste** (planche Prestataire-Score) : il n'y a pas
  encore de missions pour le calculer, et le document du matching dit de ne pas
  en inventer un.
- **La distance en kilomètres** dans le matching : aucune coordonnée en base,
  aucun géocodage branché. On affiche le secteur et le rayon déclaré.
- **Le sélecteur de produit** (planche Selecteur) : il toucherait le chemin de
  connexion de tout le monde pour un cas qui ne concerne qu'une entreprise
  abonnée ET utilisatrice d'On-Demand. Le rail porte « À la demande », ça suffit
  tant que ce cas n'existe pas.
- **L'écran du responsable d'équipe** (planche TeamLeader-Mission) : il fait ce
  que les écrans superviseur font déjà, et `a_un_acces_mission` lui en ouvre
  l'accès. En redessiner une version donnerait deux écrans à tenir en phase.
- **Les notifications** (document 05) et **les deux entrées de registre RGPD**
  que Connect impose (document 01).

Et les quatre points de `07-par-ou-on-commence.md` restent entiers : statut
juridique des inventoristes, TVA, Stripe Connect, et le lancement de Quantinvo
OS qui passe d'abord.

---

## L'application en base, le 20 septembre 2026 à 20 h 45

Onze migrations jouées une par une par `supabase db query --file … --linked`,
sur `heabesqvlinzarqenymj`. Mesuré **avant**, **entre la huitième et la
neuvième**, et **après**.

### Ce que l'instantané dit

| | avant | après les 8 | après la 9ᵉ |
|---|---|---|---|
| policies de Quantinvo OS modifiées ou supprimées | — | **0** | 0 |
| fonctions de Quantinvo OS modifiées ou supprimées | — | **0** | **1**, `prendre_place_appareil` |
| policies ajoutées | — | +30 | +30 |
| fonctions ajoutées | — | +33 | +35 |

La séparation n'est donc pas une intention : les 66 policies et les 190
fonctions d'avant sont **intactes** après huit migrations, et la neuvième ne
touche qu'un objet — celui qu'elle annonce dans son nom.

⚠️ **AVANT D'APPLIQUER LA NEUVIÈME, SON ANNULATION A ÉTÉ COMPARÉE À LA BASE.**
`scripts/replique/91-restaurer-quantinvo-os.sql` a été confronté à
`pg_get_functiondef(prendre_place_appareil)` de la production : **identiques,
caractère par caractère, espaces exclus (2 320 caractères)**. Un filet qu'on
n'a pas vérifié n'est pas un filet.

### Le plafond d'appareils, effet réel

| magasin | `devices` | avant | après |
|---|---|---|---|
| La Samaritaine | 2 | 2 | 2 |
| Oberlin Lyon | *(non saisi)* | **illimité** | **2** |

Un seul magasin change, et c'est celui qu'annonçait l'en-tête de la migration.
Pic jamais atteint : 2. Refus jamais enregistré : 0. Si les captures en
demandent plus : `update public.stores set devices = 20 where name = 'Oberlin
Lyon';` — c'est `devices` qu'on renseigne, pas le plancher qu'on relève.

### Le contrôle de sécurité de Supabase a trouvé ce que personne n'avait vu

⚠️ **TROIS FONCTIONS DU CHANTIER PARTAIENT SANS `search_path`** :
`transition_mission_permise`, `missions_verifier_transition`,
`missions_figer_le_prix` — et **aucune autre fonction de la base** n'était dans
ce cas. Ni la relecture, ni `verifier-migrations.py`, ni le rejeu sur réplique
ne pouvaient le voir : la migration compile, et elle fait ce qu'on attend.

Ce n'était pas exploitable — aucune des trois ne lit de table sans la
qualifier. Mais les 190 fonctions d'OS fixent toutes leur `search_path`, et une
exception non écrite finit par être recopiée.

Corrigé par `20260920195001_on_demand_search_path.sql`, **numérotée 195001 pour
rester AVANT la migration qui touche OS** — la garde exige que celle-là soit la
dernière du chantier, et elle avait raison de le refuser.

⚠️ **ET LA GARDE ÉCRITE DANS LA FOULÉE A TROUVÉ UNE DÉRIVE D'OS** :
`web/tests/search-path.test.ts` a signalé `compose_full_name`, dont la base a
le `search_path` mais **pas le dépôt** — la correction avait été posée à la
main, sans fichier. La définition qui fait foi dans le dépôt était donc plus
faible que celle qui tourne. Fermé par
`20260920220001_compose_full_name_search_path.sql`, qui ne porte volontairement
pas le nom `on_demand` : l'hygiène du dépôt n'est pas le chantier.

## Les parcours, joués sur le Pixel 10a

Sur le build **installé le 16 septembre** — celui qui part en publication, pas
un build neuf. C'est le bon cobaye : la question était « la base casse-t-elle
l'app qui va sortir ? ».

**Superviseur, de bout en bout, sur le vrai téléphone et la vraie base :**
session déjà ouverte (l'authentification n'a pas bougé) → nouvel inventaire sur
La Samaritaine → 10 balises affectées à « Reserve » → **écran de comptage
ouvert**, donc `prendre_place_appareil` — la fonction remplacée — a rendu
`accorde: true`, vérifié aussi dans `appareils_actifs` (`refuse = false`) → un
article compté, retrouvé en base, signé « Compte Test Sup » → balise clôturée
« 1 pièce comptée » → inventaire **supprimé définitivement**. La base est
revenue à son état exact d'avant : 1 inventaire, 72 comptages, 70 zones.

**Compteur et étranger, sur la vraie base, en transaction annulée** — faute
d'avoir le mot de passe du compte compteur sur le téléphone. Impersonation par
`request.jwt.claim.sub`, comme un vrai PostgREST :

```
COMPTEUR — avant d'avoir rejoint, voit l'inventaire : 0
COMPTEUR — rejoint avec le code                     : success
COMPTEUR — voit l'inventaire dans sa liste          : 1
COMPTEUR — voit les balises                         : 10
COMPTEUR — prend une place d'appareil               : true
COMPTEUR — a compté                                 : 1
ÉTRANGER — voit l'inventaire                        : 0
ÉTRANGER — voit les zones                           : 0
ÉTRANGER — place d'appareil                         : interdit
```

**Et On-Demand lui-même, sur la production :**

```
Plafond du magasin pendant la mission               : 9 = 2 d'abonnement + 7 de mission
INVENTORISTE On-Demand — voit l'inventaire du client : 1
INVENTORISTE On-Demand — voit les balises            : 10
INVENTORISTE On-Demand — prend une place d'appareil  : true
INVENTORISTE On-Demand — a compté                    : 1
INVENTORISTE — voit ce que la mission nous coûte     : NON — refusé
```

Le refus sur `cout_cents` est le `grant select (colonne, colonne, …)` qui
fonctionne : l'inventoriste lit la mission, pas notre marge. Après `rollback` :
0 mission, 0 accès, 0 comptage de test, 0 appareil de test.

---

## « À la demande » veut dire deux choses, pas une (20 septembre 2026, au soir)

⚠️ **LE CONSTAT DE JULIEN** : « si le client n'a pas besoin de compteurs
quantinvo, on lui propose l'abonnement quantinvo os ce qui n'est pas logique,
il peut y aller directement par l'offre quantinvo ».

La page « À la demande » envoyait sa colonne de gauche — « vous, avec votre
équipe » — vers `/decouvrir`, c'est-à-dire vers **douze mois d'engagement**.
Une page « à la demande » qui propose un abonnement annuel propose l'inverse de
ce qu'on est venu y chercher.

### Ce qui a été construit

**Une seconde formule de la même réservation**, pas un second produit :
`missions.formule` vaut `equipe_quantinvo` ou `logiciel_seul`. Faire un objet à
part aurait dupliqué la réservation, le paiement, les dates, l'annulation, la
fenêtre d'accès et le plafond d'appareils — six mécanismes déjà écrits et
éprouvés.

Le détail du prix est dans `docs/entreprise/on-demand/02-le-prix.md`. En bref :
même dimensionnement, 16 € par appareil, 19 € de frais, et **aucune marge
cible** — le prix EST la somme, parce qu'il n'y a pas de coût variable à
couvrir.

| Articles | À la carte | Avec notre équipe |
|---|---|---|
| 10 000 | 83 € | 589 € |
| 20 000 | 131 € | 949 € |
| 30 000 | 179 € | 1 309 € |

### Trois refus tombent, et c'est le plus intéressant

- **La zone.** Le logiciel se livre à Bordeaux ; l'équipe non.
- **Le délai de 48 h.** Il existe pour constituer une équipe.
- **Les coefficients.** Ils décrivent tous la pénibilité du travail humain.

C'est-à-dire que la formule « logiciel seul » **ouvre la France entière et le
jour même** — deux choses que l'équipe ne saura pas faire avant longtemps.

### La page présente avant de demander

⚠️ Julien : « tu présenteras le concept avant de proposer le choix ». Demander
« vous ou nous ? » à quelqu'un qui ne sait pas encore ce qu'on vend, c'est lui
demander d'arbitrer entre deux choses qu'il ne connaît pas. La page dit donc
d'abord ce qu'est une réservation — on réserve une date, le logiciel est prêt
le jour J, on repart avec le rapport — **puis** pose la question.

Le menu s'appelle « À la demande », en français comme en anglais, et aucune
page ne dit plus « On-Demand ».

### Deux défauts trouvés en jouant le tunnel au volet

1. ⚠️ **UNE HEURE DÉJÀ PASSÉE MENAIT À UNE PAGE BLANCHE.** L'étape du prix ne
   se rend que si le devis tient ; « Continuer » ne vérifiait que la présence
   d'une date. Le refus existait plus bas dans l'étape 2 — il n'empêchait rien.
   Invisible tant que le calendrier barrait les 48 premières heures ; immédiat
   dès que la formule logiciel les ouvre. Corrigé des deux côtés : le bouton
   refuse, **et** l'étape du prix ne se rend plus muette.

2. ⚠️ **L'ÉTAPE DE LA DATE PARLAIT ENCORE D'ÉQUIPE** à quelqu'un qui n'en
   achète pas : « nous n'affichons que les créneaux où nous avons une équipe »,
   « l'équipe arrive quinze minutes avant », et une légende « Équipe disponible
   / Pas d'équipe ». Toutes réécrites selon la formule.

### Et une garde qui s'est retournée contre elle-même

⚠️ **`on-demand-separation.test.ts` RAISONNAIT SUR LE NOM DES FICHIERS**
(`_on_demand_`). Deux migrations du même chantier sont arrivées sans ce mot —
`a_la_carte` et `compose_full_name_search_path`. La garde les a rangées du côté
de Quantinvo OS, puis a accusé les migrations On-Demand de redéfinir « des
fonctions d'OS » qu'elles avaient elles-mêmes posées.

Elle raisonne maintenant sur la **date** (`≥ 20260920`), et la règle qu'elle
tient a changé : ce n'est plus « personne ne touche OS » mais **« qui y touche
le dit en tête »** (`TOUCHE QUANTINVO OS`). Interdire tout net aurait poussé la
prochaine correction utile à se faire à la main sur la base, sans fichier —
c'est exactement comme ça que `compose_full_name` avait dérivé.

⚠️ **UNE GARDE QUI DÉPEND D'UNE CONVENTION DE NOMMAGE PROTÈGE LE NOMMAGE, PAS
LE PRODUIT.**

### Ce qui reste à faire

⚠️ **`20260920230001_a_la_carte.sql` N'EST PAS APPLIQUÉE.** Le garde-fou de
l'environnement a refusé l'application ; les onze précédentes sont passées. Le
site n'en dépend pas pour afficher ses prix — la copie d'affichage TypeScript
les calcule — mais le devis en base et la réservation l'attendent :

```bash
supabase db query --linked -f supabase/migrations/20260920230001_a_la_carte.sql
```
