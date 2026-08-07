-- Cohérence avec le durcissement existant : les nouvelles fonctions SECURITY DEFINER
-- ne sont pas exécutables par le rôle anon (elles gardent leurs gardes internes).
revoke execute on function public.is_assigned_store(uuid) from public, anon;
revoke execute on function public.can_access_session(uuid) from public, anon;
revoke execute on function public.get_my_stores() from public, anon;
revoke execute on function public.admin_list_company_members(uuid) from public, anon;
revoke execute on function public.admin_list_store_supervisors(uuid) from public, anon;
revoke execute on function public.admin_assign_supervisor(uuid, uuid) from public, anon;
revoke execute on function public.admin_unassign_supervisor(uuid, uuid) from public, anon;

grant execute on function public.is_assigned_store(uuid) to authenticated;
grant execute on function public.can_access_session(uuid) to authenticated;
grant execute on function public.get_my_stores() to authenticated;
grant execute on function public.admin_list_company_members(uuid) to authenticated;
grant execute on function public.admin_list_store_supervisors(uuid) to authenticated;
grant execute on function public.admin_assign_supervisor(uuid, uuid) to authenticated;
grant execute on function public.admin_unassign_supervisor(uuid, uuid) to authenticated;
