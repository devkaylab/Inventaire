-- ─────────────────────────────────────────────────────────────────────────
-- Le formulaire d'inscription répond la même chose (28 août 2026).
--
-- Troisième et dernier volet du constat de la revue de sécurité. Jusqu'ici la
-- fonction publique répondait **deux choses différentes** :
--
--   · adresse inconnue  → `{success: true, request_id: …}`
--   · adresse déjà vue  → `{success: false, error: 'Une demande est déjà en
--                           cours pour cette adresse…'}`
--
-- Autrement dit, on pouvait poser au formulaire une question qu'on ne lui
-- avait pas posée : « est-ce que cette adresse a déjà parlé à Quantinvo ? ».
-- C'est le même oracle que celui fermé sur `/superviseur` par le constat M3,
-- et il se ferme de la même façon.
--
-- ⚠️ LA LIMITATION DE DÉBIT NE SUFFISAIT PAS, et il faut savoir pourquoi :
-- la limite à 5 est posée **sur l'adresse testée**. Quelqu'un qui essaie mille
-- adresses différentes a droit à un essai sur chacune — elle ne le gêne pas.
-- Seule la limite par point de connexion (20 par heure) le freinait. Une
-- limitation de débit ne remplace pas une réponse uniforme ; elle la rend
-- seulement plus lente à contourner.
--
-- LE MOTIF, repris de `submit_supervisor_request` / `…_detailed` :
--
--   · `submit_company_request_detailed` fait tout le travail et rend le
--     détail (`outcome`). Elle n'est exécutable que par le **rôle serveur** ;
--   · `submit_company_request` est un **mince enrobage** public : elle appelle
--     la précédente et n'en laisse sortir que `{success: true, received: true}`.
--
-- ⚠️ L'enrobage APPELLE, il ne recopie pas. C'est délibéré : la duplication
-- est exactement ce qui a fait perdre la limitation de débit le 21 août. Une
-- seule implémentation, donc rien à resynchroniser.
--
-- ⚠️ `request_id` disparaît de la réponse publique. Le rendre à la création et
-- pas autrement aurait laissé l'oracle intact — un identifiant présent ou
-- absent est une réponse aussi bavarde qu'une phrase. Personne ne le lisait :
-- ni l'écran, ni la fonction edge.
--
-- CE QUI RESTE EXPLICITE : les erreurs de saisie (champ vide, e-mail
-- malformé, SIREN faux, texte trop long, nombre de magasins) et le refus pour
-- excès de tentatives. Elles ne parlent que de ce que la personne vient de
-- taper, jamais du contenu de la base. C'est la règle du projet depuis M3.
--
-- CE QUE LE VRAI CLIENT APPREND QUAND MÊME : la fonction edge lui écrit. Qui
-- teste des adresses ne voit rien changer à l'écran ; qui possède l'adresse
-- reçoit dans sa boîte « votre demande est déjà en cours ». Le canal n'atteint
-- que le propriétaire de l'adresse — c'est tout l'intérêt.
--
-- LIMITE CONNUE, ET ASSUMÉE : une demande créée déclenche deux e-mails
-- (l'accusé et l'avis interne), une demande déjà en cours un seul. Le temps de
-- réponse diffère donc un peu. C'est un canal auxiliaire étroit, bruité par le
-- réseau, et déjà présent sur le formulaire superviseur. On ne le ferme pas.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Le détail, réservé au rôle serveur ─────────────────────────────────────
-- `outcome` vaut 'created' ou 'request_pending'. Seule une fonction edge en
-- `service_role` peut l'obtenir, pour envoyer l'explication par e-mail.
create or replace function public.submit_company_request_detailed(
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

  -- ── Bornes de longueur (20260828130001) ──────────────────────────────────
  -- Avant la limitation de débit : une saisie trop longue ne consomme pas le
  -- quota, pas plus qu'une faute de frappe.
  if length(btrim(p_company_name)) > 80 then
    return json_build_object('success', false,
      'error', 'Le nom de l''entreprise ne peut pas dépasser 80 caractères.');
  end if;
  if length(btrim(p_first_name)) > 80 or length(btrim(p_last_name)) > 80 then
    return json_build_object('success', false,
      'error', 'Le prénom et le nom ne peuvent pas dépasser 80 caractères.');
  end if;
  if length(v_email) > 254 then
    return json_build_object('success', false,
      'error', 'Cette adresse e-mail est trop longue.');
  end if;
  if length(btrim(coalesce(p_phone, ''))) > 30 then
    return json_build_object('success', false,
      'error', 'Ce numéro de téléphone est trop long.');
  end if;
  if length(btrim(coalesce(p_message, ''))) > 2000 then
    return json_build_object('success', false,
      'error', 'Votre message dépasse 2 000 caractères. Dites-nous l''essentiel, nous vous rappelons.');
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
    -- 80 comme `nom_propre`, et comme le champ de l'écran. Tronqué et non
    -- refusé : c'est le comportement d'origine de cette boucle.
    v_propre := v_propre || jsonb_build_object(
      'name', left(v_nom, 80), 'units', v_units, 'sqm', v_sqm);
  end loop;

  v_count := greatest(jsonb_array_length(v_propre), coalesce(p_store_count, 0));
  if v_count < 1 or v_count > 500 then
    return json_build_object('success', false,
      'error', 'Le nombre de magasins doit être compris entre 1 et 500.');
  end if;

  -- ── Le verrou (M3), rétabli par 20260828120001 ───────────────────────────
  -- Après la validation de saisie, et **avant** la recherche par adresse.
  -- Elle ne renseigne plus personne depuis que la réponse est uniforme, mais
  -- elle reste ce qui protège de l'inondation.
  if not public.rate_limit_ok('company_request', v_email, 5, interval '1 hour')
     or not public.rate_limit_ok('company_request_ip', public.client_ip(), 20, interval '1 hour') then
    return json_build_object('success', false,
      'error', 'Trop de tentatives depuis cette adresse. Réessayez dans une heure.');
  end if;

  -- Une demande déjà en cours n'est pas une erreur : c'est une issue, et elle
  -- se dit par e-mail à qui possède l'adresse. Rien n'est créé une seconde
  -- fois.
  if exists (select 1 from public.company_requests
             where lower(contact_email) = v_email
               and status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', true, 'outcome', 'request_pending',
      'email', v_email, 'first_name', btrim(p_first_name),
      'company_name', btrim(p_company_name));
  end if;

  insert into public.company_requests
    (company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
     store_count, message, siren, stores, ape)
  values
    (btrim(p_company_name), btrim(p_first_name), btrim(p_last_name), v_email,
     coalesce(btrim(p_phone), ''), v_count, coalesce(btrim(p_message), ''),
     v_siren, v_propre, v_ape)
  returning id into v_id;

  return json_build_object('success', true, 'outcome', 'created',
    'request_id', v_id::text, 'email', v_email,
    'first_name', btrim(p_first_name), 'company_name', btrim(p_company_name));
end; $function$;

revoke all on function public.submit_company_request_detailed(text, text, text, text, text, int, text, text, jsonb, text)
  from public, anon, authenticated;

comment on function public.submit_company_request_detailed(text, text, text, text, text, int, text, text, jsonb, text) is
  'Depot d''une demande d''inscription, avec le detail de l''issue (outcome). Reservee au role serveur : le detail dirait a un inconnu si une adresse a deja depose une demande. La surface publique est submit_company_request.';

-- ── La surface publique : un enrobage, et rien de plus ─────────────────────
create or replace function public.submit_company_request(
  p_company_name text, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_store_count int, p_message text default '',
  p_siren text default null, p_stores jsonb default '[]'::jsonb,
  p_ape text default null)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare v json;
begin
  v := public.submit_company_request_detailed(
         p_company_name, p_first_name, p_last_name, p_email, p_phone,
         p_store_count, p_message, p_siren, p_stores, p_ape);

  -- Les erreurs de saisie restent explicites : elles ne parlent que de ce que
  -- la personne vient de taper.
  if (v ->> 'success')::boolean is distinct from true then
    return json_build_object('success', false, 'error', v ->> 'error');
  end if;

  -- Tout le reste répond la même chose. `outcome` et `request_id` ne
  -- ressortent jamais d'ici : c'est là qu'était l'oracle.
  return json_build_object('success', true, 'received', true);
end; $function$;

comment on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) is
  'Surface publique du formulaire d''inscription. Repond la meme chose qu''une demande soit creee ou deja en cours (revue de securite du 28 aout 2026) : le detail part par e-mail, canal qui n''atteint que le proprietaire de l''adresse.';

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC : les droits se reposent dans
-- la même migration (leçon de 20260819172706).
revoke all on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) from public;
grant execute on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) to anon, authenticated;
