-- Supprimer un inventaire : le créateur, ou l'administrateur de l'entreprise.
--
-- Avant, la seule garde était `can_access_session`, c'est-à-dire **n'importe
-- quel superviseur participant**. Le bouton était caché aux autres côté
-- navigateur ; la fonction, elle, ne l'était pas. Un co-superviseur pouvait
-- effacer comptages, stock théorique, audits et référentiel d'un inventaire
-- qu'il n'avait pas créé.
--
-- La règle décidée le 21 août 2026 : le créateur pour ses propres inventaires,
-- l'administrateur d'entreprise pour tous ceux de son entreprise — y compris
-- ceux auxquels il ne participe pas, c'est justement son rôle.
--
-- `is_company_admin(v_company)` porte déjà l'exigence aal2 conditionnelle : un
-- administrateur qui a un second facteur devra l'avoir saisi.
create or replace function public.delete_session(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_created_by uuid;
  v_company    uuid;
begin
  select s.created_by, s.company_id into v_created_by, v_company
    from public.inventory_sessions s
   where s.id = p_session_id;

  if not found then
    return json_build_object('success', false, 'error', 'Inventaire introuvable.');
  end if;

  if not (
    -- Le créateur, s'il est encore superviseur (une rétrogradation en compteur
    -- retire le droit avec le rôle).
    (v_created_by = auth.uid() and coalesce(public.get_my_role(), '') = 'supervisor')
    or public.is_company_admin(v_company)
  ) then
    return json_build_object(
      'success', false,
      'error', 'Seul le créateur de cet inventaire, ou l''administrateur de votre entreprise, peut le supprimer.'
    );
  end if;

  delete from public.zones             where session_id = p_session_id;
  delete from public.counts            where session_id = p_session_id;
  delete from public.theoretical_stock where session_id = p_session_id;
  delete from public.article_audit     where session_id = p_session_id;
  delete from public.articles          where session_id = p_session_id;
  delete from public.session_members   where session_id = p_session_id;
  delete from public.inventory_sessions where id = p_session_id;

  return json_build_object('success', true);
end;
$function$;

-- `create or replace` peut rendre EXECUTE à PUBLIC : on repose les droits
-- exactement tels qu'ils étaient (leçon de la migration 20260819172706).
revoke all on function public.delete_session(uuid) from public;
revoke all on function public.delete_session(uuid) from anon;
grant execute on function public.delete_session(uuid) to authenticated;
grant execute on function public.delete_session(uuid) to service_role;
