-- L'espace de l'administrateur d'entreprise (22 août 2026).
--
-- Julien : « l'admin entreprise voit tout et tout le monde dans son entreprise,
-- il sait qui fait quoi (console comme admin Quantinvo), il gère les membres
-- quel que soit le niveau, il gère les magasins, il peut consulter et gérer les
-- inventaires. C'est le maître ; au-dessus de lui il y a l'admin Quantinvo. »
--
-- Trois manques constatés avant d'écrire :
--
--   1. **Il ne voyait pas les inventaires de son entreprise** auxquels il
--      n'avait pas été invité. Ses droits de clôture, de réouverture et de
--      suppression existaient déjà (migrations 20260821250001/2) — c'était la
--      *lecture* qui manquait.
--   2. **`company_audit_log` n'était affiché nulle part.** Il se remplit depuis
--      le 20 août à chaque action ; « il sait qui fait quoi » n'avait pourtant
--      aucun écran.
--   3. **Aucune vue d'ensemble** : son entreprise ne se lisait qu'en ouvrant
--      les inventaires un par un.

-- ── 1. Voir tous les inventaires de son entreprise ────────────────────────
--
-- Un seul point de passage à modifier, et c'est ce qui rend le geste sûr :
-- `is_session_participant` garde la policy de lecture des inventaires **et**
-- `can_access_session`, dont dépendent comptages, zones, audits, rapports,
-- membres. Une ligne ici ouvre tout, de façon cohérente ; l'alternative aurait
-- été d'ajouter « ou bien il est administrateur » dans une quinzaine de
-- policies, avec un oubli garanti quelque part.
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select public.is_admin() or exists (
    select 1 from public.inventory_sessions s
    where s.id = p_session_id
      and s.company_id = public.get_my_company()
      and (
        s.created_by = auth.uid()
        or public.is_company_admin(s.company_id)
        or exists (
          select 1 from public.session_members sm
          where sm.session_id = s.id and sm.user_id = auth.uid()
        )
      )
  );
$$;

-- Les droits sont reposés explicitement : `create or replace` les conserve,
-- mais cette fonction garde une policy de lecture — on ne laisse pas ça à une
-- hypothèse (leçon de la restauration de `get_session_activity`).
revoke all on function public.is_session_participant(uuid) from public, anon;
grant execute on function public.is_session_participant(uuid) to authenticated, service_role;

-- ── 2. La vue d'ensemble, rangée par magasin ──────────────────────────────
--
-- Miroir d'`admin_business_overview`, à l'échelle d'une entreprise, et rangée
-- comme la fiche entreprise de la console Quantinvo : les chiffres, puis un
-- bloc par magasin portant ce qui est à lui.
--
-- Ce que la fonction ne calcule pas, volontairement : l'avancement en
-- pourcentage. Il suppose de reparcourir zones et balises de chaque
-- inventaire ouvert (`get_zone_dashboard`), à chaque ouverture de la page —
-- exactement le motif retiré pour la tenue en charge le 21 août. On rend les
-- pièces comptées et l'attendu ; l'écran en tire une proportion quand
-- l'attendu existe.
create or replace function public.ca_company_overview()
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $$
declare v_company uuid; v_name text;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select p.company_id, c.name into v_company, v_name
    from public.profiles p left join public.companies c on c.id = p.company_id
   where p.id = auth.uid();

  return json_build_object(
    'company', json_build_object('id', v_company, 'name', coalesce(v_name, '')),

    'totals', (
      select json_build_object(
        'stores',            (select count(*) from public.stores s where s.company_id = v_company),
        'sessions_open',     (select count(*) from public.inventory_sessions x
                               where x.company_id = v_company and x.status <> 'closed'),
        'people',            (select count(*) from public.profiles p where p.company_id = v_company),
        'supervisors',       (select count(*) from public.profiles p
                               where p.company_id = v_company and p.role = 'supervisor'),
        'counters',          (select count(*) from public.profiles p
                               where p.company_id = v_company and p.role = 'employee'),
        -- « Actives aujourd'hui » se lit dans les comptages : c'est le travail
        -- réel, pas une présence déclarée.
        'active_today',      (select count(distinct c2.counted_by) from public.counts c2
                               join public.inventory_sessions s2 on s2.id = c2.session_id
                              where s2.company_id = v_company
                                and c2.created_at > now() - interval '1 day'),
        'pieces_month',      (select coalesce(sum(c3.qty), 0)::bigint from public.counts c3
                               join public.inventory_sessions s3 on s3.id = c3.session_id
                              where s3.company_id = v_company
                                and c3.created_at > now() - interval '30 days'),
        'sessions_month',    (select count(*) from public.inventory_sessions x
                               where x.company_id = v_company
                                 and x.created_at > now() - interval '30 days'),
        'store_requests',    (select count(*) from public.store_requests r
                               where r.company_id = v_company and r.status = 'pending'),
        -- Un compte invité qui n'a jamais choisi son mot de passe : il occupe
        -- une place dans l'équipe sans pouvoir travailler.
        'never_signed_in',   (select count(*) from public.profiles p
                               join auth.users u on u.id = p.id
                              where p.company_id = v_company and u.last_sign_in_at is null)
      )),

    'stores', (
      select coalesce(json_agg(bloc order by bloc ->> 'name'), '[]'::json) from (
        select json_build_object(
          'id', s.id,
          'name', s.name,
          'join_code', s.join_code,
          -- Les superviseurs affichés excluent les administrateurs : depuis le
          -- 22 août ils supervisent tous les magasins, les répéter partout ne
          -- dirait rien de qui tient réellement ce magasin.
          'supervisors', (
            select coalesce(json_agg(json_build_object('id', p.id, 'full_name', p.full_name)
                            order by p.full_name), '[]'::json)
              from public.store_supervisors ss
              join public.profiles p on p.id = ss.user_id
             where ss.store_id = s.id and not p.is_company_admin),
          'counters', (
            select count(*) from public.store_team st
             join public.profiles p2 on p2.id = st.user_id
            where st.store_id = s.id and p2.role = 'employee'),
          'counters_active', (
            select count(distinct c4.counted_by) from public.counts c4
             join public.inventory_sessions s4 on s4.id = c4.session_id
            where s4.store_id = s.id and c4.created_at > now() - interval '30 days'),
          'last_session_at', (
            select max(x.created_at) from public.inventory_sessions x where x.store_id = s.id),
          'sessions', (
            select coalesce(json_agg(json_build_object(
                     'id', x.id,
                     'name', coalesce(nullif(btrim(x.name), ''), x.inventory_number),
                     'inventory_number', x.inventory_number,
                     'status', x.status,
                     'uses_zones', x.uses_zones,
                     'created_at', x.created_at,
                     'closed_at', x.closed_at,
                     'created_by_label', (
                       select coalesce(nullif(btrim(pr.full_name), ''), '')
                         from public.profiles pr where pr.id = x.created_by),
                     'members', (select count(*) from public.session_members sm where sm.session_id = x.id),
                     'pieces', (select coalesce(sum(c5.qty), 0)::bigint from public.counts c5
                                 where c5.session_id = x.id),
                     'expected', (select coalesce(sum(t.theoretical_qty), 0)::bigint
                                    from public.theoretical_stock t where t.session_id = x.id),
                     'last_count_at', (select max(c6.created_at) from public.counts c6
                                        where c6.session_id = x.id)
                   ) order by (x.status <> 'closed') desc, x.created_at desc), '[]'::json)
              from public.inventory_sessions x
             where x.store_id = s.id
               -- Les inventaires ouverts, plus le dernier clôturé : au-delà,
               -- c'est l'onglet Inventaires qui déroule.
               and (x.status <> 'closed'
                    or x.id = (select y.id from public.inventory_sessions y
                                where y.store_id = s.id and y.status = 'closed'
                                order by y.closed_at desc nulls last limit 1)))
        ) as bloc
        from public.stores s
       where s.company_id = v_company
      ) t)
  );
