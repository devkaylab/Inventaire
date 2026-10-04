-- ⚠️ OUVRIR UN ACCÈS SANS STRIPE, ET MARQUER SES PROPRES ESSAIS
-- (4 octobre 2026, demande de Julien avant le pilote du Groupe Bon Marché).
--
-- DEUX BESOINS, UN SEUL MÉCANISME. Julien les a posés ensemble, et c'est la
-- bonne lecture : « je veux pouvoir créer des entreprises et magasins de test
-- avec le choix des licences » et « ce flux peut aussi servir si le client
-- paie autrement que par Stripe ». Le geste est le même — poser une licence à
-- la main. Ce qui change entre un essai et un virement, c'est le motif écrit
-- au journal et une case cochée, pas le mécanisme.
--
-- ⚠️ **CE QUE LA CONSOLE NE SAVAIT PAS FAIRE, ET POURQUOI C'EST GÊNANT.**
-- `admin_add_store` accepte `p_devices` depuis toujours ; l'écran ne lui
-- passait que le nom. Tout magasin créé en console naissait donc en
-- « appareils non déclarés ». Ça ne coûtait rien tant que `plafond_appareils`
-- rendait `null` pour « ne rien refuser » — mais depuis que la base porte
-- `plafond_appareils_effectif` (migration On-Demand du 20 septembre 2026),
-- un magasin sans appareils déclarés est PLAFONNÉ À DEUX. Un pilote à trois
-- téléphones se fait refuser le troisième, et rien à l'écran ne l'annonce.
--
-- ⚠️ **ON NE TOUCHE À AUCUN CHAMP STRIPE, ET C'EST VOULU.** Un client qui
-- règle par virement n'a pas d'abonnement : lui en inventer un ferait mentir
-- `sync_subscription_status` et `deposer_changement_offre`. Conséquence à
-- connaître plutôt qu'à corriger : si ce client passe plus tard par le
-- libre-service, il ouvrira un abonnement Stripe au lieu d'en modifier un.
-- C'est le comportement juste pour quelqu'un qui ne payait pas par Stripe.
--
-- ⚠️ **LES ESSAIS SORTENT DES CHIFFRES, PAS DES LISTES.** Une entreprise
-- invisible qu'on a oublié de nettoyer est pire qu'une ligne étiquetée : les
-- écrans de pilotage l'écartent de leurs totaux, les listes la montrent avec
-- son drapeau.

-- ─── 1. Les deux drapeaux, posés par Julien lui-même ───────────────────────
--
-- Sur l'entreprise ET sur le magasin : un magasin d'essai peut vivre dans une
-- entreprise réelle (c'est le cas d'un pilote chez un vrai client), et une
-- entreprise d'essai n'a que des magasins d'essai.
alter table public.companies add column if not exists est_test boolean not null default false;
alter table public.stores    add column if not exists est_test boolean not null default false;

comment on column public.companies.est_test is
  'Entreprise d''essai, marquée à la main depuis la console : écartée des chiffres, pas des listes.';
comment on column public.stores.est_test is
  'Magasin d''essai, marqué à la main : écarté des chiffres. Un magasin dont l''entreprise est un essai l''est aussi.';

