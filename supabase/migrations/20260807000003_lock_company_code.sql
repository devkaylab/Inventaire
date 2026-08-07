-- Confidentialité du code entreprise : illisible via la clé publique. Seul l'admin
-- le consulte (RPC admin_list_companies) ; join_company le vérifie côté serveur.
revoke select on public.companies from anon, authenticated;
grant select (id, name, balise_count, created_at) on public.companies to anon, authenticated;

create or replace function public.admin_list_companies()
returns table(id uuid, name text, join_code text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select c.id, c.name, c.join_code, c.created_at
  from public.companies c order by c.created_at desc;
end; $function$;

revoke execute on function public.admin_list_companies() from public, anon;
grant execute on function public.admin_list_companies() to authenticated;
