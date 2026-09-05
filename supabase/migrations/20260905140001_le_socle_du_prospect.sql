-- Le socle du parcours d'inscription : un compte de prospect (5 septembre 2026)
--
-- Maquette validée : https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a
-- « On paie, on est inscrit » — plus de demande, plus de devis, plus d'attente.
--
-- ⚠️ CETTE MIGRATION ROUVRE L'AUTO-INSCRIPTION, fermée depuis le 13 août 2026.
-- C'était LE verrou qui protégeait tout le reste : `handle_new_user` refusait
-- tout e-mail sans invitation. Ce qui le remplace, ce n'est pas rien — c'est un
-- e-mail VÉRIFIÉ par un code à six chiffres, et un profil qui ne voit rien.
--
-- Les neuf contrôles de la maquette, et où ils vivent :
--   1. réponse uniforme .................. la fonction edge (le détail reste ici)
--   2. limitation de débit ............... `demander_code_email`, avant la
--                                          recherche par adresse
--   3. le code EST une barrière .......... 6 chiffres CSPRNG, 10 min, usage
--                                          unique, 5 essais, comparaison bcrypt
--   4. un compte sans entreprise ne voit rien ... `role = 'employee'`,
--                                          `company_id` nul (vérifié fonction
--                                          par fonction, pas déduit)
--   5. il ne peut pas s'écrire une entreprise ... `profiles_pin_privileged` et
--                                          la policy INSERT fermée par VR-008
--                                          ne sont PAS touchées
--   6 à 9 ................................ migrations suivantes (la demande,
--                                          le paiement, la reprise)

