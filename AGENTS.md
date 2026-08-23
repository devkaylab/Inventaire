# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Tutoriel / onboarding

Le tutoriel intégré a été **entièrement retiré** de l'app (composants `help/`,
`HelpModal`, bouton « ? » du header, drapeau `firstRun`, captures
`assets/help/`). Un vrai parcours d'onboarding sera conçu plus tard.

En attendant : **ne pas le réintroduire**, ne pas rajouter de bouton d'aide ni
de modale d'accueil, et ne pas recréer `src/lib/firstRun.ts`. Si l'onboarding
revient au programme, il sera repris à zéro — l'ancien tutoriel décrivait déjà
des écrans disparus (notamment les boutons de passe « Passer en Audit » /
« Revenir en … », supprimés avec `advance_pass` / `revert_pass`).

# Le bandeau de démarrage (23 août 2026)

*« Remplacer le bloc “Pour démarrer” par un bandeau d'une seule étape
(~76 px), qui ne vise plus un inventaire mais le démarrage du superviseur. »*

Le bloc « Pour démarrer » déroulait quatre étapes de **préparation d'un
inventaire** (créer, zones, fichiers, membres) en haut de l'accueil. Deux
choses ont changé, et la seconde est la plus importante.

**La forme** : `components/BandeauDemarrage.tsx`, une rangée de 76 px,
cliquable de bout en bout, avec un chevron et une croix. Elle annonce, elle
n'explique pas — l'explication vit dans l'écran où l'on atterrit.

**L'objet** : les trois étapes sont ce qu'il faut avoir fait **une fois** pour
être en état de travailler — `Générer mes balises` (→ boîte à outils),
`Constituer mon équipe` (→ Mon équipe), `Créer mon premier inventaire`. La
préparation d'une session se conduit depuis la session, où elle est déjà.

Points à ne pas défaire :

- **⚠️ L'étape des balises se coche sur un jalon local, et il n'y a pas
  d'autre moyen.** Une planche est dessinée sur le téléphone et **n'écrit rien
  en base** : aucun fait serveur ne dira jamais qu'elle a été produite. D'où
  `Jalon` dans `lib/reperes.ts` — à ne pas confondre avec un repère : un
  repère est une aide qui ne se montre qu'une fois, un jalon est un **fait**.
  Il se pose dans `BaliseCreator`, au `onSuccess` du dessin du PDF, et nulle
  part ailleurs. `useJalon` le relit à chaque retour sur l'écran
  (`useFocusEffect`) : on revient précisément de l'écran qui vient de le
  poser. Conséquence assumée : changer de téléphone remet l'étape à faire.
- **`oublierReperes` n'efface pas les jalons.** « Revoir les repères » rejoue
  les aides ; il ne défait pas ce qui a été fait.
- **Les deux autres étapes se lisent en base** : `my_team_by_store` (la même
  RPC que « Mon équipe ») et les inventaires créés par la personne. **Une
  invitation en attente compte** comme une équipe constituée — sinon l'étape
  resterait à faire juste après avoir invité quelqu'un.
- **Le bandeau ne remplace jamais la liste.** Le guide qui l'a précédé prenait
  l'écran entier et masquait l'inventaire qu'on venait de créer ; à 76 px la
  question ne se pose plus. `guidePleinEcran` a disparu.
- **⚠️ « + Nouvel inventaire » ne se masque JAMAIS.** Il l'a été deux fois,
  et deux fois cela a laissé quelqu'un sans rien à toucher : tant que le guide
  pleine page durait, puis — première version de ce bandeau — quand l'étape en
  cours était la création et que la liste était vide. Julien, le 23 août 2026,
  capture à l'appui : un bandeau, une salutation, « Aucun inventaire pour
  l'instant », et c'est tout. **Le chevron d'un bandeau ne se lit pas comme un
  bouton.** Ce n'est pas non plus le doublon d'autrefois : le guide pleine page
  portait un bouton violet au même libellé, une rangée de 76 px et un bouton
  d'action ne se confondent pas. La seule chose qui remplace encore ce bouton
  est la barre de sélection multiple.
- `getPreparation` et les invalidations `['preparation', …]` de Zones, Import
  et Inviter ont été **retirées** : plus personne ne les lit.

## Deux défauts trouvés en l'exerçant, et corrigés

Tout a été parcouru au simulateur, appui par appui. Deux choses cassaient, et
la seconde rendait la première étape inutilisable.

1. **Mon équipe et Boîte à outils s'ouvrent depuis deux endroits.** Le bandeau
   y mène directement depuis l'accueil superviseur, donc **en traversant deux
   groupes de routes** : ils sont alors le premier écran de la pile `(compte)`,
   la flèche native ne s'affiche pas, et on reste coincé dessus. C'est le piège
   déjà écrit plus bas (« ce qu'un écran ouvre doit être dans sa pile ») ; ici
   il est réglé par un `headerLeft: RetourVersApp` sur ces deux écrans, qui
   pointe vers le bon endroit dans les deux cas.

2. **⚠️ « Créer et imprimer des balises » ne marchait pas — et c'était vrai
   avant ce chantier.** L'overlay de chargement était une `Modal`, donc un
   `UIViewController` présenté : iOS **refuse** d'ouvrir la feuille de partage
   par-dessus (`Attempt to present UIActivityViewController … which is already
   presenting`), `shareAsync` ne se résolvait jamais, le bouton tournait
   indéfiniment et **aucun PDF ne sortait**. Retirer la modale juste avant le
   partage ne suffit pas non plus : la feuille s'ouvre « while a presentation
   is in progress », et à sa fermeture **l'application ne répond plus du tout**
   — plus un seul appui, il faut la relancer.

   Corrigé en deux gestes : `lib/balises.ts` sépare `buildBaliseSheetFile`
   (dessiner) de `shareBaliseSheet` (partager), et **`GeneratingOverlay` n'est
   plus une `Modal`** mais un voile posé sur la carte qui l'accueille. Plus
   rien n'est présenté, donc plus de conflit. Ne pas la remettre en `Modal`.

## Ce qui change le stockage prévient les écrans

Dans la foulée, « Revoir les repères » (Mon compte) : il effaçait bien les
clés, mais les écrans qui affichent les repères ne relisaient le stockage
qu'à leur montage. On appuyait, **rien ne se passait**, et les repères ne
revenaient qu'au prochain lancement — un bouton qui a l'air cassé.

`lib/reperes.ts` porte donc un **avertissement** : `marquerRepereVu`,
`oublierReperes` et `poserJalon` préviennent les hooks abonnés, **après
l'écriture, jamais avant** (les écrans vont relire le stockage, il doit déjà
être à jour — c'est aussi ce qui évite qu'un repère tout juste fermé
réapparaisse).

Pourquoi pas une relecture au retour sur l'écran (`useFocusEffect`), qui
était le premier réflexe : **la porte de bienvenue n'est pas un écran**, elle
est posée en surcouche du layout racine (`_layout.tsx`), hors de la pile de
navigation. Elle n'aurait donc rien relu — et c'est précisément ce que
l'alerte nomme en premier. L'avertissement, lui, ne dépend d'aucune
navigation, et sert les repères comme les jalons : **un seul mécanisme**.
`useJalon` n'utilise plus `useFocusEffect`.

Au passage, l'état des deux hooks **porte le compte qu'il décrit**
(`{ uid, lu, … }`). L'ancienne forme le remettait à zéro dans l'effet — le
`setState` synchrone que React déconseille, et l'état d'une personne
s'affichait un instant à la suivante.

Vérifié au simulateur le 23 août 2026, clair et sombre : le bandeau à
« 1 sur 3 », l'impression jusqu'au PDF (`balises_1-900`, 1,2 Mo, feuille de
partage avec Imprimer et Enregistrer), le jalon qui fait passer le bandeau à
« 2 sur 3 » au retour, les deux flèches de retour, la croix qui masque,
l'application qui répond après la fermeture du partage, et « Revoir les
repères » qui **ramène la bienvenue et le bandeau sans relancer l'app** — le
jalon des balises, lui, reste posé (« 2 sur 3 »), comme prévu.

Tests de garde : `tests/compte.test.ts`, bloc « le bandeau de démarrage » et
« Revoir les repères » se voit tout de suite ».

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
   redéployées en **410 Gone**, sans client Supabase ni envoi d'e-mail. La
   console MCP ne sait pas supprimer une edge function : les retirer depuis
   le tableau de bord Supabase quand plus aucun appel résiduel n'arrive.

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
  `fulfil_paid_request` répond `already: true` sur une session déjà traitée
  (index unique sur `stripe_checkout_session_id`), et la fonction répond
  **200**. Une session inconnue répond 500 — c'est un vrai problème, Stripe
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

# E-mails transactionnels : un seul gabarit

Tout ce que le produit envoie par Resend passe par
`supabase/functions/_shared/email.ts` (`emailQuantinvo`). Les fonctions edge ne
décrivent plus que le contenu — titre, salutation, paragraphes, encadré de
faits, bouton, note, raison de l'envoi — et reçoivent en retour le **HTML et la
version texte**, envoyés tous les deux à Resend (les messageries sans HTML, et
les filtres anti-spam, lisent la seconde).

Le gabarit suit la charte « Papier », en trois zones (arrêté avec Julien le
21 août 2026, après plusieurs passes sur le rendu réel dans Gmail) :

- **bandeau encre** en tête — le cube seul (sans la tuile de l'icône
  d'application, qui faisait vignette rapportée) à 56 px, « Quantinvo » en
  blanc à 28 px, le filet de scan cyan faisant la frontière avec le corps ;
- **corps blanc** — titre noir à 20 px, texte à 15 px, bouton indigo mesuré
  (14 px demi-gras) : il vient après la marque, il ne doit pas peser plus
  qu'elle ;
- **pied gris clair** — l'identité et les liens, rien d'autre.

Sous le bouton : l'adresse de secours, puis « Ce lien est personnel… » s'il y
a lieu, puis **« Vous recevez ce message parce que… »**. Cette phrase a
remplacé « vous pouvez ignorer cet e-mail » et ne se répète pas en pied.

Vérifié sur 375 px de large : l'en-tête tient sur une ligne. Au-delà de cette
échelle de marque, il mangerait l'écran d'un petit téléphone avant que le
message ne commence.

Quatre points à ne pas défaire :

- **Tout ce qui vient de la base est échappé** par le gabarit, et un lien qui
  n'est pas en `http(s)` est refusé. Avant, un nom de magasin ou un prénom
  était interpolé tel quel dans le HTML.
- **Une seule image, aucune police distante** : le logo, en PNG servi par le
  site (`web/public/email/logo-quantinvo.png`, adresse dérivée de
  `APP_PUBLIC_URL`). Gmail retire les SVG et bloque les `data:` en source
  d'image — d'où le PNG hébergé. Le mot-symbole reste **du texte à côté** de la
  tuile, avec un `alt` vide : la moitié des messageries coupent les images par
  défaut, la marque doit se lire quand même, et sans afficher « Quantinvo »
  deux fois. **Le site doit être déployé avant les fonctions edge**, sinon les
  e-mails pointent vers une image absente.
- **Tableaux et styles en ligne**, pas de flexbox : Outlook. La dégradation
  (coins droits, mêmes couleurs) est prévue — ne pas « moderniser » ce
  balisage.
- Le module reste **sans API Deno** : c'est ce qui permet aux tests du site de
  l'exécuter tel quel (`web/tests/email-template.test.ts`, qui vérifie aussi
  qu'aucune fonction edge ne réécrit son HTML à la main).

Aperçu des quatre messages (compteur, superviseur, administrateur, invitation à
un inventaire) : https://claude.ai/code/artifact/c5dc05ae-7500-4455-8c9f-3ae600b2ecf4

**Les fonctions edge modifiées doivent être redéployées** pour que le nouveau
gabarit parte réellement : le dépôt ne déploie rien tout seul.

## On peut répondre aux messages (22 août 2026)

Julien : *« tu dis “dites-le nous en répondant à ce message”, sauf qu'on ne
peut pas y répondre »*. Les messages partent d'une adresse d'envoi
(`INVITE_FROM_EMAIL`) qui ne lit rien, et quatre textes promettaient une
réponse. Deux règles, gardées par `web/tests/email-template.test.ts` qui
balaie toutes les fonctions :

- **tout envoi pose un `reply_to`** — `CONTACT_EMAIL` d'abord, sinon un repli
  que l'appelant a sous la main (l'adresse de l'administrateur qui envoie le
  devis ou refuse, celle du client sur un avis interne — on répond alors au
  prospect directement depuis sa boîte). `_shared/email.ts` porte
  `adresseDeContact()` et `envoyerEmail()` ; les fonctions les plus récentes
  passent par ce dernier, les autres injectent `reply_to` dans leur appel ;
- **un texte qui invite à écrire donne l'adresse, ou se tait**. Jamais
  « répondez à ce message ». Côté site, `lib/contact.ts` lit
  `NEXT_PUBLIC_CONTACT_EMAIL` et `/devis` s'en sert de la même façon.

**Posé le 22 août 2026** : `CONTACT_EMAIL` (secret edge) et
`NEXT_PUBLIC_CONTACT_EMAIL` (Vercel, environnement Production) valent
`contact@quantinvo.com`. Vérifié sur la page publique du devis. Sans ces
variables, les fonctions sans repli n'auraient pas de `reply_to` et les
textes ne promettraient rien : c'est le comportement de secours.

**La boîte `contact@quantinvo.com`** : redirection ImprovMX (gratuit) vers
`devkaylab@gmail.com` — MX `mx1/mx2.improvmx.com`, SPF
`include:spf.improvmx.com` et DMARC `p=none` (rapports sur contact@) posés
sur la racine, dans Vercel → Domains. Gmail « envoie en tant que » contact@
par `smtp.gmail.com` avec un mot de passe d'application (le SMTP d'ImprovMX
est payant) : un client qui reçoit une réponse voit Quantinvo, pas Gmail.
Resend reste sur `send.quantinvo.com`, aucun conflit. Un mail envoyé à
soi-même via l'alias peut tomber en spam — c'est propre à ce cas, ImprovMX
l'explique ; tester depuis une autre adresse.

**Les templates hébergés par Resend ont été examinés puis écartés**
(21 août 2026, décision de Julien). Ils existent bien — `template: { id,
variables }` à l'envoi, éditeur et historique côté tableau de bord — et ils
permettraient de changer un mot sans redéployer. Trois raisons de rester au
code : la syntaxe de variables est `{{{NOM}}}`, dont la documentation ne dit
pas si elle échappe (c'est précisément le trou fermé ici) ; il n'y a ni
condition ni répétition, alors que nos messages en ont (salutation nommée ou
non, encadré de faits pour le seul inventaire, note et raison facultatives) ;
et le gabarit sortirait de git et de ses tests.

À savoir si la question revient : **la clé Resend en production est limitée à
l'envoi**. Vérifié en direct — `POST /emails` répond 200, mais `POST
/templates`, `GET /templates` et `GET /emails/{id}` répondent tous 401
« This API key is restricted to only send emails ». C'est du moindre privilège
voulu : une fuite de cette clé permettrait d'envoyer, pas de lire ce qui est
parti. Passer aux templates Resend obligerait donc à créer une clé plus
puissante quelque part — c'est une décision de sécurité, pas un simple
déplacement de fichiers.

# Application mobile : « Mon profil » rangé comme le site (21 août 2026)

L'écran profil de l'app était le carrefour que le site avait démonté quelques
jours plus tôt : identité, entreprise, magasins et leurs codes, balises,
inventaires, équipe, déconnexion et suppression, empilés sur deux hauteurs
d'écran. Il suit désormais la même logique — **la personne, puis des lignes
vers le travail** — mais sans barre d'onglets : sur mobile, le bouton profil du
bandeau ouvre un **seul écran, `account.tsx` (« Mon compte »)**, qui mène aux
autres.

Ce qui a bougé :

- `(supervisor)/profile.tsx` **supprimé**, remplacé par `(compte)/account.tsx` ;
- écrans nés de son démembrement, dans `(supervisor)` car ils sont le travail
  du superviseur : `stores.tsx` (Magasins), `team.tsx` (Mon équipe),
  `tools.tsx` (Boîte à outils) — mêmes noms que les onglets du site ;
- **groupe `(compte)`** : `account.tsx`, `password.tsx`, `mfa.tsx`,
  `my-data.tsx`, `name.tsx`, communs à tous les rôles (voir plus bas) ;
- **« Mes inventaires » retiré** : l'écran Sessions les liste déjà. C'est le
  doublon que le site avait lui aussi sorti de `/account`.
- `MenuList.tsx` (`MenuCard`, `MenuRow`, `SectionLabel`, `ChevronIcon`) : le
  motif de menu existait déjà, redessiné à la main dans l'écran d'un
  inventaire. Une seule définition maintenant.
- Requêtes devenues sans objet et retirées : `getMySessions`,
  `getTeamMembers`, `getTeamInvitations`, le type `Invitation`.

**`my_team_by_store` est la même RPC que la page « Mon équipe » du site**, et
c'est voulu : deux écrans qui montrent la même chose doivent la demander de la
même façon. Piège vérifié à la source — elle **ne renvoie pas `full_name`**
pour les invitations, seulement `first_name` et `last_name` (type `TeamInvite`,
volontairement plus étroit que la ligne de table). S'appuyer sur le type de la
table afficherait un nom vide en toutes circonstances. L'annulation passe par
`cancel_my_invitation`, comme le site, et non plus par un DELETE nu sur
`team_invitations`.

Les types `src/types/database.types.ts` ont été **régénérés** au passage : ils
dataient d'avant `first_name`/`last_name`/`is_company_admin` sur `profiles` et
d'avant `export_my_data` et `my_team_by_store`.

## Mot de passe, double authentification, export : l'app ne renvoie plus au site

Les trois fonctions n'existaient que sur le site. Elles sont dans l'app.

- **`src/lib/password.ts` est la copie exacte de `web/lib/password.ts`**, comme
  `baliseSeries` et `presence` : l'app et le site ne compilent pas ensemble.
  Les deux fichiers bougent ensemble — `web/tests/password.test.ts` échoue
  s'ils divergent, et la console Supabase reste la seule à faire foi.
- **`src/lib/mfa.ts` n'est pas une copie** : il rend en plus l'adresse
  `otpauth://`. Sur un téléphone, l'application d'authentification est
  installée sur l'appareil qui affiche le QR code — **on ne peut pas le
  scanner**. Le chemin principal est donc l'ouverture directe de l'application,
  ou la clé recopiée ; le QR ne sert qu'à s'enrôler depuis un autre appareil.
  Le QR est redessiné avec `qrcode` + `react-native-svg` (`QrCode.tsx`) : celui
  de Supabase est une image SVG en `data:`, que `<Image>` ne sait pas afficher.
  Et **pas de `canOpenURL`** avant l'ouverture : sur iOS il répond faux pour
  tout schéma absent de `LSApplicationQueriesSchemes`, même quand une
  application sait l'ouvrir.
- **Conséquence obligatoire, à ne jamais défaire : la connexion de l'app
  demande le code.** `AuthProvider` expose `mfaRequired` (contrat aal1/aal2
  identique au site), `index.tsx` renvoie vers `/login` tant qu'il est vrai, et
  `login.tsx` affiche la deuxième étape. Sans cela, activer la double
  authentification depuis le téléphone ne protégerait que le site : le
  téléphone continuerait à laisser entrer au mot de passe seul. Tests de garde :
  `tests/compte.test.ts`.
- **Il n'y a toujours pas de codes de secours.** Un téléphone perdu se dépanne
  en base (`delete from auth.mfa_factors where user_id = …`, en `service_role`).
  Ouvrir l'activation à tous les superviseurs rend ce dépannage plus fréquent :
  l'écran le dit avant l'activation, dans un encadré, plutôt qu'après la perte.

## Le compte est le même pour tous les rôles — groupe `(compte)`

Les écrans de compte ont d'abord été écrits sous `(supervisor)`, ce qui les
rendait **inatteignables pour un compteur** : la garde de ce groupe renvoie
vers la connexion tout ce qui n'est pas superviseur. Or changer son mot de
passe, activer sa double authentification ou récupérer ses données ne dépend
pas du rôle. Ils vivent donc dans `(compte)`, dont la seule condition d'entrée
est d'avoir un profil — et une session complète (`mfaRequired` y est refusé,
sinon on pourrait retirer son second facteur à moitié authentifié).

