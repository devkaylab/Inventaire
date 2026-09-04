-- Le rapport consolidé d'un magasin (4 septembre 2026)
--
-- Julien : « Commence d'abord par le rapport par magasin, qui sera également
-- consultable par l'admin entreprise en plus de admin Quantinvo. »
--
-- Jusqu'ici un rapport se lit inventaire par inventaire. Un grand magasin en
-- ouvre un par étage, par réserve, par corner : personne ne pouvait dire ce
-- que le magasin, entier, avait donné.
--
-- ⚠️ QUATRE DÉCISIONS PORTENT CE FICHIER, et elles ne se devinent pas dans le
-- SQL.
--
-- 1. QUI Y A ACCÈS : l'administrateur de l'entreprise et l'administrateur
--    Quantinvo, personne d'autre. Décision de Julien : « le superviseur d'un
--    secteur n'a pas besoin de voir le rapport de son collègue d'un autre
--    secteur du magasin ». Un superviseur garde le rapport de SES inventaires,
--    par les fonctions existantes.
--
-- 2. SEULS LES INVENTAIRES CLÔTURÉS ENTRENT DANS LE TOTAL, et c'est le
--    SERVEUR qui le décide, pas la case cochée. Un inventaire en cours ferait
--    bouger le rapport d'heure en heure : on le liste, on ne l'additionne pas.
--
-- 3. LES QUANTITÉS S'ADDITIONNENT quand une référence est comptée dans
--    plusieurs inventaires (arbitré par Julien), et le rapport le SIGNALE —
--    d'où `doublons` dans le résumé et la colonne `inventaires` du tableau.
--    Une référence vue deux fois n'est pas une anomalie dans un magasin qui
--    compte étage par étage, mais on ne laisse pas le lecteur le découvrir.
--
-- 4. LE PÉRIMÈTRE EST UNE LISTE D'INVENTAIRES, jamais une plage de dates
--    posée en base. Les dates servent à préparer la sélection à l'écran ; ce
--    qui est additionné est ce qui est coché. Sans cela, deux écrans ouverts
--    sur la même période ne montreraient pas la même chose dès qu'un
--    inventaire est clôturé entre-temps.
--
-- ⚠️ CE QUE `p_sessions` NE PERMET PAS. C'est une liste choisie par le
-- client, donc le motif que VR-007 a fermé — sauf que le périmètre reste
-- fixé par le serveur : chaque identifiant est confronté au magasin visé
-- (`store_id = p_store_id`), et le magasin à l'entreprise de l'appelant. Un
-- inventaire d'ailleurs n'est pas refusé, il est simplement absent du
-- résultat. La liste est bornée à 200 entrées : un magasin en a quelques
-- dizaines par an, et une liste sans borne est une invitation.
--
-- ⚠️ LA VALEUR SE CALCULE INVENTAIRE PAR INVENTAIRE, PUIS S'ADDITIONNE.
-- `articles.unit_purchase_price` est porté PAR INVENTAIRE : le même SKU peut
-- valoir 41 € sur celui de septembre et 38 € sur celui d'août. Un prix moyen
-- serait une invention. On calcule donc Σ (compté − théorique) × prix POUR
-- CHAQUE inventaire, et on somme — c'est la seule valeur qui ait un sens, et
-- c'est exactement ce que le client retrouve en additionnant ses rapports.

-- ── La garde, en un seul point ─────────────────────────────────────────────
--
-- ⚠️ Ce n'est PAS une surface cliente : révoquée à `anon` comme à
-- `authenticated`. Les quatre fonctions qui l'appellent sont SECURITY
-- DEFINER, elles s'exécutent avec les droits du propriétaire. Elle existe
-- parce que quatre fonctions portaient le même garde, et que le projet a déjà
-- payé le prix de deux fonctions sœurs qui divergent (VR-006).

create or replace function public.peut_lire_rapport_magasin(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
      from public.stores s
     where s.id = p_store_id
       and (public.is_admin() or public.is_company_admin(s.company_id))
  )
$function$;

revoke all on function public.peut_lire_rapport_magasin(uuid) from public, anon, authenticated;
grant execute on function public.peut_lire_rapport_magasin(uuid) to service_role;

-- ── 1. Le magasin, et ses inventaires à cocher ────────────────────────────
--
-- ⚠️ ELLE REND AUSSI L'IDENTITÉ DU MAGASIN, et ce n'est pas de la commodité :
-- l'administrateur Quantinvo n'a pas de `company_id`, donc `ca_store_detail`
-- lui est fermée. Sans ce bloc, l'écran devrait aller chercher le nom du
-- magasin par un chemin réservé au client — ou l'afficher sans titre.