-- ─── 2. La règle, calculée en un seul endroit ──────────────────────────────
--
-- ⚠️ ELLE SE CALCULE, ELLE NE SE RECOPIE PAS. Écrite à la main dans chacune
-- des fonctions de pilotage, elle aurait divergé à la première qui oublie le
-- drapeau de l'entreprise — et une entreprise d'essai serait ressortie dans
-- le chiffre d'affaires d'un seul écran, celui qu'on ne regarde pas.
--
-- Rendent `false` sur un identifiant nul ou inconnu : un inventaire sans
-- magasin n'est pas un essai pour autant, c'est son entreprise qui tranche.
create or replace function public.magasin_est_un_essai(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(bool_or(s.est_test or c.est_test), false)
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
$function$;

create or replace function public.entreprise_est_un_essai(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(bool_or(c.est_test), false)
    from public.companies c
   where c.id = p_company_id;
$function$;

-- Règle interne, pas une porte d'API : personne ne l'appelle depuis un
-- navigateur. Les fonctions de pilotage qui s'en servent sont `security
-- definer` et s'exécutent donc avec les droits du propriétaire.
revoke all on function public.magasin_est_un_essai(uuid) from public, anon, authenticated;
revoke all on function public.entreprise_est_un_essai(uuid) from public, anon, authenticated;
grant execute on function public.magasin_est_un_essai(uuid) to service_role;
grant execute on function public.entreprise_est_un_essai(uuid) to service_role;

-- ─── 3. Poser la licence d'un magasin à la main ────────────────────────────
--
-- ⚠️ `p_devices` NUL EST UNE VALEUR, PAS UN OUBLI : il remet le magasin en
-- « appareils non déclarés », ce qu'il faut pouvoir faire après un pilote.
-- ⚠️ LE MOTIF N'EST PAS DÉCORATIF. C'est lui qui, dans six mois, dira si ce
-- magasin à vingt appareils est un virement encaissé ou un essai qu'on a
-- oublié de refermer. Il part au journal d'administration avec l'avant/après.
create or replace function public.admin_poser_licence_magasin(
  p_store_id uuid,
  p_devices integer,
  p_annual_price_cents integer default null,
  p_motif text default null)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_nom text; v_entreprise text;
  v_devices_avant integer; v_prix_avant integer;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if p_devices is not null and p_devices <= 0 then
    return json_build_object('success', false, 'error', 'Le nombre d''appareils doit être positif.');
  end if;
  if p_annual_price_cents is not null and p_annual_price_cents < 0 then
    return json_build_object('success', false, 'error', 'Le prix annuel ne peut pas être négatif.');
  end if;

  select s.name, c.name, s.devices, s.annual_price_cents
    into v_nom, v_entreprise, v_devices_avant, v_prix_avant
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  if v_nom is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable');
  end if;

  -- ⚠️ `stripe_subscription_id`, `stripe_item_*` ET `stripe_customer_id` NE
  -- SONT PAS TOUCHÉS. Voir l'en-tête : il n'y a pas d'abonnement derrière un
  -- virement, et lui en inventer un ferait mentir la synchronisation.
  update public.stores
     set devices = p_devices,
         annual_price_cents = coalesce(p_annual_price_cents, annual_price_cents)
   where id = p_store_id;

  perform public.log_admin_action(
    'licence_posee_a_la_main', 'magasin', p_store_id::text, v_nom,
    json_build_object(
      'entreprise', v_entreprise,
      'appareils_avant', v_devices_avant, 'appareils_apres', p_devices,
      'annuel_avant_cents', v_prix_avant,
      'annuel_apres_cents', coalesce(p_annual_price_cents, v_prix_avant),
      'motif', v_motif)::jsonb);

  return json_build_object('success', true, 'devices', p_devices);
end;
$function$;

-- ─── 4. Marquer, et démarquer ──────────────────────────────────────────────
create or replace function public.admin_marquer_entreprise_essai(
  p_company_id uuid, p_essai boolean)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare v_nom text; v_avant boolean;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select c.name, c.est_test into v_nom, v_avant
    from public.companies c where c.id = p_company_id;
  if v_nom is null then
    return json_build_object('success', false, 'error', 'Entreprise introuvable');
  end if;

  update public.companies set est_test = coalesce(p_essai, false) where id = p_company_id;

  perform public.log_admin_action(
    case when coalesce(p_essai, false) then 'entreprise_marquee_essai' else 'entreprise_demarquee_essai' end,
    'entreprise', p_company_id::text, v_nom,
    json_build_object('avant', v_avant, 'apres', coalesce(p_essai, false))::jsonb);

  return json_build_object('success', true, 'est_test', coalesce(p_essai, false));
end;
$function$;

create or replace function public.admin_marquer_magasin_essai(
  p_store_id uuid, p_essai boolean)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare v_nom text; v_entreprise text; v_avant boolean;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select s.name, c.name, s.est_test into v_nom, v_entreprise, v_avant
    from public.stores s join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  if v_nom is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable');
  end if;

  update public.stores set est_test = coalesce(p_essai, false) where id = p_store_id;

  perform public.log_admin_action(
    case when coalesce(p_essai, false) then 'magasin_marque_essai' else 'magasin_demarque_essai' end,
    'magasin', p_store_id::text, v_nom,
    json_build_object('entreprise', v_entreprise, 'avant', v_avant,
                      'apres', coalesce(p_essai, false))::jsonb);

  return json_build_object('success', true, 'est_test', coalesce(p_essai, false));
end;
$function$;

-- ─── 5. Les écrans de pilotage écartent les essais ─────────────────────────
--
-- ⚠️ TOUT CE QUI SE COMPTE EST FILTRÉ, pas seulement l'argent. Un inventaire
-- d'essai gonflerait « inventaires du mois » ; un magasin d'essai sans
-- inventaire depuis soixante jours apparaîtrait dans les magasins dormants et
-- ferait chercher un problème qui n'existe pas. `pending_deletions` reste
-- entier : une demande de suppression de compte est une obligation légale,
-- elle ne dépend pas de l'entreprise qui la porte.
create or replace function public.admin_business_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_debut_mois timestamptz := date_trunc('month', now());
  v_defaut_cents constant integer := 370000;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'companies', (select count(*) from public.companies where not est_test),
    'companies_new_month', (select count(*) from public.companies
                             where created_at >= v_debut_mois and not est_test),
    'stores', (select count(*) from public.stores s
                where not public.magasin_est_un_essai(s.id)),
    'arr_cents', (select coalesce(sum(coalesce(s.annual_price_cents, v_defaut_cents)), 0)
                    from public.stores s where not public.magasin_est_un_essai(s.id)),
    'priced_stores', (select count(*) from public.stores s
                       where s.annual_price_cents is not null
                         and not public.magasin_est_un_essai(s.id)),
    'default_price_cents', v_defaut_cents,
    'active_stores_month', (
      select count(distinct s.store_id) from public.inventory_sessions s
       where s.created_at >= v_debut_mois and s.store_id is not null
         and not public.magasin_est_un_essai(s.store_id)),
    'sessions_month', (select count(*) from public.inventory_sessions s
                        where s.created_at >= v_debut_mois
                          and not public.magasin_est_un_essai(s.store_id)
                          and not public.entreprise_est_un_essai(s.company_id)),
    'counts_month', (select count(*) from public.counts c
                      join public.inventory_sessions s on s.id = c.session_id
                     where c.created_at >= v_debut_mois
                       and not public.magasin_est_un_essai(s.store_id)
                       and not public.entreprise_est_un_essai(s.company_id)),
    'active_people_month', (select count(distinct c.counted_by)
                              from public.counts c
                              join public.inventory_sessions s on s.id = c.session_id
                             where c.created_at >= v_debut_mois and c.counted_by is not null
                               and not public.magasin_est_un_essai(s.store_id)
                               and not public.entreprise_est_un_essai(s.company_id)),
    'companies_without_store', (
      select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::json)
        from public.companies c
       where not c.est_test
         and not exists (select 1 from public.stores s where s.company_id = c.id)),
    'companies_without_admin', (
      select count(*) from public.companies c
       where not c.est_test
         and not exists (select 1 from public.profiles p
                          where p.company_id = c.id and p.is_company_admin)),
    'idle_stores', (
      select coalesce(json_agg(json_build_object(
               'id', s.id, 'name', s.name, 'company_id', s.company_id,
               'company_name', c.name,
               'days', case when d.last is null then null
                            else floor(extract(epoch from now() - d.last) / 86400)::int end
             ) order by d.last nulls first), '[]'::json)
        from public.stores s
        join public.companies c on c.id = s.company_id
        cross join lateral (
          select max(x.created_at) as last from public.inventory_sessions x where x.store_id = s.id
        ) d
       where (d.last is null or d.last < now() - interval '60 days')
         and not s.est_test and not c.est_test),
    'pending_deletions', (
      select count(*) from public.account_deletion_requests where status = 'pending')
  );
end;
$function$;

create or replace function public.admin_revenu_par_entreprise()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_defaut_cents constant integer := 370000;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_cents', (select coalesce(sum(coalesce(s.annual_price_cents, v_defaut_cents)), 0)
                      from public.stores s where not public.magasin_est_un_essai(s.id)),
    'entreprises', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'nom', e.name, 'revenu_cents', e.revenu
             ) order by e.revenu desc)
      from (
        select c.id, c.name,
               coalesce(sum(coalesce(s.annual_price_cents, v_defaut_cents))
                        filter (where s.id is not null and not s.est_test), 0) as revenu
        from public.companies c
        left join public.stores s on s.company_id = c.id
       where not c.est_test
        group by c.id, c.name
      ) e
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_usage_overview(p_company_id uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $function$
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
     where (p_company_id is null or s.company_id = p_company_id)
       and s.created_at > now() - interval '12 months'
       and not public.magasin_est_un_essai(s.store_id)
       and not public.entreprise_est_un_essai(s.company_id)
     group by s.id, s.store_id, s.created_at
  ),
  par_magasin as (
    select store_id,
           count(*)        as inventaires,
           max(pieces)     as plancher,
           max(compteurs)  as compteurs,
           max(created_at) as dernier,
           sum(lignes)     as lignes
      from sessions
     where store_id is not null
     group by store_id
  )
  select json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object(
               'id',                 st.id,
               'name',               st.name,
               'company_id',         st.company_id,
               'company_name',       co.name,
               'units',              st.units,
               'sqm',                st.sqm,
               'annual_price_cents', st.annual_price_cents,
               'inventaires',        coalesce(pm.inventaires, 0),
               'plancher',           pm.plancher,
               'compteurs',          coalesce(pm.compteurs, 0),
               'lignes',             coalesce(pm.lignes, 0),
               'dernier',            pm.dernier
             ) order by co.name, st.name), '[]'::json)
        from public.stores st
        join public.companies co on co.id = st.company_id
        left join par_magasin pm on pm.store_id = st.id
       where (p_company_id is null or st.company_id = p_company_id)
         and not st.est_test and not co.est_test
    ),
    'inventaires', (select count(*) from sessions),
    'compteurs_distincts', (
      select count(distinct c.counted_by)
        from public.counts c
        join public.inventory_sessions s on s.id = c.session_id
       where (p_company_id is null or s.company_id = p_company_id)
         and c.created_at > now() - interval '12 months'
         and not public.magasin_est_un_essai(s.store_id)
         and not public.entreprise_est_un_essai(s.company_id)
    ),
    'entreprises', (
      select count(*) from public.companies co
       where (p_company_id is null or co.id = p_company_id)
         and not co.est_test
    )
  ) into v;

  return v;
end;
$function$;

-- ─── 6. Les listes PORTENT le drapeau, elles n'écartent rien ───────────────
--
-- ⚠️ LA SIGNATURE CHANGE, DONC L'ANCIENNE SE RETIRE D'ABORD : `create or
-- replace` refuse de modifier le type de retour d'une fonction qui rend une
-- table. C'est la règle du projet, pas une entorse.
drop function if exists public.admin_list_companies_overview();
create function public.admin_list_companies_overview()
returns table(
  id uuid, name text, created_at timestamp with time zone,
  store_count integer, supervisor_count integer, counter_count integer,
  company_admin_count integer, pending_invitations integer,
  last_session_at timestamp with time zone, est_test boolean)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select c.id, c.name, c.created_at,
         (select count(*)::int from public.stores s where s.company_id = c.id),
         (select count(*)::int from public.profiles p
           where p.company_id = c.id and p.role = 'supervisor'),
         (select count(*)::int from public.profiles p
           where p.company_id = c.id and p.role = 'employee'),
         (select count(*)::int from public.profiles p
           where p.company_id = c.id and p.is_company_admin),
         (select count(*)::int from public.team_invitations i where i.company_id = c.id),
         (select max(s.created_at) from public.inventory_sessions s where s.company_id = c.id),
         c.est_test
  from public.companies c
  order by c.est_test, c.name;
end;
$function$;

-- La fiche d'une entreprise porte le drapeau, et les appareils de chaque
-- magasin — sans eux, l'écran ne peut ni afficher la licence ni la modifier.
create or replace function public.admin_company_detail(p_company_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public, auth
as $function$
declare v json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select json_build_object(
    'company', (select json_build_object('id', c.id, 'name', c.name,
                         'join_code', c.join_code, 'created_at', c.created_at,
                         'est_test', c.est_test)
                  from public.companies c where c.id = p_company_id),
    'stores', (select coalesce(json_agg(json_build_object(
                        'id', s.id, 'name', s.name, 'join_code', s.join_code,
                        'annual_price_cents', s.annual_price_cents,
                        'devices', s.devices,
                        'est_test', s.est_test,
                        'supervisor_ids', (select coalesce(json_agg(ss.user_id), '[]'::json)
                                             from public.store_supervisors ss
                                            where ss.store_id = s.id)
                      ) order by s.name), '[]'::json)
                 from public.stores s where s.company_id = p_company_id),
    'members', (select coalesce(json_agg(json_build_object(
                        'id', p.id, 'full_name', p.full_name, 'role', p.role,
                        'is_company_admin', p.is_company_admin,
                        'email', (select u.email::text from auth.users u where u.id = p.id),
                        'is_active', (select u.last_sign_in_at is not null
                                        from auth.users u where u.id = p.id)
                      ) order by p.is_company_admin desc, p.role desc, p.full_name), '[]'::json)
                 from public.profiles p where p.company_id = p_company_id),
    'invitations', (select coalesce(json_agg(json_build_object(
                        'id', i.id, 'email', i.email, 'role', i.role,
                        'first_name', i.first_name, 'last_name', i.last_name,
                        'created_at', i.created_at
                      ) order by i.created_at desc), '[]'::json)
                 from public.team_invitations i where i.company_id = p_company_id)
  ) into v;

  if v->'company' is null or v->>'company' is null then
    raise exception 'Entreprise introuvable.';
  end if;
  return v;
end;
$function$;

-- ─── 7. Les droits ─────────────────────────────────────────────────────────
--
-- ⚠️ `create or replace` REND `EXECUTE` À `PUBLIC` : sans ces lignes, chaque
-- fonction retouchée ci-dessus rouvrirait sa porte à `anon`. Elles vérifient
-- toutes `is_admin()` en première ligne, mais une porte fermée vaut mieux
-- qu'une porte gardée.
revoke all on function public.admin_poser_licence_magasin(uuid, integer, integer, text) from public, anon;
revoke all on function public.admin_marquer_entreprise_essai(uuid, boolean) from public, anon;
revoke all on function public.admin_marquer_magasin_essai(uuid, boolean) from public, anon;
revoke all on function public.admin_business_overview() from public, anon;
revoke all on function public.admin_revenu_par_entreprise() from public, anon;
revoke all on function public.admin_usage_overview(uuid) from public, anon;
revoke all on function public.admin_list_companies_overview() from public, anon;
revoke all on function public.admin_company_detail(uuid) from public, anon;

grant execute on function public.admin_poser_licence_magasin(uuid, integer, integer, text) to authenticated, service_role;
grant execute on function public.admin_marquer_entreprise_essai(uuid, boolean) to authenticated, service_role;
grant execute on function public.admin_marquer_magasin_essai(uuid, boolean) to authenticated, service_role;
grant execute on function public.admin_business_overview() to authenticated, service_role;
grant execute on function public.admin_revenu_par_entreprise() to authenticated, service_role;
grant execute on function public.admin_usage_overview(uuid) to authenticated, service_role;
grant execute on function public.admin_list_companies_overview() to authenticated, service_role;
grant execute on function public.admin_company_detail(uuid) to authenticated, service_role;
