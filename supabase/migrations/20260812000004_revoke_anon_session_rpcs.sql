-- Défense en profondeur : refermer les droits d'exécution des RPC sensibles.
--
-- Plusieurs de ces fonctions avaient bien été révoquées par le passé
-- (20260527000001, 20260619000001, 20260807000007), mais elles ont ensuite été
-- supprimées puis recréées avec une nouvelle signature — et un `revoke` ne suit
-- pas un changement de signature. Elles sont donc revenues au droit par défaut
-- de PostgreSQL : `EXECUTE TO PUBLIC`.
--
-- Point important : révoquer sur `anon` ne suffit pas. `PUBLIC` est un
-- pseudo-rôle qui englobe `anon` et `authenticated` ; tant que le droit PUBLIC
-- subsiste, retirer `anon` ne change rien. On révoque donc sur PUBLIC, puis on
-- accorde explicitement à `authenticated`.
--
-- Cas le plus sérieux : `find_user_by_email`. La migration 20260807000007 la
-- destinait à `service_role` uniquement (elle lit `auth.users` et renvoie
-- user_id / company_id / role / full_name sans aucune garde interne — sa
-- sécurité repose *entièrement* sur le grant). Le droit PUBLIC résiduel la
-- rendait appelable par n'importe quel compte connecté, ce qui permettait
-- d'énumérer les utilisateurs par adresse e-mail. Elle repasse à
-- `service_role` seul ; les deux edge functions qui l'utilisent
-- (invite-to-session, invite-teammate) appellent déjà avec ce rôle.
--
-- `check_invitation` reste volontairement ouverte à `anon` : elle est appelée
-- pendant l'inscription, avant qu'un compte n'existe.
--
-- Appliquée en base live via l'outil MCP apply_migration.

-- ── Fonction réservée au service_role ────────────────────────────────────────
revoke all on function public.find_user_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_by_email(text) to service_role;

-- ── RPC liées à un inventaire ────────────────────────────────────────────────
revoke all on function public.resolve_audit(uuid, text, numeric, text) from public, anon;
revoke all on function public.delete_audit_line(uuid, text, text) from public, anon;
revoke all on function public.delete_session(uuid) from public, anon;
revoke all on function public.define_zone(uuid, text, integer, integer) from public, anon;
revoke all on function public.delete_zone(uuid, text) from public, anon;
revoke all on function public.generate_zones(uuid, integer) from public, anon;
revoke all on function public.ensure_zone(uuid, text) from public, anon;
revoke all on function public.register_balise(uuid, text, text) from public, anon;
revoke all on function public.set_balise(uuid, text, text, boolean, boolean) from public, anon;
revoke all on function public.set_zone_status(uuid, text) from public, anon;
revoke all on function public.get_zone_dashboard(uuid) from public, anon;
revoke all on function public.get_zone_progress(uuid) from public, anon;
revoke all on function public.get_session_detail(uuid) from public, anon;
revoke all on function public.get_session_activity(uuid, integer) from public, anon;
revoke all on function public.generate_company_balises(integer) from public, anon;
revoke all on function public.is_session_participant(uuid) from public, anon;
revoke all on function public.leave_session(uuid) from public, anon;
revoke all on function public.remove_session_member(uuid, uuid) from public, anon;
revoke all on function public.get_company_directory() from public, anon;
revoke all on function public.get_store_directory(uuid) from public, anon;

-- ── Fonctions entreprise / helpers ───────────────────────────────────────────
revoke all on function public.create_company(text) from public, anon;
revoke all on function public.join_company(text) from public, anon;
revoke all on function public.get_my_company() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.gen_company_code() from public, anon;
revoke all on function public.norm_balise(text) from public, anon;

-- ── Rétablissement pour les comptes connectés ────────────────────────────────
grant execute on function public.resolve_audit(uuid, text, numeric, text) to authenticated;
grant execute on function public.delete_audit_line(uuid, text, text) to authenticated;
grant execute on function public.delete_session(uuid) to authenticated;
grant execute on function public.define_zone(uuid, text, integer, integer) to authenticated;
grant execute on function public.delete_zone(uuid, text) to authenticated;
grant execute on function public.generate_zones(uuid, integer) to authenticated;
grant execute on function public.ensure_zone(uuid, text) to authenticated;
grant execute on function public.register_balise(uuid, text, text) to authenticated;
grant execute on function public.set_balise(uuid, text, text, boolean, boolean) to authenticated;
grant execute on function public.set_zone_status(uuid, text) to authenticated;
grant execute on function public.get_zone_dashboard(uuid) to authenticated;
grant execute on function public.get_zone_progress(uuid) to authenticated;
grant execute on function public.get_session_detail(uuid) to authenticated;
grant execute on function public.get_session_activity(uuid, integer) to authenticated;
grant execute on function public.generate_company_balises(integer) to authenticated;
grant execute on function public.is_session_participant(uuid) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;
grant execute on function public.remove_session_member(uuid, uuid) to authenticated;
grant execute on function public.get_company_directory() to authenticated;
grant execute on function public.get_store_directory(uuid) to authenticated;
grant execute on function public.create_company(text) to authenticated;
grant execute on function public.join_company(text) to authenticated;
grant execute on function public.get_my_company() to authenticated;
grant execute on function public.is_admin() to authenticated;
