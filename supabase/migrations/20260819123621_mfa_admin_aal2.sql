-- Les droits d'administration exigent le second facteur.
--
-- Jusqu'ici la garde n'existait que dans l'app web : une session ouverte au
-- mot de passe seul (aal1) conservait tous les droits côté serveur, et un
-- jeton obtenu ainsi permettait d'appeler directement les RPC d'administration
-- — créer une entreprise, valider un superviseur, supprimer un compte.
--
-- Les dix-huit fonctions `admin_*` passent toutes par `is_admin()` : c'est le
-- seul point à durcir, plutôt que dix-huit corps de fonction à réécrire.
--
-- L'exigence est **conditionnelle**, et c'est délibéré : elle ne vise que les
-- comptes ayant réellement un facteur vérifié. Un « aal2 obligatoire » pur
-- enfermerait dehors un administrateur ayant perdu son téléphone, et il
-- faudrait défaire cette migration pour le dépanner. Ici, la récupération se
-- fait en supprimant son facteur en service_role — il retrouve alors ses
-- droits au mot de passe seul, le temps de se réenrôler.
--
-- Non affectés : les comptes sans second facteur (comportement inchangé), les
-- superviseurs ordinaires (`is_admin` faux de toute façon), et `service_role`
-- (pas de `auth.uid()`, donc déjà faux avant cette migration).

create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (
         select 1 from auth.mfa_factors f
          where f.user_id = auth.uid() and f.status = 'verified'
       )
     )
$function$;

comment on function public.is_admin() is
  'Vrai si le compte est administrateur ET, lorsqu''il a un second facteur vérifié, que celui-ci a été présenté (aal2). Exigence conditionnelle : voir la migration 20260819000001.';
