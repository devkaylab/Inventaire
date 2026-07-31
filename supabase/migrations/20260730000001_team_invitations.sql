-- ─────────────────────────────────────────────────────────────────────────
-- Modèle « invitation » pour l'onboarding des employés.
--
-- Un employé ne peut créer son compte que si son superviseur l'a pré-inscrit
-- (son e-mail figure dans team_invitations). L'employé choisit lui-même son
-- mot de passe. Un superviseur, lui, s'inscrit librement (nouvelle entreprise).
--
-- Remplace l'ancien système où le superviseur définissait le mot de passe via
-- l'Edge Function `create-member` (désormais obsolète).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.team_invitations enable row level security;

-- Le superviseur gère (voit / crée / annule) les invitations de son entreprise.
drop policy if exists team_invitations_supervisor on public.team_invitations;
create policy team_invitations_supervisor on public.team_invitations
  for all
  using (get_my_role() = 'supervisor' and company_id = get_my_company())
  with check (get_my_role() = 'supervisor' and company_id = get_my_company());

-- Vérifie (avant inscription → appelée en anon) si un e-mail a été invité.
-- Ne renvoie qu'un booléen pour limiter la fuite d'information.
create or replace function public.check_invitation(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_invitations where email = lower(trim(p_email))
  );
$$;
revoke all on function public.check_invitation(text) from public;
grant execute on function public.check_invitation(text) to anon, authenticated;

-- Inscription : le rôle est décidé côté serveur, pas par le client.
--  • e-mail invité  → employé, rattaché à l'entreprise, invitation consommée
--  • sinon          → superviseur (auto-inscription libre)
--  • un claim "employee" sans invitation est refusé.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.team_invitations%rowtype;
  v_name text;
  v_claim text;
begin
  v_claim := coalesce(new.raw_user_meta_data->>'role', 'supervisor');
  select * into v_inv from public.team_invitations
    where email = lower(trim(new.email)) limit 1;

  if found then
    v_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(v_inv.full_name, ''),
      ''
    );
    insert into public.profiles (id, full_name, role, company_id)
      values (new.id, v_name, 'employee', v_inv.company_id);
    delete from public.team_invitations where id = v_inv.id;
  else
    if v_claim = 'employee' then
      raise exception 'Aucune invitation pour cet e-mail. Demandez à votre superviseur de vous ajouter.';
    end if;
    insert into public.profiles (id, full_name, role)
      values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'supervisor');
  end if;
  return new;
end;
$$;