`(compte)/account.tsx` est **un seul écran pour tout le monde**, comme
`/account` sur le site : seul le bloc « Mon travail » (Magasins, Mon équipe,
Boîte à outils) est conditionné au rôle superviseur. Les deux layouts,
`(supervisor)` et `(employee)`, ouvrent le même écran par le bouton profil du
bandeau.

**Le groupe porte aussi les écrans de travail — et c'est la flèche de retour
qui l'a imposé.** Magasins, Mon équipe, Boîte à outils et Ajouter un membre
sont restés d'abord dans `(supervisor)` : les ouvrir depuis « Mon compte »
traversait deux groupes de routes, la pile repartait de zéro et **le bouton
retour disparaissait**. Règle à retenir : *ce qu'un écran ouvre doit être dans
sa pile*. La garde de rôle que portait le groupe `(supervisor)` est donc posée
dans chacun de ces quatre écrans (`profile?.role !== 'supervisor'` → retour à
« Mon compte ») ; les RPC refusent déjà un compteur côté serveur, cette garde
lui évite un écran en erreur.

**L'administrateur d'entreprise est un superviseur comme les autres pour ces
écrans**, et c'est un piège de rédaction : lui écrire « l'administrateur de
votre entreprise vous affectera un magasin » le renvoie à lui-même. Les états
vides de Magasins et Mon équipe branchent donc sur `profile?.is_company_admin`.
⚠️ **Leur texte a changé le 22 août 2026** : il ne s'affecte plus rien, il est
affecté à *tous* les magasins de son entreprise (section « L'administrateur
d'entreprise supervise tous les magasins » plus bas). S'il n'en voit aucun,
c'est que l'entreprise n'en a aucun.

**Un échec de chargement n'est pas une liste vide.** Ces deux écrans
distinguent `isError` du cas « aucune ligne » : sans cela, une coupure de
réseau annonce « Aucun magasin » à quelqu'un qui en a, et l'envoie réclamer un
accès pour rien. Vu en simulateur, requête refusée et message « Aucun
magasin » à l'écran.

« Mon compte », lui, est le **premier** écran de sa pile : la flèche native ne
s'affiche pas alors qu'on arrive bien de Sessions ou de l'accueil. D'où le
`headerLeft` « Retour » du layout, conditionné à `router.canGoBack()`.

Conséquence côté compteur : « Déconnexion » posé en haut de son accueil et le
lien souligné « Supprimer mon compte » en pied ont disparu — les deux sont
dans « Mon compte », comme pour le superviseur. `DeleteAccountButton` (le
lien) n'avait plus d'appelant : le fichier est devenu
`components/AccountDeletion.tsx`, qui n'expose plus que `useAccountDeletion`
et `DeletionPendingNote`.

Maquette de référence :
https://claude.ai/code/artifact/032d3ee8-ee0f-4b32-9b21-c6a5d278356c

# Le rapport recense l'attendu, pas seulement le compté (22 août 2026)

Deux écrans du même inventaire se contredisaient : sur « Test », l'onglet
Set up annonçait **1 015 pièces attendues** quand le Rapport en affichait
**395**, sur 11 lignes alors que le fichier théorique en compte 21.

`get_session_results` partait de `article_audit`, qui ne contient une ligne
que pour un SKU **déjà scanné**. Un article attendu et jamais trouvé n'avait
donc aucune ligne : son théorique n'était pas additionné, et son manque
n'entrait pas dans l'écart — les quatre tuiles du haut étant calculées en
additionnant les lignes affichées. **L'inventaire ne montrait pas la démarque
qu'il est censé révéler.**

Règle donnée par Julien : **le fichier qui fait foi est le stock théorique,
pas le référentiel**. Sans stock théorique, seuls les SKU comptés
apparaissent ; avec, tout l'attendu apparaît.

D'où l'**union** de `theoretical_stock` et des SKU comptés (migration
`20260822090001`), qui couvre les deux règles sans condition : quand aucun
fichier théorique n'est importé, l'union se réduit d'elle-même aux SKU
comptés. Ne pas la remplacer par un `from theoretical_stock` sec, ni par une
jointure interne — le rapport des inventaires sans fichier attendu se
viderait.

**Les règles d'audit ne bougent pas**, et c'est délibéré : la quantité qui
fait foi reste `final_qty → qty_pass2 → qty_pass1` (une quantité arbitrée
l'emporte sur l'audit, qui l'emporte sur le comptage), et la priorité des
statuts reste `failed > pending > resolved > validated`. Le seul ajout est
`uncounted` (« Non compté »), qui ne peut jamais écraser un statut d'audit :
il ne s'applique qu'aux SKU **sans aucune ligne d'audit**, donc jamais
comptés. Il n'entre pas dans le décompte « articles présentant encore un
écart ».

Un article compté mais **absent** du fichier théorique garde sa ligne, en
écart positif : c'est un surplus, le cacher serait l'erreur inverse.

Ordre de mise en ligne, à respecter si le sujet est repris : **les libellés
d'abord, la base ensuite** — sans `uncounted: 'Non compté'` dans
`web/lib/inventory.ts` et `src/lib/report.ts`, ces lignes s'affichent avec le
mot technique brut. Les builds mobiles antérieurs le montreront dans leur
export jusqu'au prochain build : c'est la contrepartie assumée.

Vérifié après application sur « LA Bruket » : 101 lignes au lieu de 5, dont 96
« Non compté », stock théorique 719 (contre 328) et écart −650 (contre −259).

Tests de garde : `web/tests/charge.test.ts`, bloc « le rapport d'inventaire ».

## Les totaux de l'app, vérifiés le 22 août 2026

Deux écrans additionnaient des lignes **téléchargées sur le téléphone**, et
les deux sont passés au serveur.

- **Écran d'un inventaire (superviseur)** : `getSessionCounts` rapatriait
  *toutes* les lignes de `counts` de l'inventaire, toutes colonnes, à chaque
  ouverture et à chaque rafraîchissement — pour en tirer deux nombres. C'est
  le motif que le site avait retiré pour la tenue en charge, resté en place
  côté mobile. Il appelle maintenant `get_session_count_totals`. La fonction
  `getSessionCounts` n'existe plus : **ne pas la réintroduire**.
- **Écran d'un compteur** : `getMyCounts` ne filtre pas sur l'utilisateur —
  c'est la policy `counts_select_own` qui limite un compteur à ses lignes.
  Un **superviseur** relève de `counts_select_supervisor` et aurait vu *toute
  l'équipe*, affichée comme son travail à lui. Le groupe `(employee)` ne
  vérifie que la présence d'un profil, pas le rôle, donc rien ne l'en
  empêchait ; c'est le routage par rôle qui l'évitait en pratique. Nouvelle
  fonction `get_my_count_totals` (migration `20260822110001`), qui ne compte
  que `auth.uid()` quel que soit le rôle. `getMyCounts` reste utilisé par
  `CountedBalisesList`, qui a besoin des lignes et non d'un total.

Le risque commun aux deux : au-delà d'un certain nombre de lignes, l'API peut
en rendre moins que demandé, et le total baisse **sans rien signaler**. Aucun
inventaire actuel n'est assez gros pour l'observer — c'est précisément
pourquoi il fallait le corriger avant.

Vérifié depuis le site avec une session réelle : `get_session_count_totals`
rend 70 / 11 / 5 / 1 sur « LA Bruket », `get_my_count_totals` rend 1 / 11 pour
le compte connecté — conforme à la base. Et depuis le simulateur non connecté,
les deux répondent `42501` : `anon` est bien refusé.

## Les autres totaux, vérifiés le 22 août 2026

Recalculés en SQL indépendamment et comparés aux fonctions, sur les données
réelles. **Rien d'autre n'est faux** — voici ce qui a été contrôlé et les deux
limites trouvées, qui ne sont pas des défauts mais des choix.

Contrôles passés :

- **aucun comptage orphelin** : sur le seul inventaire en mode balises, les
  32 pièces sont toutes rattachées à une zone existante (0 `zone is null`,
  0 code inconnu). Le risque reste ouvert structurellement — rien n'interdit
  un comptage sans zone —, il ne s'est simplement jamais produit ;
- **la somme des totaux par zone égale le total global**, passe par passe ;
- **la progression** est bien un pourcentage de **balises** (6 comptées sur
  10 = 60 %, 2 auditées = 20 %), pas de pièces. En mode classique, elle
  rapporte les pièces scannées au stock théorique attendu, et le dit quand
  celui-ci vaut zéro ;
- **l'onglet Écarts** : 4 écarts affichés sur « Test », 5 lignes arbitrées
  exclues — conforme au calcul refait à la main.

Deux limites à connaître :

1. **En mode classique, un article compté mais jamais retrouvé à l'audit
   n'apparaît pas dans les écarts.** Sa quantité d'audit est nulle, et rien ne
   distingue « l'auditeur ne l'a pas trouvé » de « l'auditeur n'est pas encore
   passé ». C'est un choix délibéré de `computeDiscrepancies` — pas de faux
   positifs, au prix de ce silence. En mode balises le problème n'existe pas :
   clôturer une balise dit « j'ai fini ici ». Sur « LA Bruket », 4 lignes sont
   dans ce cas.
2. **`counted_skus` n'était affiché nulle part** — il traversait la RPC, le
   hook et les types sans jamais être rendu. Il l'est depuis le 22 août 2026 :
   tuile « Références comptées », à droite de « Pièces comptées », avec les
   références auditées en sous-titre. Les pièces disent le volume, les
   références disent l'étendue — 300 pièces sur 4 références n'est pas le même
   inventaire que 300 pièces sur 250.

   **Le décompte ne retient que les références dont il reste quelque chose**
   (décision de Julien, migration `20260822100001`). `counts` est append-only :
   une correction est une ligne négative, donc un article scanné puis
   entièrement corrigé avait des lignes mais un net nul, et gonflait le
   chiffre — « 25 références comptées » là où il n'en restait que 23 avec du
   stock. Le décompte porte sur le **net par SKU, strictement positif** ; un
   net négatif est exclu par la même condition. Même règle pour les références
   auditées, les deux se lisant côte à côte.

   **Les totaux de pièces ne bougent pas** : sommer par SKU puis additionner
   donne le même résultat que sommer directement — vérifié après application
   sur les cinq inventaires.

   La rangée passe à cinq tuiles : `.dash-stats-5` remplace la grille de
   quatre colonnes fixes par `auto-fit` à 116 px minimum, faute de quoi la
   cinquième se retrouvait seule sur une deuxième ligne entre 900 et 1100 px
   de large. Sous 900 px, la règle générale à deux colonnes reprend la main —
   elle est plus bas dans la feuille, donc elle gagne.

# Supprimer et retirer depuis l'app (22 août 2026)

*« Dans la même logique que le site, rends possible la suppression
d'inventaire ou de membres d'équipe sur l'app. »* L'app savait déjà supprimer
un inventaire **depuis l'inventaire lui-même** et annuler une invitation ; il
manquait la suppression **depuis la liste** et le retrait d'un compteur.

Les règles du site sont reprises telles quelles, parce qu'elles portent la
sûreté du geste :

- **La corbeille n'apparaît que sur ce qu'on peut supprimer** — créateur, ou
  administrateur de l'entreprise pour tous les siens, comme `delete_session`.
  Les cartes d'« Inventaires invités » n'en ont pas. Afficher partout ferait
  découvrir le refus après coup.
- **La confirmation nomme l'inventaire** et signale s'il n'est pas clôturé.
  Sur un téléphone une corbeille se touche vite, et la suppression emporte
  comptages, stock théorique, audits, membres et référentiel.
- **Retirer un compteur vise UN magasin**, jamais tous
  (`remove_counter_from_store`, mêmes arguments que le site). Une même
  personne peut compter dans plusieurs magasins supervisés par des personnes
  différentes ; la confirmation nomme donc la personne **et** le magasin.

**La sélection multiple existe aussi sur l'app** (ajoutée le même jour, à la
demande de Julien). Elle reprend les trois précautions du site — « Tout
sélectionner » ne porte que sur ce qui est sélectionnable, la confirmation
**nomme** les inventaires (huit au plus, puis « et N autres ») et signale ceux
encore en cours, et la suppression appelle `delete_session` **une fois par
inventaire** en rapportant les échecs (« Suppression partielle : 7 sur 10 »).

Deux adaptations au doigt :

- on y entre par **appui long** sur une carte *ou* par le bouton
  « Sélectionner » de l'en-tête — l'appui long ne s'invente pas, il ne peut
  pas être le seul chemin. ⚠️ **L'appui long doit se garder du relâchement** :
  il coche la carte *et* fait passer l'écran en mode sélection, si bien que le
  `onPress` du relâchement décochait aussitôt (relevé par Julien le 22 août
  2026 : « elle est sélectionnée puis elle se désélectionne »). Un drapeau
  `appuiLong`, remis à faux à chaque `onPressIn`, avale ce `onPress` — et ne
  reste pas armé si la plateforme ne l'envoie pas ;
- la barre d'action est sur **deux rangées**. À quatre éléments sur la largeur
  d'un téléphone, « 1 sélectionné » se cassait sur trois lignes (constaté au
  simulateur). Elle remplace le bouton « + Nouvel inventaire » le temps de la
  sélection.

Ce qui n'est pas sélectionnable (les inventaires invités) reste lisible mais
s'efface, et sa case n'apparaît pas.

