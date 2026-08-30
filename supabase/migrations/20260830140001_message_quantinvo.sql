-- Le canal administrateur d'entreprise → Quantinvo (30 août 2026).
--
-- Miroir du canal superviseur → administrateur : même modale à l'écran, même
-- fonction edge (message-admin choisit le destinataire d'après le PROFIL de
-- l'appelant, jamais d'après la requête), mêmes bornes qui refusent sans
-- tronquer. Les administrateurs Quantinvo sont des comptes du produit : le
-- message arrive dans LEURS notifications — la cloche du rail est à eux
-- aussi — et par e-mail via admin_notify_emails, réponse directe comprise.
--
-- Le type `message_entreprise` s'ajoute à la contrainte ; le libellé de
-- l'entreprise est FIGÉ dans la charge, comme tout ce que les notifications
-- racontent.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('invitation_inventaire', 'compteur_actif', 'message_superviseur', 'message_entreprise'));

create or replace function public.deposer_message_quantinvo(p_sujet text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_profil record;
  v_cie    text;
  v_sujet  text := trim(coalesce(p_sujet, ''));
  v_msg    text := trim(coalesce(p_message, ''));
  n        int;
begin
  select p.is_company_admin, p.company_id, p.full_name
    into v_profil from public.profiles p where p.id = v_uid;
  -- Réservé à l'administrateur d'entreprise : le superviseur ordinaire a son
  -- canal vers SON administrateur, et un administrateur Quantinvo n'écrit
  -- pas à lui-même.
  if not found or not coalesce(v_profil.is_company_admin, false) then
    raise exception 'forbidden';
  end if;
  if v_profil.company_id is null then
    raise exception 'aucune_entreprise';
  end if;
  if v_sujet = '' or v_msg = '' then
    raise exception 'message_vide';
  end if;
  if length(v_sujet) > 120 or length(v_msg) > 2000 then
    raise exception 'message_trop_long';
  end if;

  select c.name into v_cie from public.companies c where c.id = v_profil.company_id;

  insert into public.notifications (user_id, type, donnees)
  select p.id, 'message_entreprise', jsonb_build_object(
           'sujet', v_sujet,
           'message', v_msg,
           'de', coalesce(v_profil.full_name, ''),
           'de_id', v_uid,
           'entreprise', coalesce(v_cie, '')
         )
    from public.profiles p
   where p.is_admin;
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'aucun_administrateur_quantinvo';
  end if;

  return jsonb_build_object('success', true, 'destinataires', n);
end;
$$;

revoke execute on function public.deposer_message_quantinvo(text, text) from public, anon;
grant execute on function public.deposer_message_quantinvo(text, text) to authenticated, service_role;
