-- Les tables de Quantinvo OS, telles que la production les porte le
-- 20 septembre 2026 (extraites de `information_schema` et de `pg_policies`).
create table public.companies (id uuid default gen_random_uuid() primary key, name text not null, join_code text not null unique, created_at timestamptz default now() not null, balise_count integer default 0 not null, plan text default 'standard'::text not null, billing_period text, license_status text default 'active'::text not null, stripe_customer_id text, stripe_subscription_id text);
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text default ''::text not null, role text default 'employee'::text not null, created_at timestamptz default now() not null, company_id uuid references public.companies(id) on delete set null, is_admin boolean default false not null, first_name text default ''::text not null, last_name text default ''::text not null, is_company_admin boolean default false not null);
create table public.stores (id uuid default gen_random_uuid() primary key, company_id uuid not null references public.companies(id) on delete cascade, name text not null, created_at timestamptz default now() not null, join_code text not null unique, annual_price_cents integer, units integer, sqm integer, devices integer, stripe_item_offre text, stripe_item_appareils text, stripe_subscription_id text, address text);
create table public.inventory_sessions (id uuid default gen_random_uuid() primary key, inventory_number text not null, security_code_hash text not null, store_name text not null, status text default 'open'::text not null, current_pass integer default 1 not null, created_by uuid, created_at timestamptz default now() not null, closed_at timestamptz, security_code text, uses_zones boolean default false not null, company_id uuid not null references public.companies(id) on delete cascade, name text default ''::text not null, store_id uuid not null references public.stores(id) on delete cascade, archived_at timestamptz);
create table public.session_members (session_id uuid not null references public.inventory_sessions(id) on delete cascade, user_id uuid not null, joined_at timestamptz default now() not null, role text default 'counter'::text not null, primary key (session_id, user_id));
create table public.zones (id uuid default gen_random_uuid() primary key, session_id uuid not null references public.inventory_sessions(id) on delete cascade, code text not null, status text default 'open'::text not null, created_at timestamptz default now() not null, name text, count_status text default 'pending'::text not null, audit_status text default 'pending'::text not null, count_done_at timestamptz, audit_done_at timestamptz);
create table public.counts (id uuid default gen_random_uuid() primary key, session_id uuid not null references public.inventory_sessions(id) on delete cascade, sku text not null, pass_number integer not null, qty numeric default 1 not null, counted_by uuid, zone text, created_at timestamptz default now() not null);
create table public.appareils_actifs (store_id uuid not null references public.stores(id) on delete cascade, appareil text not null, vu_le timestamptz default now() not null, refuse boolean default false not null, primary key (store_id, appareil));
create table public.appareils_par_jour (store_id uuid not null references public.stores(id) on delete cascade, jour date not null, pic integer default 0 not null, refus integer default 0 not null, primary key (store_id, jour));
create table public.admin_audit_log (id bigserial primary key, actor_id uuid, actor_label text default ''::text not null, action text not null, target_type text default ''::text not null, target_id text default ''::text not null, target_label text default ''::text not null, details jsonb default '{}'::jsonb not null, created_at timestamptz default now() not null);

-- Les objets que les fonctions extraites citent, en version minimale.
create table public.store_supervisors (store_id uuid not null references public.stores(id) on delete cascade, user_id uuid not null, primary key (store_id, user_id));
create table public.notifications (id bigserial primary key, user_id uuid, type text not null, donnees jsonb default '{}'::jsonb not null, created_at timestamptz default now() not null);
create table public.store_requests (id uuid default gen_random_uuid() primary key, company_id uuid, store_id uuid, store_name text, message text, devices integer, billing_period text, kind text, requested_by uuid, requested_label text, status text, accepted_at timestamptz, quote_amount_cents bigint, quote_lines jsonb, admin_note text);
create table auth.mfa_factors (id uuid default gen_random_uuid() primary key, user_id uuid not null, status text not null);
create or replace function public.log_company_action(p_company uuid, p_action text, p_label text, p_details jsonb default '{}'::jsonb)
  returns void language plpgsql as $f$ begin return; end $f$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.zones enable row level security;
alter table public.counts enable row level security;
alter table public.appareils_actifs enable row level security;
alter table public.appareils_par_jour enable row level security;

grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.counts, public.zones, public.session_members,
  public.inventory_sessions, public.profiles to authenticated;
