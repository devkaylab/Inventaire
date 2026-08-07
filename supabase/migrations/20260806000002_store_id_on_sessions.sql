-- A1 : lier les inventaires aux magasins par id (jusqu'ici seul store_name existait).

alter table public.inventory_sessions
  add column if not exists store_id uuid references public.stores(id);

-- Auto-créer les magasins manquants à partir des noms déjà utilisés par des sessions,
-- afin qu'aucune session ne reste sans store_id (sinon invisible après resserrement RLS).
insert into public.stores (company_id, name)
select distinct s.company_id, s.store_name
from public.inventory_sessions s
where not exists (
  select 1 from public.stores st
  where st.company_id = s.company_id and st.name = s.store_name
);

-- Backfill des store_id par correspondance (entreprise + nom).
update public.inventory_sessions s
set store_id = st.id
from public.stores st
where st.company_id = s.company_id
  and st.name = s.store_name
  and s.store_id is null;

-- Désormais obligatoire : toute session est rattachée à un magasin.
alter table public.inventory_sessions alter column store_id set not null;

-- Peut accéder à cette session : superviseur, même entreprise, affecté au magasin.
-- (Créée ici car elle référence inventory_sessions.store_id ajouté ci-dessus.)
create or replace function public.can_access_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.get_my_role() = 'supervisor'
     and exists (
       select 1 from public.inventory_sessions s
       where s.id = p_session_id
         and s.company_id = public.get_my_company()
         and public.is_assigned_store(s.store_id)
     );
$$;

-- create_session : persister store_id + exiger l'affectation au magasin.
create or replace function public.create_session(p_name text, p_store_id uuid, p_security_code text, p_uses_zones boolean default false)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_number text; v_id uuid; v_company uuid; v_store_name text;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  v_company := get_my_company();
  if v_company is null then
    return json_build_object('success', false, 'error', 'Aucune entreprise associée');
  end if;
  select name into v_store_name from public.stores where id = p_store_id and company_id = v_company;
  if v_store_name is null then
    return json_build_object('success', false, 'error', 'Magasin invalide');
  end if;
  -- Le superviseur doit être affecté au magasin (ou admin).
  if not public.is_assigned_store(p_store_id) then
    return json_build_object('success', false, 'error', 'Magasin non affecté');
  end if;
  v_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(md5(random()::text) from 1 for 4));
  insert into public.inventory_sessions
    (inventory_number, security_code_hash, security_code, store_name, store_id, name, created_by, uses_zones, company_id)
  values
    (v_number, encode(sha256(p_security_code::bytea), 'hex'), p_security_code, v_store_name, p_store_id,
     coalesce(trim(p_name), ''), auth.uid(), coalesce(p_uses_zones, false), v_company)
  returning id into v_id;
  insert into public.session_members (session_id, user_id) values (v_id, auth.uid());
  return json_build_object('success', true, 'session_id', v_id::text, 'inventory_number', v_number,
    'name', coalesce(trim(p_name), ''), 'store_name', v_store_name, 'security_code', p_security_code,
    'uses_zones', coalesce(p_uses_zones, false));
end; $function$;
