# Dérive entre la base live et le dossier de migrations

La CLI Supabase n'étant pas installée sur le poste, ce fichier tient lieu de
`db pull` : il fige la définition **live** (relevée le 20 août 2026, projet
`inventaire-smartcount`) des objets créés directement via l'outil MCP, sans
migration dans le dépôt. Toute refonte de ces objets doit partir d'ici, pas
d'une migration hypothétique.

## Table `account_deletion_requests`

```
id         uuid        not null (défaut gen_random_uuid() présumé)
user_id    uuid        not null
email      text
full_name  text
company_id uuid
role       text
status     text        not null (défaut 'pending')
created_at timestamptz not null (défaut now())
```

Purgée à 1 an par `purge_expired_data()`.

## Fonction `request_account_deletion()`

SECURITY DEFINER, `search_path = public, auth`. Refuse sans session, répond
`{success: true, already: true}` si une demande `pending` existe déjà, sinon
insère une ligne avec l'e-mail (depuis `auth.users`), le nom, l'entreprise et
le rôle du demandeur.

## Rappel

Le reste du schéma live est considéré conforme aux migrations du dépôt à la
date ci-dessus. Les migrations `20260820*` (chantier administrateur
d'entreprise) ont été écrites contre les définitions live relevées le même
jour (`handle_new_user`, `profiles_pin_privileged_columns`,
`purge_expired_data`, policies de `team_invitations`).
