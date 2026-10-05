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

  -- ⚠️⚠️ **RÉÉCRIT LE 5 OCTOBRE 2026, ET IL ÉCHOUAIT.** La seconde moitié
  -- de ce scénario déroulait la formule ÉQUIPE : `confirmee → en_constitution`,
  -- une équipe constituée, un inventoriste qui vient compter. Deux choses l'ont
  -- périmée : la machine d'état connaît les formules depuis le 4 octobre et
  -- REFUSE cette transition pour `logiciel_seul` (la réservation ci-dessus en
  -- est une), et le côté inventoriste est rangé à part depuis le 4 octobre.
  -- Le scénario mourait donc à la ligne 62, et les quinze contrôles suivants
  -- n'étaient PLUS MESURÉS — sans que rien ne le dise, puisque `verifier.sh`
  -- ne s'arrête pas sur un scénario.
  --
  -- Ce qu'On-Demand est aujourd'hui : une FENÊTRE et un MONTANT. Le client fait
  -- le reste lui-même, comme n'importe quel utilisateur de Quantinvo OS.
  update public.missions set etat = 'paiement_autorise' where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'confirmee' where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'prete' where client_nom = 'Boutique Indépendante';
  update public.missions set etat = 'en_cours' where client_nom = 'Boutique Indépendante';

  select pg_temp.dire('La fenêtre d''accès s''est-elle ouverte ?',
    $q$select case when acces_expirent_le is null then 'NON'
          else (acces_expirent_le::date - acces_ouverts_le::date)::text || ' jours' end
       from public.missions where client_nom = 'Boutique Indépendante'$q$);
  -- ⚠️ ZÉRO APPAREIL AVANT LA DATE CHOISIE, et c'est la règle du 5 octobre :
  -- `acces_ouverts_le = greatest(now(), debut_prevu)`. La réservation est pour
  -- dans cinq jours, donc la fenêtre est ouverte mais pas encore commencée.
  select pg_temp.dire('Le plafond d''appareils AVANT la date choisie',
    $q$select public.plafond_appareils_effectif(
        (select store_id from public.missions where client_nom = 'Boutique Indépendante'))::text
       || ' (dont ' || public.plafond_mission_en_cours(
        (select store_id from public.missions where client_nom = 'Boutique Indépendante'))::text
       || ' de location)'$q$);

  update public.missions set acces_ouverts_le = now()
   where client_nom = 'Boutique Indépendante';
  select pg_temp.dire('— et PENDANT la fenêtre, la date venue',
    $q$select public.plafond_appareils_effectif(
        (select store_id from public.missions where client_nom = 'Boutique Indépendante'))::text
       || ' (dont ' || public.plafond_mission_en_cours(
        (select store_id from public.missions where client_nom = 'Boutique Indépendante'))::text
       || ' de location)'$q$);

  -- ⚠️ LE CLIENT CRÉE SON INVENTAIRE LUI-MÊME. La réservation n'en crée plus
  -- (5 octobre 2026) : `creer_la_session_de_mission` n'est plus appelée par
  -- personne, et ce scénario l'appelait encore.
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
  select pg_temp.dire('CLIENT NON ABONNÉ — crée son inventaire',
    $q$select public.create_session('Mon inventaire',
        (select store_id from public.missions where client_nom = 'Boutique Indépendante'),
        '246810', true) ->> 'success'$q$);
  select pg_temp.dire('— et un SECOND sur le même magasin',
    $q$select coalesce(public.create_session('Un second',
        (select store_id from public.missions where client_nom = 'Boutique Indépendante'),
        '135791', true) ->> 'success', 'null')$q$);
  reset role;

  update public.inventory_sessions set status = 'closed', closed_at = now()
   where company_id = (select id from public.companies where name = 'Boutique Indépendante');

  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
  select pg_temp.dire('— puis un autre, APRÈS avoir clôturé',
    $q$select public.create_session('Après clôture',
        (select store_id from public.missions where client_nom = 'Boutique Indépendante'),
        '112233', true) ->> 'success'$q$);
  select pg_temp.dire('CLIENT NON ABONNÉ — compte dans son inventaire',
    $q$with x as (insert into public.counts (session_id, sku, pass_number, counted_by)
        select s.id, 'SKU-SA', 1, '00000000-0000-0000-0000-0000000000f1'::uuid
          from public.inventory_sessions s where s.status <> 'closed' returning 1)
       select count(*)::text from x$q$);
  select pg_temp.dire('CLIENT NON ABONNÉ — voit ses inventaires',
    'select count(*)::text from public.inventory_sessions');
  select pg_temp.dire('CLIENT NON ABONNÉ — voit sa réservation et son prix',
    $q$select (select prix_cents::text from public.missions where client_nom = 'Boutique Indépendante')$q$);
  select pg_temp.dire('CLIENT NON ABONNÉ — ne voit PAS ce qu''elle nous coûte',
    $q$select coalesce((select cout_cents::text from public.missions
        where client_nom = 'Boutique Indépendante'), 'null')$q$);
  reset role;
rollback;
