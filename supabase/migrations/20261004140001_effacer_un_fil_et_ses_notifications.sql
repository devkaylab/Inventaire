-- ⚠️ EFFACER UNE CONVERSATION, ET SES NOTIFICATIONS (4 octobre 2026).
--
-- Demande de Julien : « ajoute la possibilité d'effacer les messages sur la
-- plateforme, ainsi que les notifications (pas de corbeille) ». Puis, sur la
-- question de la portée, sa règle — et elle vaut mieux que les trois options
-- que je lui proposais :
--
--   « Efface pour celui qui supprime uniquement. Un nouveau message donne une
--     nouvelle conversation pour celui qui a supprimé les messages, sans
--     afficher ce qui a été supprimé. »
--
-- ⚠️ **CE N'EST DONC PAS UNE SUPPRESSION DE LIGNES, C'EST UN POINT DE COUPE.**
-- Retirer sa ligne de `message_participants` aurait paru plus direct, et aurait
-- créé un fil fantôme : `repondre_fil` ne réinscrit pas un participant parti,
-- donc l'autre aurait continué d'écrire dans une conversation que l'effaceur
-- ne reverrait JAMAIS. Avec la coupe, il la revoit — vidée de ce qu'il a
-- effacé, repartant du premier message suivant.
--
-- ⚠️ **ET RIEN N'EST DÉTRUIT CHEZ L'AUTRE.** Les messages restent entiers dans
-- sa boîte : effacer sa propre vue d'un échange ne donne pas le droit
-- d'effacer celle de son interlocuteur — qui n'a rien demandé.
--
-- ⚠️ « Pas de corbeille » : du côté de celui qui efface, c'est immédiat et
-- sans retour. Aucun écran ne repêche une conversation coupée.
--
-- Les notifications, elles, n'appartiennent qu'à une personne
-- (`notifications.user_id`) : là, effacer veut dire supprimer la ligne.

-- ─── 1. Le point de coupe ──────────────────────────────────────────────────
alter table public.message_participants
  add column if not exists efface_avant timestamptz;

comment on column public.message_participants.efface_avant is
  'Ce que cette personne a effacé de ce fil : elle ne voit plus que les messages postérieurs. Nul = rien d''effacé.';

