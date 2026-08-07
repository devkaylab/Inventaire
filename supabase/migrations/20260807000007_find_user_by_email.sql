-- Retrouve un utilisateur (profil) par e-mail, en joignant auth.users.
-- Réservé à l'edge function invite-to-session (service_role). Interdit aux
-- rôles anon/authenticated pour éviter l'énumération d'adresses.
create or replace function public.find_user_by_email(p_email text)
returns table(user_id uuid, company_id uuid, role text, full_name text)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select p.id, p.company_id, p.role, p.full_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke execute on function public.find_user_by_email(text) from anon, authenticated;
grant execute on function public.find_user_by_email(text) to service_role;
