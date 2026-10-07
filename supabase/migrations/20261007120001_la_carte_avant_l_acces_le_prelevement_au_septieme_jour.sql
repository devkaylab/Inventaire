-- ⚠️⚠️ LA CARTE AVANT L'ACCÈS, LE PRÉLÈVEMENT AU SEPTIÈME JOUR (7 octobre 2026).
--
-- Julien, en récitant le parcours : « je suis facturé au bout de 7 jours
-- automatiquement sur mon mode de paiement déjà renseigné avant l'inventaire.
-- Paiement que Quantinvo a vérifié comme valide. »
--
-- Deux moments, et l'ordre compte :
--
--   1. **AVANT.** Le client réserve, et on prend l'empreinte de sa carte. Rien
--      n'est débité ; Stripe vérifie que la carte existe, qu'elle est
--      autorisée, et nous rend un moyen de paiement réutilisable. C'est ce
--      « vérifié comme valide » qui ouvre la fenêtre d'accès — et rien
--      d'autre. Une réservation sans carte vérifiée n'ouvre AUCUN appareil.
--   2. **AU SEPTIÈME JOUR.** La fenêtre se referme, l'inventaire se clôture,
--      la mission se termine, et le montant est prélevé hors présence du
--      client.
--
-- ⚠️ **CE QUI OUVRAIT L'ACCÈS JUSQU'ICI ÉTAIT UN GESTE DE LA CONSOLE.**
-- `missions_accorder_les_acces` ouvre sur `etat = 'en_cours'`, et c'est un
-- administrateur qui posait cet état à la main (fiche 113 : « `prix_calcule →
-- paiement_autorise` n'a aucun chemin automatique »). Le client qui réservait
-- à 23 h attendait qu'on s'en occupe. Ici, c'est sa carte qui ouvre.
--
-- ⚠️⚠️ **ET IL Y A UNE MACHINE D'ÉTATS, QUI REFUSE LES RACCOURCIS.** Premier
-- jet de cette migration : `prix_calcule → prete` en un seul `update`. Mesuré
-- sur la réplique, `transition_mission_permise('prix_calcule','prete',
-- 'logiciel_seul')` rend **faux** — le déclencheur `missions_verifier_transition`
-- aurait levé une exception au premier client. On marche donc les trois pas que
-- la machine décrit, et ils se lisent juste : la carte est autorisée
-- (`paiement_autorise`), la réservation est confirmée (`confirmee`), la semaine
-- est prête (`prete`). C'est aussi la machine qui pose `confirmee_le` — on ne
-- l'écrit pas à la main.
--
-- ⚠️ **L'ÉTAT QUI PORTE LA SEMAINE EST `prete`, PAS `en_cours`.** Les deux
-- ouvrent les appareils (`plafond_mission_en_cours` lit les trois états
-- `prete`/`en_cours`/`controle_qualite`), mais `en_cours` sur une mission qui
-- commence dans huit jours se lit faux dans la console, et le déclencheur y
-- poserait `commencee_le` — une date fausse. `prete` dit ce qui est vrai : tout
-- est en place, la semaine est vendue. `en_cours` restera à la formule équipe,
-- où quelqu'un se déplace vraiment.
--
-- ⚠️ **ET L'ACCÈS NE S'OUVRE PAS POUR AUTANT TOUT DE SUITE.**
-- `ouvrir_les_acces_mission` pose `acces_ouverts_le = greatest(now(),
-- debut_prevu)`, et `plafond_mission_en_cours` exige `now() >=
-- acces_ouverts_le` : prendre la carte huit jours avant n'offre pas huit jours
-- d'appareils. La semaine commence à la date choisie, comme la page le promet.
--
-- ⚠️ **AUCUN PRICE STRIPE N'EST CRÉÉ, ET LE MONTANT NE VIENT PAS DU
-- NAVIGATEUR.** La règle du projet — « les Prices ne sont JAMAIS créés à la
-- volée » — protège les trois offres publiques, dont les montants sont fixes et
-- posés en secrets. Une location n'a pas de montant fixe : il dépend du volume,
-- du secteur, du créneau. Ce que la règle interdit vraiment, c'est un prix que
-- personne n'a relu ; ici il est calculé par `prix_mission` à partir de
-- `reglages_prix`, dont la version 3 a été validée par Julien le 5 octobre, et
-- il est **déjà figé dans `missions.prix_cents`** depuis la réservation. La
-- facture recopie cette colonne. C'est la même exception que le devis mensuel,
-- pour la même raison.
--
-- ⚠️ **PAS DE TVA, ET CE N'EST PAS UN OUBLI.** Devkaylab est en franchise en
-- base (article 293 B du CGI) : `TVA_APPLICABLE = false` dans `offres.ts` et
-- dans `_shared/devis.ts`. La facture porte la mention, pas le taux. Le jour où
-- la franchise tombe, c'est `STRIPE_TAX_RATE` qui s'ajoute — la fonction edge
-- porte déjà le paramètre.
--
-- ⚠️ **RIEN DE TOUT CECI NE TOUCHE QUANTINVO OS.** Aucune table d'OS, aucune
-- fonction d'OS, aucun déclencheur d'OS. `missions` et sa machine d'états sont
-- à On-Demand, et le seul pont existant — `plafond_mission_en_cours` — n'est
-- pas repris : il lit déjà `prete`. Le retrait est écrit dans
-- `scripts/replique/90-retirer.sql`.

-- ─── 1. Ce que la mission retient du paiement ──────────────────────────────
--
-- ⚠️ DOUZE COLONNES, ET AUCUNE N'EST LISIBLE PAR LE CLIENT PAR DÉFAUT.
-- `authenticated` n'a PAS `select` sur la table (il a été révoqué le
-- 5 octobre, fiche 116) : les droits sont posés colonne par colonne, donc une
-- colonne neuve est fermée tant qu'on ne l'ouvre pas. C'est le bon défaut, et
-- c'est pour ça qu'il a été choisi — un identifiant Stripe n'a rien à faire
-- dans un navigateur.
alter table public.missions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_setup_intent_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists moyen_de_paiement_verifie_le timestamptz,
  add column if not exists stripe_invoice_id text,
  add column if not exists facture_numero text,
  add column if not exists facture_url text,
  add column if not exists preleve_le timestamptz,
  add column if not exists prelevement_tente_le timestamptz,
  add column if not exists prelevement_echecs integer not null default 0,
  add column if not exists prelevement_echec text;

