-- ============================================================================
-- ON ÉCRIT « OFFRE », JAMAIS « FORFAIT » — LES DEUX TEXTES QUI VIVENT EN BASE
-- (5 septembre 2026)
-- ----------------------------------------------------------------------------
-- Julien, sur la maquette : « change le mot forfait par autre chose ». « Offre »
-- l'a remplacé partout — c'est le mot de la page Tarifs, celui des trois
-- paliers, et celui que le code emploie déjà pour ce geste (`kind = 'offre'`).
--
-- ⚠️ DEUX PHRASES QUE LE CLIENT LIT VIVENT EN BASE, ET NON DANS UN ÉCRAN.
-- Elles auraient survécu au renommage sans que rien ne le signale :
--
--   · `deposer_changement_offre` — « Votre forfait couvre déjà N appareils »,
--     le refus qui s'affiche SOUS le bouton de la fiche magasin ;
--   · `anomalies_a_signaler` — « … le forfait en couvre M », qui part dans
--     l'e-mail d'alerte, au milieu d'un message qui dit « offre » partout
--     ailleurs.
--
-- ⚠️ LES CLÉS NE BOUGENT PAS, et c'est délibéré : `forfait_trop_juste` est
-- contraint par `notifications_type_check` ET filtré par la liste blanche de
-- `mes_notifications` ; `forfait_plein` est le code de refus que
-- `usePlaceAppareil` teste sur le téléphone, donc dans des builds déjà
-- installés ; `'forfait'` est la nature d'anomalie que l'edge trie. Renommer
-- un identifiant pour une raison de vocabulaire casse ce qui tourne.
--
-- Rien d'autre ne change dans ces deux fonctions : elles sont reprises telles
-- qu'elles tournaient, au caractère près.
-- ============================================================================

