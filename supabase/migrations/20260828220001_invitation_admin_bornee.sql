-- VR-003 — le paiement ne détruit plus l'invitation en attente d'un tiers.
--
-- `invite_company_admin_after_payment` faisait, avant d'insérer :
--
--     delete from public.team_invitations where lower(email) = v_email;
--
-- sans aucune borne d'entreprise. Toute invitation en attente portant cette
-- adresse était effacée, quelle que soit l'entreprise qui l'avait émise.
--
-- ⚠️ C'est la reprise d'invitation que le constat n°3 du 28 août a fermée, et
-- elle passe par la seule porte que le déclencheur `team_invitations_figees` ne
-- garde pas : celui-ci se réveille sur UPDATE, ce chemin fait DELETE + INSERT.
-- L'invariant était respecté à la lettre et contourné dans son intention.
--
-- Chemin d'atteinte : déposer une demande d'inscription en donnant comme
-- contact l'adresse d'une personne qui a une invitation en attente ailleurs,
-- puis payer. Son invitation disparaît, son entreprise n'en sait rien, et elle
-- attend un lien qui ne viendra jamais. La garde `if exists (… auth.users …)`
-- ne protège pas : une personne invitée et pas encore inscrite n'a justement
-- pas encore de compte. Le cas involontaire est le plus probable — un client
-- légitime dont l'adresse traîne une invitation ailleurs.
--
-- ⚠️ POURQUOI REFUSER, ET NON GARDER LES DEUX. `team_invitations.email` est
-- unique sur toute la base, et cette contrainte est porteuse :
-- `handle_new_user` retrouve l'invitation PAR L'ADRESSE pour décider du rôle et
-- de l'entreprise. Deux invitations pour une même adresse la rendraient
-- ambiguë — « laquelle choisir » sur une décision de privilège est exactement
-- le genre de trou qu'on ferme ailleurs. Cette contrainte ne se touche pas ;
-- c'est donc le DELETE qui doit céder, pas elle.
--
-- ⚠️ ET POURQUOI `success: false` PLUTÔT QU'UNE EXCEPTION. Le paiement est
-- encaissé et l'entreprise déjà créée quand cette fonction est appelée. Une
-- exception ferait échouer le webhook, donc rejouer Stripe indéfiniment. Le
-- webhook sait déjà traiter un refus sans 500 (`notes.push(…)`), et
-- l'anomalie remonte d'elle-même sur /admin : `companies_without_admin` la
-- range dans « À traiter ». Rien de nouveau à journaliser.

create or replace function public.invite_company_admin_after_payment(
  p_company uuid, p_email text, p_first text, p_last text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_by uuid;
begin
  if v_email = '' then return json_build_object('success', false, 'error', 'Adresse absente'); end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return json_build_object('success', false, 'error', 'account_exists');
  end if;

  -- ⚠️ Une invitation en attente ailleurs ne se reprend pas. On refuse, on ne
  -- l'efface pas — même règle que `ca_invite_supervisor` et `invite-teammate`.
  if exists (
    select 1 from public.team_invitations
     where lower(email) = v_email and company_id is distinct from p_company
  ) then
    return json_build_object('success', false, 'error', 'other_company');
  end if;

  select id into v_by from public.profiles where is_admin order by created_at limit 1;

  -- Borné à l'entreprise qui vient d'être payée. En pratique aucune ligne :
  -- l'entreprise vient de naître. C'est une précaution, pas un mécanisme.
  delete from public.team_invitations
   where lower(email) = v_email and company_id = p_company;

  insert into public.team_invitations
    (company_id, email, first_name, last_name, full_name, created_by, store_ids, role)
  values
    (p_company, v_email, btrim(p_first), btrim(p_last), btrim(btrim(p_first) || ' ' || btrim(p_last)),
     v_by, '{}', 'company_admin');
  return json_build_object('success', true, 'email', v_email);
end;
$function$;

-- `create or replace function` rend EXECUTE à PUBLIC. Cette fonction crée une
-- invitation `company_admin` : elle reste réservée au rôle serveur.
revoke all on function public.invite_company_admin_after_payment(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.invite_company_admin_after_payment(uuid, text, text, text) to service_role;
