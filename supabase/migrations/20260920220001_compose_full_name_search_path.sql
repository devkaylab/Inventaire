-- ⚠️⚠️ CETTE MIGRATION TOUCHE QUANTINVO OS — `compose_full_name`. ⚠️⚠️
--
-- `compose_full_name` fixe son `search_path` — alignement dépôt/base.
--
-- ⚠️ CE N'EST PAS UN CHANGEMENT, C'EST UNE DÉRIVE QU'ON FERME. La base a déjà
-- `SET search_path TO 'public'` sur cette fonction ; le dépôt, non. La
-- correction a été posée directement sur la base, sans fichier. Résultat : la
-- définition qui fait foi dans le dépôt est PLUS FAIBLE que celle qui tourne,
-- et la prochaine migration qui repartirait du dépôt la ferait régresser.
--
-- ⚠️ CE N'EST PAS UNE MIGRATION ON-DEMAND, et c'est pour ça qu'elle ne porte
-- pas ce nom : `compose_full_name` appartient à Quantinvo OS. La règle du
-- 20 septembre 2026 — On-Demand n'écrit pas dans OS — vaut pour le chantier,
-- pas pour l'hygiène du dépôt.
--
-- Trouvé par `web/tests/search-path.test.ts`, écrite le même jour après que le
-- contrôle de sécurité de Supabase a signalé trois fonctions du chantier.
--
-- ⚠️ DROITS RELEVÉS SUR LA BASE AVANT ÉCRITURE (`proacl`) : `postgres`,
-- `authenticated`, `service_role`. `create or replace` rend `EXECUTE` à
-- `PUBLIC` : ils sont reposés à l'identique ci-dessous.
create or replace function public.compose_full_name(
  p_first text, p_last text, p_fallback text default ''::text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select coalesce(
    nullif(btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')), ''),
    coalesce(p_fallback, '')
  );
$function$;

revoke all on function public.compose_full_name(text, text, text) from public, anon;
grant execute on function public.compose_full_name(text, text, text) to authenticated, service_role;
