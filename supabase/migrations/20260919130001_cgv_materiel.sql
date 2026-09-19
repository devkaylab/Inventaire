-- Conditions générales, version du 19 septembre 2026.
--
-- L'article 9.2 dit désormais en toutes lettres que le Client fournit le
-- matériel (un téléphone ou une tablette par Utilisateur) : l'Éditeur n'en vend
-- ni n'en loue. Une obligation nouvelle change le contrat accepté, donc sa
-- version.
--
-- ⚠️ JUMELLE DE `VERSION_CONDITIONS` dans `web/lib/conditions.ts` : les deux
-- bougent ensemble, un test les compare.

create or replace function public.version_conditions()
returns text
language sql
immutable
set search_path = public
as $function$ select '2026-09-19'::text $function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.version_conditions() from public, anon, authenticated;
grant execute on function public.version_conditions() to service_role;