**Le balayage vers la gauche** découvre deux volets — « Clôturer » (ambre) et
« Supprimer » (rouge) — en plus de la corbeille (demande de Julien :
« naturel pour l'user »). Quatre points :

- **les deux droits ne sont pas les mêmes**, et l'écran le respecte :
  supprimer est réservé au créateur (ou à l'administrateur d'entreprise),
  **clôturer est ouvert à tout superviseur participant** — c'est un geste de
  terrain que le créateur peut défaire. Un inventaire déjà clôturé n'a plus
  de volet « Clôturer » ;
- **l'ordre compte** : Clôturer d'abord, Supprimer ensuite. Le geste
  destructeur est le plus loin du doigt, il faut aller le chercher ;
- ils **n'agissent pas tout seuls** : chaque volet ouvre la même confirmation
  nommée que son équivalent au clavier. Un inventaire emporte comptages,
  stock théorique, audits, membres et référentiel ; un geste de travers ne
  doit pas suffire ;
- ils n'existent **ni quand il n'y a rien à y faire, ni pendant une
  sélection** — le geste entrerait en concurrence avec le défilement d'une
  liste qu'on est en train de cocher ;
- **un volet ouvert se referme au premier contact ailleurs** (demande de
  Julien) : sinon il reste ouvert dans le dos de la personne et son prochain
  appui tombe sur un bouton rouge qu'elle ne regardait plus. Trois précautions
  dans ce mécanisme :
  · `onStartShouldSetResponderCapture` renvoie **`false`** — on referme sans
    prendre le geste, donc l'élément touché reçoit quand même son appui ;
  · la position du rang est **mesurée à l'ouverture** (`measureInWindow`) et
    le point touché comparé à ce rectangle : sans cela on refermerait sous le
    doigt de quelqu'un qui vise justement « Supprimer » ;
  · un volet qui se ferme n'oublie l'enregistrement **que s'il est bien celui
    qu'on avait noté**. Ouvrir un rang referme le précédent, dont la fermeture
    effacerait sinon l'enregistrement du nouveau — qui resterait ouvert sans
    que personne ne le sache. Faire défiler la liste referme également ;
- il a fallu poser un **`GestureHandlerRootView` à la racine** de
  l'application (`src/app/_layout.tsx`), qui manquait : sans lui aucun geste
  n'est reçu. Ne pas le retirer en refactorant le layout.

Aucune dépendance native ajoutée — `react-native-gesture-handler` était déjà
installé, donc **pas de `pod install`**, donc pas de correctif du chemin avec
espace à réappliquer.

Au passage, la croix d'annulation d'une invitation était le caractère « ✕» :
c'est un tracé désormais, comme le reste des icônes.

Tests de garde : `tests/compte.test.ts`, bloc « supprimer et retirer depuis
l'app ».

# Inviter un compteur, et le voir (23 août 2026)

Constat de Julien, en test réel : *« n'ayant personne dans mon équipe, j'ai
envoyé une invitation au compteur, puis retour auto sur page mon équipe mais
elle est vide, ce qui peut perturber le superviseur qui retentera »*. Il a
effectivement recommencé — deux comptes créés à cinq minutes d'intervalle.

Deux causes, indépendantes.

**1. Rien n'était rechargé.** `new-member.tsx` invalidait
`['team-invitations']` — la clé d'une requête **supprimée le 21 août 2026**
avec l'ancien écran de profil. Plus personne ne l'écoutait. « Mon équipe »
reste montée sous l'écran d'ajout, et le cache tient 30 s : le retour
affichait donc l'ancienne réponse, vide. La bonne clé est `['my-team']`.
⚠️ **Une clé de cache qui ne correspond à rien ne fait échouer aucun test et
ne lève aucune erreur.** Vérifier la clé, pas seulement la présence d'un
`invalidateQueries`.

**2. La personne apparaît comme compteur, pas comme invitation.**
`generateLink` crée l'utilisateur `auth` immédiatement, donc `handle_new_user`
se déclenche, crée le profil, l'affecte au magasin **et consomme la ligne
`team_invitations`**. Le bloc « Invitations en attente » ne montre donc rien
dans le cas nominal (il reste un filet pour le cas où la création auth
échoue). C'est la ligne de compteur qu'il faut savoir lire.

**⚠️ `is_active` veut dire « s'est déjà connecté », rien d'autre.** Le badge
mobile affichait « Accès retiré » — un contresens, et sur le cas le plus
courant : quelqu'un qu'on vient d'inviter. Une personne réellement retirée
n'a plus de ligne du tout, `remove_counter_from_store` efface son
`store_team`. Le libellé est désormais celui du site (`BadgeEnAttente`,
/equipe) : **« Mot de passe à créer »**.

Deux choix de mise en page, vérifiés au simulateur :

- **la pastille se pose sous le nom**, pas à côté. Sur la largeur d'un
  téléphone, la rangée nom + pastille + « Retirer » cassait le nom sur deux
  lignes et tronquait l'adresse (« jthiongkay+… ») — or c'est précisément
  l'adresse qu'on veut relire ;
- **la ligne porte l'adresse tant que la personne n'a pas ouvert
  l'application**, et son activité ensuite. C'est là qu'est parti le lien :
  c'est ce qu'on veut vérifier quand on doute d'une faute de frappe.

Vérifié au simulateur le 23 août 2026, clair et sombre, sur les données
réelles du compte d'essai — et l'état « en attente » photographié en forçant
temporairement la branche d'affichage, puis rétabli (`git diff` contrôlé).

Tests de garde : `tests/compte.test.ts`, bloc « une personne invitée apparaît
tout de suite ».

# Une personne d'une autre entreprise (22 août 2026)

Ajouter à son équipe quelqu'un dont le compte appartient à une autre
entreprise affichait « **Erreur** — Cette adresse est déjà utilisée dans une
autre entreprise », sans dire quoi faire. Constat de Julien, capture à
l'appui : *« plutôt qu'un message d'erreur, signale que cette personne fait
partie d'une entreprise extérieure à celle-ci, inviter à passer par l'admin de
l'entreprise »*.

Les deux fonctions edge concernées (`invite-teammate` pour l'équipe,
`invite-to-session` pour un inventaire) renvoient désormais
`code: 'other_company'` avec un texte qui donne la marche à suivre :
s'adresser à l'administrateur de son entreprise, ou utiliser une autre
adresse. **Le code compte autant que le texte** : sans lui, un écran ne peut
que titrer « Erreur » et recopier la phrase.

Trois points à ne pas défaire :

- **Ce n'est pas une faute de saisie.** Rien à corriger dans le formulaire :
  l'app titre « Cette personne n'est pas de votre entreprise », le site
  affiche l'explication **sous le formulaire** et non dans une notification
  qui s'efface avant qu'on l'ait lue.
- **Ne jamais nommer l'autre entreprise.** Le superviseur apprendrait quelque
  chose sur un client qui n'est pas le sien. Un test le vérifie.
- Compromis assumé : le message **confirme** que l'adresse a un compte
  ailleurs. C'est ce que Julien a demandé, et c'est déjà ce que faisait
  l'ancien texte — mais cela reste une information sur l'existence d'un
  compte, à garder en tête si le sujet de l'énumération d'adresses revient
  (voir constat M3).

`src/lib/queries.ts` fait voyager le code sur l'erreur levée
(`err.code = res.code`) : sans cela il se perdait entre la fonction edge et
l'écran.

**Les deux fonctions edge doivent être redéployées** pour que le message
change réellement — le dépôt ne déploie rien tout seul.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « une personne
d'une autre entreprise ».

# Lint du site : `next lint`, jamais `eslint` à la main (22 août 2026)

Le site se vérifie avec **`npx next lint`** depuis `web/`, qui lit
`web/.eslintrc.json`. Lancer `npx eslint …` directement depuis `web/` donne
de faux résultats : ESLint remonte l'arborescence et charge
`eslint.config.js` à la **racine du dépôt** — la configuration de
l'application mobile (Expo), qui porte des règles React récentes
(`react-hooks/set-state-in-effect`, `react-hooks/refs`) étrangères au site.
On croit alors voir une trentaine d'erreurs (« setState dans un useEffect »
sur chaque page qui charge ses données au montage) là où `next lint` ne
signale rien. Constaté le 22 août 2026 : une fausse erreur a été annoncée à
Julien, puis une désactivation de règle inutile a été écrite et retirée.

Conséquence : **ne rien désactiver dans `.eslintrc.json` sur la foi d'un
`eslint` lancé à la main** — vérifier d'abord avec `next lint`.

## « À traiter » sur /admin : des gestes, pas des constats (22 août 2026)

Julien : *« pas besoin d'avoir ce genre de message, qui ne sont pas en
réalité des alertes »* — à propos de « n'a jamais lancé d'inventaire » et
« n'a pas compté depuis 64 jours ». Un magasin qui ne compte pas suit son
rythme, ce n'est pas une anomalie à corriger. Le bloc ne liste plus que ce
qui appelle un geste de Quantinvo : entreprise sans magasin (donc sans
licence facturée), entreprises sans administrateur, demandes de suppression
de compte. `admin_business_overview` rend toujours `idle_stores` ; la page
l'ignore. Ne pas réafficher ces lignes.

# Le site est un outil d'ordinateur (21 août 2026)

Sous **720 px de large**, l'espace connecté ne s'ouvre pas : il affiche « Cet
espace se pilote depuis un ordinateur », avec deux sorties — retour au site
public, se déconnecter — et le rappel que compter se fait dans l'application.

Décision de Julien, à la vue du rendu réel : *« il y a une app, investir du
temps dans la version mobile du site n'a pas de sens »*. Le site est l'outil
du superviseur — tableaux d'articles, imports de fichiers, rapports — et le
terrain a déjà son application. Une mise en page tactile crédible pour ces
écrans coûterait cher et servirait un usage qui n'existe pas.

Ce qu'il faut savoir avant d'y toucher :

- **La porte est en CSS, pas en JavaScript** (`@media (max-width: 719px)`
  masque `.appbar`, `.app-main` et `.dash`, et démasque `.ordinateur-requis`).
  Une mesure d'écran au montage donnerait une bascule visible au chargement et
  casserait le rendu statique. Ne pas « améliorer » en `useEffect`.
- **Elle ne ferme que la coquille `AppShell`.** Les pages publiques doivent
  rester utilisables au téléphone, et ce n'est pas un détail : les liens
  d'invitation partent par e-mail, donc s'ouvrent sur un téléphone. `/login`,
  `/bienvenue`, `/reinitialisation`, `/inventaire` et `/open` n'entrent pas
  dans la coquille — un test le vérifie, précisément pour empêcher qu'on les y
  « range » un jour.
- **720 px, pas 780** : le seuil laisse passer une tablette en portrait (768),
  où le tableau de bord bascule déjà en une colonne avec son menu burger. Le
  burger `MobileNav` sert donc encore, dans la bande 720–780.
- Un téléphone **en paysage** (844 px et plus) passe la porte. C'est assumé :
  bloquer à cette largeur bloquerait aussi une fenêtre de bureau réduite.

Corrigé au passage, sur le même constat : les onglets de la barre ne passaient
**jamais** à la ligne sous 900 px — `flex: 1` (base 0) l'emportait sur le
`width: 100%` de la règle mobile, donc ils s'écrasaient à droite de l'avatar
et il n'en restait qu'un, coupé dans un défilement horizontal. Le `flex: none`
est le correctif. Et `plural(n, 'balise en cours')` affichait « 5 balise en
courss » : cet assistant ajoute un `s` à la **fin de la chaîne**, il faut lui
donner le pluriel en toutes lettres dès que le mot n'est pas seul.

## ⚠️ À FAIRE : publier l'application et brancher les vraies fiches

L'écran « ordinateur requis » porte **deux boutons de téléchargement**, App
Store et Google Play. **L'application n'est publiée sur aucune des deux
boutiques.** Tant que ce n'est pas fait, `web/lib/appStores.ts` garde
`PUBLIEE = false` : les boutons ouvrent la **recherche** de chaque plateforme
— des adresses qui fonctionnent aujourd'hui et qui montreront la fiche le jour
venu — et l'écran affiche « L'application arrive bientôt sur les deux
boutiques ».

