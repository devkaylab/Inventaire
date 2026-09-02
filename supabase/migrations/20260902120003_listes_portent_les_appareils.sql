-- ============================================================================
-- Les listes rendent le nombre d'appareils (2 septembre 2026)
-- ----------------------------------------------------------------------------
-- Suite immédiate de `20260902120001`. Les demandes portent `devices` depuis
-- cette migration, mais les trois fonctions qui les LISENT rendaient toujours
-- `units` et `sqm` seuls : l'écran du client, la fiche entreprise de la console
-- et le bloc « Ventes en cours » auraient affiché « appareils non déclarés » sur
-- une demande qui en porte bel et bien un.
--
-- ⚠️ `units` et `sqm` restent rendus : les demandes déposées avant ce jour n'ont
-- qu'eux, et les deux écrans les affichent alors à la place — c'est aussi ce que
-- lit encore le recoupement de densité d'`admin_pipeline`.
--
-- `billing_period` suit dans les deux listes de demandes de magasin : le rythme
-- d'un devis doit se lire là où on lit son montant.
-- ============================================================================

create or replace function public.ca_list_store_requests()
returns json language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();
  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id, 'kind', r.kind, 'store_id', r.store_id, 'store_name', r.store_name,
             'message', r.message, 'devices', r.devices, 'units', r.units, 'sqm', r.sqm,
             'status', r.status,
             'requested_label', r.requested_label, 'admin_note', r.admin_note,
             'created_at', r.created_at, 'handled_at', r.handled_at,
             'quote_reference', r.quote_reference, 'quote_amount_cents', r.quote_amount_cents,
             'billing_period', r.billing_period,
             'quote_token', r.quote_token, 'quote_expires_at', r.quote_expires_at,
             'declined_at', r.declined_at
           ) order by r.created_at desc), '[]'::json)
      from public.store_requests r
     where r.company_id = v_company
       and (r.status in ('pending', 'quoted', 'accepted', 'paid')
            or (r.status in ('rejected', 'declined') and coalesce(r.handled_at, r.declined_at) > now() - interval '30 days')));
end;
$function$;

revoke all on function public.ca_list_store_requests() from public, anon;
grant execute on function public.ca_list_store_requests() to authenticated, service_role;

create or replace function public.admin_list_store_requests()
returns json language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Accès refusé'; end if;
  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id, 'kind', r.kind, 'company_id', r.company_id, 'company_name', c.name,
             'store_id', r.store_id, 'store_name', r.store_name, 'message', r.message,
             'devices', r.devices, 'units', r.units, 'sqm', r.sqm, 'status', r.status,
             'requested_label', r.requested_label, 'admin_note', r.admin_note,
             'created_at', r.created_at, 'handled_at', r.handled_at,
             'quote_reference', r.quote_reference, 'quote_amount_cents', r.quote_amount_cents,
             'billing_period', r.billing_period,
             'quote_sent_at', r.quote_sent_at, 'quote_expires_at', r.quote_expires_at,
             'accepted_at', r.accepted_at, 'paid_at', r.paid_at,
             'declined_at', r.declined_at, 'decline_reason', r.decline_reason
           ) order by (r.status in ('pending', 'quoted', 'accepted', 'paid', 'declined')) desc, r.created_at desc), '[]'::json)
      from public.store_requests r
      join public.companies c on c.id = r.company_id
     where r.status in ('pending', 'quoted', 'accepted', 'paid', 'declined')
        or r.handled_at > now() - interval '90 days');
end;
$function$;

revoke all on function public.admin_list_store_requests() from public, anon;
grant execute on function public.admin_list_store_requests() to authenticated, service_role;

-- « Ventes en cours » : la ligne d'une demande de magasin porte son assiette.
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
