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
- **Superviseur** : demande sur `/superviseur` **avec le code magasin** →
  validation admin → invitation Supabase → mot de passe choisi par la personne →
  profil créé et affecté au magasin de la demande.
- **Compteur** : ajouté par son superviseur (app ou dashboard web), prénom + nom
  + e-mail, rattaché aux magasins choisis (`team_invitations.store_ids`, vide =
  tous ceux du superviseur).

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

## À faire dans la console Supabase (hors SQL)

- Activer **Leaked password protection** (vérification HaveIBeenPwned) —
  actuellement désactivée, signalée par l'advisor `auth_leaked_password_protection`.
- Porter la longueur minimale de mot de passe à 12 côté serveur.
- Activer le **second facteur**, au moins pour le compte administrateur : il
  peut créer des entreprises, valider des superviseurs et supprimer des comptes.

## Reste à traiter, par ordre de priorité

1. **E5 / E6** — politique de confidentialité incomplète (omet Vercel, Resend,
   Expo, les transferts hors UE, les durées, et **le droit de réclamation
   auprès de la CNIL**, pourtant obligatoire) et jamais présentée au point de
   collecte (`/inscription`, `/superviseur`, `/bienvenue`).
2. **E1 / E2** — l'effacement d'un compte laisse l'identité dans
   `supervisor_requests` (`ON DELETE SET NULL`), `company_requests`,
   `team_invitations` et `session_invitations` ; aucune durée de conservation
   nulle part, et `pg_cron` n'est pas installé.
3. **E3** — le suivi nominatif de l'activité des compteurs (présence, balise,
   « depuis 4 min », premier plan) n'est déclaré nulle part, et la politique
   affirme l'inverse. Information des salariés + consultation du CSE côté
   client + AIPD probable.
4. **M1** — aucun en-tête de sécurité : ni `next.config.js`, ni `vercel.json`.
5. **M3** — `submit_company_request` / `submit_supervisor_request` sans
   limitation de débit ; la seconde distingue « code magasin introuvable » d'un
   succès, ce qui en fait un oracle d'énumération des codes.
6. **M4 / M5 / M6** — pas de journal des actions d'administration, pas de
   registre des traitements ni de DPA formalisés, droits d'accès et de
   portabilité non outillés, pas de procédure de violation (72 h).

## Points conformes à préserver

Aucun traceur ni mesure d'audience — **aucun bandeau cookies n'est requis**, ne
pas en ajouter par réflexe. Polices Google auto-hébergées par `next/font` (pas
d'appel à Google au chargement). Données en `eu-west-1`. Aucun secret versionné.
La suppression de compte anonymise les comptages au lieu de les détruire.

# Passes de comptage

`advance_pass` / `revert_pass` ne sont plus exécutables par le rôle
`authenticated` (migration `20260813000002`) : SECURITY DEFINER, elles forçaient
`status = 'counting'` et permettaient à un simple compteur de rouvrir un
inventaire clôturé. `current_pass` n'est plus lu nulle part — la passe se déduit
du mode choisi par chaque participant (Comptage→1, Audit→2). Si les passes
globales reviennent, il faudra rendre le GRANT **et** ajouter la garde
`status <> 'closed'` dans les deux fonctions.