**Le jour de la publication, tout se règle dans ce seul fichier** : passer
`PUBLIEE` à `true` et remplacer les deux adresses par les fiches réelles —
`https://apps.apple.com/fr/app/quantinvo/id<IDENTIFIANT>` (l'identifiant
numérique vient d'App Store Connect) et
`https://play.google.com/store/apps/details?id=<PACKAGE>`. Un test échoue si
le composant se met à écrire une adresse en dur.

Deux choix à connaître, pris le 21 août 2026 :

- **Les badges sont dessinés**, pas repris d'Apple et de Google : leurs images
  de marque sont soumises à leurs chartes, et un bouton maison reste cohérent
  avec le site. Les logos sont des tracés SVG (`components/StoreBadges.tsx`).
- **Jamais de lien vers une fiche inexistante.** Une adresse de fiche inventée
  tomberait sur une erreur ; la recherche, elle, répond toujours.

Rappel : il n'y a pas encore de build Android, donc la fiche Google Play
suppose d'abord un APK. Voir la section « Build iOS » de la mémoire projet.

## L'onglet Set up tient en deux volets (21 août 2026)

Demande de Julien : *« deux sections qui collapsent, une Zone de comptage pour
la partie balise et une Données d'inventaire pour la partie fichiers. L'idée
est d'épurer cette page trop chargée. »* La page déroulait tout en permanence
— planche de balises, affectation des plages, liste des emplacements, deux
imports et leurs colonnes attendues — et se lisait comme un mur.

Composant : `components/ui/Volet.tsx`, un `<details>` (le clavier, le lecteur
d'écran et la recherche dans la page marchent sans qu'on ait à les
rebrancher).

Deux règles portent l'idée, à ne pas défaire :

- **Tout part replié.** Décision explicite de Julien : *« Pas d'ouverture
  auto, reste collapsés. Même en mode sans balise. »* Une première version
  ouvrait la section restant à faire ; c'est écarté. Pas de `open`
  conditionnel — un test le vérifie.
- **L'en-tête dit ce qu'il y a dedans.** C'est ce qui sépare « replié » de
  « caché » : un résumé (« 3 emplacements · 40 balises affectées »,
  « 135 références · aucun stock théorique ») et une pastille « À faire » /
  « Prêt ». Sans eux, il faudrait ouvrir chaque volet pour savoir où on en
  est, et la page n'aurait rien désencombré.

**Le bandeau « Commencer l'inventaire » reste au-dessus des volets** : c'est
une action, pas un réglage, elle ne doit jamais se retrouver derrière une
section fermée. Même chose pour l'avertissement d'inventaire clôturé.

Au passage, le chevron des `<details>` déjà en place (`.collapsible`, employé
par « Conseils de format » et l'onglet Écarts) n'est plus le caractère « ▸ » :
deux bordures et une rotation, pour la même raison que le chevron du menu de
compte — à cette taille, un caractère ne se lit plus.

Maquette de référence :
https://claude.ai/code/artifact/3f89b33f-7a72-4bc1-bc00-78429c8443db

## Une seule largeur, un seul en-tête (passe de finition)

Reproche de Julien : *« la barre n'a pas la même longueur entre dashboard et
les autres pages, tu dois consistant ! »* J'avais élargi cette page seule. La
règle : **une largeur pour tout l'espace connecté** — `.appbar-inner` et
`.app-main` à 1120 px, sans modificateur par page. Un test le garde.

Dans la foulée, quatre points de système qui appartiennent au même geste :

- **`.app-head` + `.page-title` partout.** Le tableau de bord d'un inventaire
  gardait `.dash-detail-head` et `.admin-title`, hérités du temps où il vivait
  hors de la coquille. Les trois classes mortes ont été supprimées, et
  `.page-sub` (le magasin et le numéro sous le titre) remplace un style en
  ligne.
- **`--appbar-h`** porte la hauteur de la barre en un seul point (64 px, et
  125 px sous 900 px où elle passe sur deux rangs — valeur mesurée au
  navigateur). `.dash-rail` s'y colle en `calc(var(--appbar-h) + 24px)` :
  avec son ancien `top: 24px`, la colonne de gauche glissait **sous** la barre
  collante au défilement.
- **`.dash-rail > .panel { margin-top: 0 }`.** `.panel` porte un
  `margin-top: 16px` utile ailleurs ; dans le rail, l'espacement vient du
  `gap`. Sans cette remise à zéro, la première carte descendait de 16 px sous
  la barre d'onglets d'en face et l'écart entre cartes valait 36 px au lieu
  de 20.
- **Le logo passe à 38 px** dans les en-têtes qui portent le mot
  « Quantinvo » (barre de l'espace connecté, en-tête du site public, page des
  mentions légales, écran « ordinateur »). À 30 px, le cube ne faisait que
  13 px : dans la tuile, il n'occupe que 43 % de la hauteur, le reste est du
  fond. Le pied de page reste à 24 px, volontairement plus discret.
- **`Logo` accepte un `gradientId`.** Un identifiant SVG est unique dans la
  page : la barre et l'écran « ordinateur requis » en posent deux, et avec le
  même identifiant le second perd son fond dès que le premier disparaît.
- **`.btn { line-height: 1.5 }`.** Le navigateur impose `line-height: normal`
  aux `<button>` et ne leur fait pas hériter celui du corps : un
  `<button class="btn">` faisait 42 px là où un `<a class="btn">` faisait
  48 px. Côte à côte, ça se voyait — et 42 passe sous la cible tactile de
  44 px. Les deux tombent maintenant à 47.

Tests de garde : `web/tests/navigation.test.ts`, blocs « l'espace connecté ne
s'ouvre pas sur un petit écran » et « a la même largeur sur toutes les pages ».

# Fiche d'un inventaire dans l'app : harmonisation (21 août 2026)

Capture à l'appui, Julien : *« peux-tu faire le même travail d'harmonisation
sur cette page ? […] harmoniser la taille des différents textes, et bouger
set up au-dessus de membres »*. La feuille d'informations d'un inventaire
(`(supervisor)/[sessionId]/index.tsx`, le panneau qui s'ouvre sur le bouton
« i ») portait quatre défauts de la même famille.

- **« Créateur » et « Retirer » étaient dessinés pareil** — deux pastilles
  colorées de même taille, alors que l'une dit un état et l'autre supprime
  quelqu'un. C'était le plus grave. L'étiquette est passée en gris neutre,
  l'action en texte rouge sans fond : ça se touche, ça ne se lit pas. Ne pas
  redonner un fond coloré à `memberTag`, ni une pastille à `removeBtn`.
- **Une seule échelle de texte**, `Texte` en tête du fichier : 20 titre ·
  18 valeurs (numéro, code) · 15 courant · 13 second plan · 11 étiquettes. La
  feuille en employait sept — 10, 11, 13, 14, 15, 17, 18 — et son titre (17)
  était plus petit que le code qu'elle affiche (18). **Aucune taille en clair
  dans les styles** : un test échoue si un `fontSize:` numérique réapparaît
  (56, le grand nombre de la progression, est le seul toléré — c'est un
  chiffre d'affichage).
- **Une seule hauteur de bouton pleine largeur**, `BTN_H = 48`, partagée par
  « Compter », « Auditer », « Partager les identifiants » et « Inviter une
  personne ». Il y avait quatre géométries pour le même genre de travail.
  « Copier » passe en contour : deux boutons pleins violets étaient les objets
  les plus saturés de l'écran alors que l'information est **le code lui-même**.
- **Le motif de menu vient de `components/ui/MenuList`** et n'est plus
  redessiné ici. C'est la duplication que la refonte de « Mon compte » avait
  prétendu régler : `ActionRow`, `ChevronIcon`, `menuCard`, `menuRow`,
  `menuLabel` et `sectionLabel` vivaient encore en double dans cet écran.

**Configuration passe au-dessus de Membres** : on prépare un inventaire avant
d'y mettre des gens, et c'est l'ordre du site où Set up précède Équipe.

Les cartes de la feuille (identifiants, membres) sont passées de `background`
à `surface` : elles étaient de la couleur du fond, donc de simples contours
posés dessus.

Vérifié dans le simulateur, en clair et en sombre. **Comment atteindre cette
feuille sans pouvoir taper** (l'intégration simulateur qui ferait les appuis
refuse toujours de démarrer) : exporter temporairement `InfoPanel` et
`makeStyles`, poser une route jetable qui les rend avec des données factices,
faire pointer `src/app/index.tsx` dessus — un `openurl` ne suffit pas, iOS
demande une confirmation qu'on ne peut pas toucher — puis tout retirer et
vérifier au `git diff`.

Maquette validée avant codage :
https://claude.ai/code/artifact/a6b06896-74e0-479c-828b-93f9a3ad1159

Tests de garde : `tests/compte.test.ts`, bloc « fiche d'un inventaire ».

# Supprimer un inventaire : créateur ou administrateur d'entreprise (21 août 2026)

`delete_session` ne vérifiait que `can_access_session`, c'est-à-dire **n'importe
quel superviseur participant**. Le bouton était caché aux autres côté
navigateur ; la fonction ne l'était pas. Un co-superviseur pouvait effacer
comptages, stock théorique, audits, membres et référentiel d'un inventaire
qu'il n'avait pas créé — même famille que le trou d'`advance_pass`.

Règle arrêtée par Julien : **le créateur** pour ses propres inventaires,
**l'administrateur d'entreprise** pour tous ceux de son entreprise, y compris
ceux auxquels il ne participe pas — c'est justement son rôle. Migration
`20260821250001`. Le créateur rétrogradé en compteur perd le droit avec le
rôle, et `is_company_admin()` porte l'exigence aal2 conditionnelle.

L'écran applique la même règle : sur la liste des inventaires, la case à cocher
et la corbeille n'apparaissent que sur ce qu'on peut supprimer, plutôt que de
laisser découvrir le refus après coup.

**Sélection multiple** sur `/dashboard`, trois précautions à ne pas relâcher :

- « Tout sélectionner » ne porte que sur `filtered`, la liste **après
  recherche**. Sur `sessions`, un « tout » déborderait de ce que la personne
  voit.
- La confirmation **nomme** les inventaires (huit au plus, puis « et N
  autres ») et signale ceux encore en cours.
- Il n'existe pas de RPC de suppression groupée : on appelle `delete_session`
  une fois par inventaire et **on rapporte les échecs** au lieu d'annoncer un
  succès global. Sur dix inventaires, un refus ne doit pas passer inaperçu.

**Un inventaire clôturé ne se rouvre que par son créateur** (ou l'administrateur
d'entreprise). Migration `20260821250002`, qui referme deux trous de la même
famille :

- la policy UPDATE de `inventory_sessions` acceptait n'importe quel superviseur
  participant : un invité pouvait rouvrir un inventaire clôturé, et un rapport
  déjà exporté se remettait à bouger. La garde tient sur la **ligne existante**
  (`status <> 'closed' or created_by = auth.uid() or is_company_admin(...)`) —
  clôturer et préparer restent ouverts aux participants, ce sont des gestes de
  terrain que le créateur peut défaire ;
- la policy DELETE acceptait elle aussi tout participant, ce qui permettait de
  **court-circuiter `delete_session`** en supprimant la ligne en direct, et de
  laisser comptages, articles et audits orphelins. Elle est supprimée : la
  suppression passe par la fonction, SECURITY DEFINER donc hors RLS.

**La liste sépare les siens des invités.** `/dashboard` groupe par magasin les
inventaires qu'on a créés, puis affiche « Inventaires invités » à part, avec la
raison écrite : on peut y compter et lire le rapport, la clôture définitive et
la réouverture appartiennent au créateur. Dire la règle par la mise en page
évite de la découvrir au moment du refus.

**Ajouter quelqu'un à un inventaire : on cherche, on ne saisit pas.** L'onglet
Équipe d'un inventaire proposait, sur le site, un formulaire prénom / nom /
e-mail qui appelait `invite-teammate` — la fonction qui **crée un compte pour
l'entreprise**. Deux choses clochaient : ce n'est pas le geste attendu là
(créer un compteur se fait depuis « Mon équipe »), et surtout **personne
n'était ajouté à l'inventaire**. On remplissait le formulaire, l'équipe de
l'inventaire ne bougeait pas.

`AddSessionMember` cherche désormais dans l'équipe du magasin
(`get_store_directory`), suggestions à la frappe, et appelle
`invite-to-session` — la même edge function que l'app mobile, qui refuse les
adresses sans compte. Les personnes déjà dans l'inventaire ne sont pas
proposées. **`AddCounter` reste en place sur /equipe** : c'est là que créer un
compte a un sens, ne pas confondre les deux.

**L'app suit le même découpage** : l'écran d'accueil du superviseur
(`(supervisor)/index.tsx`) sépare « Mes inventaires » et « Inventaires
invités », avec la même explication. Le bloc « En cours » qui coiffait la liste
a disparu : il répétait les inventaires en cours, dont le statut figure déjà
sur chaque tuile.

Tests de garde : `web/tests/suppression-inventaire.test.ts` et
`tests/compte.test.ts` (bloc « accueil superviseur »).

(Les deux droits qui manquaient ici — suppression des comptes par
l'administrateur d'entreprise, demande d'ajout de magasin — ont été tranchés
et construits le 22 août 2026 : voir les deux sections suivantes.)

# L'administrateur d'entreprise supprime les comptes de son entreprise (22 août 2026)

Décision de Julien, à ma question restée ouverte depuis la veille. Jusqu'ici il
ne pouvait que **retirer les accès** (`ca_remove_supervisor`) : le compte
survivait, sans magasin ni équipe, et sa suppression réelle supposait de nous
écrire — `admin_delete_user` est réservé à Quantinvo. Pour une entreprise qui
voit passer des saisonniers, c'était une file d'attente chez nous pour un geste
qui la regarde.

`ca_delete_user` (migration `20260822120001`), gardée par `is_company_admin()`
— donc l'exigence aal2 conditionnelle voyage avec. Trois bornes, arrêtées le
même jour et à ne pas relâcher :

- **Compteurs et superviseurs seulement.** Jamais soi-même, jamais un autre
  administrateur d'entreprise, jamais un compte hors de l'entreprise : ces cas
  restent chez Quantinvo, comme c'est déjà la règle du retrait des accès. Sans
  cette borne, deux administrateurs fâchés s'effacent l'un l'autre.
- **La suppression réussit même si la personne a compté**, et c'est le point
  qu'il faut savoir avant de la déclencher : les comptages sont conservés mais
  **détachés** (`on delete set null`, migration `20260818000001`), donc un
  inventaire clôturé garde ses chiffres justes mais **son rapport ne dira plus
  qui a compté ces lignes**. La confirmation le dit en toutes lettres.
  L'alternative — refuser la suppression aux personnes ayant compté — a été
  écartée : la plupart des comptes ont compté, le droit aurait été décoratif.
- **Immédiate.** Pas de délai de grâce : `pg_cron` n'est pas installé, une
  suppression différée ne s'exécuterait jamais toute seule. Le geste délibéré
  est demandé à l'écran, pas au calendrier.

Chaque suppression est journalisée dans `company_audit_log`
(`action = 'compte_supprime'`), **l'identité figée avant le `delete`** — après,
ni le profil ni l'adresse n'existent et le journal n'aurait qu'un identifiant à
montrer dans un an.

Côté écran (`/equipe`, le site seulement — l'app mobile ne montre pas les
superviseurs, y porter ce droit supposerait d'abord d'y porter l'écran
d'administration) :

- **La confirmation exige la recopie du nom** (`requireText` de
  `ConfirmDialog`). « Supprimer le compte » est à deux centimètres de
  « Retirer les accès » et n'a rien de commun avec lui ; un clic de travers ne
  doit pas suffire. Au passage, les quatre `window.confirm()` de la page sont
  passés à la même modale : deux boutons voisins dont l'un ouvre une boîte de
  dialogue du navigateur et l'autre une modale du produit, cela se voit.
- **Un bloc « Compteurs · autres magasins »** liste les compteurs de
  l'entreprise que la liste par magasin ne montre pas. Sans lui le droit serait
  décoratif : un administrateur de siège ne supervise aucun magasin, donc ne
  voyait aucun compteur. Le **retrait** d'un magasin, lui, reste le geste de
  leur superviseur — d'où la seule action de suppression sur ces lignes.
- Le bouton n'apparaît jamais sur sa propre ligne ni sur celle d'un autre
  administrateur : ils vivent dans la branche `!m.is_company_admin`, celle qui
  porte déjà le retrait des accès.

Vérifié en base le 22 août 2026, session simulée par `request.jwt.claims` : les
quatre refus répondent juste (soi-même, autre entreprise, administrateur
Quantinvo, cible nulle), un superviseur ordinaire est refusé, et le chemin
nominal — essayé **en transaction annulée** sur le compte de test
`jthiongkay+supc` — supprime bien compte, profil, affectations et
participations aux inventaires, en laissant au journal le nom figé, l'auteur et
l'adresse. Le compte était intact après l'annulation.

**Non vu à l'écran** : `/equipe` demande une session connectée, que je n'ai
pas. Seuls les tests, le typage, le lint et `next build` valident le rendu, en
plus de la maquette validée avant codage :
https://claude.ai/code/artifact/ee37b309-0266-4c3d-b890-c38979989132

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « supprimer un
compte de son entreprise ». Le test de `navigation.test.ts` qui vérifiait que
« Retirer » n'est réservé à personne a été **amendé, pas affaibli** : la garde
porte désormais sur ce qui précède la suppression, le retrait d'un magasin
restant ouvert à tout superviseur.

# Renommer un magasin, renommer une entreprise (23 août 2026)

*« Les comptes admin doivent pouvoir renommer un magasin et entreprise. »*
Rien ne le permettait : un nom saisi de travers au moment du devis, ou une
enseigne qui change, obligeait à **supprimer et recréer** — c'est-à-dire à
perdre les inventaires du magasin.

Migration `20260823140001`, quatre fonctions, **deux par autorité** : les deux
ont de bonnes raisons de renommer. Quantinvo corrige ce qu'il a saisi
(`admin_rename_company`, `admin_rename_store`, journal `admin_audit_log`),
l'entreprise cliente porte son propre nom (`ca_rename_company`,
`ca_rename_store`, journal `company_audit_log`).

- **⚠️ Renommer ne touche à rien d'autre.** Code d'accès, licence, inventaires
  et comptages sont attachés à l'identifiant, jamais au nom. Les documents déjà
  émis — devis, factures Stripe — gardent le nom qu'ils portaient : ce sont des
  pièces datées, elles ne se réécrivent pas.
- **`nom_propre(text)`** détoure, refuse le vide et borne à 80 caractères. Une
  seule définition pour les quatre fonctions.
- **⚠️ La garde du client porte sur l'entreprise DU MAGASIN**, jamais sur un
  paramètre de l'appelant — sinon on renomme le magasin d'un autre client.
  Même règle que `ca_store_detail`.
- **Deux magasins d'une même entreprise ne portent pas le même nom** (comparé
  en minuscules) : ils ne se distingueraient plus, ni dans une liste ni dans un
  devis. Même règle qu'à l'ajout.
- **Le même nom deux fois répond `already: true`**, pas une erreur.
- **Le journal garde le nom d'avant** (`details.avant`) : « renommé en X » sans
  le nom précédent ne dit pas ce qu'on a perdu.

Côté écran, `components/ui/Renommer.tsx`, le même geste aux quatre endroits :
un lien « Renommer » à côté du nom, qui devient un champ sur place, avec
Entrée pour valider et Échap pour annuler. **Pas de modale** — on renomme ce
qu'on a sous les yeux, et c'est réversible d'un second renommage. Un refus du
serveur (doublon, nom vide) **reste sous le champ** le temps qu'on corrige,
plutôt que dans une notification qui s'efface.

Les quatre points d'entrée : la fiche entreprise de la console (titre + chaque
magasin), la fiche d'un magasin côté client, et le tableau de bord de
l'entreprise pour son nom.

⚠️ **Le garde-fou du journal balayait la mauvaise migration.** Il ne lisait
que `20260818000003_journal_actions_admin.sql` : une fonction `admin_*` écrite
plus tard vivait dans son propre fichier et passait sans trace. Il balaie
maintenant **toutes** les migrations.

Vérifié en base, en transactions annulées : nom vide refusé, nom trop long
borné, magasin d'une autre entreprise refusé, administrateur Quantinvo refusé
sur les fonctions client, et les deux renommages réels avec le journal portant
le nom d'avant. À l'écran (route jetable, retirée) en clair et en sombre : le
lien, le champ présélectionné, le refus sous le champ.

Tests de garde : `web/tests/admin-entreprise.test.ts` et
`web/tests/journal-admin.test.ts`.

# Refonte de « Mon équipe », côté administrateur d'entreprise (23 août 2026)

*« La page équipe de l'admin entreprise n'est pas logiquement bien
sectionnée. »* Elle s'était construite par couches. Maquette validée avant
codage : https://claude.ai/code/artifact/33d0abae-d861-425c-baa4-4517abc7a914

Six défauts, dont un qui n'était pas qu'une question de rangement :

1. **deux portes pour ajouter des gens** — un bouton « Ajouter un compteur »
   dans l'en-tête, un formulaire « Inviter un superviseur » déplié en
   permanence au milieu de la page ;
2. **ce formulaire coupait les deux listes**, qui ne se lisaient jamais l'une
   après l'autre ;
3. **la recherche et le filtre magasin ne couvraient que les compteurs** ;
4. **deux dessins pour la même chose** — cartes `store-block` pour les
   superviseurs, `req-row` pour les compteurs, reste du rangement par magasin ;
5. **les invitations reléguées tout en bas**, après tout le reste ;
6. **⚠️ `AddCounter` envoyait `storeIds: []`**, et une liste vide veut dire
   *tous les magasins du superviseur* — donc, pour un administrateur
   d'entreprise, **l'entreprise entière** à chaque compteur ajouté d'ici.

Le découpage retenu : **invitations en attente en tête**, puis une seule
section **Membres** avec recherche, filtre magasin et filtre type de profil.

- **Les invitations passent devant parce qu'elles attendent** — même règle que
  « Ventes en cours » sur /admin. La section disparaît quand il n'y en a
  aucune ; le bloc du bas ne sert plus qu'au superviseur ordinaire.
- **Le rôle est une pastille (`.pill-role`), pas une section.** Dans une liste
  unique il devient ce qui distingue les gens : il doit se repérer d'un coup
  d'œil. Pastille neutre, pour ne voler la vedette ni à « Admin » (accent) ni
  à « Mot de passe à créer » (ambre). L'ordre reste celui du serveur.
- **⚠️ Le filtre par magasin ne cache pas les administrateurs** : ils les ont
  tous par construction, les retirer d'une liste filtrée laisserait croire
  qu'ils n'y travaillent pas.
- **Une seule porte d'ajout** (`AjouterPersonne`, qui remplace `InviteForm` et
  `AddCounter` pour l'administrateur), le rôle sur deux cartes plutôt qu'un
  menu — ce n'est pas un réglage parmi d'autres, c'est ce qui décide de la
  fonction appelée et de l'obligation d'un magasin. **Les magasins sont
  demandés dans les deux cas** : c'est ce qui ferme le défaut 6.
- **Sa propre ligne et celle d'un autre administrateur ne portent aucune
  action** (`intouchable`) : ces comptes restent chez Quantinvo, et l'écran le
  dit — « Géré par Quantinvo » — plutôt qu'un bouton qui refuserait.
- **Le superviseur ordinaire garde son rangement magasin par magasin** : c'est
  ainsi qu'il travaille, un saisonnier part d'un magasin et pas de tous.

## Un compteur compte pour quelqu'un — le superviseur d'abord

*« Ajout membre par admin entreprise, compteur : l'admin doit préciser qui est
le superviseur, puis sélectionner le magasin, liste magasin = liste magasin
superviseur. »* Maquette :
https://claude.ai/code/artifact/3c19c9ed-11f9-4d68-887a-ca5f8b41eb03

Le panneau d'ajout enchaîne désormais **rôle → identité → superviseur →
magasins**, et les deux champs qui dépendent l'un de l'autre sont voisins.
Avant, l'administrateur cochait n'importe quel magasin de l'entreprise — y
compris un magasin que **personne ne supervise**. Le compteur existait alors
sans apparaître dans le « Mon équipe » de qui que ce soit.

⚠️ **Le superviseur choisi ne s'enregistre nulle part** (option A, tranchée
par Julien). *« Le superviseur d'un compteur » n'existe pas en base* : un
compteur appartient à des magasins, un superviseur aussi, et c'est le magasin
qui les relie. Ce menu ne fait que **restreindre la liste en dessous**. Si le
superviseur quitte le magasin, le compteur y reste et passe sous la
responsabilité de celui qui le reprend — on encadre un magasin, pas des
personnes. Ne pas ajouter de colonne « superviseur » à `profiles` ou à
`team_invitations` en croyant compléter ce travail : c'est l'option B, elle a
été écartée.

- **Un superviseur qui n'a qu'un magasin le voit coché d'office** — la
  question a déjà sa réponse. Même règle que la création d'inventaire dans
  l'application.
- **L'administrateur figure dans la liste**, avec « tous les magasins » : dans
  une petite structure c'est lui qui encadre, l'écran ne doit pas l'obliger à
  nommer quelqu'un d'autre.
- **Le rôle Superviseur n'affiche pas ce menu** : un superviseur ne compte
  pour personne. Sa liste reste celle de tous les magasins de l'entreprise.
- **Un magasin absent de la liste se dit** — « … ne les supervise pas » —
  sinon on cherche un défaut là où il y a une règle.
- **Une entreprise sans aucun superviseur ne peut pas recevoir de compteur**,
  et le panneau le dit avec le geste qui débloque (« Inviter un superviseur »,
  qui bascule le rôle).
- **⚠️ Un magasin est désormais exigé pour les deux rôles.** La liste vide
  voulait dire « tous les magasins du superviseur » : depuis l'écran d'un
  administrateur, cela donnait l'entreprise entière à chaque compteur ajouté.

Vu à l'écran (route jetable rendant le vrai panneau, retirée — `git status`
contrôlé), clair et sombre : les quatre états (superviseur non choisi, deux
magasins, un seul coché d'office, entreprise sans superviseur).

## Affecter un magasin à un compteur (`ca_set_counter_stores`)

Migration `20260823130001`. Il n'existait que `remove_counter_from_store` : on
pouvait retirer un compteur d'un magasin, jamais lui en donner un. Un compteur
retiré de son dernier magasin devenait donc **invisible partout** — les listes
se lisent magasin par magasin — donc irrécupérable, et impossible à promouvoir
puisqu'un superviseur a toujours au moins un magasin. Vu en vrai le même jour.

Miroir de `ca_set_supervisor_stores`, à une différence volontaire : **un
compteur sans magasin est un état normal**, la liste vide n'est pas refusée.
⚠️ Deux tables (`store_supervisors` / `store_team`), donc deux fonctions —
mais **un seul geste à l'écran** : `changerMagasins` route selon le rôle.

## Deux corrections de feuille de style

- **`.toolbar select { width: auto }`** — la règle groupée mettait `width:
  100%` sur les champs *et* les menus. Avec deux filtres dans la même barre,
  les trois contrôles s'empilaient. Un filtre se dimensionne sur son contenu.
- **`.dash-sub-compte` / `.dash-sub-n`** — un titre de section qui porte un
  compte, et « x sur y » avec « Effacer les filtres » dès qu'un filtre est
  actif. `.dash-sub` reste un simple libellé partout ailleurs.

Vu à l'écran (route jetable rejouant le vrai rendu, retirée — `git status`
contrôlé), clair et sombre : les trois sections, les filtres sur une ligne, le
panneau dans les deux rôles, et « Membres · 2 sur 5 » sur un filtre actif.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « refonte de
“Mon équipe” ».

