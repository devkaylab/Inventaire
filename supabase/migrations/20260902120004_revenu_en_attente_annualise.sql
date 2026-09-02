-- ============================================================================
-- « Revenu en attente » se lit à l'année (2 septembre 2026)
-- ----------------------------------------------------------------------------
-- Conséquence du devis mensuel, trouvée en relisant `lib/pipeline.ts` :
-- `enAttenteCents` sommait `quote_amount_cents`, c'est-à-dire ce qui sera
-- facturé **à l'échéance**. Un devis mensuel de 1 200 € s'affichait donc 1 200 €
-- dans une tuile intitulée « Revenu en attente », pour une affaire qui en vaut
-- 14 400 par an. Un indicateur de revenu qui divise par douze selon le rythme
-- n'est plus un indicateur.
--
-- ⚠️ L'annualisation se fait EN BASE, par la même règle que `fulfil_paid_request`
-- (voir l'en-tête de `20260902120001`) : la somme des `annuelCents` des lignes,
-- `prixCents` à défaut, et seulement en dernier recours le montant annualisé
-- selon le rythme. La faire au navigateur à partir du seul rythme casserait la
-- souscription en ligne, dont la ligne porte un montant DÉJÀ annuel sur une
-- demande mensuelle.
--
-- `quote_amount_cents` ne bouge pas : c'est ce que le client va régler, et c'est
-- ce que la ligne de vente continue d'afficher.
-- ============================================================================

-- La règle des lignes de devis, en un seul endroit — pour qu'elle ne soit pas
-- recopiée une quatrième fois. `annuelCents` s'il est là, `prixCents` sinon ;
-- et seulement à défaut de toute ligne, le montant annualisé selon le rythme.
create or replace function public.annuel_du_devis(
  p_lines jsonb, p_amount_cents bigint, p_billing_period text
) returns bigint
language sql immutable set search_path to 'public'
as $function$
  select coalesce(
    (select sum(coalesce(nullif(l ->> 'annuelCents', '')::bigint,
                         nullif(l ->> 'prixCents', '')::bigint))
       from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l),
    case when p_billing_period = 'monthly' then p_amount_cents * 12 else p_amount_cents end);
$function$;

-- ⚠️ `revoke` sur `public` ET `anon` : un `create` accorde EXECUTE à `anon` par
-- les droits par défaut de Supabase (constat n°6 du 28 août 2026).
revoke all on function public.annuel_du_devis(jsonb, bigint, text) from public, anon;
grant execute on function public.annuel_du_devis(jsonb, bigint, text) to authenticated, service_role;

create or replace function public.admin_pipeline()
returns json language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;

  return (
    select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
      from (
        select json_build_object(
                 'kind', 'company',
                 'id', r.id,
                 'company_id', r.company_id,
                 'company_name', r.company_name,
                 'label', r.company_name,
                 'detail', r.store_count::text || ' magasin' || case when r.store_count > 1 then 's' else '' end,
                 'contact', btrim(r.contact_first_name || ' ' || r.contact_last_name),
                 'status', r.status,
                 'quote_reference', r.quote_reference,
                 'quote_amount_cents', r.quote_amount_cents,
                 'billing_period', r.billing_period,
                 'annual_cents', public.annuel_du_devis(r.quote_lines, r.quote_amount_cents, r.billing_period),
                 'created_at', r.created_at,
                 'quote_sent_at', r.quote_sent_at,
                 'quote_expires_at', r.quote_expires_at,
                 'accepted_at', r.accepted_at,
                 'paid_at', r.paid_at,
                 'ape', r.ape,
                 'stores', r.stores
               ) as x, r.created_at
          from public.company_requests r
         where r.status in ('pending', 'quoted', 'accepted', 'paid')

        union all

        select json_build_object(
                 'kind', case when s.kind = 'remove' then 'store_removal' else 'store' end,
                 'id', s.id,
                 'company_id', s.company_id,
                 'company_name', c.name,
                 'label', s.store_name,
                 'detail', c.name,
                 'contact', s.requested_label,
                 'status', s.status,
                 'quote_reference', s.quote_reference,
                 'quote_amount_cents', s.quote_amount_cents,
                 'billing_period', s.billing_period,
                 'annual_cents', public.annuel_du_devis(s.quote_lines, s.quote_amount_cents, s.billing_period),
                 'created_at', s.created_at,
                 'quote_sent_at', s.quote_sent_at,
                 'quote_expires_at', s.quote_expires_at,
                 'accepted_at', s.accepted_at,
                 'paid_at', s.paid_at,
                 'ape', null,
                 'stores', case when s.kind = 'add'
                   then json_build_array(json_build_object(
                          'name', s.store_name, 'devices', s.devices,
                          'units', s.units, 'sqm', s.sqm))
                   else '[]'::json end
               ) as x, s.created_at
          from public.store_requests s
          join public.companies c on c.id = s.company_id
         where s.status in ('pending', 'quoted', 'accepted', 'paid')
      ) x);
end;
$function$;

revoke all on function public.admin_pipeline() from public, anon;
grant execute on function public.admin_pipeline() to authenticated, service_role;
