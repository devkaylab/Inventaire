-- ============================================================================
-- LE FORFAIT TROP JUSTE SE DIT AU CLIENT (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- Julien, sur la maquette : *« on n'envoie plus de devis. Envoie une
-- notification du type "votre forfait semble être trop juste pour votre
-- utilisation, n'hésitez pas à passer à <nom du forfait>" avec un bouton
-- découvrir. »*
--
-- Le premier jet faisait du dépassement une affaire de vendeur — « un magasin
-- au-dessus de son forfait est un devis à envoyer ». C'était le réflexe de
-- l'ancien monde. Depuis que l'offre est publique et que le changement se fera
-- en libre-service, **le client n'a besoin de personne** : il lui faut
-- seulement savoir, et savoir quoi prendre.
--
-- ⚠️ ELLE NE PART QU'UNE FOIS PAR MAGASIN ET PAR MOIS. Un appareil éconduit
-- redemande sa place toutes les trente secondes ; sans ce frein, une matinée
-- d'inventaire serré produirait des dizaines de notifications, et la cloche
-- deviendrait une chose qu'on ferme sans lire. C'est la même règle que la
-- mémoire d'`alertes_envoyees` pour les alertes par e-mail.
--
-- ⚠️ ET SEULS LES ADMINISTRATEURS D'ENTREPRISE LA REÇOIVENT. Un superviseur ne
-- décide pas de la licence, et un compteur encore moins — le leur dire ne
-- ferait que déplacer une contrariété. Même périmètre que la section
-- « Appareils » de la fiche du magasin.
--
-- ⚠️ LES DEUX FILTRES DE LA CLOCHE SONT TOUCHÉS, ET IL FAUT LES DEUX : la
-- contrainte `notifications_type_check` et la liste blanche de
-- `mes_notifications`. Un seul des deux suffit à rendre la cloche muette sans
-- le moindre message d'erreur — leçon du 3 septembre 2026, payée en direct.
-- Un test de garde vérifie que le type figure aux deux endroits.
-- ============================================================================

-- ── 1. La cloche accepte le type ───────────────────────────────────────────

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'invitation_inventaire'::text,
    'compteur_actif'::text,
    'message_superviseur'::text,
    'message_entreprise'::text,
    'inventaire_volumineux'::text,
    'forfait_trop_juste'::text
  ]));

create or replace function public.mes_notifications()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with moi as (
    select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) as admin
  ),
  notifs as (
    select n.id::text as id, n.type, n.donnees, n.created_at,
           n.read_at is not null as lu
      from public.notifications n
     where n.user_id = auth.uid()
       -- ⚠️ Liste blanche : un type déposé sans être ajouté ICI n'apparaît
       -- jamais dans la cloche, sans que rien ne le signale.
       and n.type in ('invitation_inventaire', 'compteur_actif',
                      'inventaire_volumineux', 'forfait_trop_juste')
     order by n.created_at desc limit 20
  ),
  fils as (
    select fi.id::text as id, 'message'::text as type,
           jsonb_build_object(
             'fil_id', fi.id,
             'sujet', fi.sujet,
             'de', (select case
                             when fi.portee = 'quantinvo' and m.auteur_interne
                                  and not (select admin from moi)
                               then 'Quantinvo'
                             else coalesce(nullif(m.auteur_label, ''), 'Quelqu''un')
                           end
                      from public.messages m
                     where m.fil_id = fi.id and m.auteur is distinct from auth.uid()
                     order by m.cree_le desc limit 1),
             'entreprise', (select c.name from public.companies c where c.id = fi.company_id)
           ) as donnees,
           fi.dernier_le as created_at,
           not exists (select 1 from public.messages m
                        where m.fil_id = fi.id
                          and m.auteur is distinct from auth.uid()
                          and (mp.lu_le is null or m.cree_le > mp.lu_le)) as lu
      from public.message_fils fi
      join public.message_participants mp on mp.fil_id = fi.id and mp.user_id = auth.uid()
     order by fi.dernier_le desc limit 20
  ),
  tout as (select * from notifs union all select * from fils)
  select jsonb_build_object(
    'non_lues', (select count(*) from tout where not lu),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'type', t.type, 'donnees', t.donnees,
               'created_at', t.created_at, 'lu', t.lu
             ) order by t.created_at desc)
        from (select * from tout order by created_at desc limit 20) t
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.mes_notifications() from public, anon;
grant execute on function public.mes_notifications() to authenticated, service_role;


