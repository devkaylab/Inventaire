-- Modèle de codes à trois niveaux :
--   entreprise (confidentiel, admin) > magasin (fourni par l'admin au superviseur) >
--   inventaire (partagé par le superviseur aux participants).
-- Ici : code magasin. Chaque magasin a un code unique auto-généré ; le superviseur
-- le saisit pour rejoindre son entreprise + être affecté à ce magasin.

-- Générateur de code magasin (même alphabet que gen_company_code).
create or replace function public.gen_store_code()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.stores where join_code = v_code);
  end loop;
  return v_code;
end; $function$;

-- Colonne code magasin + backfill (un par un pour garantir l'unicité) + NOT NULL.
alter table public.stores add column if not exists join_code text unique;

do $$
declare r record;
begin
  for r in select id from public.stores where join_code is null loop
    update public.stores set join_code = public.gen_store_code() where id = r.id;
  end loop;
end $$;

alter table public.stores alter column join_code set not null;

-- admin_add_store : génère et renvoie le code magasin.
create or replace function public.admin_add_store(p_company_id uuid, p_name text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_id uuid; v_code text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if coalesce(trim(p_name), '') = '' then return json_build_object('success', false, 'error', 'Nom requis'); end if;
  if not exists (select 1 from public.companies where id = p_company_id) then
    return json_build_object('success', false, 'error', 'Entreprise introuvable'); end if;
  v_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code)
    values (p_company_id, trim(p_name), v_code) returning id into v_id;
  return json_build_object('success', true, 'store_id', v_id::text, 'name', trim(p_name), 'join_code', v_code);
end; $function$;

-- join_store : le superviseur saisit un code magasin → rattachement entreprise + affectation.
create or replace function public.join_store(p_code text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_store public.stores%rowtype; v_company public.companies%rowtype; v_my_company uuid;
begin
  if get_my_role() <> 'supervisor' then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_store from public.stores where join_code = upper(trim(p_code));
  if not found then
    return json_build_object('success', false, 'error', 'Code magasin introuvable');
  end if;
  select company_id into v_my_company from public.profiles where id = auth.uid();
  if v_my_company is not null and v_my_company <> v_store.company_id then
    return json_build_object('success', false, 'error', 'Vous êtes déjà rattaché à une autre entreprise');
  end if;
  if v_my_company is null then
    update public.profiles set company_id = v_store.company_id where id = auth.uid();
  end if;
  insert into public.store_supervisors (store_id, user_id)
    values (v_store.id, auth.uid()) on conflict (store_id, user_id) do nothing;
  select * into v_company from public.companies where id = v_store.company_id;
  return json_build_object('success', true, 'store_id', v_store.id::text, 'store_name', v_store.name,
    'company_id', v_store.company_id::text, 'company_name', v_company.name);
end; $function$;

-- Liste des magasins (avec code) pour la console admin.
create or replace function public.admin_list_stores()
returns table(id uuid, company_id uuid, name text, join_code text)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select st.id, st.company_id, st.name, st.join_code from public.stores st order by st.name;
end; $function$;

-- Confidentialité du code magasin : illisible via la clé publique (le superviseur ne
-- peut pas s'auto-affecter en lisant tous les codes). L'admin le lit via admin_list_stores,
-- join_store le vérifie côté serveur (SECURITY DEFINER).
revoke select on public.stores from anon, authenticated;
grant select (id, company_id, name, created_at) on public.stores to anon, authenticated;

grant execute on function public.join_store(text) to authenticated;
revoke execute on function public.gen_store_code() from public, anon;
revoke execute on function public.admin_list_stores() from public, anon;
grant execute on function public.admin_list_stores() to authenticated;
