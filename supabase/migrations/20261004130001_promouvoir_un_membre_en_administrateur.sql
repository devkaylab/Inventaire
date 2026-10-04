-- ⚠️ PROMOUVOIR UN MEMBRE DEPUIS LA LISTE DES PERSONNES (4 octobre 2026).
--
-- Demande de Julien : « dans personnes ajoute moi un bouton pour promouvoir
-- en admin », puis « et inversement ».
--
-- Révoquer se faisait déjà par identifiant (`admin_revoke_company_admin`).
-- Promouvoir, non : il fallait RETAPER L'ADRESSE de quelqu'un qu'on a sous
-- les yeux, dans le formulaire « Nommer administrateur » — lequel sert
-- d'abord à inviter une personne qui n'a pas encore de compte. Deux gestes
-- asymétriques pour une bascule qui, elle, est symétrique.
--
-- ⚠️⚠️ **ET SURTOUT : PAS DE SECONDE FAÇON DE PROMOUVOIR.** Écrire ici un
-- second `update profiles set is_company_admin = true` aurait créé deux
-- fonctions sœurs faisant presque la même chose — et c'est précisément ce que
-- la discipline du projet interdit, parce qu'elles divergent à la première
-- correction portée sur une seule des deux. Le promoteur par identifiant
-- devient donc L'IMPLÉMENTATION UNIQUE, et `admin_invite_company_admin` —
-- qui travaille par adresse, et qui doit rester capable d'INVITER quelqu'un
-- sans compte — l'appelle pour sa branche de promotion.
--
-- Ce qu'une promotion fait, et qui ne change pas : le drapeau, plus la montée
-- en superviseur si la personne était compteur. Un administrateur
-- d'entreprise pilote, il ne reste pas simple compteur.

-- ─── 1. Le promoteur, par identifiant ──────────────────────────────────────
--
-- Le miroir exact de `admin_revoke_company_admin(p_user)` : même paramètre,
-- mêmes refus, même trace.
create or replace function public.admin_promouvoir_admin_entreprise(p_user uuid)
returns json
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_prof  public.profiles%rowtype;
  v_cname text;
  v_email text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select * into v_prof from public.profiles where id = p_user;
  if not found then
    return json_build_object('success', false, 'error', 'Ce compte n''a pas encore de profil.');
  end if;

  -- ⚠️ ADMINISTRATEUR *D'UNE ENTREPRISE* : sans entreprise, le drapeau ne
  -- veut rien dire et n'ouvrirait aucun écran.
  if v_prof.company_id is null then
    return json_build_object('success', false, 'error', 'Ce compte n''appartient à aucune entreprise.');
  end if;

  if v_prof.is_company_admin then
    return json_build_object('success', false, 'error', 'Ce compte est déjà administrateur de l''entreprise.');
  end if;

  select c.name into v_cname from public.companies c where c.id = v_prof.company_id;
  select lower(u.email::text) into v_email from auth.users u where u.id = p_user;

  -- Le drapeau, et au besoin la visibilité superviseur — un administrateur
  -- d'entreprise pilote, il ne reste pas simple compteur.
  update public.profiles
     set is_company_admin = true,
         role = case when role = 'employee' then 'supervisor' else role end
   where id = p_user;

  perform public.log_admin_action('admin_entreprise_promu', 'profil', p_user::text,
    coalesce(v_prof.full_name, ''),
    json_build_object('email', coalesce(v_email, ''), 'entreprise', coalesce(v_cname, ''))::jsonb);

  return json_build_object('success', true, 'mode', 'promoted',
    'full_name', coalesce(v_prof.full_name, ''));
end;
$function$;

-- ─── 2. Le chemin par adresse délègue, il ne recopie pas ───────────────────
--
-- ⚠️ SEULE LA BRANCHE DE PROMOTION CHANGE. Le reste — la validation de
-- l'adresse, le refus d'un compte appartenant à une AUTRE entreprise, et la
-- création d'une invitation pour quelqu'un sans compte — est repris mot pour
-- mot de la définition qui tourne. La vérification d'entreprise RESTE ICI :
-- le promoteur par identifiant ne connaît pas l'entreprise visée, et c'est
-- cet appelant-là qui en a une à comparer.
create or replace function public.admin_invite_company_admin(
  p_company uuid, p_email text, p_first_name text, p_last_name text)
returns json
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_first  text := btrim(coalesce(p_first_name, ''));
  v_last   text := btrim(coalesce(p_last_name, ''));
  v_uid    uuid;
  v_prof   public.profiles%rowtype;
  v_inv    public.team_invitations%rowtype;
  v_cname  text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;

  select name into v_cname from public.companies where id = p_company;
  if not found then
    return json_build_object('success', false, 'error', 'Entreprise introuvable.');
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;

  select u.id into v_uid from auth.users u where lower(u.email::text) = v_email;

  if v_uid is not null then
    select * into v_prof from public.profiles where id = v_uid;
    if not found then
      return json_build_object('success', false, 'error', 'Ce compte n''a pas encore de profil.');
    end if;
    if v_prof.company_id is distinct from p_company then
      return json_build_object('success', false, 'error', 'Ce compte appartient à une autre entreprise.');
    end if;

    -- ⚠️ UNE SEULE IMPLÉMENTATION DE LA PROMOTION, et c'est elle. « Déjà
    -- administrateur » est refusé là-bas, avec le même message.
    return public.admin_promouvoir_admin_entreprise(v_uid);
  end if;

  if v_first = '' or v_last = '' then
    return json_build_object('success', false, 'error', 'Prénom et nom sont requis.');
  end if;

  select * into v_inv from public.team_invitations where lower(email) = v_email limit 1;
  if v_inv.id is not null and v_inv.company_id is distinct from p_company then
    return json_build_object('success', false, 'error', 'Une invitation existe déjà pour une autre entreprise.');
  end if;

  -- Une invitation de la même entreprise est remplacée : c'est la plus
  -- récente volonté de l'administrateur qui fait foi.
  delete from public.team_invitations where lower(email) = v_email and company_id = p_company;
  insert into public.team_invitations
    (company_id, email, first_name, last_name, full_name, created_by, store_ids, role)
  values
    (p_company, v_email, v_first, v_last, btrim(v_first || ' ' || v_last),
     auth.uid(), '{}', 'company_admin');

  perform public.log_admin_action('admin_entreprise_invite', 'entreprise', p_company::text,
    btrim(v_first || ' ' || v_last),
    json_build_object('email', v_email, 'entreprise', coalesce(v_cname, ''))::jsonb);

  return json_build_object('success', true, 'mode', 'invited',
    'email', v_email, 'first_name', v_first, 'last_name', v_last);
end;
$function$;

-- ─── 3. Les droits ─────────────────────────────────────────────────────────
--
-- ⚠️ `create or replace` rend `EXECUTE` à `PUBLIC`. Les deux fonctions
-- vérifient `is_admin()` en première ligne, mais une porte fermée vaut mieux
-- qu'une porte gardée.
revoke all on function public.admin_promouvoir_admin_entreprise(uuid) from public, anon;
revoke all on function public.admin_invite_company_admin(uuid, text, text, text) from public, anon;
grant execute on function public.admin_promouvoir_admin_entreprise(uuid) to authenticated, service_role;
grant execute on function public.admin_invite_company_admin(uuid, text, text, text) to authenticated, service_role;
