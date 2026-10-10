-- ⚠️⚠️ CETTE MIGRATION TOUCHE QUANTINVO OS.
--
-- Deux choses, demandées par Julien le 9 octobre 2026 au soir.
--
-- 1. « Le superviseur doit voir SON équipe en premier, puis celle de ses
--    collègues. Et il n'a pas le droit de retirer un membre d'une autre équipe
--    que la sienne. »
--
--    ⚠️ Ça RENVERSE une décision du 23 août 2026 (« option A ») : « le
--    superviseur d'un compteur n'existe pas en base, c'est le magasin qui relie
--    les deux ». Il n'existait donc AUCUNE trace de qui avait ajouté qui —
--    `team_invitations.created_by` le savait, mais la ligne est effacée dès que
--    le compte est créé. D'où `store_team.ajoute_par`.
--
--    Ce qui NE change pas : le magasin reste l'unité d'accès. Un superviseur
--    met qui il veut du magasin sur ses inventaires. On encadre toujours un
--    magasin ; on sait seulement, en plus, qui a fait entrer qui.
--
-- 2. ⚠️⚠️ `is_active` NE DIT PAS QUE LE MOT DE PASSE EXISTE — et c'est le
--    contresens qui a coûté un compte. Il vaut `last_sign_in_at is not null`,
--    or `verifyOtp` EST une connexion : cliquer « Continuer » sur le lien
--    d'invitation le pose, avant même que le mot de passe soit choisi.
--    Quelqu'un d'interrompu à cet instant précis passait donc « actif » :
--    le badge ambre disparaissait, et avec lui le bouton « Renvoyer le lien »
--    posé le 9 octobre. Celui qui en avait le plus besoin était le seul à ne
--    pas l'avoir. Le vrai signal est `encrypted_password`.
--    (Deuxième fois que cette colonne trompe : contresens déjà corrigé le
--    23 août 2026.)

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Qui a fait entrer qui
-- ──────────────────────────────────────────────────────────────────────────

-- ⚠️ `on delete set null` N'EST PAS DÉCORATIF : c'est la règle de départ de
-- Julien, tenue par le schéma. « Si un superviseur part, les compteurs passent
-- sous l'admin le temps qu'un nouveau superviseur reprenne l'équipe. » Un
-- `ajoute_par` nul veut dire exactement ça : rattaché au magasin, sans
-- superviseur, donc sous la responsabilité de l'administrateur.
alter table public.store_team
  add column if not exists ajoute_par uuid references public.profiles(id) on delete set null;

comment on column public.store_team.ajoute_par is
  'Qui a fait entrer cette personne dans ce magasin. NULL = plus de superviseur '
  'attitré : la personne est sous la responsabilité de l''administrateur '
  'd''entreprise, le temps qu''un superviseur reprenne l''équipe.';

-- Reprise de l'existant : on ne sait pas qui a ajouté qui, mais un magasin qui
-- n'a QU'UN superviseur ne laisse aucun doute. Les autres restent nuls — donc
-- à l'administrateur, ce qui est le repli sûr.
update public.store_team st
   set ajoute_par = seul.user_id
  from (select store_id, (array_agg(user_id))[1] as user_id
          from public.store_supervisors
         group by store_id
        having count(*) = 1) seul
 where seul.store_id = st.store_id
   and st.ajoute_par is null;

