# Le libre-service : changer d'offre, ajouter un magasin (4 septembre 2026)

*« Nous avons une offre claire aujourd'hui, plus besoin de passer par un devis
pour quoi que ce soit. Donc il faut créer les produits pour les magasins
supplémentaires, appareils supplémentaires. »*

Le bouton « Passer à Advanced » de la fiche magasin menait à `/tarifs` faute de
mieux : le client y relisait ce qu'il venait de lire, puis devait nous écrire.
Et ajouter un magasin restait une demande, un devis, une attente. Les deux
gestes se font maintenant en ligne, du clic au paiement.

Migration `20260904240001`, fonction edge `libre-service`, composant
`web/components/PayerEnLigne.tsx`.

## ⚠️ LA RÈGLE QUI COÛTE DE L'ARGENT SI ON L'INVERSE

**Un changement d'offre a deux chemins, et ils ne sont pas interchangeables.**

| L'entreprise… | Chemin | Pourquoi |
|---|---|---|
| n'a **pas** d'abonnement Stripe | session Checkout, comme une souscription | rien à modifier |
| en **a** un | on **modifie son article** (`proration_behavior: always_invoice`) | un second Checkout ouvrirait un **second abonnement**, et le client paierait les deux offres en même temps |

`deposer_changement_offre` refuse donc le second cas (`code:
'abonnement_en_cours'`), et c'est l'edge qui prend le chemin d'API. Rien à
l'écran ne signalerait la double facturation : c'est le genre de défaut qu'on
découvre sur un relevé bancaire, des semaines plus tard.

**Aujourd'hui aucune entreprise n'a d'abonnement** — les deux en base sont des
comptes d'essai, et un client venu par devis n'en a pas non plus. Tout le monde
passe donc par Checkout, et le chemin d'API n'a encore jamais servi.

## Le parcours réutilise celui du 22 août, vérifié de bout en bout

