-- A6 : RPC admin pour gérer les affectations superviseur ↔ magasin.
-- SECURITY DEFINER + garde is_admin() (l'admin n'est pas soumis au RLS entreprise).

-- Superviseurs d'une entreprise (pour le sélecteur d'affectation).
create or replace function public.admin_list_company_members(p_company_id uuid)
returns table(id uuid, full_name text, role text)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select p.id, p.full_name, p.role
  from public.profiles p
  where p.company_id = p_company_id and p.role = 'supervisor'
  order by p.full_name;
end; $function$;

-- Affectations existantes pour tous les magasins d'une entreprise.
create or replace function public.admin_list_store_supervisors(p_company_id uuid)
returns table(store_id uuid, user_id uuid)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select ss.store_id, ss.user_id
  from public.store_supervisors ss
  join public.stores st on st.id = ss.store_id
  where st.company_id = p_company_id;
end; $function$;

-- Affecter un superviseur à un magasin.
create or replace function public.admin_assign_supervisor(p_store_id uuid, p_user_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_company uuid;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select company_id into v_company from public.stores where id = p_store_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable');
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = p_user_id and p.company_id = v_company and p.role = 'supervisor') then
    return json_build_object('success', false, 'error', 'Superviseur invalide pour cette entreprise');
  end if;
  insert into public.store_supervisors (store_id, user_id)
  values (p_store_id, p_user_id)
  on conflict (store_id, user_id) do nothing;
  return json_build_object('success', true);
end; $function$;

-- Retirer un superviseur d'un magasin.
create or replace function public.admin_unassign_supervisor(p_store_id uuid, p_user_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  delete from public.store_supervisors where store_id = p_store_id and user_id = p_user_id;
  return json_build_object('success', true);
end; $function$;
