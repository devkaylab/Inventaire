-- ⚠️ L'ADMINISTRATEUR D'ENTREPRISE PEUT RETIRER UN MEMBRE (5 octobre 2026).
--
-- Trouvé en vérifiant, pour le pilote du Groupe Bon Marché, qu'un
-- administrateur d'entreprise peut faire tout ce qu'un superviseur fait sur
-- les inventaires. Il le peut, sauf UNE chose — et c'était la dernière
-- fonction du produit à exiger d'être le créateur sans laisser passer
-- l'administrateur :
--
--   « Seul le créateur peut retirer un membre. »
--
-- Le cas réel : un superviseur crée l'inventaire, un compteur est parti ou
-- affecté au mauvais magasin, et l'administrateur ne peut pas l'en sortir. Il
-- peut SUPPRIMER l'inventaire entier — `delete_session` a l'échappatoire —
-- mais pas en retirer une personne. L'issue disponible était plus brutale que
-- le geste demandé.
--
-- ⚠️ L'ÉCHAPPATOIRE EST CELLE DE `delete_session`, MOT POUR MOT :
-- `public.is_company_admin(v_company)`. Deux règles d'accès qui disent la même
-- chose avec deux formulations divergent à la première correction portée sur
-- une seule des deux.
--
-- ⚠️ Et la protection du créateur reste : on ne retire pas le créateur de son
-- propre inventaire, quel que soit l'appelant. Sans lui, l'inventaire n'a plus
-- personne pour le clôturer.
--
-- ⚠️ AUCUNE MISE À JOUR DE L'APPLICATION N'EST NÉCESSAIRE. La signature ne
-- bouge pas — `(p_session_id uuid, p_user_id uuid)` — et l'app comme le site
-- appellent la même fonction. La règle vit en base : les téléphones déjà
-- installés la prennent sans passer par Apple.

create or replace function public.remove_session_member(p_session_id uuid, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_creator uuid;
  v_company uuid;
begin
  select created_by, company_id into v_creator, v_company
    from public.inventory_sessions where id = p_session_id;
  if v_creator is null then
    return json_build_object('success', false, 'error', 'Inventaire introuvable');
  end if;

  if not (v_creator = auth.uid() or public.is_company_admin(v_company)) then
    return json_build_object('success', false,
      'error', 'Seul le créateur ou un administrateur de l''entreprise peut retirer un membre.');
  end if;

  if p_user_id = v_creator then
    return json_build_object('success', false, 'error', 'Impossible de retirer le créateur de l''inventaire.');
  end if;

  delete from public.session_members where session_id = p_session_id and user_id = p_user_id;
  return json_build_object('success', true);
end;
$function$;

-- `create or replace` rend EXECUTE à PUBLIC : on repose les droits.
revoke all on function public.remove_session_member(uuid, uuid) from public, anon;
grant execute on function public.remove_session_member(uuid, uuid) to authenticated, service_role;