Une demande naît directement en **`accepted`** (il n'y a rien à négocier), la
session Checkout s'y attache, et `fulfil_paid_request` la mène à `created`.
**Aucun second chemin de création** : c'est ce qui a évité, jusqu'ici, que deux
façons de créer un magasin divergent.

- **Un troisième genre de demande, `kind = 'offre'`**, dans `store_requests`
  plutôt que dans une table à lui. La table porte déjà `devices`,
  `billing_period`, les lignes de devis et tous les `stripe_*` — et surtout elle
  est **déjà branchée** sur `attach_checkout_session`, sur `fulfil_paid_request`
  et sur la purge. Une table de plus, ce serait un quatrième chemin à tenir
  d'accord avec les autres.
- **Un `kind = 'offre'` porte un `store_id` DÈS LE DÉPART** : le magasin existe,
  il n'y a rien à créer. D'où la branche du webhook qui **met à jour** au lieu
  d'insérer — un test vérifie qu'elle ne contient ni `gen_store_code` ni
  `insert into public.stores`, faute de quoi un changement d'offre fabriquerait
  un second magasin avec un second code d'accès.
- **Elle n'écrase jamais un abonnement déjà enregistré**
  (`coalesce(stripe_subscription_id, v_sub)`) : ce serait perdre la trace de ce
  que le client paie déjà.

## ⚠️ `prix_offre` : une QUATRIÈME copie de la grille, et elle est nécessaire

Le réflexe est de faire porter le montant par l'appelant, comme
`deposer_souscription` — mais **celle-là est appelée par l'edge en clé de
service**, alors que les deux dépôts du libre-service sont appelés **avec le
jeton du client** (règle du 22 août : une fonction edge n'ajoute aucun droit).
Un administrateur d'entreprise pourrait donc se déposer une demande à un
centime. **Le prix doit venir du serveur.**

Les quatre copies, et ce qui les tient : `web/lib/offres.ts` (euros, le site),
`subscribe-online` (centimes, l'edge publique), les paliers de
`plafond_appareils`, et `prix_offre`. Un test compare la dernière à la première,
palier par palier, supplément compris.

**Corollaire** : `libre-service` ne recopie **aucune** grille. Elle appelle
`prix_offre` et n'en retient que le nom du plan — assez pour choisir le Price,
pas assez pour inventer un montant. Un test refuse tout montant de la grille
dans ce fichier.

## ⚠️ LA GARDE SE DEMANDE, ELLE NE SE DÉDUIT PAS

Le refus `abonnement_en_cours` n'arrive qu'**après** la garde de
`deposer_changement_offre` : le recevoir prouve donc que l'appelant était
autorisé, et l'edge pourrait s'en contenter. Elle ne le fait pas.
`peut_changer_offre` est appelée explicitement, avec le jeton du client, avant
tout appel en clé de service.

Une autorisation qui tient à l'ordre des `if` d'une autre fonction se perd au
premier réagencement, **sans que rien ne le signale**. Sur le chemin de
l'argent, la garde se demande.

## Ce qui a dû être fermé à côté

Trois portes que le nouveau genre de demande ouvrait sans qu'on y pense :

- **`admin_fulfil_store_request` refuse tout genre autre que `add`.** Une
  demande `offre` passe par `paid` comme une autre : sans ce refus, le bouton
  « Créer le magasin » de la fiche entreprise **fabriquait un doublon**.
- **`admin_pipeline` range un changement d'offre sous `store_offer`**, plus sous
  `store` — sans quoi la console proposait le même bouton.
- **`admin_quote_store_request` le refuse aussi**, avec son propre message : un
  changement d'offre se règle en ligne, il ne se devise pas.

## Les Price, et les deux qui manquent

⚠️ **Les Price sont posés en secrets, JAMAIS créés par le code.** Les six de la
grille existent (Julien les a recréés le 4 septembre). **Deux s'y ajoutent**,
pour les appareils supplémentaires par tranche de dix :

```
STRIPE_PRICE_APPAREILS_MONTHLY    64 €
STRIPE_PRICE_APPAREILS_YEARLY     690 €
```

Ils portent une **quantité** — le nombre de tranches — et c'est ce qui permet à
un seul Price de couvrir n'importe quel dépassement sans qu'aucun montant soit
fabriqué à la volée.

⚠️ **POSÉS LE 4 SEPTEMBRE 2026 À 17 h 09, et vérifiés le 5** — cette section
a dit « restent à poser » pendant une journée entière, et je l'ai répétée à
Julien le 5 septembre au lieu d'aller regarder. `supabase secrets list` répond
en une commande. **Une liste de « reste à faire » se barre quand c'est fait**,
sinon elle devient la source d'une réponse fausse.

Montants relevés sur les pages de paiement réelles, en test, par le parcours
d'inscription complet (140 appareils = Enterprise + 4 tranches) :

| | mensuel | annuel |
|---|---|---|
| Quantinvo Enterprise | 890,00 € | 9 450,00 € |
| Appareils supplémentaires · Qté 4 | 64,00 € chacun = 256,00 € | 690,00 € chacun = 2 760,00 € |
| **Total** | **1 146,00 €** | **12 210,00 €** |

C'est exactement ce que rend `prix_offre`. ⚠️ **Et c'est le montant AFFICHÉ qui
fait foi, pas le fait que la session s'ouvre** : une inversion mensuel/annuel
ouvre une page tout aussi valide.

## Ce qui porte les écrans

- **`PayerEnLigne` est une seule définition, parce que c'est un seul geste.**
  Deux panneaux de paiement divergeraient au premier ajustement, et c'est le
  chemin de l'argent : ce qui diverge là se paie en euros.
- **⚠️ AUCUN REPLI SUR UNE RPC DIRECTE**, et c'est un **renversement assumé**.
  Le repli avait un sens tant qu'une demande de magasin n'était qu'un signal
  (« une demande qui passe sans accusé vaut mieux qu'une demande qui ne passe
  pas »). Depuis qu'il y a un paiement derrière, sans la fonction edge il n'y a
  pas de session Stripe : déposer la demande quand même laisserait quelqu'un
  persuadé d'avoir payé. C'est la règle de `/souscrire`.
- **⚠️ `invoke` JETTE le corps d'un refus**, or c'est là que vit le message
  utile (« votre forfait couvre déjà 20 appareils », « pas encore ouvert »). On
  le relit sur la `Response` portée par l'erreur.
- **Les deux rythmes s'affichent**, en deux boutons et non un menu déroulant :
  le choix porte deux prix, et un menu les cacherait tous les deux jusqu'au
  clic — or c'est justement la comparaison qu'on veut rendre facile.
- **Le bouton dit l'action, jamais le montant** — « Passer à Advanced »,
  « Créer le magasin ». Les prix sont écrits juste au-dessus.
- **Un changement d'offre ne s'affiche pas parmi les demandes de magasin** de
  `/magasins` : il porte le même genre de ligne, il se lit sur la fiche du
  magasin concerné.

## ⚠️ Le webhook DIT au client ce qu'il vient de payer

Trouvé en relisant le webhook après coup : il n'envoyait d'e-mail que pour
`company` et `store`. Un changement d'offre à 310 € serait passé **sans un mot**
— rien d'autre qu'un reçu Stripe, et rien qui dise de combien le forfait a
bougé. Branche `store_offer` ajoutée, et l'avis interne ne dit plus « a réglé le
magasin X » pour un magasin qui existait déjà.

## Six gardes réorientées, aucune affaiblie

Le nouveau parcours a fait tomber six tests, et chacun défendait le devis :

- `demande-magasin.test.ts` exigeait `rpc('ca_request_store')` sur `/magasins`,
  `p_devices` dans la page, et le **repli** sur la RPC. Les trois portent
  désormais sur le libre-service — et le troisième garde exactement l'inverse :
  **qu'il n'y ait PAS de repli**.
- `devis.test.ts` comptait `tax_rates: [p.taxRateId]` **trois fois** dans
  `_shared/stripe.ts`. Un compte se périme au premier chemin ajouté : la garde
  vérifie maintenant, fonction par fonction, que **toute forme de paiement porte
  le taux**.
- `stripe.test.ts` lit `revoke all on function public.fulfil_paid_request(…)
  from public, anon, authenticated` **sur une seule ligne** depuis le 22 août.
  L'avoir coupée en deux dans la migration a fait tomber une garde qui protège
  la porte du webhook. ⚠️ **Une mise en forme de migration peut casser une
  garde** : la ligne est remise d'un seul tenant.

## Vérifications

- **En base, en transactions annulées**, sur les fonctions réellement
  appliquées : les dix refus et acceptations des deux dépôts (déjà couvert,
  rythme inconnu, 1 200 appareils, magasin d'un autre client, nominal, rejeu,
  doublon de nom, doublon de demande, zéro appareil) ; puis le parcours complet
  — dépôt → session → webhook — qui **met La Samaritaine à 7 appareils et
  372 000 c/an sans créer de magasin**, tandis que la branche `add` en crée bien
  un ; le rejeu du même événement répond `already` ; la console refuse de créer
  un magasin sur une demande `offre`.
- **Zéro résidu contrôlé** : 0 demande, 2 magasins, La Samaritaine revenue à
  2 appareils sans abonnement.
- **La matrice des droits** : `anon` sur aucune des six fonctions ;
  `etat_abonnement_magasin`, `appliquer_changement_offre` et
  `fulfil_paid_request` fermées aussi à `authenticated`.
- **Dépôt et base identiques** : MD5 sur les corps normalisés (commentaires et
  blancs retirés) des dix fonctions touchées.
- **Sept sabotages, sept échecs** : le refus du second abonnement, la création
  dans la branche `offre`, le Price vérifié avant l'écriture, la grille
  recopiée dans l'edge, le repli sur une RPC directe, le taux de TVA sur le
  changement de prix, l'écran qui contourne la fonction edge.
- **Les deux fonctions edge sont déployées** — `libre-service` en v1 **avec**
  vérification de jeton (celui qui appelle a un compte), `stripe-webhook` en v23
  avec `--no-verify-jwt`. `verify_jwt` **relevé sur la base avant** de déployer,
  recontrôlé après : rien n'a bougé. Les fichiers téléchargés depuis la
  production sont **identiques à l'octet près** au dépôt. Et en direct, par
  `pg_net` : `libre-service` répond **401 sans jeton** (donc la vérification est
  bien active), `stripe-webhook` **405** sur GET et **400 « signature absente »**
  sur un POST nu.
- 1 055 tests du site, `tsc --noEmit`, `eslint .` à zéro erreur, `next build`
  avec la table de routes inchangée.
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), clair
  et sombre, à 1 280 et 900 px : le bandeau ambre avec son panneau de paiement,
  et la création d'un magasin à 137 appareils (Enterprise prolongé, 1 146 €/mois
  ou 12 210 €/an — les mêmes montants que `prix_offre`). **Débordement
  horizontal nul.**

**⚠️ CE QUI N'EST PAS PROUVÉ, ET NE PEUT PAS L'ÊTRE ICI : aucun euro n'a
circulé.** Le chemin d'API — celui d'un client qui a déjà un abonnement — n'a
jamais tourné contre Stripe, et il n'existe aucune entreprise pour l'exercer.
Ce qui est prouvé, c'est que la base répond juste et aux bonnes personnes, que
les deux fonctions edge démarrent et refusent ce qu'elles doivent refuser, et
que rien ne s'écrit quand un Price manque.

Tests de garde : `web/tests/libre-service.test.ts`.

## ⚠️ Le séparateur de milliers était là, et il ne se voyait pas (4 septembre 2026)

Julien, capture à l'appui : *« n'oublie pas le séparateur des milliers, tu as
laissé 1146 alors qu'année on a 12 210, harmonise »*.

**Les deux portaient pourtant le même caractère.** `fr-FR` pose une espace
insécable **étroite** (U+202F), et `euros()` la posait à la main. Le défaut
n'était donc pas un séparateur manquant : c'était un séparateur **invisible** à
quatre chiffres, à la taille du texte courant. Sur « 12 210 » l'œil l'attrape,
sur « 1 146 » non — et on lit « 1146 ».

⚠️ **Ne pas conclure d'une capture qu'un formatteur est cassé** : ici il ne
l'était pas. Ce qui a tranché, c'est la lecture des points de code dans le DOM
(`charCodeAt`), pas l'image — et pas non plus un `node -e` retapé à la main, qui
a d'abord *innocenté* `euros()` en substituant une espace ordinaire au caractère
réel du fichier.

Le séparateur est désormais l'espace insécable **ordinaire** (U+00A0) : elle se
voit, et elle ne casse pas un montant en fin de ligne.

- **Un seul point de vérité de chaque côté** : `grouper()` dans
  `web/lib/format.ts`, son jumeau dans `src/lib/nombres.ts`. Tout passe par eux
  — `fmtQty`, `money`, `moneyCourt`, `nb`, `octets`, et `euros` de
  `lib/offres.ts`.
- **Plus aucun `toLocaleString('fr-FR')` nu sur un nombre** dans les écrans :
  les quinze appels directs (rapport, écarts, pagination, journal, console,
  pipeline, mesure) passent par `nb` ou `money`. C'est ce qui rend la règle
  tenable — sinon le prochain écran repart avec l'étroite.
- **Rien ne change pour les exports** : c'est de l'affichage, et aucun tableur
  ne relit l'une ou l'autre de ces espaces comme un chiffre. `parseDecimal` les
  retire toutes les deux.
- **⚠️ Un attendu de test ne se tape pas à la main et ne se reconstruit pas
  depuis ICU** : il se reconstruit avec le formatteur du produit
  (`` `${nb(4_500)} €` ``). Deux gardes citaient U+202F en dur et une troisième
  le rebâtissait par `toLocaleString` — les trois seraient retombées au
  prochain ajustement.

Tests de garde : `web/tests/format.test.ts`, bloc « le séparateur de milliers se
VOIT » — dont celui qui refuse U+202F dans la sortie des six formatteurs.

## ⚠️ Un paiement abandonné ne bloque pas (4 septembre 2026)

Constat de Julien **une heure après la mise en ligne du libre-service**,
capture à l'appui : il ouvre la page de paiement, fait retour sans payer, et sa
demande s'affiche « DEVIS ACCEPTÉ » — sans bouton pour payer, sans bouton pour
annuler, et sans pouvoir la refaire, le doublon de nom la refusant. **Trois
portes fermées d'un coup.**

⚠️ **L'ÉTAT N'ÉTAIT PAS FAUX, IL N'AVAIT PAS DE SORTIE.** Une demande en
`accepted` sans paiement est parfaitement normale : une session Checkout dure
vingt-quatre heures, et fermer l'onglet est le geste le plus banal du monde. Ce
parcours-là n'avait simplement pas été déroulé — j'avais construit le chemin qui
marche. C'est mot pour mot le reproche de la mémoire « penser le concept jusqu'au
bout » : dérouler le parcours ENTIER, y compris celui où la personne renonce.

Migration `20260904250001`, action `reprendre` sur `libre-service`, composant
`ReprendrePaiement`.

- **Le libellé mentait.** « Devis accepté » est celui de l'autre parcours ; le
  libre-service dépose en `accepted` parce qu'il n'y a rien à négocier. L'écran
  écrit désormais **« Paiement à finir »**.
  · ⚠️ **Le discriminant est le jeton de devis** — une demande devisée en porte
    un, le libre-service jamais. Côté base c'est `quote_sent_at`, qui n'existe
    que si un devis est parti.
- **Deux sorties, sur les DEUX écrans** : « Reprendre le paiement » et
  « Annuler ». La fiche d'un magasin porte les mêmes pour un changement d'offre
  impayé — sinon le cul-de-sac s'y recopiait à l'identique, le dépôt refusant un
  second changement (`deja_en_cours`) sans que rien ne dise quoi faire.
- **⚠️ `ca_cancel_store_request` n'annule JAMAIS un devis accepté.** Celui-là
  porte un accord signé sur un montant négocié : y renoncer est une
  conversation, pas un bouton. Elle n'ouvre l'annulation qu'à ce qui n'a jamais
  été devisé **et** n'a rien encaissé (`paid_at is null`).
- **⚠️ `reprendre` NE REDÉPOSE RIEN** : ce qu'on achète est relu sur la demande,
  jamais repris du corps de la requête — sinon on pourrait changer d'offre entre
  le dépôt et le paiement. Il refuse aussi un devis : celui-là se règle depuis
  son lien, qui porte le document signé.
- **⚠️ ON RELIT LA SESSION AVANT D'EN CRÉER UNE NEUVE.** Une session encore
  ouverte se rouvre telle quelle : c'est le même paiement, pas un second (motif
  du 22 août). Et **la clé d'idempotence doit changer quand l'ancienne est
  morte**, sinon Stripe rejoue la session expirée et rend une URL inerte — le
  rang de tentative se déduit de l'âge de la demande par tranches de
  vingt-quatre heures, la durée de vie d'une session, sans rien avoir à compter
  quelque part.