comment on column public.missions.moyen_de_paiement_verifie_le is
  'Quand Stripe a confirmé que la carte du client est utilisable. C''est CETTE '
  'date qui autorise l''ouverture de la fenêtre d''accès : sans elle, une '
  'réservation n''ouvre aucun appareil.';

comment on column public.missions.prelevement_echecs is
  'Le nombre de tentatives de prélèvement refusées. À trois, la mission passe '
  'en « litige » et plus rien n''est tenté — un refus de carte est souvent '
  'passager, trois ne le sont plus.';

-- ⚠️ UNE FACTURE PAR MISSION, GARANTIE PAR LA BASE. L'idempotence côté Stripe
-- (clé d'idempotence) protège un rejeu immédiat ; elle ne protège pas deux
-- ticks de `cron` séparés d'une heure. Cet index-ci le fait, et il le fait
-- même si la fonction edge est réécrite de travers.
create unique index if not exists missions_stripe_invoice_id_unique
  on public.missions (stripe_invoice_id) where stripe_invoice_id is not null;

create unique index if not exists missions_stripe_setup_intent_unique
  on public.missions (stripe_setup_intent_id) where stripe_setup_intent_id is not null;

-- Ce que le client a le droit de lire : que sa carte est prise, que c'est
-- payé, et où est sa facture. Pas un identifiant Stripe, pas un motif de refus
-- brut de Stripe (il est en anglais et parle de notre compte).
grant select (moyen_de_paiement_verifie_le, facture_numero, facture_url, preleve_le)
  on public.missions to authenticated;

-- ─── 2. La semaine d'une location se termine toute seule ───────────────────
--
-- ⚠️ DEUX TRANSITIONS AJOUTÉES À LA BRANCHE `logiciel_seul`, ET LA BRANCHE
-- ÉQUIPE N'EST PAS TOUCHÉE. Une location n'a pas de contrôle qualité : il n'y
-- a personne à contrôler. Au septième jour la fenêtre se referme, et c'est
-- tout ce qui arrive — `prete → terminee` et `en_cours → terminee` décrivent
-- exactement ça.
--
-- Sans elles, la clôture automatique devrait marcher
-- `prete → en_cours → controle_qualite → terminee`, et le déclencheur poserait
-- `commencee_le = now()` **le jour de la clôture** : une date d'ouverture de
-- chantier écrite une semaine trop tard, dans une pièce comptable.
--
-- ⚠️ C'est le même défaut que le 4 octobre, trouvé de la même façon — en
-- jouant la transition, pas en relisant. `transition_mission_permise(
-- 'prete','terminee','logiciel_seul')` rendait faux.
--
-- ⚠️ La définition ci-dessous est celle qui tourne, à deux entrées près.
-- Reprise de `pg_get_functiondef`, pas recopiée de mémoire.
create or replace function public.transition_mission_permise(
  p_de text, p_vers text, p_formule text default 'equipe_quantinvo')
returns boolean
language sql
immutable
set search_path = public
as $function$
  select case when coalesce(p_formule, 'equipe_quantinvo') = 'logiciel_seul' then
    p_de = p_vers or p_vers = any (case p_de
      when 'brouillon'             then array['prix_calcule','annulee']
      when 'prix_calcule'          then array['brouillon','paiement_autorise','annulee','echouee']
      when 'paiement_autorise'     then array['confirmee','annulee','echouee']
      -- Pas d'équipe à constituer : confirmée, elle est prête.
      when 'confirmee'             then array['prete','annulee']
      -- ⚠️ `terminee` : la semaine louée s'achève d'elle-même, sans que
      -- personne passe « en cours » ni ne contrôle quoi que ce soit.
      when 'prete'                 then array['en_cours','terminee','annulee','echouee']
      when 'en_cours'              then array['controle_qualite','terminee','litige','echouee']
      when 'controle_qualite'      then array['terminee','en_cours','litige']
      -- Personne à payer : terminée, elle est payée.
      when 'terminee'              then array['payee','litige']
      when 'payee'                 then array['litige']
      when 'annulee'               then array['remboursee']
      when 'echouee'               then array['remboursee']
      when 'litige'                then array['terminee','payee','remboursee']
      else array[]::text[]
    end)
  else
    p_de = p_vers or p_vers = any (case p_de
      when 'brouillon'             then array['prix_calcule','annulee']
      when 'prix_calcule'          then array['brouillon','paiement_autorise','annulee','echouee']
      when 'paiement_autorise'     then array['confirmee','annulee','echouee']
      when 'confirmee'             then array['en_constitution','annulee']
      when 'en_constitution'       then array['equipe_complete','annulee','echouee']
      when 'equipe_complete'       then array['prete','en_constitution','annulee','echouee']
      when 'prete'                 then array['en_cours','en_constitution','annulee','echouee']
      when 'en_cours'              then array['controle_qualite','litige','echouee']
      when 'controle_qualite'      then array['terminee','en_cours','litige']
      when 'terminee'              then array['paiement_prestataires','litige']
      when 'paiement_prestataires' then array['payee','litige']
      when 'payee'                 then array['litige']
      when 'annulee'               then array['remboursee']
      when 'echouee'               then array['remboursee']
      when 'litige'                then array['terminee','payee','remboursee']
      else array[]::text[]
    end)
  end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.transition_mission_permise(text, text, text) from public, anon;
grant execute on function public.transition_mission_permise(text, text, text)
  to authenticated, service_role;

-- ─── 3. Ce qu'il faut pour aller chercher la carte ─────────────────────────
--
-- Appelée par la fonction edge `mission-empreinte`, AVEC LE JETON DU CLIENT :
-- c'est donc `auth.uid()` qui décide, pas un paramètre que l'appelant choisit.
-- La garde porte sur la ligne visée.
--
-- ⚠️ ELLE NE REND PAS `cout_cents` NI `calcul`. Une fonction `security
-- definer` contourne les droits de colonne ; celle-ci rend exactement ce que
-- Stripe doit savoir, et le reste n'en sort pas.
create or replace function public.mon_empreinte_a_prendre(p_mission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_m record;
  v_moi record;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  select * into v_m from public.missions where id = p_mission;
  if not found then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  select p.company_id, p.is_company_admin, u.email
    into v_moi
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = auth.uid();

  -- ⚠️ CELUI QUI A RÉSERVÉ, OU UN ADMINISTRATEUR DE SON ENTREPRISE. Pas « un
  -- membre de l'entreprise » : donner sa carte engage l'entreprise, et un
  -- compteur n'engage personne.
  if not (v_m.reserve_par = auth.uid()
          or (coalesce(v_moi.is_company_admin, false)
              and v_m.company_id is not null
              and v_m.company_id = v_moi.company_id)) then
    return jsonb_build_object('success', false, 'code', 'interdit');
  end if;

  if v_m.moyen_de_paiement_verifie_le is not null then
    return jsonb_build_object('success', false, 'code', 'deja_verifie',
      'etat', v_m.etat);
  end if;

  if v_m.etat not in ('brouillon', 'prix_calcule', 'paiement_autorise') then
    -- Annulée, échouée, déjà passée : on ne redemande pas de carte.
    return jsonb_build_object('success', false, 'code', 'etat', 'etat', v_m.etat);
  end if;

  if v_m.prix_cents <= 0 then
    return jsonb_build_object('success', false, 'code', 'montant');
  end if;

  return jsonb_build_object(
    'success', true,
    'mission_id', v_m.id,
    'reference', v_m.reference,
    'prix_cents', v_m.prix_cents,
    'client_nom', v_m.client_nom,
    'magasin_nom', v_m.magasin_nom,
    'debut_prevu', v_m.debut_prevu,
    -- ⚠️ LA FENÊTRE VENDUE SORT D'ICI, PAS DE TYPESCRIPT. La page de Stripe
    -- doit annoncer « 341 € le 19 octobre », et cette date vaut
    -- `debut_prevu + fenetre_jours`. Écrire « 7 » dans la fonction edge en
    -- ferait une sixième copie d'un réglage qui vit dans `reglages_prix` — et
    -- le jour où la fenêtre passe à dix jours, la page mentirait.
    'fenetre_jours', coalesce((select r.fenetre_jours from public.reglages_prix r
                                where r.version = coalesce(v_m.reglages_version,
                                      (select version from public.reglages_prix where en_vigueur))), 7),
    'appareils', v_m.appareils,
    'articles_retenus', v_m.articles_retenus,
    'email', v_moi.email,
    'customer_id', v_m.stripe_customer_id,
    'session_id', v_m.stripe_checkout_session_id);
end;
$function$;

revoke all on function public.mon_empreinte_a_prendre(uuid) from public, anon;
grant execute on function public.mon_empreinte_a_prendre(uuid) to authenticated, service_role;

-- ─── 4. La session Stripe ouverte se retient ───────────────────────────────
--
-- ⚠️ POURQUOI ON L'ÉCRIT AVANT DE SAVOIR SI LE CLIENT PAIERA : parce que c'est
-- le seul moyen de rattraper un navigateur fermé. Le client qui quitte la page
-- de Stripe après avoir saisi sa carte ne repasse jamais par notre adresse de
-- retour — et sans cet identifiant, personne ne saurait quelle session relire.
-- Le tick de `cron` la relit pour lui.
create or replace function public.retenir_la_session_d_empreinte(
  p_mission uuid, p_session text, p_customer text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.missions
     set stripe_checkout_session_id = p_session,
         stripe_customer_id = coalesce(p_customer, stripe_customer_id)
   where id = p_mission
     and etat in ('brouillon', 'prix_calcule', 'paiement_autorise')
     and moyen_de_paiement_verifie_le is null;
  if not found then
    return jsonb_build_object('success', false, 'code', 'etat');
  end if;
  return jsonb_build_object('success', true);
end;
$function$;

revoke all on function public.retenir_la_session_d_empreinte(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.retenir_la_session_d_empreinte(uuid, text, text) to service_role;

-- ─── 5. La carte est vérifiée : la fenêtre s'ouvre ─────────────────────────
--
-- ⚠️ C'EST LE CŒUR DE CETTE MIGRATION, ET IL EST IDEMPOTENT. Le client peut
-- recharger la page de retour, le tick de `cron` peut relire la même session
-- une heure plus tard : le second appel ne rouvre rien et ne rallonge rien.
-- `ouvrir_les_acces_mission` pose `acces_ouverts_le = coalesce(acces_ouverts_le,
-- …)`, donc la borne basse ne bouge plus une fois posée.
--
-- ⚠️ TROIS PAS, PARCE QUE LA MACHINE D'ÉTATS EN COMPTE TROIS. Les sauter
-- lèverait `check_violation` (voir l'en-tête). Chaque pas est vrai : autorisé,
-- confirmé, prêt.
--
-- ⚠️ ET LA FORMULE ÉQUIPE S'ARRÊTE À `confirmee`. Chez elle, il reste une
-- équipe à constituer avant d'être prête, et la fenêtre ne doit pas s'ouvrir
-- sur personne. L'exception est isolée ici, elle ne contamine pas la machine.
create or replace function public.enregistrer_l_empreinte(
  p_mission uuid,
  p_customer text,
  p_setup_intent text,
  p_payment_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_m record;
begin
  if coalesce(btrim(p_customer), '') = ''
     or coalesce(btrim(p_payment_method), '') = '' then
    return jsonb_build_object('success', false, 'code', 'incomplet');
  end if;

  select * into v_m from public.missions where id = p_mission for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  if v_m.moyen_de_paiement_verifie_le is not null then
    return jsonb_build_object('success', true, 'deja', true, 'etat', v_m.etat);
  end if;

  if v_m.etat not in ('brouillon', 'prix_calcule', 'paiement_autorise') then
    return jsonb_build_object('success', false, 'code', 'etat', 'etat', v_m.etat);
  end if;

  update public.missions
     set stripe_customer_id = p_customer,
         stripe_setup_intent_id = p_setup_intent,
         stripe_payment_method_id = p_payment_method,
         moyen_de_paiement_verifie_le = now()
   where id = p_mission;

  if v_m.etat = 'brouillon' then
    update public.missions set etat = 'prix_calcule' where id = p_mission;
  end if;
  if v_m.etat in ('brouillon', 'prix_calcule') then
    update public.missions set etat = 'paiement_autorise' where id = p_mission;
  end if;
  update public.missions set etat = 'confirmee' where id = p_mission;

  if coalesce(v_m.formule, 'equipe_quantinvo') = 'logiciel_seul' then
    update public.missions set etat = 'prete' where id = p_mission;

    -- ⚠️ APRÈS l'état, jamais avant : `ouvrir_les_acces_mission` relit la
    -- mission. Et c'est un appel EXPLICITE, pas le déclencheur
    -- `missions_acces` — celui-ci n'ouvre que sur `en_cours`, qui appartient à
    -- la formule équipe. L'exception reste à côté du chemin commun.
    perform public.ouvrir_les_acces_mission(p_mission);
  end if;

  select * into v_m from public.missions where id = p_mission;

  return jsonb_build_object(
    'success', true,
    'etat', v_m.etat,
    'acces_ouverts_le', v_m.acces_ouverts_le,
    'acces_expirent_le', v_m.acces_expirent_le);
end;
$function$;

revoke all on function public.enregistrer_l_empreinte(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.enregistrer_l_empreinte(uuid, text, text, text) to service_role;

-- ─── 6. La clôture termine aussi la mission ────────────────────────────────
--
-- ⚠️ QUATRE LIGNES AJOUTÉES À UNE FONCTION DU 5 OCTOBRE, ET LE RESTE EST
-- IDENTIQUE. Elle clôturait les inventaires de la fenêtre et laissait la
-- mission en `prete` pour toujours — le même « travail en suspens » qu'elle
-- avait été écrite pour éviter côté inventaires. Une location dont la semaine
-- est passée est `terminee` : c'est ce qui la fait sortir des écrans « à
-- venir » du client, et c'est l'état que le prélèvement attend.
--
-- ⚠️ ELLE NE TOUCHE PAS AUX MISSIONS DÉJÀ `payee`, `litige` OU `annulee` : la
-- liste des états est explicite, pas un « différent de terminee ».
--
-- ⚠️ `terminee_le` N'EST PAS ÉCRIT ICI : le déclencheur
-- `missions_verifier_transition` le pose lui-même au passage, et deux écritures
-- de la même date finissent par se contredire.
create or replace function public.cloturer_les_inventaires_hors_fenetre()
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout to '60s'
as $function$
declare
  v_n integer := 0;
  v_m integer := 0;
begin
  with finies as (
    select m.store_id, m.acces_ouverts_le, m.acces_expirent_le
      from public.missions m
     where m.acces_ouverts_le is not null
       and m.acces_expirent_le is not null
       and m.acces_expirent_le < now()
  )
  update public.inventory_sessions s
     set status = 'closed',
         closed_at = coalesce(s.closed_at, now())
    from finies f
   where s.store_id = f.store_id
     and s.status <> 'closed'
     and s.created_at >= f.acces_ouverts_le
     and s.created_at <= f.acces_expirent_le;

  get diagnostics v_n = row_count;

  update public.missions
     set etat = 'terminee'
   where acces_expirent_le is not null
     and acces_expirent_le < now()
     and etat in ('prete', 'en_cours', 'controle_qualite');

  get diagnostics v_m = row_count;

  return jsonb_build_object('success', true, 'clotures', v_n, 'missions_terminees', v_m);
end;
$function$;

revoke all on function public.cloturer_les_inventaires_hors_fenetre() from public, anon, authenticated;
grant execute on function public.cloturer_les_inventaires_hors_fenetre() to service_role;

-- ─── 7. Ce qu'il reste à prélever ──────────────────────────────────────────
--
-- ⚠️ LES CRITÈRES SE LISENT UN PAR UN, ET CHACUN EXCLUT UN FAUX PRÉLÈVEMENT :
--
--   · `terminee` SEULEMENT — la semaine est derrière nous, et la clôture (qui
--     tourne dix minutes plus tôt) l'a posé. `annulee` n'est pas là, et
--     annuler est GRATUIT depuis le 4 octobre : une annulation ne doit jamais
--     ressortir ici. `litige` n'y est pas non plus : on y a renoncé.
--   · fenêtre refermée — ceinture et bretelles avec l'état ;
--   · carte vérifiée — sans empreinte, rien à débiter (et sans empreinte la
--     fenêtre ne s'est pas ouverte, donc ce cas ne devrait pas exister) ;
--   · pas de facture — l'index unique le garantit déjà, ce filtre évite
--     simplement d'aller le demander à Stripe pour rien ;
--   · moins de trois refus, et six heures depuis le dernier — une carte
--     refusée à 3 h du matin n'est pas réapprovisionnée à 4 h.
--
-- ⚠️ `limit 50` : un tick ne doit pas pouvoir durer une heure. S'il en reste,
-- le tick suivant les prend.
create or replace function public.missions_a_prelever()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(s.x), '[]'::jsonb) from (
    select jsonb_build_object(
             'mission_id', m.id,
             'reference', m.reference,
             'customer_id', m.stripe_customer_id,
             'payment_method_id', m.stripe_payment_method_id,
             'prix_cents', m.prix_cents,
             'client_nom', m.client_nom,
             'magasin_nom', m.magasin_nom,
             'articles_retenus', m.articles_retenus,
             'appareils', m.appareils,
             'acces_ouverts_le', m.acces_ouverts_le,
             'acces_expirent_le', m.acces_expirent_le,
             'echecs', m.prelevement_echecs) as x
      from public.missions m
     where m.etat = 'terminee'
       and m.acces_expirent_le is not null
       and m.acces_expirent_le <= now()
       and m.moyen_de_paiement_verifie_le is not null
       and m.stripe_payment_method_id is not null
       and m.stripe_customer_id is not null
       and m.stripe_invoice_id is null
       and m.prix_cents > 0
       and m.prelevement_echecs < 3
       and (m.prelevement_tente_le is null
            or m.prelevement_tente_le < now() - interval '6 hours')
     order by m.acces_expirent_le
     limit 50) s;
$function$;

revoke all on function public.missions_a_prelever() from public, anon, authenticated;
grant execute on function public.missions_a_prelever() to service_role;

-- ⚠️ MARQUÉE AVANT L'APPEL À STRIPE, PAS APRÈS. Un appel qui part et dont la
-- réponse se perd (temps mort, fonction edge tuée) laisserait la mission
-- éligible au tick suivant — et Stripe aurait peut-être déjà débité. La date
-- de tentative se pose d'abord ; les six heures de repos font le reste.
create or replace function public.prelevement_tente(p_mission uuid)
returns void
language sql
security definer
set search_path = public
as $function$
  update public.missions set prelevement_tente_le = now() where id = p_mission;
$function$;

revoke all on function public.prelevement_tente(uuid) from public, anon, authenticated;
grant execute on function public.prelevement_tente(uuid) to service_role;

-- ─── 8. C'est payé ─────────────────────────────────────────────────────────
create or replace function public.enregistrer_le_prelevement(
  p_mission uuid,
  p_invoice text,
  p_payment_intent text,
  p_facture_url text default null,
  p_facture_numero text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ref text;
begin
  if coalesce(btrim(p_invoice), '') = '' then
    return jsonb_build_object('success', false, 'code', 'incomplet');
  end if;

  update public.missions
     set stripe_invoice_id = p_invoice,
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
         facture_url = coalesce(p_facture_url, facture_url),
         facture_numero = coalesce(p_facture_numero, facture_numero),
         preleve_le = now(),
         prelevement_echec = null,
         etat = 'payee'
   where id = p_mission
     and stripe_invoice_id is null
   returning reference into v_ref;

  if v_ref is null then
    -- Déjà facturée : l'index unique a fait son travail, et ce n'est pas une
    -- erreur — c'est un rejeu.
    return jsonb_build_object('success', true, 'deja', true);
  end if;

  return jsonb_build_object('success', true, 'reference', v_ref);
end;
$function$;

revoke all on function public.enregistrer_le_prelevement(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.enregistrer_le_prelevement(uuid, text, text, text, text) to service_role;

-- ─── 9. Ça a été refusé ────────────────────────────────────────────────────
--
-- ⚠️ TROIS REFUS, PUIS ON ARRÊTE ET ON LE DIT. Réessayer indéfiniment ferait
-- grossir les tentatives chez Stripe (qui les compte, et qui finit par
-- signaler le compte) sans jamais rien encaisser.
--
-- ⚠️ **ET L'ÉTAT D'ARRIVÉE EST `litige`, PAS `echouee`.** « Échouée » dirait
-- que la mission a échoué : or l'inventaire a eu lieu, le client a compté, il
-- a son rapport. Ce qui a échoué, c'est le paiement — et `litige` est
-- exactement ça, avec la sortie qu'il faut : `litige → payee` est permis, donc
-- un règlement obtenu autrement se consigne sans contorsion.
create or replace function public.echouer_le_prelevement(p_mission uuid, p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_n integer;
begin
  update public.missions
     set prelevement_echecs = prelevement_echecs + 1,
         prelevement_tente_le = now(),
         prelevement_echec = left(coalesce(p_motif, 'refus sans motif'), 500)
   where id = p_mission
   returning prelevement_echecs into v_n;

  if v_n is null then
    return jsonb_build_object('success', false, 'code', 'introuvable');
  end if;

  if v_n >= 3 then
    update public.missions set etat = 'litige'
     where id = p_mission and etat = 'terminee';
  end if;

  return jsonb_build_object('success', true, 'echecs', v_n, 'abandonne', v_n >= 3);
end;
$function$;

revoke all on function public.echouer_le_prelevement(uuid, text) from public, anon, authenticated;
grant execute on function public.echouer_le_prelevement(uuid, text) to service_role;

-- ─── 10. Le navigateur fermé se rattrape ───────────────────────────────────
--
-- ⚠️ **LE TROU QUE CETTE FONCTION BOUCHE.** Le client saisit sa carte sur la
-- page de Stripe, la validation réussit… et il ferme l'onglet avant de revenir
-- chez nous. Sa carte est vérifiée chez Stripe et NOUS NE LE SAVONS PAS : la
-- fenêtre ne s'ouvre pas, il a donné sa carte pour rien, et il n'a aucun moyen
-- de s'en apercevoir avant le jour de son inventaire.
--
-- Deux façons de le rattraper : écouter le webhook de Stripe, ou relire les
-- sessions en attente. **On relit**, et ce n'est pas par paresse : le webhook
-- `stripe-webhook` est partagé avec Quantinvo OS, et y brancher On-Demand
-- mettrait du code de ce chantier sur le chemin de paiement du produit qui
-- tourne. Relire coûte un appel par session en attente, une fois par heure.
--
-- ⚠️ `created_at > now() - 2 jours` : une session Checkout vit vingt-quatre
-- heures chez Stripe, donc au-delà il n'y a plus rien à relire. Garder la
-- requête bornée évite qu'elle traîne toutes les réservations abandonnées du
-- mois à chaque tick.
create or replace function public.empreintes_en_attente()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(s.x), '[]'::jsonb) from (
    select jsonb_build_object(
             'mission_id', m.id,
             'reference', m.reference,
             'session_id', m.stripe_checkout_session_id) as x
      from public.missions m
     where m.stripe_checkout_session_id is not null
       and m.moyen_de_paiement_verifie_le is null
       and m.etat in ('brouillon', 'prix_calcule', 'paiement_autorise')
       and m.created_at > now() - interval '2 days'
     order by m.created_at
     limit 50) s;
$function$;

revoke all on function public.empreintes_en_attente() from public, anon, authenticated;
grant execute on function public.empreintes_en_attente() to service_role;

-- ─── 11. Qui réveille le prélèvement ───────────────────────────────────────
--
-- ⚠️ **NI L'ADRESSE NI LA CLÉ NE SONT ÉCRITES ICI, ET C'EST VOULU.** Le motif
-- existant (`declencher_alerte`, 28 août) code l'adresse du projet de
-- PRODUCTION en dur. Cette migration-là vit sur la branche On-Demand et
-- s'applique sur le projet d'essai : une adresse en dur ferait poster le
-- projet d'essai sur la production au premier tick. Les deux valeurs viennent
-- du coffre, et **tant qu'elles sont absentes la tâche ne fait rien** — donc
-- appliquer cette migration quelque part ne déclenche aucun appel.
--
--   vault : `prelevement_url` → https://<projet>.supabase.co/functions/v1/mission-prelever
--           `prelevement_cle` → le même secret que `PRELEVEMENT_CLE` côté fonction
--
-- ⚠️ Et elle ne réveille personne quand il n'y a rien à prélever : un appel par
-- heure pour une liste vide réveillerait une fonction edge 8 760 fois par an
-- sans raison.
create or replace function public.declencher_le_prelevement()
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  v_url text;
  v_cle text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'prelevement_url' limit 1;
  select decrypted_secret into v_cle
    from vault.decrypted_secrets where name = 'prelevement_cle' limit 1;

  if coalesce(btrim(v_url), '') = '' or coalesce(btrim(v_cle), '') = '' then
    raise notice 'prélèvement : « prelevement_url » ou « prelevement_cle » absent du coffre, rien à faire';
    return;
  end if;

  -- ⚠️ DEUX RAISONS DE RÉVEILLER LA FONCTION, et il en faut UNE. Elle fait
  -- deux travaux : prélever ce qui est dû, et rattraper les cartes vérifiées
  -- qu'on n'a pas enregistrées. Ne regarder que le premier laisserait le
  -- second sans horloge.
  if jsonb_array_length(public.missions_a_prelever()) = 0
     and jsonb_array_length(public.empreintes_en_attente()) = 0 then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-prelevement-cle', v_cle),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$function$;

revoke all on function public.declencher_le_prelevement() from public, anon, authenticated;

-- ⚠️ À LA MINUTE 15, DIX MINUTES APRÈS LA CLÔTURE. `cloturer-hors-fenetre`
-- tourne à la minute 5 et pose `terminee` ; le prélèvement a besoin de cet
-- état. Les faire à la même minute marcherait la plupart du temps et
-- laisserait une mission d'une heure en arrière de temps en temps.
--
-- ⚠️ Le bloc vérifie que `pg_cron` est là : `scripts/replique/verifier.sh`
-- rejoue les vraies migrations sur une base locale qui n'a pas l'extension, et
-- s'arrête au premier échec (fiche du 5 octobre).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron absent : la tâche n''est pas programmée (réplique locale).';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'prelever-les-locations') then
    perform cron.unschedule('prelever-les-locations');
  end if;

  perform cron.schedule(
    'prelever-les-locations',
    '15 * * * *',
    $sql$select public.declencher_le_prelevement()$sql$
  );
end
$$;