-- ── 2. Le refus prévient, une fois par mois ────────────────────────────────
--
-- ⚠️ `donnees` porte des NOMBRES, pas un nom d'offre. Le nom se déduit à
-- l'affichage par `proposer()` de `web/lib/appareils.ts`, seul endroit qui
-- connaisse l'échelle des paliers. Le figer ici en ferait une quatrième copie
-- de la grille — et il n'y a rien à figer : ce sont les nombres qui décrivent
-- la situation du jour, le nom n'en est que la lecture.
create or replace function public.prevenir_forfait_trop_juste(
  p_store_id uuid,
  p_plafond integer,
  p_besoin integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  repos constant interval := interval '30 days';
  v_company uuid;
  v_nom text;
begin
  -- Déjà dit récemment : on se tait. Le `for update` de l'appelant sérialise
  -- les demandes du magasin, il n'y a donc pas de course sur ce contrôle.
  if exists (select 1 from public.notifications
              where type = 'forfait_trop_juste'
                and donnees ->> 'store_id' = p_store_id::text
                and created_at > now() - repos) then
    return;
  end if;

  select s.company_id, s.name into v_company, v_nom
    from public.stores s where s.id = p_store_id;
  if v_company is null then return; end if;

  insert into public.notifications (user_id, type, donnees)
  select p.id, 'forfait_trop_juste',
         jsonb_build_object(
           'store_id', p_store_id::text,
           'magasin', coalesce(v_nom, ''),
           'forfait', p_plafond::text,
           'besoin', p_besoin::text)
    from public.profiles p
   where p.company_id = v_company
     and p.is_company_admin;
end;
$$;

revoke all on function public.prevenir_forfait_trop_juste(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.prevenir_forfait_trop_juste(uuid, integer, integer) to service_role;


-- ── 3. Le refus déclenche l'avertissement ──────────────────────────────────
--
-- ⚠️ L'APPEL EST DANS LE `if not v_refuse`, donc au PREMIER refus d'un appareil
-- donné — pas à chacune de ses tentatives. Le repos de trente jours de
-- `prevenir_forfait_trop_juste` fait le reste.
--
-- ⚠️ ET IL EST ENVELOPPÉ. Une notification qui échoue ne doit pas faire échouer
-- la demande de place : `usePlaceAppareil` accorde sur toute erreur (borne 3),
-- donc une cloche cassée désactiverait le verrou en silence. C'est le seul
-- endroit du produit où avaler une exception est le moindre mal — et le mode
-- de panne connu (type absent de la contrainte ou de la liste blanche) est
-- fermé par un test de garde, pas par de la chance.
create or replace function public.prendre_place_appareil(
  p_session_id uuid,
  p_appareil text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fenetre constant interval := interval '90 seconds';
  v_store   uuid;
  v_cle     text;
  v_plafond integer;
  v_deja    boolean;
  v_refuse  boolean;
  v_actifs  integer;
  v_besoin  integer;
  v_jour    date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.is_session_participant(p_session_id) then
    return jsonb_build_object('accorde', false, 'code', 'interdit');
  end if;

  v_cle := btrim(coalesce(p_appareil, ''));
  if v_cle = '' or length(v_cle) > 64 or v_cle !~ '^[A-Za-z0-9._:-]+$' then
    return jsonb_build_object('accorde', false, 'code', 'cle_invalide');
  end if;

  select s.store_id into v_store
    from public.inventory_sessions s
   where s.id = p_session_id;
  if v_store is null then
    return jsonb_build_object('accorde', false, 'code', 'introuvable');
  end if;

  perform 1 from public.stores where id = v_store for update;

  delete from public.appareils_actifs
   where store_id = v_store and vu_le < now() - fenetre;

  v_plafond := public.plafond_appareils(v_store);

  select coalesce(bool_or(not refuse), false), coalesce(bool_or(refuse), false)
    into v_deja, v_refuse
    from public.appareils_actifs
   where store_id = v_store and appareil = v_cle;

  if not v_deja and v_plafond is not null then
    select count(*) into v_actifs
      from public.appareils_actifs where store_id = v_store and not refuse;
    if v_actifs >= v_plafond then
      if not v_refuse then
        insert into public.appareils_par_jour (store_id, jour, pic, refus)
          values (v_store, v_jour, 0, 1)
          on conflict (store_id, jour)
          do update set refus = appareils_par_jour.refus + 1;

        select a.pic + a.refus into v_besoin
          from public.appareils_par_jour a
         where a.store_id = v_store and a.jour = v_jour;

        begin
          perform public.prevenir_forfait_trop_juste(v_store, v_plafond, v_besoin);
        exception when others then
          null;
        end;
      end if;
      insert into public.appareils_actifs (store_id, appareil, vu_le, refuse)
        values (v_store, v_cle, now(), true)
        on conflict (store_id, appareil) do update set vu_le = now(), refuse = true;
      return jsonb_build_object(
        'accorde', false, 'code', 'forfait_plein',
        'plafond', v_plafond, 'appareils', v_actifs);
    end if;
  end if;

  insert into public.appareils_actifs (store_id, appareil, vu_le, refuse)
    values (v_store, v_cle, now(), false)
    on conflict (store_id, appareil) do update set vu_le = now(), refuse = false;

  select count(*) into v_actifs
    from public.appareils_actifs where store_id = v_store and not refuse;

  insert into public.appareils_par_jour (store_id, jour, pic, refus)
    values (v_store, v_jour, v_actifs, 0)
    on conflict (store_id, jour)
    do update set pic = greatest(appareils_par_jour.pic, excluded.pic);

  return jsonb_build_object(
    'accorde', true, 'plafond', v_plafond, 'appareils', v_actifs);
end;
$$;

revoke all on function public.prendre_place_appareil(uuid, text) from public, anon;
grant execute on function public.prendre_place_appareil(uuid, text) to authenticated, service_role;
