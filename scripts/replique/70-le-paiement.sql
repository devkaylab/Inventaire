-- ⚠️ LE CHEMIN DU PAIEMENT, DE BOUT EN BOUT (7 octobre 2026).
--
-- Ce que Julien a dicté : « je suis facturé au bout de 7 jours automatiquement
-- sur mon mode de paiement déjà renseigné avant l'inventaire. Paiement que
-- Quantinvo a vérifié comme valide. »
--
-- Chaque ligne ci-dessous est une phrase de cette promesse, jouée.
--
-- ⚠️ **CE QUI EST PROUVÉ ICI N'INCLUT PAS STRIPE.** Les identifiants
-- `cus_…`, `seti_…`, `pm_…`, `in_…` sont des chaînes inventées : aucune clé
-- Stripe n'est disponible hors du projet, et ce banc-ci n'en a pas besoin. Ce
-- qu'il prouve, c'est que la BASE se comporte comme annoncé quand Stripe
-- répond — l'ordre des états, l'ouverture de la fenêtre, l'idempotence, les
-- refus. Ce que Stripe répond vraiment reste à éprouver avec une clé de test.
--
-- ⚠️ Et il ne touche pas au coffre : `declencher_le_prelevement` lit
-- `vault.decrypted_secrets`, que la réplique n'a pas. Ce cas se mesure sur le
-- projet d'essai, où le coffre existe et est vide.
\set QUIET on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.dire(p text, p_sql text) returns text
language plpgsql as $$
declare n text;
begin execute p_sql into n; return rpad(p, 56) || ' : ' || coalesce(n, 'null');
exception when others then return rpad(p, 56) || ' : REFUSÉ (' || substr(sqlerrm, 1, 45) || ')'; end $$;

create or replace function pg_temp.mission() returns uuid language sql as $$
  select id from public.missions where client_nom = 'Maison Loyer' limit 1 $$;
create or replace function pg_temp.magasin() returns uuid language sql as $$
  select store_id from public.missions where client_nom = 'Maison Loyer' limit 1 $$;