-- ─── 2. La règle, calculée en un seul endroit ──────────────────────────────
--
-- ⚠️ TROIS FONCTIONS LISENT LES MESSAGES D'UNE PERSONNE — la boîte, le fil
-- ouvert, et la cloche. Recopier `coalesce(efface_avant, …)` dans les trois
-- aurait tenu jusqu'à la première qu'on oublie : un fil effacé continuerait
-- d'y réapparaître, et c'est la cloche qu'on aurait oubliée, celle qu'on
-- regarde le moins en écrivant du SQL.
--
-- `-infinity` quand rien n'est effacé : tout est postérieur. Nul quand la
-- personne n'est pas participante — mais les appelants l'ont déjà refusée.
create or replace function public.coupe_du_fil(p_fil uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(mp.efface_avant, '-infinity'::timestamptz)
    from public.message_participants mp
   where mp.fil_id = p_fil and mp.user_id = auth.uid();
$function$;

revoke all on function public.coupe_du_fil(uuid) from public, anon;
grant execute on function public.coupe_du_fil(uuid) to authenticated, service_role;

-- ─── 3. Effacer un fil, pour soi ───────────────────────────────────────────
create or replace function public.effacer_mon_fil(p_fil uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.message_participants p
                  where p.fil_id = p_fil and p.user_id = v_uid) then
    raise exception 'forbidden';
  end if;

  -- ⚠️ `lu_le` suit la coupe : sans ça, un fil effacé puis rouvert par une
  -- réponse serait compté comme déjà lu, et la cloche resterait muette.
  update public.message_participants
     set efface_avant = now(), lu_le = now()
   where fil_id = p_fil and user_id = v_uid;

  return jsonb_build_object('success', true);
end;
$function$;

revoke all on function public.effacer_mon_fil(uuid) from public, anon;
grant execute on function public.effacer_mon_fil(uuid) to authenticated, service_role;

-- ─── 4. Effacer une notification, ou toutes ────────────────────────────────
--
-- Une notification n'appartient qu'à une personne : effacer, ici, supprime la
-- ligne. ⚠️ `user_id = auth.uid()` est sur la ligne VISÉE, pas sur un
-- paramètre de l'appelant : on ne supprime jamais la notification d'autrui.
create or replace function public.effacer_ma_notification(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare n int;
begin
  delete from public.notifications
   where id = p_id and user_id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('success', false, 'error', 'Cette notification n''existe plus.');
  end if;
  return jsonb_build_object('success', true);
end;
$function$;

-- ⚠️ ELLE NE TOUCHE PAS AUX CONVERSATIONS, et l'écran le dit. La cloche mêle
-- deux choses : de vraies notifications, et un reflet des fils de discussion.
-- Vider la cloche en effaçant au passage des échanges avec un client serait
-- une perte que personne n'a demandée — les fils s'effacent depuis Messages,
-- un par un, en sachant ce qu'on efface.
create or replace function public.effacer_mes_notifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare n int;
begin
  delete from public.notifications where user_id = auth.uid();
  get diagnostics n = row_count;
  return jsonb_build_object('success', true, 'effacees', n);
end;
$function$;

revoke all on function public.effacer_ma_notification(uuid) from public, anon;
revoke all on function public.effacer_mes_notifications() from public, anon;
grant execute on function public.effacer_ma_notification(uuid) to authenticated, service_role;
grant execute on function public.effacer_mes_notifications() to authenticated, service_role;

-- ─── 5. Les trois lectures honorent la coupe ───────────────────────────────

-- La boîte : un fil sans message postérieur à la coupe n'y figure plus, et
-- ceux qui restent ne montrent que leur partie visible — nombre, extrait,
-- dernier auteur, non-lu.
create or replace function public.mes_fils()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(f order by f.dernier_le desc), '[]'::jsonb)
  from (
    select
      fi.id, fi.sujet, fi.portee,
      -- ⚠️ La date de tête est celle du dernier message VISIBLE, pas celle du
      -- fil : sinon un fil rouvert se rangerait à la date d'un échange effacé.
      (select max(m.cree_le) from public.messages m
        where m.fil_id = fi.id and m.cree_le > public.coupe_du_fil(fi.id)) as dernier_le,
      (select c.name from public.companies c where c.id = fi.company_id) as entreprise,
      (select count(*) from public.messages m
        where m.fil_id = fi.id and m.cree_le > public.coupe_du_fil(fi.id)) as nb_messages,
      (select m.corps from public.messages m
        where m.fil_id = fi.id and m.cree_le > public.coupe_du_fil(fi.id)
        order by m.cree_le desc limit 1) as dernier_extrait,
      (select case
                when fi.portee = 'quantinvo' and m.auteur_interne
                     and not coalesce((select p.is_admin from public.profiles p
                                        where p.id = auth.uid()), false)
                  then 'Quantinvo'
                else coalesce(nullif(m.auteur_label, ''), 'Quelqu''un')
              end
         from public.messages m
        where m.fil_id = fi.id and m.cree_le > public.coupe_du_fil(fi.id)
        order by m.cree_le desc limit 1) as dernier_auteur,
      exists (select 1 from public.messages m
               where m.fil_id = fi.id
                 and m.cree_le > public.coupe_du_fil(fi.id)
                 and m.auteur is distinct from auth.uid()
                 and (mp.lu_le is null or m.cree_le > mp.lu_le)) as non_lu,
      case
        when fi.portee = 'quantinvo' and not coalesce(
               (select p.is_admin from public.profiles p where p.id = auth.uid()), false)
          then 'Quantinvo'
        else coalesce((
          select string_agg(distinct coalesce(nullif(p2.full_name, ''), 'Quelqu''un'), ', ')
            from public.message_participants mp2
            join public.profiles p2 on p2.id = mp2.user_id
           where mp2.fil_id = fi.id and mp2.user_id <> auth.uid()), '—')
      end as avec
    from public.message_fils fi
    join public.message_participants mp on mp.fil_id = fi.id and mp.user_id = auth.uid()
    -- ⚠️ LE FIL DISPARAÎT TANT QU'IL N'A RIEN DE NEUF. C'est ce qui fait
    -- qu'un effacement se voit comme un effacement, et qu'une réponse le
    -- ramène comme une conversation neuve.
    where exists (select 1 from public.messages m
                   where m.fil_id = fi.id and m.cree_le > public.coupe_du_fil(fi.id))
    order by 4 desc
    limit 100
  ) f;
$function$;

-- Le fil ouvert : seulement sa partie visible.
create or replace function public.ouvrir_message_fil(p_fil uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean;
  v_coupe timestamptz;
  v_res   jsonb;
begin
  if not exists (select 1 from public.message_participants p
                  where p.fil_id = p_fil and p.user_id = v_uid) then
    raise exception 'forbidden';
  end if;

  v_coupe := public.coupe_du_fil(p_fil);

  select coalesce(p.is_admin, false) into v_admin
    from public.profiles p where p.id = v_uid;

  select jsonb_build_object(
    'id', fi.id,
    'sujet', fi.sujet,
    'portee', fi.portee,
    'entreprise', (select c.name from public.companies c where c.id = fi.company_id),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'auteur', case
                           when fi.portee = 'quantinvo' and m.auteur_interne and not v_admin
                             then 'Quantinvo'
                           else coalesce(nullif(m.auteur_label, ''), 'Quelqu''un')
                         end,
               'de_moi', m.auteur is not distinct from v_uid,
               'corps', m.corps,
               'cree_le', m.cree_le
             ) order by m.cree_le)
        from public.messages m
       where m.fil_id = fi.id and m.cree_le > v_coupe), '[]'::jsonb)
  )
  into v_res
  from public.message_fils fi where fi.id = p_fil;

  update public.message_participants set lu_le = now()
   where fil_id = p_fil and user_id = v_uid;

  return v_res;
