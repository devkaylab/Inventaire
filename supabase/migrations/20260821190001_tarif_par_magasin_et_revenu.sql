-- Le revenu annuel récurrent, pour de vrai.
--
-- Le tableau de bord doit afficher le revenu (décision de Julien, 21 août
-- 2026). Plutôt que d'inscrire un montant en dur dans la page — il aurait
-- menti dès le premier client réel —, le tarif est posé en base.
--
-- La licence est par magasin, au volume de stock (1 200 / 2 400 / 3 900 /
-- 5 400 € par an) : le tarif appartient donc au magasin, pas à l'entreprise.
-- Tant qu'il n'est pas renseigné, le magasin compte pour le panier moyen de
-- travail (2 200 €) et le tableau de bord DIT combien de magasins sont ainsi
-- estimés — aucun chiffre ne doit passer pour exact sans l'être.
alter table public.stores
  add column if not exists annual_price_cents integer;

alter table public.stores
  add constraint stores_annual_price_positive
  check (annual_price_cents is null or annual_price_cents >= 0);

comment on column public.stores.annual_price_cents is
  'Licence annuelle de ce magasin, en centimes. NULL = pas encore négocié : le tableau de bord l''estime au panier moyen et le signale.';

create or replace function public.admin_set_store_price(p_store_id uuid, p_price_cents integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_store public.stores%rowtype;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  if p_price_cents is not null and p_price_cents < 0 then
    return json_build_object('success', false, 'error', 'Le tarif ne peut pas être négatif.');
  end if;

  update public.stores set annual_price_cents = p_price_cents
   where id = p_store_id
  returning * into v_store;
  if not found then
    return json_build_object('success', false, 'error', 'Magasin introuvable.');
  end if;

  perform public.log_admin_action('magasin_tarif_defini', 'magasin', p_store_id::text,
    coalesce(v_store.name, ''),
    json_build_object('tarif_annuel_cents', p_price_cents)::jsonb);

  return json_build_object('success', true);
end;
$$;

revoke all on function public.admin_set_store_price(uuid, integer) from public, anon;
grant execute on function public.admin_set_store_price(uuid, integer) to authenticated, service_role;

create or replace function public.admin_business_overview()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_debut_mois timestamptz := date_trunc('month', now());
  v_defaut_cents constant integer := 220000;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return json_build_object(
    'companies', (select count(*) from public.companies),
    'companies_new_month', (select count(*) from public.companies where created_at >= v_debut_mois),
    'stores', (select count(*) from public.stores),
    'arr_cents', (select coalesce(sum(coalesce(annual_price_cents, v_defaut_cents)), 0) from public.stores),
    'priced_stores', (select count(*) from public.stores where annual_price_cents is not null),
    'default_price_cents', v_defaut_cents,
    'active_stores_month', (
      select count(distinct s.store_id) from public.inventory_sessions s
       where s.created_at >= v_debut_mois and s.store_id is not null),
    'sessions_month', (select count(*) from public.inventory_sessions where created_at >= v_debut_mois),
    'counts_month', (select count(*) from public.counts where created_at >= v_debut_mois),
    'active_people_month', (select count(distinct counted_by) from public.counts
                             where created_at >= v_debut_mois and counted_by is not null),
    'companies_without_store', (
      select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::json)
        from public.companies c
       where not exists (select 1 from public.stores s where s.company_id = c.id)),
    'companies_without_admin', (
      select count(*) from public.companies c
       where not exists (select 1 from public.profiles p
                          where p.company_id = c.id and p.is_company_admin)),
    'idle_stores', (
      select coalesce(json_agg(json_build_object(
               'id', s.id, 'name', s.name, 'company_id', s.company_id,
               'company_name', c.name,
               'days', case when d.last is null then null
                            else floor(extract(epoch from now() - d.last) / 86400)::int end
             ) order by d.last nulls first), '[]'::json)
        from public.stores s
        join public.companies c on c.id = s.company_id
        cross join lateral (
          select max(x.created_at) as last from public.inventory_sessions x where x.store_id = s.id
        ) d
       where d.last is null or d.last < now() - interval '60 days'),
    'pending_deletions', (
      select count(*) from public.account_deletion_requests where status = 'pending')
  );
end;
$$;

revoke all on function public.admin_business_overview() from public, anon;
grant execute on function public.admin_business_overview() to authenticated, service_role;

create or replace function public.admin_company_detail(p_company_id uuid)
returns json
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $$
declare v json;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select json_build_object(
    'company', (select json_build_object('id', c.id, 'name', c.name,
                         'join_code', c.join_code, 'created_at', c.created_at)
                  from public.companies c where c.id = p_company_id),
    'stores', (select coalesce(json_agg(json_build_object(
                        'id', s.id, 'name', s.name, 'join_code', s.join_code,
                        'annual_price_cents', s.annual_price_cents,
                        'supervisor_ids', (select coalesce(json_agg(ss.user_id), '[]'::json)
                                             from public.store_supervisors ss
                                            where ss.store_id = s.id)
                      ) order by s.name), '[]'::json)
                 from public.stores s where s.company_id = p_company_id),
    'members', (select coalesce(json_agg(json_build_object(
                        'id', p.id, 'full_name', p.full_name, 'role', p.role,
                        'is_company_admin', p.is_company_admin,
                        'email', (select u.email::text from auth.users u where u.id = p.id),
                        'is_active', (select u.last_sign_in_at is not null
                                        from auth.users u where u.id = p.id)
                      ) order by p.is_company_admin desc, p.role desc, p.full_name), '[]'::json)
                 from public.profiles p where p.company_id = p_company_id),
    'invitations', (select coalesce(json_agg(json_build_object(
                        'id', i.id, 'email', i.email, 'role', i.role,
                        'first_name', i.first_name, 'last_name', i.last_name,
                        'created_at', i.created_at
                      ) order by i.created_at desc), '[]'::json)
                 from public.team_invitations i where i.company_id = p_company_id)
  ) into v;

  if v->'company' is null or v->>'company' is null then
    raise exception 'Entreprise introuvable.';
  end if;
  return v;
end;
$$;

revoke all on function public.admin_company_detail(uuid) from public, anon;
grant execute on function public.admin_company_detail(uuid) to authenticated, service_role;
