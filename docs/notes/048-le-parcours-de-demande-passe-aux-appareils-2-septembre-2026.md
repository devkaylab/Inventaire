# Le parcours de demande passe aux appareils (2 septembre 2026)

*« Changement qui n'a pas été fait quand on a changé notre méthode de
facturation. Tu n'as pas adapté le formulaire d'inscription et le formulaire
d'ajout de magasin. »* Constat de Julien, et il était exact : la grille est
passée aux trois offres le 30 août, le site public affichait les prix — et les
deux formulaires réclamaient toujours un **stock théorique** et une **surface**,
pendant que le devis se calculait sur des tranches de volume. `lib/offres.ts`
le disait lui-même en commentaire : « les deux modules coexistent le temps que
le parcours d'inscription soit repris ». C'est fait.

Quatre migrations : `20260902120001` (l'assiette), `20260902120002` (le chemin
manuel), `20260902120003` (les listes rendent les appareils) et
`20260902120004` (le revenu en attente s'annualise).

## Ce que les formulaires demandent, et ce qu'ils montrent

**Un seul chiffre par magasin : le nombre d'appareils qui comptent EN MÊME
TEMPS.** Le stock et la surface ont quitté `MagasinSaisie`, donc `/inscription`
et la demande d'ajout de magasin.

- **⚠️ Contrepartie assumée, et il faut la connaître** : `alerteDensite` (le
  repérage d'un stock déclaré invraisemblable, qui fait remonter une demande en
  tête de « Ventes en cours ») et l'écran `/admin/usage` n'ont **plus de source
  sur les demandes nouvelles**. Ils ne servent plus qu'aux magasins déclarés
  avant ce jour. `lib/tarifs.ts` ne tarife donc plus rien du tout — il ne
  survit que pour eux. **Ne rien y rebrancher.**
- **Les colonnes `units` et `sqm` restent en base**, comme `stores.units`.
  Règle du projet : on retire les appels d'abord, les objets plus tard.
- **⚠️ L'offre et son prix s'affichent à la frappe, ce qui RENVERSE la décision
  du 22 août 2026.** Elle interdisait d'afficher un tarif en face du champ qui
  le détermine, et elle avait raison tant que ce champ était le stock : déclaré,
  invérifiable, il indiquait au prospect quel chiffre baisser. Le nombre
  d'appareils est d'une autre nature — il se mesure, c'est même la raison pour
  laquelle cette assiette a été retenue — et les trois prix sont publics sur
  /tarifs depuis le 30 août. Les cacher ne protégerait plus rien.
- **Ce qui NE change pas** : le recoupement stock / surface ne sort toujours pas
  de la console, et aucun montant n'est écrit en dur — tout passe par
  `lib/offres`, sinon la grille se met à exister en deux endroits.
- **⚠️ Les DEUX rythmes s'affichent** — « Advanced — 310 € / mois ou 3 300 € /
  an HT par magasin ». Un prospect qui ne lit qu'un montant annuel n'a aucun
  moyen de savoir que le mensuel existe, alors que le devis se règle dans les
  deux. Même paire que la page publique des tarifs.
- `/inscription` totalise en pied de formulaire, **dans les deux rythmes**, et
  **seulement si tous les magasins portent un chiffre** : un total partiel se
  lirait comme un total.
- **⚠️ Un prix ne se coupe pas** (`.prix { white-space: nowrap }`) : `euros()`
  groupe les milliers par une espace ORDINAIRE, et sans cette règle
  « 3 300 € / an » se casse entre le 3 et les 300 sur un téléphone.

## Le devis se règle à l'année OU au mois

Décision de Julien. La console porte une bascule ; le rythme voyage jusqu'au
PDF, jusqu'à la page publique du devis, et jusqu'à Stripe.

- **⚠️ Le rythme décide du MODE Stripe.** Annuel → `mode: payment`, carte ou
  SEPA, facture unique : le chemin vérifié de bout en bout le 22 août, inchangé.
  Mensuel → `creerAbonnementSurMesure`, abonnement carte seule. Un mois ne se
  facture pas en une fois, il se reconduit.
- **⚠️ C'est le seul endroit du produit où un prix Stripe est créé par du
  code**, et l'exception se justifie : la règle « les Prices ne sont jamais
  créés à la volée » protège les trois offres publiques, dont les montants sont
  fixes et posés en secrets. Un devis est l'inverse — son montant est négocié,
  saisi et relu par un administrateur. Aucun Price posé d'avance ne peut le
  porter. Ce que la règle interdit vraiment, c'est un prix que personne n'a relu.
- **Deux clés d'idempotence distinctes** (`checkout-…` et `devis-mensuel-…`) :
  les deux sessions ne portent pas les mêmes paramètres, et Stripe refuse une
  clé rejouée avec d'autres.
- **Changer de rythme recalcule le montant proposé**, sauf si l'administrateur
  l'a lui-même touché. Laisser un montant annuel sous un devis mensuel serait
  la faute la plus coûteuse de cet écran.

## ⚠️ LA RÈGLE DES LIGNES DE DEVIS, à connaître avant d'y toucher

Dans `quote_lines`, **`prixCents` est ce qui est facturé à l'échéance**, et
**`annuelCents` — quand il est présent — ce que le magasin vaut à l'année**.
`fulfil_paid_request` écrit donc `annual_price_cents = coalesce(annuelCents,
prixCents)`.

**Ne jamais annualiser en multipliant par douze selon le rythme.** Une ligne
sans `annuelCents` est annuelle par construction : c'est le cas de toutes celles
écrites avant cette bascule, **et de celles de la souscription en ligne**, dont
`deposer_souscription` écrit un montant DÉJÀ annuel sur une demande
`billing_period = 'monthly'`. La multiplier facturerait douze fois trop cher un
parcours vérifié en vrai le 30 août. Le seul endroit où le rythme décide est le
repli sans aucune ligne chiffrée — parce qu'il n'y a alors rien pour le dire.

## Trois choses trouvées en passant les fonctions en revue

Julien : *« passe en revue les fonctions pour être sûr qu'elles sont adaptées
aux nouvelles offres »*. Trois défauts réels, tous antérieurs à ce chantier.

1. **⚠️ `admin_fulfil_company_request` portait la grille au volume EN DUR** —
   un `case when v_units <= 10000 then 210000 …` dans le corps de la fonction.
   C'est le défaut VR-002 du 28 août (« on crée ce qui a été devisé »), corrigé
   dans le chemin payé et **jamais dans le chemin manuel**. Elle facturait donc
   au volume un client devisé aux appareils. Elle suit maintenant les lignes du
   devis, comme `fulfil_paid_request`.
2. **`admin_add_store` ne portait ni les appareils ni le prix** : un magasin
   créé par ce chemin arrivait sans assiette et sans licence, donc compté au
   panier moyen dans le revenu annuel — le défaut corrigé le 22 août pour le
   webhook, resté ici. Elle prend `p_devices` et `p_annual_price_cents`, et
   `admin_fulfil_store_request` les lui passe.
3. **Trois fonctions de LECTURE ne rendaient pas ce qu'on venait d'écrire.**
   `ca_list_store_requests`, `admin_list_store_requests` et `admin_pipeline`
   rendaient toujours `units` et `sqm` seuls : les écrans auraient affiché
   « appareils non déclarés » sur une demande qui en porte un. Le piège est
   banal et se reproduira : **une colonne ajoutée ne se voit pas tant que la
   fonction qui la lit ne la nomme pas.**
4. **⚠️ « Revenu en attente » divisait par douze sur un devis mensuel.**
   `enAttenteCents` sommait `quote_amount_cents`, c'est-à-dire l'échéance :
   1 200 € affichés pour une affaire qui en vaut 14 400 par an. Le calcul vit
   désormais en base (`annuel_du_devis`), **par la règle des lignes ci-dessus et
   pas par le rythme** — au navigateur, à partir du seul rythme, on aurait
   multiplié par douze le montant déjà annuel de la souscription en ligne.
5. **⚠️ La TVA manquait sur le parcours de devis.** `creerSessionCheckout`
   n'appliquait aucun taux : Stripe encaissait 9 450 € là où 11 340 € sont dus,
   et la différence sortait de la poche de l'éditeur. Seule la souscription en
   ligne avait `STRIPE_TAX_RATE` (posé le 30 août). Le devis l'applique
   désormais aussi — le document dit d'ailleurs « TVA non applicable sur ce
   document », c'est-à-dire que c'est la facture qui l'ajoute.

## Deux pièges de droits, relevés sur la base réelle

- **⚠️ `create` accorde EXECUTE à `anon`**, par les droits par défaut de
  Supabase — un `revoke … from public` ne le retire pas. Vérifié après
  application : `ca_request_store` et les deux `admin_quote_*` étaient
  exécutables par `anon`. C'est le constat n°6 du 28 août, qui se reproduit à
  chaque fonction nouvelle. **Le `revoke` vise `public` ET `anon`.**
- **L'ancienne signature de `ca_request_store` n'est PAS supprimée**, et c'est
  délibéré : le site en ligne et la fonction edge appellent encore avec un stock
  et une surface. Elle devient un **refus lisible** (« rechargez la page »), à
  supprimer dans une migration ultérieure une fois le déploiement fait. Ses
  quatre paramètres n'ont plus de défaut — c'est ce qui interdit l'ambiguïté
  avec la nouvelle sur un appel à deux arguments.

## ⚠️ La fonction edge de la demande de magasin avait été OUBLIÉE

Trouvé au moment de déployer, et c'est le défaut le plus instructif de ce
chantier. La page `/magasins` envoyait `devices` et la RPC avait sa nouvelle
signature — mais **`ca-request-store/index.ts` n'avait jamais été touchée** :
elle appelait encore `p_units` / `p_sqm`, donc l'ancienne signature, devenue un
refus lisible. **Toute demande de magasin passant par le chemin normal aurait
répondu « rechargez la page »** ; seul le repli RPC direct du navigateur
fonctionnait.

- **⚠️ Rien ne l'avait vu, et c'est la vraie leçon.** Le test
  « la demande transporte les appareils » ne regardait que la page. Une fonction
  edge est le chemin **nominal** — la RPC directe n'est qu'un repli —, donc une
  garde qui s'arrête au navigateur ne garde que la moitié du parcours. Le test
  lit désormais aussi `ca-request-store/index.ts` (`p_devices` présent,
  `p_units` et `p_sqm` absents).
- **Le balayage qui a suivi est le geste à refaire** : pour chaque RPC dont la
  signature bouge, chercher **tous** ses appelants dans `supabase/functions`,
  pas seulement dans `web/`. Les autres — `stripe-webhook`, `subscribe-online`,
  `admin-fulfil-store-request`, `decline-quote` — ont été vérifiés un par un et
  restent compatibles (signatures inchangées).
- L'accusé et l'avis interne disent maintenant les appareils et l'offre
  (`nomOffre` du module partagé, jamais un nom d'offre réinventé sur place) ; la
  phrase sur le « recoupement stock / surface » a disparu, elle n'a plus d'objet.

## Les quatre fonctions edge sont déployées (2 septembre 2026)

`quote-pdf` (v16), `ca-request-store` (v14), `admin-send-quote` (v14),
`accept-quote` (v16). `verify_jwt` contrôlé après coup et **inchangé** : faux
pour les deux publiques, vrai pour les deux autres.

⚠️ **Déployées par la console MCP, pas par le CLI** — contrairement à la règle
posée pour `stripe-webhook`. Le CLI n'était pas joignable depuis l'agent (pas de
`SUPABASE_ACCESS_TOKEN`, et les binaires GitHub bloqués par le proxy), et
l'accès réseau sortant vers `*.supabase.co` l'était aussi. **La règle reste
valable et `stripe-webhook` n'a pas été touchée** : elle porte la vérification
de signature, et son bundle garde sa propre copie de `_shared/stripe.ts` — la
version déployée avant ce jour, dont `verifierWebhook` n'a pas changé.

**Ce qui a été vérifié, et par quel moyen** — l'accès sortant étant fermé, tout
est passé par `pg_net` depuis Postgres :

- `quote-pdf` : 404 « Devis introuvable » sur un jeton inconnu ;
- `accept-quote` : 405 sur GET, et sur POST **elle atteint la base** (le
  « Lien invalide. » vient de `accept_quote_by_token`) — donc `email.ts`,
  `devis.ts` **et** `stripe.ts` se chargent ;
- **le PDF se dessine vraiment** : devis d'essai posé en base, `quote-pdf` rend
  200 · `application/pdf` · `%PDF-1.7`, en **mensuel puis en annuel**, avec une
  ligne sans appareils déclarés. C'est la preuve qui compte : un libellé
  nouveau qu'Helvetica n'encoderait pas ferait lever `drawText` et la fonction
  répondrait 500. Données d'essai supprimées, **zéro résidu contrôlé**.

⚠️ **Ce qui n'est PAS prouvé : l'identité à l'octet près avec le dépôt.** La
console MCP fait retranscrire les fichiers, et le `supabase functions download`
puis `diff` du projet demande le CLI. À refaire depuis le Mac au prochain
passage — c'est le seul contrôle qui ferme le sujet.

## Ce qui reste à faire, et que je ne peux pas faire

- **Les six Price Stripe restent à recréer** aux montants du 31 août : c'est le
  point qui coûte de l'argent, et il ne se voit nulle part dans le code.
- **⚠️ Un magasin ajouté en abonnement mensuel crée un SECOND abonnement
  Stripe**, alors que `companies.stripe_subscription_id` n'en porte qu'un.
  `sync_subscription_status` répondra `unknown` (donc 200, sans erreur) sur son
  cycle de vie. C'est une limite connue, pas un défaut à rattraper à l'aveugle :
  elle se traitera le jour où un client aura deux magasins mensuels.

## Vérifications

**En base, tout en transactions annulées, sur les fonctions réellement
appliquées** — données d'essai contrôlées à zéro après coup : la demande sans
appareils refusée et le message exact, la borne à 1 000, la demande nominale qui
écrit `devices`, l'ancien appel à quatre arguments qui répond le refus lisible,
le devis mensuel qui pose son rythme et le rejoue jusqu'à `quote_by_token` et
`accept_quote_by_token`, la création qui reporte les appareils **et le prix
annuel** (330 000 pour une ligne mensuelle à 31 000), le rejeu du même événement
Stripe qui répond `already`, les deux créations manuelles (entreprise et
magasin), et **la non-régression de la souscription en ligne** : 372 000 et non
douze fois plus.

**Au navigateur**, clair et sombre, sans erreur de console et sans débordement
horizontal : `/inscription` avec deux magasins (Advanced 3 300 €, Enterprise
9 450 €, estimation 12 750 €), et le panneau de devis par **route jetable**
(retirée, `git status` contrôlé) — bascule annuelle/mensuelle, lignes qui
suivent, libellé du champ qui suit.

**Non vérifié** : un paiement réel en mensuel, qui demande les Price Stripe et
une carte ; et l'e-mail de devis reçu dans une vraie boîte.

Tests de garde : `web/tests/devis.test.ts` (bloc « l'assiette est le nombre
d'appareils ») et `web/tests/demande-magasin.test.ts`.

⚠️ **Deux garde-fous périmés trouvés en chemin, et le motif est toujours le
même** : `demande-magasin.test.ts` listait quatre fichiers de migration à la
main pour trouver « la définition qui fait foi ». Elle en manquait deux, si bien
que trois assertions validaient depuis des semaines des définitions qui ne
tournaient plus (`admin_fulfil_store_request` exige `paid` et non `pending`
depuis le 22 août). Il passe par `derniereDefinition` comme les autres. **Toute
garde sur une fonction sensible passe par là — jamais par un nom de fichier.**