create or replace function public.anomalies_a_signaler()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ouvertes as (
    select
      'paiement:company:' || r.id::text        as cle,
      'paiement'                               as nature,
      r.company_name                           as objet,
      r.quote_amount_cents                     as montant_centimes,
      r.paid_at                                as depuis,
      'inscription'                            as parcours,
      null::text                               as session_id,
      -- ⚠️ Renseignées pour la seule nature « forfait » : c'est la première
      -- qui s'adresse au CLIENT et non à Quantinvo. Nulles ailleurs, et l'edge
      -- s'en sert pour savoir à qui elle écrit et quelle offre nommer.
      null::text                               as destinataire,
      null::text                               as prenom,
      null::integer                            as besoin
      from public.company_requests r
     where r.status = 'paid'
       and r.company_id is null
       and r.paid_at is not null
       and r.paid_at < now() - interval '15 minutes'

    union all

    select
      'paiement:store:' || s.id::text,
      'paiement',
      s.store_name,
      s.quote_amount_cents,
      s.paid_at,
      'ajout de magasin',
      null::text, null::text, null::text, null::integer
      from public.store_requests s
     where s.status = 'paid'
       and s.store_id is null
       and s.paid_at is not null
       and s.paid_at < now() - interval '15 minutes'

    union all

    -- Le ménage quotidien n'a pas abouti depuis deux nuits.
    select
      'purge:silencieuse',
      'purge',
      'Purge des données',
      null::bigint,
      p.dernier,
      'ménage quotidien',
      null::text, null::text, null::text, null::integer
      from (
        select greatest(
                 coalesce(max(d.end_time), '-infinity'::timestamptz),
                 timestamptz '2026-08-28 13:30:00+00'
               ) as dernier
          from cron.job j
          left join cron.job_run_details d
                 on d.jobid = j.jobid and d.status = 'succeeded'
         where j.jobname = 'purge-donnees-expirees'
      ) p
     where p.dernier < now() - interval '48 hours'

    union all

    -- Un inventaire OUVERT qui passe l'un des deux repères.
    -- ⚠️ Seulement les inventaires ouverts : un inventaire clôturé ne se
    -- compte plus, il ne présente aucun risque, et le signaler chaque jour
    -- ferait du bruit pour rien.
    select
      'volume:' || v.repere || ':' || s.id::text,
      'volume',
      coalesce(nullif(s.name, ''), s.store_name),
      null::bigint,
      s.created_at,
      v.mesure,
      s.id::text, null::text, null::text, null::integer
      from public.inventory_sessions s
      cross join lateral (
        select (select count(*) from public.articles a where a.session_id = s.id) as refs,
               (select count(*) from public.counts   c where c.session_id = s.id) as cpts
      ) t
      cross join lateral (
        values
          ('references', t.refs, 150000::bigint,
           t.refs || ' références importées'),
          ('comptages',  t.cpts, 400000::bigint,
           t.cpts || ' comptages enregistrés · ' || t.refs || ' références')
      ) v(repere, valeur, seuil, mesure)
     where s.status in ('open', 'counting')
       and v.valeur >= v.seuil

    union all

    -- ⚠️ LE FORFAIT TROP JUSTE — LA PREMIÈRE ALERTE QUI S'ADRESSE AU CLIENT.
    -- Elle ne REDÉTECTE rien : elle part des notifications déjà déposées par
    -- `prevenir_forfait_trop_juste`, celles que l'administrateur voit dans sa
    -- cloche. Une seule détection, donc la cloche et l'e-mail ne peuvent pas
    -- se contredire — et le repos de trente jours de la notification vaut pour
    -- les deux sans qu'on ait à le réécrire.
    select
      'forfait:' || n.id::text,
      'forfait',
      n.donnees ->> 'magasin',
      null::bigint,
      n.created_at,
      (n.donnees ->> 'besoin') || ' appareils auraient été nécessaires, l''offre en couvre '
        || (n.donnees ->> 'forfait'),
      n.donnees ->> 'store_id',
      lower(u.email::text),
      coalesce(nullif(btrim(p.first_name), ''), ''),
      nullif(btrim(coalesce(n.donnees ->> 'besoin', '')), '')::integer
      from public.notifications n
      join auth.users u on u.id = n.user_id
      left join public.profiles p on p.id = n.user_id
     where n.type = 'forfait_trop_juste'
       -- Sept jours : si le tour de garde est resté muet une nuit, l'e-mail
       -- part quand même ; au-delà, le message aurait perdu son actualité.
       and n.created_at > now() - interval '7 days'
       and u.email is not null
  )
  select coalesce(jsonb_agg(to_jsonb(o) order by o.depuis), '[]'::jsonb)
    from ouvertes o
    left join public.alertes_envoyees a on a.cle = o.cle
   -- ⚠️ Un dépassement de volume ne se rappelle PAS tous les jours. Un gros
   -- inventaire le reste jusqu'à sa clôture : le redire chaque matin est le
   -- meilleur moyen qu'on cesse de lire ces messages. Un paiement sans suite,
   -- lui, est une anomalie qui dure et qu'il faut retraiter — d'où le rappel.
   where a.cle is null
      -- ⚠️ NI « volume » NI « forfait » NE SE RAPPELLENT. Un gros inventaire
      -- le reste jusqu'à sa clôture, et une notification de forfait est DÉJÀ
      -- au repos trente jours : la redire chaque matin est le meilleur moyen
      -- qu'on cesse de lire ces messages. Un paiement sans suite, lui, est une
      -- anomalie qui dure et qu'il faut retraiter — d'où le rappel.
      or (o.nature not in ('volume', 'forfait') and a.derniere_le < now() - interval '24 hours');
$function$;

