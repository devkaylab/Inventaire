-- La boîte de réception des messages (30 août 2026).
--
-- Constat de Julien, premier message réel reçu : la cloche annonce et
-- tronque, rien ne permet de LIRE le message en entier. La page /messages
-- liste les messages reçus — `message_superviseur` chez l'administrateur
-- d'entreprise, `message_entreprise` chez l'administrateur Quantinvo — avec
-- leur contenu complet.
--
-- Deux fonctions, pas une : lire ne marque pas lu (on peut survoler sa
-- boîte), et marquer ne touche QUE les messages — les invitations et les
-- comptes activés gardent leur état tant que la cloche ne les a pas montrés.

create or replace function public.mes_messages()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', n.id, 'type', n.type, 'donnees', n.donnees,
             'created_at', n.created_at, 'lu', n.read_at is not null
           ) order by n.created_at desc)
      from (select * from public.notifications
             where user_id = auth.uid()
               and type in ('message_superviseur', 'message_entreprise')
             order by created_at desc limit 100) n
  ), '[]'::jsonb);
$$;

create or replace function public.marquer_messages_lus()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n int;
begin
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and type in ('message_superviseur', 'message_entreprise');
  get diagnostics n = row_count;
  return jsonb_build_object('success', true, 'lus', n);
end;
$$;

revoke execute on function public.mes_messages() from public, anon;
grant execute on function public.mes_messages() to authenticated, service_role;
revoke execute on function public.marquer_messages_lus() from public, anon;
grant execute on function public.marquer_messages_lus() to authenticated, service_role;
