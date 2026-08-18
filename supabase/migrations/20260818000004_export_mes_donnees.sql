-- M6, premier volet (audit du 13 août 2026) — droits d'accès et de
-- portabilité (articles 15 et 20 du RGPD).
--
-- Constat : la politique de confidentialité annonce ces droits, mais rien ne
-- permettait de les servir. À la main, sur ce schéma, répondre dans le délai
-- d'un mois était incertain.
--
-- Réponse : export_my_data(), appelable par la personne elle-même depuis la
-- page Mon compte du site. Elle renvoie en un JSON lisible tout ce qui est
-- rattaché à son compte. Deux limites assumées :
--
--   * Les LIGNES D'INVENTAIRE détaillées (chaque scan) sont traitées pour le
--     compte de l'employeur — responsable de traitement (voir le registre,
--     T4). L'export en donne le résumé par inventaire et renvoie la personne
--     vers son employeur pour le détail : ce n'est pas à Quantinvo de
--     divulguer les données d'exploitation d'un magasin.
--   * AUCUN CODE n'y figure (codes entreprise, magasin, sécurité) : ce sont
--     des secrets d'accès, pas des données de la personne.
create or replace function public.export_my_data()
returns jsonb
language plpgsql stable security definer set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'authentification requise';
  end if;
  select lower(u.email::text) into v_email from auth.users u where u.id = v_uid;

  return jsonb_build_object(
    'exporte_le', now(),
    'reference',
      'Copie des données associées à votre compte Quantinvo (articles 15 et 20 du RGPD).',
    'note_inventaires',
      'Le détail ligne à ligne des inventaires (chaque article scanné) est traité pour le compte de votre employeur, responsable de ce traitement : adressez-lui vos demandes le concernant. Ce document en donne le résumé.',

    'compte', (select jsonb_build_object(
        'email', u.email,
        'cree_le', u.created_at,
        'derniere_connexion', u.last_sign_in_at)
      from auth.users u where u.id = v_uid),

    'profil', (select jsonb_build_object(
        'prenom', p.first_name,
        'nom', p.last_name,
        'nom_affiche', p.full_name,
        'role', p.role,
        'administrateur', p.is_admin,
        'cree_le', p.created_at)
      from public.profiles p where p.id = v_uid),

    'entreprise', (select c.name
      from public.profiles p join public.companies c on c.id = p.company_id
      where p.id = v_uid),

    'magasins_equipe', coalesce((select jsonb_agg(s.name order by s.name)
      from public.store_team st join public.stores s on s.id = st.store_id
      where st.user_id = v_uid), '[]'::jsonb),

    'magasins_supervises', coalesce((select jsonb_agg(s.name order by s.name)
      from public.store_supervisors ss join public.stores s on s.id = ss.store_id
      where ss.user_id = v_uid), '[]'::jsonb),

    'inventaires', coalesce((select jsonb_agg(jsonb_build_object(
        'nom', coalesce(nullif(iss.name, ''), iss.store_name),
        'role', sm.role,
        'rejoint_le', sm.joined_at,
        'lignes_comptees', (select count(*) from public.counts c
                             where c.session_id = sm.session_id and c.counted_by = v_uid),
        'premiere_ligne', (select min(c.created_at) from public.counts c
                            where c.session_id = sm.session_id and c.counted_by = v_uid),
        'derniere_ligne', (select max(c.created_at) from public.counts c
                            where c.session_id = sm.session_id and c.counted_by = v_uid)
      ) order by sm.joined_at) from public.session_members sm
      join public.inventory_sessions iss on iss.id = sm.session_id
      where sm.user_id = v_uid), '[]'::jsonb),

    'audits_resolus', (select count(*) from public.article_audit aa
      where aa.resolved_by = v_uid),

    'invitations_recues', coalesce((select jsonb_agg(jsonb_build_object(
        'type', x.type, 'nom', x.full_name, 'recue_le', x.created_at) order by x.created_at)
      from (
        select 'equipe' as type, ti.full_name, ti.created_at
          from public.team_invitations ti where lower(ti.email) = v_email
        union all
        select 'inventaire', si.full_name, si.created_at
          from public.session_invitations si where lower(si.email) = v_email
      ) x), '[]'::jsonb),

    'demandes_acces_superviseur', coalesce((select jsonb_agg(jsonb_build_object(
        'prenom', sr.first_name, 'nom', sr.last_name, 'email', sr.email,
        'telephone', sr.phone, 'statut', sr.status,
        'deposee_le', sr.created_at, 'traitee_le', sr.reviewed_at) order by sr.created_at)
      from public.supervisor_requests sr
      where sr.user_id = v_uid or lower(sr.email) = v_email), '[]'::jsonb),

    'demandes_suppression_compte', coalesce((select jsonb_agg(jsonb_build_object(
        'statut', adr.status, 'deposee_le', adr.created_at) order by adr.created_at)
      from public.account_deletion_requests adr
      where adr.user_id = v_uid), '[]'::jsonb),

    'notifications', coalesce((select jsonb_agg(jsonb_build_object(
        'plateforme', pt.platform, 'enregistre_le', pt.updated_at))
      from public.push_tokens pt where pt.user_id = v_uid), '[]'::jsonb),

    -- Le journal d'administration parle de la personne dans deux cas : elle a
    -- agi (administrateur), ou une action l'a visée. Les deux la concernent.
    'journal_administration', coalesce((select jsonb_agg(jsonb_build_object(
        'action', j.action, 'cible', j.target_label, 'le', j.created_at,
        'en_tant_que', case when j.actor_id = v_uid then 'auteur' else 'personne visée' end)
        order by j.id)
      from public.admin_audit_log j
      where j.actor_id = v_uid or j.target_id = v_uid::text), '[]'::jsonb)
  );
end; $function$;

-- La personne authentifiée seulement — jamais le rôle anonyme.
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
