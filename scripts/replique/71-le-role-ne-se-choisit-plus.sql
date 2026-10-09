-- ⚠️ LE RÔLE DANS UN INVENTAIRE SE CALCULE (9 octobre 2026).
--
-- Julien : « un compteur ne peut pas être superviseur […] ajouter un compteur =
-- compteur, ajouter un superviseur = co-superviseur, ajouter l'admin =
-- co-superviseur. »
--
-- ⚠️ CE QUE CE BANC PROUVE, ET QUI EST LE POINT : **on envoie EXPRÈS le mauvais
-- rôle à chaque fois.** Si la base se contentait d'enregistrer ce qu'on lui
-- donne — ce que faisait `invite-to-session` — toutes ces lignes diraient le
-- rôle envoyé. Elles disent le rôle calculé.
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.dire(p text, p_sql text) returns text
language plpgsql as $$
declare n text;
begin execute p_sql into n; return rpad(p, 56) || ' : ' || coalesce(n, 'null');
exception when others then return rpad(p, 56) || ' : REFUSÉ (' || substr(sqlerrm, 1, 45) || ')'; end $$;

create or replace function pg_temp.role_dans(p_user uuid) returns text language sql as $$
  select sm.role from public.session_members sm
    join public.inventory_sessions s on s.id = sm.session_id
   where sm.user_id = p_user and s.name = 'Inventaire du banc' limit 1 $$;

