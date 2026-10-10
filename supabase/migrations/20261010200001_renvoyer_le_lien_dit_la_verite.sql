-- Renvoyer un lien à un membre de SON entreprise : la réponse dit la vérité.
--
-- ⚠️⚠️ **CE QUE LE SILENCE A COÛTÉ : UNE HEURE, ET DEUX FOIS LA CERTITUDE QUE
-- ÇA MARCHAIT.** Le 10 octobre 2026, Julien clique « Renvoyer le lien » sur
-- l'écran de l'administrateur. L'écran répond « Un lien vient de partir à
-- marc@… ». Rien ne part. Il réessaie par « Mot de passe oublié ». Même
-- réponse, même silence. La cause était ailleurs (un compte posé à la main,
-- sans `instance_id`, que le serveur d'authentification ne trouvait pas) — mais
-- **l'écran l'a caché deux fois**, et la seule trace était dans les journaux
-- du serveur.
--
-- ⚠️ **ET LE MUTISME DE `mot-de-passe-oublie` EST JUSTE — LÀ OÙ IL EST.**
-- Cette fonction est PUBLIQUE : répondre « compte inconnu » à un navigateur
-- ferait du formulaire un oracle d'énumération d'adresses (défaut fermé le
-- 28 août 2026). Elle répond donc toujours `{success: true, received: true}`,
-- et c'est l'e-mail — qui n'atteint que le propriétaire de la boîte — qui dit
-- la vérité. On n'y touche pas.
--
-- ⚠️ **MAIS L'ARGUMENT NE TIENT PAS POUR UN ADMINISTRATEUR.** Il a la liste de
-- son entreprise sous les yeux : il n'a aucune adresse à énumérer, il les voit
-- déjà. Le mutisme ne le protège de rien et lui cache tout. D'où ce chemin
-- SÉPARÉ, authentifié, qui ne vise qu'une personne DÉJÀ VISIBLE par l'appelant
-- et qui rend le détail. Deux chemins, deux publics, deux réponses — plutôt
-- qu'un seul chemin qui mentirait à l'un pour protéger l'autre.
--
-- Comme toujours : la RPC décide, l'edge n'envoie. `renvoyer-le-lien` l'appelle
-- AVEC LE JETON DE L'APPELANT, donc sous `auth.uid()`.

create or replace function public.renvoyer_le_lien_au_membre(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_moi_company uuid;
  v_moi_admin boolean;
  v_moi_role text;
  v_role text;
  v_company uuid;
  v_nom text;
  v_prenom text;
  v_email text;
  v_fini boolean;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'code', 'non_authentifie',
                              'error', 'Non authentifié.');
  end if;

  select p.company_id, coalesce(p.is_company_admin, false), p.role
    into v_moi_company, v_moi_admin, v_moi_role
    from public.profiles p where p.id = v_uid;

  select p.company_id, p.role, p.full_name, p.first_name
    into v_company, v_role, v_nom, v_prenom
    from public.profiles p where p.id = p_user;

  -- ⚠️ MÊME ENTREPRISE, D'ABORD. C'est la borne qui compte : sans elle, un
  -- administrateur pourrait faire partir un lien de récupération vers la boîte
  -- de n'importe qui, sur simple identifiant.
  if v_company is null or v_moi_company is null or v_company <> v_moi_company then
    return jsonb_build_object('success', false, 'code', 'pas_autorise',
                              'error', 'Cette personne n’appartient pas à votre entreprise.');
  end if;

  -- ⚠️ ET LE DROIT SE CALCULE SUR LA LIGNE VISÉE, jamais sur un paramètre de
  -- l'appelant : l'administrateur couvre toute l'entreprise, le superviseur
  -- seulement les compteurs des magasins qu'il supervise. C'est exactement ce
  -- que les deux écrans montrent — ni plus, et surtout pas moins, sinon un
  -- bouton visible ouvrirait sur un refus.
  if not v_moi_admin then
    if coalesce(v_moi_role, '') <> 'supervisor'
       or coalesce(v_role, '') <> 'employee'
       or not exists (
            select 1 from public.store_team st
             join public.store_supervisors ss
               on ss.store_id = st.store_id and ss.user_id = v_uid
            where st.user_id = p_user)
    then
      return jsonb_build_object('success', false, 'code', 'pas_autorise',
                                'error', 'Vous n’avez pas accès à cette personne.');
    end if;
  end if;

  select u.email::text,
         coalesce(u.raw_user_meta_data->>'mot_de_passe_cree', '') = 'true'
    into v_email, v_fini
    from auth.users u where u.id = p_user;

  if v_email is null or btrim(v_email) = '' then
    return jsonb_build_object('success', false, 'code', 'sans_adresse',
                              'error', 'Ce compte n’a pas d’adresse e-mail.');
  end if;

  -- ⚠️ SEULEMENT TANT QUE LE MOT DE PASSE N'EXISTE PAS, parce que c'est la
  -- seule chose que le bouton propose. Autoriser plus ferait de cet écran un
  -- moyen d'envoyer un lien de réinitialisation à un collègue qui n'a rien
  -- demandé — le droit suit le geste, pas l'inverse.
  if v_fini then
    return jsonb_build_object('success', false, 'code', 'compte_deja_fini',
                              'error', 'Cette personne a déjà créé son mot de passe.');
  end if;

  -- ⚠️ LE MÊME SEAU QUE LE FORMULAIRE PUBLIC (`reinitialisation`), et c'est
  -- voulu : sinon ce chemin authentifié deviendrait le contournement du quota
  -- de l'autre. Cinq par heure et par adresse.
  --
  -- ⚠️ Il vient APRÈS le contrôle de droit, à l'inverse du formulaire public.
  -- Là-bas l'ordre protégeait d'une énumération anonyme ; ici l'appelant est
  -- connu et déjà autorisé, et un refus de droit ne doit pas consommer le
  -- quota de la personne visée.
  if not public.rate_limit_ok('reinitialisation', v_email, 5, interval '1 hour') then
    return jsonb_build_object('success', false, 'code', 'trop_de_tentatives',
                              'error', 'Trop de liens demandés pour cette adresse dans la dernière heure.');
  end if;

  return jsonb_build_object('success', true, 'code', 'a_envoyer',
                            'email', v_email,
                            'nom', nullif(btrim(coalesce(v_nom, '')), ''),
                            'prenom', nullif(btrim(coalesce(v_prenom, '')), ''));
end;
$function$;

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC : on repose les droits dans la
-- même migration.
revoke all on function public.renvoyer_le_lien_au_membre(uuid) from public, anon;
grant execute on function public.renvoyer_le_lien_au_membre(uuid) to authenticated, service_role;
