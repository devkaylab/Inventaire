-- La gestion des membres/invitations (retirer, annuler) est réservée au CRÉATEUR
-- de l'inventaire. Un invité (même co-superviseur) ne peut pas retirer les autres ;
-- il peut seulement se retirer lui-même (leave_session).
-- À appliquer via Supabase MCP / dashboard (le dossier migrations diverge de la base).

-- Retrait d'un membre : réservé au créateur.
create or replace function public.remove_session_member(p_session_id uuid, p_user_id uuid)
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
  if v_creator <> auth.uid() then
    return json_build_object('success', false, 'error', 'Seul le créateur peut retirer un membre.');
  end if;
  if p_user_id = v_creator then
    return json_build_object('success', false, 'error', 'Impossible de retirer le créateur de l''inventaire.');
  end if;
  delete from public.session_members where session_id = p_session_id and user_id = p_user_id;
  return json_build_object('success', true);
end; $$;

revoke execute on function public.remove_session_member(uuid, uuid) from anon;

-- Invitations en attente : lecture pour tous les participants, mais écriture
-- (annulation) réservée au créateur. L'invitation elle-même passe par l'edge
-- function (service_role), qui n'est pas soumise à RLS.
drop policy if exists session_invitations_participant on public.session_invitations;

create policy session_invitations_select on public.session_invitations
  for select using (public.is_session_participant(session_id));

create policy session_invitations_creator_write on public.session_invitations
  for all
  using (exists (
    select 1 from public.inventory_sessions s
    where s.id = session_invitations.session_id and s.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.inventory_sessions s
    where s.id = session_invitations.session_id and s.created_by = auth.uid()
  ));
