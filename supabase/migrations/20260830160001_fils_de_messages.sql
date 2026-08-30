-- Les fils de messages (30 août 2026, second jet).
--
-- Le premier jet livrait une liste de cartes : on lisait, on ne pouvait pas
-- répondre. Constat de Julien : « je ne peux rien faire avec ». Une boîte de
-- réception, c'est une CONVERSATION — un fil, des messages empilés, une
-- réponse qui revient à l'expéditeur.
--
-- Conséquence directe, et c'est le point : puisqu'on répond, TOUT LE MONDE a
-- une boîte. Un superviseur écrit à son administrateur et reçoit sa réponse ;
-- un administrateur d'entreprise écrit à Quantinvo et reçoit la nôtre. Le
-- « il écrit sans recevoir » du premier jet tombe avec le bouton Répondre.
--
-- Trois tables :
-- · `message_fils` — le sujet, la portée (vers l'entreprise / vers Quantinvo)
--   et la date du dernier message (le tri d'une boîte mail) ;
-- · `messages` — les messages du fil, auteur FIGÉ dans son libellé comme
--   partout ailleurs : un fil doit rester lisible après un départ ;
-- · `message_participants` — qui est dans le fil, et **où il en est de sa
--   lecture** (`lu_le`). L'état de lecture est PAR PERSONNE : deux
--   administrateurs d'une même entreprise lisent chacun de leur côté.
--
-- ⚠️ Aucune policy d'écriture : les fils naissent et vivent par des RPC
-- SECURITY DEFINER, qui portent les gardes de rôle et d'appartenance.

create table public.message_fils (
  id         uuid primary key default gen_random_uuid(),
  sujet      text not null,
  portee     text not null check (portee in ('entreprise', 'quantinvo')),
  company_id uuid references public.companies(id) on delete cascade,
  cree_par   uuid references public.profiles(id) on delete set null,
  cree_le    timestamptz not null default now(),
  dernier_le timestamptz not null default now()
);

create table public.messages (
  id           bigint generated always as identity primary key,
  fil_id       uuid not null references public.message_fils(id) on delete cascade,
  auteur       uuid references public.profiles(id) on delete set null,
  auteur_label text not null default '',
  corps        text not null,
  cree_le      timestamptz not null default now()
);

create table public.message_participants (
  fil_id  uuid not null references public.message_fils(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lu_le   timestamptz,
  primary key (fil_id, user_id)
);

create index messages_par_fil on public.messages (fil_id, cree_le);
create index fils_par_participant on public.message_participants (user_id);

alter table public.message_fils enable row level security;
alter table public.messages enable row level security;
alter table public.message_participants enable row level security;

create policy fils_select_participant on public.message_fils
  for select to authenticated
  using (exists (select 1 from public.message_participants p
                  where p.fil_id = message_fils.id and p.user_id = auth.uid()));

create policy messages_select_participant on public.messages
  for select to authenticated
  using (exists (select 1 from public.message_participants p
                  where p.fil_id = messages.fil_id and p.user_id = auth.uid()));

create policy participants_select_own on public.message_participants
  for select to authenticated
  using (user_id = auth.uid());

-- ── Ouvrir un fil ─────────────────────────────────────────────────────────
-- La portée se déduit du PROFIL, jamais d'un paramètre : un superviseur
-- ordinaire écrit aux administrateurs de son entreprise, un administrateur
-- d'entreprise écrit à Quantinvo. Mêmes bornes qu'avant — elles REFUSENT,
-- elles ne tronquent pas.
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

  insert into public.messages (fil_id, auteur, auteur_label, corps)
  values (v_fil, v_uid, coalesce(v_profil.full_name, ''), v_msg);

  -- L'auteur est participant, et son fil est lu : il vient de l'écrire.
  insert into public.message_participants (fil_id, user_id, lu_le)
  values (v_fil, v_uid, now());

  insert into public.message_participants (fil_id, user_id)
  select p.id from public.profiles p
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

-- ── Répondre dans un fil ──────────────────────────────────────────────────
-- Tout participant répond : c'est ce qui fait la conversation. La garde est
-- l'appartenance au fil, rien d'autre — pas de rôle, pas d'entreprise : on
-- répond à qui vous a écrit.
create or replace function public.repondre_fil(p_fil uuid, p_message text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_nom text;
  v_msg text := trim(coalesce(p_message, ''));
begin
  if not exists (select 1 from public.message_participants p
                  where p.fil_id = p_fil and p.user_id = v_uid) then
    raise exception 'forbidden';
  end if;
  if v_msg = '' then raise exception 'message_vide'; end if;
  if length(v_msg) > 2000 then raise exception 'message_trop_long'; end if;

  select p.full_name into v_nom from public.profiles p where p.id = v_uid;

  insert into public.messages (fil_id, auteur, auteur_label, corps)
  values (p_fil, v_uid, coalesce(v_nom, ''), v_msg);

  update public.message_fils set dernier_le = now() where id = p_fil;
  -- Répondre, c'est avoir lu.
  update public.message_participants set lu_le = now()
   where fil_id = p_fil and user_id = v_uid;

  return jsonb_build_object('success', true);
end;
$$;

-- ── La boîte : les fils, le plus récent d'abord ───────────────────────────
-- `avec` dit à qui l'on parle. ⚠️ Vu d'un client, un fil vers Quantinvo dit
-- « Quantinvo », jamais les noms de nos administrateurs : le produit ne
-- nomme pas son personnel à ses clients.
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
      (select coalesce(nullif(m.auteur_label, ''), 'Quelqu''un') from public.messages m
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

-- ── Un fil, ouvert : ses messages, et il devient lu ───────────────────────
-- ⚠️ Lire UN fil ne lit que lui : les autres gardent leur pastille, et les
-- invitations à un inventaire ne sont pas concernées du tout.
create or replace function public.ouvrir_message_fil(p_fil uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if not exists (select 1 from public.message_participants p
                  where p.fil_id = p_fil and p.user_id = v_uid) then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'id', fi.id,
    'sujet', fi.sujet,
    'portee', fi.portee,
    'entreprise', (select c.name from public.companies c where c.id = fi.company_id),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'auteur', coalesce(nullif(m.auteur_label, ''), 'Quelqu''un'),
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

revoke execute on function public.ouvrir_fil(text, text) from public, anon;
grant execute on function public.ouvrir_fil(text, text) to authenticated, service_role;
revoke execute on function public.repondre_fil(uuid, text) from public, anon;
grant execute on function public.repondre_fil(uuid, text) to authenticated, service_role;
revoke execute on function public.mes_fils() from public, anon;
grant execute on function public.mes_fils() to authenticated, service_role;
revoke execute on function public.ouvrir_message_fil(uuid) from public, anon;
grant execute on function public.ouvrir_message_fil(uuid) to authenticated, service_role;

-- ── La cloche compte les fils non lus ─────────────────────────────────────
-- Les messages quittent `notifications` : leur état de lecture vit désormais
-- sur le fil, et deux sources pour le même « lu » finiraient par diverger.
-- La cloche fait donc l'union — notifications d'un côté, fils non lus de
-- l'autre — et « tout marquer lu » ne touche QUE les notifications : lire sa
-- cloche n'est pas lire son courrier.
create or replace function public.mes_notifications()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with notifs as (
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
             'de', (select coalesce(nullif(m.auteur_label, ''), 'Quelqu''un')
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

revoke execute on function public.mes_notifications() from public, anon;
grant execute on function public.mes_notifications() to authenticated, service_role;

-- ── Les messages déjà reçus deviennent des fils ───────────────────────────
-- Rien ne se perd : chaque notification de message écrite ce jour devient un
-- fil avec son message et ses participants (l'auteur + tous ceux qui l'ont
-- reçue). Les lignes de notification, elles, sont supprimées : la boîte est
-- désormais la seule source.
do $$
declare
  g record;
begin
  for g in
    select donnees->>'de_id' as auteur_id,
           donnees->>'sujet'  as sujet,
           donnees->>'message' as corps,
           min(created_at) as le,
           max(type) as type,
           array_agg(user_id) as destinataires
      from public.notifications
     where type in ('message_superviseur', 'message_entreprise')
     group by 1, 2, 3
  loop
    declare
      v_fil uuid;
      v_cie uuid;
      v_nom text;
    begin
      select p.company_id, p.full_name into v_cie, v_nom
        from public.profiles p where p.id = g.auteur_id::uuid;

      insert into public.message_fils (sujet, portee, company_id, cree_par, cree_le, dernier_le)
      values (coalesce(g.sujet, '(sans sujet)'),
              case when g.type = 'message_entreprise' then 'quantinvo' else 'entreprise' end,
              v_cie, g.auteur_id::uuid, g.le, g.le)
      returning id into v_fil;

      insert into public.messages (fil_id, auteur, auteur_label, corps, cree_le)
      values (v_fil, g.auteur_id::uuid, coalesce(v_nom, ''), coalesce(g.corps, ''), g.le);

      insert into public.message_participants (fil_id, user_id, lu_le)
      values (v_fil, g.auteur_id::uuid, g.le)
      on conflict do nothing;

      insert into public.message_participants (fil_id, user_id)
      select v_fil, unnest(g.destinataires)
      on conflict do nothing;
    end;
  end loop;

  delete from public.notifications
   where type in ('message_superviseur', 'message_entreprise');
end $$;

-- ── Purge : la correspondance suit les journaux, un an ────────────────────
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  invitations_ttl      constant interval := interval '3 months';
  demandes_sup_ttl     constant interval := interval '1 year';
  demandes_ent_rej_ttl constant interval := interval '1 year';
  demandes_ent_ttl     constant interval := interval '3 years';
  suppressions_ttl     constant interval := interval '1 year';
  journal_admin_ttl    constant interval := interval '1 year';
  journal_entrep_ttl   constant interval := interval '1 year';
  demandes_mag_ttl     constant interval := interval '1 year';
  evenements_ttl       constant interval := interval '30 days';
  notifications_ttl    constant interval := interval '90 days';
  messages_ttl         constant interval := interval '1 year';
  rapport              jsonb := '{}'::jsonb;
  n                    int;
begin
  delete from public.team_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('team_invitations_supprimees', n);

  delete from public.session_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('session_invitations_supprimees', n);

  update public.supervisor_requests
     set first_name = '', last_name = '',
         email = 'expire+' || id::text || '@invalide.local', phone = ''
   where status in ('active', 'rejected')
     and created_at < now() - demandes_sup_ttl
     and email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('supervisor_requests_anonymisees', n);

  delete from public.company_requests
   where status = 'rejected' and updated_at < now() - demandes_ent_rej_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_supprimees', n);

  update public.company_requests
     set contact_first_name = '', contact_last_name = '',
         contact_email = 'expire+' || id::text || '@invalide.local', contact_phone = ''
   where updated_at < now() - demandes_ent_ttl
     and contact_email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_anonymisees', n);

  delete from public.account_deletion_requests where created_at < now() - suppressions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('deletion_requests_supprimees', n);

  delete from public.admin_audit_log where created_at < now() - journal_admin_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_admin_supprime', n);

  delete from public.company_audit_log where created_at < now() - journal_entrep_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_entreprise_supprime', n);

  delete from public.store_requests
   where handled_at is not null and handled_at < now() - demandes_mag_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('demandes_magasin_supprimees', n);

  delete from public.stripe_events_traites where recu_le < now() - evenements_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('evenements_stripe_supprimes', n);

  delete from public.notifications where created_at < now() - notifications_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('notifications_supprimees', n);

  -- Un fil se purge entier, sur la date de son DERNIER message : une
  -- conversation vivante ne perd pas son début.
  delete from public.message_fils where dernier_le < now() - messages_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('fils_supprimes', n);

  return rapport || jsonb_build_object('execute_le', now());
end;
$$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
