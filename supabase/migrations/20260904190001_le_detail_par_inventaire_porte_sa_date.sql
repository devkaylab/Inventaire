-- Le détail par inventaire porte sa date de clôture (4 septembre 2026)
--
-- Julien, à la lecture du premier export : « par inventaire dans le rapport il
-- faut ajouter la date ».
--
-- La feuille « Par inventaire » nommait l'inventaire et son numéro, mais pas
-- QUAND il avait été arrêté. Or c'est précisément ce qu'on cherche quand une
-- référence revient dans trois lignes : savoir laquelle est la plus récente.
-- Le numéro le dit à qui connaît la nomenclature (INV-AAAAMMJJ-XXXX) ; une
-- colonne de date le dit à tout le monde, et elle se trie.
--
-- ⚠️ LA DATE EST CELLE DE LA CLÔTURE, pas de la création : c'est l'inventaire
-- arrêté qui fait foi dans le rapport, et le rapport ne retient que des
-- inventaires clôturés. `closed_at` n'y est donc jamais nul.
--
-- ⚠️ Elle est rendue en TEXTE, formatée en Europe/Paris comme partout ailleurs
-- dans le produit. Un horodatage brut arriverait en UTC dans le tableur et
-- daterait du 12 août un inventaire clôturé le 13 à une heure du matin.
--
-- ⚠️ DROP puis CREATE : on ne change pas la liste des colonnes de retour d'une
-- fonction par un `create or replace`. Les droits sont reposés dans la même
-- migration — `create` rend EXECUTE à PUBLIC et à `anon`.

drop function if exists public.rapport_magasin_detail(uuid, uuid[], integer, integer);

create or replace function public.rapport_magasin_detail(
  p_store_id uuid,
  p_sessions uuid[],
  p_offset integer default 0,
  p_limite integer default 5000)
returns table(inventaire text, numero text, cloture_le text,
              sku text, ean text, brand text, label text,
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
           s.inventory_number as numero,
           to_char(s.closed_at at time zone 'Europe/Paris', 'DD/MM/YYYY') as cloture
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
  select s.nom::text, s.numero::text, s.cloture::text,
         p.sku::text, ar.ean::text,
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
