# On-Demand a son propre projet Supabase — 4 octobre 2026

**Projet `Quantinvo On-Demand`**, ref `lqgusznqcunjhrqslcug`, région `eu-west-1`
(la même que Quantinvo), organisation Devkaylab. **10 $/mois, permanent.**
⚠️ Le Spend Cap de l'organisation est actif : un dépassement bascule TOUTE
l'organisation en lecture seule, Quantinvo compris.

## ⚠️ Le dossier de migrations ne se rejoue PAS depuis zéro

C'est la découverte de la journée, et elle contredit une idée reçue : « le
dossier décrit la base » (note 067, 0 dérive mesurée) ne veut **pas** dire « le
dossier reconstruit la base ». Les deux se mesurent différemment, et seul le
premier a jamais été vérifié.

Le rejeu des 198 fichiers dans l'ordre des noms **s'arrête au 5ᵉ** :
`20260619000003_articles_ean_norm.sql` crée un index sur
`articles(session_id, ean_norm)` alors que la colonne `session_id` n'arrive que
plus tard dans l'ordre alphabétique. L'ordre des noms n'est pas l'ordre dans
lequel l'histoire s'est écrite.

**À retenir** : pour fabriquer une base jumelle, on **copie le schéma**, on ne
rejoue pas le dossier.

## Comment le jumeau a été fabriqué

```
supabase db dump --linked --dry-run --yes      # rend un script bash
bash ce-script > schema.sql                    # pg_dump --schema-only, 607 Ko
supabase db query --linked --project-ref lqgusznqcunjhrqslcug --file schema.sql
```

- `db dump --linked` **a besoin de Docker**, absent de ce Mac. D'où le
  `--dry-run`, qui imprime le script `pg_dump` que la CLI aurait exécuté : il
  crée un rôle de connexion temporaire, donc **aucun mot de passe à connaître**.
  `pg_dump` 17.11 est installé localement (Homebrew).
- `db query --project-ref` **exige `--linked`** avec lui, sinon la CLI refuse.
  Les deux ensemble visent bien l'autre projet, pas le projet lié.
- ⚠️ Le schéma `public` a dû être **remis à zéro** avant : les 4 migrations du
  rejeu avorté avaient laissé des tables, et le dump utilise
  `create table if not exists` — les tables existantes étaient sautées, et les
  index posés ensuite tombaient sur des colonnes manquantes.

## Mesuré : jumeau exact

Six empreintes `md5` comparées entre les deux bases — **toutes identiques** :

| | production | On-Demand |
|---|---|---|
| colonnes (412) | `9c9483a4…` | `9c9483a4…` |
| fonctions + droits (236) | `71b677d2…` | `71b677d2…` |
| policies (55) | `ca261ff9…` | `ca261ff9…` |
| index (93) | `ff7c5c91…` | `ff7c5c91…` |
| triggers (9) | `6e6215d6…` | `6e6215d6…` |
| contraintes | `e90708ba…` | `e90708ba…` |

44 tables, RLS active sur les 44. `get_advisors(security)` rend **exactement
les mêmes quatre catégories** des deux côtés.

**Une seule différence au premier passage** : `get_zone_dashboard` avait perdu
trois lignes de commentaire, que le `sed` de la CLI retire. Reposée depuis la
définition de production, droits compris (`create or replace` rend EXECUTE à
PUBLIC — voir AGENTS.md).

**Aucune donnée** : 0 entreprise, 0 magasin, 0 profil, 0 compte `auth.users`.
Le dump est `--schema-only`.

## Ce qui N'EST PAS là

- **Les 20 fonctions edge** de production ne sont pas déployées. Le dépôt ne
  déploie rien (AGENTS.md) : il faudra les pousser à la main, avec leurs
  secrets, si un parcours testé en a besoin. La connexion, elle, passe par
  `auth` et n'en dépend pas.
- **Aucun réglage d'authentification** n'a été recopié (gabarits d'e-mail,
  redirections). À faire le jour où un parcours d'invitation sera testé.

## Il reste à brancher l'aperçu

Dans Vercel, **portée Preview uniquement** :

```
NEXT_PUBLIC_SUPABASE_URL      = https://lqgusznqcunjhrqslcug.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_ISjK0RBpXaogcU7fKrtJFw_GfNUbfx1
```

Puis redéployer. Tant que ce n'est pas fait, le garde-fou de la note 108 arrête
l'aperçu au lieu de le laisser écrire en production — c'est voulu.
