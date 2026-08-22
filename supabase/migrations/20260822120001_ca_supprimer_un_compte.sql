-- L'administrateur d'entreprise supprime les comptes de son entreprise.
--
-- Décision de Julien, 22 août 2026. Jusqu'ici il ne pouvait que *retirer les
-- accès* (`ca_remove_supervisor`) : le compte survivait, sans magasin ni
-- équipe, et sa suppression réelle supposait d'écrire à Quantinvo
-- (`admin_delete_user`). Pour une entreprise qui voit passer des saisonniers,
-- c'était une file d'attente chez nous pour un geste qui la regarde.
--
-- Trois bornes, arrêtées avec Julien le même jour :
--
--   1. **Compteurs et superviseurs**, jamais lui-même ni un autre
--      administrateur d'entreprise — ces deux cas restent chez Quantinvo,
--      comme c'est déjà la règle du retrait des accès. Sans cette borne, deux
--      administrateurs fâchés s'effacent l'un l'autre.
--   2. **La suppression réussit même si la personne a compté.** Les comptages
--      sont conservés et détachés (`on delete set null`, migration
--      20260818000001) : un inventaire clôturé garde ses chiffres justes, mais
--      son rapport ne dira plus qui a compté ces lignes. C'est le prix de
--      l'effacement, et c'est ce que promet la politique de confidentialité.
--      Refuser la suppression aux personnes ayant compté aurait vidé le droit
--      de son objet — la plupart des comptes ont compté.
--   3. **Immédiate.** Pas de délai de grâce : `pg_cron` n'est pas installé,
--      une suppression différée ne s'exécuterait jamais toute seule. Le geste
--      délibéré est demandé à l'écran (recopie du nom), pas au calendrier.
--
-- L'exigence aal2 conditionnelle voyage avec `is_company_admin()` : un
-- administrateur qui a activé la double authentification et dont la session
-- est restée au mot de passe seul se voit refuser la suppression par le
-- serveur, pas seulement par l'écran.

create or replace function public.ca_delete_user(p_user uuid)
returns json
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
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

  -- Identité figée avant la suppression : après, elle n'existe plus, et le
  -- journal doit rester lisible dans un an.
  select coalesce(nullif(btrim(v_target.full_name), ''), u.email::text, ''), u.email::text
    into v_label, v_email
    from auth.users u where u.id = p_user;

  -- Les clés étrangères détachent déjà (migration 20260818000001) ; on le dit
  -- explicitement, comme `admin_delete_user`, pour qu'une future contrainte
  -- posée en NO ACTION ne fasse pas échouer la suppression en silence.
  update public.counts             set counted_by = null where counted_by = p_user;
  update public.inventory_sessions set created_by = null where created_by = p_user;
  update public.team_invitations   set created_by = null where created_by = p_user;
  update public.article_audit      set resolved_by = null where resolved_by = p_user;

  -- Cascade : profil, affectations magasins et équipes, membres d'inventaire.
  -- Le déclencheur `on_auth_user_deleted` efface au passage l'identité
  -- résiduelle (demandes anonymisées, invitations en cours supprimées).
  delete from auth.users where id = p_user;

  perform public.log_company_action(v_company, 'compte_supprime',
    coalesce(v_label, ''),
    json_build_object('email', coalesce(v_email, ''), 'role', coalesce(v_target.role, ''))::jsonb);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.ca_delete_user(uuid) from public, anon;
grant execute on function public.ca_delete_user(uuid) to authenticated, service_role;
