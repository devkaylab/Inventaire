-- A5 : resserrer les RPC SECURITY DEFINER — remplacer le garde « superviseur de
-- l'entreprise » par can_access_session() (superviseur affecté au magasin de la
-- session). Les branches « membre de session » (employés) sont conservées.

-- get_zone_dashboard : superviseur affecté OU membre.
create or replace function public.get_zone_dashboard(p_session_id uuid)
returns table(id uuid, code text, name text, count_status text, audit_status text, count_units numeric, count_lines bigint, audit_units numeric, audit_lines bigint)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    raise exception 'forbidden';
  end if;
  return query
  select z.id, z.code, z.name, z.count_status, z.audit_status,
         coalesce(sum(c.qty) filter (where c.pass_number = 1), 0)::numeric,
         count(distinct c.sku) filter (where c.pass_number = 1),
         coalesce(sum(c.qty) filter (where c.pass_number = 2), 0)::numeric,
         count(distinct c.sku) filter (where c.pass_number = 2)
  from public.zones z
  left join public.counts c
    on c.session_id = z.session_id and c.zone = z.code
  where z.session_id = p_session_id
  group by z.id, z.code, z.name, z.count_status, z.audit_status
  order by nullif(regexp_replace(z.code, '\D', '', 'g'), '')::bigint nulls last, z.code;
end; $function$;

-- get_session_results
create or replace function public.get_session_results(p_session_id uuid)
returns table(sku text, ean text, brand text, label text, unit_purchase_price numeric, theoretical_qty numeric, counted_qty numeric, status text, variance_units numeric, variance_value numeric)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  select
    a.sku,
    max(art.ean)::text,
    coalesce(max(art.brand), '')::text,
    coalesce(max(art.label), '')::text,
    coalesce(max(art.unit_purchase_price), 0)::numeric,
    coalesce(max(ts.theoretical_qty), 0)::numeric,
    sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric,
    case when bool_or(a.status = 'failed') then 'failed'
         when bool_or(a.status = 'pending') then 'pending'
         when bool_or(a.status = 'resolved') then 'resolved'
         else 'validated' end,
    (sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)) - coalesce(max(ts.theoretical_qty), 0))::numeric,
    ((sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)) - coalesce(max(ts.theoretical_qty), 0))
      * coalesce(max(art.unit_purchase_price), 0))::numeric
  from public.article_audit a
  left join public.articles art on art.sku = a.sku and art.session_id = a.session_id
  left join public.theoretical_stock ts on ts.session_id = a.session_id and ts.sku = a.sku
  where a.session_id = p_session_id
  group by a.sku
  order by a.sku;
end; $function$;

-- get_session_detail
create or replace function public.get_session_detail(p_session_id uuid)
returns table(sku text, ean text, brand text, label text, zone text, zone_name text, counted_qty numeric, counted_by text, audited boolean, audited_qty numeric, audited_by text)
language plpgsql stable security definer set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with c as (
    select c.sku as sku, coalesce(c.zone, '') as zone, c.pass_number as pass_number,
           sum(c.qty) as qty,
           string_agg(distinct p.full_name, ', ') as who
    from public.counts c
    left join public.profiles p on p.id = c.counted_by
    where c.session_id = p_session_id
    group by c.sku, coalesce(c.zone, ''), c.pass_number
  ),
  cnt as (select c.sku as sku, c.zone as zone, c.qty as qty, c.who as who from c where c.pass_number = 1),
  aud as (select c.sku as sku, c.zone as zone, c.qty as qty, c.who as who, true as present from c where c.pass_number = 2)
  select cnt.sku, a.ean, a.brand, a.label,
         nullif(cnt.zone, '') as zone,
         z.name as zone_name,
         cnt.qty::numeric as counted_qty,
         cnt.who as counted_by,
         coalesce(aud.present, false) as audited,
         coalesce(aud.qty, 0)::numeric as audited_qty,
         aud.who as audited_by
  from cnt
  left join aud on aud.sku = cnt.sku and aud.zone = cnt.zone
  left join public.articles a on a.session_id = p_session_id and a.sku = cnt.sku
  left join public.zones z on z.session_id = p_session_id and z.code = nullif(cnt.zone, '')
  where cnt.qty <> 0
  order by z.name nulls last, nullif(cnt.zone, ''), a.label, cnt.sku;
end; $function$;

