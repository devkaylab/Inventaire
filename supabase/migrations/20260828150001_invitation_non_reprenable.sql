-- ─────────────────────────────────────────────────────────────────────────
-- Une invitation ne change ni d'entreprise ni de rôle (28 août 2026).
--
-- Constat n°3 de la revue de sécurité. `team_invitations.email` est unique
-- **pour toute la base**, pas par entreprise. Or la fonction edge
-- `invite-teammate` écrivait sa ligne en `upsert` sur cette colonne, avec la
-- clé de service, sans regarder ce qu'il y avait avant — et **sans réécrire
-- `role`**, qui n'était pas dans ce qu'elle envoyait.
--
-- LE CHEMIN, en deux temps. S'il existe une invitation en attente pour
-- `bob@exemple.fr` avec `role = 'company_admin'` (posée par Quantinvo, ou par
-- l'administrateur d'une entreprise), un superviseur de **n'importe quelle
-- autre entreprise** peut ajouter cette même adresse à son équipe :
--
--   1. l'`upsert` bascule `company_id` sur la sienne ;
--   2. `role` n'est pas dans la charge, donc PostgREST ne le met pas à jour :
--      la valeur privilégiée survit à l'écrasement ;
--   3. `handle_new_user` honore la ligne à l'inscription — la personne devient
--      administrateur de l'entreprise de l'attaquant.
--
-- La fenêtre est étroite : il faut une invitation privilégiée dont le compte
-- `auth` n'a pas encore été créé, ce qui n'arrive que si l'envoi a échoué en
-- cours de route. Le geste correct existait déjà à côté — `ca_invite_supervisor`
-- refuse dès qu'une invitation existe pour l'adresse. `invite-teammate` ne
-- faisait pas ce contrôle.
--
-- LE VERROU. Deux invariants, posés là où rien ne les contourne :
--
--   · une invitation **ne change pas d'entreprise** ;
--   · une invitation **ne change pas de rôle**.
--
-- Les deux se défont de la même façon : on annule l'invitation, et on
-- réinvite. Un geste délibéré, tracé, plutôt qu'un effet de bord d'`upsert`.
--
-- ⚠️ CE DÉCLENCHEUR VAUT POUR TOUT LE MONDE, `service_role` COMPRIS — c'est
-- ce qui le distingue de `profiles_pin_privileged`, qui ne mord que sur
-- `authenticated` et `anon`. Ici le trou est précisément dans un chemin en
-- clé de service : le borner aux rôles clients ne fermerait rien. Ne pas y
-- ajouter de condition sur `current_user`.
--
-- CE QUE ÇA NE CASSE PAS, vérifié fonction par fonction avant d'écrire :
-- **aucune fonction du produit ne fait d'UPDATE sur `team_invitations`**.
-- `admin_invite_company_admin`, `ca_invite_supervisor` et
-- `invite_company_admin_after_payment` font des INSERT ; `handle_new_user`,
-- `ca_cancel_invitation`, `cancel_my_invitation` et les purges font des
-- DELETE. Le seul UPDATE du produit était cet `upsert` — celui qu'on ferme.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.team_invitations_figer_invariants()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.company_id is distinct from old.company_id then
    raise exception
      'Une invitation ne change pas d''entreprise. Annulez-la, puis réinvitez.'
      using errcode = 'check_violation';
  end if;
  if new.role is distinct from old.role then
    raise exception
      'Le rôle d''une invitation ne se change pas. Annulez-la, puis réinvitez.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

comment on function public.team_invitations_figer_invariants() is
  'Une invitation ne change ni d''entreprise ni de role (revue de securite du 28 aout 2026). Vaut pour tous les roles, service_role compris : le trou etait dans un chemin en cle de service.';

drop trigger if exists team_invitations_figees on public.team_invitations;

create trigger team_invitations_figees
  before update on public.team_invitations
  for each row
  execute function public.team_invitations_figer_invariants();
