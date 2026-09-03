-- Les écarts d'audit se lisent par pages (3 septembre 2026)
--
-- `lister_ecarts` rendait TOUTES les lignes d'audit — 400 000 sur un gros
-- inventaire, 12,9 s mesurées pour un plafond de 8 s : l'onglet ne s'ouvrait
-- plus. Et la règle qui décide CE QUI EST UN ÉCART vivait dans le navigateur
-- (`web/lib/discrepancies.ts`), donc elle ne pouvait pas paginer.
--
-- ⚠️ LA RÈGLE EST REPRISE CLAUSE PAR CLAUSE, sans en changer une virgule :
--
--   · une ligne déjà arbitrée (`resolved`) n'est pas un écart ;
--   · écart = quantité de l'AUDITEUR moins quantité du COMPTEUR, et un écart
--     nul n'est pas un écart ;
--   · dans une balise, la comparaison n'a de sens que si l'audit de CETTE
--     balise est terminé — sinon tous les articles que l'auditeur n'a pas
--     encore scannés ressortiraient à « moins le compte ». En mode classique
--     (sans balise), il suffit qu'une quantité d'audit existe.
--
-- Ne pas « simplifier » ce dernier point : c'est la règle qui évite les faux
-- positifs, et elle a été écrite pour ça.
--
-- Vérifié sur les données réelles de « Rayon textile » : les 54 lignes d'audit
-- ont été classées à la main (arbitrée, écart nul, audit de balise non
-- terminé, écart), et la fonction rend exactement les 3 écarts attendus, dans
-- le bon ordre de balises, avec le bon genre et le bon résumé.

