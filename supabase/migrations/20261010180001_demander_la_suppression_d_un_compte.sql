-- ⚠️⚠️ CETTE MIGRATION TOUCHE QUANTINVO OS.
--
-- Julien : « Julien a déjà finalisé son compte et je ne peux pas le supprimer
-- car je ne suis pas admin. Ce que je propose, un bouton demande de
-- suppression de profil qui sera envoyé à l'admin de l'entreprise, avec une
-- section commentaire. […] Tous les admins, notification et e-mail, et je veux
-- recevoir une notification comme ça a été fait. Motif obligatoire. »
--
-- Ce qui NE change pas : **supprimer un compte reste réservé à
-- l'administrateur d'entreprise**. Un superviseur demande ; il ne décide pas.
-- Une suppression est irréversible, et un compteur peut travailler pour
-- plusieurs superviseurs : celui qui tranche doit voir toute l'entreprise.

create table if not exists public.demandes_suppression_compte (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies(id) on delete cascade,
  -- ⚠️ `on delete set null`, PAS `cascade` : la cible EST ce qu'on va
  -- supprimer. En cascade, la demande disparaîtrait au moment précis où elle
  -- doit servir à prévenir son auteur.
  cible       uuid references public.profiles(id) on delete set null,
  -- D'où le nom figé : après la suppression, plus rien ne porte ce nom.
  cible_nom   text not null default '',
  demandeur   uuid references public.profiles(id) on delete set null,
  motif       text not null,
  etat        text not null default 'en_attente' check (etat in ('en_attente', 'traitee')),
  created_at  timestamptz not null default now(),
  traitee_le  timestamptz
);

create index if not exists demandes_suppression_en_attente
  on public.demandes_suppression_compte (company_id, etat, created_at desc);

alter table public.demandes_suppression_compte enable row level security;

-- ⚠️ AUCUNE POLICY PERMISSIVE, et des droits explicites. Depuis le 30 octobre
-- 2026 une table neuve ne reçoit plus l'accès de l'API toute seule ; ici c'est
-- voulu dans l'autre sens — la table ne se lit et ne s'écrit QUE par les
-- fonctions SECURITY DEFINER ci-dessous. Un client qui la lirait verrait les
-- motifs écrits sur ses collègues.
revoke all on public.demandes_suppression_compte from anon, authenticated;
grant select, insert, update, delete on public.demandes_suppression_compte to service_role;

-- Deux types de notification de plus : la demande, et son aboutissement.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('invitation_inventaire', 'compteur_actif', 'message_superviseur',
                  'message_entreprise', 'inventaire_volumineux', 'forfait_trop_juste',
                  'demande_suppression', 'demande_suppression_traitee'));

/**
 * Un superviseur demande la suppression d'un compte de son équipe.
 *
 * ⚠️ Les trois bornes sont vérifiées ICI, sur la LIGNE VISÉE, jamais sur un
 * paramètre de l'appelant : la personne doit être un compteur, de la même
 * entreprise, et présente dans un magasin que l'appelant supervise. Sans la
 * troisième, un superviseur demanderait la suppression de n'importe qui dans
 * l'entreprise.
 *
 * ⚠️ Le motif est OBLIGATOIRE (décision de Julien) : l'administrateur tranche
 * sur une suppression irréversible, il lui faut une raison écrite.
 */
