-- Le code de vérification se purge lui aussi (5 septembre 2026)
--
-- ⚠️ TROUVÉ EN RELISANT LA POLITIQUE DE CONFIDENTIALITÉ, pas par un test. Le
-- parcours d'inscription a introduit deux traitements de données personnelles
-- — le brouillon (`inscriptions`, purgé à trente jours dès le premier jour) et
-- le CODE de vérification (`codes_email`), qui n'avait AUCUNE purge. La ligne
-- porte une adresse e-mail : la table gardait indéfiniment celle de qui avait
-- seulement demandé un code, y compris sans jamais créer de compte.
--
-- La section 7 de `docs/privacy.html` énumère les durées et dit qu'elles
-- s'appliquent automatiquement. Elle en oubliait deux : c'est aussi faux qu'une
-- politique qui cache un manque. Les deux y sont désormais, et un test compare
-- ce qu'elle annonce à ce que la fonction fait.

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
  -- ⚠️ TRENTE JOURS, ET C'EST LA MOITIÉ D'UNE PAIRE. La troisième relance part
  -- à J+21 (`inscriptions_a_relancer`) : neuf jours de marge, pas davantage.
  -- Descendre cette valeur sans toucher au calendrier ferait partir un e-mail
  -- sur des réponses déjà effacées. Un test compare les deux.
  inscriptions_ttl     constant interval := interval '30 days';
  -- ⚠️ VINGT-QUATRE HEURES POUR UN CODE, et c'est déjà généreux : il vaut dix
  -- minutes. La ligne porte une adresse e-mail — donc une donnée personnelle —
  -- et rien ne justifiait qu'elle survive à la journée. Sans cette purge, la
  -- table gardait indéfiniment l'adresse de qui a seulement DEMANDÉ un code.
  codes_email_ttl      constant interval := interval '24 hours';
  notifications_ttl    constant interval := interval '90 days';
  messages_ttl         constant interval := interval '1 year';
  appareils_ttl        constant interval := interval '7 days';
  appareils_jour_ttl   constant interval := interval '13 months';
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

  delete from public.message_fils where dernier_le < now() - messages_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('fils_supprimes', n);

  delete from public.appareils_actifs where vu_le < now() - appareils_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_actifs_supprimes', n);

  delete from public.appareils_par_jour
   where jour < ((now() at time zone 'Europe/Paris')::date - appareils_jour_ttl);
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_par_jour_supprimes', n);

  -- Un brouillon d'inscription jamais déposé. Celui qui a abouti n'est plus un
  -- brouillon : il porte `demande_id`, et c'est la demande qui a sa propre
  -- durée (trois ans).
  delete from public.inscriptions
   where demande_id is null and created_at < now() - inscriptions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('inscriptions_abandonnees_supprimees', n);

  delete from public.codes_email where created_at < now() - codes_email_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('codes_email_supprimes', n);

  return rapport || jsonb_build_object('execute_le', now());
end;
$function$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
