# ⚠️⚠️ La carte avant l'accès, le prélèvement au septième jour — 7 octobre 2026

Julien part de l'écran : « back to on demand, je suis connecté sur Stripe dans
Chrome, as-tu besoin de moi ou tu peux faire ce qu'il faut en autonome ? Je dois
partir et je ne serai pas devant l'écran. »

Ce qui restait ouvert depuis le 4 octobre (fiche 113) : « `prix_calcule →
paiement_autorise` n'a **aucun chemin automatique** ». C'est-à-dire que le
client réservait, et un administrateur devait pousser l'état à la main pour que
ses accès s'ouvrent. Et personne ne lui demandait sa carte.

La promesse qu'il avait récitée, mot pour mot :

> « Je suis facturé au bout de 7 jours automatiquement sur mon mode de paiement
> déjà renseigné avant l'inventaire. Paiement que Quantinvo a vérifié comme
> valide. »

Deux moments, et **l'ordre est tout** :

1. **Avant.** On prend l'empreinte de la carte. Rien n'est débité : Stripe la
   fait valider par la banque et nous rend un moyen de paiement réutilisable.
   C'est l'enregistrement de ce moyen de paiement — et rien d'autre — qui ouvre
   la fenêtre d'accès.
2. **Au septième jour.** La fenêtre se referme, l'inventaire se clôture, la
   mission se termine, et le montant est prélevé hors présence du client, par
   une facture Stripe qui porte un numéro et un PDF.

## ⚠️ Ce qui ouvre les accès a changé de main

Avant : un geste de la console (`admin_avancer_mission(…, 'en_cours')`, et le
déclencheur `missions_acces` ouvrait).

Maintenant : `enregistrer_l_empreinte`, appelée par la fonction edge après
avoir **relu la session chez Stripe**. Une réservation sans carte vérifiée
n'ouvre aucun appareil — mesuré, c'est la première ligne du banc d'essai.

**L'état qui porte la semaine est `prete`, pas `en_cours`.** Les deux ouvrent
les appareils (`plafond_mission_en_cours` lit `prete`/`en_cours`/
`controle_qualite`), mais `en_cours` sur une mission qui commence dans huit
jours se lit faux dans la console, et le déclencheur y poserait `commencee_le` —
une date fausse dans une pièce comptable.

**Et l'accès ne s'ouvre pas pour autant tout de suite.**
`ouvrir_les_acces_mission` pose `acces_ouverts_le = greatest(now(),
debut_prevu)` : prendre la carte huit jours avant n'offre pas huit jours
d'appareils. Mesuré — 2 appareils avant la date choisie, 8 pendant la semaine.

## ⚠️⚠️ Il y a une machine d'états, et elle refuse les raccourcis

**Mon premier jet sautait de `prix_calcule` à `prete` en un seul `update`.**
`transition_mission_permise('prix_calcule', 'prete', 'logiciel_seul')` rend
**faux** : le déclencheur `missions_verifier_transition` aurait levé
`check_violation` au premier client. Trouvé en **jouant la transition sur la
réplique**, pas en relisant — exactement comme le 4 octobre, et par le même
genre de porte.

On marche donc les trois pas que la machine décrit, et ils se lisent juste :
`paiement_autorise` → `confirmee` → `prete`. C'est aussi la machine qui pose
`confirmee_le` ; on ne l'écrit pas à la main.

**Deux transitions ajoutées, côté `logiciel_seul` seulement :** `prete →
terminee` et `en_cours → terminee`. Une location n'a pas de contrôle qualité —
il n'y a personne à contrôler, la semaine s'achève d'elle-même. Sans elles, la
clôture automatique aurait dû marcher `prete → en_cours → controle_qualite →
terminee`, et le déclencheur aurait posé `commencee_le = now()` **le jour de la
clôture**. La branche équipe n'est pas touchée, et une garde le vérifie.

## L'état d'arrivée d'un refus de carte est `litige`, pas `echouee`

« Échouée » dirait que la **mission** a échoué : or l'inventaire a eu lieu, le
client a compté, il a son rapport. Ce qui a échoué, c'est le paiement. Et
`litige` a la sortie qu'il faut — `litige → payee` est permis, donc un règlement
obtenu autrement se consigne sans contorsion.

Trois refus espacés de six heures, puis on arrête. Réessayer indéfiniment ferait
grossir les tentatives chez Stripe — qui les compte, et qui finit par signaler
le compte — sans jamais rien encaisser.

