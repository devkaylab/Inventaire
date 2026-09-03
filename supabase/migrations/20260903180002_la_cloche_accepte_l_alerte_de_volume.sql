-- La cloche doit accepter la nouvelle alerte, à DEUX endroits (3 sept. 2026)
--
-- ⚠️ Trouvé en l'essayant pour de vrai, pas à la lecture : l'e-mail est parti
-- (`emailed: true`) et la cloche est restée muette. Deux filtres, et il fallait
-- les deux — c'est le motif du « succès silencieux » que ce dépôt a déjà payé
-- plusieurs fois.
--
--   1. `notifications_type_check` n'admettait que quatre types ; l'insertion
--      était refusée. La fonction edge journalise l'échec sans faire échouer
--      l'envoi (c'est voulu : une cloche muette ne doit pas perdre un e-mail
--      déjà parti) — donc rien ne remontait à l'appelant.
--   2. `mes_notifications` FILTRE les types qu'elle rend. Même insérée, la
--      ligne n'aurait jamais été affichée.
--
-- ⚠️ Retenir les DEUX pour tout futur type de notification : la contrainte, et
-- la liste blanche de lecture. Un seul des deux suffit à rendre la cloche
-- muette sans le moindre message d'erreur.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'invitation_inventaire'::text,
    'compteur_actif'::text,
    'message_superviseur'::text,
    'message_entreprise'::text,
    'inventaire_volumineux'::text
  ]));

create or replace function public.mes_notifications()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with moi as (
    select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) as admin
  ),
  notifs as (
    select n.id::text as id, n.type, n.donnees, n.created_at,
           n.read_at is not null as lu
      from public.notifications n
     where n.user_id = auth.uid()
       -- ⚠️ Liste blanche : un type déposé sans être ajouté ICI n'apparaît
       -- jamais dans la cloche, sans que rien ne le signale.
       and n.type in ('invitation_inventaire', 'compteur_actif', 'inventaire_volumineux')
     order by n.created_at desc limit 20
  ),
  fils as (
    select fi.id::text as id, 'message'::text as type,
           jsonb_build_object(
             'fil_id', fi.id,
             'sujet', fi.sujet,
             'de', (select case
                             when fi.portee = 'quantinvo' and m.auteur_interne
                                  and not (select admin from moi)
                               then 'Quantinvo'
                             else coalesce(nullif(m.auteur_label, ''), 'Quelqu''un')
                           end
                      from public.messages m
                     where m.fil_id = fi.id and m.auteur is distinct from auth.uid()
                     order by m.cree_le desc limit 1),
             'entreprise', (select c.name from public.companies c where c.id = fi.company_id)
           ) as donnees,
           fi.dernier_le as created_at,
           not exists (select 1 from public.messages m
                        where m.fil_id = fi.id
                          and m.auteur is distinct from auth.uid()
                          and (mp.lu_le is null or m.cree_le > mp.lu_le)) as lu
      from public.message_fils fi
      join public.message_participants mp on mp.fil_id = fi.id and mp.user_id = auth.uid()
     order by fi.dernier_le desc limit 20
  ),
  tout as (select * from notifs union all select * from fils)
  select jsonb_build_object(
    'non_lues', (select count(*) from tout where not lu),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'type', t.type, 'donnees', t.donnees,
               'created_at', t.created_at, 'lu', t.lu
             ) order by t.created_at desc)
        from (select * from tout order by created_at desc limit 20) t
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.mes_notifications() from public, anon;
grant execute on function public.mes_notifications() to authenticated, service_role;