create or replace function public.rapport_magasin_inventaires(
  p_store_id uuid,
  p_du date default null,
  p_au date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_res jsonb;
begin
  if not public.peut_lire_rapport_magasin(p_store_id) then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'magasin', (
      select jsonb_build_object('id', s.id, 'nom', s.name,
                                'entreprise', c.name, 'entreprise_id', c.id)
        from public.stores s
        join public.companies c on c.id = s.company_id
       where s.id = p_store_id),
    'inventaires', coalesce((
      select jsonb_agg(jsonb_build_object(
               'session_id', x.id,
               'nom', coalesce(nullif(btrim(x.name), ''), x.inventory_number),
               'numero', x.inventory_number,
               'statut', x.status,
               'cloture_le', x.closed_at,
               'cree_le', x.created_at,
               -- Un ordre de grandeur, pas le décompte du rapport : compter
               -- l'univers réel (théorique ∪ compté) de chaque inventaire de
               -- la liste coûterait plusieurs secondes pour un sélecteur.
               'references_attendues',
               (select count(*) from public.theoretical_stock t where t.session_id = x.id),
               'dans_periode',
               (x.status = 'closed'
                and x.closed_at is not null
                and (p_du is null or (x.closed_at at time zone 'Europe/Paris')::date >= p_du)
                and (p_au is null or (x.closed_at at time zone 'Europe/Paris')::date <= p_au))
             ) order by coalesce(x.closed_at, x.created_at) desc, x.id)
        from (
          select * from public.inventory_sessions y
           where y.store_id = p_store_id
           order by coalesce(y.closed_at, y.created_at) desc, y.id
           limit 100
        ) x), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$function$;

revoke all on function public.rapport_magasin_inventaires(uuid, date, date) from public, anon;
grant execute on function public.rapport_magasin_inventaires(uuid, date, date) to authenticated, service_role;

-- ── 2. Les totaux du magasin ───────────────────────────────────────────────

create or replace function public.rapport_magasin_resume(
  p_store_id uuid,
  p_sessions uuid[])
returns table(inventaires bigint, lignes bigint, doublons bigint,
              theorique numeric, compte numeric,
              ecart_unites numeric, ecart_valeur numeric, non_arbitres bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_sessions uuid[] := (coalesce(p_sessions, '{}'::uuid[]))[1:200];
begin
  if not public.peut_lire_rapport_magasin(p_store_id) then
    raise exception 'forbidden';
  end if;

  return query
  with sess as (
    select s.id
      from public.inventory_sessions s
     where s.store_id = p_store_id
       and s.status = 'closed'
       and s.id = any(v_sessions)
  ),
  -- ⚠️ LES QUATRE TUILES SE DÉCOMPOSENT, comme le tableau de bord du
  -- 4 septembre : Σ (compté − théo) × prix = Σ compté×prix − Σ théo×prix.
  -- Chaque terme est une jointure et une somme, par inventaire. Pas
  -- d'univers de SKU à fabriquer, donc pas de tri sur disque.
  par_session as (
    select cmp.q as cq, cmp.v as cv, cmp.echecs, th.q as tq, th.v as tv
      from sess f
      cross join lateral (
        select coalesce(sum(g.q), 0)                                          as q,
               coalesce(sum(g.q * coalesce(ar.unit_purchase_price, 0)), 0)     as v,
               count(*) filter (where g.echec)                                 as echecs
          from (
            select a.sku,
                   sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)) as q,
                   bool_or(a.status = 'failed')                            as echec
              from public.article_audit a
             where a.session_id = f.id
             group by a.sku
          ) g
          left join public.articles ar
            on ar.session_id = f.id and ar.sku = g.sku
      ) cmp
      cross join lateral (
        select coalesce(sum(t.theoretical_qty), 0)                              as q,
               coalesce(sum(t.theoretical_qty
                            * coalesce(ar.unit_purchase_price, 0)), 0)          as v
          from public.theoretical_stock t
          left join public.articles ar
            on ar.session_id = t.session_id and ar.sku = t.sku
         where t.session_id = f.id
      ) th
  ),
  -- L'univers, lui, ne se décompose pas : dire combien de références le
  -- magasin porte, et combien reviennent dans plusieurs inventaires, demande
  -- de les rassembler. Une passe, en une agrégation.
  univers as (
    select u.sku, count(*) as n
      from (
        select a.session_id, a.sku
          from public.article_audit a join sess on sess.id = a.session_id
        union
        select t.session_id, t.sku
          from public.theoretical_stock t join sess on sess.id = t.session_id
      ) u
     group by u.sku
  )
  select (select count(*) from sess)::bigint,
         (select count(*) from univers)::bigint,
         (select count(*) from univers where n > 1)::bigint,
         coalesce((select sum(tq) from par_session), 0)::numeric,
         coalesce((select sum(cq) from par_session), 0)::numeric,
         coalesce((select sum(cq - tq) from par_session), 0)::numeric,
         coalesce((select sum(cv - tv) from par_session), 0)::numeric,
         coalesce((select sum(echecs) from par_session), 0)::bigint;
end;
$function$;

revoke all on function public.rapport_magasin_resume(uuid, uuid[]) from public, anon;
grant execute on function public.rapport_magasin_resume(uuid, uuid[]) to authenticated, service_role;

-- ── 3. Une page du rapport consolidé ───────────────────────────────────────

create or replace function public.rapport_magasin_page(
  p_store_id uuid,
  p_sessions uuid[],
  p_recherche text default null,
  p_tri text default 'variance_value',
  p_sens text default 'desc',
  p_offset integer default 0,
  p_limite integer default 50,
  p_multi_seulement boolean default false)
returns table(sku text, ean text, brand text, label text,
              theoretical_qty numeric, counted_qty numeric,
              variance_units numeric, variance_value numeric,
              inventaires bigint, total bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  -- Le périmètre reste fixé par le serveur : une page ne dépasse pas 5 000
  -- lignes quoi que demande l'appelant. Même borne que `rapport_page`.
  v_lim      int := least(greatest(coalesce(p_limite, 50), 1), 5000);
  v_off      int := greatest(coalesce(p_offset, 0), 0);
  v_q        text := nullif(btrim(coalesce(p_recherche, '')), '');
  v_sessions uuid[] := (coalesce(p_sessions, '{}'::uuid[]))[1:200];
begin
  if not public.peut_lire_rapport_magasin(p_store_id) then
    raise exception 'forbidden';
  end if;

  return query
  with sess as (
    select s.id
      from public.inventory_sessions s
     where s.store_id = p_store_id
       and s.status = 'closed'
       and s.id = any(v_sessions)
  ),
  cnt as (
    select a.session_id, a.sku,
           sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric as q
      from public.article_audit a
      join sess on sess.id = a.session_id
     group by a.session_id, a.sku
  ),
  theo as (
    select t.session_id, t.sku, t.theoretical_qty
      from public.theoretical_stock t
      join sess on sess.id = t.session_id
  ),
  -- ⚠️ Les deux côtés sont DÉJÀ filtrés par la jointure sur `sess` : la
  -- condition du `on` ne sert donc qu'à l'appariement, ce qu'elle doit être.
  -- (Le piège du 4 septembre : dans un `full join`, un filtre posé dans le
  -- `on` laisse ressortir les lignes des autres inventaires.)
  paire as (
    select coalesce(c.session_id, th.session_id) as session_id,
           coalesce(c.sku, th.sku)               as sku,
           coalesce(c.q, 0)                      as cnt,
           coalesce(th.theoretical_qty, 0)       as theo
      from cnt c
      full join theo th
        on th.session_id = c.session_id and th.sku = c.sku
  ),
  par_sku as (
    select p.sku,
           sum(p.theo)                                     as r_theo,
           sum(p.cnt)                                      as r_cnt,
           sum(p.cnt - p.theo)                             as r_vu,
           sum((p.cnt - p.theo)
               * coalesce(ar.unit_purchase_price, 0))      as r_vv,
           count(*)                                        as r_inv
      from paire p
      left join public.articles ar
        on ar.session_id = p.session_id and ar.sku = p.sku
     group by p.sku
  ),
  -- La recherche porte sur le libellé, la marque et le code-barres, qui
  -- vivent dans `articles` : on retrouve d'abord les références qui
  -- correspondent, puis on filtre l'agrégat. L'inverse obligerait à porter
  -- la fiche de chaque référence du magasin jusqu'au tri.
  trouve as (
    select distinct ar.sku
      from public.articles ar
      join sess on sess.id = ar.session_id
     where v_q is not null
       and (ar.sku ilike '%' || v_q || '%'
         or coalesce(ar.ean, '') ilike '%' || v_q || '%'
         or coalesce(ar.label, '') ilike '%' || v_q || '%'
         or coalesce(ar.brand, '') ilike '%' || v_q || '%')
  ),
  filtre as (
    select * from par_sku k
     where (not coalesce(p_multi_seulement, false) or k.r_inv > 1)
       and (v_q is null
            or k.sku ilike '%' || v_q || '%'
            or exists (select 1 from trouve t where t.sku = k.sku))
  ),
  page as (
    select f.*, count(*) over ()::bigint as r_total
      from filtre f
     order by
       (case when p_sens <> 'desc' and p_tri = 'sku' then f.sku end) asc nulls last,
       (case when p_sens =  'desc' and p_tri = 'sku' then f.sku end) desc nulls last,
       (case when p_sens <> 'desc' then
          case p_tri when 'theoretical_qty' then f.r_theo
                     when 'counted_qty'     then f.r_cnt
                     when 'variance_units'  then f.r_vu
                     when 'variance_value'  then f.r_vv
                     when 'inventaires'     then f.r_inv::numeric end end) asc nulls last,
       (case when p_sens =  'desc' then
          case p_tri when 'theoretical_qty' then f.r_theo
                     when 'counted_qty'     then f.r_cnt
                     when 'variance_units'  then f.r_vu
                     when 'variance_value'  then f.r_vv
                     when 'inventaires'     then f.r_inv::numeric end end) desc nulls last,
       -- ⚠️ DÉPARTAGE OBLIGATOIRE : sans ordre total, une même valeur change
       -- de place d'une page à l'autre et une ligne se voit deux fois.
       f.sku
     offset v_off limit v_lim
  )
  -- La fiche de l'article ne se cherche que pour les lignes affichées, et on
  -- prend la plus récente : le libellé d'un référentiel réimporté a pu
  -- changer entre deux inventaires.
  select g.sku::text, fi.ean::text, coalesce(fi.brand, '')::text,
         coalesce(fi.label, '')::text,
         g.r_theo::numeric, g.r_cnt::numeric, g.r_vu::numeric, g.r_vv::numeric,
         g.r_inv::bigint, g.r_total
    from page g
    left join lateral (
      select ar.ean, ar.brand, ar.label
        from public.articles ar
        join sess on sess.id = ar.session_id
       where ar.sku = g.sku
       order by ar.updated_at desc nulls last
       limit 1
    ) fi on true;
end;
$function$;

revoke all on function public.rapport_magasin_page(uuid, uuid[], text, text, text, integer, integer, boolean) from public, anon;
grant execute on function public.rapport_magasin_page(uuid, uuid[], text, text, text, integer, integer, boolean) to authenticated, service_role;

-- ── 4. Le détail, une ligne par inventaire (pour l'export) ─────────────────
--
-- La feuille consolidée dit ce que le magasin a donné ; celle-ci dit d'OÙ
-- vient chaque ligne. C'est la contrepartie de l'addition : sans elle, un
-- écart de 12 pièces sur une référence vue dans trois inventaires ne se
-- rattache à aucun rayon.

create or replace function public.rapport_magasin_detail(
  p_store_id uuid,
  p_sessions uuid[],
  p_offset integer default 0,
  p_limite integer default 5000)
returns table(inventaire text, numero text, sku text, ean text, brand text, label text,
              theoretical_qty numeric, counted_qty numeric,
              variance_units numeric, variance_value numeric, total bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_lim      int := least(greatest(coalesce(p_limite, 5000), 1), 5000);
  v_off      int := greatest(coalesce(p_offset, 0), 0);
  v_sessions uuid[] := (coalesce(p_sessions, '{}'::uuid[]))[1:200];
begin
  if not public.peut_lire_rapport_magasin(p_store_id) then
    raise exception 'forbidden';
  end if;

  return query
  with sess as (
    select s.id,
           coalesce(nullif(btrim(s.name), ''), s.inventory_number) as nom,
           s.inventory_number as numero
      from public.inventory_sessions s
     where s.store_id = p_store_id
       and s.status = 'closed'
       and s.id = any(v_sessions)
  ),
  cnt as (
    select a.session_id, a.sku,
           sum(coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0))::numeric as q
      from public.article_audit a
      join sess on sess.id = a.session_id
     group by a.session_id, a.sku
  ),
  theo as (
    select t.session_id, t.sku, t.theoretical_qty
      from public.theoretical_stock t
      join sess on sess.id = t.session_id
  ),
  paire as (
    select coalesce(c.session_id, th.session_id) as session_id,
           coalesce(c.sku, th.sku)               as sku,
           coalesce(c.q, 0)                      as cnt,
           coalesce(th.theoretical_qty, 0)       as theo
      from cnt c
      full join theo th
        on th.session_id = c.session_id and th.sku = c.sku
  )
  select s.nom::text, s.numero::text, p.sku::text, ar.ean::text,
         coalesce(ar.brand, '')::text, coalesce(ar.label, '')::text,
         p.theo::numeric, p.cnt::numeric,
         (p.cnt - p.theo)::numeric,
         ((p.cnt - p.theo) * coalesce(ar.unit_purchase_price, 0))::numeric,
         count(*) over ()::bigint
    from paire p
    join sess s on s.id = p.session_id
    left join public.articles ar
      on ar.session_id = p.session_id and ar.sku = p.sku
   order by s.numero, p.sku
   offset v_off limit v_lim;
end;
$function$;

revoke all on function public.rapport_magasin_detail(uuid, uuid[], integer, integer) from public, anon;
grant execute on function public.rapport_magasin_detail(uuid, uuid[], integer, integer) to authenticated, service_role;
