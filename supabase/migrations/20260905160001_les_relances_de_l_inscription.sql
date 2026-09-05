-- Le parcours d'inscription : ce qui est facturé, et les trois relances
-- (5 septembre 2026)
--
-- Troisième tranche. La ligne de devis dit désormais son palier, et le
-- brouillon abandonné se relance — trois fois, jamais quatre.

create or replace function public.finaliser_inscription(p_company_name text, p_siren text, p_ape text, p_first text, p_last text, p_phone text, p_stores jsonb, p_billing_period text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_nom    text := btrim(coalesce(p_company_name, ''));
  v_first  text := btrim(coalesce(p_first, ''));
  v_last   text := btrim(coalesce(p_last, ''));
  v_phone  text := btrim(coalesce(p_phone, ''));
  v_siren  text := nullif(regexp_replace(coalesce(p_siren, ''), '\D', '', 'g'), '');
  v_ape    text := nullif(left(btrim(coalesce(p_ape, '')), 8), '');
  v_stores jsonb := coalesce(p_stores, '[]'::jsonb);
  v_propre jsonb := '[]'::jsonb;
  v_lignes jsonb := '[]'::jsonb;
  v_total  bigint := 0;
  v_annuel bigint := 0;
  v_el     jsonb;
  v_sname  text;
  v_dev    integer;
  v_tarif  jsonb;
  v_id     uuid;
  v_i      int;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Session absente.');
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;

  -- ⚠️ Les bornes REFUSENT, elles ne tronquent pas : le nom de l'entreprise
  -- devient `companies.name`, puis figure sur la facture Stripe — une pièce
  -- datée, qui ne se réécrit pas. Règle du 28 août 2026.
  if v_nom = '' or length(v_nom) > 80 then
    return json_build_object('success', false, 'error', 'Le nom de l''entreprise est absent ou trop long.');
  end if;
  if v_first = '' or length(v_first) > 80 or v_last = '' or length(v_last) > 80 then
    return json_build_object('success', false, 'error', 'Le prénom ou le nom est absent ou trop long.');
  end if;
  if length(v_phone) > 30 then
    return json_build_object('success', false, 'error', 'Le téléphone est trop long.');
  end if;
  if v_siren is not null and not public.siren_valide(v_siren) then
    return json_build_object('success', false, 'error', 'Ce SIREN ne semble pas valide.');
  end if;
  if jsonb_typeof(v_stores) <> 'array' or jsonb_array_length(v_stores) < 1 then
    return json_build_object('success', false, 'error', 'Déclarez au moins un magasin.');
  end if;
  if jsonb_array_length(v_stores) > 50 then
    return json_build_object('success', false, 'error', 'Au-delà de cinquante magasins, écrivez-nous.');
  end if;

  -- ⚠️ Une seule demande par compte, et elle ne se rejoue pas : deux demandes
  -- pour un même prospect voudraient dire deux entreprises pour une personne.
  if exists (select 1 from public.inscriptions where user_id = v_uid and demande_id is not null) then
    return json_build_object('success', false, 'code', 'deja_finalise',
      'error', 'Votre inscription est déjà déposée.');
  end if;
  if exists (select 1 from public.profiles where id = v_uid and company_id is not null) then
    return json_build_object('success', false, 'code', 'deja_dans_une_entreprise',
      'error', 'Ce compte appartient déjà à une entreprise.');
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if coalesce(v_email, '') = '' then
    return json_build_object('success', false, 'error', 'Adresse introuvable.');
  end if;

  for v_i in 0 .. jsonb_array_length(v_stores) - 1 loop
    v_el    := v_stores -> v_i;
    v_sname := btrim(coalesce(v_el ->> 'name', ''));
    v_dev   := nullif(btrim(coalesce(v_el ->> 'devices', '')), '')::integer;
    if v_sname = '' or length(v_sname) > 80 then
      return json_build_object('success', false, 'error',
        'Chaque magasin doit porter un nom d''au plus 80 caractères.');
    end if;
    if v_dev is null or v_dev < 1 then
      return json_build_object('success', false, 'error',
        'Indiquez le nombre d''appareils qui comptent en même temps dans ' || v_sname || '.');
    end if;

    -- ⚠️ `prix_offre` rend `null` au-delà de la borne du libre-service (200
    -- appareils, tranché le 5 septembre 2026) : c'est ELLE qui porte le
    -- plafond, on n'en fait pas une copie ici.
    v_tarif := public.prix_offre(v_dev, p_billing_period);
    if v_tarif is null then
      return json_build_object('success', false, 'code', 'hors_grille', 'error',
        'Au-delà de 200 appareils, l''offre d''un magasin ne se prolonge plus : répartissez-les sur plusieurs magasins, ou écrivez-nous depuis votre messagerie Quantinvo.');
    end if;

    v_total  := v_total  + (v_tarif ->> 'prix_cents')::bigint;
    v_annuel := v_annuel + (v_tarif ->> 'annuel_cents')::bigint;
    v_propre := v_propre || jsonb_build_array(jsonb_build_object('name', v_sname, 'devices', v_dev));
    -- La règle des lignes de devis (2 septembre) : `prixCents` est l'échéance,
    -- `annuelCents` ce que le magasin vaut à l'année.
    v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
      'libelle', v_sname, 'appareils', v_dev,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint,
      -- ⚠️ Le PALIER et les TRANCHES voyagent avec la ligne. Sans eux, la
      -- fonction edge devrait redéduire l'offre du nombre d'appareils —
      -- c'est-à-dire porter une copie des frontières de la grille, la
      -- cinquième. Ici la ligne décrit entièrement ce qui sera facturé.
      'plan', v_tarif ->> 'plan',
      'tranches', (v_tarif ->> 'tranches')::integer));
  end loop;

  -- ⚠️ La demande naît en `accepted` : il n'y a rien à négocier, le prix est
  -- public. C'est exactement ce que fait `deposer_souscription` depuis le
  -- 30 août — et c'est ce qui permet à `fulfil_paid_request` de la mener à
  -- `created` sans que sa garde de transition ne change.
  insert into public.company_requests (
    company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
    store_count, message, status, quote_reference, quote_amount_cents,
    siren, ape, stores, quote_lines, billing_period, plan,
    accepted_at, user_id, source)
  values (
    v_nom, v_first, v_last, v_email, v_phone,
    jsonb_array_length(v_propre), '', 'accepted',
    'INS-' || to_char(now() at time zone 'Europe/Paris', 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
    v_total, v_siren, v_ape, v_propre, v_lignes, p_billing_period,
    (public.prix_offre((v_propre -> 0 ->> 'devices')::integer, p_billing_period) ->> 'plan'),
    now(), v_uid, 'inscription')
  returning id into v_id;

  update public.inscriptions
     set demande_id = v_id, etape = 8, updated_at = now()
   where user_id = v_uid;

  return json_build_object('success', true, 'demande_id', v_id,
    'montant_cents', v_total, 'annuel_cents', v_annuel,
    'magasins', jsonb_array_length(v_propre), 'lignes', v_lignes);
end;
$function$;

revoke all on function public.finaliser_inscription(text, text, text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.finaliser_inscription(text, text, text, text, text, text, jsonb, text) to authenticated, service_role;

-- ─── Les trois relances ────────────────────────────────────────────────────
--
-- Tranché par Julien le 5 septembre 2026 : « Descends à 30 jours. Avec une
-- relance dès le lendemain puis une semaine plus tard. Puis une dernière fois à
-- 20 jours de la première relance. On ne relance que trois fois. »
--
-- Soit J+1, J+8, J+21 — et une rétention de 30 jours.
--
-- ⚠️ LES DEUX VALEURS VIVENT AU MÊME ENDROIT, ET C'EST LA RAISON DE CETTE
-- FONCTION. J+21 contre une purge à 30 jours ne laisse que NEUF JOURS de marge :
-- si la rétention redescendait un jour sans que le calendrier suive, la
-- troisième relance partirait sur des réponses déjà effacées — un e-mail vide,
-- et personne pour s'en apercevoir. Un test compare les deux.
create or replace function public.inscriptions_a_relancer()
returns table (
  id uuid, user_id uuid, email text, etape smallint, reponses jsonb,
  rang smallint, jours integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  -- ⚠️ Le calendrier et la rétention, ensemble. Ne pas les séparer.
  v_jalons constant integer[] := array[1, 8, 21];
  v_retention constant integer := 30;
begin
  return query
  select i.id, i.user_id, i.email, i.etape, i.reponses,
         (i.relances + 1)::smallint as rang,
         extract(day from now() - i.created_at)::integer as jours
    from public.inscriptions i
   where i.demande_id is null                       -- rien n'a été déposé
     and i.relances < array_length(v_jalons, 1)     -- trois, jamais quatre
     and i.created_at > now() - (v_retention || ' days')::interval
     and i.created_at <= now() - (v_jalons[i.relances + 1] || ' days')::interval
     -- Une relance par jour au plus, quoi qu'il arrive : deux passages du tour
     -- de garde dans la même journée ne doivent pas en envoyer deux.
     and (i.derniere_relance_le is null or i.derniere_relance_le < now() - interval '20 hours')
   order by i.created_at;
end;
$function$;

revoke all on function public.inscriptions_a_relancer() from public, anon, authenticated;
grant execute on function public.inscriptions_a_relancer() to service_role;

-- ⚠️ ON MARQUE APRÈS L'ENVOI, jamais avant. Un e-mail qui ne part pas laisse la
-- relance ouverte, et l'heure suivante réessaie. L'ordre inverse la ferait
-- taire pour de bon sur un incident réseau d'une seconde — c'est la règle des
-- alertes du 28 août 2026.
create or replace function public.marquer_relance_inscription(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare v_n int;
begin
  update public.inscriptions
     set relances = relances + 1, derniere_relance_le = now(), updated_at = now()
   where id = p_id and demande_id is null and relances < 3;
  get diagnostics v_n = row_count;
  return json_build_object('success', v_n > 0);
end;
$function$;

revoke all on function public.marquer_relance_inscription(uuid) from public, anon, authenticated;
grant execute on function public.marquer_relance_inscription(uuid) to service_role;

-- ─── Le brouillon abandonné se purge à trente jours ────────────────────────
--
-- ⚠️ Reprise de `pg_get_functiondef` : cette fonction porte TOUTES les durées
-- de conservation du produit en un seul point, et la politique de
-- confidentialité les énumère. La réécrire depuis un fichier ancien en
-- perdrait.

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  invitations_ttl      constant interval := interval '3 months';
  demandes_sup_ttl     constant interval := interval '1 year';
  demandes_ent_rej_ttl constant interval := interval '1 year';
  demandes_ent_ttl     constant interval := interval '3 years';
  suppressions_ttl     constant interval := interval '1 year';
  journal_admin_ttl    constant interval := interval '1 year';
  journal_entrep_ttl   constant interval := interval '1 year';
  demandes_mag_ttl     constant interval := interval '1 year';
  evenements_ttl       constant interval := interval '30 days';
  -- ⚠️ TRENTE JOURS, ET C'EST LA MOITIÉ D'UNE PAIRE. La troisième relance part
  -- à J+21 (`inscriptions_a_relancer`) : neuf jours de marge, pas davantage.
  -- Descendre cette valeur sans toucher au calendrier ferait partir un e-mail
  -- sur des réponses déjà effacées. Un test compare les deux.
  inscriptions_ttl     constant interval := interval '30 days';
  notifications_ttl    constant interval := interval '90 days';
  messages_ttl         constant interval := interval '1 year';
  appareils_ttl        constant interval := interval '7 days';
  appareils_jour_ttl   constant interval := interval '13 months';
  rapport              jsonb := '{}'::jsonb;
  n                    int;
begin
  delete from public.team_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('team_invitations_supprimees', n);

  delete from public.session_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('session_invitations_supprimees', n);

  update public.supervisor_requests
     set first_name = '', last_name = '',
         email = 'expire+' || id::text || '@invalide.local', phone = ''
   where status in ('active', 'rejected')
     and created_at < now() - demandes_sup_ttl
     and email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('supervisor_requests_anonymisees', n);

  delete from public.company_requests
   where status = 'rejected' and updated_at < now() - demandes_ent_rej_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_supprimees', n);

  update public.company_requests
     set contact_first_name = '', contact_last_name = '',
         contact_email = 'expire+' || id::text || '@invalide.local', contact_phone = ''
   where updated_at < now() - demandes_ent_ttl
     and contact_email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_anonymisees', n);

  delete from public.account_deletion_requests where created_at < now() - suppressions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('deletion_requests_supprimees', n);

  delete from public.admin_audit_log where created_at < now() - journal_admin_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_admin_supprime', n);

  delete from public.company_audit_log where created_at < now() - journal_entrep_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_entreprise_supprime', n);

  delete from public.store_requests
   where handled_at is not null and handled_at < now() - demandes_mag_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('demandes_magasin_supprimees', n);

  delete from public.stripe_events_traites where recu_le < now() - evenements_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('evenements_stripe_supprimes', n);

  delete from public.notifications where created_at < now() - notifications_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('notifications_supprimees', n);

  delete from public.message_fils where dernier_le < now() - messages_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('fils_supprimes', n);

  delete from public.appareils_actifs where vu_le < now() - appareils_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_actifs_supprimes', n);

  delete from public.appareils_par_jour
   where jour < ((now() at time zone 'Europe/Paris')::date - appareils_jour_ttl);
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_par_jour_supprimes', n);

  -- Un brouillon d'inscription jamais déposé. Celui qui a abouti n'est plus un
  -- brouillon : il porte `demande_id`, et c'est la demande qui a sa propre
  -- durée (trois ans).
  delete from public.inscriptions
   where demande_id is null and created_at < now() - inscriptions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('inscriptions_abandonnees_supprimees', n);

  return rapport || jsonb_build_object('execute_le', now());
end;
$function$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
