-- ⚠️⚠️ UNE DEMANDE ÉCRITE QUE PERSONNE NE VOYAIT.
--
-- Julien, 10 octobre 2026 : « c'est envoyé, et tu dis que la demande également
-- dans mes notifs, non ça n'y est pas, puis je ne vois nulle part une demande,
-- il faut une section dans équipe, le lien du mail doit y emmener ».
--
-- Mesuré après son essai : la demande ÉTAIT en base (`id` 1, état
-- « en_attente »), la notification ÉTAIT posée pour Camille (type
-- `demande_suppression`, non lue), l'e-mail ÉTAIT parti. Trois écritures
-- justes, et **rien à l'écran**. Deux trous, et chacun suffisait :
--
-- ⚠️ 1. `mes_notifications` porte une LISTE BLANCHE de types. Le commentaire
-- de la fonction le dit mot pour mot : « un type déposé sans être ajouté ICI
-- n'apparaît jamais dans la cloche, sans que rien ne le signale ». J'ai ajouté
-- les deux types à la contrainte de la table, au composant qui les affiche, à
-- l'e-mail — et pas à la liste blanche. L'avertissement était écrit à l'endroit
-- exact de l'oubli. **Une liste blanche ne prévient jamais de ce qu'elle
-- jette** : c'est à la garde de le faire, et elle est désormais écrite
-- (`web/tests/demander-la-suppression.test.ts`).
--
-- ⚠️ 2. Aucune page ne montrait les demandes. L'administrateur recevait un
-- message pour un geste qu'aucun écran ne proposait : il devait se souvenir du
-- nom, le retrouver dans la liste des membres, et deviner que « Supprimer le
-- compte » était la réponse à la demande. `ca_list_team` les rend maintenant,
-- et `/equipe` leur donne une section.
--
-- ⚠️ 3. ET UNE DEMANDE POUVAIT NE JAMAIS SORTIR DE LA LISTE. Non demandé, mais
-- la section le rendait inévitable : le seul chemin ouvert était la
-- suppression. Un administrateur qui ne veut PAS supprimer n'avait aucun geste
-- — la demande restait « en attente » pour toujours, et le superviseur
-- n'apprenait jamais la décision. C'est exactement le cul-de-sac du 9 octobre,
-- à l'autre bout du parcours. D'où le refus, et l'état qui va avec.

-- ── L'état « refusée » ────────────────────────────────────────────────────
alter table public.demandes_suppression_compte
  drop constraint if exists demandes_suppression_compte_etat_check;
alter table public.demandes_suppression_compte
  add constraint demandes_suppression_compte_etat_check
  check (etat in ('en_attente', 'traitee', 'refusee'));

-- ── Ce que l administrateur lit ──────────────────────────────────────────

create or replace function public.ca_list_team()
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $function$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  return json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::json)
        from public.stores s where s.company_id = v_company),
    'members', (
      select coalesce(json_agg(json_build_object(
               'id', p.id,
               'full_name', p.full_name,
               'first_name', p.first_name,
               'last_name', p.last_name,
               'role', p.role,
               'is_company_admin', p.is_company_admin,
               'email', (select u.email::text from auth.users u where u.id = p.id),
               'is_active', (select u.last_sign_in_at is not null
                               from auth.users u where u.id = p.id),
               'compte_finalise', (select coalesce(u.raw_user_meta_data->>'mot_de_passe_cree', '') = 'true'
                                     from auth.users u where u.id = p.id),
               'last_count_at', (select max(c.created_at) from public.counts c
                                  where c.counted_by = p.id),
               'sessions_counted', (select count(distinct c2.session_id) from public.counts c2
                                     where c2.counted_by = p.id),
               'store_ids', case when p.role = 'supervisor' then
                 (select coalesce(json_agg(ss.store_id), '[]'::json)
                    from public.store_supervisors ss
                    join public.stores st on st.id = ss.store_id and st.company_id = v_company
                   where ss.user_id = p.id)
               else
                 (select coalesce(json_agg(stm.store_id), '[]'::json)
                    from public.store_team stm
                    join public.stores st on st.id = stm.store_id and st.company_id = v_company
                   where stm.user_id = p.id)
               end
             ) order by p.is_company_admin desc, p.role desc, p.full_name), '[]'::json)
        from public.profiles p where p.company_id = v_company),
    'invitations', (
      select coalesce(json_agg(json_build_object(
               'id', i.id, 'email', i.email,
               'first_name', i.first_name, 'last_name', i.last_name,
               'role', i.role, 'store_ids', coalesce(to_json(i.store_ids), '[]'::json),
               'created_at', i.created_at
             ) order by i.created_at desc), '[]'::json)
        from public.team_invitations i where i.company_id = v_company),
    -- ⚠️ LES DEMANDES DE SUPPRESSION EN ATTENTE, et c'est ce qui manquait : la
    -- demande était écrite, la notification posée, l'e-mail envoyé — et
    -- l'écran de l'administrateur ne la montrait NULLE PART. Il recevait un
    -- message pour un geste qu'aucune page ne proposait.
    --
    -- ⚠️ `cible` peut être nul (`on delete set null`) : le compte a pu être
    -- supprimé par un autre chemin. Le nom figé reste, lui — c'est tout
    -- l'intérêt de `cible_nom`.
    'demandes_suppression', (
      select coalesce(json_agg(json_build_object(
               'id', d.id,
               'cible', d.cible,
               'cible_nom', d.cible_nom,
               'motif', d.motif,
               'created_at', d.created_at,
               'par', coalesce((select pr.full_name from public.profiles pr where pr.id = d.demandeur), '')
             ) order by d.created_at desc), '[]'::json)
        from public.demandes_suppression_compte d
       where d.company_id = v_company and d.etat = 'en_attente')
  );
