-- La grille du libre-service s'arrête à 200 appareils (5 septembre 2026)
--
-- Julien, en tranchant la décision 3 de la maquette d'inscription : « au bout
-- d'un moment on n'ajoute plus d'appareils, on passe par une autre offre. Il
-- est rare d'aller au-delà de 100 appareils en général. Possible d'ajouter des
-- appareils jusqu'à 200 appareils, au-delà → nouvel abonnement. Au pire le
-- client nous contactera. »
--
-- La borne valait 1 000 depuis le 4 septembre — un chiffre posé faute de
-- décision, qui laissait un client souscrire 1 000 appareils en libre-service
-- (~6 700 €/mois) sans que personne ne regarde. Elle vaut 200.
--
-- ⚠️ CE N'EST PAS UNE BORNE DE LECTURE. `plafond_appareils` n'est pas touchée :
-- elle calcule ce qu'un magasin A DROIT de faire tourner, y compris un magasin
-- devisé à 300 appareils hors libre-service. Borner la lecture casserait le
-- verrou d'un client légitime. C'est la VENTE en libre-service qui s'arrête à
-- 200, pas le produit.
--
-- ⚠️ Les trois corps ci-dessous sont repris de `pg_get_functiondef` sur la base
-- réelle, et non des fichiers du dépôt : `deposer_changement_offre` a été
-- redéfinie depuis (20260905120001), et repartir du premier fichier aurait
-- ressuscité une version périmée. Seules la borne et son message changent.



create or replace function public.prix_offre(p_devices integer, p_billing_period text)
returns jsonb
language plpgsql
immutable
set search_path = public
as $function$
declare
  v_t integer;          -- tranches de dix au-delà du plafond d'Enterprise
  v_plan text;
  v_plafond integer;
  v_mois bigint;
  v_an bigint;
begin
  if p_devices is null or p_devices < 1 then
    return null;
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return null;
  end if;

  -- ⚠️ ET ELLE S'ARRÊTE À 200. C'est LA borne du libre-service, en un seul
  -- point serveur : les deux dépôts la vérifient aussi pour rendre un message
  -- lisible, mais c'est ici qu'elle est vraie. Au-delà, il n'y a pas de prix —
  -- pas un prix plus gros, pas de devis : un abonnement de plus.
  if p_devices > 200 then
    return null;
  end if;

  if p_devices <= 2 then
    v_plan := 'essential'; v_plafond := 2;   v_mois := 8900;  v_an := 95000;
  elsif p_devices <= 20 then
    v_plan := 'advanced';  v_plafond := 20;  v_mois := 31000; v_an := 330000;
  elsif p_devices <= 100 then
    v_plan := 'enterprise'; v_plafond := 100; v_mois := 89000; v_an := 945000;
  else
    -- Au-delà de cent appareils, par tranche de dix ENTAMÉE — exactement comme
    -- `plafond_appareils` les compte et comme la grille les facture.
    v_t := ceil((p_devices - 100) / 10.0)::integer;
    v_plan := 'enterprise';
    v_plafond := 100 + 10 * v_t;
    v_mois := 89000 + v_t * 6400;
    v_an   := 945000 + v_t * 69000;
  end if;

  -- ⚠️ LA RÈGLE DES LIGNES DE DEVIS (2 septembre 2026) : `prixCents` est ce
  -- qui est facturé à l'échéance, `annuelCents` ce que le magasin vaut à
  -- l'année. `fulfil_paid_request` écrit le second dans `annual_price_cents`.
  return jsonb_build_object(
    'plan', v_plan,
    'plafond', v_plafond,
    'tranches', coalesce(v_t, 0),
    'prix_cents', case when p_billing_period = 'monthly' then v_mois else v_an end,
    'annuel_cents', case when p_billing_period = 'monthly' then v_mois * 12 else v_an end);
end;
$function$;


