CREATE OR REPLACE FUNCTION public.prix_offre(p_devices integer, p_billing_period text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
declare v_t integer; v_plan text; v_plafond integer; v_mois bigint; v_an bigint;
begin
  if p_devices is null or p_devices < 1 then return null; end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then return null; end if;
  if p_devices > 200 then return null; end if;
  if p_devices <= 2 then v_plan := 'essential'; v_plafond := 2; v_mois := 8900; v_an := 95000;
  elsif p_devices <= 20 then v_plan := 'advanced'; v_plafond := 20; v_mois := 31000; v_an := 330000;
  elsif p_devices <= 100 then v_plan := 'enterprise'; v_plafond := 100; v_mois := 89000; v_an := 945000;
  else v_t := ceil((p_devices - 100) / 10.0)::integer; v_plan := 'enterprise';
    v_plafond := 100 + 10 * v_t; v_mois := 89000 + v_t * 6400; v_an := 945000 + v_t * 69000; end if;
  return jsonb_build_object('plan', v_plan, 'plafond', v_plafond, 'tranches', coalesce(v_t, 0),
    'prix_cents', case when p_billing_period = 'monthly' then v_mois else v_an end,
    'annuel_cents', case when p_billing_period = 'monthly' then v_mois * 12 else v_an end);
end; $function$;

CREATE OR REPLACE FUNCTION public.deposer_changement_offre(p_store_id uuid, p_devices integer, p_billing_period text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_store record; v_label text; v_tarif jsonb; v_plafond integer; v_id uuid;
begin
  select s.id, s.name, s.company_id,
         coalesce(s.stripe_subscription_id, c.stripe_subscription_id) as stripe_subscription_id
    into v_store from public.stores s join public.companies c on c.id = s.company_id where s.id = p_store_id;
  if not found then return json_build_object('success', false, 'error', 'Magasin introuvable.'); end if;
  if not (public.is_admin() or public.is_company_admin(v_store.company_id)) then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.'); end if;
  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error', 'Indiquez le nombre d''appareils qui comptent en même temps.'); end if;
  if p_devices > 200 then
    return json_build_object('success', false, 'code', 'hors_grille', 'error', 'Au-delà de 200 appareils…'); end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.'); end if;
  -- ⚠️ LE POINT À VÉRIFIER : `plafond_appareils` décide ici s'il y a quelque
  -- chose à vendre. Si On-Demand l'avait fait rendre 2 au lieu de null, cette
  -- ligne refuserait la vente de l'offre Essential.
  v_plafond := public.plafond_appareils(p_store_id);
  if v_plafond is not null and p_devices <= v_plafond then
    return json_build_object('success', false, 'code', 'deja_couvert', 'error',
      'Votre offre couvre déjà ' || v_plafond || ' appareils.'); end if;
  if nullif(btrim(coalesce(v_store.stripe_subscription_id, '')), '') is not null then
    return json_build_object('success', false, 'code', 'abonnement_en_cours', 'error', '…'); end if;
  if exists (select 1 from public.store_requests r where r.store_id = p_store_id
              and r.kind = 'offre' and r.status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', false, 'code', 'deja_en_cours', 'error', '…'); end if;
  v_tarif := public.prix_offre(p_devices, p_billing_period);
  insert into public.store_requests (company_id, store_id, store_name, message, devices, billing_period,
    kind, requested_by, requested_label, status, accepted_at, quote_amount_cents, quote_lines, admin_note)
  values (v_store.company_id, p_store_id, v_store.name, '', p_devices, p_billing_period, 'offre',
    auth.uid(), '', 'accepted', now(), (v_tarif ->> 'prix_cents')::bigint, '[]'::jsonb, 'libre-service')
  returning id into v_id;
  return json_build_object('success', true, 'id', v_id::text, 'plan', v_tarif ->> 'plan',
    'prix_cents', (v_tarif ->> 'prix_cents')::bigint);
end; $function$;
