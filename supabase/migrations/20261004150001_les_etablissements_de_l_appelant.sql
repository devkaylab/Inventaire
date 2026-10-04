-- ⚠️ LA PAGE « RÉSERVER PLUSIEURS MAGASINS » LISAIT `stores` EN DIRECT
-- (4 octobre 2026).
--
-- `mesEtablissements()` faisait `from('stores').select(...)`, et `authenticated`
-- n'a **pas** le droit de lire cette table : ses droits sont `dDtm` — supprimer,
-- tronquer, déclencher — jamais `select`. Tout le reste du produit lit les
-- magasins par une fonction `security definer`, et cette page-là ne le faisait
-- pas. Résultat : « permission denied for table stores », et un écran qui n'a
-- donc JAMAIS fonctionné, ni en préversion ni en production. Il n'avait
-- simplement jamais été exercé contre une vraie base.
--
-- ⚠️ **ON N'OUVRE PAS `stores` EN LECTURE À `authenticated`.** Ce serait élargir
-- une porte dans TOUTE la production pour un écran d'une branche. La règle du
-- projet dit l'inverse : `grant` ouvre la porte, RLS trie les lignes — ici la
-- porte reste fermée et c'est la fonction qui trie.
--
-- ⚠️ ET ON NE TOUCHE PAS À `get_my_stores()`. Elle rend `id, name, join_code`
-- et sert déjà ailleurs ; lui ajouter des colonnes imposerait un `drop` et
-- ferait bouger un chemin qui marche. Une seconde fonction, qui répond à une
-- seconde question.
--
-- La jointure est la même, et ce n'est pas un hasard : `sync_company_admin_stores`
-- inscrit tout administrateur d'entreprise comme superviseur de chacun de ses
-- magasins. `store_supervisors` dit donc déjà « les établissements de cette
-- personne », pour un superviseur comme pour une enseigne.

create or replace function public.mes_etablissements()
returns table(id uuid, name text, address text, sqm integer)
language sql
stable
security definer
set search_path = public
as $function$
  select st.id, st.name, st.address, st.sqm
    from public.stores st
    join public.store_supervisors ss on ss.store_id = st.id
   where ss.user_id = auth.uid()
   order by st.name;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.mes_etablissements() from public, anon;
grant execute on function public.mes_etablissements() to authenticated, service_role;
