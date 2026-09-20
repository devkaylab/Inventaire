-- ⚠️ LE CAS QUE JULIEN A SOULEVÉ LE 20 SEPTEMBRE 2026 : « un prestataire n'ira
-- pas forcément compter chez un client avec un compte Quantinvo OS, et un
-- client demandant un inventaire n'aura pas forcément un abonnement ».
--
-- Ici, tout est neuf : une entreprise créée par la réservation elle-même,
-- aucun abonnement, aucun magasin déclaré, aucun superviseur, aucun compteur.
-- Juste quelqu'un qui réserve, et une équipe qui vient.
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.dire(p text, p_sql text) returns text
language plpgsql as $$
declare n text;
begin execute p_sql into n; return rpad(p, 56) || ' : ' || coalesce(n, 'null');
exception when others then return rpad(p, 56) || ' : REFUSÉ (' || substr(sqlerrm, 1, 45) || ')'; end $$;

begin;
  -- Le visiteur crée son compte et réserve. Aucune entreprise n'existe avant.
  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-0000000000f1'::uuid, 'client@sans-abo.fr'),
    ('00000000-0000-0000-0000-0000000000f2'::uuid, 'inventoriste2@x.fr');
  insert into public.profiles (id, role, company_id, first_name) values
    ('00000000-0000-0000-0000-0000000000f1'::uuid, 'employee', null, 'Nadia'),
    ('00000000-0000-0000-0000-0000000000f2'::uuid, 'employee', null, 'Ivan');
  insert into public.provider_profiles (user_id, etat, niveau, secteurs, paiements_ouverts, stripe_account_id)
    values ('00000000-0000-0000-0000-0000000000f2'::uuid, 'actif', 'confirme', array['textile'], true, 'acct_y');

  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);

  select pg_temp.dire('RÉSERVATION — sans compte ni entreprise préexistants',
    $q$select public.reserver_ma_mission(jsonb_build_object(
        'entreprise', 'Boutique Indépendante', 'magasin', 'Rue de Rennes',
        'adresse', '88 rue de Rennes', 'code_postal', '75006', 'ville', 'Paris',
        'secteur', 'textile', 'articles_min', 10000, 'articles_max', 20000,
        'code_barres', 'tous', 'surface_vente', '400',
        'debut', (now() + interval '5 days')::text,
        'engagement', true, 'cgv_version', public.version_conditions())) ->> 'prix_cents'$q$);

  select pg_temp.dire('L''entreprise créée a-t-elle un abonnement ?',
    $q$select 'plan=' || c.plan || ' abonnement=' || coalesce(c.stripe_subscription_id, 'aucun')
       from public.companies c where c.name = 'Boutique Indépendante'$q$);
  select pg_temp.dire('A-t-elle le droit Quantinvo OS ?',
    $q$select coalesce((select etat from public.entitlements e
        join public.companies c on c.id = e.company_id
        where c.name = 'Boutique Indépendante' and e.produit = 'os'), 'AUCUN — non abonnée')$q$);
  select pg_temp.dire('A-t-elle le droit On-Demand ?',
    $q$select (select etat from public.entitlements e join public.companies c on c.id = e.company_id
        where c.name = 'Boutique Indépendante' and e.produit = 'on_demand')$q$);
  select pg_temp.dire('Le magasin a-t-il des appareils déclarés ?',
    $q$select coalesce((select devices::text from public.stores where name = 'Rue de Rennes'), 'aucun')$q$);

  -- Quantinvo constitue l'équipe et lance la mission.
  update public.missions set etat = 'paiement_autorise' where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'confirmee' where client_nom = 'Boutique Indépendante';
  select pg_temp.dire('L''inventaire se crée-t-il, sans abonnement ?',
    $q$select public.creer_la_session_de_mission(
        (select id from public.missions where client_nom = 'Boutique Indépendante')) ->> 'success'$q$);
  insert into public.mission_assignments (mission_id, user_id, role, etat, remuneration_cents)
    select id, '00000000-0000-0000-0000-0000000000f2'::uuid, 'inventoriste', 'acceptee', 9000
      from public.missions where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'en_constitution' where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'equipe_complete' where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'prete' where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'en_cours' where client_nom = 'Boutique Indépendante';

  -- L'inventoriste, chez un client qui n'a aucun abonnement.
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true);
  select pg_temp.dire('INVENTORISTE — voit l''inventaire du non-abonné',
    'select count(*)::text from public.inventory_sessions');
  select pg_temp.dire('INVENTORISTE — prend une place d''appareil',
    $q$select (public.prendre_place_appareil(
        (select inventory_session_id from public.missions where client_nom = 'Boutique Indépendante'),
        'tel-a') ->> 'accorde')$q$);
  select pg_temp.dire('INVENTORISTE — compte',
    $q$with x as (insert into public.counts (session_id, sku, pass_number, counted_by)
        select inventory_session_id, 'SKU-SA', 1, '00000000-0000-0000-0000-0000000000f2'::uuid
          from public.missions where client_nom = 'Boutique Indépendante' returning 1)
       select count(*)::text from x$q$);
  reset role;

  -- Le client, qui n'a jamais rien acheté à Quantinvo OS.
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
  select pg_temp.dire('CLIENT NON ABONNÉ — voit son inventaire',
    'select count(*)::text from public.inventory_sessions');
  select pg_temp.dire('CLIENT NON ABONNÉ — voit les comptages (son rapport)',
    'select count(*)::text from public.counts');
  select pg_temp.dire('CLIENT NON ABONNÉ — voit sa mission et son prix',
    $q$select (select prix_cents::text from public.missions where client_nom = 'Boutique Indépendante')$q$);
  select pg_temp.dire('CLIENT NON ABONNÉ — ne voit PAS ce qu''elle nous coûte',
    $q$select coalesce((select cout_cents::text from public.missions
        where client_nom = 'Boutique Indépendante'), 'null')$q$);
  reset role;
rollback;
