-- Continuité : ne pas verrouiller l'accès des superviseurs existants au moment du
-- passage « par magasin assigné ». On les affecte aux magasins des inventaires
-- qu'ils ont créés ou rejoints. Les autres affectations se font ensuite par l'admin.
insert into public.store_supervisors (store_id, user_id)
select distinct s.store_id, p.id
from public.inventory_sessions s
join public.profiles p on p.id = s.created_by and p.role = 'supervisor'
on conflict (store_id, user_id) do nothing;

insert into public.store_supervisors (store_id, user_id)
select distinct s.store_id, p.id
from public.session_members sm
join public.inventory_sessions s on s.id = sm.session_id
join public.profiles p on p.id = sm.user_id and p.role = 'supervisor'
on conflict (store_id, user_id) do nothing;
