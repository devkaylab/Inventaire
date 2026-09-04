-- Trois écrans construisaient leur univers d'articles à chaque ouverture
-- (4 septembre 2026).
--
-- Constat de Julien : sur un compte portant un inventaire de 400 000
-- références, le tableau de bord d'atterrissage ne se rafraîchit plus.
-- Reproduit : `tableau_de_bord_superviseur` met **8 459 ms**, pour un plafond
-- de 8 s sur le rôle `authenticated`. L'écran tombe en erreur.
--
-- ⚠️ LE MOTIF EST LE MÊME AUX TROIS ENDROITS, et c'est celui qu'on corrige
-- depuis deux jours : le serveur assemble l'inventaire ENTIER pour rendre
-- trois tuiles, cinquante lignes ou un anneau à cinq parts. Le travail doit
-- dépendre de ce qu'on affiche, pas de la taille de l'inventaire.
--
-- Deux réécritures, aucune donnée nouvelle, aucun cache à invalider.
--
-- 1. L'ÉCART D'UN INVENTAIRE SE DÉCOMPOSE.
--    On calculait `Σ (compté(sku) − théorique(sku)) × prix(sku)` en
--    fabriquant d'abord l'univers des SKU (union de 800 000 lignes, triée et
--    dédoublonnée sur disque), puis trois jointures externes dessus.
--    Or la somme se sépare :
--        Σ compté×prix  −  Σ théorique×prix
--    Chaque terme est UNE jointure et UNE somme, sans univers, sans tri.
--    C'est une identité arithmétique, pas une approximation — vérifiée
--    identique au centime sur les quatre inventaires réels et sur deux jeux
--    de 400 000 références.
--    → `tableau_de_bord_superviseur` : le calcul d'écart passe de 5 767 ms
--      à quelques dizaines.
--
-- 2. L'UNIVERS EST UNE JOINTURE EXTERNE COMPLÈTE, PAS UNE UNION.
--    Le Rapport, lui, a besoin d'une ligne par SKU : on ne peut pas
--    décomposer. Mais `théorique ∪ compté` puis trois jointures gauches,
--    c'est exactement ce que fait un `full join` entre deux ensembles déjà
--    uniques par SKU — en une passe, sans dédoublonnage.
--    → `rapport_page` : 4 479 → 1 961 ms. `rapport_resume` de même.
--
--    ⚠️ LE FILTRE SUR L'INVENTAIRE SE POSE AVANT LA JOINTURE, jamais dans le
--    `on`. Dans un `full join`, une condition du `on` ne filtre pas : elle
--    décide seulement de l'appariement, et les lignes des AUTRES inventaires
--    ressortent quand même du côté externe. Essayé : 800 156 lignes au lieu
--    de 400 000. D'où la CTE `theo`, qui filtre d'abord.
--
-- 3. ET L'ANNEAU DES ÉCARTS SE DÉPARTAGE.
--    Trouvé en prouvant l'équivalence : les valeurs étaient identiques, mais
--    deux inventaires **à égalité à 0,00 €** ressortaient dans un ordre
--    différent. `order by abs(ecart_valeur) desc` sur un tableau de bord qui
--    n'en garde que cinq : à égalité, l'ordre n'était pas défini, donc les
--    parts de l'anneau pouvaient permuter d'un rafraîchissement à l'autre —
--    et la cinquième changer d'inventaire. Le défaut existait avant cette
--    réécriture ; c'est la comparaison avant/après qui l'a révélé. Même règle
--    que la pagination : un ordre doit être TOTAL.
--
-- ⚠️ CE QUI N'A PAS ÉTÉ FAIT, ET POURQUOI. Monter `work_mem` sur ces
-- fonctions supprime les derniers débordements sur disque et gagne encore
-- 200 ms — pour 100 à 300 Mo de mémoire par requête sur une machine qui en a
-- 2 Go, avec 90 connexions possibles. Le gain ne vaut pas le risque : la
-- réécriture, elle, ne coûte rien.

-- ── 1. Le tableau de bord d'atterrissage ───────────────────────────────────

