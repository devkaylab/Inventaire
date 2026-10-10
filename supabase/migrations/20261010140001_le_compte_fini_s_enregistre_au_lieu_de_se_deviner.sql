-- ⚠️⚠️ CETTE MIGRATION TOUCHE QUANTINVO OS, ET ELLE CORRIGE UNE RÉGRESSION
-- POSÉE LE MATIN MÊME.
--
-- `20261010100001` a fait suivre le badge « Mot de passe à créer » et le bouton
-- « Renvoyer le lien » à `encrypted_password`, en croyant qu'une colonne vide
-- signalait une inscription inachevée.
--
-- ⚠️ **ELLE N'EST JAMAIS VIDE.** Supabase pose un mot de passe ALÉATOIRE dès
-- l'invitation. Mesuré le 10 octobre 2026 sur la production : les neuf comptes
-- portent un hash bcrypt de 60 caractères — y compris les deux dont Julien
-- confirme qu'ils n'ont jamais rien choisi. Le badge ne s'affichait donc plus
-- JAMAIS, ni le bouton : la correction faisait l'inverse de sa promesse.
--
-- La faute, en une phrase : j'ai vérifié que la colonne EXISTAIT, pas ce
-- qu'elle VOULAIT DIRE. C'est « vérifier l'effet, pas le code de retour »,
-- manqué sur le signal central.
--
-- ⚠️ **AUCUNE COLONNE DE SUPABASE NE DIT « CE COMPTE EST FINI ».** Il faut donc
-- l'enregistrer nous-mêmes, au moment exact où ça se produit : `/bienvenue` et
-- `/reinitialisation` posent `mot_de_passe_cree` dans les métadonnées quand
-- elles écrivent le mot de passe. Un fait consigné quand il arrive ne se
-- devine plus après coup.
--
-- ⚠️ Et le champ CHANGE DE NOM : `a_un_mot_de_passe` était devenu un mensonge
-- — tout le monde en a un. Il s'appelle `compte_finalise`. C'est ce nom-là qui
-- m'a fait faute ; le laisser aurait laissé le piège armé.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Reprise de l'existant
-- ──────────────────────────────────────────────────────────────────────────
--
-- ⚠️⚠️ IL N'EXISTE AUCUN SIGNAL RÉTROACTIF FIABLE, ET J'EN AI ESSAYÉ UN QUI
-- A ÉCHOUÉ. Premier jet : marquer les comptes dont la dernière modification
-- tombe bien après la dernière connexion — choisir son mot de passe met le
-- compte à jour, un simple clic sur le lien d'invitation non.
--
-- ⚠️ **C'EST FAUX, et la raison vaut d'être retenue** : la comparaison porte
-- sur la DERNIÈRE connexion et la DERNIÈRE modification. Quelqu'un qui se
-- reconnecte après avoir créé son mot de passe écrase les deux d'un seul
-- geste, et l'écart retombe à quelques millisecondes. L'heuristique ne
-- séparait donc pas « a fini » de « n'a pas fini » : elle séparait « ne s'est
-- jamais reconnecté » du reste. Elle a classé Enisa Pejovic comme inachevée
-- alors qu'elle avait tout terminé.
--
-- `confirmed_at` ne sépare pas davantage : sept minutes chez Julia, qui n'a
-- pas fini, contre quatre heures chez Enisa, qui a fini.
--
-- La seule source de vérité pour les comptes d'AVANT le marqueur est Julien
-- lui-même, qui les connaît un par un. Elle est donc écrite ici, nommément,
-- plutôt que devinée : neuf comptes, deux inachevés.
--
-- ⚠️ Le déclencheur `auth_users_notifier_premiere_connexion` ne se réveille que
-- si `last_sign_in_at` passe de nul à non nul. On ne touche qu'aux
-- métadonnées : aucune notification ne part. Vérifié avant d'écrire.
update auth.users u
   set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                            || jsonb_build_object('mot_de_passe_cree', true)
 where lower(u.email) not in ('julia.huang@samaritaine.com', 'jthiongkay@gmail.com')
   and coalesce(u.raw_user_meta_data->>'mot_de_passe_cree', '') <> 'true';

-- ⚠️ Et on DÉMARQUE les deux, au cas où un essai précédent les aurait marqués :
-- une migration se rejoue, et un état à moitié repris est pire qu'aucun.
update auth.users u
   set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'mot_de_passe_cree'
 where lower(u.email) in ('julia.huang@samaritaine.com', 'jthiongkay@gmail.com');

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Ce que les deux écrans lisent
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.my_team_by_store()
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Non authentifié.'; end if;
  if coalesce(public.get_my_role(), '') <> 'supervisor' then
    raise exception 'Réservé aux superviseurs.';
  end if;

  return json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object(
               'id', s.id, 'name', s.name,
               'counters', (
                 select coalesce(json_agg(json_build_object(
                          'id', p.id,
                          'full_name', p.full_name,
                          'email', (select u.email::text from auth.users u where u.id = p.id),
                          'is_active', (select u.last_sign_in_at is not null
                                          from auth.users u where u.id = p.id),
                          -- ⚠️ Le fait enregistré, jamais deviné.
                          'compte_finalise', (select coalesce(u.raw_user_meta_data->>'mot_de_passe_cree', '') = 'true'
                                                from auth.users u where u.id = p.id),
                          'a_moi', coalesce(st.ajoute_par = v_uid, false),
                          'sessions_counted', (
                            select count(distinct c2.session_id) from public.counts c2
                             where c2.counted_by = p.id),
                          'last_count_at', (
                            select max(c3.created_at) from public.counts c3
                             where c3.counted_by = p.id)
                        ) order by (st.ajoute_par is distinct from v_uid), p.full_name), '[]'::json)
                   from public.store_team st
                   join public.profiles p on p.id = st.user_id
                  where st.store_id = s.id and p.role = 'employee')
             ) order by s.name), '[]'::json)
        from public.stores s
        join public.store_supervisors ss on ss.store_id = s.id and ss.user_id = v_uid),
    'invitations', (
      select coalesce(json_agg(json_build_object(
               'id', i.id, 'email', i.email, 'first_name', i.first_name,
               'last_name', i.last_name, 'created_at', i.created_at
             ) order by i.created_at desc), '[]'::json)
        from public.team_invitations i
       where i.created_by = v_uid)
  );
end;
$function$;
revoke all on function public.my_team_by_store() from public, anon;
grant execute on function public.my_team_by_store() to authenticated, service_role;

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
        from public.team_invitations i where i.company_id = v_company)
  );
end;
$function$;
revoke all on function public.ca_list_team() from public, anon;
grant execute on function public.ca_list_team() to authenticated, service_role;