create or replace function public.deposer_changement_offre(p_store_id uuid, p_devices integer, p_billing_period text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store   record;
  v_label   text;
  v_tarif   jsonb;
  v_plafond integer;
  v_id      uuid;
begin
  select s.id, s.name, s.company_id,
         -- ⚠️ L'abonnement DU MAGASIN d'abord (voir `etat_abonnement_magasin`).
         coalesce(s.stripe_subscription_id, c.stripe_subscription_id) as stripe_subscription_id
    into v_store
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id;
  if not found then
    return json_build_object('success', false, 'error', 'Magasin introuvable.');
  end if;

  -- ⚠️ La garde porte sur l'entreprise DU MAGASIN, jamais sur un paramètre de
  -- l'appelant — sinon on change l'offre du magasin d'un autre client.
  if not (public.is_admin() or public.is_company_admin(v_store.company_id)) then
    return json_build_object('success', false, 'error',
      'Accès réservé à l''administrateur de l''entreprise.');
  end if;

  if p_devices is null or p_devices <= 0 then
    return json_build_object('success', false, 'error',
      'Indiquez le nombre d''appareils qui comptent en même temps.');
  end if;
  if p_devices > 1000 then
    return json_build_object('success', false, 'error',
      'Ce nombre d''appareils sort de la grille : écrivez-nous, nous construisons le tarif avec vous.');
  end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'yearly') then
    return json_build_object('success', false, 'error', 'Rythme de paiement inconnu.');
  end if;

  -- Rien à vendre : l'offre couvre déjà ce besoin.
  v_plafond := public.plafond_appareils(p_store_id);
  if v_plafond is not null and p_devices <= v_plafond then
    return json_build_object('success', false, 'code', 'deja_couvert', 'error',
      'Votre offre couvre déjà ' || v_plafond || ' appareils.');
  end if;

  -- ⚠️ UNE ENTREPRISE QUI A UN ABONNEMENT NE PASSE PAS PAR ICI. Un second
  -- Checkout ouvrirait un second abonnement, et le client paierait les deux.
  -- C'est l'edge qui modifie l'abonnement existant, et `appliquer_changement_offre`
  -- qui enregistre le résultat.
  if nullif(btrim(coalesce(v_store.stripe_subscription_id, '')), '') is not null then
    return json_build_object('success', false, 'code', 'abonnement_en_cours', 'error',
      'Cette entreprise a un abonnement en cours : le changement se fait dessus.');
  end if;

  if exists (select 1 from public.store_requests r
              where r.store_id = p_store_id
                and r.kind = 'offre'
                and r.status in ('pending', 'quoted', 'accepted', 'paid')) then
    return json_build_object('success', false, 'code', 'deja_en_cours', 'error',
      'Un changement d''offre est déjà en cours pour ce magasin.');
  end if;

  v_tarif := public.prix_offre(p_devices, p_billing_period);

  select coalesce(nullif(btrim(full_name), ''), '') into v_label
    from public.profiles where id = auth.uid();

  insert into public.store_requests (
    company_id, store_id, store_name, message, devices, billing_period,
    kind, requested_by, requested_label,
    status, accepted_at,
    quote_amount_cents, quote_lines, admin_note
  ) values (
    v_store.company_id, p_store_id, v_store.name, '', p_devices, p_billing_period,
    'offre', auth.uid(), coalesce(v_label, ''),
    'accepted', now(),
    (v_tarif ->> 'prix_cents')::bigint,
    jsonb_build_array(jsonb_build_object(
      'libelle', v_store.name,
      'appareils', p_devices,
      'prixCents', (v_tarif ->> 'prix_cents')::bigint,
      'annuelCents', (v_tarif ->> 'annuel_cents')::bigint)),
    'Changement d''offre en libre-service'
  ) returning id into v_id;

  perform public.log_company_action(v_store.company_id, 'offre_changee', v_store.name,
    json_build_object('appareils', p_devices, 'offre', v_tarif ->> 'plan',
                      'rythme', p_billing_period,
                      'montant_cents', (v_tarif ->> 'prix_cents')::bigint)::jsonb);

  return json_build_object('success', true, 'id', v_id::text,
    'store_name', v_store.name, 'plan', v_tarif ->> 'plan',
    'plafond', (v_tarif ->> 'plafond')::integer,
    'prix_cents', (v_tarif ->> 'prix_cents')::bigint,
    'billing_period', p_billing_period);
end;
$function$;

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC — et les droits par défaut de
-- Supabase l'accordent aussi à `anon`. Un `revoke … from public` seul ne le
-- retire pas : on vise les deux. Constat n°6 du 28 août 2026, qui se reproduit
-- à chaque redéfinition.
revoke all on function public.anomalies_a_signaler() from public, anon, authenticated;
grant execute on function public.anomalies_a_signaler() to service_role;

revoke all on function public.deposer_changement_offre(uuid, integer, text) from public, anon;
grant execute on function public.deposer_changement_offre(uuid, integer, text) to authenticated, service_role;
