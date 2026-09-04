-- ============================================================================
-- LE RYTHME SE CHANGE AVANT DE PAYER (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- Julien : *« j'aimerais pouvoir changer le mode de paiement mensuel ou annuel
-- […] je suis obligé d'annuler ma demande et de recommencer. »*
--
-- Il a raison, et c'est le même geste : ce qu'on achète ne change pas — même
-- magasin, même nombre d'appareils, même offre —, seule l'échéance change.
-- Annuler puis refaire, c'est perdre la trace et rejouer les contrôles de
-- doublon pour rien.
--
-- ⚠️ CE QUE ÇA NE CONTREDIT PAS. La règle posée avec `reprendre` était : *ce
-- qu'on achète est relu sur la demande, jamais repris du corps de la requête*.
-- Elle visait UNE chose — qu'un client ne puisse pas fixer son prix. Elle tient
-- intégralement ici : le montant est recalculé par `prix_offre`, en base, à
-- partir des appareils DÉJÀ déposés. Le client choisit une échéance, pas un
-- montant.
-- ============================================================================

create or replace function public.changer_rythme_demande(
  p_id uuid,
  p_billing_period text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req   public.store_requests%rowtype;
  v_tarif jsonb;
begin
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;

  select * into v_req from public.store_requests where id = p_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable.');
  end if;

  -- ⚠️ La garde porte sur l'entreprise DE LA DEMANDE, jamais sur un paramètre
  -- de l'appelant.
  if not (public.is_admin() or public.is_company_admin(v_req.company_id)) then
    return json_build_object('success', false, 'error',
      'Accès réservé à l''administrateur de l''entreprise.');
  end if;

  -- ⚠️ RIEN NE BOUGE UNE FOIS ENCAISSÉ, et rien ne bouge sur un devis : celui-ci
  -- porte un montant négocié et un document signé, dont l'échéance fait partie.
  if v_req.paid_at is not null or v_req.status <> 'accepted' or v_req.quote_sent_at is not null then
    return json_build_object('success', false, 'error',
      'Cette demande n''attend plus de paiement.');
  end if;

  if v_req.billing_period = p_billing_period then
    return json_build_object('success', true, 'already', true,
      'billing_period', p_billing_period);
  end if;

  v_tarif := public.prix_offre(v_req.devices, p_billing_period);
  if v_tarif is null then
    return json_build_object('success', false, 'error', 'Demande incomplète.');
  end if;

  update public.store_requests
     set billing_period = p_billing_period,
         quote_amount_cents = (v_tarif ->> 'prix_cents')::bigint,
         quote_lines = jsonb_build_array(jsonb_build_object(
           'libelle', v_req.store_name,
           'appareils', v_req.devices,
           'prixCents', (v_tarif ->> 'prix_cents')::bigint,
           'annuelCents', (v_tarif ->> 'annuel_cents')::bigint)),
         -- ⚠️ LA SESSION STRIPE EST PÉRIMÉE, ET IL FAUT L'OUBLIER ICI.
         -- Elle porte l'ancien prix : la rouvrir ferait payer le mensuel à qui
         -- vient de choisir l'annuel. C'est le seul endroit du produit où une
         -- session se jette, et c'est parce qu'elle ne décrit plus la demande.
         stripe_checkout_session_id = null
   where id = p_id;

  perform public.log_company_action(v_req.company_id, 'rythme_change', v_req.store_name,
    json_build_object('rythme', p_billing_period,
                      'montant_cents', (v_tarif ->> 'prix_cents')::bigint)::jsonb);

  return json_build_object('success', true, 'already', false,
    'billing_period', p_billing_period,
    'prix_cents', (v_tarif ->> 'prix_cents')::bigint);
end;
$$;

revoke all on function public.changer_rythme_demande(uuid, text) from public, anon;
grant execute on function public.changer_rythme_demande(uuid, text) to authenticated, service_role;