create or replace function public.deposer_changement_offre(p_store_id uuid, p_devices integer, p_billing_period text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_store   record;
  v_label   text;
  v_tarif   jsonb;
  v_plafond integer;
  v_id      uuid;
begin
  select s.id, s.name, s.company_id,
         -- ⚠️ L'abonnement DU MAGASIN d'abord (voir `etat_abonnement_magasin`).
         coalesce(s.stripe_subscription_id, c.stripe_subscription_id) as stripe_subscription_id
    into v_store
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  if not found then
    return json_build_object('success', false, 'error', 'Magasin introuvable.');
  end if;

  -- ⚠️ La garde porte sur l'entreprise DU MAGASIN, jamais sur un paramètre de
  -- l'appelant — sinon on change l'offre du magasin d'un autre client.
  if not (public.is_admin() or public.is_company_admin(v_store.company_id)) then
    return json_build_object('success', false, 'error',
      'Accès réservé à l''administrateur de l''entreprise.');
  end if;

  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error',
      'Indiquez le nombre d''appareils qui comptent en même temps.');
  end if;
  -- ⚠️ LA GRILLE S'ARRÊTE À 200 APPAREILS (Julien, 5 septembre 2026) : « au bout
  -- d'un moment on n'ajoute plus d'appareils, on passe par une autre offre.
  -- Possible d'ajouter des appareils jusqu'à 200, au-delà → nouvel abonnement. »
  -- L'abonnement est PAR MAGASIN : une enseigne qui compte à 250 appareils
  -- compte en réalité dans plusieurs lieux, et chacun prend le sien.
  if p_devices > 200 then
    return json_build_object('success', false, 'code', 'hors_grille', 'error',
      'Au-delà de 200 appareils, l''offre d''un magasin ne se prolonge plus : répartissez-les sur plusieurs magasins, ou écrivez-nous depuis votre messagerie Quantinvo.');
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;

  -- Rien à vendre : l'offre couvre déjà ce besoin.
  v_plafond := public.plafond_appareils(p_store_id);
  if v_plafond is not null and p_devices <= v_plafond then
    return json_build_object('success', false, 'code', 'deja_couvert', 'error',
      'Votre offre couvre déjà ' || v_plafond || ' appareils.');
  end if;

  -- ⚠️ UNE ENTREPRISE QUI A UN ABONNEMENT NE PASSE PAS PAR ICI. Un second
  -- Checkout ouvrirait un second abonnement, et le client paierait les deux.
  -- C'est l'edge qui modifie l'abonnement existant, et `appliquer_changement_offre`
  -- qui enregistre le résultat.
  if nullif(btrim(coalesce(v_store.stripe_subscription_id, '')), '') is not null then
    return json_build_object('success', false, 'code', 'abonnement_en_cours', 'error',
      'Cette entreprise a un abonnement en cours : le changement se fait dessus.');
  end if;

  if exists (select 1 from public.store_requests r
              where r.store_id = p_store_id
                and r.kind = 'offre'
                and r.status in ('pending', 'quoted', 'accepted', 'paid')) then
    return json_build_object('success', false, 'code', 'deja_en_cours', 'error',
      'Un changement d''offre est déjà en cours pour ce magasin.');
  end if;

  v_tarif := public.prix_offre(p_devices, p_billing_period);

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  insert into public.store_requests (
    company_id, store_id, store_name, message, devices, billing_period,
    kind, requested_by, requested_label,
    status, accepted_at,
    quote_amount_cents, quote_lines, admin_note
  ) values (
    v_store.company_id, p_store_id, v_store.name, '', p_devices, p_billing_period,
    'offre', auth.uid(), coalesce(v_label, ''),
    'accepted', now(),
    (v_tarif ->> 'prix_cents')::bigint,
    jsonb_build_array(jsonb_build_object(
      'libelle', v_store.name,
      'appareils', p_devices,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint)),
    'Changement d''offre en libre-service'
  ) returning id into v_id;

  perform public.log_company_action(v_store.company_id, 'offre_changee', v_store.name,
    json_build_object('appareils', p_devices, 'offre', v_tarif ->> 'plan',
                      'rythme', p_billing_period,
                      'montant_cents', (v_tarif ->> 'prix_cents')::bigint)::jsonb);

  return json_build_object('success', true, 'id', v_id::text,
    'store_name', v_store.name, 'plan', v_tarif ->> 'plan',
    'plafond', (v_tarif ->> 'plafond')::integer,
    'prix_cents', (v_tarif ->> 'prix_cents')::bigint,
    'billing_period', p_billing_period);
end;
$function$;