# Changer le rôle d'un membre : superviseur ⇄ compteur (23 août 2026)

Demande de Julien. Il n'existait **aucun chemin** : `profiles.role` est figé
par le déclencheur `profiles_pin_privileged` pour `authenticated`, et les
seules fonctions qui l'écrivaient étaient `handle_new_user` (à l'inscription)
et la console Quantinvo. Une personne embauchée compteur puis promue chef de
rayon devait donc être supprimée et réinvitée — en perdant au passage
l'attribution de ses comptages.

`ca_set_user_role(p_user, p_role, p_store_ids default null)`, migration
`20260823120001`, gardée par `is_company_admin()`. Les deux gestes sont sur
/equipe, un lien par ligne : « Passer compteur » chez les superviseurs,
« Passer superviseur » chez les compteurs.

⚠️ **Le rôle ne se change pas seul : les affectations suivent.** Un
superviseur est rattaché par `store_supervisors`, un compteur par
`store_team`. Écrire `profiles.role` sans déplacer les lignes donnerait
quelqu'un qui a un rôle et **ne voit rien** — l'impasse exacte que la règle
« un superviseur a au moins un magasin » avait fermée le matin même. La
personne garde donc ses magasins dans les deux sens, seule la table change.

Trois refus, tous nécessaires :

- **soi-même** — un administrateur qui se rétrograde enferme son entreprise ;
- **un autre administrateur d'entreprise** — son rôle et son drapeau se
  tiennent, et ils se gèrent chez Quantinvo (même règle que
  `ca_remove_supervisor` et `ca_delete_user`) ;
- **une promotion sans magasin** — la règle du matin. Le message dit quoi
  faire : affecter un magasin d'abord.

Ce qui ne bouge pas, et n'a pas à bouger : les comptages (`counts.counted_by`),
les inventaires créés (`inventory_sessions.created_by`) et les participations
(`session_members`). `delete_session` prévoyait déjà le créateur rétrogradé —
« une rétrogradation en compteur retire le droit avec le rôle ».

**Pas de recopie du nom** dans la confirmation, contrairement à la
suppression : c'est réversible d'un clic. Elle dit en revanche les deux
conséquences qui se remarquent — les magasins qui suivent, et ce que la
personne pourra ou ne pourra plus faire.

**Deux actions au journal plutôt qu'une** (`promu_superviseur`,
`retrograde_compteur`) : « rôle modifié » obligerait à ouvrir le détail.
⚠️ Le garde-fou des libellés balaie les migrations à la regex et **ne voit pas
un `case … end`** : les deux libellés sont donc nommés explicitement dans
`web/tests/admin-entreprise.test.ts`.

Vérifié en base, en transactions annulées : les quatre refus (soi-même, autre
entreprise, rôle inconnu, superviseur ordinaire), le second clic
(`already: true`), et les deux sens sur les données réelles — un compteur à
1 magasin devient superviseur de ce magasin, un superviseur à 1 magasin
devient compteur de ce magasin, journal écrit dans les deux cas. Et à l'écran
par route jetable (retirée, `git status` contrôlé), clair et sombre.

Tests de garde : `web/tests/admin-entreprise.test.ts`.

# Quantinvo peut enfin supprimer un compte (23 août 2026)

Constat de Julien : *« Quantinvo sur le site ne peut supprimer personne. »*
Vérifié, et c'était exact. `admin_delete_user` existe depuis le 18 août
2026 — gardée par `is_admin()`, journalisée, identité figée avant le
`delete` — mais **le seul bouton qui l'appelait** était sur une *demande* de
suppression déposée par la personne elle-même (/admin/console). La section
« Personnes » de la fiche entreprise était une liste de lecture, sans aucune
action. Autrement dit : la console pouvait effacer une **entreprise entière**,
pas un compte.

Le geste est posé là où on regarde les gens : `/admin/entreprise/<id>`,
section « Personnes », un lien rouge par ligne. Aucune RPC nouvelle, aucune
migration — seulement le bouton qui manquait.

- **La recopie du nom est exigée** (`requireText`), comme sur /equipe. Ce
  bouton est à quelques centimètres d'une simple liste, et la suppression est
  irréversible. C'est aussi pourquoi il ouvre la **modale du produit** et non
  un `confirm()` du navigateur comme le reste de cette page : `window.confirm`
  ne sait pas exiger un geste délibéré. ⚠️ Les six autres confirmations de
  cette page sont restées natives — incohérence connue, à reprendre.
- **La confirmation dit ce qui reste** : les comptages sont conservés mais
  détachés, donc le nom disparaît des rapports déjà faits ; inventaires et
  invitations sont détachés eux aussi.
- **Supprimer un administrateur d'entreprise ajoute une ligne** : sans lui,
  l'entreprise n'a plus personne pour gérer ses superviseurs — et elle remonte
  dans « À traiter » sur /admin. Autant le dire avant.

⚠️ **`admin_delete_user` ne se refuse à personne**, contrairement à
`ca_delete_user` (qui refuse soi-même et les autres administrateurs). Ce n'est
pas atteignable depuis ce bouton — un administrateur Quantinvo n'a pas de
`company_id`, il ne figure donc dans aucune fiche entreprise. À garder en tête
si un jour la console liste les personnes autrement que par entreprise.

Vu à l'écran (route jetable `/tmp-polish`, retirée — `git status` contrôlé),
clair et sombre : la ligne, la modale, la recopie du nom, et la cinquième
puce sur un administrateur d'entreprise.

Tests de garde : `web/tests/console-admin.test.ts`.

# L'espace de l'administrateur d'entreprise (22 août 2026)

Julien : *« il voit tout et tout le monde dans son entreprise, il sait qui fait
quoi (console comme admin Quantinvo), il gère les membres quel que soit le
niveau, il gère les magasins, il peut consulter les inventaires et les gérer
aussi. C'est le maître ; au-dessus de lui il y a l'admin Quantinvo. Exemple :
le chemin “mon espace” ne mène pas vers inventaire pour lui, ce n'est pas sa
priorité. »*

**La définition qui a servi de règle** : son autorité vient de son rôle, pas
d'une affectation, et il administre — il ne fait pas le travail. Les
inventaires sont ceux de ses superviseurs.

Trois manques constatés avant d'écrire, et c'est le diagnostic qui compte :

1. **Il ne voyait pas les inventaires de son entreprise** auxquels il n'avait
   pas été invité. Ses droits de clôture, réouverture et suppression existaient
   déjà (migrations `20260821250001/2`) — c'était la *lecture* qui manquait.
2. **`company_audit_log` n'était affiché nulle part.** Il se remplit à chaque
   action depuis le 20 août ; « il sait qui fait quoi » n'avait aucun écran.
3. **Aucune vue d'ensemble** : son entreprise ne se lisait qu'en ouvrant les
   inventaires un par un.

Migration `20260822160001`, maquette validée avant codage :
https://claude.ai/code/artifact/ad0f725e-f87d-4c37-856a-4bae82d0a6c9

## Sa barre, et son atterrissage

`Tableau de bord · Magasins · Équipe · Inventaires · Journal`, et
`homePathForRole` le pose sur `/entreprise`. C'est la charpente de la console
Quantinvo à son échelle : l'état, le patrimoine, les personnes, le travail, la
trace.

**« Boîte à outils » a quitté sa barre** pour le menu de son avatar : imprimer
des balises est un geste de terrain, occasionnel pour lui. Elle reste un onglet
pour un superviseur ordinaire. Cinq onglets est la limite avant que la barre ne
passe sur deux rangs (elle le fait sous 900 px).

## Une ligne ouvre tous les inventaires

`is_session_participant` gagne `or public.is_company_admin(s.company_id)`.
**C'est le point de passage unique** : cette fonction garde la policy de lecture
d'`inventory_sessions` *et* `can_access_session`, dont dépendent comptages,
zones, audits, rapports et membres. Une ligne ouvre tout, de façon cohérente ;
la même règle dispersée dans quinze policies aurait garanti un oubli. Même
levier que `store_supervisors` pour les magasins, le matin même.

Conséquence à l'écran : `/dashboard` ne coupe plus sa liste en
« Mes inventaires / Inventaires invités » — ce sont ceux de son entreprise.

## Le tableau de bord, rangé par magasin

Demande de Julien : *« ranger les 3 blocs par magasin, comme pour la page
entreprise de l'admin Quantinvo »*. Les chiffres en tête, puis un bloc par
magasin portant ce qui est à lui : ses alertes, ses inventaires, son équipe.

- **Les alertes se calculent dans `web/lib/entreprise.ts`, pas en SQL.** Ce sont
  des règles de jugement (« neuf jours, c'est long ») : elles changeront plus
  souvent que la requête, et elles se testent sans base ni navigateur. Les
  seuils sont réunis dans `SEUILS` — ils se discutent, ils ne se devinent pas.
- **Un magasin qui tourne ne produit aucune alerte** et n'affiche donc aucun
  bandeau : c'est ce silence qui donne du poids aux autres.
- **`ca_company_overview` ne calcule pas l'avancement** : ce serait reparcourir
  zones et balises de chaque inventaire ouvert à chaque ouverture de page — le
  motif retiré pour la tenue en charge le 21 août. Elle rend les pièces
  comptées et le stock théorique attendu ; l'écran en tire une proportion
  **quand un fichier attendu existe**, et n'affiche rien sinon. Un pourcentage
  inventé serait pire que pas de pourcentage.
- **L'administrateur n'apparaît pas comme superviseur de chaque magasin** dans
  ces blocs : il les supervise tous depuis le matin, le répéter partout ne
  dirait rien de qui tient réellement le magasin.

⚠️ **Le journal reste global, et c'est un constat, pas un choix de mise en
page** : rien de ce que `company_audit_log` enregistre ne porte de magasin —
inviter un superviseur, retirer un accès, supprimer un compte, demander un
magasin. Le ranger par magasin supposerait d'abord de l'écrire autrement.

## Le journal

`ca_list_audit_log` (bornée à 500 lignes quoi qu'on demande) et l'écran
`/journal`. **Les libellés de `web/lib/journal.ts` sont des participes sans
auxiliaire** — « invité Marc », pas « a invité Marc » : c'est ce qui permet
d'écrire « Julien a invité » et « Vous avez invité » sans deux tables, et ce
qui a corrigé le « Vous a invité » du premier jet. Une action sans libellé
s'affiche en clair plutôt que de disparaître, **et un test échoue** si une
fonction `ca_*` journalise une action qu'aucun libellé ne couvre.

## L'équipe se lit personne par personne

Pour lui seulement : la liste part des personnes, avec leur rôle, leurs
magasins (retirables), leur dernier comptage et le nombre d'inventaires
comptés, plus une recherche et un filtre par magasin. Le bloc « Compteurs ·
autres magasins » ajouté le matin n'a plus d'objet — cette liste couvre toute
l'entreprise. Un superviseur ordinaire garde son rangement par magasin : c'est
ainsi qu'il travaille, un saisonnier part d'un magasin et pas de tous.

## Vérifications

En base, en transaction annulée : `ca_company_overview` rendue sur les données
réelles d'Entreprise C (4 magasins, 2 inventaires ouverts, superviseurs,
compteurs), refus opposé à un superviseur ordinaire, `anon` refusé partout.

Au navigateur, par **route jetable** (`/tmp-polish`, retirée ensuite — vérifier
au `git status`) : les blocs magasin en clair et en sombre. Un défaut trouvé
ainsi et corrigé : `.mag .signal` est plus spécifique que `.signal-alerte`,
l'ambre des alertes était donc écrasé et elles se lisaient comme des lignes
ordinaires — d'où le `:not(.signal-alerte)`.

**Non vu à l'écran** : les pages complètes `/entreprise`, `/journal` et
`/equipe` demandent une session d'administrateur d'entreprise.

## Second passage, le même jour

Retour de Julien sur le premier jet : *« réduire la taille des tuiles pour que
ça tienne sur une ligne, liste magasins collapsable nom magasin en en-tête et
placer cette section dans page Magasins, bouton ouvrir le magasin mène à page
du magasin en question — son profil — où on trouve son code, ses membres, ses
inventaires, place activités récentes sous tableau de bord. La page magasins de
l'admin entreprise doit s'inspirer de la page entreprises de l'admin
Quantinvo. »*

- **Le tableau de bord ne porte plus que deux blocs** : les cinq indicateurs
  (`.dash-kpis-5`, qui rétrécit les tuiles au lieu de les casser sur deux
  rangs — repasse à trois colonnes sous 1040 px) et l'activité récente.
- **Les magasins ont déménagé sur `/magasins`**, chacun dans un `Volet` —
  replié, nom en en-tête, résumé et pastille (« 2 à surveiller » / « À jour »).
  Les règles du composant s'appliquent : rien ne s'ouvre tout seul, et
  l'en-tête doit dire ce qu'il y a dedans, sinon on n'a fait que déplacer le
  mur.
- **La page reprend la figure de `/admin/entreprises`** : compte dans le titre,
  recherche par fragments (« lyon part » trouve « Magasin Lyon Part-Dieu »),
  une fiche derrière chaque ligne. ⚠️ **Elle garde deux lectures** : un
  superviseur ordinaire y vient relever un code d'accès, il ne doit pas
  hériter de la console.
- **`/magasins/[storeId]`, la fiche d'un magasin** : son code, ses membres,
  ses inventaires. `ca_store_detail` (migration `20260822170001`) rend
  l'historique complet — la liste, elle, n'affiche que les inventaires ouverts
  et le dernier clôturé. **L'activité d'un compteur y est celle de ce
  magasin** : quelqu'un qui compte beaucoup ailleurs n'y est pas actif pour
  autant. La garde porte sur l'entreprise **du magasin visé**, jamais sur un
  paramètre de l'appelant.
- `CorpsMagasin` est partagé par la liste et la fiche : deux écrans qui
  montrent la même chose doivent la montrer de la même façon.

Deux doublons évités au passage, et c'est le genre que Julien repère :
`depuis()` refaisait `relativeTime()` de `lib/format` (avec un « il y a 3
jours » là où le site dit « il y a 3 j »), et `nb()` était recopié dans quatre
pages — il a rejoint `lib/format`.

Vérifié au navigateur (route jetable, clair et sombre) : les cinq tuiles sur
une ligne, les volets repliés, un volet ouvert. Un défaut corrigé ainsi —
« Ouvrir le magasin » s'étirait sur toute la largeur, un bouton dans une
colonne flex prenant toute la place.

Tests de garde : `web/tests/espace-admin-entreprise.test.ts`.

# L'administrateur d'entreprise supervise tous les magasins (22 août 2026)

Précision de Julien, capture à l'appui : son compte d'administrateur affichait
« Vous n'êtes affecté à aucun magasin », et l'écran l'invitait à s'en affecter
un depuis /equipe. C'était la lecture inverse de la règle — **il les a tous, par
construction**. Rien à s'affecter.

**Le levier est l'affectation, pas l'affichage.** Tout ce que voit un
superviseur — ses magasins, son équipe, ses inventaires, sur le site comme dans
l'application — se lit dans `store_supervisors` (`get_my_stores`,
`my_team_by_store`, les tableaux de bord). Rendre l'affectation vraie corrige
tous les écrans d'un seul geste ; ajouter partout une condition « ou bien il est
administrateur » aurait multiplié les endroits où l'oublier. Migration
`20260822150001`.

