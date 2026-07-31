-- Zones/balises : nom de zone + statut séparé compte vs audit, et RPC associées.
-- NB: la table `zones` et les RPC generate_zones/ensure_zone/set_zone_status/get_zone_progress
-- préexistaient en base (appliquées hors-repo). Cette migration les étend.
-- Appliquée en base live via l'outil MCP apply_migration (le dossier migrations diverge de la base).

alter table public.zones
  add column if not exists name text,
  add column if not exists count_status text not null default 'pending',
  add column if not exists audit_status text not null default 'pending',
  add column if not exists count_done_at timestamptz,
  add column if not exists audit_done_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'zones_count_status_check') then
    alter table public.zones add constraint zones_count_status_check
      check (count_status in ('pending','open','done'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'zones_audit_status_check') then
    alter table public.zones add constraint zones_audit_status_check
      check (audit_status in ('pending','open','done'));
  end if;
end $$;

-- Définit une plage de balises rattachées à une zone nommée (ex. « réserve Beauté » 12341→12349).
-- Superviseur-owner uniquement. Upsert par code (renomme si la balise existe déjà).
create or replace function public.define_zone(
  p_session_id uuid, p_name text, p_code_start int, p_code_end int)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_created int; v_name text;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if not exists (select 1 from public.inventory_sessions
                 where id = p_session_id and created_by = auth.uid()) then
    return json_build_object('success', false, 'error', 'Session introuvable');
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
end; $$;

-- Supprime toutes les balises d'une zone nommée (avant clôture de session).
create or replace function public.delete_zone(p_session_id uuid, p_name text)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_deleted int;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if not exists (select 1 from public.inventory_sessions
                 where id = p_session_id and created_by = auth.uid()) then
    return json_build_object('success', false, 'error', 'Session introuvable');
  end if;
  with del as (
    delete from public.zones where session_id = p_session_id and name = p_name returning 1
  )
  select count(*) into v_deleted from del;
  return json_build_object('success', true, 'deleted', v_deleted);
end; $$;

-- Cœur du scan balise : ouvre (open) ou clôture (done) une balise pour un mode donné.
-- Piloté par l'intention explicite du client (p_open) : scan = ouvrir, rescan = clôturer.
-- Robuste au redémarrage de l'app (idempotent). Une balise non définie est refusée.
-- Autorisé au superviseur de la compagnie OU à un membre de la session.
create or replace function public.set_balise(
  p_session_id uuid, p_code text, p_mode text, p_open boolean)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_digits text; v_code text; v_id uuid; v_name text; v_new text;
begin
  if p_mode not in ('count','audit') then
    return json_build_object('success', false, 'error', 'Mode invalide');
  end if;
  if not (
    (get_my_role() = 'supervisor'
       and exists (select 1 from public.inventory_sessions s
                   where s.id = p_session_id and s.company_id = get_my_company()))
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  v_digits := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if v_digits = '' then
    return json_build_object('success', false, 'error', 'Balise invalide');
  end if;
  v_code := (v_digits)::bigint::text; -- normalise les zéros de tête
  select z.id, z.name into v_id, v_name
  from public.zones z
  where z.session_id = p_session_id and z.code = v_code;
  if not found then
    return json_build_object('success', false, 'error', 'Balise non définie');
  end if;
  v_new := case when p_open then 'open' else 'done' end;
  if p_mode = 'count' then
    update public.zones
      set count_status = v_new,
          count_done_at = case when p_open then null else now() end
      where id = v_id;
  else
    update public.zones
      set audit_status = v_new,
          audit_done_at = case when p_open then null else now() end
      where id = v_id;
  end if;
  return json_build_object('success', true, 'code', v_code, 'name', v_name,
                           'mode', p_mode, 'status', v_new);
end; $$;

-- Dashboard d'avancement : par balise, statut compte/audit + unités & lignes comptées / auditées.
create or replace function public.get_zone_dashboard(p_session_id uuid)
returns table(
  id uuid, code text, name text, count_status text, audit_status text,
  count_units numeric, count_lines bigint, audit_units numeric, audit_lines bigint)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (
    (get_my_role() = 'supervisor'
       and exists (select 1 from public.inventory_sessions s
                   where s.id = p_session_id and s.company_id = get_my_company()))
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
end; $$;