create or replace function public.deposer_ajout_magasin(p_name text, p_devices integer, p_billing_period text)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_company uuid;
  v_name  text := btrim(coalesce(p_name, ''));
  v_label text;
  v_tarif jsonb;
  v_id    uuid;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error',
      'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  if v_name = '' then
    return json_build_object('success', false, 'error', 'Le nom du magasin est requis.');
  end if;
  if length(v_name) > 80 then
    return json_build_object('success', false, 'error', 'Le nom du magasin est trop long.');
  end if;
  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error',
      'Indiquez le nombre d''appareils qui comptent en même temps dans ce magasin.');
  end if;
  -- ⚠️ LA GRILLE S'ARRÊTE À 200 APPAREILS (Julien, 5 septembre 2026) : « au bout
  -- d'un moment on n'ajoute plus d'appareils, on passe par une autre offre.
  -- Possible d'ajouter des appareils jusqu'à 200, au-delà → nouvel abonnement. »
  -- L'abonnement est PAR MAGASIN : une enseigne qui compte à 250 appareils
  -- compte en réalité dans plusieurs lieux, et chacun prend le sien.
  if p_devices > 200 then
    return json_build_object('success', false, 'code', 'hors_grille', 'error',
      'Au-delà de 200 appareils, l''offre d''un magasin ne se prolonge plus : répartissez-les sur plusieurs magasins, ou écrivez-nous depuis votre messagerie Quantinvo.');
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;
  if exists (select 1 from public.stores s
              where s.company_id = v_company and lower(s.name) = lower(v_name)) then
    return json_build_object('success', false, 'error',
      'Un magasin porte déjà ce nom dans votre entreprise.');
  end if;
  -- Un magasin en cours de paiement n'est pas encore un magasin : sans ce
  -- contrôle, deux clics ouvriraient deux demandes et créeraient deux magasins.
  if exists (select 1 from public.store_requests r
              where r.company_id = v_company
                and r.kind = 'add'
                and r.status in ('pending', 'quoted', 'accepted', 'paid')
                and lower(r.store_name) = lower(v_name)) then
    return json_build_object('success', false, 'error',
      'Une demande est déjà en cours pour ce magasin.');
  end if;

  v_tarif := public.prix_offre(p_devices, p_billing_period);

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  insert into public.store_requests (
    company_id, store_name, message, devices, billing_period,
    requested_by, requested_label,
    status, accepted_at,
    quote_amount_cents, quote_lines, admin_note
  ) values (
    v_company, v_name, '', p_devices, p_billing_period,
    auth.uid(), coalesce(v_label, ''),
    'accepted', now(),
    (v_tarif ->> 'prix_cents')::bigint,
    jsonb_build_array(jsonb_build_object(
      'libelle', v_name,
      'appareils', p_devices,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint)),
    'Ajout en libre-service'
  ) returning id into v_id;

  perform public.log_company_action(v_company, 'magasin_demande', v_name,
    json_build_object('appareils', p_devices, 'offre', v_tarif ->> 'plan',
                      'rythme', p_billing_period,
                      'montant_cents', (v_tarif ->> 'prix_cents')::bigint)::jsonb);

  return json_build_object('success', true, 'id', v_id::text,
    'store_name', v_name, 'plan', v_tarif ->> 'plan',
    'plafond', (v_tarif ->> 'plafond')::integer,
    'prix_cents', (v_tarif ->> 'prix_cents')::bigint,
    'billing_period', p_billing_period);
end;
$function$;

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC — et le `revoke` doit viser
-- `anon` NOMMÉMENT, les droits par défaut de Supabase le lui rendant sinon.
-- Constat n°6 du 28 août 2026, qui se reproduit à chaque redéfinition.
revoke all on function public.prix_offre(integer, text) from public, anon;
grant execute on function public.prix_offre(integer, text) to authenticated, service_role;

revoke all on function public.deposer_changement_offre(uuid, integer, text) from public, anon;
grant execute on function public.deposer_changement_offre(uuid, integer, text) to authenticated, service_role;

revoke all on function public.deposer_ajout_magasin(text, integer, text) from public, anon;
grant execute on function public.deposer_ajout_magasin(text, integer, text) to authenticated, service_role;
