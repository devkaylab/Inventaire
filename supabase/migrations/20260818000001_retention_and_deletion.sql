-- ─────────────────────────────────────────────────────────────────────────
-- Effacement et durées de conservation (constats E1 / E2 de l'audit du 13 août).
--
-- L'audit relevait que l'effacement d'un compte laissait l'identité derrière
-- lui. La cartographie de la base a montré pire : **l'effacement échoue**.
--
-- `counts.counted_by`, `article_audit.resolved_by`, `inventory_sessions.created_by`,
-- `session_invitations.created_by` et `team_invitations.created_by` référencent
-- `profiles` en NO ACTION. Comme `profiles` cascade depuis `auth.users`,
-- supprimer un compte ayant déjà compté déclenche une violation de clé
-- étrangère : la suppression est refusée. Aucun déclencheur ne nettoie en
-- amont — vérifié sur la base live, 5 profils sur 8 sont dans ce cas.
--
-- La politique de confidentialité promet cet effacement. Trois volets ici :
--   1. rendre la suppression possible, en détachant les comptages au lieu de
--      les détruire — le résultat d'inventaire appartient à l'entreprise ;
--   2. effacer l'identité résiduelle dans les demandes et invitations ;
--   3. poser des durées de conservation et la fonction qui les applique.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. La suppression détache, elle ne bloque plus ─────────────────────────
-- Converti dynamiquement : on reprend exactement les contraintes en NO ACTION
-- qui pointent vers `profiles`, sans en deviner les noms.

do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl, a.attname
      from pg_constraint c
      join unnest(c.conkey) k(attnum) on true
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.contype = 'f'
       and c.confrelid = 'public.profiles'::regclass
       and c.confdeltype = 'a'                      -- NO ACTION
  loop
    -- La colonne doit accepter NULL, sans quoi le détachement échouerait.
    execute format('alter table %s alter column %I drop not null', r.tbl, r.attname);
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      r.tbl, r.conname, r.attname);
    raise notice 'FK détachante : %.% ', r.tbl, r.attname;
  end loop;
end $$;

-- ── 2. L'identité résiduelle part avec le compte ───────────────────────────
-- `profiles` ne porte pas l'adresse électronique : elle vit dans `auth.users`.
-- Le déclencheur est donc posé là, en BEFORE DELETE, pour disposer encore de
-- l'adresse au moment du nettoyage.
--
-- Les demandes ne sont pas supprimées mais anonymisées : la trace de la
-- décision administrative reste (qui a validé quoi, quand), l'identité non.
-- L'adresse est remplacée par une valeur unique et invalide, pour ne pas
-- heurter l'index d'unicité de `supervisor_requests`.

create or replace function public.anonymize_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.supervisor_requests
     set first_name = '',
         last_name  = '',
         email      = 'compte-supprime+' || id::text || '@invalide.local',
         phone      = ''
   where user_id = old.id
      or lower(email) = lower(old.email);

  update public.company_requests
     set contact_first_name = '',
         contact_last_name  = '',
         contact_email      = 'compte-supprime+' || id::text || '@invalide.local',
         contact_phone      = ''
   where lower(contact_email) = lower(old.email);

  -- Une invitation n'a plus d'objet une fois le compte parti.
  delete from public.team_invitations    where lower(email) = lower(old.email);
  delete from public.session_invitations where lower(email) = lower(old.email);

  -- La demande de suppression elle-même ne conserve que sa trace horodatée.
  update public.account_deletion_requests
     set email = null, full_name = null
   where user_id = old.id;

  return old;
end;
$$;

revoke all on function public.anonymize_on_user_delete() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.anonymize_on_user_delete();

-- ── 3. Durées de conservation ──────────────────────────────────────────────
-- Les durées vivent ici, en un seul endroit, et nulle part ailleurs.
-- Elles sont volontairement courtes : ces tables ne servent qu'à instruire une
-- demande, pas à constituer un historique.
--
--   Invitations (équipe, inventaire) ...... 3 mois  → supprimées
--   Demandes superviseur traitées ......... 1 an    → anonymisées
--   Demandes entreprise rejetées .......... 1 an    → supprimées
--   Demandes entreprise (autres) .......... 3 ans   → contact anonymisé
--   Demandes de suppression de compte ..... 1 an    → supprimées
--
-- Les 3 ans reprennent la durée admise pour la prospection commerciale : une
-- demande de devis restée sans suite ne se garde pas indéfiniment.

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invitations_ttl        constant interval := interval '3 months';
  demandes_sup_ttl       constant interval := interval '1 year';
  demandes_ent_rej_ttl   constant interval := interval '1 year';
  demandes_ent_ttl       constant interval := interval '3 years';
  suppressions_ttl       constant interval := interval '1 year';
  rapport                jsonb := '{}'::jsonb;
  n                      int;
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

  return rapport || jsonb_build_object('execute_le', now());
end;
$$;

-- Purge automatique : jamais déclenchable par un client.
revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;

comment on function public.purge_expired_data() is
  'Applique les durées de conservation (constats E1/E2). À planifier quotidiennement.';

-- ── Planification ──────────────────────────────────────────────────────────
-- `pg_cron` est disponible sur le projet mais **pas installé** (vérifié).
-- L'activer est un geste d'infrastructure, laissé hors de cette migration pour
-- qu'elle reste rejouable sans effet de bord. Une fois l'extension activée :
--
--   select cron.schedule('purge-conservation', '30 3 * * *',
--                        $cron$ select public.purge_expired_data() $cron$);
--
-- Sans planificateur, la fonction reste appelable à la main en service_role —
-- ce qui suffit tant que les tables concernées sont vides ou presque.
