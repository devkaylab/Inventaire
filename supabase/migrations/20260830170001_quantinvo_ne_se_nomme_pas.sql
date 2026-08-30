-- Quantinvo parle d'une seule voix (30 août 2026).
--
-- Défaut vu sur un e-mail réel : la réponse d'un administrateur Quantinvo à
-- une entreprise cliente s'annonçait « Admin a répondu », et l'e-mail
-- promettait « votre réponse partira à <adresse personnelle> ». La règle
-- posée le matin même — « vu d'un client, un fil vers nous dit Quantinvo,
-- jamais les noms de nos administrateurs » — n'était appliquée qu'à la
-- LISTE des fils : ni les messages eux-mêmes, ni les e-mails ne la
-- tenaient. C'est une fuite d'identité interne, et un client qui répondrait
-- écrirait dans une boîte personnelle plutôt qu'à l'entreprise.
--
-- ⚠️ Le masque ne peut pas se poser à l'écriture : les autres administrateurs
-- Quantinvo doivent savoir lequel d'entre eux a répondu. Il se pose donc à la
-- LECTURE, selon qui lit. D'où `auteur_interne`, figé à l'écriture : le
-- drapeau survit à la suppression du compte, contrairement à une jointure sur
-- `profiles` qui rendrait null et démasquerait un nom qu'on veut cacher.

alter table public.messages
  add column auteur_interne boolean not null default false;

-- L'existant : les messages écrits par un administrateur Quantinvo.
update public.messages m
   set auteur_interne = true
  from public.profiles p
 where p.id = m.auteur and p.is_admin;

create or replace function public.ouvrir_fil(p_sujet text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_profil record;
  v_sujet  text := trim(coalesce(p_sujet, ''));
  v_msg    text := trim(coalesce(p_message, ''));
  v_portee text;
  v_fil    uuid;
  n        int;
begin
  select p.role, p.is_admin, p.is_company_admin, p.company_id, p.full_name
    into v_profil from public.profiles p where p.id = v_uid;
  if not found or v_profil.role is distinct from 'supervisor' then
    raise exception 'forbidden';
  end if;
  if v_profil.company_id is null then raise exception 'aucune_entreprise'; end if;
  if v_sujet = '' or v_msg = '' then raise exception 'message_vide'; end if;
  if length(v_sujet) > 120 or length(v_msg) > 2000 then raise exception 'message_trop_long'; end if;

  v_portee := case when v_profil.is_company_admin then 'quantinvo' else 'entreprise' end;

  insert into public.message_fils (sujet, portee, company_id, cree_par)
  values (v_sujet, v_portee, v_profil.company_id, v_uid)
  returning id into v_fil;

  insert into public.messages (fil_id, auteur, auteur_label, corps, auteur_interne)
  values (v_fil, v_uid, coalesce(v_profil.full_name, ''), v_msg,
          coalesce(v_profil.is_admin, false));

  insert into public.message_participants (fil_id, user_id, lu_le)
  values (v_fil, v_uid, now());

  insert into public.message_participants (fil_id, user_id)
  select v_fil, p.id from public.profiles p
   where p.id <> v_uid
     and case when v_portee = 'quantinvo'
              then p.is_admin
              else p.company_id = v_profil.company_id and p.is_company_admin
         end;
  get diagnostics n = row_count;

  if n = 0 then
    raise exception '%', case when v_portee = 'quantinvo'
                              then 'aucun_administrateur_quantinvo'
                              else 'aucun_administrateur' end;
  end if;

  return jsonb_build_object('success', true, 'fil_id', v_fil, 'destinataires', n);
end;
$$;

create or replace function public.repondre_fil(p_fil uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_nom     text;
  v_interne boolean;
  v_msg     text := trim(coalesce(p_message, ''));
begin
  if not exists (select 1 from public.message_participants p
                  where p.fil_id = p_fil and p.user_id = v_uid) then
    raise exception 'forbidden';
  end if;
  if v_msg = '' then raise exception 'message_vide'; end if;
  if length(v_msg) > 2000 then raise exception 'message_trop_long'; end if;

  select p.full_name, coalesce(p.is_admin, false)
    into v_nom, v_interne from public.profiles p where p.id = v_uid;

  insert into public.messages (fil_id, auteur, auteur_label, corps, auteur_interne)
  values (p_fil, v_uid, coalesce(v_nom, ''), v_msg, coalesce(v_interne, false));

  update public.message_fils set dernier_le = now() where id = p_fil;
  update public.message_participants set lu_le = now()
   where fil_id = p_fil and user_id = v_uid;

  return jsonb_build_object('success', true);
end;
$$;

-- ⚠️ `dernier_auteur` porte le même masque que `avec` : sans lui, la liste
-- affichait « Quantinvo » en interlocuteur et le nom de l'administrateur
-- juste en dessous, dans l'extrait.
create or replace function public.mes_fils()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(f order by f.dernier_le desc), '[]'::jsonb)
  from (
    select
      fi.id, fi.sujet, fi.portee, fi.dernier_le,
      (select c.name from public.companies c where c.id = fi.company_id) as entreprise,
      (select count(*) from public.messages m where m.fil_id = fi.id) as nb_messages,
      (select m.corps from public.messages m where m.fil_id = fi.id
        order by m.cree_le desc limit 1) as dernier_extrait,
      (select case
                when fi.portee = 'quantinvo' and m.auteur_interne
                     and not coalesce((select p.is_admin from public.profiles p
                                        where p.id = auth.uid()), false)
                  then 'Quantinvo'
                else coalesce(nullif(m.auteur_label, ''), 'Quelqu''un')
              end
         from public.messages m
        where m.fil_id = fi.id order by m.cree_le desc limit 1) as dernier_auteur,
      exists (select 1 from public.messages m
               where m.fil_id = fi.id
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
    order by fi.dernier_le desc
    limit 100
  ) f;
$$;

-- Et dans le fil ouvert : chaque message d'un administrateur Quantinvo se
-- lit « Quantinvo » chez le client, son vrai nom entre nous.
create or replace function public.ouvrir_message_fil(p_fil uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean;
  v_res   jsonb;
begin
  if not exists (select 1 from public.message_participants p
                  where p.fil_id = p_fil and p.user_id = v_uid) then
    raise exception 'forbidden';
  end if;

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
        from public.messages m where m.fil_id = fi.id), '[]'::jsonb)
  )
  into v_res
  from public.message_fils fi where fi.id = p_fil;

  update public.message_participants set lu_le = now()
   where fil_id = p_fil and user_id = v_uid;

  return v_res;