- **La proposition d'offre s'efface tant qu'un paiement attend** : proposer
  d'acheter ce qu'on est en train d'acheter n'a pas de sens.

Vérifié en base, en transactions annulées : un devis accepté et une demande
déjà payée refusent l'annulation, une demande de libre-service l'accepte ; un
superviseur ordinaire est refusé sur les deux fonctions, l'administrateur
d'entreprise passe. Et en direct sur la fonction déployée (v4, `verify_jwt`
toujours vrai) : `reprendre` répond **403** à un compte qui n'est pas
administrateur — la branche est atteinte et gardée. Quatre sabotages, quatre
échecs.

Tests de garde : `web/tests/libre-service.test.ts`, bloc « un paiement abandonné
ne bloque pas ».

## Le rythme se change avant de payer (4 septembre 2026)

Julien, sur sa demande en attente : *« j'aimerais pouvoir changer le mode de
paiement mensuel ou annuel […] je suis obligé d'annuler ma demande et de
recommencer. »*

Il a raison, et c'est **le même geste** : même magasin, mêmes appareils, même
offre — seule l'échéance change. Annuler puis refaire, c'est perdre la trace et
rejouer les contrôles de doublon pour rien. Les deux échéances, avec leurs deux
prix, sont désormais sur la demande elle-même.