begin;
  -- Une entreprise, un magasin, et trois profils : un admin, un superviseur,
  -- un compteur. Les rôles d'ENTREPRISE sont la seule vérité.
  insert into public.companies (id, name, join_code)
    values ('00000000-0000-0000-0000-000000710001', 'Banc des rôles', 'BANCRL');
  insert into public.stores (id, company_id, name, join_code)
    values ('00000000-0000-0000-0000-000000710002',
            '00000000-0000-0000-0000-000000710001', 'Magasin du banc', 'BANCMG');

  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-000000710011', 'admin@banc.fr'),
    ('00000000-0000-0000-0000-000000710012', 'superviseur@banc.fr'),
    ('00000000-0000-0000-0000-000000710013', 'compteur@banc.fr');
  insert into public.profiles (id, company_id, role, is_company_admin, first_name) values
    ('00000000-0000-0000-0000-000000710011', '00000000-0000-0000-0000-000000710001',
     'supervisor', true,  'Awa'),
    ('00000000-0000-0000-0000-000000710012', '00000000-0000-0000-0000-000000710001',
     'supervisor', false, 'Bruno'),
    ('00000000-0000-0000-0000-000000710013', '00000000-0000-0000-0000-000000710001',
     'employee',   false, 'Chloé');

  select pg_temp.dire('── La règle, lue seule ──', $q$select ''$q$);
  select pg_temp.dire('ADMIN D''ENTREPRISE',
    $q$select public.role_de_session('00000000-0000-0000-0000-000000710011')$q$);
  select pg_temp.dire('SUPERVISEUR',
    $q$select public.role_de_session('00000000-0000-0000-0000-000000710012')$q$);
  select pg_temp.dire('COMPTEUR',
    $q$select public.role_de_session('00000000-0000-0000-0000-000000710013')$q$);
  select pg_temp.dire('QUELQU''UN SANS PROFIL',
    $q$select coalesce(public.role_de_session('00000000-0000-0000-0000-0000007100ff'), 'null')$q$);

  -- ⚠️ LE CRÉATEUR : `create_session` insère sans rôle, et le défaut de la
  -- colonne est `counter`. Avant le 9 octobre, le superviseur qui créait son
  -- inventaire y était enregistré COMPTEUR.
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000710012', true);
  select pg_temp.dire('── Le créateur de l''inventaire ──', $q$select ''$q$);
  select pg_temp.dire('CRÉATION par un superviseur',
    $q$select public.create_session('Inventaire du banc',
        '00000000-0000-0000-0000-000000710002', '246810', true) ->> 'success'$q$);
  reset role;
  select pg_temp.dire('— son rôle dans l''inventaire qu''il vient de créer',
    $q$select pg_temp.role_dans('00000000-0000-0000-0000-000000710012')$q$);

  select pg_temp.dire('── On envoie EXPRÈS le mauvais rôle ──', $q$select ''$q$);
  -- Ce que faisait la fonction edge : un `upsert` avec le rôle du client.
  insert into public.session_members (session_id, user_id, role)
    select s.id, '00000000-0000-0000-0000-000000710013', 'supervisor'
      from public.inventory_sessions s where s.name = 'Inventaire du banc';
  select pg_temp.dire('COMPTEUR ajouté en demandant « supervisor »',
    $q$select pg_temp.role_dans('00000000-0000-0000-0000-000000710013')$q$);

  insert into public.session_members (session_id, user_id, role)
    select s.id, '00000000-0000-0000-0000-000000710011', 'counter'
      from public.inventory_sessions s where s.name = 'Inventaire du banc';
  select pg_temp.dire('ADMIN ajouté en demandant « counter »',
    $q$select pg_temp.role_dans('00000000-0000-0000-0000-000000710011')$q$);

  select pg_temp.dire('── Et par la mise à jour, l''autre porte ──', $q$select ''$q$);
  update public.session_members set role = 'supervisor'
   where user_id = '00000000-0000-0000-0000-000000710013';
  select pg_temp.dire('COMPTEUR promu par un UPDATE direct',
    $q$select pg_temp.role_dans('00000000-0000-0000-0000-000000710013')$q$);

  -- L'`upsert` de `invite-to-session` : `on conflict do update`.
  insert into public.session_members (session_id, user_id, role)
    select s.id, '00000000-0000-0000-0000-000000710013', 'supervisor'
      from public.inventory_sessions s where s.name = 'Inventaire du banc'
    on conflict (session_id, user_id) do update set role = excluded.role;
  select pg_temp.dire('— et par un upsert, comme la fonction edge',
    $q$select pg_temp.role_dans('00000000-0000-0000-0000-000000710013')$q$);

  select pg_temp.dire('── Une promotion d''entreprise suit ──', $q$select ''$q$);
  select pg_temp.dire('AVANT — Chloé dans l''inventaire',
    $q$select pg_temp.role_dans('00000000-0000-0000-0000-000000710013')$q$);
  -- ⚠️ CE DERNIER BLOC SORT DU SOCLE DE LA RÉPLIQUE, et il le DIT au lieu de
  -- tuer le scénario : `ca_set_user_role` a besoin de `store_team`,
  -- `store_supervisors` et `log_company_action`, que le sous-ensemble du
  -- 20 septembre ne contient pas. Chaque appel est donc enveloppé — une
  -- exception attrapée dans `pg_temp.dire` ouvre une sous-transaction, donc la
  -- transaction qui l'entoure survit, et les lignes au-dessus restent lues.
  --
  -- ⚠️ La propagation est éprouvée AILLEURS, sur le jumeau, qui porte tout le
  -- schéma : voir la fiche du chantier. Un banc qui ne peut pas mesurer quelque
  -- chose doit le dire, pas l'omettre.
  select pg_temp.dire('— rattacher Chloé au magasin (hors socle)',
    $q$insert into public.store_team (store_id, user_id)
       values ('00000000-0000-0000-0000-000000710002', '00000000-0000-0000-0000-000000710013')
       on conflict do nothing returning 'fait'$q$);
  select pg_temp.dire('PROMOTION de Chloé en superviseur (hors socle)',
    $q$select public.ca_set_user_role('00000000-0000-0000-0000-000000710013',
        'supervisor', null) ->> 'success'$q$);
  select pg_temp.dire('APRÈS — son rôle dans l''inventaire a-t-il suivi ?',
    $q$select pg_temp.role_dans('00000000-0000-0000-0000-000000710013')$q$);
rollback;
