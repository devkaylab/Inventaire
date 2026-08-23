-- Usage constaté — la lecture s'étend à tout le parc (23 août 2026)
--
-- `admin_usage_overview` ne servait qu'une entreprise : c'est ce qu'il fallait
-- pour la section de la fiche entreprise. La page /admin/usage regarde le parc
-- entier et filtre ensuite, donc elle a besoin de tout d'un coup.
--
-- ⚠️ La signature ne change PAS — `p_company_id` accepte simplement `null`
-- désormais. C'est délibéré : ajouter un paramètre aurait créé une seconde
-- fonction et rendu un appel à un argument ambigu (le piège de
-- `ca_request_store`, puis d'`admin_add_store` ce matin). L'appelant existant
-- continue de passer un uuid et ne voit aucune différence.
--
-- Chaque magasin porte maintenant son entreprise : sans elle, une liste de
-- quarante magasins ne se lit pas, et le filtre de la page n'aurait rien sur
-- quoi s'appuyer.
--
-- Coût : sans filtre, la fonction parcourt tous les comptages de tous les
-- inventaires de moins d'un an. Sans conséquence aux volumes actuels, et
-- c'est une lecture par ouverture de page, pas un sondage. À reprendre avec
-- des chiffres sous les yeux si le parc grossit — comme l'index manquant sur
-- `counts (session_id, zone, pass_number)`, noté depuis le 21 août.

create or replace function public.admin_usage_overview(p_company_id uuid default null)
returns json
language plpgsql stable security definer set search_path to 'public'
as $$
declare v json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  with sessions as (
    select s.id, s.store_id, s.created_at,
           sum(c.qty) filter (where c.pass_number = 1) as pieces,
           count(distinct c.counted_by)                as compteurs,
           count(c.id)                                 as lignes
      from public.inventory_sessions s
      left join public.counts c on c.session_id = s.id
     where (p_company_id is null or s.company_id = p_company_id)
       and s.created_at > now() - interval '12 months'
     group by s.id, s.store_id, s.created_at
  ),
  par_magasin as (
    select store_id,
           count(*)        as inventaires,
           max(pieces)     as plancher,
           max(compteurs)  as compteurs,
           max(created_at) as dernier,
           sum(lignes)     as lignes
      from sessions
     where store_id is not null
     group by store_id
  )
  select json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object(
               'id',                 st.id,
               'name',               st.name,
               'company_id',         st.company_id,
               'company_name',       co.name,
               'units',              st.units,
               'sqm',                st.sqm,
               'annual_price_cents', st.annual_price_cents,
               'inventaires',        coalesce(pm.inventaires, 0),
               'plancher',           pm.plancher,
               -- ⚠️ Peut valoir 0 alors que des lignes existent : `counted_by`
               -- passe à NULL à la suppression d'un compte. `lignes` permet de
               -- distinguer « personne n'a compté » de « on ne sait plus qui ».
               'compteurs',          coalesce(pm.compteurs, 0),
               'lignes',             coalesce(pm.lignes, 0),
               'dernier',            pm.dernier
             ) order by co.name, st.name), '[]'::json)
        from public.stores st
        join public.companies co on co.id = st.company_id
        left join par_magasin pm on pm.store_id = st.id
       where (p_company_id is null or st.company_id = p_company_id)
    ),
    'inventaires', (select count(*) from sessions),
    'compteurs_distincts', (
      select count(distinct c.counted_by)
        from public.counts c
        join public.inventory_sessions s on s.id = c.session_id
       where (p_company_id is null or s.company_id = p_company_id)
         and c.created_at > now() - interval '12 months'
    ),
    'entreprises', (
      select count(*) from public.companies co
       where (p_company_id is null or co.id = p_company_id)
    )
  ) into v;

  return v;
end; $$;

revoke all on function public.admin_usage_overview(uuid) from public, anon;
grant execute on function public.admin_usage_overview(uuid) to authenticated;

comment on function public.admin_usage_overview(uuid) is
  'Usage constaté sur 12 mois — faits seulement. `p_company_id` nul = tout le parc. Le jugement (comparaison à la tranche, règle d''asymétrie) vit dans web/lib/mesure.ts, qui se teste sans base.';
