\set QUIET on
\pset tuples_only on
\pset format unaligned
begin;
  insert into public.provider_profiles (user_id, etat, niveau, secteurs, paiements_ouverts, stripe_account_id)
    values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'actif', 'confirme', array['textile'], true, 'acct_x');
  insert into public.missions (id, company_id, store_id, reserve_par, client_nom, magasin_nom, adresse,
    code_postal, secteur, articles_min, articles_max, articles_retenus, debut_prevu,
    duree_prevue_minutes, arrivee_prevue, inventoristes, responsable, prix_cents, cout_cents,
    calcul, inventory_session_id, etat)
  values ('00000000-0000-0000-0000-00000000aa01'::uuid, '00000000-0000-0000-0000-00000000c001'::uuid,
    '00000000-0000-0000-0000-00000000c501'::uuid, '00000000-0000-0000-0000-0000000000a2'::uuid,
    'Maison Oberlin', 'Paris Rivoli', '12 rue de Rivoli', '75004', 'textile', 10000, 20000, 20000,
    now() + interval '3 days', 270, now() + interval '3 days' - interval '15 min', 6, true, 94900, 71200,
    '{"equipe_cents":66600,"frais_cents":4600,"remuneration_inventoriste_cents":9000}'::jsonb,
    '00000000-0000-0000-0000-00000000e001'::uuid, 'confirmee');
  insert into public.mission_assignments (mission_id, user_id, role, etat, remuneration_cents)
    values ('00000000-0000-0000-0000-00000000aa01'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid,
            'inventoriste', 'acceptee', 9000);

  set local role authenticated;
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
  select 'AVANT L''OUVERTURE — voit l''inventaire : ' || count(*)::text from public.inventory_sessions;
  select 'AVANT L''OUVERTURE — voit les zones     : ' || count(*)::text from public.zones;
  select 'AVANT L''OUVERTURE — place d''appareil   : ' ||
    (public.prendre_place_appareil('00000000-0000-0000-0000-00000000e001'::uuid,'t')->>'code');
  reset role;

  update public.missions set etat='en_constitution' where id='00000000-0000-0000-0000-00000000aa01'::uuid;
  update public.missions set etat='equipe_complete' where id='00000000-0000-0000-0000-00000000aa01'::uuid;
  update public.missions set etat='prete'           where id='00000000-0000-0000-0000-00000000aa01'::uuid;
  update public.missions set etat='en_cours'        where id='00000000-0000-0000-0000-00000000aa01'::uuid;

  set local role authenticated;
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
  select 'MISSION EN COURS — voit l''inventaire   : ' || count(*)::text from public.inventory_sessions;
  select 'MISSION EN COURS — voit les zones      : ' || count(*)::text from public.zones;
  insert into public.counts (session_id, sku, pass_number, counted_by)
    values ('00000000-0000-0000-0000-00000000e001'::uuid,'SKU-OD',1,'00000000-0000-0000-0000-0000000000c1'::uuid);
  select 'MISSION EN COURS — a compté            : ' || count(*)::text from public.counts where sku='SKU-OD';
  select 'MISSION EN COURS — place d''appareil    : ' ||
    (public.prendre_place_appareil('00000000-0000-0000-0000-00000000e001'::uuid,'tel-inv')->>'accorde');
  select 'MISSION EN COURS — plafond du magasin  : ' ||
    (public.prendre_place_appareil('00000000-0000-0000-0000-00000000e001'::uuid,'tel-inv')->>'plafond')
    || ' (20 d''abonnement + 7 de mission)';
  reset role;

  update public.missions set etat='controle_qualite' where id='00000000-0000-0000-0000-00000000aa01'::uuid;
  update public.missions set etat='terminee'         where id='00000000-0000-0000-0000-00000000aa01'::uuid;
  set local role authenticated;
  select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
  select 'APRÈS CLÔTURE — voit l''inventaire      : ' || count(*)::text from public.inventory_sessions;
  select 'APRÈS CLÔTURE — voit les zones         : ' || count(*)::text from public.zones;
  select 'APRÈS CLÔTURE — place d''appareil       : ' ||
    (public.prendre_place_appareil('00000000-0000-0000-0000-00000000e001'::uuid,'t2')->>'code');
  reset role;
rollback;
