-- Un inventaire de n'importe quelle taille (3 septembre 2026)
--
-- Constat de Julien : « nous étions en inventaire ce matin et n'avons pas pu
-- utiliser l'outil ». Les journaux le confirment — sept erreurs entre 06:39 et
-- 06:47 UTC, toutes sur /rest/v1/articles, cinq depuis le navigateur et une
-- depuis l'iPhone.
--
-- ⚠️ DEUX CAUSES DISTINCTES, ET IL FAUT LES DEUX. Le correctif de la veille
-- (`etat_import` / `vider_import`) n'a fermé que la première, et seulement sur
-- le chemin de l'import.
--
-- 1. LA POLICY RLS S'ÉVALUE UNE FOIS PAR LIGNE. `is_session_participant` prend
--    la colonne de la ligne : le planificateur ne peut pas la remonter en
--    InitPlan, et la fonction porte un `set search_path` donc elle n'est jamais
--    inlinée. Mesuré sur la base réelle : 0,44 ms par appel. Le délai
--    d'`authenticated` valant 8 s (relevé sur pg_roles), TOUTE lecture directe
--    qui balaie un inventaire entier casse au-delà de ~18 000 lignes.
--      · Un COMPTEUR ne paie pas : le plan montre que sa branche part en
--        `hashed SubPlan`, évaluée une seule fois. C'est le SUPERVISEUR qui
--        paie, parce que sa branche est la première du OR.
--
-- 2. `recompute_session_audit` DÉPENDAIT DE LA FRAÎCHEUR DES STATISTIQUES.
--    Son ménage final était un `not exists` CORRÉLÉ. Mesuré sur 29 389 lignes
--    d'audit contre 58 778 comptages, mêmes données, même requête :
--      · statistiques à jour   →      53 ms   (Hash Right Anti Join)
--      · statistiques périmées →   > 45 s     (délai dépassé)
--    Un rapport de 1 000. Et elles sont PÉRIMÉES exactement au moment qui
--    compte : juste après l'import de 30 000 lignes, avant qu'autovacuum ne
--    soit passé. C'est la situation de Julien, pas un cas d'école.