end;
$$;

-- Idem pour la cloche : le « de » d'un fil vers Quantinvo.
create or replace function public.mes_notifications()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with moi as (
    select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) as admin
  ),
  notifs as (
    select n.id::text as id, n.type, n.donnees, n.created_at,
           n.read_at is not null as lu
      from public.notifications n
     where n.user_id = auth.uid()
       and n.type in ('invitation_inventaire', 'compteur_actif')
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
$$;

-- ── Ce que l'e-mail a besoin de savoir ────────────────────────────────────
-- La fonction edge écrit le message : elle doit savoir s'il faut masquer
-- l'expéditeur (Quantinvo répondant à un client) et rappeler le sujet. Elle
-- l'appelle en clé de service, APRÈS le dépôt — jamais pour écrire.
create or replace function public.fil_pour_email(p_fil uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'sujet', fi.sujet,
    'portee', fi.portee,
    -- Les participants À PRÉVENIR et s'ils sont des nôtres : un client ne
    -- doit pas lire le nom de qui lui répond chez Quantinvo.
    'destinataires', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', mp.user_id,
               'interne', coalesce(p.is_admin, false)))
        from public.message_participants mp
        join public.profiles p on p.id = mp.user_id
       where mp.fil_id = fi.id), '[]'::jsonb)
  )
  from public.message_fils fi where fi.id = p_fil;
$$;

revoke execute on function public.ouvrir_fil(text, text) from public, anon;
grant execute on function public.ouvrir_fil(text, text) to authenticated, service_role;
revoke execute on function public.repondre_fil(uuid, text) from public, anon;
grant execute on function public.repondre_fil(uuid, text) to authenticated, service_role;
revoke execute on function public.mes_fils() from public, anon;
grant execute on function public.mes_fils() to authenticated, service_role;
revoke execute on function public.ouvrir_message_fil(uuid) from public, anon;
grant execute on function public.ouvrir_message_fil(uuid) to authenticated, service_role;
revoke execute on function public.mes_notifications() from public, anon;
grant execute on function public.mes_notifications() to authenticated, service_role;
-- ⚠️ `fil_pour_email` rend des identifiants de participants : le serveur
-- seul, jamais un client.
revoke execute on function public.fil_pour_email(uuid) from public, anon, authenticated;
grant execute on function public.fil_pour_email(uuid) to service_role;
