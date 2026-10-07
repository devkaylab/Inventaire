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

## ⚠️ Deux mesures fausses, dans le banc lui-même

- `select (select etat …) from (select public.enregistrer_le_prelevement(…))`
  affichait « terminee » alors que la fonction venait de poser « payee » : les
  deux sous-requêtes lisent le **même instantané**, celui d'avant l'instruction.
  Un chiffre invraisemblable est d'abord un défaut de mesure — ici la mesure
  était fausse, le code était juste.
- Les `select` nus d'un scénario écrivent leur JSON au milieu des lignes qu'on
  lit. `do $$ begin perform … end $$;` règle les deux.

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