-- ── 1. Le ménage de l'audit ne dépend plus du planificateur ──────────────────
--
-- ⚠️ LE MARQUEUR REMPLACE LA JOINTURE. L'upsert au-dessus touche EXACTEMENT
-- les couples (zone, sku) qui portent des comptages : il leur pose `v_marque`.
-- Ce qui reste avec une autre valeur n'a plus aucun comptage — c'est la
-- définition même de ce que l'ancien `not exists` cherchait, mais sans
-- jointure, donc sans plan à choisir. Mesuré à 87 ms sur 29 889 lignes AVEC
-- des statistiques volontairement périmées.
--
-- Ne pas « simplifier » en revenant à un `not exists` : c'est précisément la
-- forme dont le plan s'effondre.
create or replace function public.recompute_session_audit(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_failed int; v_pending int; v_total int;
  v_marque timestamptz := clock_timestamp();
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  with agg as (
    select sku, coalesce(zone, '') as zone,
      sum(qty) filter (where pass_number = 1) as q1,
      sum(qty) filter (where pass_number = 2) as q2,
      sum(qty) filter (where pass_number = 3) as q3
    from public.counts
    where session_id = p_session_id
    group by sku, coalesce(zone, '')
  )
  insert into public.article_audit (session_id, zone, sku, qty_pass1, qty_pass2, qty_pass3, status, final_qty, updated_at)
  select p_session_id, agg.zone, agg.sku, agg.q1, agg.q2, agg.q3,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then 'validated'
         when agg.q1 is not null and agg.q2 is not null and agg.q1 <> agg.q2 then 'failed'
         else 'pending' end,
    case when agg.q1 is not null and agg.q2 is not null and agg.q1 = agg.q2 then agg.q1 else null end,
    v_marque
  from agg
  on conflict (session_id, zone, sku) do update set
    qty_pass1 = excluded.qty_pass1,
    qty_pass2 = excluded.qty_pass2,
    qty_pass3 = excluded.qty_pass3,
    status    = case when public.article_audit.status = 'resolved' then 'resolved' else excluded.status end,
    final_qty = case when public.article_audit.status = 'resolved' then public.article_audit.final_qty else excluded.final_qty end,
    updated_at = v_marque;

  delete from public.article_audit a
   where a.session_id = p_session_id
     and a.updated_at is distinct from v_marque;

  select count(*) filter (where status = 'failed'),
         count(*) filter (where status = 'pending'),
         count(*)
    into v_failed, v_pending, v_total
    from public.article_audit where session_id = p_session_id;
  return jsonb_build_object('success', true, 'failed', v_failed, 'pending', v_pending, 'total', v_total);
end; $function$;

revoke all on function public.recompute_session_audit(uuid) from public, anon;
grant execute on function public.recompute_session_audit(uuid) to authenticated, service_role;

-- ── 2. Un seul garde, partagé ───────────────────────────────────────────────
--
-- « superviseur de l'inventaire OU membre » : c'est le garde que
-- `get_zone_dashboard` porte déjà, en clair, dans son corps. Les quatre
-- fonctions ci-dessous en ont besoin, et le projet a déjà payé le prix de deux
-- fonctions sœurs qui divergent (`ca_set_supervisor_stores` /
-- `ca_set_counter_stores`, 28 août). Une seule définition.
--
-- ⚠️ Elle n'est PAS une surface cliente : révoquée à `anon` comme à
-- `authenticated`. Les fonctions qui l'appellent sont SECURITY DEFINER, elles
-- s'exécutent avec les droits du propriétaire — elles n'ont pas besoin du
-- GRANT.
create or replace function public.membre_ou_superviseur(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.can_access_session(p_session_id)
      or exists (
        select 1 from public.session_members sm
        where sm.session_id = p_session_id and sm.user_id = auth.uid()
      );
$function$;

revoke all on function public.membre_ou_superviseur(uuid) from public, anon, authenticated;
grant execute on function public.membre_ou_superviseur(uuid) to service_role;

-- ── 3. Le référentiel se télécharge par tranches, sans OFFSET ───────────────
--
-- Remplace le `.range()` de `getSessionArticles` (cache hors ligne de
-- l'application). Deux gains, et le second est le plus grand :
--
--   · le contrôle se fait UNE FOIS, plus une fois par ligne ;
--   · ⚠️ LA PAGINATION EST PAR CLÉ, PLUS PAR OFFSET. Avec `OFFSET`, la page N
--     repayait le filtre sur les N × 1 000 lignes précédentes — un coût qui
--     croît avec le carré du catalogue. Mesuré sur HV (29 389 articles) :
--     page 1 → 388 ms, page 29 → 10 832 ms, au-delà des 8 s. Le cache hors
--     ligne d'un superviseur ne se remplissait donc PLUS DU TOUT au-delà de
--     ~20 000 articles, en silence.
--
-- Ne pas y remettre d'`offset` : c'est la moitié du correctif.
create or replace function public.lister_articles(
  p_session_id uuid,
  p_apres_sku text default null,
  p_limite int default 1000
)
returns table (
  id uuid, sku text, ean text, brand text, label text,
  unit_purchase_price numeric, updated_at timestamptz,
  session_id uuid, ean_norm text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_limite int := least(greatest(coalesce(p_limite, 1000), 1), 5000);
begin
  if not public.membre_ou_superviseur(p_session_id) then raise exception 'forbidden'; end if;

  return query
  select a.id, a.sku, a.ean, a.brand, a.label,
         a.unit_purchase_price, a.updated_at, a.session_id, a.ean_norm
  from public.articles a
  where a.session_id = p_session_id
    and (p_apres_sku is null or a.sku > p_apres_sku)
  order by a.sku
  limit v_limite;
end; $function$;

revoke all on function public.lister_articles(uuid, text, int) from public, anon;
grant execute on function public.lister_articles(uuid, text, int) to authenticated, service_role;

-- ── 4. Les écarts d'audit, libellés compris, en UN appel ────────────────────
--
-- Remplace `getAudits` + `getArticleLabels` de l'onglet Écarts (site) et de
-- l'écran des audits (application). Deux gains, et le second se voyait à l'œil
-- nu bien avant le délai serveur :
--
--   · le contrôle se fait une fois — la lecture directe balayait toute la
--     table `article_audit` de l'inventaire, une ligne par SKU × balise ;
--   · ⚠️ LES LIBELLÉS NE FONT PLUS 150 ALLERS-RETOURS. `getArticleLabels`
--     découpait par tranches de 200 SKU pour ne pas dépasser la longueur d'URL
--     admise : sur 30 000 références, cela faisait 150 requêtes en série.
create or replace function public.lister_ecarts(p_session_id uuid)
returns table (
  id uuid, session_id uuid, sku text, zone text,
  qty_pass1 numeric, qty_pass2 numeric, qty_pass3 numeric,
  final_qty numeric, status text, resolved_by uuid, updated_at timestamptz,
  label text, brand text, ean text, unit_purchase_price numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  return query
  select x.id, x.session_id, x.sku, x.zone,
         x.qty_pass1, x.qty_pass2, x.qty_pass3,
         x.final_qty, x.status, x.resolved_by, x.updated_at,
         a.label, a.brand, a.ean, a.unit_purchase_price
  from public.article_audit x
  left join public.articles a
    on a.session_id = x.session_id and a.sku = x.sku
  where x.session_id = p_session_id
  order by x.sku;
end; $function$;

revoke all on function public.lister_ecarts(uuid) from public, anon;
grant execute on function public.lister_ecarts(uuid) to authenticated, service_role;

-- ── 5. « Ce que J'AI compté » — et cette fois c'est vrai ────────────────────
--
-- Remplace `getMyCounts` + `getArticleLabels` de `CountedBalisesList`.
--
-- ⚠️ LE FILTRE SUR `auth.uid()` CORRIGE AUSSI UN CONTRESENS, et il est
-- antérieur au sujet de la charge. `getMyCounts` ne filtrait sur personne :
-- c'est la policy `counts_select_own` qui bornait un COMPTEUR à ses lignes. Un
-- SUPERVISEUR, lui, relève de `counts_select_supervisor` — il voyait donc
-- TOUTE L'ÉQUIPE sous un écran intitulé « ce que ce compteur a déjà compté ».
-- Même défaut, même correctif que `get_my_count_totals` le 22 août 2026.
--
-- L'agrégation est faite ici : l'écran ne recalculait des totaux par balise et
-- par référence qu'après avoir rapatrié chaque ligne de comptage.
create or replace function public.mes_balises_comptees(p_session_id uuid, p_pass int default 1)
returns table (zone text, sku text, qty numeric, label text, brand text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.membre_ou_superviseur(p_session_id) then raise exception 'forbidden'; end if;

  return query
  select coalesce(c.zone, '') as zone, c.sku, sum(c.qty)::numeric as qty,
         a.label, a.brand
  from public.counts c
  left join public.articles a
    on a.session_id = c.session_id and a.sku = c.sku
  where c.session_id = p_session_id
    and c.pass_number = p_pass
    and c.counted_by = auth.uid()
  group by coalesce(c.zone, ''), c.sku, a.label, a.brand
  -- `counts` est en ajout pur : une correction est une ligne négative. Une
  -- référence entièrement corrigée n'a plus rien à montrer.
  having sum(c.qty) > 0
  order by coalesce(c.zone, ''), c.sku;
end; $function$;

revoke all on function public.mes_balises_comptees(uuid, int) from public, anon;
grant execute on function public.mes_balises_comptees(uuid, int) to authenticated, service_role;

-- ── 6. La liste des scans d'une balise, agrégée sur le serveur ──────────────
--
-- Remplace `getMyScanEntries`, qui rapatriait chaque ligne de comptage pour en
-- faire une somme au téléphone, puis rechargeait les articles par tranches de
-- 300. En mode balise le périmètre est celui de la BALISE (tous compteurs
-- confondus, c'est ce qui permet la correction) ; en mode classique, celui du
-- compteur.
create or replace function public.scans_de_balise(
  p_session_id uuid,
  p_pass int,
  p_zone text default null
)
returns table (
  id uuid, sku text, ean text, brand text, label text,
  unit_purchase_price numeric, updated_at timestamptz,
  session_id uuid, ean_norm text,
  qty numeric, dernier_scan timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.membre_ou_superviseur(p_session_id) then raise exception 'forbidden'; end if;

  return query
  -- ⚠️ Les colonnes de la CTE sont préfixées : `qty`, `sku` et les autres
  -- sont aussi des paramètres de SORTIE de la fonction, et plpgsql refuse
  -- l'ambiguïté plutôt que de choisir.
  with agg as (
    select c.sku as a_sku, sum(c.qty)::numeric as a_qty, max(c.created_at) as a_dernier
    from public.counts c
    where c.session_id = p_session_id
      and c.pass_number = p_pass
      and (case when p_zone is null
                then c.counted_by = auth.uid()
                else coalesce(c.zone, '') = p_zone end)
    group by c.sku
    having sum(c.qty) > 0
  )
  select a.id, a.sku, a.ean, a.brand, a.label,
         a.unit_purchase_price, a.updated_at, a.session_id, a.ean_norm,
         agg.a_qty, agg.a_dernier
  from agg
  join public.articles a
    on a.session_id = p_session_id and a.sku = agg.a_sku
  order by agg.a_dernier desc;
end; $function$;

revoke all on function public.scans_de_balise(uuid, int, text) from public, anon;
grant execute on function public.scans_de_balise(uuid, int, text) to authenticated, service_role;