-- ─── Le code à six chiffres ────────────────────────────────────────────────
--
-- ⚠️ RLS active, AUCUNE policy, et révoquée à `authenticated` : cette table ne
-- se lit et ne s'écrit que par les deux fonctions ci-dessous, en `service_role`.
-- Le motif de `stripe_events_traites` et de `submission_attempts`.
create table if not exists public.codes_email (
  email       text primary key,
  code_hash   text not null,
  expire_le   timestamptz not null,
  essais      integer not null default 0,
  consomme_le timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.codes_email enable row level security;
revoke all on table public.codes_email from public, anon, authenticated;

comment on table public.codes_email is
  'Codes de vérification d''adresse du parcours d''inscription. Un seul code vivant par adresse : une nouvelle demande remplace la précédente, sinon on accumulerait des essais.';

-- ─── Tirer un code, sans biais ─────────────────────────────────────────────
--
-- ⚠️ `extensions.gen_random_bytes`, QUALIFIÉE PAR SON SCHÉMA : Supabase installe
-- pgcrypto dans `extensions`, et ces fonctions figent `search_path` à 'public'.
-- L'appel nu échoue à l'exécution, pas à la création — la migration passerait
-- et la génération casserait au premier essai (leçon du 28 août 2026).
--
-- ⚠️ ET LE MODULO EST REJETÉ, PAS SUBI : 2^32 n'est pas un multiple de 10^6, un
-- `% 1000000` nu favoriserait les 3 % de codes les plus bas. On retire donc le
-- reliquat au-dessus du plus grand multiple.
create or replace function public.tirer_code_a_six_chiffres()
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_n bigint;
  v_max constant bigint := 4294000000;  -- le plus grand multiple de 10^6 sous 2^32
begin
  loop
    v_n := ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint;
    exit when v_n < v_max;
  end loop;
  return lpad((v_n % 1000000)::text, 6, '0');
end;
$function$;

revoke all on function public.tirer_code_a_six_chiffres() from public, anon, authenticated;
grant execute on function public.tirer_code_a_six_chiffres() to service_role;

-- ─── Demander un code ──────────────────────────────────────────────────────
--
-- ⚠️ `service_role` SEUL, et c'est ce qui permet de rendre le détail. La réponse
-- UNIFORME est le travail de la fonction edge : c'est elle qui répond toujours
-- « nous vous avons envoyé un code » au navigateur, et c'est l'e-mail — qui
-- n'atteint que le propriétaire de la boîte — qui dit la vérité. Motif exact de
-- `submit_company_request` / `..._detailed` (28 août 2026).
create or replace function public.demander_code_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code  text;
begin
  -- 1. La saisie d'abord : une faute de frappe ne doit pas consommer le quota
  --    de quelqu'un d'autre.
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('outcome', 'email_invalide');
  end if;
  if length(v_email) > 254 then           -- RFC 5321
    return jsonb_build_object('outcome', 'email_invalide');
  end if;

  -- 2. ⚠️ LE QUOTA AVANT LA RECHERCHE PAR ADRESSE. Un script ne doit pas
  --    pouvoir interroger la base autant qu'il veut avant d'être freiné :
  --    c'est l'ordre qui fait le contrôle (leçon du 28 août 2026).
  if not public.rate_limit_ok('code_email', v_email, 5, interval '1 hour') then
    return jsonb_build_object('outcome', 'trop_de_tentatives');
  end if;

  -- 3. Une adresse qui a déjà un compte ne reçoit PAS de code : elle reçoit un
  --    e-mail qui lui dit de se connecter. Sinon l'inscription deviendrait un
  --    chemin de reprise de compte.
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return jsonb_build_object('outcome', 'compte_existant');
  end if;

  v_code := public.tirer_code_a_six_chiffres();

  -- ⚠️ Le code n'est JAMAIS stocké en clair, et une nouvelle demande REMPLACE
  --    la précédente : sinon on accumulerait des codes vivants pour une même
  --    adresse, chacun avec ses cinq essais.
  insert into public.codes_email (email, code_hash, expire_le, essais, consomme_le)
       values (v_email, extensions.crypt(v_code, extensions.gen_salt('bf')),
               now() + interval '10 minutes', 0, null)
  on conflict (email) do update
     set code_hash   = excluded.code_hash,
         expire_le   = excluded.expire_le,
         essais      = 0,
         consomme_le = null,
         created_at  = now();

  return jsonb_build_object('outcome', 'code', 'code', v_code);
end;
$function$;

revoke all on function public.demander_code_email(text) from public, anon, authenticated;
grant execute on function public.demander_code_email(text) to service_role;

-- ─── Vérifier un code ──────────────────────────────────────────────────────
--
-- ⚠️ CINQ ESSAIS, PUIS LE CODE EST INVALIDÉ. Sans cette borne, un million de
-- combinaisons se teste vite — et le code est la SEULE barrière du parcours.
-- L'essai est compté AVANT la comparaison : un appel qui échouerait après la
-- comparaison ne doit pas rendre l'essai gratuit.
create or replace function public.verifier_code_email(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code  text := btrim(coalesce(p_code, ''));
  v_ligne public.codes_email%rowtype;
begin
  if v_email = '' or v_code !~ '^\d{6}$' then
    return jsonb_build_object('ok', false, 'raison', 'code_invalide');
  end if;

  select * into v_ligne from public.codes_email where email = v_email for update;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'code_invalide');
  end if;
  if v_ligne.consomme_le is not null then
    return jsonb_build_object('ok', false, 'raison', 'code_invalide');
  end if;
  if v_ligne.expire_le <= now() then
    return jsonb_build_object('ok', false, 'raison', 'code_expire');
  end if;
  if v_ligne.essais >= 5 then
    return jsonb_build_object('ok', false, 'raison', 'trop_d_essais');
  end if;

  update public.codes_email set essais = essais + 1 where email = v_email;

  -- ⚠️ La comparaison passe par bcrypt : elle est constante en temps, et le
  --    code n'existe nulle part en clair.
  if extensions.crypt(v_code, v_ligne.code_hash) <> v_ligne.code_hash then
    return jsonb_build_object('ok', false, 'raison', 'code_invalide');
  end if;

  update public.codes_email set consomme_le = now() where email = v_email;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.verifier_code_email(text, text) from public, anon, authenticated;
grant execute on function public.verifier_code_email(text, text) to service_role;

-- ─── L'adresse est-elle vérifiée ? ─────────────────────────────────────────
--
-- Le seul fait sur lequel `handle_new_user` accepte de créer un compte sans
-- invitation. Quinze minutes : le temps de choisir un mot de passe, pas plus.
create or replace function public.email_verifie_recemment(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.codes_email c
     where c.email = lower(btrim(coalesce(p_email, '')))
       and c.consomme_le is not null
       and c.consomme_le > now() - interval '15 minutes');
$function$;

revoke all on function public.email_verifie_recemment(text) from public, anon, authenticated;
grant execute on function public.email_verifie_recemment(text) to service_role;

-- ─── La quatrième branche de handle_new_user ───────────────────────────────
--
-- ⚠️ REPRISE DE `pg_get_functiondef`, PAS DU DÉPÔT. C'est la fonction qui
-- conditionne TOUTE création de compte : la réécrire de mémoire, ou depuis un
-- fichier de migration ancien, ressusciterait une version périmée. Seule la
-- branche `email_verifie_recemment` est ajoutée ; les quatre autres et le
-- refus final sont inchangés, à l'octet près.
--
-- ⚠️ L'ORDRE DES BRANCHES COMPTE. Elle vient APRÈS les invitations : quelqu'un
-- qui a une invitation en attente ET qui a vérifié son adresse doit recevoir
-- son invitation, pas un compte vide. Et AVANT le refus final, qui reste le
-- comportement par défaut.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email   text := lower(trim(new.email));
  v_first   text; v_last text; v_name text;
  v_sup     public.supervisor_requests%rowtype;
  v_team    public.team_invitations%rowtype;
  v_company uuid;
  v_session_count int;
  r record;
begin
  v_first := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  v_last  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'),  ''), '');

  select * into v_sup from public.supervisor_requests
   where lower(email) = v_email and status = 'approved' order by created_at desc limit 1;
  select count(*) into v_session_count from public.session_invitations si where si.email = v_email;
  select * into v_team from public.team_invitations where email = v_email limit 1;

  if v_sup.id is not null then
    v_first := coalesce(nullif(v_first, ''), v_sup.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_sup.last_name);
    v_name  := public.compose_full_name(v_first, v_last,
                 nullif(trim(new.raw_user_meta_data->>'full_name'), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'supervisor', v_sup.company_id);
    insert into public.store_supervisors (store_id, user_id)
      values (v_sup.store_id, new.id) on conflict do nothing;
    update public.supervisor_requests set status = 'active', user_id = new.id where id = v_sup.id;

  elsif v_team.id is not null and v_team.role in ('supervisor', 'company_admin') then
    v_first := coalesce(nullif(v_first, ''), v_team.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_team.last_name);
    v_name  := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(v_team.full_name, ''), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id, is_company_admin)
      values (new.id, v_name, v_first, v_last, 'supervisor', v_team.company_id,
              v_team.role = 'company_admin');
    if array_length(v_team.store_ids, 1) is not null then
      insert into public.store_supervisors (store_id, user_id)
        select unnest(v_team.store_ids), new.id on conflict do nothing;
    end if;
    delete from public.team_invitations where id = v_team.id;

  elsif v_session_count > 0 then
    select company_id into v_company from public.session_invitations
      where email = v_email order by created_at limit 1;
    v_name := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      (select nullif(full_name, '') from public.session_invitations
        where email = v_email order by created_at limit 1), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'employee', v_company);
    for r in select * from public.session_invitations where email = v_email loop
      insert into public.session_members (session_id, user_id, role)
        values (r.session_id, new.id, r.role)
        on conflict (session_id, user_id) do update set role = excluded.role;
      insert into public.store_team (store_id, user_id)
        select s.store_id, new.id from public.inventory_sessions s where s.id = r.session_id
        on conflict do nothing;
    end loop;
    delete from public.session_invitations where email = v_email;
    delete from public.team_invitations where email = v_email;

  elsif v_team.id is not null then
    v_first := coalesce(nullif(v_first, ''), v_team.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_team.last_name);
    v_name  := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(v_team.full_name, ''), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'employee', v_team.company_id);
    if array_length(v_team.store_ids, 1) is not null then
      insert into public.store_team (store_id, user_id)
        select unnest(v_team.store_ids), new.id on conflict do nothing;
    else
      insert into public.store_team (store_id, user_id)
        select ss.store_id, new.id from public.store_supervisors ss
        where ss.user_id = v_team.created_by on conflict do nothing;
    end if;
    delete from public.team_invitations where id = v_team.id;

  elsif public.email_verifie_recemment(v_email) then
    -- ⚠️ LE PROSPECT — la branche qui rouvre l'auto-inscription (5 septembre
    -- 2026). Elle n'accepte QU'UN FAIT : une adresse dont le code à six
    -- chiffres a été consommé il y a moins de quinze minutes. Pas un paramètre,
    -- pas une métadonnée du client — `raw_user_meta_data` est écrit par
    -- l'appelant, il ne prouve rien.
    --
    -- ⚠️ ET ELLE NE DONNE RIEN. `company_id` nul, rôle `employee` — le
    -- moins-disant des deux. Toutes les policies se cloisonnent par
    -- l'entreprise, par le magasin ou par la session : sans entreprise, elles
    -- rendent `null = null`, donc faux. Le compte existe et ne voit rien.
    --
    -- ⚠️ ELLE NE TOUCHE NI `profiles_pin_privileged` NI LA POLICY D'INSERT
    -- fermée par VR-008 : le prospect ne peut pas s'écrire une entreprise, et
    -- c'est le paiement — en clé de service — qui le promeut.
    v_name := public.compose_full_name(v_first, v_last,
                coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), ''));
    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'employee', null);

  else
    if not exists (select 1 from public.profiles) then
      insert into public.profiles (id, full_name, first_name, last_name, role)
        values (new.id, public.compose_full_name(v_first, v_last,
                  coalesce(new.raw_user_meta_data->>'full_name', '')), v_first, v_last, 'supervisor');
    else
      raise exception 'Aucune invitation ni demande validée pour cet e-mail. Déposez une demande sur le site, ou demandez à votre superviseur de vous ajouter.';
    end if;
  end if;
  return new;
end;
$function$;