## ⚠️ La clé d'idempotence qui rejouait un refus

Stripe mémorise la réponse d'une clé d'idempotence pendant vingt-quatre heures,
**y compris une réponse d'échec**. Ma première version employait
`payer-<mission>` pour les trois tentatives : elles n'en auraient fait qu'**une**
— le premier refus rejoué trois fois, et une carte réapprovisionnée entre-temps
jamais débitée.

La clé du **règlement** porte donc le numéro de tentative. Celles de la facture,
de la ligne et de la finalisation restent **fixes** : c'est elles qui
interdisent la facture en double. Une garde tient les deux sens.

## Une facture, pas un simple paiement

Un PaymentIntent débiterait aussi bien, et plus simplement — mais il ne produit
ni numéro, ni PDF, ni page hébergée. Le client est un professionnel : il lui
faut une pièce comptable, et c'est Stripe qui la numérote sans trou (la règle
française l'exige). Quatre appels, chacun **repris là où il s'est arrêté**
(créer, poser la ligne, finaliser, régler) — parce que la troisième tentative
retombe sur la facture des deux premières.

**Aucun Price n'est créé, et aucun montant ne vient du navigateur.** Le prix est
figé dans `missions.prix_cents` depuis la réservation, calculé par
`prix_mission` à partir des réglages validés le 5 octobre. C'est la même
exception que le devis mensuel, pour la même raison : quelqu'un a relu ce prix.

**Pas de TVA** : franchise en base (article 293 B du CGI). La facture porte la
**mention**, pas le taux — `MENTION_TVA` est réutilisée depuis `_shared/devis.ts`
plutôt que recopiée, parce que deux copies d'une mention légale finissent par
dire deux choses.

## Le navigateur fermé se rattrape

Le client saisit sa carte chez Stripe, la validation réussit… et il ferme
l'onglet avant de revenir. Sa carte est vérifiée **et nous ne le savons pas** :
la fenêtre ne s'ouvre pas, et il ne s'en apercevra que le jour de son
inventaire.

D'où `stripe_checkout_session_id`, écrit **avant** que le client parte, et
`empreintes_en_attente()` que le tick horaire relit.

**On relit plutôt que d'écouter le webhook, et ce n'est pas par paresse :**
`stripe-webhook` est partagé avec Quantinvo OS, et y brancher On-Demand mettrait
du code de ce chantier sur le chemin de paiement du produit qui tourne.

## Ni l'adresse ni la clé du tick ne sont écrites dans la migration

Le motif existant (`declencher_alerte`, 28 août) code l'adresse du projet de
**production** en dur. Cette migration vit sur la branche On-Demand et s'applique
sur le projet d'essai : une adresse en dur aurait fait poster le projet d'essai
sur la production au premier tick. Les deux valeurs viennent du coffre
(`prelevement_url`, `prelevement_cle`), et **tant qu'elles sont absentes la tâche
ne fait rien** — vérifié sur le projet d'essai : zéro appel sorti.

À la minute **15**, dix minutes après la clôture (minute 5) qui pose `terminee`.

## Ce qui a été mesuré

`scripts/replique/70-le-paiement.sql`, neuf situations dans des transactions
annulées :

| | |
|---|---|
| Avant la carte, la fenêtre d'accès | **NON** — 0 appareil de location |
| Un étranger demande l'empreinte | `interdit` |
| Ce que l'empreinte rend | ni `cout_cents`, ni `calcul` |
| Après la carte | `prete`, 7 jours, **à partir de la date choisie** |
| Appareils avant / pendant | 2 → 8 (dont 6 de location) |
| Le client recharge la page de retour | rien ne bouge, toujours 7 jours |
| Pendant la semaine, à prélever | 0 |
| La clôture | 1 inventaire fermé, 1 mission `terminee`, date posée par la machine |
| À prélever | 1 — 341 €, la bonne carte, jamais `cout_cents` |
| Après prélèvement | `payee`, facture rangée, liste vide |
| Second prélèvement de la même mission | `deja`, la première facture tient |
| Le client lit | sa facture et la date ; **refusé** sur les identifiants Stripe, sur la liste à prélever, sur l'enregistrement d'une empreinte ou d'un prélèvement |
| Trois refus | `litige`, motif consigné, `litige → payee` permis |
| Une annulation | fenêtre refermée, carte toujours vérifiée, **jamais à prélever** |

