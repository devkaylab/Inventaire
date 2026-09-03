-- Les deux écrans n'ordonnent pas les écarts pareil, et c'est voulu
-- (3 septembre 2026)
--
-- Le SITE range par balise : on relève méthodiquement, balise après balise.
-- Le TÉLÉPHONE met en premier les balises qui portent encore un écart non
-- arbitré, et dans chaque balise les lignes à trancher avant les autres —
-- quelqu'un debout dans un rayon veut ce qu'il reste à faire.
--
-- Tant que tout tenait dans une seule réponse, chaque écran triait chez lui.
-- Avec la pagination, l'ordre DÉCIDE DU CONTENU DE LA PAGE : il doit donc
-- venir du serveur, et rester différent sur les deux écrans. D'où `p_ordre`,
-- qui choisit entre deux branches écrites en clair — jamais du SQL fabriqué.
--
-- ⚠️ Et les deux fonctions rendent la LIGNE ENTIÈRE. Trouvé par le typage de
-- l'application, pas à la lecture : il manquait `session_id`, `qty_pass3` et
-- `resolved_by`. Les compléter côté client aurait voulu dire les INVENTER — et
-- `resolved_by` inventé, c'est « qui a tranché » qui devient faux.
--
-- ⚠️ Les anciennes signatures sont SUPPRIMÉES, pas laissées à côté : avec un
-- paramètre à défaut, Postgres garderait les deux et un appel nommé
-- deviendrait ambigu (piège de `p_event_id` et de `ca_request_store`).

drop function if exists public.ecarts_page(uuid, text, integer, integer);
drop function if exists public.ecarts_page(uuid, text, integer, integer, text);

create or replace function public.ecarts_page(
  p_session_id uuid, p_zone text default null,
  p_offset integer default 0, p_limite integer default 100,
  p_ordre text default 'balise'
)
returns table(id uuid, session_id uuid, sku text, zone text, zone_name text,
              qty_pass1 numeric, qty_pass2 numeric, qty_pass3 numeric,
              final_qty numeric, status text, resolved_by uuid, updated_at timestamptz,
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
  v_ordre text := case when p_ordre = 'a_traiter' then 'a_traiter' else 'balise' end;
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;
  return query
  with audite as (
    select z.code from public.zones z
     where z.session_id = p_session_id and z.audit_status = 'done'
  ),
  e as (
    select a.id as e_id, a.session_id as e_sid, a.sku as e_sku,
           coalesce(a.zone, '') as e_zone, z.name as e_zone_name,
           a.qty_pass1, a.qty_pass2, a.qty_pass3, a.final_qty, a.status,
           a.resolved_by, a.updated_at,
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
    select e.*,
           -- La balise porte-t-elle encore un écart à trancher ? C'est ce qui
           -- la fait remonter sur le téléphone.
           bool_or(e.status = 'failed')  over (partition by e.e_zone) as z_failed,
           bool_or(e.status = 'pending') over (partition by e.e_zone) as z_pending
      from e
     where v_zone is null or coalesce(e.e_zone_name, '—') = v_zone
  )
  select f.e_id, f.e_sid, f.e_sku, f.e_zone, f.e_zone_name,
         f.qty_pass1, f.qty_pass2, f.qty_pass3, f.final_qty, f.status,
         f.resolved_by, f.updated_at,
         f.e_label, f.e_brand, f.e_ean, f.e_prix,
         f.e_compte, f.e_audite, f.e_ecart, (f.e_ecart * f.e_prix)::numeric,
         case when f.e_compte = 0 and f.e_audite <> 0 then 'missing-count'
              when f.e_audite = 0 and f.e_compte <> 0 then 'missing-audit'
              else 'quantity' end,
         count(*) over ()::bigint
    from filtre f
   order by
     -- Le téléphone d'abord : ce qui reste à faire remonte.
     case when v_ordre = 'a_traiter' then (case when f.z_failed  then 0 else 1 end) end,
     case when v_ordre = 'a_traiter' then (case when f.z_pending then 0 else 1 end) end,
     -- Puis, pour les deux : les balises numériques dans l'ordre des nombres.
     case when f.e_zone <> '' and f.e_zone ~ '^[0-9]+$' then 0 else 1 end,
     case when f.e_zone <> '' and f.e_zone ~ '^[0-9]+$' then f.e_zone::numeric end,
     f.e_zone,
     -- Dans une balise, le téléphone trie par statut avant le sku.
     case when v_ordre = 'a_traiter'
          then (case f.status when 'failed' then 0 when 'pending' then 1
                              when 'resolved' then 2 else 3 end) end,
     -- ⚠️ DÉPARTAGE OBLIGATOIRE : sans ordre total, une page peut répéter une
     -- ligne et en sauter une autre.
     f.e_sku
   offset v_off limit v_lim;
end; $function$;

revoke all on function public.ecarts_page(uuid, text, integer, integer, text) from public, anon;
grant execute on function public.ecarts_page(uuid, text, integer, integer, text) to authenticated, service_role;

drop function if exists public.ecarts_arbitres_page(uuid, integer, integer);

create or replace function public.ecarts_arbitres_page(
  p_session_id uuid, p_offset integer default 0, p_limite integer default 50
)
returns table(id uuid, session_id uuid, sku text, zone text, zone_name text,
              qty_pass1 numeric, qty_pass2 numeric, qty_pass3 numeric,
              final_qty numeric, status text, resolved_by uuid, updated_at timestamptz,
              label text, brand text, ean text, total bigint)
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
  select a.id, a.session_id, a.sku, coalesce(a.zone, ''), z.name,
         a.qty_pass1, a.qty_pass2, a.qty_pass3, a.final_qty, a.status,
         a.resolved_by, a.updated_at,
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