/**
 * ⚠️ LA RÈGLE EST POSÉE PAR UN DÉCLENCHEUR, PAS PAR CHAQUE APPELANT.
 *
 * Onze endroits insèrent dans `store_team` : l'inscription, l'onboarding, le
 * changement de rôle, l'arrivée sur un inventaire… Demander à chacun de porter
 * `ajoute_par`, c'est garantir qu'un oublié subsistera — et qu'un douzième
 * naîtra sans. Même leçon que `role_de_session` (fiche 123) : la base décide,
 * les appelants n'ont rien à savoir.
 *
 * ⚠️ L'ORDRE DES TROIS SOURCES COMPTE, et il suit la vérité :
 *   1. une invitation d'équipe en attente — son auteur est celui qui a fait
 *      entrer la personne. ⚠️ Elle est encore là : `handle_new_user` insère
 *      dans `store_team` AVANT de supprimer l'invitation ;
 *   2. une invitation à un inventaire, même raisonnement ;
 *   3. à défaut, l'appelant — un superviseur qui ajoute quelqu'un en direct.
 *      ⚠️ Jamais la personne elle-même : à l'inscription, `auth.uid()` EST le
 *      nouveau venu, et il se serait fait entrer tout seul.
 */
create or replace function public.store_team_ajoute_par()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare v_mail text;
begin
  if new.ajoute_par is not null then return new; end if;

  select lower(u.email::text) into v_mail from auth.users u where u.id = new.user_id;

  if v_mail is not null then
    select i.created_by into new.ajoute_par
      from public.team_invitations i
     where lower(i.email) = v_mail and i.created_by is not null
     limit 1;

    if new.ajoute_par is null then
      select si.created_by into new.ajoute_par
        from public.session_invitations si
       where lower(si.email) = v_mail and si.created_by is not null
       limit 1;
    end if;
  end if;

  if new.ajoute_par is null
     and auth.uid() is not null
     and auth.uid() <> new.user_id
     -- La clé étrangère exige un profil : sans lui, mieux vaut nul que l'échec
     -- d'une insertion qui n'a rien demandé.
     and exists (select 1 from public.profiles p where p.id = auth.uid())
  then
    new.ajoute_par := auth.uid();
  end if;

  return new;
end;
$function$;
-- ⚠️ `authenticated` EST EXPLICITEMENT RETIRÉ, et ce n'est pas superflu :
-- Supabase accorde EXECUTE à `authenticated` par défaut sur toute fonction
-- neuve, et un `revoke … from public, anon` ne l'enlève pas. Les treize
-- autres fonctions de déclencheur du produit sont fermées ; relevé le
-- 10 octobre 2026, ces deux-là étaient les seules ouvertes.
revoke all on function public.store_team_ajoute_par() from public, anon, authenticated;

drop trigger if exists store_team_ajoute_par on public.store_team;
create trigger store_team_ajoute_par
  before insert on public.store_team
  for each row execute function public.store_team_ajoute_par();

/**
 * La règle de départ, tenue elle aussi par la base.
 *
 * ⚠️ `on delete set null` sur la colonne ne couvre que la SUPPRESSION du
 * compte. Un superviseur qui perd simplement un magasin — « Retirer les
 * accès », passage en compteur, réaffectation — garderait son équipe dans un
 * magasin qu'il ne supervise plus. Ce déclencheur ferme ce cas, et couvre du
 * même coup les chemins qui n'existent pas encore.
 */
create or replace function public.store_team_rendre_a_l_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.store_team
     set ajoute_par = null
   where store_id = old.store_id and ajoute_par = old.user_id;
  return old;
end;
$function$;
-- ⚠️ `authenticated` EST EXPLICITEMENT RETIRÉ, et ce n'est pas superflu :
-- Supabase accorde EXECUTE à `authenticated` par défaut sur toute fonction
-- neuve, et un `revoke … from public, anon` ne l'enlève pas. Les treize
-- autres fonctions de déclencheur du produit sont fermées ; relevé le
-- 10 octobre 2026, ces deux-là étaient les seules ouvertes.
revoke all on function public.store_team_rendre_a_l_admin() from public, anon, authenticated;

drop trigger if exists store_supervisors_rend_son_equipe on public.store_supervisors;
create trigger store_supervisors_rend_son_equipe
  after delete on public.store_supervisors
  for each row execute function public.store_team_rendre_a_l_admin();

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Un superviseur ne retire que les siens
-- ──────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ LE REFUS EST ICI, PAS À L'ÉCRAN. Retirer le bouton aurait caché le défaut
 * sans le fermer : une porte fermée à l'écran seulement s'ouvre avec une
 * adresse (leçon de la fiche 123, payée sur `invite-to-session`).
 */
