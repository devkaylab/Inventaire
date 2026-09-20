-- Le décor que Supabase fournit et que les migrations supposent.
-- ⚠️ Ce n'est PAS une copie de Supabase : juste ce qu'il faut pour que les
-- migrations du dépôt s'appliquent et que la RLS se comporte pareil.
do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;
create schema if not exists extensions;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ⚠️ `gen_random_uuid` et `gen_random_bytes` : Supabase les expose dans
-- `extensions` ET dans `public` selon les versions. On pose les deux.
create or replace function public.gen_random_bytes(integer) returns bytea
  language sql as $$ select extensions.gen_random_bytes($1) $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  encrypted_password text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  confirmation_token text,
  recovery_token text
);
grant select on auth.users to authenticated, service_role;

-- ⚠️ L'IMPERSONATION SE FAIT PAR UN RÉGLAGE DE SESSION, comme dans un vrai
-- PostgREST : `set local request.jwt.claims`. C'est ce qui permet d'exercer la
-- RLS pour de vrai, en devenant tour à tour superviseur, compteur, inventoriste.
create or replace function auth.uid() returns uuid
  language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text
  language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;
create or replace function auth.email() returns text
  language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;
create or replace function auth.jwt() returns jsonb
  language sql stable as $$ select '{}'::jsonb $$;