-- recompute_session_audit
create or replace function public.recompute_session_audit(p_session_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v_failed int; v_pending int; v_total int;
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  with agg as (
    select sku, coalesce(zone, '') as zone,
      sum(qty) filter (where pass_number = 1) as q1,
      sum(qty) filter (where pass_number = 2) as q2,
      sum(qty) filter (where pass_number = 3) as q3
    from public.counts
    where session_id = p_session_id
    group by sku, coalesce(zone, '')
  )
  insert into public.article_audit (session_id, zone, sku, qty_pass1, qty_pass2, qty_pass3, status, final_qty, updated_at)
  select p_session_id, agg.zone, agg.sku, agg.q1, agg.q2, agg.q3,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then 'validated'
         when agg.q1 is not null and agg.q2 is not null and agg.q1 <> agg.q2 then 'failed'
         else 'pending' end,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then agg.q1 else null end,
    now()
  from agg
  on conflict (session_id, zone, sku) do update set
    qty_pass1 = excluded.qty_pass1,
    qty_pass2 = excluded.qty_pass2,
    qty_pass3 = excluded.qty_pass3,
    status    = case when public.article_audit.status = 'resolved' then 'resolved' else excluded.status end,
    final_qty = case when public.article_audit.status = 'resolved' then public.article_audit.final_qty else excluded.final_qty end,
    updated_at = now();

  delete from public.article_audit a
   where a.session_id = p_session_id
     and not exists (
       select 1 from public.counts c
       where c.session_id = a.session_id and c.sku = a.sku and coalesce(c.zone, '') = a.zone
     );

  select count(*) filter (where status = 'failed'),
         count(*) filter (where status = 'pending'),
         count(*)
    into v_failed, v_pending, v_total
    from public.article_audit where session_id = p_session_id;
  return jsonb_build_object('success', true, 'failed', v_failed, 'pending', v_pending, 'total', v_total);
end; $function$;

-- resolve_audit
create or replace function public.resolve_audit(p_session_id uuid, p_sku text, p_final_qty numeric, p_zone text default ''::text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  if p_final_qty is null or p_final_qty < 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_qty');
  end if;
  update public.article_audit
    set final_qty = p_final_qty, status = 'resolved', resolved_by = auth.uid(), updated_at = now()
    where session_id = p_session_id and sku = p_sku and zone = coalesce(p_zone, '');
  if not found then return jsonb_build_object('success', false, 'error', 'not_found'); end if;
  return jsonb_build_object('success', true);
end; $function$;

-- delete_audit_line
create or replace function public.delete_audit_line(p_session_id uuid, p_sku text, p_zone text default ''::text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  delete from public.counts
    where session_id = p_session_id and sku = p_sku and coalesce(zone, '') = coalesce(p_zone, '');
  delete from public.article_audit
    where session_id = p_session_id and sku = p_sku and zone = coalesce(p_zone, '');
  return jsonb_build_object('success', true);
end; $function$;

-- delete_session
create or replace function public.delete_session(p_session_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  delete from public.zones             where session_id = p_session_id;
  delete from public.counts            where session_id = p_session_id;
  delete from public.theoretical_stock where session_id = p_session_id;
  delete from public.article_audit     where session_id = p_session_id;
  delete from public.articles          where session_id = p_session_id;
  delete from public.session_members   where session_id = p_session_id;
  delete from public.inventory_sessions where id = p_session_id;
  return json_build_object('success', true);
end; $function$;

-- define_zone : tout superviseur affecté (plus seulement le créateur).
create or replace function public.define_zone(p_session_id uuid, p_name text, p_code_start integer, p_code_end integer)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_created int; v_name text;
begin
  if not public.can_access_session(p_session_id) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    return json_build_object('success', false, 'error', 'Nom de zone requis');
  end if;
  if p_code_start is null or p_code_end is null or p_code_start < 0 or p_code_start > p_code_end then
    return json_build_object('success', false, 'error', 'Plage invalide');
  end if;
  if (p_code_end - p_code_start + 1) > 2000 then
    return json_build_object('success', false, 'error', 'Plage trop grande (max 2000 balises)');
  end if;
  with ins as (
    insert into public.zones (session_id, code, name)
    select p_session_id, g::text, v_name
    from generate_series(p_code_start, p_code_end) as g
    on conflict (session_id, code) do update set name = excluded.name
    returning 1
  )
  select count(*) into v_created from ins;
  return json_build_object('success', true, 'created', v_created, 'name', v_name);
end; $function$;

-- delete_zone
create or replace function public.delete_zone(p_session_id uuid, p_name text)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_deleted int;
begin
  if not public.can_access_session(p_session_id) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  with del as (
    delete from public.zones where session_id = p_session_id and name = p_name returning 1
  )
  select count(*) into v_deleted from del;
  return json_build_object('success', true, 'deleted', v_deleted);
end; $function$;

-- set_balise : superviseur affecté OU membre.
create or replace function public.set_balise(p_session_id uuid, p_code text, p_mode text, p_open boolean, p_allow_create boolean default false)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_key text; v_id uuid; v_name text; v_code text; v_new text;
begin
  if p_mode not in ('count','audit') then
    return json_build_object('success', false, 'error', 'Mode invalide');
  end if;
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  v_key := public.norm_balise(p_code);
  if v_key = '' then
    return json_build_object('success', false, 'error', 'Balise invalide');
  end if;
  select z.id, z.name, z.code into v_id, v_name, v_code
  from public.zones z
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;
  if not found then
    if p_open and p_allow_create then
      insert into public.zones (session_id, code) values (p_session_id, btrim(p_code))
        returning id, name, code into v_id, v_name, v_code;
    else
      return json_build_object('success', false, 'error', 'Balise non définie');
    end if;
  end if;
  v_new := case when p_open then 'open' else 'done' end;
  if p_mode = 'count' then
    update public.zones set count_status = v_new,
        count_done_at = case when p_open then null else now() end where id = v_id;
  else
    update public.zones set audit_status = v_new,
        audit_done_at = case when p_open then null else now() end where id = v_id;
  end if;
  return json_build_object('success', true, 'code', v_code, 'name', v_name,
                           'mode', p_mode, 'status', v_new);
end; $function$;

-- advance_pass : créateur, membre, OU superviseur affecté.
create or replace function public.advance_pass(p_session_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_current int; v_allowed boolean;
begin
  select current_pass into v_current from public.inventory_sessions where id = p_session_id;
  if not found then
    return json_build_object('success', false, 'error', 'Session introuvable');
  end if;
  v_allowed := public.can_access_session(p_session_id)
    or exists (select 1 from public.inventory_sessions s where s.id = p_session_id and s.created_by = auth.uid())
    or exists (select 1 from public.session_members m where m.session_id = p_session_id and m.user_id = auth.uid());
  if not v_allowed then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if v_current >= 3 then
    return json_build_object('success', false, 'error', 'Passe maximale atteinte');
  end if;
  update public.inventory_sessions set current_pass = current_pass + 1, status = 'counting'
    where id = p_session_id;
  return json_build_object('success', true, 'current_pass', v_current + 1);
end; $function$;

-- revert_pass : créateur, membre, OU superviseur affecté.
create or replace function public.revert_pass(p_session_id uuid, p_delete_counts boolean default false)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_current int; v_allowed boolean;
begin
  select current_pass into v_current from public.inventory_sessions where id = p_session_id;
  if not found then
    return json_build_object('success', false, 'error', 'Session introuvable');
  end if;
  v_allowed := public.can_access_session(p_session_id)
    or exists (select 1 from public.inventory_sessions s where s.id = p_session_id and s.created_by = auth.uid())
    or exists (select 1 from public.session_members m where m.session_id = p_session_id and m.user_id = auth.uid());
  if not v_allowed then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if v_current <= 1 then
    return json_build_object('success', false, 'error', 'Déjà en comptage (passe 1)');
  end if;
  if p_delete_counts then
    delete from public.counts where session_id = p_session_id and pass_number = v_current;
  end if;
  update public.inventory_sessions set current_pass = current_pass - 1, status = 'counting'
    where id = p_session_id;
  return json_build_object('success', true, 'current_pass', v_current - 1,
    'deleted_counts', p_delete_counts, 'left_pass', v_current);
end; $function$;

-- get_zone_progress (legacy) : resserré à can_access_session.
create or replace function public.get_zone_progress(p_session_id uuid)
returns table(id uuid, code text, status text, lines bigint, units numeric, counters bigint)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    raise exception 'forbidden';
  end if;
  return query
  select z.id, z.code, z.status,
         count(distinct c.sku) as lines,
         coalesce(sum(c.qty), 0)::numeric as units,
         count(distinct c.counted_by) as counters
  from public.zones z
  left join public.counts c on c.session_id = z.session_id and c.zone = z.code
  where z.session_id = p_session_id
  group by z.id, z.code, z.status
  order by z.code;
end; $function$;
