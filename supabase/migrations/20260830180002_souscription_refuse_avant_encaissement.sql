-- On refuse AVANT d'encaisser (30 août 2026, après le premier test réel).
--
-- Le test de bout en bout a créé l'entreprise, encaissé, puis échoué à inviter
-- l'administrateur : l'adresse appartenait déjà à une autre entreprise, et
-- invite_company_admin_after_payment refuse de reprendre une identité
-- rattachée ailleurs (garde VR-003 du 28 août). Le garde-fou a bien joué —
-- APRÈS le paiement. Le client aurait payé sans rien obtenir.
--
-- ⚠️ Le contrôle vient donc AVANT toute écriture et avant toute session
-- Stripe. Rien n'est enregistré, rien n'est encaissé, et la personne lit quoi
-- faire.
--
-- ⚠️ Compromis assumé, déjà acté le 22 août pour l'invitation d'équipe : le
-- message CONFIRME que l'adresse a un compte quelque part. C'est une
-- information sur l'existence d'un compte — la limitation de débit à cinq
-- essais par heure et par adresse est ce qui la rend inexploitable pour
-- constituer un annuaire. **Ne jamais nommer l'entreprise concernée** : le
-- souscripteur apprendrait quelque chose sur un client qui n'est pas le sien.

create or replace function public.deposer_souscription(
  p_company_name text, p_first_name text, p_last_name text, p_email text,
  p_store_name text, p_plan text, p_billing_period text,
  p_amount_cents bigint, p_annual_cents bigint
) returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id uuid;
  v_company text := public.nom_propre(p_company_name);
  v_store text := public.nom_propre(p_store_name);
  v_first text := public.nom_propre(p_first_name);
  v_last text := public.nom_propre(p_last_name);
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_company is null or v_store is null or v_first is null or v_last is null then
    return json_build_object('success', false, 'error', 'Renseignez tous les champs.');
  end if;
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;
  if length(v_email) > 254 then
    return json_build_object('success', false, 'error', 'Adresse e-mail trop longue.');
  end if;
  if p_plan not in ('essential', 'advanced', 'enterprise') then
    return json_build_object('success', false, 'error', 'Offre inconnue.');
  end if;
  if p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_annual_cents is null or p_annual_cents <= 0 then
    return json_build_object('success', false, 'error', 'Montant absent.');
  end if;

  -- La limitation vient APRÈS la validation de saisie (une faute de frappe ne
  -- consomme pas le quota) et AVANT la recherche par adresse.
  if not public.rate_limit_ok('souscription', v_email, 5, interval '1 hour') then
    return json_build_object('success', false, 'error',
      'Trop de tentatives pour cette adresse. Reessayez dans une heure.');
  end if;

  -- ⚠️ LE CONTROLE QUI EVITE D'ENCAISSER POUR RIEN.
  -- Un compte déjà rattaché à une entreprise ne peut pas devenir
  -- administrateur d'une autre : la création réussirait, l'invitation non.
  if exists (
    select 1 from public.profiles p
     join auth.users u on u.id = p.id
    where lower(u.email::text) = v_email and p.company_id is not null
  ) then
    return json_build_object('success', false, 'code', 'compte_existant', 'error',
      'Cette adresse est deja rattachee a une entreprise sur Quantinvo. '
      || 'Demandez vos acces a son administrateur, ou souscrivez avec une autre adresse.');
  end if;

  -- Une invitation en attente ailleurs bloquerait de la même façon.
  if exists (select 1 from public.team_invitations where lower(email) = v_email) then
    return json_build_object('success', false, 'code', 'invitation_en_cours', 'error',
      'Une invitation est deja en attente pour cette adresse. '
      || 'Ouvrez-la pour creer votre mot de passe, ou souscrivez avec une autre adresse.');
  end if;

  -- Une souscription déjà payée, dont la création est en cours.
  if exists (
    select 1 from public.company_requests
     where contact_email = v_email and admin_note = 'Souscription en ligne'
       and status in ('paid', 'created')
  ) then
    return json_build_object('success', false, 'code', 'deja_souscrit', 'error',
      'Une souscription existe deja pour cette adresse. '
      || 'Verifiez votre boite de reception, ou ecrivez-nous.');
  end if;

  insert into public.company_requests (
    company_name, contact_first_name, contact_last_name, contact_email,
    store_count, status, accepted_at, plan, billing_period,
    quote_amount_cents, quote_lines, stores, admin_note
  ) values (
    v_company, v_first, v_last, v_email,
    1, 'accepted', now(), p_plan, p_billing_period, p_annual_cents,
    jsonb_build_array(jsonb_build_object('libelle', v_store, 'prixCents', p_annual_cents)),
    jsonb_build_array(jsonb_build_object('name', v_store)),
    'Souscription en ligne'
  ) returning id into v_id;

  perform public.log_system_action('Souscription', 'souscription_deposee', 'demande_entreprise',
    v_id::text, v_company,
    json_build_object('plan', p_plan, 'rythme', p_billing_period,
                      'montant_cents', p_amount_cents)::jsonb);

  return json_build_object('success', true, 'request_id', v_id);
end; $$;

revoke all on function public.deposer_souscription(text, text, text, text, text, text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.deposer_souscription(text, text, text, text, text, text, text, bigint, bigint) to service_role;
