-- Les parcours de Quantinvo OS, exercés SOUS RLS, en devenant tour à tour
-- chaque personne. Chaque ligne rend « oui / non » : on compare avant et après.
\set QUIET on
\pset tuples_only on
\pset format unaligned
\pset fieldsep ' | '

create or replace function pg_temp.devenir(p_uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.essayer(p_libelle text, p_sql text) returns text
language plpgsql as $$
declare n integer;
begin
  execute p_sql into n;
  return rpad(p_libelle, 58) || ' : ' || coalesce(n::text, 'null');
exception when others then
  return rpad(p_libelle, 58) || ' : REFUSÉ (' || substr(sqlerrm, 1, 40) || ')';
end $$;

begin;
  select pg_temp.devenir('00000000-0000-0000-0000-0000000000a2');
  select pg_temp.essayer('SUPERVISEUR — voit son inventaire',
    'select count(*) from public.inventory_sessions');
  select pg_temp.essayer('SUPERVISEUR — voit les zones',
    'select count(*) from public.zones');
  select pg_temp.essayer('SUPERVISEUR — voit les membres',
    'select count(*) from public.session_members');
  select pg_temp.essayer('SUPERVISEUR — voit son magasin',
    'select count(*) from public.stores');
  select pg_temp.essayer('SUPERVISEUR — compte (insert counts)',
    $q$with x as (insert into public.counts (session_id, sku, pass_number, counted_by)
        values ('00000000-0000-0000-0000-00000000e001', 'SKU-SUP', 1,
                '00000000-0000-0000-0000-0000000000a2') returning 1) select count(*) from x$q$);
  select pg_temp.essayer('SUPERVISEUR — relit tous les comptages',
    'select count(*) from public.counts');
  select pg_temp.essayer('SUPERVISEUR — crée une zone',
    $q$with x as (insert into public.zones (session_id, code, name)
        values ('00000000-0000-0000-0000-00000000e001', 'Z9', 'Vitrines') returning 1) select count(*) from x$q$);
  select pg_temp.essayer('SUPERVISEUR — prend une place d''appareil',
    $q$select case when (public.prendre_place_appareil(
        '00000000-0000-0000-0000-00000000e001', 'tel-sup') ->> 'accorde')::boolean then 1 else 0 end$q$);
rollback;

begin;
  select pg_temp.devenir('00000000-0000-0000-0000-0000000000a3');
  select pg_temp.essayer('COMPTEUR — voit l''inventaire dans sa liste',
    'select count(*) from public.inventory_sessions');
  select pg_temp.essayer('COMPTEUR — voit les zones',
    'select count(*) from public.zones');
  select pg_temp.essayer('COMPTEUR — compte',
    $q$with x as (insert into public.counts (session_id, sku, pass_number, counted_by)
        values ('00000000-0000-0000-0000-00000000e001', 'SKU-C1', 1,
                '00000000-0000-0000-0000-0000000000a3') returning 1) select count(*) from x$q$);
  select pg_temp.essayer('COMPTEUR — relit ses comptages',
    'select count(*) from public.counts');
  select pg_temp.essayer('COMPTEUR — prend une place d''appareil',
    $q$select case when (public.prendre_place_appareil(
        '00000000-0000-0000-0000-00000000e001', 'tel-c1') ->> 'accorde')::boolean then 1 else 0 end$q$);
rollback;

begin;
  select pg_temp.devenir('00000000-0000-0000-0000-0000000000a4');
  select pg_temp.essayer('AUTRE COMPTEUR (non membre) — ne voit PAS l''inventaire',
    'select count(*) from public.inventory_sessions');
  select pg_temp.essayer('AUTRE COMPTEUR — ne voit PAS les zones',
    'select count(*) from public.zones');
  select pg_temp.essayer('AUTRE COMPTEUR — ne peut PAS compter',
    $q$with x as (insert into public.counts (session_id, sku, pass_number, counted_by)
        values ('00000000-0000-0000-0000-00000000e001', 'SKU-X', 1,
                '00000000-0000-0000-0000-0000000000a4') returning 1) select count(*) from x$q$);
rollback;

begin;
  select pg_temp.devenir('00000000-0000-0000-0000-0000000000a1');
  select pg_temp.essayer('ADMIN ENTREPRISE — voit l''inventaire',
    'select count(*) from public.inventory_sessions');
  select pg_temp.essayer('ADMIN ENTREPRISE — clôture',
    $q$with x as (update public.inventory_sessions set status = 'closed'
        where id = '00000000-0000-0000-0000-00000000e001' returning 1) select count(*) from x$q$);
rollback;

begin;
  select pg_temp.devenir('00000000-0000-0000-0000-0000000000c1');
  select pg_temp.essayer('INVENTORISTE (sans mission) — ne voit RIEN',
    'select count(*) from public.inventory_sessions');
  select pg_temp.essayer('INVENTORISTE — ne voit aucune zone',
    'select count(*) from public.zones');
  select pg_temp.essayer('INVENTORISTE — ne peut PAS compter',
    $q$with x as (insert into public.counts (session_id, sku, pass_number, counted_by)
        values ('00000000-0000-0000-0000-00000000e001', 'SKU-I', 1,
                '00000000-0000-0000-0000-0000000000c1') returning 1) select count(*) from x$q$);
rollback;

begin;
  select pg_temp.devenir('00000000-0000-0000-0000-0000000000a2');
  select pg_temp.essayer('PLAFOND — magasin à 20 appareils',
    $q$select public.plafond_appareils('00000000-0000-0000-0000-00000000c501')$q$);
rollback;
