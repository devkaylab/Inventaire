-- Parties B & C : invitations à un inventaire précis + jetons push.
-- À appliquer via Supabase MCP / dashboard (le dossier migrations diverge de la base).

-- ── Jetons de notification push (multi-appareils) ───────────────────────────
create table if not exists public.push_tokens (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Invitations à un inventaire précis ──────────────────────────────────────
-- Personne pas encore inscrite, invitée par un participant de l'inventaire.
-- Une fois inscrite avec cet e-mail, elle est rattachée automatiquement
-- (voir handle_new_user ci-dessous). Même entreprise uniquement.
create table if not exists public.session_invitations (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'counter' check (role in ('supervisor','counter')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (session_id, email)
);
alter table public.session_invitations enable row level security;

-- Les participants de l'inventaire voient / gèrent ses invitations en attente.
drop policy if exists session_invitations_participant on public.session_invitations;
create policy session_invitations_participant on public.session_invitations
  for all using (public.is_session_participant(session_id))
  with check (public.is_session_participant(session_id));

-- ── Inscription : consommer aussi les invitations à un inventaire ────────────
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
    -- Rattachement via invitation à un inventaire.
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
    end loop;
    delete from public.session_invitations where email = v_email;
    delete from public.team_invitations where email = v_email;

  elsif v_team.id is not null then
    -- Rattachement via invitation d'équipe (employé).
    v_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(v_team.full_name, ''),
      ''
    );
    insert into public.profiles (id, full_name, role, company_id)
      values (new.id, v_name, 'employee', v_team.company_id);
    delete from public.team_invitations where id = v_team.id;

  else
    -- Aucune invitation : nouveau superviseur (un employé sans invitation est refusé).
    if v_claim = 'employee' then
      raise exception 'Aucune invitation pour cet e-mail. Demandez à votre superviseur de vous ajouter.';
    end if;
    insert into public.profiles (id, full_name, role)
      values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'supervisor');
  end if;

  return new;
end;
$function$;
