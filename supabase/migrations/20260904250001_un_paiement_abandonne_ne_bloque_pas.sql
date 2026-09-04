-- ============================================================================
-- UN PAIEMENT ABANDONNÉ NE BLOQUE PAS (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- Constat de Julien, capture à l'appui, une heure après la mise en ligne du
-- libre-service : il ouvre la page de paiement, fait retour sans payer, et sa
-- demande s'affiche « DEVIS ACCEPTÉ » — sans bouton pour payer, sans bouton
-- pour annuler, et sans pouvoir la refaire (le doublon de nom la refuse).
-- Trois portes fermées d'un coup.
--
-- ⚠️ LE DÉFAUT N'EST PAS L'ÉTAT, C'EST QU'IL N'A PAS DE SORTIE. Une demande en
-- `accepted` sans paiement est NORMALE : une session Checkout dure vingt-quatre
-- heures, et fermer l'onglet est le geste le plus banal du monde. Ce parcours-là
-- n'avait simplement pas été déroulé — j'ai construit le chemin qui marche.
--
-- ⚠️ ET CE N'EST PAS UN DEVIS. Le libre-service dépose sa demande directement
-- en `accepted` parce qu'il n'y a rien à négocier ; le libellé « Devis accepté »
-- est celui de l'autre parcours, et il ment ici. Ce qui distingue les deux en
-- base : une demande devisée porte un `quote_token`, jamais le libre-service.
-- ============================================================================


-- ── 1. Une demande jamais devisée s'annule tant qu'elle n'est pas payée ────
--
-- ⚠️ JAMAIS UNE DEMANDE DEVISÉE EN `accepted`. Celle-là porte un accord signé
-- sur un montant négocié : y renoncer est une conversation, pas un bouton.
-- C'est `quote_sent_at` qui tranche — il n'existe que si un devis est parti.
create or replace function public.ca_cancel_store_request(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_company uuid; v_req public.store_requests%rowtype;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  delete from public.store_requests
   where id = p_id
     and company_id = v_company
     and paid_at is null
     and (
       status = 'pending'
       -- Le libre-service : déposée en `accepted`, jamais devisée. Tant que
       -- rien n'est encaissé, elle se retire comme une demande en attente.
       or (status = 'accepted' and quote_sent_at is null)
     )
  returning * into v_req;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée.');
  end if;

  perform public.log_company_action(v_company, 'magasin_demande_annulee', v_req.store_name);
  return json_build_object('success', true);
end;
$$;

revoke all on function public.ca_cancel_store_request(uuid) from public, anon;
grant execute on function public.ca_cancel_store_request(uuid) to authenticated, service_role;


-- ── 2. La garde du « reprendre le paiement » ───────────────────────────────
--
-- Même motif que `peut_changer_offre` : la garde se demande, elle ne se déduit
-- pas de l'ordre des `if` d'une autre fonction.
create or replace function public.peut_reprendre_paiement(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_company uuid;
begin
  select r.company_id into v_company from public.store_requests r where r.id = p_id;
  if v_company is null then
    return false;
  end if;
  -- ⚠️ La garde porte sur l'entreprise DE LA DEMANDE, jamais sur un paramètre
  -- de l'appelant.
  return public.is_admin() or public.is_company_admin(v_company);
end;
$$;

revoke all on function public.peut_reprendre_paiement(uuid) from public, anon;
grant execute on function public.peut_reprendre_paiement(uuid) to authenticated, service_role;


-- ── 3. Ce que l'edge doit relire pour rouvrir la session ───────────────────
--
-- Elle rend l'identifiant de session Stripe : `service_role` seul, comme
-- `etat_abonnement_magasin`.
create or replace function public.demande_a_reprendre(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'id', r.id,
           'kind', r.kind,
           'statut', r.status,
           'magasin', r.store_name,
           'store_id', r.store_id,
           'appareils', r.devices,
           'rythme', r.billing_period,
           'session', r.stripe_checkout_session_id,
           'devise', r.quote_sent_at is not null,
           'cree_le', r.created_at)
    into v
    from public.store_requests r
   where r.id = p_id;
  return v;
end;
$$;

revoke all on function public.demande_a_reprendre(uuid) from public, anon, authenticated;
grant execute on function public.demande_a_reprendre(uuid) to service_role;
