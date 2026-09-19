# La souscription en ligne (30 août 2026)

*« Branche Stripe pour la souscription en ligne. »* Les trois offres se
souscrivent par carte, sans devis : le prix est public et le client l'a choisi
sur `/tarifs`. Grille et raisonnement : `docs/entreprise/hypotheses-tarifaires.md`,
hypothèse 4.

## Le parcours réutilise celui du devis — c'est le point porteur

Une souscription **est** une `company_requests`, née directement en
**`accepted`** : il n'y a rien à négocier. Le webhook existant la mène à
`created` par `fulfil_paid_request`, sans que sa garde de transition change —
elle exige `accepted`, elle le trouve.

**Ne pas écrire un second chemin de création d'entreprise.** C'est ce qui a
évité, jusqu'ici, que deux façons de créer divergent — la même raison qui fait
qu'`admin_fulfil_store_request` appelle `admin_add_store` au lieu de recopier
la génération du code.

Migrations `20260830130001` (colonnes + `fulfil_paid_request`) et
`20260830130002` (`deposer_souscription`, `sync_subscription_status`).

## Ce qu'il reste à faire pour que ça encaisse vraiment

⚠️ **Rien n'est encaissable tant que les six Prices ne sont pas posés.** Ils se
créent dans le tableau de bord Stripe (Produits → Prix récurrents), puis
s'ajoutent en **secrets d'edge functions**, un par couple offre × rythme :

```
STRIPE_PRICE_ESSENTIAL_MONTHLY    STRIPE_PRICE_ESSENTIAL_YEARLY
STRIPE_PRICE_ADVANCED_MONTHLY     STRIPE_PRICE_ADVANCED_YEARLY
STRIPE_PRICE_ENTERPRISE_MONTHLY   STRIPE_PRICE_ENTERPRISE_YEARLY
```

⚠️ **Les Prices ne sont JAMAIS créés par le code.** Un prix créé à la volée est
un prix que personne n'a relu, et il serait facturé à un vrai client. Un test
refuse `price_data` dans le mode abonnement.

Tant qu'un secret manque, l'offre répond **503 `indisponible`** — vérifié en
direct sur la fonction déployée — et **aucune demande n'est écrite** : le Price
est lu AVANT le dépôt, sinon on laisserait une ligne morte et un client
persuadé d'avoir souscrit. Un test compare les deux positions dans le fichier.

Il faut aussi **ajouter trois événements au point de terminaison Stripe** :
`invoice.payment_failed`, `invoice.paid`, `customer.subscription.deleted`.

## Points à ne pas défaire

- **⚠️ Carte seule, pas de SEPA.** Le prélèvement convient à une facture
  annuelle d'enseigne ; son délai de règlement ferait attendre l'ouverture des
  accès plusieurs jours, après que la personne a cliqué « Souscrire ». Le
  parcours devis, lui, garde le SEPA.
- **⚠️ Un impayé ne coupe RIEN.** `sync_subscription_status` passe la licence
  en `past_due`, jamais en suspension d'accès. Couper un magasin sur un
  incident de carte, c'est bloquer un inventaire un soir de comptage — même
  règle que le plafond souple. La relance est commerciale, pas technique. Un
  test refuse les mots `suspend`, `revoke`, `delete from` et `disable` dans le
  webhook.
- **⚠️ Un abonnement inconnu répond 200**, pas une erreur : les événements de
  Stripe peuvent se croiser, et `invoice.paid` arriver avant que
  `checkout.session.completed` n'ait créé l'entreprise. Lever ferait rejouer
  Stripe sans fin sur un événement sans objet.
- **⚠️ L'ancienne signature à cinq arguments de `fulfil_paid_request` est
  SUPPRIMÉE.** `p_subscription_id` ayant un défaut, Postgres garderait les deux
  et un appel à cinq deviendrait ambigu. Même piège que `p_event_id` le 28 août
  et `ca_request_store` le 22.
- **`annual_price_cents` du magasin vaut douze mensualités** quand le rythme est
  mensuel : c'est ce que `admin_business_overview` somme pour le revenu annuel.
- **La page `/souscrire` n'a AUCUN repli sur une RPC directe**, contrairement à
  `/inscription`. Sans la fonction edge il n'y a pas de session Stripe, donc
  rien à payer : déposer la demande quand même laisserait croire à une
  souscription faite.
- **Aucune donnée bancaire ne transite par le site.** La carte se saisit chez
  Stripe. Un test refuse les attributs `cc-number`, `cvc` et voisins sur la page.
- **La grille est dupliquée** dans `subscribe-online` (centimes) et
  `web/lib/offres.ts` (euros) — le site et les edge ne compilent pas ensemble,
  comme `web/lib/devis.ts` et `_shared/devis.ts`. `web/tests/souscription.test.ts`
  compare les deux montant par montant.

## ⚠️ On refuse AVANT d'encaisser — et c'est le premier test qui l'a montré

La limite était écrite comme « à reprendre si le cas se présente ». **Elle
s'est présentée au premier essai réel** : Julien a payé avec son adresse, qui
appartenait déjà à une autre entreprise ; l'entreprise a été créée, encaissée,
et `invite_company_admin_after_payment` a refusé l'invitation (garde VR-003 du
28 août). Résultat : **0 administrateur, 0 compte, 0 invitation** — il avait
payé sans rien obtenir. Le garde-fou avait bien joué, mais après le paiement.

`deposer_souscription` contrôle donc l'adresse **avant toute écriture et avant
toute session Stripe** (migration `20260830180002`), en trois cas :

| Code | Quand | Ce qu'on dit |
|---|---|---|
| `compte_existant` | l'adresse a un profil rattaché à une entreprise | demandez vos accès à son administrateur |
| `invitation_en_cours` | une invitation attend ailleurs | ouvrez-la pour créer votre mot de passe |
| `deja_souscrit` | une souscription payée existe | vérifiez votre boîte de réception |

