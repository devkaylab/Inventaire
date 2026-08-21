-- Administrateur d'entreprise, acte 6 : l'e-mail dans la liste des membres.
--
-- Constat du test terrain (21 août 2026) : la pastille d'administrateur
-- d'entreprise n'affichait que le nom. Deux comptes homonymes deviennent
-- indiscernables — et la croix qui les suit révoque des droits. L'e-mail
-- lève l'ambiguïté avant le geste.
drop function if exists public.admin_list_company_members(uuid);
create or replace function public.admin_list_company_members(p_company_id uuid)
returns table(id uuid, full_name text, role text, is_company_admin boolean, email text)
language plpgsql
stable security definer
set search_path to 'public', 'auth'
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select p.id, p.full_name, p.role, p.is_company_admin,
         (select u.email::text from auth.users u where u.id = p.id)
  from public.profiles p
  where p.company_id = p_company_id and p.role = 'supervisor'
  order by p.full_name;
end;
$$;

revoke all on function public.admin_list_company_members(uuid) from public, anon;
grant execute on function public.admin_list_company_members(uuid) to authenticated, service_role;