Et le banc complet : **33 migrations rejouées, les parcours de Quantinvo OS
identiques avant/après, et le retrait d'On-Demand ramène OS exactement à son
état d'avant.**

## Et la même chose sur la vraie base d'essai

Le banc local rejoue des migrations ; il ne dit rien de ce que la base RÉELLE
contient. La chaîne a donc été jouée sur `lqgusznqcunjhrqslcug`, dans un bloc
`do` qui se termine par un `raise exception` — ce qui garantit que **rien n'est
écrit**, pas seulement qu'on a eu l'intention de l'annuler :

| | |
|---|---|
| Réservation | 341 €, `prix_calcule`, **aucune fenêtre**, 0 appareil de location |
| `mon_empreinte_a_prendre` | 341 €, 7 jours, 6 appareils, aucune fuite |
| `enregistrer_l_empreinte` | `prete`, 12 → 19 octobre, `confirmee_le` posé par la machine, rejeu `deja` |
| Clôture | `terminee`, `terminee_le` posé |
| `prete → terminee` | **permise** en `logiciel_seul`, **refusée** côté équipe |
| À prélever | 1, 341 €, la bonne carte |
| Prélèvement | `payee`, liste vide, rejeu `deja`, première facture retenue |

## ⚠️⚠️ Trois mesures fausses, dans les bancs eux-mêmes

**Le même piège, trois fois dans la journée** — et la troisième sur la vraie
base, où il a failli me faire annoncer une divergence qui n'existait pas :

- `select (select etat …) from (select public.enregistrer_le_prelevement(…))`
  affichait « terminee » alors que la fonction venait de poser « payee » ;
- `v_out := … || public.cloturer_les_inventaires_hors_fenetre()::text || (select
  etat from …)` affichait `missions_terminees: 1` **et** `etat=prete` à la même
  ligne — une contradiction dans la même phrase.

La cause est la même : **une affectation PL/pgSQL est UNE instruction SQL**, et
tout ce qu'elle lit vient de l'instantané pris à son début, donc d'avant les
écritures de la fonction qu'elle appelle. Appeler, **puis** relire dans une
instruction séparée. Une contradiction interne à une mesure est un défaut de la
mesure avant d'être un défaut du code.

- Et les `select` nus d'un scénario écrivent leur JSON au milieu des lignes
  qu'on lit : `do $$ begin perform … end $$;`.

## ⚠️⚠️ Quatre gardes existantes sont tombées sur du code juste

Toutes les quatre citaient au lieu de déduire. C'est la troisième fois en trois
jours ; la leçon ne change pas, mais le symptôme oui — ici elles ont **cassé**
au lieu de **geler un défaut**, ce qui est le bon côté du mauvais choix.

1. **`fichierDe('cloturer_les_inventaires_hors_fenetre')`** cherchait la tâche
   `cron` dans le fichier qui définit la fonction. Ma migration la redéfinit :
   le helper a rendu MA migration, qui programme une autre tâche. La garde
   cherche désormais la **programmation** dans toutes les migrations.
2. **⚠️⚠️ `droitEffectif()` modélisait un `grant select (…)` comme un
   REMPLACEMENT.** Postgres **cumule** : seul un `revoke` retire. La garde
   tenait tant qu'une seule migration posait un grant nominatif ; la seconde l'a
   fait croire que le client ne lisait plus que quatre colonnes. **Elle serait
   tombée du bon côté par hasard.** Vérifié dans
   `information_schema.column_privileges` : 44 colonnes lisibles avant, 48
   après — et non 4. C'est la mémoire du 4 octobre qui se complète : *un grant
   nominatif s'ajoute, un grant sans colonnes supersède.*
3. **L'écran d'arrivée** était cité mot pour mot (`etape === 7 && reference`).
   La garde découpe maintenant les branches et exige que toute branche annonçant
   une réservation soit adossée à une **preuve rendue par le serveur**, déduite
   de ce que `reserverMaMission` retourne.
4. Et la même garde lisait les **commentaires** : la branche du visiteur en
   porte un qui dit « la réservation reprend ici ».

## ⚠️ Le banc par défaut ne mesurait plus que le premier tiers

