-- Le tableau de bord d'atterrissage du superviseur (30 août 2026).
--
-- /dashboard cesse d'être la liste des inventaires pour devenir une vue
-- d'ensemble : pièces comptées, valeur, clôtures du mois, comptages par jour,
-- écarts par inventaire, derniers inventaires. Tout est agrégé ICI, côté
-- serveur — la règle de tenue en charge interdit de télécharger les lignes de
-- `counts` pour additionner au navigateur.
--
-- Trois décisions à ne pas défaire :
--
-- · L'ÉCART SUIT LA RÈGLE DU RAPPORT, à l'identique : par SKU,
--   coalesce(final_qty, qty_pass2, qty_pass1) sur article_audit, univers =
--   stock théorique ∪ compté, valeur au prix d'achat unitaire. Deux écrans qui
--   montrent le même chiffre doivent le calculer pareil — leçon du 22 août
--   2026, quand Set up et Rapport se contredisaient.
--
-- · Les écarts ne retiennent que les inventaires QUI ONT un stock théorique :
--   sans attendu, tout le compté serait un « surplus » et le total d'écart ne
--   voudrait rien dire. Le rapport d'un tel inventaire reste consultable, il
--   n'entre simplement pas dans l'anneau du tableau de bord.
--
-- · Les dates se lisent en Europe/Paris : `created_at::date` en UTC décale
--   les comptages du soir sur le mauvais jour, et le « mois » commencerait à
--   2 h du matin.
--
-- Les pièces et valeurs comptées sont les nets de la passe 1 (les corrections
-- négatives se déduisent d'elles-mêmes) ; « valeur » vaut 0 pour un article
-- sans prix d'achat, comme dans le rapport.

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
    -- Les inventaires accessibles — le périmètre exact
    -- d'is_session_participant, posé en ensemble plutôt qu'appelé par ligne.
    select s.id, s.name, s.store_name, s.status, s.created_at, s.closed_at,
           s.inventory_number
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
    -- Les inventaires de l'anneau : clôturés depuis moins de 30 jours ou
    -- encore ouverts, et porteurs d'un stock théorique (voir l'en-tête).
    select acc.id, acc.name, acc.store_name, acc.status
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
    'derniers',           coalesce(de.liste, '[]'::jsonb)
  )
  into v_res
  from mois m
  cross join clotures cl
  cross join par_jour pj
  left join ecarts e on true
  left join derniers de on true;

  return v_res;
end;
$$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits dans la
-- même migration, comme partout depuis la leçon de `get_session_activity`.
revoke execute on function public.tableau_de_bord_superviseur(date) from public, anon;
grant execute on function public.tableau_de_bord_superviseur(date) to authenticated, service_role;