end;
$function$;

-- La cloche : un fil effacé n'y sonne plus tant qu'il n'a rien de neuf.
create or replace function public.mes_notifications()
returns jsonb
language sql
stable
security definer
set search_path = public
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
                       and m.cree_le > public.coupe_du_fil(fi.id)
                     order by m.cree_le desc limit 1),
             'entreprise', (select c.name from public.companies c where c.id = fi.company_id)
           ) as donnees,
           (select max(m.cree_le) from public.messages m
             where m.fil_id = fi.id and m.cree_le > public.coupe_du_fil(fi.id)) as created_at,
           not exists (select 1 from public.messages m
                        where m.fil_id = fi.id
                          and m.auteur is distinct from auth.uid()
                          and m.cree_le > public.coupe_du_fil(fi.id)
                          and (mp.lu_le is null or m.cree_le > mp.lu_le)) as lu
      from public.message_fils fi
      join public.message_participants mp on mp.fil_id = fi.id and mp.user_id = auth.uid()
     where exists (select 1 from public.messages m
                    where m.fil_id = fi.id and m.cree_le > public.coupe_du_fil(fi.id))
     order by 5 desc limit 20
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

-- ⚠️ Les droits, reposés : `create or replace` rend EXECUTE à PUBLIC.
revoke all on function public.mes_fils() from public, anon;
revoke all on function public.ouvrir_message_fil(uuid) from public, anon;
revoke all on function public.mes_notifications() from public, anon;
grant execute on function public.mes_fils() to authenticated, service_role;
grant execute on function public.ouvrir_message_fil(uuid) to authenticated, service_role;
grant execute on function public.mes_notifications() to authenticated, service_role;