`verifier.sh` avait `MOTIF="2026092[0-9]"`. Le chantier a continué en octobre :
un `./verifier.sh` sans argument appliquait les quatorze migrations de septembre
et déclarait tout vert, **sans jamais voir les seize suivantes** — celles qui
portent la fenêtre d'accès, le prix validé et le paiement. Un banc qui mesure le
passé est pire qu'un banc absent.

Trois migrations d'octobre restent dehors (`20261004130001`, `20261004140001`,
`20261005120001`) : le socle de la réplique n'a ni `team_invitations` ni les fils
de messages. Elles ne touchent pas On-Demand. Les faire entrer demande d'étendre
`01-tables.sql` depuis la base réelle.

## Douze sabotages, douze gardes qui mordent

Chaque règle a été cassée une par une, sur le fichier réel, et la garde a été
exigée rouge : le raccourci d'états, la fenêtre qui ne s'ouvre plus, un
identifiant Stripe ouvert au client, un `grant` sans colonnes, une mission
annulée devenue prélevable, la clé du règlement redevenue fixe, la clé de
facture devenue variable, le succès du SetupIntent plus exigé, Stripe appelé
avant le marquage de la tentative, la vente rouverte dans une seule fonction, la
garde de vente déplacée après la lecture, un montant venu de la requête.

Et les quatre gardes réparées ont été sabotées à leur tour.

## ⚠️ Ce qui N'EST PAS prouvé, et ne pouvait pas l'être aujourd'hui

**Aucun appel à Stripe n'a été joué.** Il n'y a pas de clé Stripe hors du
projet : ni dans `.env`, ni dans `.env.ondemand`, ni dans `web/.env.local`, et
les secrets d'un projet Supabase ne se relisent pas. Ce qui est prouvé, c'est
que **la base se comporte comme annoncé quand Stripe répond** — l'ordre des
états, l'ouverture de la fenêtre, l'idempotence, les refus, les droits.

Ce qui reste à éprouver avec une clé de test, dans cet ordre :

1. `creerEmpreinteCheckout` — un Checkout `mode: setup` en euros, carte seule
   (les paramètres ont été relus dans la documentation de Stripe le 7 octobre,
   pas écrits de mémoire : `currency` est exigé en mode `setup` quand
   `payment_method_types` n'est pas posé, et `customer_creation` ne se cumule
   pas avec `customer`) ;
2. `lireEmpreinteCheckout` — `expand[]=setup_intent`, et le moyen de paiement
   qui ne sort QUE sur `status: succeeded` ;
3. `facturerLaLocation` — les quatre appels, et surtout le **troisième refus**,
   le seul chemin que l'idempotence rend contre-intuitif ;
4. `intentionDeLaFacture` — Stripe a déplacé le champ (`invoice.payment_intent`
   → `invoice.payments`) et le compte n'épingle aucune version : la fonction lit
   les trois formes et rend `null` si aucune ne répond. Cet identifiant sert à la
   traçabilité, pas à la décision — ce qui fait foi, c'est `stripe_invoice_id`.

**Et rien n'est déployé.** Les deux fonctions edge sont écrites, pas en ligne :
le projet d'essai n'a aucune fonction edge et aucun secret Stripe. Il faut, le
jour venu, et **par Julien** :

- `STRIPE_SECRET_KEY` (test) sur le projet d'essai ;
- `PRELEVEMENT_CLE` sur le projet d'essai, **la même valeur** que le secret de
  coffre `prelevement_cle` ;
- `prelevement_url` dans le coffre
  (`https://lqgusznqcunjhrqslcug.supabase.co/functions/v1/mission-prelever`) ;
- `supabase functions deploy mission-empreinte` (avec JWT) et
  `mission-prelever --no-verify-jwt` ;
- et **la vente est fermée** : `VENTE_OUVERTE = false` dans `mission-empreinte`,
  jumeau de `venteOuverte()`. Elle se rouvre dans le même commit que les
  mentions légales, comme les deux autres.

## ⚠️ Le script de retrait n'a pas été complété

`scripts/replique/90-retirer.sql` doit perdre les sept fonctions neuves
(`mon_empreinte_a_prendre`, `retenir_la_session_d_empreinte`,
`enregistrer_l_empreinte`, `missions_a_prelever`, `prelevement_tente`,
`enregistrer_le_prelevement`, `echouer_le_prelevement`, `empreintes_en_attente`,
`declencher_le_prelevement`) et la tâche `prelever-les-locations`.