Deux déclencheurs tiennent l'invariant dans le temps, et couvrent aussi les
chemins qu'on écrira demain :

- `stores` **après insertion** → tous les administrateurs de l'entreprise
  prennent le nouveau magasin (console Quantinvo comme demande de magasin) ;
- `profiles` **après insertion ou changement** de `is_company_admin` /
  `company_id`, avec un `when` — le déclencheur ne se réveille pas sur une
  modification de prénom — → le nouvel administrateur prend tous les magasins
  (promotion par `invite-company-admin` comme profil créé par
  `handle_new_user` sur invitation).

Plus le rattrapage de l'existant dans la même migration, sans quoi l'invariant
ne vaudrait que pour les magasins créés après.

**Deux refus le protègent, et ils sont nécessaires** : les déclencheurs ne
réparent pas un retrait — ils ne se réveillent qu'à la création ou à la
nomination. Sans eux, une croix sur /equipe rendrait l'invariant faux en
silence.

- `ca_set_supervisor_stores` refuse un profil `is_company_admin` ;
- `admin_unassign_supervisor` (console Quantinvo) aussi, en disant la marche à
  suivre : retirer d'abord le rôle d'administrateur.

Côté écrans : /equipe montre « Affecté à tous les magasins de l'entreprise (3) »
à la place des pastilles et du sélecteur — une croix qui ne marche pas est pire
que pas de croix ; l'état vide de Magasins (site et application) et celui de Mon
équipe (application) disent « Votre entreprise n'a encore aucun magasin » et
renvoient vers la demande d'ajout.

**Ce qui n'a pas changé** : révoquer le rôle d'administrateur ne retire pas ses
affectations. Il redevient un superviseur ordinaire de tous les magasins, et
c'est alors qu'on peut l'en retirer un par un — l'inverse effacerait au passage
des affectations légitimes d'avant sa nomination.

Vérifié en base le 22 août 2026, en transaction annulée : un magasin créé
affecte l'administrateur (4/4), un superviseur promu prend les quatre, et les
deux retraits sont refusés — celui d'un superviseur ordinaire passant toujours.
Rattrapage contrôlé sur les données réelles : l'administrateur d'Entreprise C
est passé de 0 à 3 magasins, le superviseur ordinaire est resté à 2 sur 3.

Tests de garde : `web/tests/admin-entreprise.test.ts`, bloc « l'administrateur
d'entreprise a tous les magasins ».

# Demander l'ajout d'un magasin (22 août 2026)

Un client ouvre un magasin. Il n'avait **aucun moyen de le dire depuis le
produit** : seul Quantinvo crée un magasin (`admin_add_store`, gardée par
`is_admin()`), parce que **la licence se facture par magasin**. Il fallait
téléphoner. Demande de Julien : un bouton.

**La règle qui porte tout le reste : une demande ne crée pas de magasin.**
`ca_request_store` n'insère que dans `store_requests` ; un test échoue si elle
touche un jour à `stores`. La création reste chez Quantinvo, et le devis reste
une conversation — comme pour une nouvelle entreprise.

Migration `20260822130001`, table `store_requests` (RLS lecture pour
l'administrateur Quantinvo et celui de l'entreprise, **aucune policy
d'écriture**), et six fonctions :

- côté client, gardées par `is_company_admin()` : `ca_request_store`,
  `ca_list_store_requests`, `ca_cancel_store_request` ;
- côté Quantinvo, gardées par `is_admin()` : `admin_list_store_requests`,
  `admin_fulfil_store_request`, `admin_reject_store_request`.

Points à ne pas défaire :

- **`admin_fulfil_store_request` appelle `admin_add_store`**, il ne recopie pas
  la génération du code d'accès. Deux chemins de création divergeraient un
  jour, et le magasin né d'une demande ne serait plus tout à fait un magasin.
  Effet visible et voulu : deux lignes au journal Quantinvo
  (`magasin_ajoute` puis `demande_magasin_creee`).
- **Les deux doublons sont refusés à la saisie** — un magasin qui porte déjà ce
  nom, une demande déjà en cours pour ce nom (comparaison en minuscules, nom
  détouré). Sans cela la même demande arrive trois fois et c'est Quantinvo qui
  fait le tri.
- **Une demande traitée ne se rejoue ni ne s'annule** : `admin_fulfil` refuse
  ce qui n'est plus `pending`, `ca_cancel` ne supprime que du `pending`. Une
  demande traitée est une trace, pas un brouillon.
- **Le motif de refus est repris tel quel sur l'écran du client.** « Refusée »
  tout court laisse l'administrateur d'entreprise sans rien à faire de
  l'information.
- **Purge à un an**, dans `purge_expired_data` comme le reste — mais seulement
  ce qui est traité (`handled_at is not null`) : une demande en attente attend.

Côté écrans :

- **`/magasins`** porte le bouton, pour le seul administrateur d'entreprise, et
  la liste de ses demandes (sans cela la même demande part trois fois). ⚠️ Son
  **état vide a été récrit** : « contactez l'administrateur de votre
  entreprise » s'adressait à l'administrateur de l'entreprise — le piège déjà
  rencontré côté mobile. Il renvoie maintenant vers /equipe, où il peut
  s'affecter un magasin lui-même.
- **`/admin`** fait remonter les demandes en tête de « À traiter » : c'est du
  revenu qui attend, ça passe avant les alertes d'usage. Deux appels au
  chargement plutôt qu'un — `admin_business_overview` est une vue d'affaires,
  pas une boîte de réception.
- **La fiche entreprise** porte « Créer le magasin » et « Refuser », juste
  au-dessus des magasins : une demande précède la création.

## Le formulaire de demande est celui de l'inscription

Correction du même jour, capture de /inscription à l'appui : *« c'est ça qu'il
faut comme formulaire de demande »*. Le premier jet ne demandait qu'un nom — or
**la licence se tarife au volume de stock**. Une demande sans stock est une
demande que Quantinvo ne peut pas deviser, donc un aller-retour de plus.

La carte de saisie (nom, stock théorique, surface, **tranche tarifaire affichée
à la frappe**) est sortie de `/inscription` dans
`web/components/MagasinSaisie.tsx` et sert aux deux écrans. Une seule
définition : les libellés, les unités et la tranche affichée ne doivent pas
diverger entre le parcours d'inscription et la demande. Migration
`20260822140001` (colonnes `units` / `sqm`).

Trois points :

- **Le stock est exigé, la surface non** : le premier donne le prix, la seconde
  ne sert qu'au recoupement.
- **Le recoupement stock / surface ne sort pas de la console.** Comme sur la
  fiche d'une demande d'entreprise : affiché au client, il lui indiquerait quel
  chiffre ajuster pour changer de tranche. La fiche entreprise montre donc
  pièces, m², pièces/m², tranche et prix ; l'écran du client ne montre que la
  tranche de ce qu'il vient de saisir.
- **L'ancienne signature `ca_request_store(text, text)` est supprimée**, pas
  laissée à côté de la nouvelle : Postgres garderait les deux et un appel à deux
  arguments deviendrait ambigu.

Vérifié en base le 22 août 2026, sessions simulées par `request.jwt.claims`,
**tout en transactions annulées** : demande créée, les trois refus de saisie
(doublon de demande, doublon de magasin, nom vide), refus opposé au superviseur
ordinaire comme aux deux fonctions Quantinvo, création réelle du magasin avec
son code, statut `created` relié au magasin, journaux des deux côtés, rejeu
refusé, et le motif de refus bien visible côté client. Aucune ligne résiduelle,
`anon` refusé sur les six fonctions. Le volume voyage bien (180 000 pièces,
1 200 m²), le stock manquant, nul ou absurde est refusé, et il ne reste qu'une
seule signature de `ca_request_store`.

**La carte de saisie, elle, a été vue au navigateur** : /inscription est
publique, donc la sortie du composant a pu être vérifiée pour de vrai — mise en
page identique, et la tranche s'affiche toujours à la frappe (180 000 →
« Grande surface — 50 001 à 200 000 · 6 600 € / an », total mis à jour).

### Passe de finition, sur capture de Julien (« barre de saisie à revoir »)

Le formulaire vu en production a montré quatre défauts, dont deux qui ne
tenaient pas à cet écran :

- **Le champ « nom du magasin » n'avait jamais eu d'habillage.** `.magasin-top
  input` ne portait qu'un `flex: 1` : dans la carte de 520 px de /inscription
  cela passait presque, dans l'espace connecté (1120 px) il devenait une barre
  d'un autre monde que les deux champs juste dessous. Il reprend exactement
  `.field input`.
- **Les champs étaient de la couleur de leur carte** (`--bg` sur `--bg`) : ils
  ne se lisaient que par leur filet. Ils passent à `--surface`, dans les deux
  thèmes.
- **Le formulaire prenait les 1120 px de l'espace connecté** — 150 caractères
  par ligne pour l'introduction, 1700 px pour un nom de vingtaine de signes.
  `.demande-magasin` le ramène à 560 px, la largeur utile de la carte
  d'inscription dont il est repris, **centré dans la page** (demande de Julien).
  La liste des demandes en cours, elle, reste alignée à gauche sur toute la
  largeur : c'est une liste d'enregistrements, comme celle des magasins
  au-dessus.
- **La pastille de rang a disparu quand il n'y a qu'un magasin** (`numero`
  devient facultatif) : numéroter un élément unique n'apprend rien.

Deux corrections systémiques au passage, valables pour tous les formulaires du
site : un **anneau de focus** (`box-shadow`) là où seul le changement de
bordure signalait le focus malgré `outline: none`, et la ligne de tranche
passée de `--text-3` à `--text-2` — 2,9:1 sur le fond de la carte, sous le
seuil AA, à l'endroit précis où l'on lit le prix. Les zones de texte ne se
redimensionnent plus qu'en hauteur.

Vérifié au navigateur, clair et sombre, par une **route jetable** rendant le
formulaire hors session (`/tmp-polish`, retirée ensuite — vérifier au
`git status` qu'elle n'est pas restée).

**Non vu à l'écran** : `/magasins` et la console demandent une session
connectée. Maquette validée avant codage :
https://claude.ai/code/artifact/1b6dfbe0-6866-4af9-a5ab-c6e6b1188231

### Une demande aboutie quitte l'écran du client, et se dit par e-mail

Constat de Julien, capture à l'appui : « Alltricks — Magasin créé » restait
affiché sous « Demandes de magasin », alors que le magasin avait été créé puis
supprimé (c'était un essai). La liste montrait une trace sans objet, sous un
titre qui annonce des demandes en cours.

Règle posée (migration `20260822200001`) : **la liste du client ne garde que ce
sur quoi il peut encore agir** — les demandes en attente, qu'il annule, et les
refusées récentes, dont il doit lire le motif. Les demandes abouties
(`created`, `removed`) sortent de l'écran : le magasin apparu — ou disparu —
dans la liste juste au-dessus est la confirmation. **La trace ne bouge pas** :
la ligne reste en base, visible 90 jours dans la console Quantinvo, purgée à un
an comme les journaux. On cesse d'afficher, on n'efface pas.

Deux e-mails accompagnent le parcours, par deux fonctions edge :

- `ca-request-store` — accusé de réception, à l'envoi de la demande ;
- `admin-fulfil-store-request` — « votre magasin est créé », quand Quantinvo
  crée.

Quatre points à ne pas défaire :

- **Elles n'ajoutent aucun droit.** Chacune appelle sa RPC **avec le jeton de
  l'appelant** (`is_company_admin()` / `is_admin()`, exigence aal2 comprise).
  Une création jouée en `service_role` contournerait toute la garde.
- **Le code d'accès du magasin ne part jamais par e-mail** : il ouvre l'entrée
  dans le magasin. Le message renvoie vers la fiche, où il se lit derrière une
  session. `admin_fulfil_store_request` ne le met pas non plus dans son objet
  `notify`.
- **Un e-mail qui ne part pas n'annule rien.** La ligne est déjà écrite quand
  on envoie : l'échec se dit (`emailed: false`), il ne fait pas croire que
  rien n'a été fait.
- **Les deux écrans retombent sur la RPC directe** si l'edge est injoignable —
  une demande qui passe sans accusé vaut mieux qu'une demande qui ne passe pas.

**Le refus part aussi par e-mail**, motif compris (ajouté dans la foulée, à la
demande de Julien) : `admin-reject-store-request`, et l'objet `notify` sur
`admin_reject_store_request` (migration `20260822210001`). Deux points : le
motif **voyage tel quel** — c'est déjà la règle de l'écran, « Refusée » tout
court ne dit pas quoi faire — et `kind` voyage avec lui, parce qu'un refus
d'ajout et un refus de suppression ne se disent pas de la même façon. La
demande refusée reste par ailleurs trente jours sur l'écran du client.

Tests de garde : `web/tests/demande-magasin.test.ts`, bloc « une demande
aboutie quitte l'écran ». Les deux fonctions edge **sont déployées** (22 août
2026) ; toute modification demande un redéploiement, le dépôt ne déploie rien.

## Demander la suppression d'un magasin (même jour)

*« Sur page magasin ajouter bouton de demande de suppression. »* Symétrique de
l'ajout, et pour la même raison : la licence se facture par magasin, donc
Quantinvo reste seul à supprimer comme il est seul à créer. Le bouton vit en
bas de la fiche d'un magasin, la demande s'annule tant qu'elle est en attente.

**Même table**, distinguée par `kind` (`add` / `remove`) : une seule boîte de
réception, une seule purge, un seul écran côté console. Le statut gagne
`removed` — « créé » ne se dit pas d'une suppression. Migration
`20260822180001`.

⚠️ **Un piège trouvé en l'écrivant, et qui existait avant :
`admin_delete_store` échouait.** Elle ne faisait qu'un `delete from stores`, or
`inventory_sessions.store_id` référence `stores` en **NO ACTION** — la
suppression partait donc en violation de clé étrangère dès que le magasin avait
connu un inventaire. **Le bouton « Supprimer » de la fiche entreprise était
cassé pour tout magasin ayant servi**, et une demande de suppression impossible
à honorer aurait été pire. Vérifié à la source : la suppression nue répond
`violates foreign key constraint "inventory_sessions_store_id_fkey"`.

La fonction supprime maintenant les inventaires du magasin d'abord — comme
`admin_delete_company` le fait pour une entreprise — et **les deux écrans le
disent avant** : « Ses inventaires et tous leurs comptages seront effacés. »
Ne pas retirer cette phrase : c'est elle qui rend le geste honnête.

Vérifié en base, en transactions annulées : demande créée, doublon refusé,
suppression honorée sur un magasin **portant un inventaire et des comptages**
(magasin parti, inventaires partis, demande en `removed` et détachée du magasin
disparu, journaux des deux côtés).

Tests de garde : `web/tests/demande-magasin.test.ts`.

# Conformité RGPD / sécurité

Audit complet du 13 août 2026 : 15 manquements relevés (2 critiques, 7 élevés,
6 moyens). Rapport détaillé :
https://claude.ai/code/artifact/0db58594-ff3e-4ad5-91a8-29b85cbb3621

## Traité

- **C1 — présence temps réel** : les canaux sont désormais `private: true` des
  deux côtés, et `realtime.messages` porte deux policies adossées à
  `can_join_session_topic()` (migration `20260813000009`). **Un canal public ne
  consulte aucune autorisation** — c'est le piège : ne jamais recréer un canal
  sans `private: true`, la RLS ne rattraperait rien.