⚠️ **CE QUE ÇA NE CONTREDIT PAS.** La règle posée la veille avec `reprendre` —
*ce qu'on achète est relu sur la demande, jamais repris du corps de la requête*
— visait UNE chose : qu'un client ne puisse pas fixer son prix. Elle tient
intégralement, parce que `changer_rythme_demande` **recalcule le montant par
`prix_offre`**, en base, à partir des appareils déjà déposés. Le client choisit
une échéance, pas un montant — et les appareils, eux, restent hors de sa portée
(un test refuse `Number(corps.devices)` dans cette branche).

- **⚠️ LA SESSION STRIPE SE JETTE, ET C'EST LE POINT QUI COÛTE DE L'ARGENT.**
  Elle porte l'ancien prix : la rouvrir ferait payer le mensuel à qui vient de
  choisir l'annuel. `stripe_checkout_session_id` passe à `null` dans la même
  écriture que le rythme — c'est le seul endroit du produit où une session
  s'oublie, et c'est parce qu'elle ne décrit plus la demande.
- **⚠️ ET LA CLÉ D'IDEMPOTENCE PORTE MAINTENANT LE PRIX**
  (`abonnement-<demande>-<price>-<tentative>`). Jeter la session ne suffisait
  pas : avec l'ancienne clé, Stripe aurait **rejoué la session du rythme
  précédent** et rendu son URL — le client aurait payé ce qu'il venait de
  quitter. Deux rythmes, deux Price, donc deux clés. Les quatre fonctions qui
  embarquent `_shared/stripe.ts` ont été redéployées pour ça.
