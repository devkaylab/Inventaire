-- Partie A : la visibilité d'un inventaire devient personnelle
-- « je l'ai créé » OU « on m'y a invité » (session_members), au lieu de
-- « je suis affecté au magasin ». L'affectation magasin ne sert plus qu'à
-- décider où un superviseur a le droit de CRÉER un inventaire.
--
-- À appliquer via Supabase MCP / dashboard (le dossier migrations diverge de la base).

-- 1. Rôle sur la participation : co-superviseur vs simple compteur.
alter table public.session_members
  add column if not exists role text not null default 'counter';
alter table public.session_members
  drop constraint if exists session_members_role_check;
alter table public.session_members
  add constraint session_members_role_check check (role in ('supervisor','counter'));

-- Le créateur d'un inventaire est co-superviseur de son propre inventaire.
update public.session_members sm
set role = 'supervisor'
from public.inventory_sessions s
where s.id = sm.session_id and s.created_by = sm.user_id and sm.role <> 'supervisor';

-- 2. Helper : l'utilisateur courant est-il participant de l'inventaire ?
--    (admin voit tout ; sinon même entreprise + créateur ou membre)
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.is_admin() or exists (
    select 1 from public.inventory_sessions s
    where s.id = p_session_id
      and s.company_id = public.get_my_company()
      and (
        s.created_by = auth.uid()
        or exists (
          select 1 from public.session_members sm
          where sm.session_id = s.id and sm.user_id = auth.uid()
        )
      )
  );
$$;

-- 3. Accès aux données d'un inventaire (utilisé par tous les RPC enfants) :
--    désormais basé sur l'appartenance → un co-superviseur invité a les mêmes droits.
create or replace function public.can_access_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.get_my_role() = 'supervisor'
     and public.is_session_participant(p_session_id);
$$;

-- 4. inventory_sessions : remplacer la policy FOR ALL basée magasin par des
--    policies par commande, basées sur l'appartenance (create reste garde-fou magasin).
drop policy if exists sessions_supervisor_company on public.inventory_sessions;

create policy sessions_supervisor_select on public.inventory_sessions
  for select using (
    get_my_role() = 'supervisor' and public.is_session_participant(id)
  );

create policy sessions_supervisor_update on public.inventory_sessions
  for update using (
    get_my_role() = 'supervisor' and public.is_session_participant(id)
  ) with check (
    get_my_role() = 'supervisor' and company_id = get_my_company()
  );

create policy sessions_supervisor_delete on public.inventory_sessions
  for delete using (
    get_my_role() = 'supervisor' and public.is_session_participant(id)
  );

create policy sessions_supervisor_insert on public.inventory_sessions
  for insert with check (
    get_my_role() = 'supervisor'
    and company_id = get_my_company()
    and public.is_assigned_store(store_id)
  );

-- 5. Tables enfants : mêmes policies superviseur, mais appartenance au lieu du magasin.
drop policy if exists articles_supervisor on public.articles;
create policy articles_supervisor on public.articles
  for all using (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  ) with check (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  );

drop policy if exists theoretical_stock_supervisor on public.theoretical_stock;
create policy theoretical_stock_supervisor on public.theoretical_stock
  for all using (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  ) with check (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  );

drop policy if exists audit_supervisor on public.article_audit;
create policy audit_supervisor on public.article_audit
  for all using (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  ) with check (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  );

drop policy if exists zones_supervisor_company on public.zones;
create policy zones_supervisor_company on public.zones
  for all using (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  ) with check (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  );

drop policy if exists counts_select_supervisor on public.counts;
create policy counts_select_supervisor on public.counts
  for select using (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  );

drop policy if exists counts_delete_supervisor on public.counts;
create policy counts_delete_supervisor on public.counts
  for delete using (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  );

drop policy if exists counts_insert_supervisor on public.counts;
create policy counts_insert_supervisor on public.counts
  for insert with check (
    counted_by = auth.uid()
    and get_my_role() = 'supervisor'
    and public.is_session_participant(session_id)
    and exists (
      select 1 from public.inventory_sessions s
      where s.id = counts.session_id
        and (
          (s.uses_zones and counts.pass_number >= 1 and counts.pass_number <= 3)
          or ((not s.uses_zones) and counts.pass_number = s.current_pass)
        )
    )
  );

-- 6. session_members : un superviseur ne gère/voit que les membres de SES inventaires.
drop policy if exists session_members_supervisor on public.session_members;
create policy session_members_supervisor on public.session_members
  for all using (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  ) with check (
    get_my_role() = 'supervisor' and public.is_session_participant(session_id)
  );

-- 7. Le rôle anonyme n'a pas à exécuter le helper (convention du projet).
revoke execute on function public.is_session_participant(uuid) from anon;
