# ⚠️ Le lien d'un e-mail ne se grille plus avant le clic (5 octobre 2026)

## Le constat

Julien crée le compte de Julia (samaritaine.com). Elle clique sur l'invitation :
« Lien expiré ». Puis deux « mot de passe oublié » de suite : « Lien expiré ».

## La cause, lue dans les journaux d'authentification de la production

Pour chacun des trois liens, dans l'ordre :

1. `POST /admin/generate_link` (la fonction edge) ;
2. ~16 s après, `HEAD /verify` depuis `104.47.x.x` (Exchange Online), puis
   `GET /verify` depuis `4.251.x.x` (Microsoft) → 303, **le jeton est consommé**
   (`user_signedup` puis `login` au nom de Julia) ;
3. le clic de Julia (`176.191.66.243`) → `403: Email link is invalid or has
   expired`, `One-time token not found`.

C'est l'analyse des liens de Microsoft 365 (Safe Links) : elle ouvre chaque
lien d'un e-mail avant son destinataire. Nos e-mails portaient `action_link`,
qui mène droit à `/verify` et consomme un jeton à usage unique. Tous les
clients d'entreprise sous Microsoft 365 sont touchés, pas seulement Julia.
Deux autres adresses (AWS, `98.85.2.42`, `34.236.226.121`) ont aussi ouvert
les liens : origine non identifiée.

## Le correctif

- `supabase/functions/_shared/lienDuCourriel.ts` : le bouton de l'e-mail mène à
  NOTRE page (`/bienvenue` ou `/reinitialisation`) avec `token_hash` et `type`,
  tirés de `generateLink` (on ne fabrique toujours aucun jeton).
- `web/lib/jetonDuLien.ts` : la page ne présente le jeton à Supabase
  (`verifyOtp`) qu'au clic sur « Continuer ». Un robot charge la page, ne
  clique pas, le jeton reste valable.
- Cinq fonctions concernées : `mot-de-passe-oublie`, `invite-teammate`,
  `invite-company-admin`, `ca-invite-supervisor`, `stripe-webhook`.
- Les anciens liens (session dans `#access_token=…`) restent lus comme avant.
- Garde : `web/tests/lien-du-courriel.test.ts` (déduit la liste des fonctions
  qui appellent `generateLink` ; sabotée pour vérifier qu'elle mord).

## Ce qui reste hors du correctif

- Le repli `inviteUserByEmail` / `resetPasswordForEmail` (Resend absent ou
  fonction injoignable) envoie encore le modèle Supabase, donc un lien
  `/verify` : il se grillerait de la même façon.
- Julia : il faut lui renvoyer un lien une fois les fonctions déployées.
