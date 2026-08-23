-- Supprimer une demande d'inscription d'entreprise (23 août 2026).
--
-- Julien : « je ne veux pas que les demandes refusées restent en permanence
-- là » — une demande d'essai refusée restait affichée dans la console jusqu'à
-- la purge à un an, que personne ne lance (pg_cron absent).
--
-- Ce qui peut se supprimer : une demande qui n'a rien produit. On refuse donc
-- `created` (l'entreprise existe, la demande est sa trace d'origine), et tout
-- ce qui porte un paiement en cours ou reçu (`accepted` avec session Stripe,
-- `paid`) : Stripe rejouerait son webhook sur une session devenue inconnue —
-- il répond 500, donc réessai sans fin. Ces cas se règlent en finissant le
-- parcours, pas en effaçant la ligne.
create or replace function public.admin_delete_company_request(p_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_req public.company_requests%rowtype;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select * into v_req from public.company_requests where id = p_id;
  if v_req.id is null then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.status = 'created' then
    return json_build_object('success', false, 'error', 'Cette demande a créé une entreprise : elle en est la trace et ne se supprime pas.');
  end if;
  if v_req.status = 'paid' or (v_req.status = 'accepted' and v_req.stripe_checkout_session_id is not null) then
    return json_build_object('success', false, 'error', 'Un paiement est en cours ou reçu sur cette demande : terminez le parcours avant de la supprimer.');
  end if;

  delete from public.company_requests where id = p_id;
  perform public.log_admin_action('demande_entreprise_supprimee', 'demande_entreprise', p_id::text,
    coalesce(v_req.company_name, ''),
    json_build_object('statut', v_req.status, 'contact', coalesce(v_req.contact_email, ''))::jsonb);
  return json_build_object('success', true);
end;
$$;

revoke all on function public.admin_delete_company_request(uuid) from public, anon;
grant execute on function public.admin_delete_company_request(uuid) to authenticated, service_role;
