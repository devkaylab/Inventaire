-- Rattacher les compteurs (employés) à un magasin — « équipe du magasin ».
-- Sert uniquement à filtrer les suggestions d'invitation ; ne donne AUCUN droit
-- d'accès (les employés accèdent aux inventaires via session_members).
-- À appliquer via Supabase MCP / dashboard (le dossier migrations diverge de la base).

create table if not exists public.store_team (
  store_id   uuid not null references public.stores(id)   on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
alter table public.store_team enable row level security;
-- Pas de policy permissive : la table n'est lue/écrite que par des fonctions
-- SECURITY DEFINER (et le service_role), jamais directement par l'app.

-- Backfill : rattacher chaque compteur existant aux magasins où il a déjà
-- participé à un inventaire.
insert into public.store_team (store_id, user_id)
select distinct s.store_id, sm.user_id
from public.session_members sm
join public.inventory_sessions s on s.id = sm.session_id
join public.profiles p on p.id = sm.user_id
where p.role = 'employee'
on conflict do nothing;

-- À l'inscription : un compteur onboardé par un superviseur (team_invitations)
-- est rattaché automatiquement aux magasins de ce superviseur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email   text := lower(trim(new.email));
  v_name    text;
  v_claim   text;
  v_team    public.team_invitations%rowtype;
  v_company uuid;
  v_role    text;
  v_has_supervisor_inv boolean;
  v_session_count int;
  r record;
begin
  v_claim := coalesce(new.raw_user_meta_data->>'role', 'supervisor');

  select count(*), bool_or(si.role = 'supervisor')
    into v_session_count, v_has_supervisor_inv
    from public.session_invitations si
   where si.email = v_email;

  select * into v_team from public.team_invitations where email = v_email limit 1;

  if v_session_count > 0 then
    select company_id into v_company
      from public.session_invitations where email = v_email order by created_at limit 1;
    v_role := case when v_has_supervisor_inv then 'supervisor' else 'employee' end;
    v_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      (select nullif(full_name, '') from public.session_invitations
        where email = v_email order by created_at limit 1),
      ''
    );
    insert into public.profiles (id, full_name, role, company_id)
      values (new.id, v_name, v_role, v_company);

    for r in select * from public.session_invitations where email = v_email loop
      insert into public.session_members (session_id, user_id, role)
        values (r.session_id, new.id, r.role)
        on conflict (session_id, user_id) do update set role = excluded.role;
      -- rattacher au magasin de l'inventaire rejoint
      insert into public.store_team (store_id, user_id)
        select s.store_id, new.id from public.inventory_sessions s where s.id = r.session_id
        on conflict do nothing;
    end loop;
    delete from public.session_invitations where email = v_email;
    delete from public.team_invitations where email = v_email;

  elsif v_team.id is not null then
    v_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(v_team.full_name, ''),
      ''
    );
    insert into public.profiles (id, full_name, role, company_id)
      values (new.id, v_name, 'employee', v_team.company_id);
    -- rattacher aux magasins du superviseur qui a créé l'invitation
    insert into public.store_team (store_id, user_id)
      select ss.store_id, new.id
      from public.store_supervisors ss
      where ss.user_id = v_team.created_by
      on conflict do nothing;
    delete from public.team_invitations where id = v_team.id;

  else
    if v_claim = 'employee' then
      raise exception 'Aucune invitation pour cet e-mail. Demandez à votre superviseur de vous ajouter.';
    end if;
    insert into public.profiles (id, full_name, role)
      values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'supervisor');
  end if;

  return new;
end;
$function$;

-- Rejoindre un inventaire via le code : rattache aussi au magasin de l'inventaire.
create or replace function public.join_session(p_inventory_number text, p_security_code text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_session inventory_sessions%rowtype;
begin
  select * into v_session from public.inventory_sessions
  where inventory_number = p_inventory_number
    and security_code_hash = encode(sha256(p_security_code::bytea), 'hex')
    and status <> 'closed';
  if not found then
    return json_build_object('success', false, 'error', 'Session introuvable ou code incorrect');
  end if;
  insert into public.session_members (session_id, user_id) values (v_session.id, auth.uid())
  on conflict (session_id, user_id) do nothing;
  insert into public.store_team (store_id, user_id) values (v_session.store_id, auth.uid())
  on conflict do nothing;
  return json_build_object('success', true, 'session_id', v_session.id::text,
    'store_name', v_session.store_name, 'status', v_session.status, 'current_pass', v_session.current_pass);
end;
$function$;

-- Annuaire d'un magasin : superviseurs affectés + compteurs de l'équipe.
-- Réservé aux superviseurs affectés au magasin (ou admin).
create or replace function public.get_store_directory(p_store_id uuid)
returns table(user_id uuid, full_name text, email text, role text)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select p.id, p.full_name, u.email::text, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_assigned_store(p_store_id)
    and p.company_id = public.get_my_company()
    and (
      exists (select 1 from public.store_supervisors ss where ss.store_id = p_store_id and ss.user_id = p.id)
      or exists (select 1 from public.store_team st where st.store_id = p_store_id and st.user_id = p.id)
    )
  order by p.full_name nulls last, u.email;
$$;

revoke execute on function public.get_store_directory(uuid) from anon;