create or replace function public.tableau_de_bord_superviseur(p_semaine date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
  -- ⚠️ L'ÉCART SE DÉCOMPOSE EN DEUX SOMMES INDÉPENDANTES.
  -- Σ (compté − théorique) × prix  =  Σ compté×prix − Σ théorique×prix.
  -- Plus d'univers de SKU à fabriquer, donc plus d'union de 800 000 lignes
  -- triée sur disque, ni les trois jointures externes qui suivaient. Le
  -- résultat est le même au centime — c'est de l'arithmétique.
  par_session as (
    select f.id as session_id,
           (cmp.q - th.q)                  as ecart_qte,
           (cmp.v - th.v)                  as ecart_valeur
    from fen f
    cross join lateral (
      select coalesce(sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)), 0) as q,
             coalesce(sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)
                          * coalesce(ar.unit_purchase_price, 0)), 0)              as v
      from public.article_audit a
      left join public.articles ar
        on ar.session_id = a.session_id and ar.sku = a.sku
      where a.session_id = f.id
    ) cmp
    cross join lateral (
      select coalesce(sum(t.theoretical_qty), 0)                                  as q,
             coalesce(sum(t.theoretical_qty * coalesce(ar.unit_purchase_price, 0)), 0) as v
      from public.theoretical_stock t
      left join public.articles ar
        on ar.session_id = t.session_id and ar.sku = t.sku
      where t.session_id = f.id
    ) th
  ),
  ecarts as (
    select jsonb_agg(jsonb_build_object(
             'session_id', f.id,
             'nom', coalesce(nullif(f.name, ''), f.store_name),
             'magasin', f.store_name,
             'statut', f.status,
             'ecart_qte', ps.ecart_qte,
             'ecart_valeur', round(ps.ecart_valeur, 2)
           ) order by abs(ps.ecart_valeur) desc, f.id) as liste
    from (
      select f.id, f.name, f.store_name, f.status, ps.ecart_qte, ps.ecart_valeur
      from fen f
      join par_session ps on ps.session_id = f.id
      order by abs(ps.ecart_valeur) desc, f.id
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
           ) order by abs(m.ecart_valeur) desc, m.store_id) as liste
    from (
      select f.store_id, f.store_name,
             sum(ps.ecart_qte) as ecart_qte,
             sum(ps.ecart_valeur) as ecart_valeur
      from fen f
      join par_session ps on ps.session_id = f.id
      group by f.store_id, f.store_name
      order by abs(sum(ps.ecart_valeur)) desc, f.store_id
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
$function$;

revoke all on function public.tableau_de_bord_superviseur(date) from public, anon;
grant execute on function public.tableau_de_bord_superviseur(date) to authenticated, service_role;

-- ── 2. Les totaux du Rapport ───────────────────────────────────────────────

create or replace function public.rapport_resume(p_session_id uuid)
returns table(lignes bigint, theorique numeric, compte numeric,
              ecart_unites numeric, ecart_valeur numeric, non_arbitres bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with cnt as (
    select a.sku as s,
           sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric as compte,
           case when bool_or(a.status = 'failed') then 'failed'
                when bool_or(a.status = 'pending') then 'pending'
                when bool_or(a.status = 'resolved') then 'resolved'
                else 'validated' end as statut
      from public.article_audit a
     where a.session_id = p_session_id
     group by a.sku
  ),
  -- ⚠️ Le filtre AVANT la jointure : dans un `full join`, une condition posée
  -- dans le `on` n'écarte rien, elle empêche seulement l'appariement.
  theo as (
    select t.sku, t.theoretical_qty
      from public.theoretical_stock t
     where t.session_id = p_session_id
  ),
  tout as (
    select coalesce(ts.theoretical_qty, 0)::numeric        as theo,
           coalesce(l.compte, 0)::numeric                  as cnt,
           coalesce(art.unit_purchase_price, 0)::numeric   as prix,
           coalesce(l.statut, 'uncounted')                 as statut
      from cnt l
      full join theo ts on ts.sku = l.s
      left join public.articles art
        on art.session_id = p_session_id and art.sku = coalesce(l.s, ts.sku)
  )
  select count(*)::bigint,
         coalesce(sum(theo), 0)::numeric,
         coalesce(sum(cnt), 0)::numeric,
         coalesce(sum(cnt - theo), 0)::numeric,
         coalesce(sum((cnt - theo) * prix), 0)::numeric,
         count(*) filter (where statut = 'failed')::bigint
    from tout;
end; $function$;

revoke all on function public.rapport_resume(uuid) from public, anon;
grant execute on function public.rapport_resume(uuid) to authenticated, service_role;

-- ── 3. Une page du Rapport ─────────────────────────────────────────────────

create or replace function public.rapport_page(
  p_session_id uuid,
  p_recherche text default null,
  p_tri text default 'variance_value',
  p_sens text default 'desc',
  p_offset integer default 0,
  p_limite integer default 100)
returns table(sku text, ean text, brand text, label text, unit_purchase_price numeric,
              theoretical_qty numeric, counted_qty numeric, status text,
              variance_units numeric, variance_value numeric, total bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  -- ⚠️ Le perimetre reste fixe par le SERVEUR : une page ne depasse pas 5 000
  -- lignes, quoi que demande l'appelant. C'est ce qui empeche qu'un client
  -- redemande les 400 000 d'un coup par la porte de derriere.
  v_lim int := least(greatest(coalesce(p_limite, 100), 1), 5000);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_q   text := nullif(btrim(coalesce(p_recherche, '')), '');
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with cnt as (
    select a.sku as s,
           sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric as compte,
           case when bool_or(a.status = 'failed') then 'failed'
                when bool_or(a.status = 'pending') then 'pending'
                when bool_or(a.status = 'resolved') then 'resolved'
                else 'validated' end as statut
      from public.article_audit a
     where a.session_id = p_session_id
     group by a.sku
  ),
  theo as (
    select t.sku, t.theoretical_qty
      from public.theoretical_stock t
     where t.session_id = p_session_id
  ),
  tout as (
    select coalesce(l.s, ts.sku)                            as r_sku,
           art.ean::text                                    as r_ean,
           coalesce(art.brand, '')::text                    as r_brand,
           coalesce(art.label, '')::text                    as r_label,
           coalesce(art.unit_purchase_price, 0)::numeric    as r_prix,
           coalesce(ts.theoretical_qty, 0)::numeric         as r_theo,
           coalesce(l.compte, 0)::numeric                   as r_cnt,
           coalesce(l.statut, 'uncounted')::text            as r_statut,
           (coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0))::numeric as r_vu,
           ((coalesce(l.compte, 0) - coalesce(ts.theoretical_qty, 0))
             * coalesce(art.unit_purchase_price, 0))::numeric                 as r_vv
      from cnt l
      full join theo ts on ts.sku = l.s
      left join public.articles art
        on art.session_id = p_session_id and art.sku = coalesce(l.s, ts.sku)
  ),
  filtre as (
    select * from tout
     where v_q is null
        or r_sku   ilike '%' || v_q || '%'
        or coalesce(r_ean, '')   ilike '%' || v_q || '%'
        or r_label ilike '%' || v_q || '%'
        or r_brand ilike '%' || v_q || '%'
  )
  select f.r_sku, f.r_ean, f.r_brand, f.r_label, f.r_prix,
         f.r_theo, f.r_cnt, f.r_statut, f.r_vu, f.r_vv,
         count(*) over ()::bigint
    from filtre f
   order by
     -- Colonnes de texte
     (case when p_sens <> 'desc' then
        case p_tri when 'label'  then lower(f.r_label)
                   when 'status' then f.r_statut
                   when 'sku'    then f.r_sku end end) asc nulls last,
     (case when p_sens = 'desc' then
        case p_tri when 'label'  then lower(f.r_label)
                   when 'status' then f.r_statut
                   when 'sku'    then f.r_sku end end) desc nulls last,
     -- Colonnes de nombres
     (case when p_sens <> 'desc' then
        case p_tri when 'theoretical_qty' then f.r_theo
                   when 'counted_qty'     then f.r_cnt
                   when 'variance_units'  then f.r_vu
                   when 'variance_value'  then f.r_vv end end) asc nulls last,
     (case when p_sens = 'desc' then
        case p_tri when 'theoretical_qty' then f.r_theo
                   when 'counted_qty'     then f.r_cnt
                   when 'variance_units'  then f.r_vu
                   when 'variance_value'  then f.r_vv end end) desc nulls last,
     -- ⚠️ DEPARTAGE OBLIGATOIRE. Sans un ordre TOTAL, deux lignes de meme
     -- valeur peuvent changer de place entre deux pages : on en verrait une
     -- deux fois et une autre jamais. C'est le piege classique de la
     -- pagination, et il ne se voit qu'en production.
     f.r_sku
   offset v_off limit v_lim;
end; $function$;

revoke all on function public.rapport_page(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.rapport_page(uuid, text, text, text, integer, integer) to authenticated, service_role;
