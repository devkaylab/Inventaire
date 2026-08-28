-- ─────────────────────────────────────────────────────────────────────────
-- Le formulaire d'inscription borne ce qu'il accepte (28 août 2026).
--
-- Suite de la revue de sécurité du 28 août, et second volet du même constat
-- que `20260828120001`. `submit_company_request` est appelable **sans compte** :
-- jusqu'ici, `company_name`, `message`, `contact_phone`, le prénom et le nom
-- pouvaient recevoir un texte de n'importe quelle taille. Le stock théorique,
-- la surface et le nombre de magasins étaient bornés depuis le premier jour ;
-- le texte, non.
--
-- ⚠️ REFUS, PAS TRONCATURE. Ces valeurs ne restent pas dans leur table : le
-- nom de l'entreprise devient `companies.name` à la création, et il figure sur
-- le devis puis sur la facture Stripe — des pièces datées, qui ne se
-- réécrivent pas. Tronquer en silence produirait un document faux ; le message
-- du client, lui, serait amputé sans qu'il le sache. La règle du projet vaut
-- ici sans réserve : les erreurs de saisie restent explicites, elles ne
-- parlent que de ce que la personne vient de taper.
--
-- LES CHIFFRES, ET D'OÙ ILS VIENNENT.
--   · nom d'entreprise, prénom, nom : 80 — c'est la borne de `nom_propre()`,
--     qui gouverne déjà tous les renommages (`ca_rename_company`,
--     `admin_rename_store`). Sans cet alignement, une entreprise créée depuis
--     une demande pouvait porter un nom qu'aucun renommage n'aurait pu lui
--     redonner ;
--   · e-mail : 254, la longueur maximale d'une adresse (RFC 5321) ;
--   · téléphone : 30, de quoi écrire un numéro international espacé ;
--   · besoin exprimé : 2 000, quelques paragraphes.
--
-- Le contrôle est placé **avant** la limitation de débit : une saisie trop
-- longue ne doit pas consommer le quota de quelqu'un, au même titre qu'une
-- faute de frappe.
--
-- LE NOM DE MAGASIN PASSE DE 120 À 80, pour le même alignement. Lui reste
-- tronqué et non refusé — c'est le comportement d'origine, et l'écran borne
-- déjà le champ à 80 (`MagasinSaisie`), donc la troncature ne se déclenche que
-- sur un appel direct à l'API.
--
-- LES CONTRAINTES DE TABLE sont la ceinture. La fonction est aujourd'hui le
-- seul chemin d'écriture ouvert à `anon` ; la contrainte, elle, vaudra aussi
-- pour la fonction qu'on écrira demain. La table est vide au moment où elles
-- sont posées — vérifié.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.company_requests
  drop constraint if exists company_requests_longueurs,
  add  constraint company_requests_longueurs check (
        length(company_name)        <= 80
    and length(contact_first_name)  <= 80
    and length(contact_last_name)   <= 80
    and length(contact_email)       <= 254
    and length(contact_phone)       <= 30
    and length(message)             <= 2000
  );

comment on constraint company_requests_longueurs on public.company_requests is
  'Bornes de longueur du formulaire public d''inscription (revue de securite du 28 aout 2026). Ceinture : la fonction submit_company_request refuse deja, avec un message lisible.';

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

  -- ── Bornes de longueur ───────────────────────────────────────────────────
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
  -- Après la validation de saisie, et **avant** la recherche par adresse, qui
  -- est ce qu'un script viendrait interroger pour énumérer des adresses.
  if not public.rate_limit_ok('company_request', v_email, 5, interval '1 hour')
     or not public.rate_limit_ok('company_request_ip', public.client_ip(), 20, interval '1 hour') then
    return json_build_object('success', false,
      'error', 'Trop de tentatives depuis cette adresse. Réessayez dans une heure.');
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

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC : les droits se reposent dans
-- la même migration (leçon de 20260819172706).
revoke all on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) from public;
grant execute on function public.submit_company_request(text, text, text, text, text, int, text, text, jsonb, text) to anon, authenticated;
