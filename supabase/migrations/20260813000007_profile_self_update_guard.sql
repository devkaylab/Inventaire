-- ─────────────────────────────────────────────────────────────────────────
-- Un membre ne doit pas pouvoir s'attribuer un rôle.
--
-- `profiles_update` n'a jamais eu que `using (id = auth.uid())`. Sans WITH
-- CHECK distinct, PostgreSQL réutilise cette expression pour la vérification :
-- la ligne d'arrivée doit rester la sienne, mais **rien ne fige son contenu**.
-- Un compteur pouvait donc exécuter
--
--   update profiles set role = 'supervisor' where id = auth.uid();
--
-- et devenir superviseur de son entreprise. Vérifié en base : 1 ligne,
-- role_devenu = supervisor.
--
-- La portée n'est pas totale — créer un inventaire exige en plus une
-- affectation dans `store_supervisors`, que cette bascule ne donne pas — mais
-- `get_my_role() = 'supervisor'` ouvre à lui seul l'annuaire du magasin et les
-- policies superviseur sur les inventaires où la personne est déjà membre.
--
-- On garde l'UPDATE ouvert (chacun doit pouvoir corriger son prénom et son
-- nom, notamment à la finalisation de son compte) mais on épingle les colonnes
-- de privilège par un trigger BEFORE UPDATE. Un trigger plutôt qu'un WITH
-- CHECK : comparer à l'ancienne ligne depuis une policy demanderait une
-- sous-requête sur `profiles` dont la sémantique en mise à jour multi-lignes
-- est piégeuse, là où `old` est explicite.
--
-- La contrainte ne vise que les rôles clients. `service_role`, `postgres` et
-- les fonctions SECURITY DEFINER (admin_*, handle_new_user) passent au
-- travers : ce sont elles qui ont légitimement à écrire ces colonnes.
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

-- SECURITY INVOKER (le défaut) est ici indispensable, pas un détail : dans une
-- fonction SECURITY DEFINER, `current_user` vaut le propriétaire de la
-- fonction, jamais l'appelant — le garde-fou ne se serait jamais déclenché.
-- Le trigger ne lit aucune table, il n'a besoin d'aucun privilège.
create or replace function public.profiles_pin_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    new.id         := old.id;
    new.role       := old.role;
    new.company_id := old.company_id;
    new.is_admin   := old.is_admin;
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_pin_privileged on public.profiles;
create trigger profiles_pin_privileged
  before update on public.profiles
  for each row execute function public.profiles_pin_privileged_columns();
