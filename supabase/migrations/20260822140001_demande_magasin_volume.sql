-- La demande d'ajout de magasin porte le volume (22 août 2026, même jour).
--
-- Julien, capture de /inscription à l'appui : « c'est ça qu'il faut comme
-- formulaire de demande ». Le premier jet ne demandait qu'un nom — or **la
-- licence se tarife au volume de stock** : une demande sans stock est une
-- demande que Quantinvo ne peut pas deviser, donc un aller-retour de plus.
--
-- Le formulaire est désormais exactement celui du parcours d'inscription (même
-- composant : `web/components/MagasinSaisie.tsx`), tranche tarifaire affichée à
-- la frappe comprise.

alter table public.store_requests
  add column if not exists units integer check (units is null or units >= 0),
  add column if not exists sqm   integer check (sqm   is null or sqm   >= 0);

comment on column public.store_requests.units is 'Stock théorique déclaré, en pièces — donne la tranche tarifaire.';
comment on column public.store_requests.sqm   is 'Surface de vente déclarée, en m², réserve comprise.';

-- La signature change : on retire l'ancienne plutôt que de laisser deux
-- versions cohabiter (Postgres les garderait toutes les deux, et un appel à
-- deux arguments deviendrait ambigu).
drop function if exists public.ca_request_store(text, text);

create or replace function public.ca_request_store(
  p_name text, p_message text default '',
  p_units integer default null, p_sqm integer default null)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_name    text := btrim(coalesce(p_name, ''));
  v_msg     text := left(btrim(coalesce(p_message, '')), 500);
  v_label   text;
  v_id      uuid;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  if v_name = '' then
    return json_build_object('success', false, 'error', 'Le nom du magasin est requis.');
  end if;
  if length(v_name) > 80 then
    return json_build_object('success', false, 'error', 'Le nom du magasin est trop long.');
  end if;
  -- Le stock est ce qui permet de deviser : il est exigé, la surface non.
  if p_units is null or p_units <= 0 then
    return json_build_object('success', false, 'error', 'Indiquez le stock théorique du magasin.');
  end if;
  if p_units > 100000000 or coalesce(p_sqm, 0) > 1000000 then
    return json_build_object('success', false, 'error', 'Stock ou surface hors de portée : vérifiez la saisie.');
  end if;
  if exists (select 1 from public.stores s
              where s.company_id = v_company and lower(s.name) = lower(v_name)) then
    return json_build_object('success', false, 'error', 'Un magasin porte déjà ce nom dans votre entreprise.');
  end if;
  if exists (select 1 from public.store_requests r
              where r.company_id = v_company and r.status = 'pending'
                and lower(r.store_name) = lower(v_name)) then
    return json_build_object('success', false, 'error', 'Une demande est déjà en cours pour ce magasin.');
  end if;

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  insert into public.store_requests
    (company_id, store_name, message, units, sqm, requested_by, requested_label)
  values
    (v_company, v_name, v_msg, p_units, nullif(p_sqm, 0), auth.uid(), coalesce(v_label, ''))
  returning id into v_id;

  perform public.log_company_action(v_company, 'magasin_demande', v_name,
    json_build_object('message', v_msg, 'stock', p_units, 'surface', p_sqm)::jsonb);

  return json_build_object('success', true, 'id', v_id::text, 'store_name', v_name);
end;
$$;

create or replace function public.ca_list_store_requests()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id,
             'store_name', r.store_name,
             'message', r.message,
             'units', r.units,
             'sqm', r.sqm,
             'status', r.status,
             'requested_label', r.requested_label,
             'admin_note', r.admin_note,
             'created_at', r.created_at,
             'handled_at', r.handled_at
           ) order by r.created_at desc), '[]'::json)
      from public.store_requests r
     where r.company_id = v_company
       and (r.status = 'pending' or r.handled_at > now() - interval '30 days'));
end;
$$;

create or replace function public.admin_list_store_requests()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;
  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id,
             'company_id', r.company_id,
             'company_name', c.name,
             'store_name', r.store_name,
             'message', r.message,
             'units', r.units,
             'sqm', r.sqm,
             'status', r.status,
             'requested_label', r.requested_label,
             'admin_note', r.admin_note,
             'created_at', r.created_at,
             'handled_at', r.handled_at
           ) order by (r.status = 'pending') desc, r.created_at desc), '[]'::json)
      from public.store_requests r
      join public.companies c on c.id = r.company_id
     where r.status = 'pending' or r.handled_at > now() - interval '90 days');
end;
$$;

-- create or replace ne repose pas les droits d'une fonction supprimée : on les
-- redonne explicitement pour la signature à quatre arguments.
revoke all on function public.ca_request_store(text, text, integer, integer) from public, anon;
revoke all on function public.ca_list_store_requests() from public, anon;
revoke all on function public.admin_list_store_requests() from public, anon;
grant execute on function public.ca_request_store(text, text, integer, integer) to authenticated, service_role;
grant execute on function public.ca_list_store_requests() to authenticated, service_role;
grant execute on function public.admin_list_store_requests() to authenticated, service_role;