end;
$$;

-- ── 3. Le journal de l'entreprise ─────────────────────────────────────────
-- La table existe depuis le 20 août et se remplit à chaque action ; il lui
-- manquait sa lecture, comme `admin_list_audit_log` l'assure côté Quantinvo.
create or replace function public.ca_list_audit_log(p_limit integer default 100)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  return (
    select coalesce(json_agg(json_build_object(
             'id', l.id,
             'created_at', l.created_at,
             'actor_id', l.actor_id,
             'actor_label', l.actor_label,
             'action', l.action,
             'target_label', l.target_label,
             'details', l.details
           ) order by l.id desc), '[]'::json)
      from (
        select * from public.company_audit_log
         where company_id = v_company
         order by id desc
         limit least(greatest(coalesce(p_limit, 100), 1), 500)
      ) l);
end;
$$;

-- ── 4. L'équipe se lit aussi personne par personne ────────────────────────
-- `ca_list_team` rendait déjà tout le monde ; il lui manquait de quoi répondre
-- à « qui fait quoi » : le dernier comptage et le nombre d'inventaires.
create or replace function public.ca_list_team()
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  return json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::json)
        from public.stores s where s.company_id = v_company),
    'members', (
      select coalesce(json_agg(json_build_object(
               'id', p.id,
               'full_name', p.full_name,
               'first_name', p.first_name,
               'last_name', p.last_name,
               'role', p.role,
               'is_company_admin', p.is_company_admin,
               'email', (select u.email::text from auth.users u where u.id = p.id),
               'is_active', (select u.last_sign_in_at is not null
                               from auth.users u where u.id = p.id),
               'last_count_at', (select max(c.created_at) from public.counts c
                                  where c.counted_by = p.id),
               'sessions_counted', (select count(distinct c2.session_id) from public.counts c2
                                     where c2.counted_by = p.id),
               'store_ids', case when p.role = 'supervisor' then
                 (select coalesce(json_agg(ss.store_id), '[]'::json)
                    from public.store_supervisors ss
                    join public.stores st on st.id = ss.store_id and st.company_id = v_company
                   where ss.user_id = p.id)
               else
                 (select coalesce(json_agg(stm.store_id), '[]'::json)
                    from public.store_team stm
                    join public.stores st on st.id = stm.store_id and st.company_id = v_company
                   where stm.user_id = p.id)
               end
             ) order by p.is_company_admin desc, p.role desc, p.full_name), '[]'::json)
        from public.profiles p where p.company_id = v_company),
    'invitations', (
      select coalesce(json_agg(json_build_object(
               'id', i.id, 'email', i.email,
               'first_name', i.first_name, 'last_name', i.last_name,
               'role', i.role, 'store_ids', coalesce(to_json(i.store_ids), '[]'::json),
               'created_at', i.created_at
             ) order by i.created_at desc), '[]'::json)
        from public.team_invitations i where i.company_id = v_company)
  );
end;
$$;

revoke all on function public.ca_company_overview() from public, anon;
revoke all on function public.ca_list_audit_log(integer) from public, anon;
revoke all on function public.ca_list_team() from public, anon;
grant execute on function public.ca_company_overview() to authenticated, service_role;
grant execute on function public.ca_list_audit_log(integer) to authenticated, service_role;
grant execute on function public.ca_list_team() to authenticated, service_role;