create or replace function public.remove_counter_from_store(p_user uuid, p_store_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_nom text;
  v_magasin text;
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Non authentifié.');
  end if;
  if p_user = v_uid then
    return json_build_object('success', false, 'error', 'Vous ne pouvez pas vous retirer vous-même.');
  end if;

  select s.company_id, s.name into v_company, v_magasin
    from public.stores s where s.id = p_store_id;
  if v_company is null then
    return json_build_object('success', false, 'error', 'Magasin introuvable.');
  end if;

  -- La vérification porte sur le magasin visé et sur la ligne visée, jamais
  -- sur un paramètre fourni par l'appelant.
  if public.is_company_admin(v_company) then
    null; -- l'administrateur retire n'importe qui de son entreprise
  elsif exists (select 1 from public.store_supervisors ss
                 where ss.store_id = p_store_id and ss.user_id = v_uid) then
    if not exists (select 1 from public.store_team st
                    where st.store_id = p_store_id
                      and st.user_id = p_user
                      and st.ajoute_par = v_uid) then
      return json_build_object('success', false,
        'error', 'Cette personne a été ajoutée par quelqu''un d''autre : seul l''administrateur de l''entreprise peut la retirer.');
    end if;
  else
    return json_build_object('success', false, 'error', 'Ce magasin n''est pas le vôtre.');
  end if;

  select p.full_name into v_nom from public.profiles p
   where p.id = p_user and p.company_id = v_company and p.role = 'employee';
  if v_nom is null then
    return json_build_object('success', false, 'error', 'Compteur introuvable dans ce magasin.');
  end if;

  delete from public.store_team
   where store_id = p_store_id and user_id = p_user;

  perform public.log_company_action(v_company, 'compteur_retire_du_magasin',
    coalesce(v_nom, ''), json_build_object('magasin', coalesce(v_magasin, ''))::jsonb);

  return json_build_object('success', true);
end;
$function$;
revoke all on function public.remove_counter_from_store(uuid, uuid) from public, anon;
grant execute on function public.remove_counter_from_store(uuid, uuid) to authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Ce que les deux écrans lisent
-- ──────────────────────────────────────────────────────────────────────────

/**
 * L'équipe d'un superviseur, magasin par magasin.
 *
 * ⚠️ Il voit TOUT LE MONDE dans ses magasins — c'est l'équipe du magasin, et
 * c'est ce qui lui permet de mettre n'importe qui sur ses inventaires. Ce que
 * `a_moi` ajoute, c'est de savoir qui il a fait entrer : lui seul peut les
 * retirer, et ils passent en tête.
 *
 * ⚠️ `a_un_mot_de_passe` À CÔTÉ DE `is_active`, ET PAS À SA PLACE : les deux
 * disent des choses différentes et toutes deux utiles. `is_active` = « s'est
 * déjà connecté ». `a_un_mot_de_passe` = « a fini son inscription ». Entre les
 * deux vit exactement la personne qu'on a perdue : elle a cliqué sur son lien,
 * donc elle s'est connectée, mais elle n'a jamais choisi son mot de passe.
 */
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
                          'a_un_mot_de_passe', (select coalesce(u.encrypted_password, '') <> ''
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

/**
 * L'annuaire de l'administrateur d'entreprise.
 *
 * Seul ajout : `a_un_mot_de_passe`. Le badge « Mot de passe à créer » et le
 * bouton « Renvoyer le lien » s'y accrochent désormais, au lieu de `is_active`
 * qui tombait dès le premier clic sur le lien.
 */
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
               'a_un_mot_de_passe', (select coalesce(u.encrypted_password, '') <> ''
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
