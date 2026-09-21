-- La réinitialisation de mot de passe passe par Quantinvo, plus par Supabase.
--
-- ⚠️ **CONSTAT DE JULIEN, 20 SEPTEMBRE 2026, EN RECEVANT LE MESSAGE** : « c'est
-- un mail supabase qu'on reçoit, pas de quantinvo, il faut changer ça ».
-- L'application est en cours de publication : un client qui demande un nouveau
-- mot de passe reçoit aujourd'hui un message d'un expéditeur qu'il ne connaît
-- pas, sans logo, sans la charte, avec un lien à cliquer. C'est exactement la
-- forme d'un hameçonnage — et c'est nous qui l'envoyons.
--
-- ⚠️ **C'ÉTAIT LE SEUL COURRIEL DU PRODUIT HORS DU GABARIT.** Les douze autres
-- passent par `supabase/functions/_shared/email.ts` (fiche 012 : « un seul
-- gabarit »). Celui-ci partait de `supabase.auth.resetPasswordForEmail()`,
-- c'est-à-dire du serveur d'authentification, avec son propre modèle et son
-- propre expéditeur — hors du dépôt, hors des gardes, hors de la charte.
--
-- ⚠️ **CETTE FONCTION N'ENVOIE RIEN ET NE FABRIQUE AUCUN LIEN.** Le lien de
-- récupération ne peut venir que de l'API d'administration de Supabase
-- (`auth.admin.generateLink`), donc de la fonction edge. Ce qui est ici, c'est
-- ce qui doit vivre en base : la validation de l'adresse, le quota, et la
-- réponse détaillée que seul `service_role` peut lire.
--
-- Motif exact de `demander_code_email` et de `submit_company_request_detailed`.

-- ⚠️ **`service_role` SEUL, ET C'EST CE QUI PERMET DE RENDRE LE DÉTAIL.** La
-- réponse UNIFORME est le travail de la fonction edge : elle répond toujours la
-- même chose au navigateur, et c'est l'e-mail — qui n'atteint que le
-- propriétaire de la boîte — qui dit la vérité. Rendre `compte_inconnu` à un
-- navigateur ferait de ce formulaire un oracle d'énumération d'adresses.
create or replace function public.demander_reinitialisation(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_prenom text;
begin
  -- 1. La saisie d'abord : une faute de frappe ne doit pas consommer le quota
  --    de quelqu'un d'autre.
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('outcome', 'email_invalide');
  end if;
  if length(v_email) > 254 then           -- RFC 5321
    return jsonb_build_object('outcome', 'email_invalide');
  end if;

  -- 2. ⚠️ LE QUOTA AVANT LA RECHERCHE PAR ADRESSE. Un script ne doit pas
  --    pouvoir interroger la base autant qu'il veut avant d'être freiné :
  --    c'est l'ordre qui fait le contrôle (leçon du 28 août 2026).
  --
  --    ⚠️ CINQ PAR HEURE, comme le code d'inscription. Supabase appliquait sa
  --    propre limite ; en passant par l'API d'administration, on la perd —
  --    et une fonction publique sans quota est un envoi de courriel gratuit
  --    vers n'importe quelle adresse, signé Quantinvo.
  if not public.rate_limit_ok('reinitialisation', v_email, 5, interval '1 hour') then
    return jsonb_build_object('outcome', 'trop_de_tentatives');
  end if;

  -- 3. L'adresse existe-t-elle ? La réponse ne sort pas d'ici vers un
  --    navigateur : l'edge la garde pour elle et répond toujours pareil.
  select p.first_name into v_prenom
    from auth.users u
    left join public.profiles p on p.id = u.id
   where lower(u.email) = v_email
   limit 1;

  if not found then
    return jsonb_build_object('outcome', 'compte_inconnu');
  end if;

  return jsonb_build_object('outcome', 'a_envoyer', 'prenom', nullif(btrim(coalesce(v_prenom, '')), ''));
end;
$function$;

revoke all on function public.demander_reinitialisation(text) from public, anon, authenticated;
grant execute on function public.demander_reinitialisation(text) to service_role;
