-- Administrateur d'entreprise, acte 1 : le drapeau et sa garde.
--
-- Un DRAPEAU sur le profil, pas une nouvelle valeur de `role` : les policies
-- RLS accordent la visibilité d'entreprise via get_my_role() = 'supervisor',
-- et un rôle inédit aurait exigé de toutes les rouvrir. L'administrateur
-- d'entreprise garde donc role = 'supervisor' — le cumul admin + superviseur
-- des petites structures marche par construction, comme is_admin.

alter table public.profiles
  add column if not exists is_company_admin boolean not null default false;

-- Le verrou anti-élévation couvre le nouveau drapeau. Sans cette ligne, un
-- superviseur se nommerait administrateur d'entreprise d'un simple UPDATE.
-- SECURITY INVOKER obligatoire : en DEFINER, current_user vaudrait le
-- propriétaire et le garde-fou ne s'appliquerait jamais.
create or replace function public.profiles_pin_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.id               := old.id;
    new.role             := old.role;
    new.company_id       := old.company_id;
    new.is_admin         := old.is_admin;
    new.is_company_admin := old.is_company_admin;
  end if;
  return new;
end;
$$;

-- create or replace rend EXECUTE à PUBLIC : on repose les droits aussitôt.
revoke all on function public.profiles_pin_privileged_columns() from public, anon, authenticated;

-- La garde unique du rôle, miroir exact d'is_admin() : drapeau + même
-- entreprise + aal2 exigé dès qu'un facteur TOTP vérifié existe. Toutes les
-- fonctions ca_* passent par elle — un seul point à raisonner.
create or replace function public.is_company_admin(p_company uuid default null)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce((
           select p.is_company_admin
              and p.company_id is not null
              and (p_company is null or p.company_id = p_company)
             from public.profiles p
            where p.id = auth.uid()), false)
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (
         select 1 from auth.mfa_factors f
          where f.user_id = auth.uid() and f.status = 'verified'
       )
     )
$$;

revoke all on function public.is_company_admin(uuid) from public, anon;
grant execute on function public.is_company_admin(uuid) to authenticated, service_role;
