-- Un inventaire clôturé n'appartient plus qu'à son créateur — 8 septembre 2026
--
-- Décision de Julien : *« une personne invitée à un inventaire qui a été
-- clôturé ne le voit plus […] ça n'a pas d'intérêt »*, puis *« seul le
-- créateur de l'inventaire peut le clôturer »*.
--
-- Constat de départ : `julien.thiong-kay@samaritaine.com` voyait encore
-- « LA Bruket », créé par Théo et clôturé le 13 août, sans rien pouvoir en
-- faire. Mesuré avant d'écrire : c'est la SEULE personne concernée
-- aujourd'hui, sur un seul inventaire.
--
-- ⚠️ **CE QUE LE CRÉATEUR ET L'ADMINISTRATEUR D'ENTREPRISE GARDENT.** Le
-- premier a fait l'inventaire ; le second voit tout ce qui appartient à son
-- entreprise, c'est la définition même de son rôle depuis le 22 août — et le
-- rapport consolidé d'un magasin, qui additionne des inventaires CLÔTURÉS,
-- passe par lui. Les leur retirer viderait cet écran.

-- ── 1. La visibilité : un seul point de passage ─────────────────────────────
--
-- ⚠️ **ON MODIFIE `is_session_participant`, ET C'EST DÉLIBÉRÉ.** Elle garde
-- 10 policies et, par `can_access_session`, une trentaine de fonctions :
-- comptages, zones, articles, stock théorique, rapport, écarts. Une ligne
-- ferme donc tout de façon cohérente. La même règle recopiée dans dix policies
-- aurait garanti un oubli — c'est le raisonnement qui a servi le 22 août pour
-- OUVRIR l'accès à l'administrateur d'entreprise, au même endroit.
--
-- Conséquence voulue : pour un invité, un inventaire clôturé ne disparaît pas
-- seulement de sa liste — il n'en reste rien à moitié lisible.
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_admin() or exists (
    select 1 from public.inventory_sessions s
    where s.id = p_session_id
      and s.company_id = public.get_my_company()
      and (
        s.created_by = auth.uid()
        or public.is_company_admin(s.company_id)
        -- ⚠️ La seule branche qui s'éteint à la clôture : celle de l'invité.
        or (s.status <> 'closed' and exists (
          select 1 from public.session_members sm
          where sm.session_id = s.id and sm.user_id = auth.uid()
        ))
      )
  );
$function$;

-- ⚠️ `create or replace` rend EXECUTE à PUBLIC — leçon de `20260819172706`,
-- et constat n°6 du 28 août. Les droits se reposent dans la même migration.
revoke all on function public.is_session_participant(uuid) from public, anon;
grant execute on function public.is_session_participant(uuid) to authenticated, service_role;

-- ── 2. Les compteurs ont leur propre policy, elle ne passe pas par la garde ──
--
-- ⚠️ `sessions_employee_select` teste `session_members` EN DIRECT : sans ce
-- second geste, un compteur aurait continué de voir dans sa liste un
-- inventaire que plus personne d'autre ne lui ouvre. Un compteur ne crée
-- jamais d'inventaire, il n'y a donc aucune branche « créateur » à préserver.
drop policy if exists sessions_employee_select on public.inventory_sessions;
create policy sessions_employee_select on public.inventory_sessions
for select to authenticated
using (
  public.get_my_role() = 'employee'
  and status <> 'closed'
  and exists (
    select 1 from public.session_members sm
    where sm.session_id = inventory_sessions.id and sm.user_id = auth.uid()
  )
);

-- ── 3. Seul le créateur clôture ─────────────────────────────────────────────
--
-- ⚠️ **CECI RÉVOQUE UNE RÈGLE DU 22 AOÛT 2026**, qui disait : « clôturer est
-- ouvert à tout superviseur participant — c'est un geste de terrain que le
-- créateur peut défaire ». Elle ne tient plus avec le point 1 : un invité qui
-- clôture se retirerait l'écran sous les doigts dans la seconde.
--
-- ⚠️ **LA DISTINCTION SE FAIT PAR LE `WITH CHECK`, PAS PAR LE `USING`**, et
-- c'est ce qui permet de ne fermer QUE la clôture :
--   • `USING` regarde la ligne AVANT — il garde la réouverture d'un
--     inventaire clôturé au seul créateur (règle du 21 août, inchangée) ;
--   • `WITH CHECK` regarde la ligne APRÈS — si la nouvelle valeur est
--     `closed`, il faut être le créateur ou l'administrateur de l'entreprise.
-- « Commencer l'inventaire » (`status = 'counting'`) reste donc ouvert à tout
-- superviseur participant : c'est un geste de préparation, pas une fin.
drop policy if exists sessions_supervisor_update on public.inventory_sessions;
create policy sessions_supervisor_update on public.inventory_sessions
for update to authenticated
using (
  public.get_my_role() = 'supervisor'
  and public.is_session_participant(id)
  and (status <> 'closed' or created_by = auth.uid() or public.is_company_admin(company_id))
)
with check (
  public.get_my_role() = 'supervisor'
  and company_id = public.get_my_company()
  and (status <> 'closed' or created_by = auth.uid() or public.is_company_admin(company_id))
);