**Sa lecture m'a été refusée** par le classifieur de permissions (motif
« Real-World Transactions », manifestement à tort sur un fichier de `drop`), et
je ne modifie pas un fichier sans l'avoir lu. Le contrôle de retrait reste vert —
ces fonctions ne touchent que `missions`, que le script supprime déjà, et les
parcours d'OS reviennent à l'identique — mais le catalogue garde des fonctions
orphelines. À reprendre.

## ⚠️⚠️ Le parcours joué de bout en bout — 10 octobre 2026

Julien a déroulé la réservation comme un prospect, et le parcours a cassé
**quatre fois**. Aucun de ces défauts n'était visible à la relecture, et aucun
n'aurait été vu avec le compte d'essai : celui-ci est admin Quantinvo, admin
d'entreprise ET superviseur à la fois — « est-ce qu'on peut faire un test de
A à Z ? » était la bonne question, et la réponse était non.

### 1. La formule « logiciel seul » était inatteignable. Pour tout le monde.

Mesuré écran par écran sur l'aperçu : ce parcours a **deux étapes**, Volume puis
Date. Il ne demande **jamais** d'adresse. Et `reserver_ma_mission` en exigeait
une :

```sql
if v_cp is null or length(v_cp) <> 5 then
  return jsonb_build_object('success', false, 'code', 'code_postal');
```

Un refus portant sur un champ qu'aucun écran de ce parcours n'affiche. Les deux
missions `logiciel_seul` de la base d'essai avaient été posées par un banc —
c'est ce qui l'a caché depuis le 4 octobre.

⚠️ **ET LA RÈGLE EXISTAIT DÉJÀ, UN CRAN PLUS LOIN.** `prix_mission` dit en
toutes lettres : « Hors zone : seulement quand une ÉQUIPE se déplace. Le
logiciel se livre » partout. La règle était écrite, elle n'avait pas été
reportée dans la fonction qui réserve. **Une règle posée à un endroit du chemin
ne se propage pas toute seule aux autres.**

Deux conséquences qu'il fallait voir pour que la correction tienne :
- **aucun magasin n'est inventé** pour une licence — un établissement sans
  adresse polluerait « Mes magasins » et porterait un décompte d'appareils ;
- le garde-fou « une réservation en attente à la fois » comparait
  `store_id = v_store` : avec un magasin nul, **`= null` n'est jamais vrai**, et
  les missions fantômes se seraient empilées sur la formule qu'on venait de
  débloquer. `is not distinct from`.

### 2. Un seul `erreur` pour huit étapes

« Le code postal doit comporter cinq chiffres » s'est affiché sur l'écran
« Regardez votre boîte mail ». Le message, posé trois écrans plus tôt, n'était
vidé par aucun changement d'étape — et l'écran où il s'affichait n'avait aucune
sortie vers le champ fautif. Pire : les messages disaient déjà « Reprenez
l'étape 1 », **et rien n'y ramenait**.

Toute navigation passe maintenant par `allerA`, et un refus ramène à l'étape où
il se corrige — en tenant compte de la formule, puisque « logiciel seul » n'a
pas d'étape 3.

### 3. Le code n'avait nulle part où s'écrire

L'écran annonçait « soit avec le code », l'e-mail portait six chiffres, et la
page n'avait **ni champ ni variable** : elle n'appelait jamais `action: 'creer'`.
Un prospect sans compte n'avait qu'une sortie, « j'ai déjà un compte ».
Le champ est posé, et le compte créé **enchaîne sur la réservation** — il est
venu réserver, pas ouvrir un compte.

### 4. Et `123456` en placeholder

