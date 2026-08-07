-- Accès « par magasin assigné » : socle.
-- Un superviseur ne voit que les magasins auxquels l'admin l'a affecté.
-- Appliquer via Supabase MCP / dashboard (le dossier migrations diverge de la base).

-- ── Table d'affectation superviseur ↔ magasin ────────────────────────────────
create table if not exists public.store_supervisors (
  store_id   uuid not null references public.stores(id)   on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

alter table public.store_supervisors enable row level security;

-- Écriture réservée à l'admin (les affectations sont gérées depuis la console admin).
drop policy if exists store_supervisors_admin_write on public.store_supervisors;
create policy store_supervisors_admin_write on public.store_supervisors
  for all using (public.is_admin()) with check (public.is_admin());

-- Lecture : l'admin, ou un superviseur voit les affectations de sa propre entreprise.
drop policy if exists store_supervisors_select on public.store_supervisors;
create policy store_supervisors_select on public.store_supervisors
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.stores st
      where st.id = store_supervisors.store_id
        and st.company_id = public.get_my_company()
    )
  );

-- ── Helpers d'accès (SECURITY DEFINER) ───────────────────────────────────────
-- Peut gérer ce magasin : admin, ou superviseur affecté.
create or replace function public.is_assigned_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.is_admin() or exists (
    select 1 from public.store_supervisors ss
    where ss.store_id = p_store_id and ss.user_id = auth.uid()
  );
$$;

-- can_access_session() est créée dans 20260806000002 (après l'ajout de la colonne
-- inventory_sessions.store_id qu'elle référence).

-- Les magasins affectés au superviseur courant (pour le sélecteur de nouvelle session).
create or replace function public.get_my_stores()
returns table(id uuid, name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select st.id, st.name
  from public.stores st
  join public.store_supervisors ss on ss.store_id = st.id
  where ss.user_id = auth.uid()
  order by st.name;
$$;
