-- `create or replace function` réinitialise les droits : PUBLIC retrouve
-- EXECUTE, que la migration 20260812143348 avait précisément révoqué sur les
-- RPC sensibles. Le rétablissement précédent a donc rendu la fonction
-- exécutable par tout rôle, `anon` compris — sans fuite de données, puisque
-- `can_access_session` refuse une session sans `auth.uid()`, mais ce n'était
-- pas l'état d'origine et cela n'a pas à être toléré.
--
-- À retenir pour toute restauration de fonction : reposer les GRANT/REVOKE
-- dans la même migration, PUBLIC compris.

revoke all on function public.get_session_activity(uuid, int) from public;
revoke all on function public.get_session_activity(uuid, int) from anon;
grant execute on function public.get_session_activity(uuid, int) to authenticated;
