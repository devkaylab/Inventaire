-- Annuler un comptage, ou recompter une balise à zéro — 8 septembre 2026
--
-- Décision de Julien : « celui qui rescanne le fait pour tout le monde, il ne
-- touche pas qu'à ses comptes, il touche au compte de la balise » — et le
-- geste doit exister pour un COMPTEUR, pas seulement pour un superviseur.
--
-- Deux fonctions, deux natures :
--
--   • `annuler_balise` ne détruit RIEN. Elle remet le cycle de la passe à
--     « pas commencé », pour qu'une balise ouverte par erreur ne reste pas
--     ouverte — une balise ouverte disparaît de la liste des balises à
--     reprendre, et ses pièces deviennent introuvables sans rescanner
--     l'étiquette. C'est le trou que `set_balise` laissait : elle ne sait
--     que « ouvert » et « terminé ».
--
--   • `vider_balise` détruit, et s'ouvre aux membres de la session.

-- ── 1. Annuler : la balise redevient à faire, rien n'est effacé ─────────────
create or replace function public.annuler_balise(
  p_session_id uuid, p_code text, p_mode text
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_key text; v_id uuid; v_name text; v_code text;
begin
  if p_mode not in ('count','audit') then
    return json_build_object('success', false, 'error', 'Mode invalide');
  end if;
  -- Même porte que `set_balise` : un compteur ouvre une balise, il doit
  -- pouvoir défaire cette ouverture.
  if not public.membre_ou_superviseur(p_session_id) then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if exists (select 1 from public.inventory_sessions s
             where s.id = p_session_id and s.status = 'closed') then
    return json_build_object('success', false, 'error', 'Inventaire clôturé');
  end if;
  v_key := public.norm_balise(p_code);
  if v_key = '' then
    return json_build_object('success', false, 'error', 'Balise invalide');
  end if;
  select z.id, z.name, z.code into v_id, v_name, v_code
  from public.zones z
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;
  if not found then
    return json_build_object('success', false, 'error', 'Balise non définie');
  end if;
  -- ⚠️ La passe COURANTE seulement. Annuler un audit ne défait pas le
  -- comptage : ce sont deux cycles distincts sur la même balise.
  if p_mode = 'count' then
    update public.zones set count_status = 'pending', count_done_at = null
    where id = v_id;
  else
    update public.zones set audit_status = 'pending', audit_done_at = null
    where id = v_id;
  end if;
  return json_build_object('success', true, 'code', v_code, 'name', v_name,
                           'mode', p_mode, 'status', 'pending');
end; $function$;

revoke all on function public.annuler_balise(uuid, text, text) from public, anon;
grant execute on function public.annuler_balise(uuid, text, text)
  to authenticated, service_role;

-- ── 2. Vider : ouverte aux membres, et bornée à une passe ───────────────────
--
-- ⚠️ **L'ANCIENNE SIGNATURE EST SUPPRIMÉE, ET C'EST OBLIGATOIRE.** `p_passe`
-- ayant un défaut, Postgres garderait les deux et un appel à deux arguments
-- deviendrait ambigu — le piège de `p_event_id` (28 août) et de
-- `ca_request_store` (22 août). Le site, lui, ne change pas : PostgREST
-- appelle par NOMS de paramètres, donc son appel à deux arguments continue de
-- vider la balise entière.
drop function if exists public.vider_balise(uuid, text);

create or replace function public.vider_balise(
  p_session_id uuid, p_code text, p_passe text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_key text; v_zone text; v_name text;
  v_company uuid; v_inv text;
  v_counts int; v_audits int; v_pieces numeric;
  v_pass int;
begin
  if p_passe is not null and p_passe not in ('count','audit') then
    return jsonb_build_object('success', false, 'error', 'Passe invalide');
  end if;
  v_pass := case p_passe when 'count' then 1 when 'audit' then 2 else null end;

  -- ⚠️ **DROIT ÉLARGI LE 8 SEPTEMBRE 2026, À LA DEMANDE DE JULIEN** :
  -- `can_access_session` (superviseurs) devient `membre_ou_superviseur`.
  -- Un compteur qui rouvre un rayon pour le refaire doit pouvoir en effacer
  -- le contenu — « celui qui rescanne le fait pour tout le monde ».
  --
  -- ⚠️ Ce que ce n'est PAS : le DELETE en masse fermé par VR-007 le 28 août.
  -- Là, le client choisissait son critère ; ici le périmètre est fixé par le
  -- serveur — UNE balise, nommée, d'un inventaire dont il est membre, non
  -- clôturé — et le geste laisse une trace dans `company_audit_log`. Ne
  -- jamais l'élargir à une liste de balises ni à un filtre libre.
  if not public.membre_ou_superviseur(p_session_id) then
    return jsonb_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select s.company_id, s.inventory_number into v_company, v_inv
  from public.inventory_sessions s
  where s.id = p_session_id and s.status <> 'closed';
  if not found then
    return jsonb_build_object('success', false, 'error', 'Inventaire clôturé');
  end if;
  v_key := public.norm_balise(p_code);
  if v_key = '' then
    return jsonb_build_object('success', false, 'error', 'Balise invalide');
  end if;
  select z.code, z.name into v_zone, v_name
  from public.zones z
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key
  for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Balise non définie');
  end if;

  select coalesce(sum(c.qty), 0) into v_pieces
  from public.counts c
  where c.session_id = p_session_id
    and public.norm_balise(coalesce(c.zone, '')) = v_key
    and (v_pass is null or c.pass_number = v_pass);
  delete from public.counts c
  where c.session_id = p_session_id
    and public.norm_balise(coalesce(c.zone, '')) = v_key
    and (v_pass is null or c.pass_number = v_pass);
  get diagnostics v_counts = row_count;

  -- ⚠️ `article_audit` est DÉRIVÉE de `counts` (`recompute_session_audit`) :
  -- ses lignes de la balise partent dans tous les cas, et le recalcul les
  -- reconstruira à partir de ce qui reste. L'empreinte s'efface avec elles,
  -- sans quoi le raccourci du recalcul conclurait que rien n'a bougé.
  delete from public.article_audit aa
  where aa.session_id = p_session_id
    and public.norm_balise(coalesce(aa.zone, '')) = v_key;
  get diagnostics v_audits = row_count;
  perform public.oublier_empreinte_audit(p_session_id);

  -- ⚠️ Seule la passe visée redevient à faire. Vider un audit ne remet pas
  -- le comptage en question.
  if v_pass = 1 then
    update public.zones z set count_status = 'pending', count_done_at = null
    where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;
  elsif v_pass = 2 then
    update public.zones z set audit_status = 'pending', audit_done_at = null
    where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;
  else
    update public.zones z
    set count_status = 'pending', audit_status = 'pending',
        count_done_at = null, audit_done_at = null
    where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;
  end if;

  insert into public.company_audit_log (company_id, actor_id, actor_label, action, target_label, details)
  values (
    v_company, auth.uid(),
    coalesce((select p.full_name from public.profiles p where p.id = auth.uid()), 'Compte supprimé'),
    'balise_videe', 'balise ' || v_zone,
    jsonb_build_object('inventaire', v_inv, 'emplacement', v_name,
                       'lignes', v_counts, 'audits', v_audits, 'pieces', v_pieces,
                       'passe', coalesce(p_passe, 'tout'))
  );
  return jsonb_build_object('success', true, 'code', v_zone,
                            'lignes', v_counts, 'pieces', v_pieces);
end; $function$;

revoke all on function public.vider_balise(uuid, text, text) from public, anon;
grant execute on function public.vider_balise(uuid, text, text)
  to authenticated, service_role;
