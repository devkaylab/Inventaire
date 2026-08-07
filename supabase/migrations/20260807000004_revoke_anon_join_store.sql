-- Cohérence : join_store n'est exécutable que par un utilisateur connecté.
revoke execute on function public.join_store(text) from public, anon;
grant execute on function public.join_store(text) to authenticated;
