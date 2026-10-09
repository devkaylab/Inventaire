-- ⚠️⚠️ LE RÔLE DANS UN INVENTAIRE NE SE CHOISIT PLUS : IL SE CALCULE (9 octobre 2026).
--
-- ⚠️⚠️ **CETTE MIGRATION TOUCHE QUANTINVO OS**, et de deux façons qu'il faut
-- connaître avant de l'appliquer :
--
--   · elle REMPLACE `ca_set_user_role`, une fonction d'OS (une instruction
--     ajoutée, le reste repris de `pg_get_functiondef`) ;
--   · elle pose un DÉCLENCHEUR sur `session_members`, une table d'OS.
--
-- ⚠️ Et ce n'est PAS le chantier On-Demand : c'est une règle de produit, que
-- Julien a demandée le 9 octobre. Elle vit sur la branche `on-demand` parce
-- que c'est là qu'on regroupe les changements jusqu'à la mise à jour unique de
-- l'app (fiche 109, « peut-on continuer sur le jumeau ? »), pas parce qu'elle
-- appartient à On-Demand. Le jour du rejeu, elle part avec le reste.
--
-- Julien : « ajouter une personne à son inventaire, je vois que l'on peut
-- choisir si c'est un compteur ou un co-superviseur. Sauf que normalement un
-- compteur ne peut pas être superviseur. […] Ajouter un compteur = compteur,
-- ajouter un superviseur = co-superviseur. Ajouter l'admin à son inventaire =
-- co-superviseur. »
--
-- ⚠️⚠️ **ET LA BASE N'ÉTAIT PAS BONNE, CONTRAIREMENT À CE QU'ON PENSAIT.**
-- Julien : « en base je pense que c'est bon ». Mesuré : non. La fonction edge
-- `invite-to-session` lisait le rôle **dans le corps de la requête** :
--
--     const role: Role = payload.role === 'supervisor' ? 'supervisor' : 'counter'
--
-- puis l'écrivait dans `session_members` avec la clé de service, donc **hors
-- RLS**. N'importe quel appel direct à l'API pouvait faire d'un compteur un
-- co-superviseur d'inventaire. Retirer le sélecteur des écrans aurait caché le
-- défaut sans le fermer : une porte fermée à l'écran seulement s'ouvre avec une
-- adresse.
--
-- D'où cette migration : **la règle vit en base, et aucun client ne peut en
-- sortir.** Les écrans n'ont plus à la connaître — ils affichent un fait.
--
-- ⚠️ CE QUE LA MESURE A AUSSI TROUVÉ, et qui n'était pas demandé : le
-- CRÉATEUR d'un inventaire était enregistré **compteur**. `create_session`
-- insère `(session_id, user_id)` sans rôle, et le défaut de la colonne est
-- `'counter'`. Une migration du 7 août 2026 avait corrigé les lignes existantes
-- (« where s.created_by = sm.user_id and sm.role <> 'supervisor' ») sans
-- corriger la fonction : le défaut est donc revenu à chaque inventaire créé
-- depuis. Le déclencheur ci-dessous le règle pour de bon, et sans rien
-- accorder — vérifié : AUCUNE policy ni fonction n'accorde quoi que ce soit sur
-- `session_members.role = 'supervisor'`. Ce rôle est un libellé, pas un droit.

