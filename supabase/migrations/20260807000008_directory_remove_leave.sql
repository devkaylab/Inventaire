-- Annuaire d'entreprise (recherche à l'invitation), retrait d'un membre,
-- et départ volontaire d'un inventaire (sans supprimer les comptages/audits).
-- À appliquer via Supabase MCP / dashboard (le dossier migrations diverge de la base).

-- Annuaire : membres de l'entreprise courante (nom + e-mail) pour la recherche.
-- Réservé aux membres de la même entreprise. L'e-mail vient de auth.users.
create or replace function public.get_company_directory()
returns table(user_id uuid, full_name text, email text, role text)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select p.id, p.full_name, u.email::text, p.role
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.company_id is not null
    and p.company_id = public.get_my_company()
  order by p.full_name nulls last, u.email;
$$;

revoke execute on function public.get_company_directory() from anon;

-- Un participant (superviseur) retire un membre de l'inventaire.
-- Interdit de retirer le créateur. Les comptages/audits déjà saisis sont conservés.
create or replace function public.remove_session_member(p_session_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_creator uuid;
begin
  if not public.can_access_session(p_session_id) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select created_by into v_creator from public.inventory_sessions where id = p_session_id;
  if p_user_id = v_creator then
    return json_build_object('success', false, 'error', 'Impossible de retirer le créateur de l''inventaire.');
  end if;
  delete from public.session_members where session_id = p_session_id and user_id = p_user_id;
  return json_build_object('success', true);
end; $$;

revoke execute on function public.remove_session_member(uuid, uuid) from anon;

-- Un invité (membre non-créateur) quitte l'inventaire de lui-même.
-- Ses comptages/audits restent (rien n'est supprimé côté données).
create or replace function public.leave_session(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_creator uuid;
begin
  select created_by into v_creator from public.inventory_sessions where id = p_session_id;
  if v_creator is null then
    return json_build_object('success', false, 'error', 'Inventaire introuvable');
  end if;
  if v_creator = auth.uid() then
    return json_build_object('success', false, 'error', 'Le créateur ne peut pas quitter son propre inventaire.');
  end if;
  delete from public.session_members where session_id = p_session_id and user_id = auth.uid();
  return json_build_object('success', true);
end; $$;

revoke execute on function public.leave_session(uuid) from anon;
