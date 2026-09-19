# Le chemin d'API a enfin tourné — et il était cassé (11 septembre 2026)

*« Le chemin d'API n'a jamais tourné »* traînait dans ce fichier depuis le
4 septembre : le changement d'offre d'une entreprise qui a **déjà** un
abonnement Stripe. Aucune n'en avait, donc rien ne pouvait le déclencher.

Il a été exercé pour de vrai, en mode test, et **il ne marchait pas**.

## ⚠️ LE DÉFAUT : LA CLÉ STRIPE EST RESTREINTE, ET PERSONNE NE L'A ÉLARGIE

La clé a été créée le 22 août 2026 en moindre privilège — Checkout Sessions,
Customers, Invoices, Products, Prices, **et rien d'autre**. C'est une bonne
décision, elle n'est pas en cause.

Le libre-service, écrit le 4 septembre, a ajouté deux appels que cette clé
n'avait pas le droit de faire :

| Appel | Permission |
|---|---|
| `GET /v1/subscriptions/{id}` | Subscriptions · **lecture** |
| `POST /v1/subscription_items/…` | Subscriptions · **écriture** |

Stripe répondait `403 more_permissions_required`. **Tout changement d'offre
d'un client abonné échouait**, et rien dans le dépôt ne pouvait le voir : les
gardes lisent le code source, elles ne parlent pas à Stripe.

⚠️ **ET IL FAUDRA REFAIRE EXACTEMENT ÇA SUR LA CLÉ `live`.** C'est le genre
d'oubli qui ne se manifeste qu'au premier client qui change d'offre — donc
après l'encaissement. À mettre dans le lot de la bascule en live, avec les
mentions légales et la réouverture de la vente.

## ⚠️ LA SECONDE MOITIÉ DU DÉFAUT ÉTAIT LE MESSAGE

`lireAbonnement` rendait `null` sur **toute** réponse non-OK, et l'écran
affichait « Abonnement introuvable chez Stripe ». Or un refus de Stripe a
trois causes qui ne se corrigent pas du tout pareil — l'abonnement n'existe
pas (404), la clé n'a pas le droit de le lire (403), la clé est du mauvais
mode (401). Les confondre, sur le chemin de l'argent, coûte une journée.

Elle lève désormais avec le statut **et** le corps de la réponse — c'est le
corps qui nomme la permission manquante — et la fonction edge le fait
remonter dans `detail`. Tests de garde : `web/tests/libre-service.test.ts`,
bloc « un refus de Stripe dit POURQUOI ».

## Ce qui a été prouvé, une fois la clé élargie

Parcours réel : ajout d'un magasin à **137 appareils en mensuel** (Enterprise
+ 4 tranches, donc **deux lignes** chez Stripe — le cas où les tranches
pouvaient être facturées deux fois), paiement carte de test, puis changement
à **150 appareils**.

| | |
|---|---|
| Chemin A exécuté | `success: true, applique: true` — **aucune page de paiement** |
| Abonnement | **le même**, `sub_…PLjvV1` — aucun second abonnement créé |
| Lignes chez Stripe | **deux**, pas trois : Enterprise ×1 · Appareils **×5** |
| Journal Stripe | `POST /v1/subscription_items/si_…flR 200` — il **modifie** l'article existant |
| Prorata | facturé tout de suite, **63,97 €** — une tranche, pas deux |
| En base | 150 appareils, 14 520 €/an, les deux `stripe_item_*` enregistrés |
| Journal d'entreprise | une seule ligne `offre_appliquee · 150` |
| TVA | aucune ligne — conforme à la franchise en base |

⚠️ **Le correctif du 4 septembre (« on ne facture pas les tranches deux
fois ») est donc confirmé en exécution**, et plus seulement par lecture du
code. C'est le seul des quatre défauts de ce parcours qui n'avait jamais été
exercé.

## Ce qui n'est toujours pas prouvé

- **Le mode `live`** : tout ceci est en sandbox, et la clé `live` n'a pas
  encore les permissions Subscriptions.
- **Le changement d'ÉCHÉANCE sur un abonnement en cours** (mensuel → annuel).
  Le sélecteur est à l'écran ; ce qu'il fait à un abonnement mensuel existant
  n'a pas été essayé, et ce n'est pas la même opération Stripe.
- ~~**Le cas bancal du deuxième magasin**~~ — **CONFIRMÉ PUIS CORRIGÉ LE
  16 SEPTEMBRE 2026**, voir « L'abonnement est un cumul » en fin de fichier.

## Méthode

- **Le parcours a été conduit dans le Chrome de Julien**, qui porte sa
  session. Deux gestes seulement lui reviennent et ne se délèguent pas : la
  connexion, et la saisie de la carte de test.
- **⚠️ Le `detail` d'une réponse ne se lit pas à l'écran.** `read_network_requests`
  ne capte pas le `fetch` de supabase-js. Ce qui a marché : poser un
  intercepteur sur `window.fetch` depuis la page, rejouer le geste, relire.
- **⚠️ Une garde qui découpe sur `indexOf` doit vérifier que l'ancre existe** :
  `indexOf` rend **-1** sur ce qu'il ne trouve pas, et `slice(-1)` rend le
  dernier caractère — la garde passe alors sur un fichier qui ne contient plus
  l'appel. Attrapé en l'écrivant ; c'est le même piège que la comparaison de
  deux positions, le 7 septembre.
- **Nettoyage** : magasin d'essai et demandes supprimés, abonnement remis à
  nul sur l'entreprise, abonnement annulé chez Stripe **sans remboursement**.
  Zéro résidu contrôlé — 2 magasins, 5 inventaires, 176 comptages, 0 demande,
  comme avant. Les deux lignes du journal d'entreprise sont **conservées** :
  ce sont des gestes réels.
- Les cinq fonctions edge qui embarquent `_shared/stripe.ts` ont été
  redéployées ; `verify_jwt` relevé **sur la base** avant, recontrôlé après,
  inchangé sur les cinq ; les cinq téléchargées et **identiques au dépôt**.
