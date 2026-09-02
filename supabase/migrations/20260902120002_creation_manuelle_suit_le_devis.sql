-- ============================================================================
-- Le chemin MANUEL suit le devis, lui aussi (2 septembre 2026)
-- ----------------------------------------------------------------------------
-- Trouvé en passant les fonctions en revue pour la bascule aux appareils. Deux
-- fonctions de la console — celles qui créent « à la main », quand un paiement
-- est arrivé par un autre canal que Stripe — étaient restées à la grille au
-- volume, et l'une d'elles la portait EN DUR :
--
--   · `admin_fulfil_company_request` recalculait le prix de chaque magasin par
--     un `case when v_units <= 10000 then 210000 …`. C'est le défaut VR-002 du
--     28 août — « on crée ce qui a été devisé » — corrigé dans le chemin payé
--     et jamais dans le chemin manuel. Il facturait donc au volume un client
--     devisé aux appareils, et écrivait un prix que personne n'avait relu.
--   · `admin_add_store` ne portait ni les appareils ni le prix : un magasin
--     créé par ce chemin arrivait sans assiette et sans licence, donc compté au
--     panier moyen dans le revenu annuel — le défaut corrigé le 22 août pour le
--     webhook, resté ici.
--
-- ⚠️ Les deux suivent maintenant la MÊME règle que `fulfil_paid_request` :
-- `annual_price_cents = coalesce(annuelCents, prixCents)` pris sur la ligne du
-- devis. Jamais un recalcul, jamais une annualisation par le rythme quand une
-- ligne existe — voir l'en-tête de `20260902120001`.
-- ============================================================================

-- ── 1. Un magasin se crée avec son assiette et son prix ────────────────────
-- ⚠️ L'ancienne signature à quatre arguments est SUPPRIMÉE : les nouveaux
-- paramètres ayant un défaut, Postgres garderait les deux et un appel à deux
-- arguments — celui de la console — deviendrait ambigu.

drop function if exists public.admin_add_store(uuid, text, integer, integer);

create or replace function public.admin_add_store(
  p_company_id uuid,
  p_name text,
  p_units integer default null,
  p_sqm integer default null,
  p_devices integer default null,
  p_annual_price_cents integer default null
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid; v_code text; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if coalesce(trim(p_name), '') = '' then return json_build_object('success', false, 'error', 'Nom requis'); end if;
  select name into v_company from public.companies where id = p_company_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Entreprise introuvable'); end if;
  v_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code, units, sqm, devices, annual_price_cents)
    values (p_company_id, trim(p_name), v_code,
            nullif(greatest(coalesce(p_units, 0), 0), 0),
            nullif(greatest(coalesce(p_sqm, 0), 0), 0),
            nullif(greatest(coalesce(p_devices, 0), 0), 0),
            nullif(greatest(coalesce(p_annual_price_cents, 0), 0), 0))
    returning id into v_id;
  perform public.log_admin_action('magasin_ajoute', 'magasin', v_id::text, trim(p_name),
    json_build_object('entreprise', v_company, 'appareils', p_devices)::jsonb);
  return json_build_object('success', true, 'store_id', v_id::text, 'name', trim(p_name), 'join_code', v_code);
end;
$function$;

revoke all on function public.admin_add_store(uuid, text, integer, integer, integer, integer)
  from public, anon;
grant execute on function public.admin_add_store(uuid, text, integer, integer, integer, integer)
  to authenticated, service_role;

-- ── 2. La création manuelle d'un magasin reprend ce qui a été devisé ───────

create or replace function public.admin_fulfil_store_request(p_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_req public.store_requests%rowtype;
  v_res json; v_email text; v_first text; v_company text; v_annuel bigint;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  -- `for update` : le second clic attend, relit la ligne transformée, et son
  -- propre contrôle de statut le refuse (VR-005, 28 août 2026).
  select * into v_req from public.store_requests where id = p_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.status = 'created' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'Le magasin ne peut être créé qu''après encaissement de la facture.');
  end if;

  -- Ce que le magasin vaut à l'année, pris sur la ligne du devis. Une demande
  -- de magasin ne vient jamais de la souscription en ligne : à défaut de ligne,
  -- le rythme peut annualiser sans réserve.
  v_annuel := coalesce(
    nullif(v_req.quote_lines -> 0 ->> 'annuelCents', '')::bigint,
    case when v_req.billing_period = 'monthly' then v_req.quote_amount_cents * 12
         else v_req.quote_amount_cents end);

  -- Le nombre d'appareils et le volume déclaré voyagent jusqu'au magasin :
  -- c'est l'assiette, elle doit survivre à la demande qui l'a portée.
  v_res := public.admin_add_store(v_req.company_id, v_req.store_name,
                                  v_req.units, v_req.sqm, v_req.devices, v_annuel::integer);
  if not coalesce((v_res ->> 'success')::boolean, false) then
    return v_res;
  end if;

  update public.store_requests
     set status = 'created', handled_at = now(), store_id = (v_res ->> 'store_id')::uuid
   where id = p_id;

  perform public.log_admin_action('demande_magasin_creee', 'entreprise', v_req.company_id::text,
    v_req.store_name, json_build_object('magasin', v_res ->> 'store_id')::jsonb);

  select lower(u.email::text), p.first_name
    into v_email, v_first
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_req.requested_by;

  select c.name into v_company from public.companies c where c.id = v_req.company_id;

  -- ⚠️ La réponse d'`admin_add_store` est reprise telle quelle, sans rien y
  -- nommer : le code d'accès du magasin y figure, et un test vérifie qu'il
  -- n'est pas construit ici — c'est la fonction edge qui doit ne jamais le
  -- mettre dans un e-mail. Forme inchangée depuis le 28 août.
  return (v_res::jsonb || jsonb_build_object(
    'notify', case when v_email is null then null else jsonb_build_object(
      'email', v_email,
      'first_name', coalesce(v_first, ''),
      'store_name', v_req.store_name,
      'company_name', coalesce(v_company, ''),
      'store_id', v_res ->> 'store_id'
    ) end
  ))::json;
