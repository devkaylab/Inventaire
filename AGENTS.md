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

`create_company`, `join_company` et `join_store` ne sont plus exécutables par
`authenticated` (migration `20260813000005`) : elles court-circuitaient ce
parcours. Ne pas rendre les GRANT sans réintroduire la validation admin.

Le code magasin reste confidentiel : `join_code` est révoqué en SELECT pour
`anon`/`authenticated` sur `stores` et `companies`. Un compteur ne doit jamais
le voir.

Un inventaire ne se peuple que de profils existants — `invite-to-session`
refuse les e-mails sans compte.

# Passes de comptage

`advance_pass` / `revert_pass` ne sont plus exécutables par le rôle
`authenticated` (migration `20260813000002`) : SECURITY DEFINER, elles forçaient
`status = 'counting'` et permettaient à un simple compteur de rouvrir un
inventaire clôturé. `current_pass` n'est plus lu nulle part — la passe se déduit
du mode choisi par chaque participant (Comptage→1, Audit→2). Si les passes
globales reviennent, il faudra rendre le GRANT **et** ajouter la garde
`status <> 'closed'` dans les deux fonctions.
