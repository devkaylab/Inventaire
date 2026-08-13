-- ─────────────────────────────────────────────────────────────────────────
-- Le code magasin doit être lisible par le superviseur affecté.
--
-- `20260807000002` a rendu `stores.join_code` illisible via la clé publique
-- (`revoke select … grant select (id, company_id, name, created_at)`), pour
-- qu'un compteur ne puisse pas le lire. Bonne décision — mais `get_my_stores`,
-- la seule voie SECURITY DEFINER vers les magasins de l'utilisateur, ne
-- renvoyait que `(id, name)`. Résultat : personne ne pouvait voir le code dans
-- l'application, superviseur compris, et l'écran de profil l'affichait vide.
--
-- Or le code magasin est précisément ce que le superviseur doit pouvoir
-- communiquer : c'est lui qui accompagne les demandes d'accès de ses futurs
-- collègues superviseurs. Il doit être visible du superviseur affecté et de
-- l'administrateur, et d'eux seuls.
--
-- On ajoute donc `join_code` au retour. La confidentialité tient toujours :
-- la fonction est bornée à `store_supervisors` pour `auth.uid()`, donc un
-- compteur n'y voit rien, et la colonne reste révoquée en SELECT direct.
--
-- Changement de type de retour → drop + create (CREATE OR REPLACE le refuse).
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.get_my_stores();

create function public.get_my_stores()
returns table(id uuid, name text, join_code text)
language sql stable security definer set search_path to 'public'
as $function$
  select st.id, st.name, st.join_code
  from public.stores st
  join public.store_supervisors ss on ss.store_id = st.id
  where ss.user_id = auth.uid()
  order by st.name;
$function$;

revoke all on function public.get_my_stores() from public, anon;
grant execute on function public.get_my_stores() to authenticated;
