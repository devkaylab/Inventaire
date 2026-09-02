-- Ce qui a été compté sur une balise, et de quoi le reprendre.
--
-- Demande de Julien, 2 septembre 2026 : « je veux pouvoir cliquer sur le numéro
-- de balise et voir ce qui a été compté dessus ». La fenêtre existait déjà
-- (elle sert à clôturer un cycle resté ouvert) ; elle ne disait pas ce qu'il y
-- avait dedans.

-- ── 1. Le détail ────────────────────────────────────────────────────────────
--
-- ⚠️ BORNÉE À UNE BALISE, et c'est tout l'objet de cette fonction.
-- `get_session_detail` produit déjà ce tableau, mais pour l'inventaire ENTIER :
-- le rapatrier au navigateur pour n'en montrer qu'un rayon est exactement le
-- motif retiré en août 2026 pour la tenue en charge (`getSessionCounts`, puis
-- `getCountTotals`). Ici la requête ne descend jamais que la balise regardée.
--
-- Les règles sont celles du reste du produit, à la lettre :
--  · comptage = passe 1, audit = passe 2, sommés par SKU ;
--  · une référence dont le solde est nul n'apparaît pas — `counts` est en ajout
--    pur, un article scanné puis entièrement corrigé a des lignes et zéro
--    pièce. Même filtre que `get_session_detail` ;
--  · `final_qty` accompagne la ligne quand un superviseur a arbitré : c'est la
--    quantité qui fera foi au rapport, elle ne peut pas être passée sous
--    silence ici.
--
-- ⚠️ L'ÉCART N'EST PAS CALCULÉ ICI. Tant que l'audit de la balise n'est pas
-- clôturé, une quantité auditée à zéro peut vouloir dire « l'auditeur n'a rien
-- trouvé » ou « l'auditeur n'est pas encore passé ». C'est déjà la règle de
-- `computeDiscrepancies`, qui refuse de conclure dans ce cas. La fonction rend
-- les deux quantités et le statut de l'audit ; l'écran décide s'il peut
-- soustraire.

create or replace function public.get_balise_detail(p_session_id uuid, p_code text)
returns table (
  sku text,
  ean text,
  brand text,
  label text,
  counted_qty numeric,
  audited_qty numeric,
  final_qty numeric,
  audit_status text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare v_key text; v_zone text; v_audit text;
begin
  if not public.can_access_session(p_session_id) then raise exception 'forbidden'; end if;

  v_key := public.norm_balise(p_code);
  if v_key = '' then return; end if;

  -- Le code tel qu'il est écrit en base : `counts.zone` porte la forme saisie,
  -- pas la forme normalisée. Comparer sur `norm_balise` des deux côtés serait
  -- un parcours de table ; on résout la balise une fois, puis on filtre dessus.
  select z.code, z.audit_status into v_zone, v_audit
  from public.zones z
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;
  if not found then return; end if;

  return query
  with c as (
    select c.sku as sku,
           c.pass_number as pass_number,
           sum(c.qty) as qty
    from public.counts c
    where c.session_id = p_session_id
      and public.norm_balise(coalesce(c.zone, '')) = v_key
    group by c.sku, c.pass_number
  ),
  cnt as (select c.sku as sku, c.qty as qty from c where c.pass_number = 1),
  aud as (select c.sku as sku, c.qty as qty from c where c.pass_number = 2),
  k as (select cnt.sku as sku from cnt union select aud.sku as sku from aud)
  select k.sku,
         a.ean, coalesce(a.brand, ''), coalesce(a.label, ''),
         coalesce(cnt.qty, 0)::numeric,
         coalesce(aud.qty, 0)::numeric,
         aa.final_qty,
         v_audit
  from k
  left join cnt on cnt.sku = k.sku
  left join aud on aud.sku = k.sku
  left join public.articles a
    on a.session_id = p_session_id and a.sku = k.sku
  left join public.article_audit aa
    on aa.session_id = p_session_id and aa.sku = k.sku and aa.zone = v_zone
  where coalesce(cnt.qty, 0) <> 0 or coalesce(aud.qty, 0) <> 0
  order by coalesce(nullif(a.label, ''), nullif(a.brand, ''), k.sku), k.sku;
end; $$;

revoke all on function public.get_balise_detail(uuid, text) from public, anon;
grant execute on function public.get_balise_detail(uuid, text) to authenticated, service_role;


-- ── 2. Vider une balise ─────────────────────────────────────────────────────
--
-- Le geste manquait : une balise comptée dans le mauvais rayon, ou un comptage
-- à reprendre de zéro, n'avait aucune sortie — il fallait corriger article par
-- article. Elle efface les comptages ET les audits de cette balise, puis remet
-- ses deux cycles à « pas commencé » : la balise redevient à faire.
--
-- ⚠️ CE N'EST PAS LA POLICY RETIRÉE PAR VR-007, et la différence est ce qui
-- rend ce geste acceptable. Ce qui a été fermé le 28 août 2026, c'est
-- `counts_delete_supervisor` : un DELETE **sur un critère choisi par le
-- client**, qui permettait d'effacer en masse les lignes de toute l'équipe.
-- Ici le périmètre est fixé par le serveur — une balise, entière, nommée —
-- exactement comme `delete_audit_line` est bornée à un SKU dans une zone.
-- Ne jamais l'élargir à une liste de balises ni à un filtre libre.
--
-- ⚠️ ET ELLE LAISSE UNE TRACE. L'aggravation relevée par VR-007 était que
-- `counts` n'est journalisée nulle part : la destruction ne se voyait pas
-- après coup. La ligne écrite dans `company_audit_log` porte l'inventaire, la
-- balise et ce qui a été effacé — l'administrateur de l'entreprise la lit
-- depuis /journal.
--
-- ⚠️ REFUSÉE SUR UN INVENTAIRE CLÔTURÉ. Son rapport est sorti, souvent
-- exporté : en effacer les comptages ferait bouger un document déjà remis.
-- `delete_audit_line`, écrite avant cette règle, ne fait pas ce contrôle.

create or replace function public.vider_balise(p_session_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text; v_zone text; v_name text;
  v_company uuid; v_inv text;
  v_counts int; v_audits int; v_pieces numeric;
begin
  if not public.can_access_session(p_session_id) then
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
    and public.norm_balise(coalesce(c.zone, '')) = v_key;

  delete from public.counts c
  where c.session_id = p_session_id
    and public.norm_balise(coalesce(c.zone, '')) = v_key;
  get diagnostics v_counts = row_count;

  delete from public.article_audit aa
  where aa.session_id = p_session_id
    and public.norm_balise(coalesce(aa.zone, '')) = v_key;
  get diagnostics v_audits = row_count;

  update public.zones z
  set count_status = 'pending', audit_status = 'pending',
      count_done_at = null, audit_done_at = null
  where z.session_id = p_session_id and public.norm_balise(z.code) = v_key;

  insert into public.company_audit_log (company_id, actor_id, actor_label, action, target_label, details)
  values (
    v_company,
    auth.uid(),
    coalesce((select p.full_name from public.profiles p where p.id = auth.uid()), 'Compte supprimé'),
    'balise_videe',
    'balise ' || v_zone,
    jsonb_build_object(
      'inventaire', v_inv, 'emplacement', v_name,
      'lignes', v_counts, 'audits', v_audits, 'pieces', v_pieces
    )
  );

  return jsonb_build_object('success', true, 'code', v_zone,
                            'lignes', v_counts, 'pieces', v_pieces);
end; $$;

revoke all on function public.vider_balise(uuid, text) from public, anon;
grant execute on function public.vider_balise(uuid, text) to authenticated, service_role;
