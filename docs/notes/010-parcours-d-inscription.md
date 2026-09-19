# Parcours d'inscription

Plus d'auto-inscription. `handle_new_user` refuse tout e-mail qui n'est ni une
demande superviseur validée, ni une invitation d'équipe, ni une invitation à un
inventaire (seule exception : base sans aucun profil, pour amorcer le premier
administrateur).

- **Entreprise** : demande sur `/inscription` → devis → acceptation →
  encaissement → `admin_fulfil_company_request` crée l'entreprise, ses magasins
  et leurs codes. C'est le **seul** chemin de création d'entreprise.
- **Superviseur** : invité par l'**administrateur de son entreprise** depuis
  /equipe (edge `ca-invite-supervisor`), ou par l'administrateur Quantinvo.
  Le formulaire public `/superviseur` est **éteint depuis le 21 août 2026** —
  voir la section « Extinction du parcours public superviseur » plus bas.
- **Compteur** : ajouté par son superviseur (app ou dashboard web), prénom + nom
  + e-mail, rattaché aux magasins choisis (`team_invitations.store_ids`, vide =
  tous ceux du superviseur).
- **Administrateur d'entreprise** (20 août 2026) : nommé par l'administrateur
  Quantinvo depuis /admin (edge `invite-company-admin` — promotion immédiate si
  le compte existe dans l'entreprise, invitation sinon). C'est **un drapeau**
  `profiles.is_company_admin`, pas une valeur de `role` : l'admin garde
  `role = 'supervisor'` pour hériter des policies RLS existantes, et le cumul
  admin + superviseur des petites structures marche par construction. Il gère
  ses superviseurs depuis /equipe (RPC `ca_*`, gardées par
  `is_company_admin()` — miroir d'`is_admin()`, aal2 conditionnel compris —
  et journalisées dans `company_audit_log`, purgé à 1 an). Invitation de
  superviseur par l'edge `ca-invite-supervisor`. **La policy de
  `team_invitations` est restreinte à `role = 'employee'`** pour les
  superviseurs : sans cela, un superviseur s'écrirait une invitation
  `company_admin` que `handle_new_user` honorerait (élévation). Ne jamais la
  rouvrir. Le verrou `profiles_pin_privileged` fige aussi ce drapeau. Seul
  Quantinvo nomme/révoque les admins (`admin_invite_company_admin` /
  `admin_revoke_company_admin`, journalisées) et crée entreprises et magasins
  (la licence est par magasin). Migrations `20260820190001..4`, tests de
  garde : `web/tests/admin-entreprise.test.ts`. Le formulaire public
  /superviseur a été éteint le 21 août 2026 (voir ci-dessous).

**Personne ne s'inscrit** : les deux parcours créent l'utilisateur auth par
invitation (`generateLink` type `invite`, envoi Resend, repli SMTP Supabase) et
envoient un lien vers `/bienvenue`, où la personne **vérifie son prénom et son
nom pré-remplis** puis choisit son mot de passe. L'écran d'inscription de l'app
n'est plus qu'une explication.

Conséquence à connaître : `handle_new_user` se déclenche sur l'INSERT dans
`auth.users`, donc **le profil existe dès l'invitation**, avant le mot de passe.
La personne ne peut simplement pas encore se connecter.

`profiles` est modifiable par son porteur (prénom, nom), mais le trigger
`profiles_pin_privileged` fige `role`, `company_id` et `is_admin` pour les rôles
`authenticated`/`anon` — sans lui, un compteur se promouvait superviseur d'un
simple UPDATE. Ce trigger doit rester en SECURITY INVOKER : en DEFINER,
`current_user` vaudrait le propriétaire et le garde-fou ne s'appliquerait jamais.

`create_company`, `join_company` et `join_store` ne sont plus exécutables par
`authenticated` (migration `20260813000005`) : elles court-circuitaient ce
parcours. Ne pas rendre les GRANT sans réintroduire la validation admin.

Le code magasin reste confidentiel : `join_code` est révoqué en SELECT pour
`anon`/`authenticated` sur `stores` et `companies`. Un compteur ne doit jamais
le voir.

Un inventaire ne se peuple que de profils existants — `invite-to-session`
refuse les e-mails sans compte.

## Extinction du parcours public superviseur (21 août 2026)

Le formulaire public de demande d'accès superviseur n'existe plus. Les accès
sont ouverts par l'administrateur de l'entreprise (/equipe), ou par Quantinvo
pour une entreprise qui n'a pas encore d'administrateur.

Déroulé, dans l'ordre imposé par la règle du projet — **code déployé d'abord,
objets supprimés ensuite** (leçon `get_session_activity`) :

1. Commit `50bbf6e` : `/superviseur` devient une explication, la section
   « Demandes d'accès » quitte /admin avec son composant, les liens de
   l'accueil et de la connexion disparaissent, les tests changent d'objet.
2. Migration `20260821140001`, une fois ce code en ligne : suppression de
   `submit_supervisor_request` (**la surface publique, exécutable par
   `anon`**), `submit_supervisor_request_detailed`,
   `admin_list_supervisor_requests` et `admin_review_supervisor_request`.
3. Edge functions `submit-supervisor-request` et `invite-supervisor`
   redéployées en **410 Gone**, sans client Supabase ni envoi d'e-mail.
   ✅ **SUPPRIMÉES DE LA PRODUCTION LE 6 SEPTEMBRE 2026**, seize jours plus
   tard, la condition étant remplie : aucun appelant nulle part (⚠️ attention en
   le vérifiant — `ca-invite-supervisor`, bien vivante, contient la même suite
   de lettres et fait mentir un `grep` trop large) et zéro appel dans les
   journaux. Leurs dossiers ont quitté le dépôt ; git en garde la trace.
   ⚠️ **Et la console MCP ne sait toujours pas supprimer une edge function —
   mais le CLI, si** : `supabase functions delete <nom> --project-ref …`. La
   note qui renvoyait au tableau de bord n'avait plus lieu d'être.

**La page `/superviseur` doit rester** : l'application mobile installée sur
les téléphones partage encore cette adresse avec le code magasin (voir
`src/constants/links.ts` et `src/app/(supervisor)/profile.tsx`). La supprimer
enverrait ces personnes sur une erreur. Elle n'est plus qu'une explication —
même motif que l'écran d'inscription de l'app. Le texte de partage du code
magasin a été corrigé le 21 août 2026 (il renvoie vers l'administrateur de
l'entreprise) ; il entre en vigueur au prochain build mobile.

**La table `supervisor_requests` reste aussi**, vide, RLS active sans aucune
policy (donc refus par défaut). La supprimer obligerait à réécrire
`handle_new_user` — la fonction qui conditionne toute création de compte —
pour un gain nul : ses branches, comme celles de `purge_expired_data`,
`export_my_data`, `anonymize_on_user_delete` et `ca_invite_supervisor`, lisent
une table qui restera vide. Ce sont des non-opérations.

Bénéfice de sécurité : l'oracle d'énumération d'e-mails que défendait tout le
travail du constat M3 (réponse uniforme, limitation de débit) n'a plus d'objet
— la surface publique elle-même a disparu.

## Le devis part tout seul, et s'accepte en ligne (22 août 2026)

*« Fais les trois, il ne restera plus qu'à brancher Stripe. »* Jusque-là :
l'administrateur saisissait référence et montant dans deux `prompt()`,
fabriquait le PDF à la main depuis `docs/entreprise/modeles/devis.html`, et
l'envoyait de sa messagerie. Le statut passait à `quoted` sans que rien ne
parte, et l'acceptation se déclarait à la main.

Migration `20260822220001`, maquette validée avant codage :
https://claude.ai/code/artifact/fa94384a-84d5-4eea-a0ab-0cc0192b357b

**Le parcours** : la console établit le devis (référence proposée, montant
calculé depuis la grille et les volumes déclarés, lignes affichées) →
`admin-send-quote` enregistre, **fabrique le PDF** et l'envoie en pièce jointe
avec un lien → le client ouvre `/devis/<jeton>`, télécharge le PDF, accepte →
`accept-quote` pose le statut et écrit deux messages (accusé au client, avis à
Quantinvo si `QUOTE_NOTIFY_EMAIL` est posée).

Points à ne pas défaire :

- **Le PDF est généré, jamais déposé.** `_shared/devis.ts` calcule les lignes
  *et* décrit la mise en page (des éléments à des millimètres) ;
  `_shared/devisPdf.ts` est le seul à connaître pdf-lib. Cette séparation rend
  la mise en page **testable** par vitest, qui ne sait pas résoudre les imports
  esm.sh — et elle évite deux dessins du même document. Le PDF joint à l'e-mail
  et le PDF téléchargé sortent du même module : c'est pourquoi `quote_by_token`
  rend le nom complet et le SIREN, qui figurent de toute façon sur le document
  que ce même jeton télécharge.
- **Le montant part tel qu'il est saisi**, jamais recalculé à l'envoi : la
  grille propose, l'administrateur dispose — un devis se négocie. `web/lib/devis.ts`
  est la **copie volontaire** du calcul de `_shared/devis.ts` (npm d'un côté,
  esm.sh de l'autre), et `web/tests/devis.test.ts` compare les deux grilles
  tranche par tranche.
- **Le prospect n'a pas de compte** — c'est tout l'objet du parcours. `/devis/<jeton>`
  est donc publique et **hors de la coquille `AppShell`** (elle s'ouvre depuis
  une messagerie, souvent au téléphone), `quote_by_token` et
  `accept_quote_by_token` sont ouvertes à `anon`, et **le jeton tient lieu de
  clé** : uuid aléatoire, aucune adresse e-mail rendue par la lecture, et la
  limitation de débit de `rate_limit_ok`. `quote-pdf` et `accept-quote` sont
  déployées en `verify_jwt: false` — deux fonctions publiques de plus, avec
  `submit-supervisor-request`.
- **Un nouvel envoi change le jeton** : renvoyer un devis invalide l'ancien
  lien, qui porterait un montant périmé. Un devis expiré (30 jours) ne
  s'accepte plus.
- **L'acceptation ne crée rien.** Elle pose une date et un statut ; la création
  de l'entreprise reste derrière `paid`. C'est ce point qui rendra la bascule
  Stripe indolore — le webhook n'aura qu'à jouer `accepted → paid`, comme la
  section suivante le prévoit. Un second clic répond `already: true` plutôt
  qu'une erreur, exactement ce qu'il faudra à Stripe qui rejoue ses webhooks.

**Vérifié pour de vrai** le 22 août 2026, sur une demande d'essai créée puis
supprimée (aucun résidu, contrôlé en base) : le PDF servi par `quote-pdf`
(2,8 ko, rendu à l'écran et relu), l'acceptation par l'edge publique
(`success/already/lien invalide` selon le cas), et la page `/devis/<jeton>` au
navigateur — clair, sombre, et 375 px, où la mise en page des lignes a dû être
reprise (le prix se retrouvait au milieu du rang).

### Un magasin ne se crée plus sans devis (même jour, une heure plus tard)

Julien : *« pourquoi j'ai pu créer deux magasins à l'instant sans qu'un devis
ne soit envoyé ? »* Le journal le confirmait : `admin_fulfil_store_request`
menait une demande de `pending` à `created` d'un seul geste. Le devis
automatique ne couvrait que l'inscription.

Migration `20260822230001` : **une demande d'ajout suit le parcours d'une
inscription** — `pending → quoted → accepted → paid → created` — et la
création **exige `paid`**, exactement comme `admin_fulfil_company_request`.
Les trois RPC nouvelles (`admin_quote_store_request`,
`admin_set_store_request_status`, et la garde sur `admin_fulfil_store_request`)
sont le miroir de celles des entreprises.

Points à connaître :

- **Une demande de suppression (`kind = 'remove'`) n'a pas de devis** et reste
  `pending → removed`. Les trois fonctions la refusent nommément — sans cela
  on facturerait un client pour lui retirer un magasin.
- **Un jeton, une page.** `quote_by_token` et `accept_quote_by_token` cherchent
  dans les deux tables et rendent `kind` : `/devis/<jeton>` et `quote-pdf`
  servent les deux parcours. `admin-send-quote` aussi, par `target`. Deux
  pages auraient voulu dire deux mises en page à tenir d'accord. Le devis d'un
  magasin porte un **objet** (« Ajout du magasin Lyon Part-Dieu ») au-dessus
  du tableau, parce que sa ligne unique ne dit pas à elle seule de quoi il
  s'agit.
- **Le devis en attente reste sous les yeux du client** sur /magasins, avec
  son lien « voir et accepter » : c'est justement ce sur quoi il peut agir. La
  règle « une demande aboutie quitte l'écran » ne vaut que pour `created` et
  `removed`.
- Le bouton « Ajouter un magasin » de la fiche entreprise reste direct : c'est
  nous, en interne, et le journal le trace.

Vérifié en base, session simulée, **en transaction annulée** : créer sans
devis refusé, créer après devis refusé, sauter l'accord refusé, accord puis
encaissement puis création acceptés, devis d'une suppression refusé. Puis sur
une demande d'essai réelle, supprimée ensuite sans résidu : le PDF téléchargé
(objet compris, relu à l'écran) et l'acceptation par l'edge publique.

### Les ventes en cours, d'un bout à l'autre (même soir)

Julien, une fois le devis envoyé : *« où passent les infos sur mon compte
admin ? Je vois rien »* — puis *« je veux vraiment que tu penses au flow de A
à Z »*. Le parcours déroulé étape par étape avait trois trous :

1. **/admin ne voyait que `pending`** : une demande devisée, acceptée ou
   encaissée disparaissait alors qu'elle attend un geste — et les inscriptions
   d'entreprise n'y figuraient pas du tout ;
2. **`admin_list_store_requests` perdait l'en-cours** : elle rendait `pending`
   ou « traité depuis 90 jours », or `quoted` / `accepted` / `paid` n'ont pas
   de `handled_at`. Une demande devisée n'apparaissait plus **nulle part**,
   fiche entreprise comprise ;
3. **l'acceptation ne remontait pas** : l'avis dépendait d'une variable
   d'environnement jamais posée.

Migration `20260822240001`. Règle à garder : **« en cours » veut dire « pas
terminé », jamais « pending »**.

- **`admin_pipeline`** rend tout ce qui n'est pas terminé dans les deux
  tables, sous une forme unique (`kind` : `company` / `store` /
  `store_removal`). Elle rend des faits ; le jugement — à qui le tour, depuis
  combien de temps, quel geste — vit dans **`web/lib/pipeline.ts`**, testable
  sans base (`SEUILS_VENTE` : deux jours pour deviser, sept avant de
  relancer). Même partage que `lib/entreprise.ts`.
- **Bloc « Ventes en cours »** sur /admin, avant « À traiter » : ce qui nous
  attend (alerte, bouton plein) puis ce qui attend le client (neutre), le plus
  ancien d'abord, avec le revenu en attente dans le titre. Chaque ligne mène
  là où le geste se fait — la console pour une inscription, la fiche pour un
  magasin.
- **L'avis d'acceptation part aux administrateurs Quantinvo lus en base**
  (`admin_notify_emails`, réservée à `service_role` parce qu'elle liste des
  adresses). `QUOTE_NOTIFY_EMAIL` n'est plus nécessaire ; elle s'ajoute si
  elle existe.

Vérifié en base (transaction annulée, session admin) : une demande en
`quoted` remonte dans `admin_pipeline` **et** dans `admin_list_store_requests`.
Au navigateur par route jetable (retirée, `git status` propre) : les deux
groupes, les boutons, le montant en attente.

**Le stock déclaré qui surprend remonte sur la ligne** (migration
`20260822260001`). Julien : *« un grand magasin mettrait un stock théorique à
1 000 pièces pour une surface de 10 000 m² = fraudeur »*. Le recoupement
stock / surface existait sur la fiche ; `admin_pipeline` rend maintenant les
magasins déclarés et le code APE, `alerteDensite` (`lib/pipeline.ts`) en tire
une phrase — « Stock déclaré à vérifier — Grand Magasin : 0 pièces/m², très
faible pour … » — affichée sous l'état de la vente, et la demande passe **en
tête** tant que le devis n'est pas parti. Le jugement reste celui de
`lib/secteurs.ts` ; la phrase dit « à vérifier », jamais « fraude » : deux
déclarations de la même personne ne se contrôlent pas l'une l'autre. Le devis
reste manuel — c'est le point de contrôle.

**Une demande d'inscription prévient tout le monde** (`submit-company-request`,
déployée sans JWT comme tout formulaire public). Julien : *« il faut que je
puisse recevoir un mail de demande d'inscription »* — ce n'était pas prévu,
/inscription écrivait en base et personne ne le savait. L'edge appelle la RPC
publique (validation et limitation de débit inchangées), envoie l'accusé au
prospect et l'avis aux administrateurs lus en base, magasins déclarés compris.
La page retombe sur la RPC directe si l'edge est injoignable.

**Même avis pour une demande de magasin** : `ca-request-store` envoie aussi
« Nouvelle demande de magasin » aux administrateurs, avec l'entreprise, le
demandeur et les volumes déclarés (pièces, m², pièces/m²). Le `service_role`
n'y sert qu'**après** la RPC, pour lire les adresses — jamais pour écrire la
demande ; le test de garde vérifie l'ordre.

Stripe est branché : voir « Paiement : Stripe, en place ».

Tests de garde : `web/tests/devis.test.ts`.

## Paiement : Stripe, en place (22 août 2026)

Julien : *« on ne fournit pas de RIB, le paiement doit passer par Stripe »*,
puis *« crée automatiquement une fois payé »*. Migration `20260822250001`,
fonctions edge `accept-quote` (modifiée) et `stripe-webhook` (nouvelle).

**Le parcours** : devis accepté → `accept-quote` ouvre une session Stripe
Checkout et y envoie le client → paiement par carte ou prélèvement SEPA,
**facture produite et envoyée par Stripe** (`invoice_creation`) →
`checkout.session.completed` → `stripe-webhook` → `fulfil_paid_request` :
`paid`, création de l'entreprise et de ses magasins (ou du magasin), journal
signé « Stripe », et invitation du contact comme **administrateur de son
entreprise** (même lien `/bienvenue` que les autres invitations).

Les règles fixées quand Stripe n'était qu'un projet sont tenues : un seul
point d'accroche (`accepted → paid`), la création derrière le paiement et
jamais déclenchée par le client, la ré-émission traitée comme un cas normal.

Points à ne pas défaire :

- **La signature est la seule porte.** Le webhook est déployé en
  `verify_jwt: false` (Stripe n'envoie pas de JWT) ; `verifierWebhook`
  (`_shared/stripe.ts`) vérifie l'HMAC sur le **corps brut**, avec cinq
  minutes de tolérance et une comparaison en temps constant, **avant toute
  lecture**. Un test la passe avec un vrai HMAC, et refuse un corps trafiqué.
- **Le webhook n'a pas de session** : `auth.uid()` est nul, donc ni
  `is_admin()` ni `log_admin_action`. D'où `fulfil_paid_request`,
  `attach_checkout_session`, `log_system_action` et
  `invite_company_admin_after_payment`, exécutables par le **seul
  `service_role`**. Elles ne doivent jamais être ouvertes à `authenticated`.
- **Rejeu** : Stripe renvoie un événement tant qu'il n'a pas reçu 200.
  `fulfil_paid_request` répond `already: true` sur une session déjà traitée,
  et la fonction répond **200**. ⚠️ **Corrigé le 28 août 2026** : cette note
  attribuait la protection à l'index unique sur
  `stripe_checkout_session_id`, ce qui était faux — il porte sur la table des
  demandes, le doublon naissait dans `companies` et `stores`. C'est le
  `for update` de `20260828210001` qui protège, voir « Modélisation de
  menaces du parcours de l'argent ». Une session inconnue répond 500 — c'est un vrai problème, Stripe
  doit réessayer. Ce qui n'est pas `checkout.session.completed` avec
  `payment_status = paid` répond 200 sans rien faire.
- **Une session Checkout par demande** : clé d'idempotence
  `checkout-<kind>-<id>`. Un devis accepté deux fois — ou « Régler la
  licence » cliqué deux fois — rouvre la même session, jamais une seconde.
  `accept_quote_by_token` rend désormais `request_id` et `status` pour ça.
- **Pas de SDK Stripe** : deux appels HTTP et une signature, dans
  `_shared/stripe.ts`, lisibles en entier. Le SDK pèse lourd en edge et
  n'apporterait rien ici.
- **Sans clé Stripe**, l'acceptation fonctionne comme avant : accord
  enregistré, « votre facture arrive ». C'est ce qui permet de déployer le
  code avant de poser les clés.

Côté écrans : `/devis/<jeton>` suit `paymentUrl` dès l'accord, propose
« Régler la licence » sur un devis accepté non payé, et lit `?paiement=ok` au
retour de Stripe. Dans `lib/pipeline.ts`, `accepted` attend le **client** (il
paie), relancé passé sept jours ; `paid` sans `created` est une anomalie
(webhook non passé) et nous revient. Les boutons manuels « Marquer accepté »
et « Réglé hors Stripe » restent en secours, en liens discrets, pour un
paiement reçu par un autre canal — la création reste alors à faire à la main.

**Vérifié de bout en bout le 22 août 2026, clés de test posées par Julien**
(clé restreinte : Checkout Sessions, Customers, Invoices, Products, Prices en
écriture, rien d'autre) : devis accepté → Checkout → carte `4242` →
webhook → `created`, entreprise avec son code, deux magasins aux noms du
devis, facture Stripe liée, contact devenu administrateur d'entreprise
affecté aux deux magasins, journal signé « Stripe ». Données d'essai
supprimées ensuite ; le journal est conservé.

Un défaut trouvé ainsi : `expires_at` calculé à l'appel changeait à chaque
seconde, et Stripe refuse une clé d'idempotence rejouée avec d'autres
paramètres — le second clic n'avait plus d'URL. **Une session encore ouverte
se relit** (`lireSessionCheckout`) au lieu de se recréer ; une session expirée
se recrée avec un suffixe de tentative. `accept_quote_by_token` rend
`checkout_session_id` pour ça.

**La facture est dans notre e-mail.** Stripe la produit, mais ne l'envoie
qu'à certaines conditions — en mode test, aux seuls membres du compte, et en
live selon un réglage du tableau de bord qu'on ne peut pas vérifier depuis le
code (constat de Julien : « le client pas de facture »). Le webhook relit
donc la facture (`lireFacture`, page hébergée + numéro) et la pose en **lien
secondaire** du message « Bienvenue » ou « Votre magasin est créé ». Le
gabarit `email.ts` a gagné `lienSecondaire` pour ça : un lien sous le bouton,
jamais un second bouton — un seul geste par message. Sans droit de lecture
sur les factures, le message part sans le lien.

### Le client peut décliner (22 août 2026, au soir)

Julien : *« dans le parcours où le devis est décliné, il n'y a pas le
bouton, il n'y a que j'accepte ou télécharger »*. Un client qui ne voulait
pas du devis n'avait rien à cliquer : il fermait l'onglet, et la vente
restait « en attente du client » sept jours avant une relance pour rien.

Migration `20260822280001`, statut **`declined`** sur les deux tables, edge
publique `decline-quote` (même surface que `accept-quote` : jeton, limitation
de débit partagée). Sur la page, un lien en retrait — « Je ne souhaite pas
donner suite » — ouvre un motif **facultatif** ; on ne force pas la raison,
mais si elle est donnée, elle arrive dans l'avis à Quantinvo et se lit en
console. Le client reçoit un accusé qui promet l'absence de relance.

Trois règles :
- **seul un devis `quoted` se décline** — accepté, il se paie ou expire ; la
  renonciation après accord est une conversation ;
- **décliner n'est pas définitif** : `admin_quote_*` accepte `declined` comme
  point de départ (« Nouveau devis » en console), et efface la trace du refus
  au renvoi ;
- la vente **sort de « Ventes en cours »** (`admin_pipeline` ne rend pas
  `declined`) mais reste dans les listes, motif compris, 30 jours côté client.

Vérifié par l'edge publique (refus avec motif, second clic → `already`,
acceptation après refus → refusée), en console (hors pipeline, motif lisible,
nouveau devis → `quoted` avec nouveau jeton) et au navigateur (lien, panneau,
état « Vous avez décliné »). Données d'essai supprimées.

### Test complet des deux parcours (22 août 2026, au soir)

Julien : *« fais un test complet du parcours, création entreprise et ajout
de nouveau magasin, vois s'il y a des trous »*. Déroulé en vrai, étape par
étape — demande par l'edge publique, devis (RPC avec session admin simulée
en base, l'edge exigeant un vrai jeton), PDF et acceptation par les edges
publiques, paiement par la carte de test, webhook, puis la même entreprise
demandant un magasin, devisé, accepté, payé. Deux trous, fermés :

1. **Le prix payé n'était pas reporté sur le magasin** — `annual_price_cents`
   nul sur tout ce que le webhook créait, donc un revenu annuel estimé au
   panier moyen dès le premier client. Migration `20260822270001` : la ligne
   du devis donne le prix de chaque magasin (à défaut, le total réparti) ;
   rattrapage de l'existant compris.
2. **Pas de lien de paiement sur /magasins** pour une demande `accepted` : le
   texte annonçait « votre facture arrive », d'avant Stripe. Un client qui
   avait fermé Checkout n'avait plus d'issue depuis son espace. Le lien
   « Régler en ligne » rouvre la page du devis, donc la même session.

Contrôlés sans défaut : l'admin invité est bien affecté à tous les magasins,
y compris celui ajouté ensuite (déclencheur `stores`) ; un devis expiré se
refuse et la page le dit ; un devis renvoyé tue l'ancien lien ; l'annulation
ne vaut que sur `pending`, comme le bouton. Données d'essai supprimées,
zéro résidu contrôlé.

**À savoir pour rejouer ce test** : simuler une session en base cache les
lignes à un `select` direct (RLS, aucune policy sur `company_requests`) — il
faut lire l'`id` avant de basculer le rôle. Ce n'est pas un trou : la console
passe par `admin_list_company_requests`, en SECURITY DEFINER.

### Les clés (posées en mode test le 22 août 2026)

Dans le tableau de bord Stripe (compte Devkaylab) — à refaire en `live` le
jour venu, mêmes variables, nouvelles valeurs :

1. **Developers → API keys** : copier la clé secrète (`sk_test_…`).
2. **Developers → Webhooks → Add endpoint** :
   `https://heabesqvlinzarqenymj.supabase.co/functions/v1/stripe-webhook`,
   événement `checkout.session.completed` (et
   `checkout.session.async_payment_succeeded` pour le SEPA — à brancher dans
   le webhook le jour où un client paie ainsi). Copier le secret de signature
   (`whsec_…`).
3. Dans Supabase → Edge Functions → Secrets, poser `STRIPE_SECRET_KEY` et
   `STRIPE_WEBHOOK_SECRET`. **Les clés ne se collent jamais dans une
   conversation ni dans le dépôt.**
4. Essayer avec la carte de test `4242 4242 4242 4242`, puis passer les deux
   clés en `live` le jour venu — mêmes variables, nouvelles valeurs.

Tests de garde : `web/tests/stripe.test.ts`.

## Modélisation de menaces du parcours de l'argent (28 août 2026)

Passage STRIDE sur le seul chemin où une faille coûte de l'argent : demande
d'inscription → devis → acceptation → Checkout → webhook → création
d'entreprise et invitation de l'administrateur, variante « demande de magasin »
comprise. Quatre constats, tous corrigés le jour même.

**⚠️ La méthode compte autant que les constats : l'analyse a porté sur la base
réelle (`pg_get_functiondef`), pas sur `supabase/migrations/`.** Le dossier
diverge de la production — c'est écrit plus bas — et huit des neuf constats du
matin venaient déjà de cet écart. Une lecture des fichiers aurait modélisé une
base qui n'existe pas. Refaire ce travail depuis le dépôt, c'est le refaire pour
rien.

Chiffres relevés au passage, utiles pour situer : **127 fonctions dans `public`,
dont 121 en `SECURITY DEFINER`** (donc 121 frontières de privilège qui se
défendent seules), 100 ouvertes à `authenticated`, 4 à `anon`, 23 tables toutes
sous RLS, 38 policies, 12 déclencheurs, 17 fonctions edge.

### VR-001 · Un même paiement créait deux entreprises (`20260828210001`)

Le plus grave, et **il ne demandait aucun attaquant**. `fulfil_paid_request`
contrôlait le statut par une **lecture**, puis faisait son `UPDATE` sans
condition. Deux livraisons concurrentes du même événement Stripe lisaient toutes
deux `accepted`, passaient toutes deux, et créaient chacune une entreprise
complète avec ses magasins et ses codes.

- **⚠️ L'index unique `company_requests_stripe_session_idx` ne protégeait pas de
  ça**, contrairement à ce que cette note affirmait plus haut : il porte sur la
  table des *demandes*, alors que le doublon naît dans `companies` et `stores`,
  que rien ne contraint. Deux protections avaient été confondues.
- **Stripe est le déclencheur** : il redélivre tant qu'il n'a pas reçu de `200`,
  et le webhook ne mémorise aucun identifiant d'événement.
- **Le risque se nourrissait lui-même** : `gen_store_code()` fait une requête
  par tentative, une fois par magasin. Plus la commande est grosse, plus c'est
  lent ; plus c'est lent, plus Stripe expire et réessaie pendant que la première
  exécution tourne encore.

Correctif : **`for update` sur les deux `select` initiaux**. Le verrou de ligne
sérialise les webhooks concurrents ; le second attend, relit la ligne
(`READ COMMITTED` réévalue après le verrou), y trouve `paid`, et sort par la
branche `already` qui existait déjà. Plus `and status = 'accepted'` sur les deux
`UPDATE` de transition — **le motif exact d'`accept_quote_by_token`, qui l'avait
et que celle-ci n'avait pas**.

**⚠️ Le `if not found` répond `already: true`, jamais une erreur.** Stripe rejoue
tant qu'il n'a pas son 200 : une erreur ici relancerait la boucle qu'on ferme.

### VR-003 · Le paiement détruisait l'invitation en attente d'un tiers (`20260828220001`)

`invite_company_admin_after_payment` faisait
`delete from team_invitations where lower(email) = v_email` **sans borne
d'entreprise**. Toute invitation en attente portant cette adresse était effacée,
quelle que soit l'entreprise qui l'avait émise.

**⚠️ C'est la reprise d'invitation que le constat n°3 du même jour a fermée, et
elle passait par la seule porte que `team_invitations_figees` ne garde pas** :
ce déclencheur se réveille sur `UPDATE`, ce chemin fait `DELETE` + `INSERT`.
L'invariant était respecté à la lettre et contourné dans son intention. À
retenir pour tout futur invariant posé sur un déclencheur : vérifier ce que le
couple suppression-recréation lui fait.

Le cas involontaire est le plus probable — un client légitime dont l'adresse de
contact traîne une invitation ailleurs la détruit en payant.

Deux décisions à ne pas défaire :

- **⚠️ On refuse (`other_company`), on n'efface pas.** Garder les deux
  invitations n'était pas une option : l'unicité de `team_invitations.email` sur
  toute la base est porteuse, `handle_new_user` retrouve l'invitation **par
  l'adresse** pour décider du rôle et de l'entreprise. Deux lignes pour une
  adresse la rendraient ambiguë — « laquelle choisir » sur une décision de
  privilège est exactement le genre de trou qu'on ferme ailleurs. C'est donc le
  `DELETE` qui cède, pas la contrainte.
- **⚠️ Un refus, pas une exception.** Le paiement est encaissé et l'entreprise
  déjà créée quand cette fonction s'exécute ; une exception ferait échouer le
  webhook, donc rejouer Stripe indéfiniment. Le webhook sait déjà traiter un
  refus sans 500 (`notes.push(…)`), et l'anomalie remonte d'elle-même sur /admin
  par `companies_without_admin`. Rien de nouveau à journaliser.

### VR-002 · On crée ce qui a été devisé (`20260828240001`)

La boucle suivait `store_count`, **saisi par le prospect** dans le formulaire
public (borné de 1 à 500 par contrainte), et non les lignes du devis payé.

**Le document que le client signe comptait déjà les lignes** : dans
`admin-send-quote`, le PDF fait `lignes.length || q.store_count`. Devis et
création n'utilisaient pas la même source, et ne pouvaient diverger que dans un
sens — plus de magasins livrés que facturés.

Deux gestes, et il faut les deux : la création suit le devis, et
`admin_quote_company_request` refuse un devis dont les lignes ne correspondent
pas aux magasins déclarés. Le premier protège quoi qu'il arrive en amont, le
second évite qu'un devis faux parte chez un client.

**⚠️ Le repli sur `store_count` reste, et le `nullif` est ce qui le tient.**
`jsonb_array_length('[]')` vaut **0**, pas `null` : un `coalesce` naïf ferait
boucler `1..0`, donc créerait **zéro magasin** pour un devis sans lignes. Le
prix de repli se divise désormais par le nombre réellement créé, plus par
`store_count`.

### VR-004 · Les codes d'accès sortent d'un CSPRNG (`20260828230001`)

`gen_store_code()` et `gen_company_code()` tiraient leurs caractères avec
`random()`, non cryptographique (CWE-338), pour une valeur que le produit traite
comme un secret : `join_code` ouvre l'entrée dans un magasin, et la colonne est
révoquée en `SELECT` pour `anon`/`authenticated`. Les jetons de devis, eux,
utilisaient déjà `gen_random_uuid()`.

- **⚠️ La révocation est la moitié la plus utile du correctif.** Les deux
  fonctions étaient exécutables par `authenticated` : n'importe quel compte
  connecté pouvait les appeler à volonté et **observer les sorties du
  générateur**, ce qui est précisément l'oracle qui rend une faiblesse de PRNG
  exploitable. Vérifié avant de révoquer : les cinq appelants sont tous en
  `SECURITY DEFINER`, ils ne dépendent pas de ce droit.
- **⚠️ `extensions.gen_random_bytes`, qualifié par son schéma.** Supabase
  installe `pgcrypto` dans `extensions`, et ces fonctions figent `search_path` à
  `'public'` : l'appel nu **échoue à l'exécution, pas à la création**. La
  première version de la migration s'est appliquée sans broncher et a cassé la
  génération de code le temps du premier essai. `gen_random_uuid` ne pose pas ce
  problème — depuis PG13 elle est dans `pg_catalog`.
- **⚠️ `% 32` ne biaise pas** parce que l'alphabet fait exactement 32 caractères
  et que 256 en est un multiple. Cela cesserait d'être vrai si on touchait à
  l'alphabet.
- **Les codes existants ne changent pas** : les regénérer invaliderait ce qui a
  déjà été communiqué aux équipes.

### Le cinquième défaut : un garde-fou périmé

Trouvé en voulant protéger les quatre correctifs. **`web/tests/stripe.test.ts`
lisait `20260822250001_stripe_paiement.sql` nommé en dur.** Or
`fulfil_paid_request` avait été réécrite le 22 août par la migration du prix par
magasin : le test passait depuis six jours **en validant une définition qui ne
tournait plus**.

C'est mot pour mot le défaut qui avait fait perdre sa limitation de débit à
`submit_company_request`, et dont cette note disait « à reprendre pour les autres
fonctions sensibles si le sujet revient ». Il est revenu.

**`derniereDefinition()` vit désormais dans `web/tests/migrations.ts`**, partagée
par `formulaires-publics.test.ts` et `stripe.test.ts`, avec `fichierDe()` pour
lire les `GRANT` (qui sont hors du corps de la fonction). **⚠️ Toute nouvelle
garde sur une fonction sensible passe par là — jamais par un nom de fichier en
dur.**

Deux effets de bord instructifs :

- une assertion a dû être **recentrée sur l'intention** (`v_ligne := …` puis
  `v_ligne ->> 'libelle'`) plutôt que sur une écriture depuis refactorée ;
- compter `for update` a d'abord rendu 3 au lieu de 2 : **le commentaire de la
  fonction contient les mots**. On compte `for update;`, l'instruction. Même
  piège que le `sansCommentaires()` de `formulaires-publics.test.ts`.

### Ce qui a été contrôlé et qui tient

Dit explicitement, parce qu'une absence de constat ne vaut que si on sait ce qui
a été regardé : signature du webhook vérifiée sur le corps brut avant toute
lecture ; les quatre fonctions `anon` sont exactement les quatre voulues (le
retrait du 28 août tient) ; réponse uniforme de `submit_company_request` ;
limitation de débit posée avant la recherche par adresse ; RLS active sur 23
tables sur 23 ; bornes de longueur au niveau de la table ; un devis de
suppression ne peut pas se faire payer ; l'expiration à 30 jours est contrôlée à
l'acceptation comme au déclin.

**Une piste ouverte puis fermée**, à ne pas rouvrir : `store_team` porte la RLS
sans aucune policy et ce n'est documenté nulle part. Vérifié — aucun accès
direct à cette table depuis l'app, le site ou les fonctions edge, tout passe par
des RPC `SECURITY DEFINER`. C'est la configuration la plus sûre, pas un oubli.

### Vérifications

Tout en transactions annulées, sur les fonctions réellement appliquées, données
d'essai contrôlées à zéro après coup : le rejeu répond `already` sans rien
recréer et une session inconnue reste en erreur (pour que Stripe réessaie) ; la
reprise d'invitation est refusée et **l'invitation de l'autre entreprise reste
intacte** ; 500 magasins déclarés avec un devis à une ligne créent **un**
magasin au prix devisé, et un devis sans lignes crée toujours les magasins
déclarés ; 200 codes tirés, tous distincts, bien formés, les 32 caractères
représentés.

**⚠️ Ce qui n'a pas été prouvé : la concurrence réelle de VR-001.** Une seule
session ne peut pas se faire la course à elle-même. Le verrou est le mécanisme
correct de Postgres pour ce cas, mais la démonstration demanderait deux webhooks
signés joués en parallèle sur un environnement de test.

### La vraie idempotence : `stripe_events_traites` (`20260828250001`)

Écrite dans la foulée. La table porte l'invariant au niveau de l'**événement**,
en plus du `for update` qui tient la course au niveau de la demande, et laisse
une trace de ce qui a été reçu et quand. Elle prépare
`checkout.session.async_payment_succeeded`, que le prélèvement SEPA ajoutera :
deux types d'événement pour un même paiement.

- **⚠️ Le marquage est DANS `fulfil_paid_request`, pas dans la fonction edge.**
  Marquer depuis le webhook, avant d'appeler la création, rendrait tout échec
  **définitif** : le client paie, la création échoue, Stripe réessaie, et le
  rejeu est écarté comme « déjà vu ». Il faudrait démarquer sur chaque chemin
  d'erreur — une compensation qu'on finirait par oublier sur un chemin ajouté
  plus tard. Dans la même transaction, il n'y a rien à compenser : si la
  fonction lève, la marque disparaît avec le travail.
- **Le marquage vient en premier**, avant même la lecture de la demande : un
  `insert … on conflict do nothing` qui ne pose aucune ligne dit que
  l'événement est déjà passé, et on sort par `already` sans rien relire.
- **⚠️ `p_event_id` est facultatif, et doit le rester.** C'est ce qui a permis
  d'appliquer la migration avant que le webhook ne soit redéployé : un appel à
  quatre arguments se comporte exactement comme avant. Vérifié.
- **⚠️ L'ancienne signature à quatre arguments est supprimée** dans la même
  migration : `p_event_id` ayant un défaut, Postgres garderait les deux et un
  appel à quatre deviendrait ambigu — même piège que `ca_request_store`.
- Purge à **30 jours** dans `purge_expired_data` : Stripe ne rejoue pas au-delà.
- RLS active, aucune policy, comme `submission_attempts` et `alertes_envoyees`.

**La fonction edge `stripe-webhook` a été redéployée** (version 13, 28 août
2026) — le dépôt ne déploie rien. Vérifié après coup : les trois fichiers
téléchargés depuis la production sont **identiques à l'octet près** à ceux du
dépôt (`supabase functions download` puis `diff`), `p_event_id` est bien dans ce
qui tourne, et la fonction répond 405 sur GET, 400 « signature absente » sur un
POST nu. ⚠️ **Ce 400 est aussi le contrôle de `verify_jwt`** : une fonction
protégée par JWT aurait répondu 401 avant d'atteindre le code.

Effet de bord bienvenu : le repli `SITE_PAR_DEFAUT` d'`_shared/email.ts`, qui
pointait encore vers `quantinvo.vercel.app` dans la version déployée, est passé
à `www.quantinvo.com` — les fonctions edge lisent `APP_PUBLIC_URL` à
l'exécution, mais le repli ne se met à jour qu'au redéploiement.

La commande :

```bash
supabase functions deploy stripe-webhook --project-ref heabesqvlinzarqenymj --no-verify-jwt
```

⚠️ **`--no-verify-jwt` n'est pas facultatif.** Le dépôt n'a pas de
`supabase/config.toml`, donc le CLI déploie avec la vérification de JWT
**activée** par défaut. Stripe n'envoie aucun JWT : le webhook répondrait 401 à
tous les paiements. La règle vaut pour les quatre autres fonctions publiques —
`stripe-webhook`, `accept-quote`, `decline-quote`, `quote-pdf`,
`submit-company-request`, `alerte-anomalies`. Vérifier `verify_jwt` après
chaque déploiement.

⚠️ **Passer par le CLI, jamais par la console MCP, pour cette fonction.** La
console exige de retranscrire les trois fichiers (`index.ts` et les deux
`_shared/`, 33 Ko) dans l'appel, dont la vérification de signature HMAC : une
faute de copie invisible sur le chemin du paiement ne vaut pas le gain. Le CLI
copie les fichiers du disque, et `supabase functions download` permet de le
vérifier ensuite par un `diff`. Il s'installe par
`brew install supabase/tap/supabase`, et `supabase login` ouvre le navigateur —
aucun mot de passe Supabase à retrouver. ⚠️ La fenêtre du **trousseau macOS**
qui apparaît alors demande le mot de passe de la session Mac, pas celui de
Supabase ; « Toujours autoriser » évite qu'elle revienne à chaque commande.
Docker n'est pas nécessaire (le CLI prévient, et empaquette côté serveur).

Tests de garde : `web/tests/stripe.test.ts`, blocs « deux livraisons du même
événement », « une invitation en attente ailleurs », « crée ce qui a été
devisé » et « les codes d'accès ».
