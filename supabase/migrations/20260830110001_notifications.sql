-- Notifications de l'espace connecté (30 août 2026).
--
-- Trois événements, arrêtés sur la maquette du tableau de bord :
-- · « invitation reçue » — on vous a ajouté à un inventaire ;
-- · « compte activé » — un compteur de vos magasins s'est connecté pour la
--   première fois (la définition EXACTE d'is_active dans my_team_by_store :
--   last_sign_in_at non nul — les deux écrans doivent dire la même chose) ;
-- · « message reçu » — un superviseur écrit à l'administrateur de son
--   entreprise (déposé par deposer_message_admin, doublé d'un e-mail par la
--   fonction edge message-admin).
--
-- Décisions à ne pas défaire :
-- · AUCUNE policy d'écriture : les lignes naissent dans des déclencheurs et
--   des fonctions SECURITY DEFINER, le client ne fait que lire. Marquer lu
--   passe par une RPC — une policy UPDATE ouvrirait `donnees` à son porteur.
-- · Les libellés sont FIGÉS à l'écriture (nom de l'inventaire, du magasin,
--   de la personne) : une notification doit rester lisible après la
--   suppression de ce qu'elle raconte — même règle que les journaux.
-- · Le déclencheur d'inventaire ne notifie ni celui qui s'ajoute lui-même,
--   ni le créateur de l'inventaire.

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('invitation_inventaire', 'compteur_actif', 'message_superviseur')),
  donnees    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index notifications_par_personne
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- ── Invitation à un inventaire ─────────────────────────────────────────────
create or replace function public.notifier_ajout_inventaire()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session record;
  v_par     text;
begin
  select s.name, s.store_name, s.created_by
    into v_session
    from public.inventory_sessions s
   where s.id = new.session_id;
  if not found then return new; end if;

  -- On ne se notifie pas soi-même : ni celui qui se joint tout seul, ni le
  -- créateur (create_session l'inscrit comme membre).
  if new.user_id = auth.uid() or new.user_id = v_session.created_by then
    return new;
  end if;

  -- Qui invite : figé maintenant, si la session le dit. Les fonctions edge
  -- écrivent en clé de service (auth.uid() nul) : la phrase reste vraie
  -- sans nom.
  select p.full_name into v_par from public.profiles p where p.id = auth.uid();

  insert into public.notifications (user_id, type, donnees)
  values (new.user_id, 'invitation_inventaire', jsonb_build_object(
    'session_id', new.session_id,
    'nom', coalesce(nullif(v_session.name, ''), v_session.store_name),
    'magasin', v_session.store_name,
    'par', v_par
  ));
  return new;
end;
$$;

create trigger session_members_notifier
  after insert on public.session_members
  for each row execute function public.notifier_ajout_inventaire();

-- ── Première connexion d'un compteur ───────────────────────────────────────
create or replace function public.notifier_premiere_connexion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profil record;
begin
  select p.role, p.full_name into v_profil
    from public.profiles p where p.id = new.id;
  -- Seuls les compteurs : c'est l'événement « l'équipe est prête ». La
  -- première connexion d'un superviseur ne regarde personne.
  if not found or v_profil.role is distinct from 'employee' then
    return new;
  end if;

  insert into public.notifications (user_id, type, donnees)
  select distinct ss.user_id, 'compteur_actif', jsonb_build_object(
           'compteur_id', new.id,
           'nom', coalesce(v_profil.full_name, '')
         )
    from public.store_team st
    join public.store_supervisors ss on ss.store_id = st.store_id
   where st.user_id = new.id
     and ss.user_id <> new.id;
  return new;
end;
$$;

create trigger auth_users_notifier_premiere_connexion
  after update on auth.users
  for each row
  when (old.last_sign_in_at is null and new.last_sign_in_at is not null)
  execute function public.notifier_premiere_connexion();

-- ── Lire, marquer lu ───────────────────────────────────────────────────────
create or replace function public.mes_notifications()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'non_lues', (select count(*) from public.notifications n
                  where n.user_id = auth.uid() and n.read_at is null),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'type', n.type, 'donnees', n.donnees,
               'created_at', n.created_at, 'lu', n.read_at is not null
             ) order by n.created_at desc)
        from (select * from public.notifications
               where user_id = auth.uid()
               order by created_at desc limit 20) n
    ), '[]'::jsonb)
  );
$$;

create or replace function public.marquer_notifications_lues()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n int;
begin
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null;
  get diagnostics n = row_count;
  return jsonb_build_object('success', true, 'lues', n);
end;
$$;

-- ── Écrire à l'administrateur de son entreprise ────────────────────────────
-- La moitié « dépôt » du ticket : les notifications aux administrateurs
-- naissent ici, avec le jeton de l'appelant. L'e-mail part de la fonction
-- edge message-admin, qui appelle CETTE fonction d'abord — la clé de service
-- n'y sert qu'à lire les adresses APRÈS, jamais à écrire (règle de
-- ca-request-store). Les bornes REFUSENT, elles ne tronquent pas.
create or replace function public.deposer_message_admin(p_sujet text, p_message text)
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
  n        int;
begin
  select p.role, p.is_company_admin, p.company_id, p.full_name
    into v_profil from public.profiles p where p.id = v_uid;
  if not found or v_profil.role is distinct from 'supervisor' then
    raise exception 'forbidden';
  end if;
  if v_profil.is_company_admin then
    raise exception 'vous_etes_administrateur';
  end if;
  if v_profil.company_id is null then
    raise exception 'aucune_entreprise';
  end if;
  if v_sujet = '' or v_msg = '' then
    raise exception 'message_vide';
  end if;
  if length(v_sujet) > 120 or length(v_msg) > 2000 then
    raise exception 'message_trop_long';
  end if;

  insert into public.notifications (user_id, type, donnees)
  select p.id, 'message_superviseur', jsonb_build_object(
           'sujet', v_sujet,
           'message', v_msg,
           'de', coalesce(v_profil.full_name, ''),
           'de_id', v_uid
         )
    from public.profiles p
   where p.company_id = v_profil.company_id
     and p.is_company_admin
     and p.id <> v_uid;
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'aucun_administrateur';
  end if;

  return jsonb_build_object('success', true, 'destinataires', n);
end;
$$;

-- ── Droits — `create or replace` rend EXECUTE à PUBLIC, on repose tout ─────
revoke execute on function public.notifier_ajout_inventaire() from public, anon, authenticated;
revoke execute on function public.notifier_premiere_connexion() from public, anon, authenticated;
revoke execute on function public.mes_notifications() from public, anon;
grant execute on function public.mes_notifications() to authenticated, service_role;
revoke execute on function public.marquer_notifications_lues() from public, anon;
grant execute on function public.marquer_notifications_lues() to authenticated, service_role;
revoke execute on function public.deposer_message_admin(text, text) from public, anon;
grant execute on function public.deposer_message_admin(text, text) to authenticated, service_role;

-- ── La purge apprend les notifications : 90 jours, lu ou pas ───────────────
-- (Le corps est celui en production, plus le bloc notifications ; les durées
-- existantes ne bougent pas. Relire la politique de confidentialité si les
-- durées changent un jour — leçon du 28 août.)
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

  return rapport || jsonb_build_object('execute_le', now());
end;
$$;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