end;
$function$;

revoke all on function public.admin_fulfil_store_request(uuid) from public, anon;
grant execute on function public.admin_fulfil_store_request(uuid) to authenticated, service_role;

-- ── 3. La création manuelle d'une entreprise suit le devis, elle aussi ─────
-- ⚠️ Le `case when v_units <= 10000 then 210000 …` a disparu : la grille au
-- volume ne tarife plus rien, et un prix recalculé en base est un prix que
-- personne n'a relu. C'est la ligne du devis qui fait foi — miroir exact de
-- `fulfil_paid_request`, aux deux mêmes replis près.

create or replace function public.admin_fulfil_company_request(
  p_id uuid, p_store_names text[] default null
) returns json
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_n int; v_stores json[] := '{}';
  v_ligne jsonb; v_decl jsonb; v_prix bigint; v_annuel bigint; v_devices integer;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Acces refuse'); end if;
  select * into v_req from public.company_requests where id = p_id for update;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'L''entreprise ne peut etre creee qu''apres encaissement de la facture.');
  end if;

  -- On crée ce qui a été DEVISÉ, pas ce qui a été déclaré au formulaire
  -- (VR-002, 28 août 2026) : le second est saisi par le prospect.
  v_n := coalesce(nullif(jsonb_array_length(coalesce(v_req.quote_lines, '[]'::jsonb)), 0),
                  v_req.store_count);

  v_company_code := public.gen_company_code();
  insert into public.companies (name, join_code, plan, billing_period)
    values (v_req.company_name, v_company_code,
            coalesce(v_req.plan, 'standard'), v_req.billing_period)
    returning id into v_company_id;

  for v_i in 1..v_n loop
    v_ligne := v_req.quote_lines -> (v_i - 1);
    v_decl  := v_req.stores -> (v_i - 1);
    v_name := coalesce(
      nullif(btrim(p_store_names[v_i]), ''),
      nullif(btrim(coalesce(v_ligne ->> 'libelle', '')), ''),
      nullif(btrim(coalesce(v_decl ->> 'name', '')), ''),
      'Magasin ' || v_i);

    if v_ligne ? 'prixCents' and (v_ligne ->> 'prixCents') is not null then
      v_prix := (v_ligne ->> 'prixCents')::bigint;
      v_annuel := coalesce(nullif(v_ligne ->> 'annuelCents', '')::bigint, v_prix);
    else
      v_prix := case when v_req.quote_amount_cents is not null and v_n > 0
                     then v_req.quote_amount_cents / v_n end;
      v_annuel := case when v_req.billing_period = 'monthly' then v_prix * 12 else v_prix end;
    end if;
    v_devices := coalesce(nullif(btrim(coalesce(v_ligne ->> 'appareils', '')), '')::integer,
                          nullif(btrim(coalesce(v_decl ->> 'devices', '')), '')::integer);

    v_store_code := public.gen_store_code();
    insert into public.stores (company_id, name, join_code, annual_price_cents, devices, units, sqm)
      values (v_company_id, v_name, v_store_code, v_annuel, v_devices,
              nullif(btrim(coalesce(v_decl ->> 'units', '')), '')::integer,
              nullif(btrim(coalesce(v_decl ->> 'sqm', '')), '')::integer);
    v_stores := v_stores || json_build_object(
      'name', v_name, 'join_code', v_store_code,
      'annual_price_cents', v_annuel, 'devices', v_devices);
  end loop;

  update public.company_requests
     set status = 'created', company_id = v_company_id, updated_at = now() where id = p_id;
  perform public.log_admin_action('entreprise_creee_depuis_demande', 'entreprise', v_company_id::text,
    coalesce(v_req.company_name, ''),
    json_build_object('demande_id', p_id::text, 'magasins', v_n)::jsonb);
  return json_build_object('success', true, 'company_id', v_company_id::text,
    'company_code', v_company_code, 'stores', array_to_json(v_stores));
end;
$function$;

revoke all on function public.admin_fulfil_company_request(uuid, text[]) from public, anon;
grant execute on function public.admin_fulfil_company_request(uuid, text[])
  to authenticated, service_role;
