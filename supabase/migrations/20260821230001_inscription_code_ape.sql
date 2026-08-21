-- ─────────────────────────────────────────────────────────────────────────
-- Demande d'inscription : le code APE rendu par le registre.
--
-- Pourquoi le stocker. Le recoupement stock / surface reposait sur une
-- fourchette de densité unique — 20 à 400 unités par mètre carré — assez large
-- pour ne rien signaler d'utile : les tranches tarifaires sont espacées d'un
-- facteur 2,5 à 5, la fourchette couvrait un facteur 20. Le secteur d'activité
-- resserre la fourchette et redonne un sens au repère (`web/lib/secteurs.ts`).
--
-- D'où il vient. Le formulaire interroge le registre public depuis le
-- navigateur du visiteur, et transmet le code obtenu avec la demande.
-- **C'est donc une valeur venue du client, et elle n'est qu'une indication** :
-- elle n'ouvre aucun droit et ne décide de rien. La console d'administration
-- porte le lien vers l'annuaire des entreprises pour vérifier d'un clic.
-- Le champ est borné à huit caractères, ce qui suffit à « 47.71Z » et referme
-- la porte à un texte arbitraire.
--
-- Ce n'est pas une donnée à caractère personnel : c'est la classification
-- d'activité d'un établissement.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.company_requests
  add column if not exists ape text;

comment on column public.company_requests.ape is
  'Code APE rendu par le registre public, transmis par le navigateur du visiteur. Indication seulement : sert a resserrer le repere de densite stock/surface dans la console admin.';

create or replace function public.submit_company_request(
  p_company_name text, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_store_count int, p_message text default '',
  p_siren text default null, p_stores jsonb default '[]'::jsonb,
  p_ape text default null)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_siren text := nullif(regexp_replace(coalesce(p_siren, ''), '\D', '', 'g'), '');
  v_ape text := nullif(left(btrim(coalesce(p_ape, '')), 8), '');
  v_stores jsonb := coalesce(p_stores, '[]'::jsonb);
  v_propre jsonb := '[]'::jsonb;
  v_ligne jsonb;
  v_nom text;
  v_units numeric;
  v_sqm numeric;
  v_count int;
begin
  if coalesce(btrim(p_company_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le nom de l''entreprise est requis.');
  end if;
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le prénom et le nom du contact sont requis.');
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;

  if v_siren is not null and not public.siren_valide(v_siren) then
    return json_build_object('success', false,
      'error', 'Ces neuf chiffres ne forment pas un SIREN valide.');
  end if;

  -- Un code d'activité sans numéro d'entreprise ne veut rien dire.
  if v_siren is null then
    v_ape := null;
  end if;

  if jsonb_typeof(v_stores) <> 'array' then
    v_stores := '[]'::jsonb;
  end if;

  for v_ligne in select * from jsonb_array_elements(v_stores) loop
    v_nom := btrim(coalesce(v_ligne ->> 'name', ''));
    begin
      v_units := nullif(v_ligne ->> 'units', '')::numeric;
      v_sqm := nullif(v_ligne ->> 'sqm', '')::numeric;
    exception when others then
      return json_build_object('success', false,
        'error', 'Le stock et la surface doivent être des nombres.');
    end;
    if v_units is not null and (v_units < 0 or v_units > 100000000) then
      return json_build_object('success', false, 'error', 'Volume de stock hors limites.');
    end if;
    if v_sqm is not null and (v_sqm < 0 or v_sqm > 1000000) then
      return json_build_object('success', false, 'error', 'Surface hors limites.');
    end if;
    v_propre := v_propre || jsonb_build_object(
      'name', left(v_nom, 120), 'units', v_units, 'sqm', v_sqm);
  end loop;

  v_count := greatest(jsonb_array_length(v_propre), coalesce(p_store_count, 0));
  if v_count < 1 or v_count > 500 then
    return json_build_object('success', false,
      'error', 'Le nombre de magasins doit être compris entre 1 et 500.');
  end if;

  if exists (select 1 from public.company_requests
             where lower(contact_email) = v_email
               and status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', false,
      'error', 'Une demande est déjà en cours pour cette adresse. Notre équipe vous recontacte.');
  end if;

  insert into public.company_requests
    (company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
     store_count, message, siren, stores, ape)
  values
    (btrim(p_company_name), btrim(p_first_name), btrim(p_last_name), v_email,
     coalesce(btrim(p_phone), ''), v_count, coalesce(btrim(p_message), ''),
     v_siren, v_propre, v_ape)
  returning id into v_id;

  return json_build_object('success', true, 'request_id', v_id::text);
end; $function$;

-- L'ancienne signature est retirée : deux variantes dont l'une accepte un
-- sur-ensemble de l'autre rendraient l'appel ambigu côté PostgREST. Le
-- paramètre ajouté a une valeur par défaut, donc le formulaire actuellement
-- déployé — qui ne l'envoie pas — continue de fonctionner.
drop function if exists public.submit_company_request(text, text, text, text, text, int, text, text, jsonb);

revoke all on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) from public;
grant execute on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) to anon, authenticated;

drop function if exists public.admin_list_company_requests();

create or replace function public.admin_list_company_requests()
returns table(id uuid, company_name text, contact_first_name text, contact_last_name text,
              contact_email text, contact_phone text, store_count int, message text,
              status text, quote_reference text, quote_amount_cents bigint,
              admin_note text, company_id uuid, created_at timestamptz,
              siren text, stores jsonb, ape text)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.company_name, r.contact_first_name, r.contact_last_name, r.contact_email,
           r.contact_phone, r.store_count, r.message, r.status, r.quote_reference,
           r.quote_amount_cents, r.admin_note, r.company_id, r.created_at,
           r.siren, r.stores, r.ape
    from public.company_requests r
    order by case r.status when 'pending' then 0 when 'accepted' then 1 when 'quoted' then 2
                           when 'paid' then 3 when 'created' then 4 else 5 end,
             r.created_at desc;
end; $function$;

revoke all on function public.admin_list_company_requests() from public, anon;
grant execute on function public.admin_list_company_requests() to authenticated;