begin;
  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-0000000000e1'::uuid, 'patron@maison-loyer.fr'),
    ('00000000-0000-0000-0000-0000000000e2'::uuid, 'etranger@ailleurs.fr');
  insert into public.profiles (id, role, company_id, first_name) values
    ('00000000-0000-0000-0000-0000000000e1'::uuid, 'employee', null, 'Awa'),
    ('00000000-0000-0000-0000-0000000000e2'::uuid, 'employee', null, 'Zoé');

  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

  select pg_temp.dire('── 1. Elle réserve ──', $q$select ''$q$);
  select pg_temp.dire('RÉSERVATION — le prix retenu',
    $q$select public.reserver_ma_mission(jsonb_build_object(
        'entreprise', 'Maison Loyer', 'magasin', 'Loyer Nation',
        'adresse', '12 avenue de la Nation', 'code_postal', '75011', 'ville', 'Paris',
        'secteur', 'textile', 'articles_min', 10000, 'articles_max', 20000,
        'code_barres', 'tous', 'surface_vente', '350', 'formule', 'logiciel_seul',
        'debut', (now() + interval '5 days')::text,
        'engagement', true, 'cgv_version', public.version_conditions())) ->> 'prix_cents'$q$);
  select pg_temp.dire('— son état', $q$select etat from public.missions where id = pg_temp.mission()$q$);

  -- ⚠️ LA PROMESSE CENTRALE : SANS CARTE, AUCUN APPAREIL. Si cette ligne
  -- affichait autre chose que « NON », la location serait servie avant d'être
  -- payable, et tout le reste de ce fichier ne servirait à rien.
  select pg_temp.dire('AVANT LA CARTE — la fenêtre d''accès est-elle ouverte ?',
    $q$select case when acces_expirent_le is null then 'NON' else 'OUI — DÉFAUT' end
       from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('AVANT LA CARTE — appareils ouverts par la location',
    $q$select public.plafond_mission_en_cours(pg_temp.magasin())::text$q$);

  select pg_temp.dire('── 2. On va chercher sa carte ──', $q$select ''$q$);
  select pg_temp.dire('LE CLIENT — ce qu''il faut pour l''empreinte',
    $q$select public.mon_empreinte_a_prendre(pg_temp.mission()) ->> 'prix_cents'$q$);
  select pg_temp.dire('— et son adresse de courriel',
    $q$select public.mon_empreinte_a_prendre(pg_temp.mission()) ->> 'email'$q$);
  select pg_temp.dire('— ce qu''elle NE rend PAS (coût, marge)',
    $q$select case when public.mon_empreinte_a_prendre(pg_temp.mission()) ? 'cout_cents'
            or public.mon_empreinte_a_prendre(pg_temp.mission()) ? 'calcul'
          then 'FUITE' else 'rien' end$q$);

  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true);
  select pg_temp.dire('UN ÉTRANGER — demande l''empreinte de cette mission',
    $q$select public.mon_empreinte_a_prendre(pg_temp.mission()) ->> 'code'$q$);
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

  select pg_temp.dire('LA SESSION STRIPE — retenue avant la saisie',
    $q$select public.retenir_la_session_d_empreinte(
        pg_temp.mission(), 'cs_TEST_empreinte', 'cus_TEST') ->> 'success'$q$);

  select pg_temp.dire('── 3. La carte est vérifiée ──', $q$select ''$q$);
  select pg_temp.dire('L''EMPREINTE — l''état d''arrivée',
    $q$select public.enregistrer_l_empreinte(
        pg_temp.mission(), 'cus_TEST', 'seti_TEST', 'pm_TEST') ->> 'etat'$q$);
  select pg_temp.dire('— la fenêtre vendue',
    $q$select case when acces_expirent_le is null then 'NON'
          else (acces_expirent_le::date - acces_ouverts_le::date)::text || ' jours' end
       from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— elle commence à la date choisie, pas aujourd''hui',
    $q$select case when acces_ouverts_le::date = (now() + interval '5 days')::date
          then 'oui' else 'NON — ' || acces_ouverts_le::date::text end
       from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— « vérifié comme valide » est daté',
    $q$select case when moyen_de_paiement_verifie_le is null then 'NON' else 'oui' end
       from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('APPAREILS — avant la date choisie',
    $q$select public.plafond_appareils_effectif(pg_temp.magasin())::text
       || ' (dont ' || public.plafond_mission_en_cours(pg_temp.magasin())::text || ' de location)'$q$);

  -- ⚠️ REJEU : le client recharge la page de retour de Stripe. Rien ne doit
  -- bouger — ni l'état, ni la fenêtre.
  select pg_temp.dire('REJEU — deuxième enregistrement de la même empreinte',
    $q$select (public.enregistrer_l_empreinte(
        pg_temp.mission(), 'cus_TEST', 'seti_TEST', 'pm_TEST') ->> 'deja')$q$);
  select pg_temp.dire('— la fenêtre a-t-elle bougé ?',
    $q$select case when (acces_expirent_le::date - acces_ouverts_le::date) = 7
          then 'non, toujours 7 jours' else 'OUI — DÉFAUT' end
       from public.missions where id = pg_temp.mission()$q$);

  update public.missions set acces_ouverts_le = now() where id = pg_temp.mission();
  select pg_temp.dire('APPAREILS — la date venue, pendant la semaine',
    $q$select public.plafond_appareils_effectif(pg_temp.magasin())::text
       || ' (dont ' || public.plafond_mission_en_cours(pg_temp.magasin())::text || ' de location)'$q$);

  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
  select pg_temp.dire('LE CLIENT — crée son inventaire et compte',
    $q$select public.create_session('Inventaire d''octobre', pg_temp.magasin(), '246810', true) ->> 'success'$q$);
  reset role;

  select pg_temp.dire('── 4. Rien à prélever pendant la semaine ──', $q$select ''$q$);
  select pg_temp.dire('LA LISTE À PRÉLEVER — fenêtre encore ouverte',
    $q$select jsonb_array_length(public.missions_a_prelever())::text$q$);

  select pg_temp.dire('── 5. Le septième jour ──', $q$select ''$q$);
  update public.missions
     set acces_ouverts_le = now() - interval '8 days',
         acces_expirent_le = now() - interval '1 day'
   where id = pg_temp.mission();
  update public.inventory_sessions set created_at = now() - interval '7 days'
   where store_id = pg_temp.magasin();

  select pg_temp.dire('LA CLÔTURE — inventaires fermés, missions terminées',
    $q$select public.cloturer_les_inventaires_hors_fenetre()::text$q$);
  select pg_temp.dire('— l''état de la mission',
    $q$select etat from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— la date de fin est-elle posée par la machine ?',
    $q$select case when terminee_le is null then 'NON' else 'oui' end
       from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— et l''inventaire du client',
    $q$select status from public.inventory_sessions where store_id = pg_temp.magasin() limit 1$q$);
  select pg_temp.dire('APPAREILS — la semaine passée',
    $q$select public.plafond_appareils_effectif(pg_temp.magasin())::text
       || ' (dont ' || public.plafond_mission_en_cours(pg_temp.magasin())::text || ' de location)'$q$);

  select pg_temp.dire('LA LISTE À PRÉLEVER — combien',
    $q$select jsonb_array_length(public.missions_a_prelever())::text$q$);
  select pg_temp.dire('— le montant qu''elle porte',
    $q$select (public.missions_a_prelever() -> 0) ->> 'prix_cents'$q$);
  select pg_temp.dire('— la carte qu''elle porte',
    $q$select ((public.missions_a_prelever() -> 0) ->> 'customer_id') || ' / '
       || ((public.missions_a_prelever() -> 0) ->> 'payment_method_id')$q$);
  select pg_temp.dire('— et jamais ce qu''elle nous coûte',
    $q$select case when (public.missions_a_prelever() -> 0) ? 'cout_cents'
          then 'FUITE' else 'rien' end$q$);

  select pg_temp.dire('── 6. Le prélèvement ──', $q$select ''$q$);
  -- ⚠️ **DEUX INSTRUCTIONS, PAS UNE.** Premier jet : `select (select etat …)
  -- from (select public.enregistrer_le_prelevement(…))`. Il affichait
  -- « terminee » alors que la fonction venait de poser « payee » — les deux
  -- sous-requêtes lisent le MÊME instantané, celui d'avant l'instruction. Un
  -- chiffre invraisemblable est d'abord un défaut de mesure : ici la mesure
  -- était fausse, le code était juste.
  do $$ begin perform public.prelevement_tente(pg_temp.mission()); end $$;
  select pg_temp.dire('TENTATIVE — marquée avant l''appel',
    $q$select case when prelevement_tente_le is null then 'NON' else 'oui' end
       from public.missions where id = pg_temp.mission()$q$);
  do $$ begin perform public.enregistrer_le_prelevement(pg_temp.mission(),
      'in_TEST', 'pi_TEST', 'https://invoice.stripe.test/x', 'QI-0001'); end $$;
  select pg_temp.dire('PAYÉ — l''état d''arrivée',
    $q$select etat from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— la facture est rangée',
    $q$select facture_numero || ' · ' || facture_url
       from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('REJEU — second prélèvement de la même mission',
    $q$select public.enregistrer_le_prelevement(pg_temp.mission(),
        'in_AUTRE', 'pi_AUTRE') ->> 'deja'$q$);
  select pg_temp.dire('— la facture retenue est-elle toujours la première ?',
    $q$select stripe_invoice_id from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('LA LISTE À PRÉLEVER — après paiement',
    $q$select jsonb_array_length(public.missions_a_prelever())::text$q$);

  select pg_temp.dire('── 7. Ce que le client lit, et ce qu''il ne lit pas ──', $q$select ''$q$);
  set local role authenticated;
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
  select pg_temp.dire('LE CLIENT — voit sa facture',
    $q$select facture_numero from public.missions where client_nom = 'Maison Loyer'$q$);
  select pg_temp.dire('— voit la date du prélèvement',
    $q$select case when preleve_le is null then 'NON' else 'oui' end
       from public.missions where client_nom = 'Maison Loyer'$q$);
  select pg_temp.dire('— ne voit PAS l''identifiant Stripe du client',
    $q$select coalesce((select stripe_customer_id from public.missions
        where client_nom = 'Maison Loyer'), 'null')$q$);
  select pg_temp.dire('— ne voit PAS le moyen de paiement',
    $q$select coalesce((select stripe_payment_method_id from public.missions
        where client_nom = 'Maison Loyer'), 'null')$q$);
  select pg_temp.dire('— n''appelle PAS la liste à prélever',
    $q$select public.missions_a_prelever()::text$q$);
  select pg_temp.dire('— n''enregistre PAS un prélèvement',
    $q$select public.enregistrer_le_prelevement(pg_temp.mission(), 'in_PIRATE', null)::text$q$);
  select pg_temp.dire('— n''enregistre PAS une empreinte',
    $q$select public.enregistrer_l_empreinte(pg_temp.mission(), 'cus_X', 's', 'pm_X')::text$q$);
  reset role;
rollback;

-- ─── Le refus de carte, et l'annulation ────────────────────────────────────
begin;
  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-0000000000e3'::uuid, 'patron@maison-loyer.fr');
  insert into public.profiles (id, role, company_id, first_name) values
    ('00000000-0000-0000-0000-0000000000e3'::uuid, 'employee', null, 'Awa');
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', true);
  -- ⚠️ `do … perform` et pas `select` : un `select` ici écrirait son JSON dans
  -- la sortie du banc, au milieu des lignes qu'on lit.
  do $$ begin perform public.reserver_ma_mission(jsonb_build_object(
      'entreprise', 'Maison Loyer', 'magasin', 'Loyer Nation',
      'adresse', '12 avenue de la Nation', 'code_postal', '75011', 'ville', 'Paris',
      'secteur', 'textile', 'articles_min', 10000, 'articles_max', 20000,
      'code_barres', 'tous', 'surface_vente', '350', 'formule', 'logiciel_seul',
      'debut', (now() + interval '5 days')::text,
      'engagement', true, 'cgv_version', public.version_conditions())); end $$;
  do $$ begin perform public.enregistrer_l_empreinte(
      pg_temp.mission(), 'cus_T2', 'seti_T2', 'pm_T2'); end $$;
  update public.missions set acces_expirent_le = now() - interval '1 day'
   where id = pg_temp.mission();
  do $$ begin perform public.cloturer_les_inventaires_hors_fenetre(); end $$;

  select pg_temp.dire('── 8. La carte est refusée trois fois ──', $q$select ''$q$);
  select pg_temp.dire('PREMIER REFUS',
    $q$select public.echouer_le_prelevement(pg_temp.mission(),
        'Votre carte a été refusée.') ->> 'abandonne'$q$);
  select pg_temp.dire('— reste-t-elle dans la liste tout de suite ?',
    $q$select jsonb_array_length(public.missions_a_prelever())::text
       || ' (six heures de repos)'$q$);
  select pg_temp.dire('DEUXIÈME REFUS',
    $q$select public.echouer_le_prelevement(pg_temp.mission(), 'refus') ->> 'abandonne'$q$);
  select pg_temp.dire('TROISIÈME REFUS — on abandonne ?',
    $q$select public.echouer_le_prelevement(pg_temp.mission(), 'refus') ->> 'abandonne'$q$);
  select pg_temp.dire('— l''état d''arrivée',
    $q$select etat from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— le motif est-il consigné ?',
    $q$select prelevement_echec from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— un règlement obtenu autrement se consigne-t-il ?',
    $q$select case when public.transition_mission_permise('litige','payee','logiciel_seul')
          then 'oui (litige → payee)' else 'NON' end$q$);
  update public.missions set prelevement_tente_le = now() - interval '1 day'
   where id = pg_temp.mission();
  select pg_temp.dire('— et elle ne revient plus dans la liste',
    $q$select jsonb_array_length(public.missions_a_prelever())::text$q$);

  select pg_temp.dire('— une mission en litige est-elle à prélever ?',
    $q$select jsonb_array_length(public.missions_a_prelever())::text$q$);
rollback;

-- ─── Une annulation ne se facture jamais ───────────────────────────────────
--
-- ⚠️ ANNULER EST GRATUIT DEPUIS LE 4 OCTOBRE. Le danger n'est pas le montant
-- des frais — il est nul — mais qu'une mission annulée ressorte quand même
-- dans la liste à prélever parce qu'elle a une carte vérifiée et une fenêtre
-- passée. Le filtre est l'ÉTAT, et c'est ce qu'on mesure.
begin;
  insert into auth.users (id, email) values
    ('00000000-0000-0000-0000-0000000000e4'::uuid, 'patron@maison-loyer.fr');
  insert into public.profiles (id, role, company_id, first_name) values
    ('00000000-0000-0000-0000-0000000000e4'::uuid, 'employee', null, 'Awa');
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e4', true);
  do $$ begin perform public.reserver_ma_mission(jsonb_build_object(
      'entreprise', 'Maison Loyer', 'magasin', 'Loyer Nation',
      'adresse', '12 avenue de la Nation', 'code_postal', '75011', 'ville', 'Paris',
      'secteur', 'textile', 'articles_min', 10000, 'articles_max', 20000,
      'code_barres', 'tous', 'surface_vente', '350', 'formule', 'logiciel_seul',
      'debut', (now() + interval '5 days')::text,
      'engagement', true, 'cgv_version', public.version_conditions())); end $$;
  do $$ begin perform public.enregistrer_l_empreinte(
      pg_temp.mission(), 'cus_T3', 'seti_T3', 'pm_T3'); end $$;

  select pg_temp.dire('── 9. Une annulation ne se facture jamais ──', $q$select ''$q$);
  select pg_temp.dire('LES FRAIS D''ANNULATION',
    $q$select (public.frais_annulation(pg_temp.mission()) ->> 'a_payer_cents')$q$);
  update public.missions set etat = 'annulee' where id = pg_temp.mission();
  select pg_temp.dire('— la fenêtre s''est-elle refermée ?',
    $q$select case when acces_expirent_le <= now() then 'oui' else 'NON' end
       from public.missions where id = pg_temp.mission()$q$);
  select pg_temp.dire('— sa carte est-elle toujours vérifiée ?',
    $q$select case when moyen_de_paiement_verifie_le is null then 'non' else 'oui' end
       from public.missions where id = pg_temp.mission()$q$);
  do $$ begin perform public.cloturer_les_inventaires_hors_fenetre(); end $$;
  select pg_temp.dire('— et malgré tout, est-elle à prélever ?',
    $q$select jsonb_array_length(public.missions_a_prelever())::text$q$);
  select pg_temp.dire('— la clôture l''a-t-elle fait passer en « terminee » ?',
    $q$select etat from public.missions where id = pg_temp.mission()$q$);
rollback;
