-- Les tableaux de bord d'entreprise et de la console (30 août 2026).
--
-- Deux ajouts pour porter les maquettes validées :
--
-- 1. `tableau_de_bord_superviseur` rend aussi `ecarts_magasins` — les mêmes
--    écarts, sur la même fenêtre de 30 jours et avec LA MÊME règle que le
--    rapport, mais groupés par magasin : c'est ainsi que l'administrateur
--    d'entreprise pilote (il tient des magasins, pas des inventaires).
--    L'administrateur passe déjà par cette fonction — son rôle est
--    `supervisor`, et son périmètre couvre toute l'entreprise.
--
-- 2. `admin_revenu_par_entreprise` — le revenu annuel par entreprise, pour
--    l'anneau de la console. ⚠️ Il reprend EXACTEMENT la règle de l'ARR
--    d'`admin_business_overview` : somme de coalesce(annual_price_cents,
--    370000) — le panier moyen des magasins non tarifés. Les deux constantes
--    doivent bouger ensemble, un test de garde les compare : un anneau qui ne
--    totalise pas la tuile, c'est deux versions du même chiffre.

create or replace function public.tableau_de_bord_superviseur(p_semaine date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_role  text;
  v_jour  date := (now() at time zone 'Europe/Paris')::date;
  v_mois  date;
  v_prec  date;
  v_lundi date;
  v_res   jsonb;
begin
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'supervisor' then
    raise exception 'forbidden';
  end if;

  v_mois  := date_trunc('month', v_jour)::date;
  v_prec  := (date_trunc('month', v_jour) - interval '1 month')::date;
  v_lundi := date_trunc('week', coalesce(p_semaine, v_jour))::date;

  with acc as (
    select s.id, s.name, s.store_name, s.store_id, s.status, s.created_at,
           s.closed_at, s.inventory_number
    from public.inventory_sessions s
    where s.company_id = public.get_my_company()
      and (
        s.created_by = v_uid
        or public.is_company_admin(s.company_id)
        or exists (select 1 from public.session_members sm
                   where sm.session_id = s.id and sm.user_id = v_uid)
      )
  ),
  c as (
    select c.session_id,
           c.qty,
           (c.created_at at time zone 'Europe/Paris')::date as jour,
           c.qty * coalesce(a.unit_purchase_price, 0) as valeur
    from public.counts c
    join acc on acc.id = c.session_id
    left join public.articles a
      on a.session_id = c.session_id and a.sku = c.sku
    where c.pass_number = 1
  ),
  mois as (
    select
      coalesce(sum(qty)    filter (where jour >= v_mois), 0)                       as pieces,
      coalesce(sum(qty)    filter (where jour >= v_prec and jour < v_mois), 0)     as pieces_prec,
      coalesce(sum(valeur) filter (where jour >= v_mois), 0)                       as valeur,
      coalesce(sum(valeur) filter (where jour >= v_prec and jour < v_mois), 0)     as valeur_prec
    from c
  ),
  clotures as (
    select
      count(*) filter (where (closed_at at time zone 'Europe/Paris')::date >= v_mois) as ce_mois,
      count(*) filter (where (closed_at at time zone 'Europe/Paris')::date >= v_prec
                         and (closed_at at time zone 'Europe/Paris')::date < v_mois)  as mois_prec
    from acc
    where status = 'closed' and closed_at is not null
  ),
  par_jour as (
    select jsonb_agg(jsonb_build_object(
             'jour', j.d,
             'pieces', coalesce(t.pieces, 0),
             'valeur', coalesce(t.valeur, 0)
           ) order by j.d) as jours
    from generate_series(v_lundi, v_lundi + 6, interval '1 day') as j(d)
    left join (
      select jour, sum(qty) as pieces, sum(valeur) as valeur
      from c
      where jour >= v_lundi and jour <= v_lundi + 6
      group by jour
    ) t on t.jour = j.d::date
  ),
  fen as (
    select acc.id, acc.name, acc.store_name, acc.store_id, acc.status
    from acc
    where (acc.status <> 'closed'
           or (acc.closed_at is not null and acc.closed_at >= now() - interval '30 days'))
      and exists (select 1 from public.theoretical_stock t where t.session_id = acc.id)
  ),
  lignes as (
    select a.session_id, a.sku,
           sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric as compte
    from public.article_audit a
    join fen on fen.id = a.session_id
    group by a.session_id, a.sku
  ),
  univers as (
    select t.session_id, t.sku
    from public.theoretical_stock t
    join fen on fen.id = t.session_id
    union
    select l.session_id, l.sku from lignes l
  ),
  par_session as (
    select u.session_id,
           sum(coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0)) as ecart_qte,
           sum((coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0))
               * coalesce(art.unit_purchase_price, 0))                  as ecart_valeur
    from univers u
    left join lignes l  on l.session_id = u.session_id and l.sku = u.sku
    left join public.articles art
      on art.session_id = u.session_id and art.sku = u.sku
    left join public.theoretical_stock ts
      on ts.session_id = u.session_id and ts.sku = u.sku
    group by u.session_id
  ),
  ecarts as (
    select jsonb_agg(jsonb_build_object(
             'session_id', f.id,
             'nom', coalesce(nullif(f.name, ''), f.store_name),
             'magasin', f.store_name,
             'statut', f.status,
             'ecart_qte', ps.ecart_qte,
             'ecart_valeur', round(ps.ecart_valeur, 2)
           ) order by abs(ps.ecart_valeur) desc) as liste
    from (
      select f.id, f.name, f.store_name, f.status, ps.ecart_qte, ps.ecart_valeur
      from fen f
      join par_session ps on ps.session_id = f.id
      order by abs(ps.ecart_valeur) desc
      limit 5
    ) as f
    join par_session ps on ps.session_id = f.id
  ),
  ecarts_magasins as (
    select jsonb_agg(jsonb_build_object(
             'store_id', m.store_id,
             'nom', m.store_name,
             'ecart_qte', m.ecart_qte,
             'ecart_valeur', round(m.ecart_valeur, 2)
           ) order by abs(m.ecart_valeur) desc) as liste
    from (
      select f.store_id, f.store_name,
             sum(ps.ecart_qte) as ecart_qte,
             sum(ps.ecart_valeur) as ecart_valeur
      from fen f
      join par_session ps on ps.session_id = f.id
      group by f.store_id, f.store_name
      order by abs(sum(ps.ecart_valeur)) desc
      limit 5
    ) as m
  ),
  derniers as (
    select jsonb_agg(jsonb_build_object(
             'session_id', d.id,
             'nom', coalesce(nullif(d.name, ''), d.store_name),
             'magasin', d.store_name,
             'numero', d.inventory_number,
             'statut', d.status,
             'cree_le', d.created_at,
             'pieces', coalesce(t.pieces, 0),
             'valeur', round(coalesce(t.valeur, 0), 2)
           ) order by d.created_at desc) as liste
    from (
      select acc.id, acc.name, acc.store_name, acc.inventory_number,
             acc.status, acc.created_at
      from acc
      order by acc.created_at desc
      limit 4
    ) as d
    left join (
      select session_id, sum(qty) as pieces, sum(valeur) as valeur
      from c
      group by session_id
    ) t on t.session_id = d.id
  )
  select jsonb_build_object(
    'pieces_mois',        m.pieces,
    'pieces_mois_prec',   m.pieces_prec,
    'valeur_mois',        round(m.valeur, 2),
    'valeur_mois_prec',   round(m.valeur_prec, 2),
    'clotures_mois',      cl.ce_mois,
    'clotures_mois_prec', cl.mois_prec,
    'semaine_debut',      v_lundi,
    'par_jour',           coalesce(pj.jours, '[]'::jsonb),
    'ecarts',             coalesce(e.liste, '[]'::jsonb),
    'ecarts_magasins',    coalesce(em.liste, '[]'::jsonb),
    'derniers',           coalesce(de.liste, '[]'::jsonb)
  )
  into v_res
  from mois m
  cross join clotures cl
  cross join par_jour pj
  left join ecarts e on true
  left join ecarts_magasins em on true
  left join derniers de on true;

  return v_res;
end;
$$;

revoke execute on function public.tableau_de_bord_superviseur(date) from public, anon;
grant execute on function public.tableau_de_bord_superviseur(date) to authenticated, service_role;

create or replace function public.admin_revenu_par_entreprise()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  -- ⚠️ La même constante qu'admin_business_overview : le panier moyen d'un
  -- magasin non tarifé. Les deux bougent ensemble.
  v_defaut_cents constant integer := 370000;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_cents', (select coalesce(sum(coalesce(annual_price_cents, v_defaut_cents)), 0) from public.stores),
    'entreprises', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'nom', e.name, 'revenu_cents', e.revenu
             ) order by e.revenu desc)
      from (
        select c.id, c.name,
               coalesce(sum(coalesce(s.annual_price_cents, v_defaut_cents)), 0) as revenu
        from public.companies c
        left join public.stores s on s.company_id = c.id
        group by c.id, c.name
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_revenu_par_entreprise() from public, anon;
grant execute on function public.admin_revenu_par_entreprise() to authenticated, service_role;