- **Rien ne bouge sur un devis**, ni sur ce qui est encaissé : un devis porte un
  montant négocié et un document signé, dont l'échéance fait partie.
- **Rejouer le même rythme répond `already`**, pas une erreur — un second clic
  ne doit rien casser.
- `ChoixRythme` est une seule définition, partagée par l'achat et la reprise :
  deux sélecteurs de la même chose divergeraient au premier ajustement.

Vérifié en base, en transaction annulée, sur la demande réelle : 1 146 € en
mensuel → 12 210 € en annuel, `annuelCents` recalculé, **session effacée** ;
rejeu du même rythme `already` ; rythme inconnu et devis refusés. Trois
sabotages, trois échecs. Au navigateur, clair et sombre, à 1 280 et 900 px,
débordement horizontal nul.

Tests de garde : `web/tests/libre-service.test.ts`, bloc « le rythme se change
avant de payer ».

## ⚠️ Le prix dit comment il se compose (4 septembre 2026)

Julien, sur la page de paiement Stripe : *« pourquoi j'ai 12 210 € alors que je
paie que pour ajouter 10 appareils ? J'ai un Qté 4, pourquoi ? »*

**Le montant était juste.** Il avait saisi 137 appareils : Enterprise en couvre
100, plus 4 tranches de dix — 140 couverts, 9 450 € + 4 × 690 €. Stripe
décompose en deux lignes ; **notre écran, lui, n'annonçait que le total** et
taisait l'addition qui y mène. Le « Qté 4 » se découvrait sur la page de
paiement, c'est-à-dire trop tard.

⚠️ **ET LA TRANCHE ENTAMÉE SE PAIE ENTIÈRE** : 137 demandés, 140 couverts,
4 tranches et non 3. C'est la règle de la grille depuis le 30 août, et elle ne
se devine pas. Un client qui la découvre sur une facture la découvre trop tard.

`compositionOffre()` (`web/lib/appareils.ts`) rend « 100 appareils + 4 tranches
de 10 » — et **`null` tant qu'on est dans un palier**, où il n'y a rien à
décomposer et où une phrase de plus ne ferait qu'alourdir. Affichée aux deux
endroits qui annoncent une offre : le panneau d'ajout de magasin et le bandeau
de la fiche.

⚠️ **La leçon dépasse ce cas : quand un tiers décompose ce qu'on présente en
bloc, c'est nous qui devons décomposer d'abord.** La page de paiement est le
dernier endroit où l'on veut qu'un client apprenne quelque chose.

Tests de garde : `web/tests/libre-service.test.ts`, bloc « le prix dit comment
il se compose » — dont celui qui vérifie que le prix décomposé fait bien le
total.