-- ─── 1. La règle, à un seul endroit ────────────────────────────────────────
--
-- ⚠️ `is_company_admin` EST DANS LA RÈGLE bien qu'il soit aujourd'hui
-- redondant : `admin_promouvoir_admin_entreprise` passe déjà le rôle à
-- `supervisor` en promouvant. Mais c'est une coïncidence d'implémentation, pas
-- la demande de Julien — lui a dit « ajouter l'admin = co-superviseur ». Si un
-- jour un administrateur reste `employee`, la règle tient quand même.
create or replace function public.role_de_session(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select case
           when p.role = 'supervisor' or coalesce(p.is_company_admin, false)
           then 'supervisor'
           else 'counter'
         end
    from public.profiles p
   where p.id = p_user;
$function$;

revoke all on function public.role_de_session(uuid) from public, anon;
grant execute on function public.role_de_session(uuid) to authenticated, service_role;

-- ─── 2. Le déclencheur, qui rend la règle inatteignable ────────────────────
--
-- ⚠️ **IL ÉCRASE, IL NE REFUSE PAS, ET C'EST VOULU.** Lever une exception
-- obligerait chaque appelant à connaître la règle pour ne pas tomber dessus —
-- donc à la recopier, donc à en diverger un jour. Écraser veut dire : envoyez
-- ce que vous voulez, c'est la base qui décide. C'est aussi ce qui permet aux
-- écrans de **cesser d'envoyer un rôle**.
--
-- ⚠️ `before insert OR UPDATE` : la mise à jour compte autant que l'insertion.
-- Sans elle, un `upsert` (ce que fait `invite-to-session`) sur une ligne
-- existante contournerait le calcul.
--
-- ⚠️ Et sans profil — cas qui ne devrait pas exister — on ne promeut personne.
create or replace function public.session_members_role_suit_le_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.role := coalesce(public.role_de_session(new.user_id), 'counter');
  return new;
end;
$function$;

revoke all on function public.session_members_role_suit_le_profil()
  from public, anon, authenticated;

drop trigger if exists session_members_role_calcule on public.session_members;
create trigger session_members_role_calcule
  before insert or update on public.session_members
  for each row execute function public.session_members_role_suit_le_profil();

-- ─── 3. Les lignes déjà posées se remettent d'accord ───────────────────────
--
-- ⚠️ Le `where` n'est pas décoratif : sans lui, chaque ligne serait réécrite à
-- chaque rejeu de la migration, et l'historique de la table dirait des
-- changements qui n'ont pas eu lieu. Le `set role = …` lui-même est redondant
-- (le déclencheur recalcule), mais il rend la migration lisible sans connaître
-- le déclencheur.
update public.session_members sm
   set role = coalesce(public.role_de_session(sm.user_id), 'counter')
 where sm.role is distinct from coalesce(public.role_de_session(sm.user_id), 'counter');

-- ─── 4. Changer le rôle d'entreprise change celui des inventaires ──────────
--
-- ⚠️ SANS CETTE LIGNE, LA RÈGLE SERAIT VRAIE À L'AJOUT ET FAUSSE ENSUITE. Un
-- compteur promu superviseur resterait « compteur » dans les inventaires où il
-- est déjà, ce qui est exactement l'incohérence qu'on ferme — dans l'autre
-- sens. Un `update` suffit : le déclencheur recalcule.
--
-- ⚠️ La définition ci-dessous est celle qui TOURNE (md5
-- `2e985ad1f5a0c25e00b2439c01b017a7`), à UNE instruction près, reprise de
-- `pg_get_functiondef` et patchée — pas recopiée de mémoire.
CREATE OR REPLACE FUNCTION public.ca_set_user_role(p_user uuid, p_role text, p_store_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid;
  v_target  public.profiles%rowtype;
  v_role    text := btrim(coalesce(p_role, ''));
  v_ids     uuid[];
begin
  if not public.is_company_admin() then
    return json_build_object('success', false, 'error', 'Accès réservé à l''administrateur de l''entreprise.');
  end if;
  if v_role not in ('supervisor', 'employee') then
    return json_build_object('success', false, 'error', 'Rôle inconnu.');
  end if;
  if p_user is null or p_user = auth.uid() then
    return json_build_object('success', false, 'error', 'Vous ne pouvez pas changer votre propre rôle.');
  end if;

  select company_id into v_company from public.profiles where id = auth.uid();

  select * into v_target from public.profiles
   where id = p_user and company_id = v_company;
  if not found then
    return json_build_object('success', false, 'error', 'Personne introuvable dans votre entreprise.');
  end if;
  if v_target.is_company_admin then
    return json_build_object('success', false,
      'error', 'Ce compte est administrateur de l''entreprise : son rôle est géré par Quantinvo.');
  end if;
  if v_target.role = v_role then
    return json_build_object('success', true, 'already', true);
  end if;

  if v_role = 'supervisor' then
    if coalesce(array_length(p_store_ids, 1), 0) > 0 then
      select array_agg(st.id) into v_ids
        from public.stores st
       where st.company_id = v_company and st.id = any(p_store_ids);
    else
      select array_agg(stm.store_id) into v_ids
        from public.store_team stm
        join public.stores st on st.id = stm.store_id
       where stm.user_id = p_user and st.company_id = v_company;
    end if;

    if coalesce(array_length(v_ids, 1), 0) = 0 then
      return json_build_object('success', false,
        'error', 'Un superviseur a toujours au moins un magasin. Affectez-en un à cette personne avant de la promouvoir.');
    end if;

    insert into public.store_supervisors (store_id, user_id)
      select unnest(v_ids), p_user
      on conflict do nothing;
    delete from public.store_team stm
     using public.stores st
     where st.id = stm.store_id and st.company_id = v_company and stm.user_id = p_user;
  else
    select array_agg(ss.store_id) into v_ids
      from public.store_supervisors ss
      join public.stores st on st.id = ss.store_id
     where ss.user_id = p_user and st.company_id = v_company;

    if coalesce(array_length(v_ids, 1), 0) > 0 then
      insert into public.store_team (store_id, user_id)
        select unnest(v_ids), p_user
        on conflict do nothing;
    end if;
    delete from public.store_supervisors ss
     using public.stores st
     where st.id = ss.store_id and st.company_id = v_company and ss.user_id = p_user;
  end if;

  update public.profiles set role = v_role where id = p_user;

  -- ⚠️ LES INVENTAIRES SUIVENT. Le rôle dans un inventaire n'est plus un choix,
  -- c'est le rôle d'entreprise : il doit bouger avec lui.
  update public.session_members set role = public.role_de_session(p_user)
   where user_id = p_user;

  perform public.log_company_action(
    v_company,
    case when v_role = 'supervisor' then 'promu_superviseur' else 'retrograde_compteur' end,
    coalesce(v_target.full_name, ''),
    json_build_object('magasins', coalesce(array_length(v_ids, 1), 0))::jsonb);

  return json_build_object('success', true);
end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.ca_set_user_role(uuid, text, uuid[]) from public, anon;
grant execute on function public.ca_set_user_role(uuid, text, uuid[]) to authenticated, service_role;

-- ⚠️ `session_invitations.role` N'EST PAS TOUCHÉE, et il faut savoir pourquoi :
-- plus rien n'y insère. `invite-to-session` refuse une personne sans compte
-- depuis qu'un inventaire « ne se peuple pas d'inconnus », et son rôle ne
-- pourrait de toute façon pas se calculer — il n'y a pas de profil. Les lignes
-- restantes sont consommées par `handle_new_user` à l'inscription, qui insère
-- dans `session_members` : le déclencheur ci-dessus calcule alors le rôle du
-- profil tout neuf. La colonne est donc inerte, pas incohérente.