create or replace function public.ecarts_resume(p_session_id uuid)
returns table(total bigint, unites numeric, valeur numeric,
              quantite bigint, manque_audit bigint, manque_comptage bigint,
              arbitres bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with audite as (
    select z.code from public.zones z
     where z.session_id = p_session_id and z.audit_status = 'done'
  ),
  e as (
    select coalesce(a.qty_pass1, 0)::numeric as compte,
           coalesce(a.qty_pass2, 0)::numeric as audite,
           (coalesce(a.qty_pass2, 0) - coalesce(a.qty_pass1, 0))::numeric as ecart,
           coalesce(art.unit_purchase_price, 0)::numeric as prix
      from public.article_audit a
      left join public.articles art
        on art.session_id = p_session_id and art.sku = a.sku
     where a.session_id = p_session_id
       and a.status <> 'resolved'
       and (coalesce(a.qty_pass2, 0) - coalesce(a.qty_pass1, 0)) <> 0
       and (case when coalesce(a.zone, '') <> ''
                 then a.zone in (select code from audite)
                 else a.qty_pass2 is not null end)
  )
  select count(*)::bigint,
         coalesce(sum(ecart), 0)::numeric,
         coalesce(sum(ecart * prix), 0)::numeric,
         count(*) filter (where compte <> 0 and audite <> 0)::bigint,
         count(*) filter (where audite = 0 and compte <> 0)::bigint,
         count(*) filter (where compte = 0 and audite <> 0)::bigint,
         (select count(*) from public.article_audit r
           where r.session_id = p_session_id and r.status = 'resolved')::bigint
    from e;
end; $function$;

revoke all on function public.ecarts_resume(uuid) from public, anon;
grant execute on function public.ecarts_resume(uuid) to authenticated, service_role;

create or replace function public.ecarts_page(
  p_session_id uuid, p_zone text default null,
  p_offset integer default 0, p_limite integer default 100
)
returns table(id uuid, sku text, zone text, zone_name text,
              qty_pass1 numeric, qty_pass2 numeric, final_qty numeric,
              status text, updated_at timestamptz,
              label text, brand text, ean text, unit_purchase_price numeric,
              compte numeric, audite numeric, ecart numeric, ecart_valeur numeric,
              genre text, total bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_lim int := least(greatest(coalesce(p_limite, 100), 1), 5000);
  v_off int := greatest(coalesce(p_offset, 0), 0);
  v_zone text := nullif(btrim(coalesce(p_zone, '')), '');
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with audite as (
    select z.code from public.zones z
     where z.session_id = p_session_id and z.audit_status = 'done'
  ),
  e as (
    select a.id as e_id, a.sku as e_sku, coalesce(a.zone, '') as e_zone,
           z.name as e_zone_name,
           a.qty_pass1, a.qty_pass2, a.final_qty, a.status, a.updated_at,
           coalesce(art.label, '')::text as e_label,
           coalesce(art.brand, '')::text as e_brand,
           art.ean::text as e_ean,
           coalesce(art.unit_purchase_price, 0)::numeric as e_prix,
           coalesce(a.qty_pass1, 0)::numeric as e_compte,
           coalesce(a.qty_pass2, 0)::numeric as e_audite,
           (coalesce(a.qty_pass2, 0) - coalesce(a.qty_pass1, 0))::numeric as e_ecart
      from public.article_audit a
      left join public.articles art
        on art.session_id = p_session_id and art.sku = a.sku
      left join public.zones z
        on z.session_id = p_session_id and z.code = nullif(a.zone, '')
     where a.session_id = p_session_id
       and a.status <> 'resolved'
       and (coalesce(a.qty_pass2, 0) - coalesce(a.qty_pass1, 0)) <> 0
       and (case when coalesce(a.zone, '') <> ''
                 then a.zone in (select code from audite)
                 else a.qty_pass2 is not null end)
  ),
  filtre as (
    select * from e
     where v_zone is null or coalesce(e_zone_name, '—') = v_zone
  )
  select f.e_id, f.e_sku, f.e_zone, f.e_zone_name,
         f.qty_pass1, f.qty_pass2, f.final_qty, f.status, f.updated_at,
         f.e_label, f.e_brand, f.e_ean, f.e_prix,
         f.e_compte, f.e_audite, f.e_ecart, (f.e_ecart * f.e_prix)::numeric,
         case when f.e_compte = 0 and f.e_audite <> 0 then 'missing-count'
              when f.e_audite = 0 and f.e_compte <> 0 then 'missing-audit'
              else 'quantity' end,
         count(*) over ()::bigint
    from filtre f
   -- Le même ordre que le navigateur appliquait : les balises numériques
   -- d'abord et dans l'ordre des nombres, les autres ensuite, puis le sku.
   order by case when f.e_zone <> '' and f.e_zone ~ '^[0-9]+$' then 0 else 1 end,
            case when f.e_zone <> '' and f.e_zone ~ '^[0-9]+$'
                 then f.e_zone::numeric end,
            f.e_zone,
            f.e_sku
   offset v_off limit v_lim;
end; $function$;

revoke all on function public.ecarts_page(uuid, text, integer, integer) from public, anon;
grant execute on function public.ecarts_page(uuid, text, integer, integer) to authenticated, service_role;

-- Les balises qui portent au moins un écart — pour le filtre de l'écran.
-- Elles se lisaient de la liste complète ; sans elles, le filtre disparaîtrait
-- avec la pagination.
create or replace function public.ecarts_zones(p_session_id uuid)
returns table(nom text, lignes bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with audite as (
    select z.code from public.zones z
     where z.session_id = p_session_id and z.audit_status = 'done'
  ),
  e as (
    select coalesce(z.name, '—') as n
      from public.article_audit a
      left join public.zones z
        on z.session_id = p_session_id and z.code = nullif(a.zone, '')
     where a.session_id = p_session_id
       and a.status <> 'resolved'
       and (coalesce(a.qty_pass2, 0) - coalesce(a.qty_pass1, 0)) <> 0
       and (case when coalesce(a.zone, '') <> ''
                 then a.zone in (select code from audite)
                 else a.qty_pass2 is not null end)
  )
  select e.n, count(*)::bigint from e group by e.n order by e.n;
end; $function$;

revoke all on function public.ecarts_zones(uuid) from public, anon;
grant execute on function public.ecarts_zones(uuid) to authenticated, service_role;

-- Les lignes déjà arbitrées, les plus récentes d'abord.
create or replace function public.ecarts_arbitres_page(
  p_session_id uuid, p_offset integer default 0, p_limite integer default 50
)
returns table(id uuid, sku text, zone text, zone_name text,
              qty_pass1 numeric, qty_pass2 numeric, final_qty numeric,
              updated_at timestamptz, label text, brand text, ean text,
              total bigint)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_lim int := least(greatest(coalesce(p_limite, 50), 1), 5000);
  v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  select a.id, a.sku, coalesce(a.zone, ''), z.name,
         a.qty_pass1, a.qty_pass2, a.final_qty, a.updated_at,
         coalesce(art.label, '')::text, coalesce(art.brand, '')::text, art.ean::text,
         count(*) over ()::bigint
    from public.article_audit a
    left join public.articles art on art.session_id = p_session_id and art.sku = a.sku
    left join public.zones    z   on z.session_id = p_session_id and z.code = nullif(a.zone, '')
   where a.session_id = p_session_id and a.status = 'resolved'
   -- ⚠️ `a.id` départage : deux arbitrages faits dans la même seconde ont le
   -- même `updated_at`, et sans ordre total la pagination en répéterait un.
   order by a.updated_at desc nulls last, a.id
   offset v_off limit v_lim;
end; $function$;

revoke all on function public.ecarts_arbitres_page(uuid, integer, integer) from public, anon;
grant execute on function public.ecarts_arbitres_page(uuid, integer, integer) to authenticated, service_role;