- **M2** — `check_invitation` révoquée à `anon`/`authenticated` (oracle
  d'énumération d'e-mails), `compose_full_name` reçoit un `search_path` figé
  (migration `20260813000010`).
- **E7, partie code** — mot de passe porté à 12 caractères sur `/bienvenue`.
- **M3, renvoi par e-mail** — fonction edge `submit-supervisor-request` :
  elle appelle `submit_supervisor_request_detailed` en `service_role` et écrit à
  l'adresse saisie « vous avez déjà un compte » ou « votre demande est déjà en
  cours ». **« Code inconnu » et « demande créée » partagent le même message**,
  sans nom de magasin : deux textes distincts rouvriraient l'oracle, puisque
  qui essaie des codes utilise sa propre adresse. Déployée en
  `verify_jwt: false` — un formulaire public n'a pas de session — avec la
  limitation de débit comme contrepartie, appliquée avant tout travail. Le
  formulaire retombe sur la fonction publique de la base si l'edge est
  indisponible : la demande passe, sans l'e-mail. C'est la deuxième fonction du
  projet sans vérification de jeton, avec le futur webhook Stripe.
- **M4 — journal des actions d'administration** : table `admin_audit_log`
  (numéro croissant, RLS lecture admin seulement, aucune écriture côté client),
  alimentée par les onze fonctions `admin_*` d'écriture via `log_admin_action`.
  **La trace s'écrit dans la même transaction que l'action** : une action qui
  ne peut pas se journaliser échoue — ne jamais entourer `log_admin_action`
  d'un bloc qui avale les erreurs, et journaliser toute nouvelle fonction
  `admin_*` (test de garde : `web/tests/journal-admin.test.ts`). Les libellés
  (auteur, cible) sont figés au moment de l'action pour survivre aux
  suppressions. Lecture par `admin_list_audit_log`, affichage dans /admin
  (section « Journal des actions »). Conservation 1 an, purgée par
  `purge_expired_data()`. Migration `20260818000003`. Registre : T8.
- **M6 — droits outillés, procédure écrite.** `export_my_data()` (migration
  `20260818000004`) rend à la personne authentifiée un JSON complet de ce qui
  est rattaché à son compte — bouton « Télécharger mes données » sur la page
  Mon compte, annoncé dans la politique. **Aucun code d'accès n'y figure**
  (entreprise, magasin, sécurité) et le détail ligne à ligne des inventaires
  n'y est que résumé : l'employeur en est responsable de traitement, l'export
  le dit et renvoie vers lui. Procédure de violation :
  `docs/conformite/procedure-violation-donnees.md` (72 h, et surtout la
  distinction responsable / sous-traitant — pour les données d'inventaire,
  Devkaylab prévient l'entreprise cliente sans délai, c'est elle qui notifie) ;
  registre des violations à tenir dans `registre-des-violations.md`.
  Tests de garde : `web/tests/mes-donnees.test.ts`.
- **M3, partie sécurité** — `submit_supervisor_request` répond désormais
  **exactement la même chose** pour un code magasin inconnu, un compte déjà
  existant, une demande en cours ou une création réussie
  (`{success: true, received: true}`), et ne renvoie plus le nom du magasin.
  Le détail existe toujours dans `submit_supervisor_request_detailed`,
  exécutable par le **seul `service_role`**. Les erreurs de saisie restent
  explicites : elles ne parlent que de ce que la personne vient de taper.
  `rate_limit_ok` limite les deux formulaires à 5 envois par heure et par
  adresse e-mail, 20 par point de connexion (`submission_attempts`, purgée à
  24 h). Migration `20260818000002`, appliquée en live après essai en
  transaction annulée. **Ne pas réintroduire de message distinct** : c'est
  l'oracle que ce correctif ferme, et deux tests le gardent
  (`web/tests/formulaires-publics.test.ts`).
- **M1** — six en-têtes de sécurité posés dans `web/next.config.mjs` (et non
  dans `vercel.json`, pour qu'une règle trop stricte se voie dès le
  développement). La CSP ferme `frame-ancestors`, `object-src`, `base-uri` et
  `form-action`, et n'ouvre `connect-src` que vers Supabase, WebSocket compris.
  **`script-src` garde `unsafe-inline`** : le routeur d'application de Next
  injecte ses scripts d'hydratation en ligne, et `layout.tsx` pose celui du
  thème. S'en passer demande un nonce par requête, donc un middleware, au prix
  du rendu statique — arbitrage ouvert. Vérifié au navigateur : aucune
  violation sur les cinq pages publiques, et une destination externe est bien
  refusée nommément par la CSP. Tests : `web/tests/entetes-securite.test.ts`.
- **E1 / E2, partie effacement** — la suppression de compte **échouait** :
  cinq clés étrangères pointaient `profiles` en NO ACTION, donc supprimer un
  compte ayant compté levait une violation de contrainte. Migration
  `20260818000001` appliquée en live : les comptages se détachent au lieu de
  bloquer, un déclencheur BEFORE DELETE sur `auth.users` efface l'identité
  résiduelle (demandes anonymisées, invitations supprimées), et
  `purge_expired_data()` porte les durées — 3 mois, 1 an, 3 ans — en un seul
  point. **`pg_cron` reste non installé** : la purge n'est pas planifiée, elle
  s'appelle à la main en `service_role`. Son corps n'a jamais été exécuté.
- **E5 / E6, hébergement de la politique** — découvert le 18 août 2026 :
  l'adresse `devkaylab.github.io/Inventaire/privacy.html`, vers laquelle
  pointent l'app et le site, renvoyait **404** — GitHub Pages n'était pas
  activé sur le dépôt. Réactivé (branche `main`, dossier `/docs`). Aucun test
  automatique ne surveille cette adresse : après tout changement de
  configuration du dépôt GitHub, vérifier au moins une fois qu'elle répond.
- **E5 / E6** — `docs/privacy.html` réécrite : les quatre sous-traitants
  (Supabase, Vercel, Resend, **Expo** — les jetons de notification partent vers
  `exp.host`), les transferts hors UE, les finalités et bases légales, les
  durées, le **droit de réclamation auprès de la CNIL**, et la répartition
  responsable / sous-traitant vis-à-vis des entreprises clientes. La mention
  d'information s'affiche **sous chaque formulaire** de collecte
  (`MentionCollecte`), pas seulement en pied de page — volontairement sans case
  à cocher, la base légale n'étant pas le consentement. Des tests gardent le
  tout (`web/tests/confidentialite.test.ts`) : ajouter un prestataire sans le
  déclarer, ou un formulaire sans la mention, fait échouer la suite.
  La politique déclare aussi le suivi nominatif de l'activité (constat E3) —
  restent l'information des salariés, la consultation du CSE et l'AIPD. Elle
  dit franchement que les demandes et invitations ne sont pas encore purgées
  (E1 / E2) : à mettre à jour quand les durées seront posées.
- **E4, page en place** — `/mentions-legales` sur le site, alimentée par
  `web/lib/legal.ts`. **L'activité éditrice n'est pas encore immatriculée** :
  tant qu'une mention requise manque, `mentionsCompletes()` est faux, la page
  passe en `noindex` et le pied de page ne l'annonce pas — une identification à
  trous ne vaut pas mieux que pas de page. Remplir les valeurs dans ce seul
  module suffit à tout activer. L'adresse et le téléphone de Vercel sont à
  recopier depuis leurs informations légales : `vercel.com` est bloqué depuis
  l'environnement de l'agent, et ces coordonnées ne se citent pas de mémoire.
- **C2 — `xlsx`** : SheetJS ayant quitté npm, l'archive officielle 0.20.3 est
  versionnée dans `vendor/` et installée en `file:` des deux côtés. Les deux
  failles de la partie lecture (CVE-2023-30533, CVE-2024-22363) sont corrigées,
  et `xlsx` a disparu des deux `npm audit`. **Ne jamais faire
  `npm install xlsx`** : cela ramènerait 0.18.5 en écrasant le `file:` sans
  rien signaler — deux tests montent la garde (`tests/xlsx.test.ts` de chaque
  côté). Procédure de mise à jour : `vendor/LISEZMOI.md`, outillage :
  `scripts/installer-sheetjs.mjs`.

## Le domaine : `www.quantinvo.com` (branché le 22 août 2026)

Le site vit sur **`https://www.quantinvo.com`** — c'est l'adresse canonique,
choisie par Vercel à l'ajout du domaine : `quantinvo.com` redirige en 308
vers `www`, et `quantinvo.vercel.app` reste servi en alias (les liens déjà
envoyés par e-mail continuent de marcher). Le DNS est chez Vercel
(`ns1/ns2.vercel-dns.com`) ; l'e-mail (ImprovMX pour `contact@`, Resend sur
`send.quantinvo.com`) n'en dépend pas.

