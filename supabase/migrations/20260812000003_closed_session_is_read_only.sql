-- Clôturer un inventaire doit réellement l'arrêter.
--
-- Jusqu'ici « Clôturer » appelait delete_session : tout était supprimé, donc la
-- question ne se posait pas. En séparant la clôture (statut 'closed', données
-- conservées) de la suppression, un trou apparaît : aucune policy d'insertion
-- sur `counts` ne regarde `inventory_sessions.status`. Un compteur resté sur
-- son téléphone continuerait donc à écrire des comptages dans un inventaire
-- clôturé, et le rapport téléchargé la veille ne correspondrait plus aux
-- données du lendemain.
--
-- On rejoue donc les deux policies d'insertion à l'identique, en ajoutant la
-- seule condition `s.status <> 'closed'`. Même chose dans set_balise, qui est
-- SECURITY DEFINER et n'est donc pas soumis aux policies.
--
-- Appliquée en base live via l'outil MCP apply_migration.

drop policy if exists counts_insert_member on public.counts;
create policy counts_insert_member on public.counts for insert
with check (
  counted_by = auth.uid()
  and exists (
    select 1 from public.session_members sm
    where sm.session_id = counts.session_id and sm.user_id = auth.uid()
  )
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id
      and s.status <> 'closed'
      and (
        (s.uses_zones and counts.pass_number >= 1 and counts.pass_number <= 3)
        or ((not s.uses_zones) and counts.pass_number = s.current_pass)
      )
  )
);

drop policy if exists counts_insert_supervisor on public.counts;
create policy counts_insert_supervisor on public.counts for insert
with check (
  counted_by = auth.uid()
  and public.get_my_role() = 'supervisor'
  and public.is_session_participant(counts.session_id)
  and exists (
    select 1 from public.inventory_sessions s
    where s.id = counts.session_id
      and s.status <> 'closed'
      and (
        (s.uses_zones and counts.pass_number >= 1 and counts.pass_number <= 3)
        or ((not s.uses_zones) and counts.pass_number = s.current_pass)
      )
  )
);

-- set_balise : même garde, message explicite côté application.
create or replace function public.set_balise(
  p_session_id uuid, p_code text, p_mode text, p_open boolean, p_allow_create boolean default false)
returns json
language plpgsql security definer set search_path to 'public' as $function$
declare v_key text; v_id uuid; v_name text; v_code text; v_new text;
begin
  if p_mode not in ('count','audit') then
    return json_build_object('success', false, 'error', 'Mode invalide');
  end if;
  if not (
    public.can_access_session(p_session_id)
    or exists (select 1 from public.session_members sm
               where sm.session_id = p_session_id and sm.user_id = auth.uid())
  ) then
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
    if p_open and p_allow_create then
      insert into public.zones (session_id, code) values (p_session_id, btrim(p_code))
        returning id, name, code into v_id, v_name, v_code;
    else
      return json_build_object('success', false, 'error', 'Balise non définie');
    end if;
  end if;
  v_new := case when p_open then 'open' else 'done' end;
  if p_mode = 'count' then
    update public.zones set count_status = v_new,
        count_done_at = case when p_open then null else now() end where id = v_id;
  else
    update public.zones set audit_status = v_new,
        audit_done_at = case when p_open then null else now() end where id = v_id;
  end if;
  return json_build_object('success', true, 'code', v_code, 'name', v_name,
                           'mode', p_mode, 'status', v_new);
end; $function$;

revoke all on function public.set_balise(uuid, text, text, boolean, boolean) from anon;
grant execute on function public.set_balise(uuid, text, text, boolean, boolean) to authenticated;
