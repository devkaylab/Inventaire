-- ⚠️⚠️ CETTE MIGRATION TOUCHE QUANTINVO OS.
--
-- Julien : « Je reçois une notif comme quoi Julien s'est connecté et que son
-- compte est prêt alors qu'il n'a juste reçu que le lien […] la notif doit
-- arriver uniquement quand Julien a finalisé son compte. »
--
-- ⚠️ **TROISIÈME VISAGE DU MÊME DÉFAUT EN UNE JOURNÉE.** Le badge, le bouton
-- « Renvoyer le lien », et maintenant la notification : tous les trois
-- suivaient « s'est connecté », parce que c'était le seul fait que la base
-- savait dire. Or **cliquer sur le lien d'invitation EST une connexion** :
-- `verifyOtp` pose `last_sign_in_at` avant que le mot de passe existe.
--
-- Mesuré : la notification pour « Julien Compteur » est partie le 10 octobre
-- 2026 à 05:44:42 — l'instant exact du premier clic sur « Continuer ». Trois
-- superviseurs ont appris qu'un compte était « prêt » alors qu'il ne l'était
-- pas, et la personne, elle, était bloquée.
--
-- Le marqueur `mot_de_passe_cree` (migration 20261010140001) dit enfin la
-- bonne chose. Le déclencheur le suit.

-- ⚠️ Le nom change aussi : « première connexion » décrivait le DÉCLENCHEUR,
-- pas le fait. C'est ce genre de nom qui fait écrire du code faux — il a déjà
-- coûté `a_un_mot_de_passe` le matin même. Rien d'autre que le déclencheur
-- n'appelait cette fonction, vérifié avant de la retirer.
drop trigger if exists auth_users_notifier_premiere_connexion on auth.users;
drop function if exists public.notifier_premiere_connexion();

create or replace function public.notifier_compte_finalise()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profil record;
begin
  select p.role, p.full_name into v_profil
    from public.profiles p where p.id = new.id;
  if not found or v_profil.role is distinct from 'employee' then
    return new;
  end if;

  insert into public.notifications (user_id, type, donnees)
  select distinct ss.user_id, 'compteur_actif', jsonb_build_object(
           'compteur_id', new.id,
           'nom', coalesce(v_profil.full_name, '')
         )
    from public.store_team st
    join public.store_supervisors ss on ss.store_id = st.store_id
   where st.user_id = new.id
     and ss.user_id <> new.id;
  return new;
end;
$function$;
revoke all on function public.notifier_compte_finalise() from public, anon, authenticated;

-- ⚠️ La condition porte sur le PASSAGE du marqueur, pas sur sa présence : sans
-- le `old`, chaque modification ultérieure du compte renverrait la même
-- notification. Et `coalesce` des deux côtés, parce qu'avant le marqueur la
-- clé est absente, pas fausse.
create trigger auth_users_notifier_compte_finalise
  after update on auth.users
  for each row
  when (coalesce(old.raw_user_meta_data->>'mot_de_passe_cree', '') <> 'true'
        and coalesce(new.raw_user_meta_data->>'mot_de_passe_cree', '') = 'true')
  execute function public.notifier_compte_finalise();
