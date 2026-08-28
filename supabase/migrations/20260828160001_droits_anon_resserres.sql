-- ─────────────────────────────────────────────────────────────────────────
-- Deux fonctions qu'`anon` n'aurait jamais dû pouvoir appeler (28 août 2026).
--
-- Constat n°6 de la revue de sécurité. Six fonctions sont exécutables par le
-- rôle `anon` ; quatre le sont à dessein — ce sont celles du parcours de devis
-- public et le formulaire d'inscription, où le jeton ou la limitation de débit
-- tiennent lieu de garde. Les deux autres sont des oublis :
--
--   · `admin_list_audit_log` rend le **journal des actions d'administration** ;
--   · `team_invitations_figer_invariants` est la fonction de déclencheur posée
--     ce matin même par `20260828150001`.
--
-- ⚠️ NI L'UNE NI L'AUTRE NE FUIT. Essayé pour de vrai : la première répond
-- `forbidden` (son garde `is_admin()` tient), la seconde répond que « les
-- fonctions de déclencheur ne s'appellent pas directement ». Ce n'est donc pas
-- une brèche — c'est un droit accordé sans raison, et il ne coûte rien de le
-- reprendre. La défense en profondeur n'a de valeur que si on la maintient.
--
-- ⚠️ LA CAUSE EST TOUJOURS LA MÊME, et c'est ce qu'il faut retenir :
-- **`create or replace function` rend EXECUTE à PUBLIC**. Le projet l'a déjà
-- appris avec `get_session_activity` (`20260819172706`), et la migration de ce
-- matin vient de le refaire — la fonction de déclencheur n'avait pas de
-- `revoke`. Toute migration qui (re)définit une fonction doit reposer ses
-- droits dans le même fichier, y compris les fonctions de déclencheur, qui
-- n'ont aucune raison d'être appelables.
--
-- `authenticated` garde son droit sur `admin_list_audit_log` : c'est la
-- console qui la lit, et `is_admin()` fait le tri.
-- ─────────────────────────────────────────────────────────────────────────

revoke all on function public.admin_list_audit_log(int) from public, anon;
grant execute on function public.admin_list_audit_log(int) to authenticated;

revoke all on function public.team_invitations_figer_invariants() from public, anon, authenticated;
