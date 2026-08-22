-- Le recoupement stock / surface remonte jusqu'au tableau de bord (22 août 2026).
--
-- Julien : « un grand magasin mettrait un stock théorique à 1 000 pièces pour
-- une surface de 10 000 m² = fraudeur ». Le repère existait dans la console
-- (fiche de la demande) ; il doit se voir **avant** d'ouvrir le détail, sur la
-- ligne « Ventes en cours » — c'est là qu'on décide d'envoyer le devis.
--
-- La RPC rend les faits (magasins déclarés, surface, code APE) ; le jugement
-- reste dans `web/lib/secteurs.ts`, qui connaît les fourchettes par secteur.
create or replace function public.admin_pipeline()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
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
                 'created_at', s.created_at,
                 'quote_sent_at', s.quote_sent_at,
                 'quote_expires_at', s.quote_expires_at,
                 'accepted_at', s.accepted_at,
                 'paid_at', s.paid_at,
                 'ape', null,
                 'stores', case when s.kind = 'add'
                   then json_build_array(json_build_object('name', s.store_name, 'units', s.units, 'sqm', s.sqm))
                   else '[]'::json end
               ) as x, s.created_at
          from public.store_requests s
          join public.companies c on c.id = s.company_id
         where s.status in ('pending', 'quoted', 'accepted', 'paid')
      ) x);
end;
$$;

revoke all on function public.admin_pipeline() from public, anon;
grant execute on function public.admin_pipeline() to authenticated, service_role;