Ce qui a bougé dans le dépôt (commit `80d5e2b`) : tous les replis
`https://quantinvo.vercel.app` — `src/constants/links.ts` (`SITE_URL`, app
mobile, effectif au prochain build), `_shared/email.ts` (`SITE_PAR_DEFAUT`,
donc l'adresse du logo PNG des e-mails), les quatorze fonctions edge, le pied
du PDF de devis, l'écran « ordinateur requis », `docs/privacy.html`, les
modèles de documents et le deck.

**Les fonctions edge n'ont pas été redéployées pour ça** : elles lisent
`APP_PUBLIC_URL` à l'exécution, la valeur écrite en dur n'est qu'un repli.
Poser le secret suffit ; le repli ne sert qu'au prochain redéploiement de
chaque fonction, quelle qu'en soit la raison.

**Posé le 22 août 2026 par Julien**, et vérifié pour l'edge par un envoi réel
(l'accusé d'une demande d'essai chargeait déjà son logo depuis le nouveau
domaine, fonction non redéployée) : le secret `APP_PUBLIC_URL`, qui n'avait
**jamais existé** avant ce jour — toutes les fonctions tournaient sur leur
repli —, et la console Supabase (Authentication → URL Configuration) :
**Site URL** `https://www.quantinvo.com`, et les **Redirect URLs**
`https://www.quantinvo.com/reinitialisation` et `/bienvenue` — en gardant les
anciennes (`https://quantinvo.vercel.app/…` et
`https://quantinvo-*-devkaylab.vercel.app/reinitialisation`) tant qu'un e-mail
déjà parti peut encore être cliqué. Secret edge `APP_PUBLIC_URL` =
`https://www.quantinvo.com`.

## Double authentification (TOTP)

Le parcours vit dans l'app web depuis le 19 août 2026 — la console Supabase
n'avait rien à activer, le TOTP y est permis d'office ; ce qui manquait,
c'était l'interface. Activation depuis **Mon compte** (`MfaPanel` : QR code,
puis code de vérification), saisie du code à chaque connexion (`/login`,
deuxième étape), logique dans `web/lib/mfa.ts`. `useAuthGuard` renvoie vers
`/login` toute session restée au mot de passe seul (`aal1`) alors que le
compte a un facteur — sans cette garde, fermer l'onglet entre le mot de passe
et le code laisserait entrer à moitié authentifié.

Le compte administrateur est enrôlé (19 août 2026), et **le serveur l'exige
désormais** : migration `20260819123621_mfa_admin_aal2`. La garde tient en un
seul point — les dix-huit fonctions `admin_*` passent toutes par `is_admin()`,
qui répond faux à une session restée au mot de passe seul. Avant cette
migration, un jeton `aal1` gardait tous les droits côté serveur : la garde
client ne protégeait que l'interface, pas l'API.

**L'exigence est conditionnelle, ne pas la « simplifier »** en un `aal2`
obligatoire : elle ne vise que les comptes ayant un facteur vérifié. C'est ce
qui rend le dépannage possible — un téléphone perdu se règle en `service_role`
(`delete from auth.mfa_factors where user_id = …`), l'administrateur retrouve
ses droits au mot de passe seul le temps de se réenrôler, sans qu'il faille
défaire la migration. Il n'y a pas de codes de secours. Tests de garde :
`web/tests/mfa.test.ts`.

Non concernés : les comptes sans second facteur, les superviseurs ordinaires,
`service_role` (pas de `auth.uid()`), et l'app mobile — elle n'appelle aucune
fonction `admin_*`. **Si un écran mobile devait un jour en appeler une**, il
faudrait d'abord y porter le parcours TOTP : sans lui, une session mobile est
en `aal1` et serait refusée.

## Changer son mot de passe exige l'ancien (21 août 2026)

`updateUser({ password })` ne demande rien d'autre que d'être connecté. Un
téléphone laissé déverrouillé, ou un poste resté ouvert, suffisait donc à
changer le mot de passe et à s'approprier le compte — au moment même où l'on
ajoutait un second facteur contre ce risque. **Le trou existait des deux
côtés** : l'app l'a recopié du site en portant le formulaire. Relevé par Julien
en test.

Les deux formulaires (`web/app/account/page.tsx`, `src/app/(compte)/password.tsx`)
demandent maintenant le mot de passe actuel, et offrent la sortie « mot de passe
oublié » pour qui ne s'en souvient plus — c'est le parcours par e-mail qui
vérifie alors l'identité, et c'est la bonne porte.

**La vérification passe par un client Supabase jetable** (`lib/reauth.ts` des
deux côtés) : `signInWithPassword` remplace la session du client qui l'appelle.
Sur le client principal, vérifier ferait retomber la session en `aal1` et
redemanderait le code de double authentification au milieu du formulaire.

Deux conséquences à connaître :

- la vérification laisse une **session serveur orpheline**, jamais rafraîchie.
  Elle meurt par l'expiration pour inactivité posée plus haut ;
- ⚠️ elle **dépend de « Single session per user » resté fermé**. Cette option ne
  garde que la dernière connexion : vérifier son mot de passe déconnecterait de
  l'app ou de l'onglet en cours. Le conseil de ne pas l'activer devient donc
  porteur.

Tests de garde : `web/tests/password.test.ts`, bloc « changement de mot de
passe — l'ancien est exigé ».

## Expiration des sessions (posée en console le 21 août 2026)

Constat de départ : `auth.sessions.not_after` est vide partout, et une session
de compteur ouverte le 18 juin vivait encore le 13 août. **Rien n'expire.** Un
téléphone perdu reste connecté indéfiniment, sur un outil qui porte des données
de stock et des noms de salariés.

À savoir d'abord, parce que la question revient : **le code de double
authentification n'est pas demandé périodiquement.** Le niveau `aal2` est
stocké sur la ligne de session, pas seulement dans le jeton ; le
rafraîchissement horaire le reconduit. On ne le ressaisit qu'à une nouvelle
connexion. Un « se souvenir de cet appareil » maison est à écarter : on ne peut
pas accorder `aal2` côté client, donc sauter l'écran laisserait la session en
`aal1` — les fonctions `admin_*` refuseraient, et pour un superviseur ce serait
une protection de façade.

**Réglage en place**, Authentication → Sessions (offert à partir du plan Pro —
l'organisation y est). **Les deux champs sont en heures**, pas en jours :

- *Inactivity timeout* — la session meurt faute d'usage → **720 h (30 jours)** ;
- *Time-box user sessions* — plafond absolu depuis la connexion →
  **4320 h (180 jours)**.

⚠️ **Ce réglage ne se relit pas depuis la base.** Le plafond n'est pas
matérialisé dans `auth.sessions` (`not_after` reste vide) : GoTrue compare
`created_at + plafond` et `refreshed_at + inactivité` au moment du
rafraîchissement. Seule l'API de gestion, ou le panneau de la console, dit ce
qui est configuré. En cas de doute, aller le lire — ne pas conclure de
`not_after` vide que rien n'est posé.

Qui compte régulièrement n'est jamais dérangé ; qui n'a pas ouvert l'app depuis
un mois ressaisit son mot de passe une fois.

Trois précisions de la documentation Supabase, qui évitent des surprises :

- **La durée réelle est le réglage plus l'expiration du jeton** (une heure ici).
  Le contrôle n'a lieu qu'au rafraîchissement suivant.
- **Changer le réglage ne tue pas les sessions en cours** : elles tombent au fur
  et à mesure de leurs rafraîchissements. Les sessions expirées sont effacées de
  la base 24 h plus tard.
- **Ne pas activer *Single session per user*.** Cette option ne garde que la
  dernière connexion : se connecter sur le téléphone déconnecterait du site, et
  inversement. Or un superviseur travaille précisément avec les deux.

**Ce qu'il fallait corriger avant d'activer, et qui l'est.** Une session
expirée n'annule pas les comptages en attente :

- `syncNow` ne tente rien sans session valide. Sinon la requête part en
  anonyme, PostgREST répond « permission denied », et `flush()` rangeait des
  comptages **valides** dans les échecs définitifs — le compteur perdait son
  travail.
- `isAuthExpired` (jeton périmé, 401, session absente) est traité comme une
  coupure réseau : l'opération reste en file. **`42501` n'en fait pas partie** —
  refus de droits avec session valide (retiré de l'inventaire, inventaire
  clôturé), ça doit rester un échec visible.
- Tests de garde : `tests/offline.test.ts`, blocs « une session expirée
  conserve la file » et « un refus de droits reste un échec définitif ».

**Le risque résiduel, à connaître avant de choisir des durées courtes** : si
une session expire pendant un comptage hors ligne, la personne est renvoyée
vers la connexion et ne peut pas se reconnecter sans réseau. Ses comptages sont
conservés, mais elle ne peut plus compter. C'est ce qui plaide pour un plafond
large plutôt que serré.

## Politique de mot de passe (console + code, 19 août 2026)

La console applique désormais : **12 caractères minimum**, une minuscule, une
majuscule, un chiffre, un symbole, et le refus des mots de passe présents dans
les fuites connues (**Leaked password protection**, HaveIBeenPwned). L'advisor
`auth_leaked_password_protection` a disparu — il ne reste que les avertissements
`*_security_definer_function_executable`, connus et voulus (les RPC portent
leurs propres contrôles).

`web/lib/password.ts` **rejoue ces règles côté client** pour les énoncer en
français avant l'envoi, et traduit les refus que seul le serveur peut prononcer
(mot de passe issu d'une fuite, réutilisation de l'ancien) — sans quoi la
personne reçoit un message technique en anglais. Les deux formulaires
(`/bienvenue`, `/reinitialisation`) affichent les exigences cochées à la frappe
(`PasswordRules`).

**Console et code doivent bouger ensemble** : assouplir la console sans
toucher au module afficherait une exigence qui n'existe plus ; la durcir sans
lui laisserait passer une saisie que le serveur refusera. Tests de garde :
`web/tests/password.test.ts` (dont le seuil de 12, figé explicitement).

## Suivi d'activité : agrégé, plus nominatif (E3, 19 août 2026)

Le suivi nominatif en direct a été **retiré**. Le superviseur voit des
compteurs — appareils connectés, en comptage, en audit — et pilote par
l'avancement par zone, qui décrit le travail et non les personnes.

**Contrat de présence v2** (`web/lib/presence.ts` et `src/lib/presence.ts`,
dupliqués volontairement, à garder synchronisés) : il ne reste que `mode` et
`beat`. Ont disparu le nom, l'écran, la balise en cours, le début d'activité et
**l'application au premier plan**. La clé de présence est un identifiant
d'appareil tiré au hasard, plus l'`user_id` — il voyageait dans le protocole
même absent de la charge. Le site **écoute sans publier**.

Le bump de version est ce qui protège la transition : une application mobile
restée en v1 continue d'émettre l'ancienne charge, mais le site l'écarte et la
compte dans `unknownVersions`, affiché à l'écran. **Ne jamais réutiliser le
numéro de version** en changeant le contrat.

Retirés aussi : l'appel à `get_session_activity` (nominative) et `counted_by`
dans la requête du fil des scans — ce qui n'est pas affiché n'a pas à descendre
au navigateur.

La RPC elle-même a été supprimée (`20260819174148`), **et le chemin pour y
arriver vaut d'être retenu** : une première suppression (`20260819171741`) a dû
être annulée dans la minute (`20260819172557`) parce que le site en production
l'appelait encore — le tableau de bord affichait alors « Cet inventaire n'est
pas accessible » à l'ouverture d'un inventaire, `refreshLive` la joignant dans
un `Promise.all` dont l'échec remonte jusqu'à l'écran. **Déployer le code
d'abord, supprimer l'objet ensuite.** Et à la restauration d'une fonction,
reposer les GRANT dans la même migration : `create or replace` rend EXECUTE à
PUBLIC (corrigé par `20260819172706`).

**Ce qui reste nominatif et doit le rester** : `counts.counted_by`, écrit à
chaque scan et restitué dans le rapport. Arbitrer un écart suppose de savoir
qui a compté ; finalité distincte, usage différé. Le supprimer retirerait au
produit sa capacité d'audit.

Conséquence sur les obligations : le critère « surveillance systématique »
tombe, il ne reste que « personnes vulnérables » — l'AIPD n'est donc en
principe plus requise, mais **cela se motive par écrit**. Analyse à jour :
`docs/conformite/suivi-activite-analyse.md`. Tests de garde :
`web/tests/presence-summary.test.ts` et le bloc « Suivi — activité agrégée »
de `web/tests-e2e/dashboard.spec.ts`.

## Reste à traiter, par ordre de priorité

1. **M5 — documents écrits, à faire relire.**
   `docs/conformite/registre-des-traitements.md` (7 traitements, établis en
   relisant le code) et `sous-traitance-article-28.md` (clauses à intégrer aux
   conditions de service). Ni l'un ni l'autre n'a été relu par un juriste.

## Dérive entre le dépôt et la base

`account_deletion_requests` et `request_account_deletion` existent en base live
mais **n'ont aucune migration** dans le dépôt : créés directement via l'outil
MCP. Repartir d'un `supabase db pull` avant toute refonte de ces objets, sous
peine d'écrire une migration qui contredit l'existant.

## Points conformes à préserver

Aucun traceur ni mesure d'audience — **aucun bandeau cookies n'est requis**, ne
pas en ajouter par réflexe. Polices Google auto-hébergées par `next/font` (pas
d'appel à Google au chargement). Données en `eu-west-1`. Aucun secret versionné.
La suppression de compte anonymise les comptages au lieu de les détruire.

# Tenue en charge (21 août 2026)

Question posée : « Quantinvo résiste-t-il à 200 magasins faisant un inventaire
avec 100 compteurs chacun, au même moment ? » L'étude a montré que **le mur
n'est pas le nombre de magasins, mais le nombre de compteurs d'un même
magasin**, et qu'il ne tenait pas à la puissance louée mais à deux endroits du
code. Les deux sont corrigés ; le reste est un curseur et une facture.

## Ce qui a été corrigé

**Les totaux se calculent sur le serveur.** `getCountTotals` téléchargeait
toutes les lignes de `counts` de l'inventaire pour additionner quatre nombres
dans le navigateur — rejoué toutes les huit secondes par tableau de bord
ouvert, soit des centaines de milliers de lignes par sondage sur un gros
inventaire. Remplacé par la RPC `get_session_count_totals` (migration
`20260821240001`). **Ne jamais y remettre un `select` sur `counts`.**

**Les téléphones ne rejoignent plus le canal temps réel** — contrat de présence
**v3**. En v2, chaque téléphone publiait sa présence sur le canal de
l'inventaire, et le service recopiait chaque battement vers *tous* les membres,
donc vers les 99 autres téléphones qui n'en font rien : un coût en n² pour un
service en n. Mesuré à cent compteurs : ~336 messages/s pour la seule présence,
plus ~1 000 pour le `sync` émis à chaque scan, contre un plafond d'abonnement
de 500/s tous magasins confondus — et une connexion ouverte par téléphone, pour
un plafond de 10 000.

En v3, le téléphone envoie son battement par **broadcast HTTP**
(`channel.httpSend`), sans jamais s'abonner, et seul le tableau de bord écoute.
Deux bornes de cadence, aussi importantes que le reste : au plus un message
toutes les 5 s (une rafale de scans est regroupée — c'est ce qui remplace le
`sync` par scan), au moins un toutes les 30 s (sinon le site croit l'appareil
parti à 90 s). L'identifiant d'appareil, que la présence portait comme clé de
canal, voyage désormais dans la charge (`k`).

**Le tableau de bord ne recalcule qu'une fois par minute.** Un
rafraîchissement fait reparcourir tous les comptages de l'inventaire (zones et
totaux) : le coût est le même que le déclencheur soit le sondage régulier ou un
scan qui vient d'arriver. La limite `AUTO_MIN_GAP_MS` de `useSessionLive` vaut
donc **pour tous les déclencheurs à la fois** — la poser sur le seul sondage ne
changerait rien un jour de gros inventaire, où les scans arrivent en continu.
À 200 magasins, cela ramène la charge de ~50 calculs par seconde à moins de 7.

Ce qui rend une minute acceptable, et qu'il ne faut pas retirer : la limite est
à **seuil franchi**, donc sur un inventaire calme le premier scan venu
rafraîchit tout de suite ; le bouton « Mis à jour… » de l'en-tête et le retour
sur l'onglet passent outre (`refresh(true)`) ; et les compteurs d'appareils
connectés ne passent pas par là, ils suivent les battements en direct.

Le sondage bat **plus vite** que la limite (15 s contre 60) : sinon un
rafraîchissement déclenché à la dixième seconde ferait sauter le sondage
suivant et l'écran pourrait rester deux minutes sans bouger.

La temporisation de 750 ms qui précédait a été retirée, et le motif vaut d'être
retenu : elle reportait l'appel à chaque message reçu, donc sur un inventaire
animé — où les messages arrivent plus vite que ça — elle ne parvenait jamais à
son terme. Ce déclencheur ne servait plus à rien, sans que cela se voie.

**Chaque section ne recharge que ce qu'elle affiche.** `LIVE_SCOPES` (page du
tableau de bord) donne la portée de `refreshLive` : `suivi` (avancement, totaux
et fil des scans), `zones` (Set up, Écarts — sans le fil), `aucun` (Rapport,
Équipe). Le Rapport reste vivant : il recharge le sien à chaque battement, et
c'est bien ce qui est à l'écran — mais il ne fait plus recalculer l'avancement
par zone dont sa page ne montre rien.

Deux pièges déjà rencontrés, à ne pas réintroduire :

- **Le premier chargement ignore la portée** (`chargerLive('suivi')` dans
  `refreshAll`). Le bandeau de progression est visible sur toutes les sections :
  s'en remettre à la portée afficherait un bandeau à zéro sur un lien direct
  vers le Rapport.
- **Changer de section recharge tout de suite**, sans passer par la limite. Les
  rafraîchissements joués pendant un détour par le Rapport n'ont rien rechargé :
  sans ce geste, revenir sur Suivi montrerait un avancement figé. Et extraire
  `refresh` de l'objet `live` avant de le mettre en dépendance d'effet — la
  présence change à chaque battement, dépendre de l'objet entier rechargerait
  l'inventaire à chaque appareil qui se signale.

**Le tableau de bord se repose quand rien n'est signalé.** Sur un inventaire
ouvert où personne ne scanne, le sondage se contente d'une passe toutes les cinq
minutes (`IDLE_MAX_MS`) au lieu d'une par minute. Le mobile signale ses scans
(battements `dirty`, et **la file hors ligne qui remonte** — `syncNow` appelle
`pingSession`, sans quoi un retour de réserve verserait des centaines de
comptages sans prévenir).

**La garde qui rend ce repos acceptable est `!channelReadyRef.current`** : le
repos ne s'applique que si le canal est ouvert. Un tableau de bord dont le temps
réel est tombé ne reçoit plus aucun signal — s'y endormir afficherait des
chiffres figés cinq minutes sans que rien ne l'explique. Ne jamais retirer cette
condition.

## Ce qu'il faut savoir avant d'y toucher

- **La double écoute du site est temporaire et nécessaire.** `useSessionLive`
  lit à la fois la présence v2 et les battements v3, et fusionne. Les
  téléphones déjà installés émettent encore en v2 : retirer `flattenPresence`
  avant que le nouveau build soit partout ferait disparaître de l'écran des
  équipes bel et bien au travail. Même règle que pour `get_session_activity` —
  code déployé d'abord, ancien chemin retiré ensuite.
- **`PRESENCE_V` n'existe plus** : deux constantes distinctes, `BEAT_V = 3`
  (contrat v3) et `LEGACY_PRESENCE_V = 2` (lecture de transition, côté site
  seulement). Ne jamais réutiliser un numéro de version en changeant le
  contrat.
- **Sécurité inchangée, et vérifiée à la source de Realtime** : le canal reste
  privé, les policies de `realtime.messages` s'appliquent à l'envoi HTTP comme
  à l'envoi par socket, et les messages publics circulent sur une file
  distincte de la file privée — une injection anonyme n'atteindrait pas le
  tableau de bord.
- **Piège** : le point d'entrée HTTP de Realtime répond **202 quoi qu'il
  arrive**. Un message refusé faute de droits est écarté en silence. `httpSend`
  qui réussit ne prouve donc pas que le message est arrivé : si le tableau de
  bord n'affiche aucun appareil alors que les téléphones comptent, chercher du
  côté des droits sur l'inventaire, pas du réseau.
- **Un téléphone, une clé, un émetteur** (corrigé le 22 août 2026). La clé
  d'appareil était tirée dans `useSessionPresence`, donc **à chaque montage**.
  Or deux écrans montent ce hook en même temps : l'écran de l'inventaire reste
  monté dans la pile sous l'écran de comptage. Un seul téléphone comptait pour
  deux appareils dès qu'on ouvrait le comptage — constat de Julien, capture à
  l'appui. La clé est maintenant un `const` de module (`DEVICE_KEY`), tiré une
  fois par lancement de l'application ; **ne jamais la redescendre dans le
  composant**.

  Corollaire : les écrans s'inscrivent dans une **pile** (`holders`), calquée
  sur la navigation — le dernier monté donne le mode — et il n'y a plus qu'un
  émetteur (`engine`). Le même défaut cassait `pingSession` en silence : le
  second montage écrasait la référence de l'émetteur, et son démontage la
  remettait à `null` alors que le premier écran vivait toujours, si bien que
  les scans ne réveillaient plus le tableau de bord. Changer d'écran dans le
  même inventaire **ne redémarre pas** l'émetteur (sinon l'appareil clignote),
  mais déclenche un `markDirty` — sans lui, fermer le comptage laisserait
  l'appareil affiché « en comptage » pendant trente secondes.
- Les deux modules `presence.ts` (site et mobile) restent **dupliqués
  volontairement** et doivent bouger ensemble. Tests de garde :
  `web/tests/charge.test.ts` et `web/tests/presence-summary.test.ts`.

## Ce qui reste ouvert

- **Index manquant** sur `counts (session_id, zone, pass_number)` :
  `get_zone_dashboard` agrège tous les comptages de l'inventaire à chaque
  rafraîchissement. Sans intérêt aux volumes actuels (quelques centaines de
  lignes) ; à reprendre avec des chiffres sous les yeux, pas au jugé.
- **Compute Micro** (`max_connections` = 60) : à monter le jour où le volume
  arrive. 20 000 compteurs à six scans/minute font ~2 000 écritures/s, une
  Micro en encaisse 200 à 400. C'est un curseur, pas un chantier.
- **Abonnement Realtime** : le plafond de dépense limite à 500 connexions
  simultanées. À retirer avant d'ouvrir beaucoup de magasins.
- **Sortie réseau** : `primeOfflineCache` télécharge le référentiel articles
  **par appareil**. Cent téléphones sur un catalogue de 10 Mo font 1 Go pour un
  seul magasin ; le forfait en inclut 250.

# Balises : séries imprimées, pas de stock (21 août 2026)

La création de balises ne passe plus par le serveur. Le superviseur choisit
une numérotation (simples `1, 2, 3…`, 4 chiffres `1000…9999`, 5 chiffres
`10000…99999`), un premier numéro et un nombre, et la planche PDF est produite
sur place. **Elle se crée partout où on en a besoin**, avec le mode d'emploi en
trois étapes (imprimer, coller, indiquer) écrit pour des personnes peu à l'aise :

- app : profil et écran Zones d'un inventaire (`BaliseCreator`, formulaire
  `BaliseSheetModal`, dessin `src/lib/balises.ts`) ;
- site : Mon compte et onglet Set up (`BaliseSheetPanel`, dessin
  `web/lib/balisePdf.ts`, téléchargement du PDF dans le navigateur).

La logique des séries est dupliquée volontairement (`src/lib/baliseSeries.ts`
et `web/lib/baliseSeries.ts`, un test garde l'identité : `web/tests/balises.test.ts`).
**Les deux dessins de planche doivent rester identiques** (gabarit Avery L7160,
QR `SCB1:<numéro>`) : une balise imprimée depuis le site doit se scanner comme
une balise imprimée depuis l'app. **Aucun compteur de balises n'est affiché**,
ni dans l'app ni sur le site : personne n'en a l'usage, les zones s'affectent
par plage libre (`define_zone`).

**Une balise hors plage se propose à l'ajout** (21 août 2026). Scanner une
balise qu'aucune plage ne couvre affichait « Balise non définie » avec un seul
bouton : le compteur restait devant une étiquette bien réelle sans moyen
d'avancer. L'alerte propose maintenant « Ajouter », qui rappelle `set_balise`
avec `p_allow_create := true` — la zone est créée sans emplacement, et le
superviseur la nomme ensuite depuis l'écran Zones. La création n'est **jamais**
tentée au premier passage : sans cette précaution, un numéro mal saisi créerait
une zone en silence.

Limite connue : **hors ligne, l'ajout n'est pas proposé**. La file accepte
l'ouverture sans interroger la base, et l'échec ne se découvre qu'à la
synchronisation, où l'opération part dans les échecs (`failedOps`). À reprendre
si le cas se présente en vrai.

La RPC `generate_company_balises` et la colonne `companies.balise_count`
**restent en base** tant que des builds mobiles antérieurs peuvent encore les
appeler — même règle que pour `get_session_activity` : code déployé d'abord,
objets supprimés ensuite. À supprimer dans une migration ultérieure, une fois
le nouveau build installé sur les téléphones ; ne plus rien y lire d'ici là.

# Passes de comptage

`advance_pass` / `revert_pass` ne sont plus exécutables par le rôle
`authenticated` (migration `20260813000002`) : SECURITY DEFINER, elles forçaient
`status = 'counting'` et permettaient à un simple compteur de rouvrir un
inventaire clôturé. `current_pass` n'est plus lu nulle part — la passe se déduit
du mode choisi par chaque participant (Comptage→1, Audit→2). Si les passes
globales reviennent, il faudra rendre le GRANT **et** ajouter la garde
`status <> 'closed'` dans les deux fonctions.
