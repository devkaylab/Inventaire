# La réplique — rejouer une migration avant de la jouer pour de vrai

```bash
brew install postgresql@17        # une fois
./scripts/replique/verifier.sh    # à chaque migration
```

Le script monte un PostgreSQL local jetable, y pose un sous-ensemble fidèle de
la base, exerce les parcours de Quantinvo OS **sous RLS**, applique les
migrations, refait les mêmes parcours, et montre la différence.

---

## ⚠️ Pourquoi il existe

`scripts/verifier-migrations.py` dit si une migration **compile**. Il ne dit
rien de ce qu'elle **fait**.

Le 20 septembre 2026, une migration On-Demand compilait, et chacune de ses huit
policies avait été relue ligne à ligne contre `pg_policies`. Elle cassait quand
même une chose : un inventoriste affecté à une mission passait toutes les règles
de comptage — il pouvait écrire dans `counts` — mais `prendre_place_appareil` le
refusait, parce que la branche On-Demand de `is_session_participant` ne couvre
que le **responsable**. L'écran de comptage ne se serait pas ouvert, pour un
droit qu'il avait par ailleurs.

**Aucune relecture ne l'a vu. Le premier rejeu l'a vu.**

---

## ⚠️ Ce que ce banc n'est PAS

**Ce n'est pas la production.** C'est un sous-ensemble : les tables, fonctions
et policies que touchent les chantiers en cours, extraites du catalogue de la
base le **20 septembre 2026**.

- une migration qui touche un objet absent d'ici ne sera pas vérifiée ;
- un banc **vert** ne prouve pas que tout va bien — il prouve que les parcours
  écrits dans `20-parcours.sql` n'ont pas changé ;
- un banc **rouge**, lui, est toujours vrai.

Il ne remplace pas la lecture de la migration. Il attrape ce que la lecture ne
voit pas.

---

## Les fichiers

| | |
|---|---|
| `00-socle-supabase.sql` | ce que Supabase fournit : rôles, schéma `auth`, `auth.uid()`, extensions |
| `01-tables.sql` | les tables de Quantinvo OS |
| `02-fonctions.sql` | les fonctions qui gardent les accès (`is_session_participant`, `plafond_appareils`, `prendre_place_appareil`…) |
| `03-policies.sql` | les policies, telles que `pg_policies` les rend |
| `04-vente.sql` | `prix_offre` et `deposer_changement_offre` — le chemin commercial |
| `10-donnees.sql` | une entreprise, un magasin, un admin, un superviseur, deux compteurs, un inventaire, un inventoriste indépendant |
| `20-parcours.sql` | **les parcours d'OS**, exercés sous RLS. C'est le fichier qui fait foi |
| `40-ondemand.sql` | ce que la migration apporte : ouverture et fermeture d'un accès de mission |

**L'impersonation passe par `request.jwt.claim.sub`**, comme dans un vrai
PostgREST : `set local role authenticated` puis `set_config`. C'est ce qui
permet d'exercer la RLS pour de vrai, en devenant tour à tour superviseur,
compteur, administrateur d'entreprise, inventoriste.

---

## Régénérer le sous-ensemble depuis la base réelle

Les trois fichiers de schéma sont des extraits datés. Pour les rafraîchir, ou
pour couvrir une table de plus, jouer ces requêtes sur la base et recopier leur
sortie :

```sql
-- 01-tables.sql
select 'create table public.' || c.table_name || ' (' || string_agg(
    c.column_name || ' ' || c.data_type
    || case when c.column_default is not null then ' default ' || c.column_default else '' end
    || case when c.is_nullable = 'NO' then ' not null' else '' end, ', '
    order by c.ordinal_position) || ');'
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = any (array['…'])
group by c.table_name;

-- 02-fonctions.sql
select string_agg(pg_get_functiondef(p.oid), E';\n\n' order by p.proname) || ';'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = any (array['…']);

-- 03-policies.sql
select string_agg('create policy ' || quote_ident(policyname) || ' on public.' || tablename
  || ' for ' || lower(cmd) || ' to ' || array_to_string(roles, ', ')
  || coalesce(' using (' || qual || ')', '')
  || coalesce(' with check (' || with_check || ')', '') || ';', E'\n' order by tablename, policyname)
from pg_policies where schemaname = 'public' and tablename = any (array['…']);
```

⚠️ **Les clés, index et contraintes ne sortent pas de ces requêtes** :
`01-tables.sql` les porte à la main. Une contrainte oubliée fait passer sur la
réplique quelque chose que la production refuserait — c'est le seul endroit du
banc où une erreur rend le résultat trop optimiste.
