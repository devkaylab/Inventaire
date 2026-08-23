-- Usage constaté — 23 août 2026
--
-- « Je veux juste suivre l'utilisation. » Le produit ne savait rien dire de ce
-- que ses clients en font : ni combien de personnes comptent, ni à quel rythme,
-- ni quel volume passe réellement dans un magasin.
--
-- ── Ce qui manquait en base, et qui bloquait tout ───────────────────────────
--
-- `stores` ne portait PAS le volume déclaré. Il ne vivait que sur les tables de
-- vente (`company_requests.stores` en jsonb, `store_requests.units`). Sans lui
-- sur le magasin, la mesure n'a pas de terme de comparaison.
--
-- Déduire la tranche du prix payé ne marche pas : le prix se négocie (« le
-- montant part tel qu'il est saisi, jamais recalculé »), donc une remise
-- commerciale se lirait comme une sous-déclaration. D'où les deux colonnes.
--
-- ── ⚠️ Ce que la mesure dit, et ce qu'elle ne dit pas ───────────────────────
--
-- `plancher` est le plus gros inventaire UNIQUE des douze derniers mois, jamais
-- la somme de l'année : un magasin compte son stock plusieurs fois par an, les
-- additionner ne voudrait rien dire.
--
-- Il partage l'arithmétique du rapport d'inventaire (somme des `qty` en passe
-- 1) : si un magasin double-comptait une zone, son propre rapport serait faux
-- et il le verrait. C'est ce qui rend le chiffre exploitable — pas une
-- prétention à mesurer le stock réel.
--
-- **La lecture est asymétrique, et un seul sens conclut** : un plancher
-- au-dessus de la borne de la tranche est un fait (on ne compte pas ce qu'on
-- n'a pas) ; en dessous, il ne dit RIEN — un inventaire tournant ne couvre
-- qu'un rayon. Le jugement vit dans `web/lib/mesure.ts`, pas ici : cette
-- fonction ne rend que des faits.

-- ── 1. Le volume déclaré rejoint le magasin ────────────────────────────────

alter table public.stores
  add column if not exists units integer,
  add column if not exists sqm   integer;

comment on column public.stores.units is
  'Volume de stock déclaré à la vente, en unités (pièces physiques, jamais '
  'références). Détermine la tranche tarifaire. Nul si le magasin a été créé '
  'à la main sans volume — se renseigne alors par admin_set_store_volume.';
comment on column public.stores.sqm is
  'Surface déclarée en m². Ne sert qu''au recoupement (voir lib/secteurs.ts), '
  'jamais au prix.';

-- Rattrapage : les demandes de magasin portent le volume nominativement.
update public.stores st
   set units = sr.units,
       sqm   = coalesce(st.sqm, sr.sqm)
  from public.store_requests sr
 where sr.store_id = st.id
   and sr.kind = 'add'
   and sr.units is not null
   and st.units is null;

-- Rattrapage : les demandes d'inscription les portent dans un tableau jsonb.
-- Appariement par nom — au mieux : `fulfil_paid_request` retient d'abord le
-- libellé de la ligne de devis, qui a pu être renommé. Ce qui n'est pas
-- rattrapé reste nul et se renseigne à la main ; c'est sans conséquence, la
-- lecture le dit (« Volume non renseigné ») au lieu de conclure à tort.
update public.stores st
   set units = nullif(btrim(coalesce(e.value ->> 'units', '')), '')::integer,
       sqm   = coalesce(st.sqm, nullif(btrim(coalesce(e.value ->> 'sqm', '')), '')::integer)
  from public.company_requests cr,
       lateral jsonb_array_elements(cr.stores) e
 where cr.company_id = st.company_id
   and cr.stores is not null
   and jsonb_typeof(cr.stores) = 'array'
   and btrim(lower(coalesce(e.value ->> 'name', ''))) = btrim(lower(st.name))
   and nullif(btrim(coalesce(e.value ->> 'units', '')), '') is not null
   and st.units is null;

-- ── 2. La création d'un magasin transporte le volume ───────────────────────
--
-- ⚠️ L'ancienne signature est SUPPRIMÉE, jamais laissée à côté : Postgres
-- garderait les deux et un appel à deux arguments deviendrait ambigu. C'est le
-- piège déjà rencontré sur `ca_request_store` le 22 août. Les valeurs par
-- défaut font que les appelants à deux arguments continuent de marcher.

drop function if exists public.admin_add_store(uuid, text);

create function public.admin_add_store(
  p_company_id uuid,
  p_name       text,
  p_units      integer default null,
  p_sqm        integer default null
) returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_code text; v_company text;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if coalesce(trim(p_name), '') = '' then return json_build_object('success', false, 'error', 'Nom requis'); end if;
  select name into v_company from public.companies where id = p_company_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Entreprise introuvable'); end if;
  v_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code, units, sqm)
    values (p_company_id, trim(p_name), v_code,
            nullif(greatest(coalesce(p_units, 0), 0), 0),
            nullif(greatest(coalesce(p_sqm, 0), 0), 0))
    returning id into v_id;
  perform public.log_admin_action('magasin_ajoute', 'magasin', v_id::text, trim(p_name),
    json_build_object('entreprise', v_company, 'unites', p_units)::jsonb);
  return json_build_object('success', true, 'store_id', v_id::text, 'name', trim(p_name), 'join_code', v_code);
end; $$;

revoke all on function public.admin_add_store(uuid, text, integer, integer) from public, anon;
grant execute on function public.admin_add_store(uuid, text, integer, integer) to authenticated;

-- La demande de magasin passe son volume à la création.
create or replace function public.admin_fulfil_store_request(p_id uuid)
returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.store_requests%rowtype;
  v_res json; v_email text; v_first text; v_company text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id;
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

  -- Le volume déclaré voyage jusqu'au magasin : c'est lui qui rendra la
  -- mesure d'usage comparable à la tranche facturée.
  v_res := public.admin_add_store(v_req.company_id, v_req.store_name, v_req.units, v_req.sqm);
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

  return (v_res::jsonb || jsonb_build_object(
    'notify', case when v_email is null then null else jsonb_build_object(
      'email', v_email,
      'first_name', coalesce(v_first, ''),
      'store_name', v_req.store_name,
      'company_name', coalesce(v_company, ''),
      'store_id', v_res ->> 'store_id'
    ) end
  ))::json;
end; $$;

-- ── 3. Le webhook Stripe écrit le volume, comme il écrit déjà le prix ──────
--
-- Deux insertions dans `stores`, une par branche. Même geste que la migration
-- 20260822270001, qui avait reporté le prix payé : sans cela, tout magasin né
-- d'un paiement serait aveugle à la mesure.

create or replace function public.fulfil_paid_request(
  p_session_id text,
  p_customer_id text default null,
  p_invoice_id text default null,
  p_payment_intent_id text default null
) returns json
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_req public.company_requests%rowtype;
  v_sto public.store_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_stores json[] := '{}';
  v_email text; v_first text; v_company text;
  v_prix bigint; v_ligne jsonb; v_decl jsonb;
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return json_build_object('success', false, 'error', 'Session absente');
  end if;

  select * into v_req from public.company_requests where stripe_checkout_session_id = p_session_id;
  if found then
    if v_req.status in ('paid', 'created') then
      return json_build_object('success', true, 'already', true, 'kind', 'company',
        'status', v_req.status, 'company_id', v_req.company_id);
    end if;
    if v_req.status <> 'accepted' then
      return json_build_object('success', false, 'error',
        'Transition impossible depuis ' || v_req.status);
    end if;

    update public.company_requests
       set status = 'paid', paid_at = now(),
           stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
           stripe_invoice_id = coalesce(p_invoice_id, stripe_invoice_id),
           stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
           updated_at = now()
     where id = v_req.id;

    v_company_code := public.gen_company_code();
    insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
      returning id into v_company_id;
    for v_i in 1..v_req.store_count loop
      v_ligne := v_req.quote_lines -> (v_i - 1);
      v_decl  := v_req.stores -> (v_i - 1);
      v_name := coalesce(nullif(btrim(v_ligne ->> 'libelle'), ''),
                         nullif(btrim(v_decl ->> 'name'), ''),
                         'Magasin ' || v_i);
      v_prix := coalesce((v_ligne ->> 'prixCents')::bigint,
                         case when v_req.quote_amount_cents is not null and v_req.store_count > 0
                              then v_req.quote_amount_cents / v_req.store_count end);
      v_store_code := public.gen_store_code();
      insert into public.stores (company_id, name, join_code, annual_price_cents, units, sqm)
        values (v_company_id, v_name, v_store_code, v_prix,
                nullif(btrim(coalesce(v_decl ->> 'units', '')), '')::integer,
                nullif(btrim(coalesce(v_decl ->> 'sqm', '')), '')::integer);
      v_stores := v_stores || json_build_object('name', v_name, 'join_code', v_store_code, 'price_cents', v_prix);
    end loop;

    update public.company_requests
       set status = 'created', company_id = v_company_id, updated_at = now()
     where id = v_req.id;

    perform public.log_system_action('Stripe', 'paiement_recu', 'demande_entreprise', v_req.id::text,
      v_req.company_name, json_build_object('session', p_session_id, 'montant_cents', v_req.quote_amount_cents)::jsonb);
    perform public.log_system_action('Stripe', 'entreprise_creee_depuis_demande', 'entreprise', v_company_id::text,
      v_req.company_name, json_build_object('demande_id', v_req.id::text, 'magasins', v_req.store_count)::jsonb);

    return json_build_object(
      'success', true, 'already', false, 'kind', 'company',
      'company_id', v_company_id, 'company_name', v_req.company_name,
      'stores', array_to_json(v_stores),
      'invite', json_build_object(
        'email', lower(v_req.contact_email),
        'first_name', v_req.contact_first_name,
        'last_name', v_req.contact_last_name));
  end if;

  select * into v_sto from public.store_requests where stripe_checkout_session_id = p_session_id;
  if not found then
    return json_build_object('success', false, 'error', 'Session inconnue');
  end if;
  if v_sto.status in ('paid', 'created') then
    return json_build_object('success', true, 'already', true, 'kind', 'store',
      'status', v_sto.status, 'store_id', v_sto.store_id);
  end if;
  if v_sto.status <> 'accepted' then
    return json_build_object('success', false, 'error',
      'Transition impossible depuis ' || v_sto.status);
  end if;

  update public.store_requests
     set status = 'paid', paid_at = now(),
         stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
         stripe_invoice_id = coalesce(p_invoice_id, stripe_invoice_id),
         stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id)
   where id = v_sto.id;

  v_store_code := public.gen_store_code();
  insert into public.stores (company_id, name, join_code, annual_price_cents, units, sqm)
    values (v_sto.company_id, v_sto.store_name, v_store_code, v_sto.quote_amount_cents,
            v_sto.units, v_sto.sqm)
    returning id into v_company_id;

  update public.store_requests
     set status = 'created', handled_at = now(), store_id = v_company_id
   where id = v_sto.id;

  select c.name into v_company from public.companies c where c.id = v_sto.company_id;
  select lower(u.email::text), p.first_name into v_email, v_first
    from public.profiles p join auth.users u on u.id = p.id
   where p.id = v_sto.requested_by;

  perform public.log_system_action('Stripe', 'paiement_recu', 'demande_magasin', v_sto.id::text,
    v_sto.store_name, json_build_object('session', p_session_id, 'montant_cents', v_sto.quote_amount_cents)::jsonb);
  perform public.log_system_action('Stripe', 'magasin_ajoute', 'entreprise', v_sto.company_id::text,
    v_sto.store_name, json_build_object('entreprise', coalesce(v_company, ''), 'magasin', v_company_id::text)::jsonb);

  return json_build_object(
    'success', true, 'already', false, 'kind', 'store',
    'store_id', v_company_id, 'store_name', v_sto.store_name,
    'company_id', v_sto.company_id, 'company_name', coalesce(v_company, ''),
    'notify', case when v_email is null then null else json_build_object(
      'email', v_email, 'first_name', coalesce(v_first, ''),
      'store_name', v_sto.store_name, 'company_name', coalesce(v_company, ''),
      'store_id', v_company_id::text) end);