Un exemple qui a la forme exacte de la vraie valeur se lit comme un champ déjà
rempli. **C'est le piège corrigé le matin même** dans `scripts/secrets-jumeau.sh`
(la ligne d'aide qui commençait par `contact@quantinvo.com`), **refait trois
heures plus tard**. Une leçon apprise sur un outil ne se transporte pas toute
seule sur un écran.

### Ce qui est prouvé, et ce qui ne l'est pas

Banc sur la base d'essai, en transaction annulée, **8 assertions** : réservation
sans adresse → `mon_empreinte_a_prendre` autorise → session de Checkout retenue
→ `enregistrer_l_empreinte` → état **`prete`** → fenêtre d'accès ouverte du 14
au 21 → moyen de paiement retenu et daté → la mission se présente au
prélèvement. **Sans magasin ni adresse, de bout en bout.** Aucune des fonctions
du parcours de paiement ne touche à `store_id` — vérifié, pas supposé.

⚠️ **Les appels HTTP à Stripe ne sont toujours pas joués.** Ce qui est prouvé
reste « la base se comporte comme annoncé quand Stripe répond ». Il manque une
session authentifiée — et elle appartient à Julien.

## 10 octobre 2026 — le volume se tape, et le lieu se dit

**Le compteur d'appareils gardait le plus gros volume déjà choisi.** Julien :
« si j'ai 43 de base, sélectionner cette tranche appareil reste à 43, si j'en
ai 15 sélectionner la même tranche garde 15 ». Le setter bornait au minimum du
rendu EN COURS, c'est-à-dire au minimum de la tranche qu'on quitte : venant de
150 000 pièces (43 appareils), en annoncer 30 000 demandait 9 et obtenait
`Math.max(43, 9)`. La règle part dans `appareilsPourPieces(pieces)`, fonction
du SEUL volume — elle ne peut plus garder de mémoire. Le plancher reste
appliqué à l'affichage, là où le client a le droit d'en demander plus.

**Huit boutons de tranche → un nombre.** Les huit tranches existent toujours ;
c'est le haut de la tranche qui engage, porte le prix ferme et la tolérance.
Mais c'est le nombre qui la désigne, par `trancheDesPieces()` — la recopie de
la requête de la base (`plafond_articles >= p_articles_max order by asc limit
1`). ⚠️ Un brouillon écrit AVANT le champ n'a pas de nombre, seulement une
tranche : sans repli il revenait avec 43 appareils au-dessus d'un champ vide.

**Et l'onboarding de l'abonnement demandait des RÉFÉRENCES.** Changé le même
jour (sur `main`) : un magasin de 3 000 références porte 50 000 pièces, et
c'est la seconde qui dit le travail. La réponse change de clé en même temps que
la question (`volume` → `pieces`) — réutiliser le nom aurait rangé deux
réponses incomparables sous la même étiquette. Bornes alignées sur la grille à
la demande, et une garde du chantier compare les deux.

**⚠️⚠️ LE PARCOURS CONNECTÉ NE DEMANDAIT JAMAIS LE LIEU.** Il sautait l'étape
du compte et réservait depuis l'écran du prix. Invisible tant que la licence se
passait d'adresse ; depuis que le code postal est exigé (migration
`20261010250001`), le client qui revient se faisait refuser puis renvoyer à
l'étape 1 — l'écran du VOLUME, sans champ d'adresse. Le commentaire de
`etapeDuRefus` affirmait encore « pour une licence, ces refus ne peuvent pas
survenir » : une note d'état devenue fausse, qui cachait le cul-de-sac.
L'écran du compte sert désormais les deux profils, et la liste des
établissements — qui n'existait que dans la formule équipe — est écrite une
fois et rendue deux.

**Décision de Julien, sur maquette : UN magasin par réservation.** Pas de
multi-magasin dans le tunnel. Les deux autres lectures avaient été chiffrées
devant lui : trois boutiques de 12 000 pièces valent 341 € si le prix suit les
appareils une seule fois (36 000 pièces → 11 appareils), 1 023 € si chaque
magasin porte sa licence. Il a choisi de ne pas trancher ce prix maintenant et
de rendre la répétition facile : `?etablissement=<id>` sur chaque bouton
« Réserver — 341 € », que le tunnel lit et applique.

**⚠️ Le cadre du calendrier, et le piège qu'il cache.** La page passée au
blanc, le calendrier flottait. Il prend un filet. Mais griser les cases pour
les voir efface la SEMAINE D'ACCÈS : `--bg` (#f2f3f1) et `--accent-soft`
(#e7ede9) sont à 25 d'écart par canal, contre 64 depuis le blanc. Essayé, vu,
repris — la garde pose son seuil entre les deux mesures.

**⚠️ Et une garde aveugle, trouvée en la sabotant.** Son découpage d'étape
s'arrêtait au premier bloc ; l'étape 4 en a deux (avec prix et sans), et la
version naïve laissait passer exactement le défaut qu'elle surveille. Le
sabotage n'est pas une formalité.

**Reste à éprouver** : le parcours connecté de bout en bout (il demande une
authentification), et le prélèvement du septième jour — toujours le troisième
des quatre appels Stripe jamais joués.