- **⚠️ L'ordre fait le contrôle** : validation de saisie → limitation de débit →
  recherche par adresse. Une faute de frappe ne consomme pas le quota, et un
  script ne peut pas interroger la base à volonté avant d'être freiné (leçon du
  28 août sur `submit_company_request`).
- **⚠️ On ne nomme jamais l'entreprise concernée** : le souscripteur apprendrait
  quelque chose sur un client qui n'est pas le sien. Même règle
  qu'`other_company` depuis le 22 août. Un test le vérifie.
- **Compromis assumé** : le message CONFIRME qu'un compte existe. C'est
  l'oracle d'énumération, déjà accepté le 22 août pour l'invitation d'équipe ;
  ce sont les cinq essais par heure et par adresse qui le rendent inutilisable
  pour constituer un annuaire.
- **À l'écran, un refus n'est pas une panne** : il s'affiche en ambre et non en
  rouge (`.souscrire-erreur.douce`), parce qu'il arrive avant tout encaissement
  et qu'il dit quoi faire. Faire réessayer quelqu'un que rien ne débloquera est
  la pire des réponses.

Le filet en aval **reste** : une entreprise sans administrateur remonte dans
`companies_without_admin` sur `/admin`. Il ne sert plus qu'aux cas que ce
contrôle ne peut pas voir — une adresse rattachée entre le dépôt et le
paiement.

## ⚠️ La TVA : un taux fixe, et un garde-fou contre l'oubli

Les prix sont **hors taxes** (c'est l'usage en B2B, et ce que dit la page).
Sans taux de TVA, Stripe encaisserait 225 € là où 270 € sont dus, et la
différence sortirait de la poche de l'éditeur **à chaque échéance** — une
erreur qui ne se voit qu'à la déclaration.

Un septième secret porte donc le taux : **`STRIPE_TAX_RATE`**, un `txr_…` créé
dans Stripe (Paramètres → Taxes → *Taux de taxe*), en mode **EXCLUSIF**.

- ⚠️ **Exclusif, jamais inclusif.** Un taux inclusif ne s'ajoute pas au prix, il
  le découpe : 225 € deviendraient 187,50 € HT + 37,50 € de TVA. Le client
  paierait le bon montant affiché, et l'éditeur encaisserait moins.
- ⚠️ **Il est facultatif en TEST, exigé en LIVE**, et c'est la clé Stripe qui le
  dit : `sk_live_` sans taux → refus (`tva_absente`, 503). C'est le seul endroit
  du produit où un oubli de configuration coûte de l'argent en silence, donc le
  seul qui mérite un refus plutôt qu'un repli.
- **Le taux de `web/lib/offres.ts` (`TVA = 0.2`) n'AFFICHE que.** C'est le taux
  Stripe qui fait foi sur la facture. Les deux doivent bouger ensemble ; un test
  vérifie que le module rappelle où vit l'autre.
- **Le TTC s'affiche sur `/souscrire` et nulle part ailleurs** : c'est le
  montant qui sera prélevé, et le bouton l'annonce (« Payer 270 € TTC »).
  Partout ailleurs le prix reste hors taxes. Annoncer le HT jusqu'au bout ferait
  découvrir l'écart sur le relevé bancaire.

Stripe Tax (calcul automatique selon le pays, autoliquidation
intracommunautaire) reste la suite naturelle le jour où un client hors de
France souscrit : il remplace le taux fixe sans rien changer d'autre.

## Vérifications (30 août 2026)

**Sur les fonctions déployées** : `subscribe-online` répond 405 sur GET (donc
le code est atteint sans JWT), 400 sur un corps illisible, « Offre inconnue »
sur un plan invalide, et **503 `indisponible` sur une offre valide** — les
Prices n'étant pas encore posés. `stripe-webhook` répond toujours 400
« signature absente ».

**En base, en transaction annulée** : dépôt → `accepted` avec plan, rythme et
ligne de devis ; `fulfil_paid_request` crée l'entreprise **avec son plan, son
rythme, son abonnement et son client Stripe**, et le magasin avec
`annual_price_cents = 270000` pour un mensuel à 225 € ; le rejeu du même
événement répond `already` sans créer de seconde entreprise ; le cycle de vie
enchaîne `past_due → active → canceled`, son rejeu répond `already`, et un
abonnement inconnu répond `unknown` sans erreur. **Zéro résidu contrôlé après
coup**, quota de limitation compris.

**Vérifié en vrai le 30 août 2026** — les six Prices posés en mode test, puis
un paiement complet par Julien avec la carte `4242` :

- **les six tarifs contrôlés un par un sur les pages Stripe elles-mêmes**
  (65 €/mois, 690 €/an, 225 €/mois, 2 400 €/an, 650 €/mois, 6 900 €/an) — c'est
  le contrôle qui comptait, une inversion mensuel/annuel aurait facturé 690 €
  par mois ;
- le parcours complet : demande → `created`, entreprise avec `plan=advanced`,
  `billing_period=monthly`, abonnement et client Stripe liés, licence `active`,
  magasin à `annual_price_cents = 270000`, journal signé « Stripe » ;
- **et le défaut ci-dessus**, qui n'aurait pas été trouvé autrement.

Données d'essai supprimées, zéro résidu contrôlé. **Le journal du test est
conservé** (règle du projet) ; seules les six sondes de vérification des tarifs
ont été retirées.

⚠️ **L'abonnement Stripe de test reste actif** côté Stripe : il se représentera
dans un mois. Sans conséquence en mode test, mais à annuler dans le tableau de
bord.

Tests de garde : `web/tests/souscription.test.ts`.
