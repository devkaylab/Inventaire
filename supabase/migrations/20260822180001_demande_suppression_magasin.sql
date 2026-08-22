-- Demander la suppression d'un magasin (22 août 2026, demande de Julien).
--
-- Symétrique de la demande d'ajout, et pour la même raison : **la licence se
-- facture par magasin**, donc Quantinvo reste seul à créer et à supprimer. Un
-- client qui ferme un magasin le signale, il ne l'efface pas.
--
-- Même table que les demandes d'ajout : une seule boîte de réception, une seule
-- purge, un seul écran côté console. C'est la colonne `kind` qui les distingue.

alter table public.store_requests
  add column if not exists kind text not null default 'add';

alter table public.store_requests drop constraint if exists store_requests_kind_check;
alter table public.store_requests
  add constraint store_requests_kind_check check (kind in ('add', 'remove'));

-- Une suppression honorée ne se dit pas « créée ».
alter table public.store_requests drop constraint if exists store_requests_status_check;
alter table public.store_requests
  add constraint store_requests_status_check
  check (status in ('pending', 'created', 'removed', 'rejected'));

comment on column public.store_requests.kind is
  'add = ajout d''un magasin, remove = suppression d''un magasin existant.';

-- ── Le piège trouvé en écrivant ───────────────────────────────────────────
--
-- `admin_delete_store` ne faisait qu'un `delete from stores`. Or
-- `inventory_sessions.store_id` référence `stores` en NO ACTION : **la
-- suppression échouait dès que le magasin avait connu un inventaire**, sur une
-- violation de contrainte affichée telle quelle dans la console. Le bouton
-- « Supprimer » de la fiche entreprise était donc cassé pour tout magasin ayant
-- servi — et une demande de suppression impossible à honorer aurait été pire.
--
-- Supprimer un magasin, c'est supprimer ses inventaires : on le fait
-- explicitement, comme `admin_delete_company` le fait déjà pour une entreprise,
-- et l'écran le dit avant de demander confirmation.
create or replace function public.admin_delete_store(p_store_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_name text; v_company text; v_sessions int;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select s.name, c.name into v_name, v_company
    from public.stores s left join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  if v_name is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable');
  end if;

  -- Les enfants d'un inventaire (comptages, zones, audits, membres, stock
  -- théorique, référentiel) partent en cascade depuis `inventory_sessions`.
  delete from public.inventory_sessions where store_id = p_store_id;
  get diagnostics v_sessions = row_count;

  delete from public.stores where id = p_store_id;
  perform public.log_admin_action('magasin_supprime', 'magasin', p_store_id::text, coalesce(v_name, ''),
    json_build_object('entreprise', coalesce(v_company, ''), 'inventaires', v_sessions)::jsonb);
  return json_build_object('success', true, 'sessions_supprimees', v_sessions);
end;
$$;

-- ── Côté entreprise : la demande ──────────────────────────────────────────

create or replace function public.ca_request_store_removal(p_store_id uuid, p_message text default '')
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company uuid;
  v_name    text;
  v_msg     text := left(btrim(coalesce(p_message, '')), 500);
  v_label   text;
  v_id      uuid;
begin
  -- La garde porte sur l'entreprise **du magasin visé**, jamais sur un
  -- paramètre fourni par l'appelant.
  select s.company_id, s.name into v_company, v_name
    from public.stores s where s.id = p_store_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable.');
  end if;
  if not public.is_company_admin(v_company) then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;

  if exists (select 1 from public.store_requests r
              where r.store_id = p_store_id and r.kind = 'remove' and r.status = 'pending') then
    return json_build_object('success', false, 'error', 'Une demande de suppression est déjà en cours pour ce magasin.');
  end if;

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  -- Le nom est figé dans la demande : le magasin, lui, aura disparu quand on
  -- relira cette ligne.
  insert into public.store_requests
    (company_id, store_id, store_name, message, kind, requested_by, requested_label)
  values
    (v_company, p_store_id, v_name, v_msg, 'remove', auth.uid(), coalesce(v_label, ''))
  returning id into v_id;

  perform public.log_company_action(v_company, 'magasin_suppression_demandee', v_name,
    json_build_object('message', v_msg)::jsonb);

  return json_build_object('success', true, 'id', v_id::text, 'store_name', v_name);
end;
$$;

-- ── Côté Quantinvo : honorer la demande ───────────────────────────────────

create or replace function public.admin_fulfil_store_removal(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_req public.store_requests%rowtype; v_res json;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.kind <> 'remove' then
    return json_build_object('success', false, 'error', 'Cette demande n''est pas une suppression.');
  end if;
  if v_req.status <> 'pending' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;
  if v_req.store_id is null then
    return json_build_object('success', false, 'error', 'Ce magasin n''existe plus.');
  end if;

  -- Un seul chemin de suppression, comme pour la création : deux chemins
  -- divergeraient, et celui-ci porte déjà la trace au journal.
  v_res := public.admin_delete_store(v_req.store_id);
  if not coalesce((v_res ->> 'success')::boolean, false) then
    return v_res;
  end if;

  update public.store_requests
     set status = 'removed', handled_at = now()
   where id = p_id;

  perform public.log_admin_action('demande_magasin_supprimee', 'entreprise', v_req.company_id::text,
    v_req.store_name, json_build_object('inventaires', v_res -> 'sessions_supprimees')::jsonb);

  return v_res;
end;
$$;

-- ── Les deux listes transportent le genre de la demande ───────────────────

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
             'kind', r.kind,
             'store_id', r.store_id,
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
             'kind', r.kind,
             'store_id', r.store_id,
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

revoke all on function public.ca_request_store_removal(uuid, text) from public, anon;
revoke all on function public.admin_fulfil_store_removal(uuid) from public, anon;
revoke all on function public.ca_list_store_requests() from public, anon;
revoke all on function public.admin_list_store_requests() from public, anon;
grant execute on function public.ca_request_store_removal(uuid, text) to authenticated, service_role;
grant execute on function public.admin_fulfil_store_removal(uuid) to authenticated, service_role;
grant execute on function public.ca_list_store_requests() to authenticated, service_role;
grant execute on function public.admin_list_store_requests() to authenticated, service_role;