end; $$;

-- Le webhook n'a pas de session : réservée au seul service_role, comme les
-- trois autres fonctions qu'il appelle.
revoke all on function public.fulfil_paid_request(text, text, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_paid_request(text, text, text, text) to service_role;

-- ── 4. Corriger un volume à la main ────────────────────────────────────────
--
-- Un magasin créé directement depuis la console n'a pas de volume, et une
-- déclaration se corrige. Écriture, donc journalisée — comme toute fonction
-- `admin_*` qui écrit (test de garde : web/tests/journal-admin.test.ts).

create or replace function public.admin_set_store_volume(
  p_store_id uuid,
  p_units    integer,
  p_sqm      integer default null
) returns json
language plpgsql security definer set search_path to 'public'
as $$
declare v_name text; v_company text; v_avant integer;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if p_units is not null and p_units <= 0 then
    return json_build_object('success', false, 'error', 'Le volume doit être positif.');
  end if;
  if p_sqm is not null and p_sqm <= 0 then
    return json_build_object('success', false, 'error', 'La surface doit être positive.');
  end if;

  select s.name, s.units, c.name into v_name, v_avant, v_company
    from public.stores s join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  if v_name is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable');
  end if;

  update public.stores set units = p_units, sqm = coalesce(p_sqm, sqm)
   where id = p_store_id;

  perform public.log_admin_action('volume_magasin_modifie', 'magasin', p_store_id::text, v_name,
    json_build_object('entreprise', v_company, 'avant', v_avant, 'apres', p_units)::jsonb);

  return json_build_object('success', true);
end; $$;

revoke all on function public.admin_set_store_volume(uuid, integer, integer) from public, anon;
grant execute on function public.admin_set_store_volume(uuid, integer, integer) to authenticated;

-- ── 5. La lecture : des faits, rien que des faits ──────────────────────────

create or replace function public.admin_usage_overview(p_company_id uuid)
returns json
language plpgsql stable security definer set search_path to 'public'
as $$
declare v json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  with sessions as (
    select s.id, s.store_id, s.created_at,
           sum(c.qty) filter (where c.pass_number = 1) as pieces,
           count(distinct c.counted_by)                as compteurs,
           count(c.id)                                 as lignes
      from public.inventory_sessions s
      left join public.counts c on c.session_id = s.id
     where s.company_id = p_company_id
       and s.created_at > now() - interval '12 months'
     group by s.id, s.store_id, s.created_at
  ),
  par_magasin as (
    select store_id,
           count(*)           as inventaires,
           max(pieces)        as plancher,
           max(compteurs)     as compteurs,
           max(created_at)    as dernier,
           sum(lignes)        as lignes
      from sessions
     where store_id is not null
     group by store_id
  )
  select json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object(
               'id',                 st.id,
               'name',               st.name,
               'units',              st.units,
               'sqm',                st.sqm,
               'annual_price_cents', st.annual_price_cents,
               'inventaires',        coalesce(pm.inventaires, 0),
               -- Peut être nul : un inventaire sans aucun comptage en passe 1.
               'plancher',           pm.plancher,
               -- ⚠️ Peut valoir 0 alors que des lignes existent : `counted_by`
               -- est mis à NULL quand un compte est supprimé (migration
               -- 20260818000001). La lecture le distingue de « personne n'a
               -- compté » en regardant `lignes`.
               'compteurs',          coalesce(pm.compteurs, 0),
               'lignes',             coalesce(pm.lignes, 0),
               'dernier',            pm.dernier
             ) order by st.name), '[]'::json)
        from public.stores st
        left join par_magasin pm on pm.store_id = st.id
       where st.company_id = p_company_id
    ),
    'inventaires', (select count(*) from sessions),
    'compteurs_distincts', (
      select count(distinct c.counted_by)
        from public.counts c
        join public.inventory_sessions s on s.id = c.session_id
       where s.company_id = p_company_id
         and c.created_at > now() - interval '12 months'
    )
  ) into v;

  return v;
end; $$;

revoke all on function public.admin_usage_overview(uuid) from public, anon;
grant execute on function public.admin_usage_overview(uuid) to authenticated;

comment on function public.admin_usage_overview(uuid) is
  'Usage constaté d''une entreprise sur 12 mois — faits seulement. Le jugement '
  '(comparaison à la tranche, règle d''asymétrie) vit dans web/lib/mesure.ts, '
  'qui se teste sans base.';