end;
$function$;
revoke all on function public.ca_list_team() from public, anon;
grant execute on function public.ca_list_team() to authenticated, service_role;
-- ── La cloche voit enfin les deux types ───────────────────────────────────
--
-- ⚠️ SEULE LA LISTE BLANCHE CHANGE. Le reste du corps est repris tel quel de
-- la base (`pg_get_functiondef`), pas du dépôt : c'est la seule lecture qui
-- dise ce qui tourne vraiment.
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
       -- jamais dans la cloche, sans que rien ne le signale. C'est arrivé le
       -- 10 octobre 2026 avec les deux derniers de cette liste.
       and n.type in ('invitation_inventaire', 'compteur_actif',
                      'inventaire_volumineux', 'forfait_trop_juste',
                      'demande_suppression', 'demande_suppression_traitee')
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
-- ⚠️ `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.mes_notifications() from public, anon;
grant execute on function public.mes_notifications() to authenticated, service_role;

-- ── Refuser une demande ───────────────────────────────────────────────────
--
-- ⚠️ **PAS DE NOUVEAU TYPE DE NOTIFICATION.** Le refus réutilise
-- `demande_suppression_traitee` avec `refusee` dans les données. C'est la
-- leçon du jour : chaque type neuf doit être ajouté à la contrainte de la
-- table, à la liste blanche de `mes_notifications` ET au composant qui
-- l'affiche — trois endroits, et l'oubli de l'un ne se signale pas. Un drapeau
-- dans les données ne traverse qu'un seul de ces trois endroits.
create or replace function public.ca_refuser_suppression(p_id bigint, p_motif text default '')
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company uuid;
  v_d       public.demandes_suppression_compte%rowtype;
  v_motif   text := btrim(coalesce(p_motif, ''));
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  -- ⚠️ La borne est sur la LIGNE VISÉE : l'entreprise de la demande, pas un
  -- paramètre de l'appelant. Et `for update` parce que deux administrateurs
  -- peuvent répondre à la même demande en même temps — le second doit lire
  -- l'état écrit par le premier, pas celui d'avant.
  select * into v_d from public.demandes_suppression_compte
   where id = p_id and company_id = v_company
   for update;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable.');
  end if;
  if v_d.etat <> 'en_attente' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;

  update public.demandes_suppression_compte
     set etat = 'refusee', traitee_le = now()
   where id = p_id;

  -- Celui qui a demandé apprend la décision : sans ça il attend sans fin, et
  -- c'est le cul-de-sac qu'on vient de fermer à l'autre bout du parcours.
  if v_d.demandeur is not null and v_d.demandeur <> auth.uid() then
    insert into public.notifications (user_id, type, donnees)
    values (v_d.demandeur, 'demande_suppression_traitee', jsonb_build_object(
              'demande_id', v_d.id,
              'nom', coalesce(nullif(v_d.cible_nom, ''), ''),
              'refusee', true,
              'motif', v_motif));
  end if;

  perform public.log_company_action(v_company, 'suppression_refusee',
    coalesce(nullif(v_d.cible_nom, ''), ''), json_build_object('motif', v_motif)::jsonb);

  return json_build_object('success', true, 'nom', coalesce(nullif(v_d.cible_nom, ''), ''));
end;
$function$;
revoke all on function public.ca_refuser_suppression(bigint, text) from public, anon;
grant execute on function public.ca_refuser_suppression(bigint, text) to authenticated, service_role;
