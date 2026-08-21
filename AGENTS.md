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

## Paiement : Stripe à terme

L'encaissement est aujourd'hui déclaré à la main par l'administrateur. **Le
paiement passera vraisemblablement par Stripe** : le modèle a été conçu pour
que la bascule tienne en un seul point.

Le seul point d'accroche est la transition `accepted → paid` de
`admin_set_company_request_status`. Un webhook Stripe
(`checkout.session.completed`) appellera cette même RPC en `service_role` : ni
la séquence des statuts, ni `admin_fulfil_company_request`, ni la génération
des codes ne changent.

Quand ce sera au programme :

- Ajouter les colonnes de corrélation sur `company_requests`
  (`stripe_checkout_session_id`, `stripe_customer_id`, référence de facture) —
  volontairement absentes tant que le fournisseur n'est pas arrêté.
- Écrire l'edge function du webhook **avec vérification de la signature**
  Stripe, et la déployer en `verify_jwt: false` (Stripe n'envoie pas de JWT) —
  c'est la seule fonction du projet dans ce cas, d'où l'importance de la
  signature.
- Garder la création d'entreprise **derrière** le paiement, jamais déclenchée
  par le client : le webhook écrit `paid`, l'administrateur (ou un
  enchaînement serveur) crée ensuite. Ne pas exposer
  `admin_fulfil_company_request` au rôle `anon`.
- Traiter la ré-émission : Stripe rejoue ses webhooks. La garde de transition
  empêche déjà le double effet (`paid` n'est accepté que depuis `accepted`),
  mais elle **répond en erreur**, pas en succès. Le webhook doit donc traiter
  « transition impossible alors que la demande est déjà `paid` ou au-delà »
  comme un cas normal, sous peine de faire échouer la livraison et de
  déclencher des relances Stripe en boucle.

# E-mails transactionnels : un seul gabarit

Tout ce que le produit envoie par Resend passe par
`supabase/functions/_shared/email.ts` (`emailQuantinvo`). Les fonctions edge ne
décrivent plus que le contenu — titre, salutation, paragraphes, encadré de
faits, bouton, note, raison de l'envoi — et reçoivent en retour le **HTML et la
version texte**, envoyés tous les deux à Resend (les messageries sans HTML, et
les filtres anti-spam, lisent la seconde).

Le gabarit suit la charte « Papier » : **fond blanc**, encre en texte, indigo
profond en titre, bouton indigo, filet de scan cyan sous le mot-symbole. Un
e-mail se lit, s'imprime et se transfère comme un document — la direction
sombre du site n'a pas cours ici.

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

## Console Supabase — configuration des URL (fait le 19 août 2026)

La **Site URL** (Authentication → URL Configuration) vaut
`https://quantinvo.vercel.app` — elle sortait d'usine à `http://localhost:3000`,
ce qui envoyait vers localhost tout lien d'authentification retombé sur le
repli. Les **Redirect URLs** déclarent `/reinitialisation` (destination des
liens « mot de passe oublié ») en production et en preview :
`https://quantinvo.vercel.app/reinitialisation` et
`https://quantinvo-*-devkaylab.vercel.app/reinitialisation`.

**Le jour où le produit passera sur son propre domaine**, cette configuration
ne suivra pas toute seule. À reprendre ce jour-là, en une passe :

- Console Supabase : la Site URL et chaque Redirect URL
  (`/reinitialisation`, et les destinations d'invitation vers `/bienvenue`).
- Variable `APP_PUBLIC_URL` des edge functions (`invite-supervisor`,
  `invite-teammate`, `invite-to-session`, `submit-supervisor-request`) — leur
  repli codé en dur est `https://quantinvo.vercel.app`.
- `src/constants/links.ts` (`SITE_URL`, utilisé par l'app mobile, y compris le
  texte de partage de `profile.tsx`).
- `docs/privacy.html` et la page des mentions légales, qui citent
  `quantinvo.vercel.app` nommément.

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
- Les deux modules `presence.ts` (site et mobile) restent **dupliqués
  volontairement** et doivent bouger ensemble. Tests de garde :
  `web/tests/charge.test.ts` et `web/tests/presence-summary.test.ts`.

## Ce qui reste ouvert

- **Index manquant** sur `counts (session_id, zone, pass_number)` :
  `get_zone_dashboard` agrège tous les comptages de l'inventaire à chaque
  battement.
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