create or replace function public.demander_suppression_compte(p_user uuid, p_motif text)
returns json
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_company uuid;
  v_motif  text := btrim(coalesce(p_motif, ''));
  v_cible  public.profiles%rowtype;
  v_nom    text;
  v_id     bigint;
  v_admins int;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Non authentifié.');
  end if;
  if v_motif = '' then
    return json_build_object('success', false, 'error', 'Indiquez le motif de la demande.');
  end if;
  if p_user = v_uid then
    return json_build_object('success', false, 'error', 'Vous ne pouvez pas demander la suppression de votre propre compte.');
  end if;

  select company_id into v_company from public.profiles where id = v_uid;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Réservé aux superviseurs.');
  end if;

  select * into v_cible from public.profiles
   where id = p_user and company_id = v_company and role = 'employee';
  if not found then
    return json_build_object('success', false, 'error', 'Compteur introuvable dans votre entreprise.');
  end if;

  if not exists (
    select 1 from public.store_team st
    join public.store_supervisors ss on ss.store_id = st.store_id
   where st.user_id = p_user and ss.user_id = v_uid
  ) then
    return json_build_object('success', false, 'error', 'Cette personne n''est dans aucun de vos magasins.');
  end if;

  -- Une demande en attente suffit : en empiler dix ne la rend pas plus urgente,
  -- et l'administrateur recevrait dix notifications pour un seul geste.
  if exists (select 1 from public.demandes_suppression_compte d
              where d.cible = p_user and d.etat = 'en_attente') then
    return json_build_object('success', false, 'code', 'deja_demandee',
      'error', 'Une demande est déjà en attente pour cette personne.');
  end if;

  select coalesce(nullif(btrim(v_cible.full_name), ''), u.email::text, '')
    into v_nom from auth.users u where u.id = p_user;

  insert into public.demandes_suppression_compte (company_id, cible, cible_nom, demandeur, motif)
  values (v_company, p_user, coalesce(v_nom, ''), v_uid, v_motif)
  returning id into v_id;

  -- ⚠️ TOUS les administrateurs de l'entreprise (décision de Julien) : un seul
  -- destinataire, et la demande dort pendant ses congés.
  insert into public.notifications (user_id, type, donnees)
  select p.id, 'demande_suppression', jsonb_build_object(
           'demande_id', v_id,
           'nom', coalesce(v_nom, ''),
           'motif', v_motif,
           'par', coalesce((select pr.full_name from public.profiles pr where pr.id = v_uid), '')
         )
    from public.profiles p
   where p.company_id = v_company and p.is_company_admin and p.id <> v_uid;
  get diagnostics v_admins = row_count;

  perform public.log_company_action(v_company, 'suppression_demandee',
    coalesce(v_nom, ''), json_build_object('motif', v_motif)::jsonb);

  return json_build_object('success', true, 'demande_id', v_id,
                           'administrateurs', v_admins, 'nom', coalesce(v_nom, ''));
end;
$function$;
revoke all on function public.demander_suppression_compte(uuid, text) from public, anon;
grant execute on function public.demander_suppression_compte(uuid, text) to authenticated, service_role;

/**
 * La suppression ferme la demande, et prévient celui qui l'a faite.
 *
 * ⚠️ **L'ORDRE EST TOUT** : on clôt et on notifie AVANT `delete from
 * auth.users`. Après, `cible` est nul (`on delete set null`) et le profil
 * n'existe plus — il ne resterait rien pour retrouver l'auteur de la demande.
 *
 * Le reste de la fonction est inchangé : les bornes, l'anonymisation des
 * colonnes qui pointent vers la personne, et le journal d'entreprise.
 */
create or replace function public.ca_delete_user(p_user uuid)
returns json
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_company uuid;
  v_target  public.profiles%rowtype;
  v_label   text;
  v_email   text;
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  if p_user is null then
    return json_build_object('success', false, 'error', 'Personne requise.');
  end if;
  if p_user = auth.uid() then
    return json_build_object('success', false, 'error', 'Vous ne pouvez pas supprimer votre propre compte.');
  end if;

  select company_id into v_company from public.profiles where id = auth.uid();

  select * into v_target from public.profiles
   where id = p_user and company_id = v_company;
  if not found then
    return json_build_object('success', false, 'error', 'Personne introuvable dans votre entreprise.');
  end if;
  if v_target.is_company_admin or coalesce(v_target.is_admin, false) then
    return json_build_object('success', false, 'error', 'Ce compte administrateur est géré par Quantinvo.');
  end if;

  select coalesce(nullif(btrim(v_target.full_name), ''), u.email::text, ''), u.email::text
    into v_label, v_email
    from auth.users u where u.id = p_user;

  -- ── Les demandes en attente, closes et annoncées ───────────────────────
  insert into public.notifications (user_id, type, donnees)
  select d.demandeur, 'demande_suppression_traitee', jsonb_build_object(
           'demande_id', d.id,
           'nom', coalesce(nullif(d.cible_nom, ''), v_label, '')
         )
    from public.demandes_suppression_compte d
   where d.cible = p_user and d.etat = 'en_attente'
     and d.demandeur is not null and d.demandeur <> auth.uid();

  update public.demandes_suppression_compte
     set etat = 'traitee', traitee_le = now()
   where cible = p_user and etat = 'en_attente';

  update public.counts             set counted_by = null where counted_by = p_user;
  update public.inventory_sessions set created_by = null where created_by = p_user;
  update public.team_invitations   set created_by = null where created_by = p_user;
  update public.article_audit      set resolved_by = null where resolved_by = p_user;

  delete from auth.users where id = p_user;

  perform public.log_company_action(v_company, 'compte_supprime',
    coalesce(v_label, ''),
    json_build_object('email', coalesce(v_email, ''), 'role', coalesce(v_target.role, ''))::jsonb);

  return json_build_object('success', true);
end;
$function$;
revoke all on function public.ca_delete_user(uuid) from public, anon;
grant execute on function public.ca_delete_user(uuid) to authenticated, service_role;
