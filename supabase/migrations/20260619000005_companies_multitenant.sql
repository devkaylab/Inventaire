-- Multi-tenant : cloisonnement par entreprise.
-- Avant cette migration, tout superviseur voyait TOUS les inventaires
-- (policies basées uniquement sur get_my_role() = 'supervisor') et tout
-- utilisateur connecté lisait tout le catalogue articles. On introduit une
-- notion d'entreprise (companies) : chaque superviseur ne voit que les données
-- de son entreprise ; deux superviseurs d'une même entreprise partagent.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Schéma
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.companies enable row level security;

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id);

alter table public.inventory_sessions
  add column if not exists company_id uuid references public.companies(id);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Fonctions
-- ─────────────────────────────────────────────────────────────────────────

-- Entreprise de l'utilisateur courant (sœur de get_my_role()).
create or replace function public.get_my_company()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- Génère un code d'entreprise court, unique, lisible (sans 0/O/1/I).
create or replace function public.gen_company_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.companies where join_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Crée une entreprise et rattache le superviseur courant.
create or replace function public.create_company(p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_code text;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if coalesce(trim(p_name), '') = '' then
    return json_build_object('success', false, 'error', 'Nom requis');
  end if;
  v_code := gen_company_code();
  insert into public.companies (name, join_code)
  values (trim(p_name), v_code)
  returning id into v_id;
  update public.profiles set company_id = v_id where id = auth.uid();
  return json_build_object('success', true, 'company_id', v_id::text, 'name', trim(p_name), 'join_code', v_code);
end;
$$;

-- Rattache le superviseur courant à une entreprise existante via son code.
create or replace function public.join_company(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_company companies%rowtype;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_company from public.companies
  where join_code = upper(trim(p_code));
  if not found then
    return json_build_object('success', false, 'error', 'Code entreprise introuvable');
  end if;
  update public.profiles set company_id = v_company.id where id = auth.uid();
  return json_build_object('success', true, 'company_id', v_company.id::text, 'name', v_company.name);
end;
$$;

-- MAJ create_session : rattache la session à l'entreprise du superviseur.
create or replace function public.create_session(p_store_name text, p_security_code text, p_uses_zones boolean default false)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_number text; v_id uuid; v_company uuid;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  v_company := get_my_company();
  if v_company is null then
    return json_build_object('success', false, 'error', 'Aucune entreprise associée');
  end if;
  v_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));
  insert into public.inventory_sessions (inventory_number, security_code_hash, security_code, store_name, created_by, uses_zones, company_id)
  values (v_number, encode(sha256(p_security_code::bytea), 'hex'), p_security_code, p_store_name, auth.uid(), coalesce(p_uses_zones, false), v_company)
  returning id into v_id;
  insert into public.session_members (session_id, user_id) values (v_id, auth.uid());
  return json_build_object(
    'success', true,
    'session_id', v_id::text,
    'inventory_number', v_number,
    'store_name', p_store_name,
    'security_code', p_security_code,
    'uses_zones', coalesce(p_uses_zones, false)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Backfill : entreprise par défaut pour les données existantes.
--    (Le regroupement réel des profils test sera ajusté ensuite.)
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare v_default uuid;
begin
  if exists (select 1 from public.profiles where company_id is null and role = 'supervisor')
     or exists (select 1 from public.inventory_sessions where company_id is null) then
    insert into public.companies (name, join_code)
    values ('Entreprise (à configurer)', gen_company_code())
    returning id into v_default;

    update public.profiles set company_id = v_default
      where company_id is null and role = 'supervisor';

    -- Chaque session hérite de l'entreprise de son créateur.
    update public.inventory_sessions s
      set company_id = coalesce(p.company_id, v_default)
      from public.profiles p
      where p.id = s.created_by and s.company_id is null;
  end if;
end $$;

alter table public.inventory_sessions
  alter column company_id set not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RLS — cloisonnement par entreprise
-- ─────────────────────────────────────────────────────────────────────────

-- companies : un membre voit sa propre entreprise.
drop policy if exists companies_member_select on public.companies;
create policy companies_member_select on public.companies
  for select using (id = get_my_company());

-- profiles : soi-même, OU superviseur de la même entreprise,
-- OU employé membre d'une session de mon entreprise (pour afficher son nom).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or (get_my_role() = 'supervisor' and company_id = get_my_company())
    or (
      get_my_role() = 'supervisor'
      and exists (
        select 1 from public.session_members sm
        join public.inventory_sessions s on s.id = sm.session_id
        where sm.user_id = profiles.id and s.company_id = get_my_company()
      )
    )
  );

-- inventory_sessions : superviseur cloisonné à son entreprise.
drop policy if exists sessions_supervisor_all on public.inventory_sessions;
create policy sessions_supervisor_company on public.inventory_sessions
  for all
  using (get_my_role() = 'supervisor' and company_id = get_my_company())
  with check (get_my_role() = 'supervisor' and company_id = get_my_company());

-- articles : on supprime la lecture globale et l'écriture globale.
drop policy if exists articles_select_auth on public.articles;
drop policy if exists articles_write_supervisor on public.articles;
-- articles_member_read (employé via membership) est conservée.
-- articles_supervisor : scopé sur l'entreprise (au lieu de created_by).
drop policy if exists articles_supervisor on public.articles;
create policy articles_supervisor on public.articles
  for all
  using (
    get_my_role() = 'supervisor'
    and exists (
      select 1 from public.inventory_sessions s
      where s.id = articles.session_id and s.company_id = get_my_company()
    )
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (
      select 1 from public.inventory_sessions s
      where s.id = articles.session_id and s.company_id = get_my_company()
    )
  );

-- theoretical_stock : superviseur cloisonné via la session.
drop policy if exists theoretical_stock_supervisor on public.theoretical_stock;
create policy theoretical_stock_supervisor on public.theoretical_stock
  for all
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = theoretical_stock.session_id and s.company_id = get_my_company())
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = theoretical_stock.session_id and s.company_id = get_my_company())
  );

-- article_audit : superviseur cloisonné via la session.
drop policy if exists audit_supervisor on public.article_audit;
create policy audit_supervisor on public.article_audit
  for all
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = article_audit.session_id and s.company_id = get_my_company())
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = article_audit.session_id and s.company_id = get_my_company())
  );

-- zones : superviseur cloisonné via la session (la policy membre est conservée).
drop policy if exists zones_supervisor_all on public.zones;
create policy zones_supervisor_company on public.zones
  for all
  using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = zones.session_id and s.company_id = get_my_company())
  )
  with check (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = zones.session_id and s.company_id = get_my_company())
  );

-- counts : lecture/suppression superviseur cloisonnées via la session.
-- (counts_insert_member et counts_select_own — employé — sont conservées.)
drop policy if exists counts_select_supervisor on public.counts;
create policy counts_select_supervisor on public.counts
  for select using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = counts.session_id and s.company_id = get_my_company())
  );

drop policy if exists counts_delete_supervisor on public.counts;
create policy counts_delete_supervisor on public.counts
  for delete using (
    get_my_role() = 'supervisor'
    and exists (select 1 from public.inventory_sessions s
                where s.id = counts.session_id and s.company_id = get_my_company())
  );
