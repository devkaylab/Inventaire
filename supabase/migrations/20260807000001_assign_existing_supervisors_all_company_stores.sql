-- Débloquer les superviseurs déjà existants au passage « par magasin assigné » :
-- chacun est affecté à tous les magasins de son entreprise (sinon il ne peut ni voir
-- ni créer d'inventaire). L'admin peut ensuite affiner depuis la console.
-- Idempotent. NB : une entreprise sans magasin (ex. Entreprise B) reste sans affectation
-- possible tant qu'un magasin n'a pas été créé.
insert into public.store_supervisors (store_id, user_id)
select st.id, p.id
from public.profiles p
join public.stores st on st.company_id = p.company_id
where p.role = 'supervisor'
on conflict (store_id, user_id) do nothing;
