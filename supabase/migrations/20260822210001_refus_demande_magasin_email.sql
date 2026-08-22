-- Le refus d'une demande de magasin se dit aussi par e-mail (22 août 2026).
--
-- Demande de Julien, dans la foulée des deux premiers messages : la création
-- prévenait, le refus non — l'administrateur d'entreprise devait retourner sur
-- /magasins pour découvrir que sa demande avait été refusée, et pourquoi.
--
-- `admin_reject_store_request` gagne l'objet `notify`, exactement comme
-- `admin_fulfil_store_request` : de quoi écrire à qui a demandé, sans que la
-- fonction n'envoie rien elle-même (c'est le travail de l'edge function).
--
-- `kind` y figure : refuser un ajout et refuser une suppression ne se disent
-- pas de la même façon, et le message doit pouvoir choisir ses mots.
--
-- Le **motif voyage tel quel** — c'est déjà la règle de l'écran client :
-- « Refusée » tout court laisserait l'administrateur sans rien à faire de
-- l'information. Il reste borné à 500 caractères par la fonction, et le
-- gabarit d'e-mail l'échappe.
--
-- `notify` vaut null si le demandeur n'a plus de compte : le refus reste
-- valide, il n'y a simplement personne à prévenir.

create or replace function public.admin_reject_store_request(p_id uuid, p_note text default '')
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_req public.store_requests%rowtype;
  v_note text := left(btrim(coalesce(p_note, '')), 500);
  v_email text;
  v_first text;
  v_company text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  update public.store_requests
     set status = 'rejected', handled_at = now(), admin_note = v_note
   where id = p_id and status = 'pending'
  returning * into v_req;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée.');
  end if;

  perform public.log_admin_action('demande_magasin_refusee', 'entreprise', v_req.company_id::text,
    v_req.store_name, json_build_object('note', v_note)::jsonb);

  select lower(u.email::text), p.first_name
    into v_email, v_first
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_req.requested_by;

  select c.name into v_company from public.companies c where c.id = v_req.company_id;

  return json_build_object(
    'success', true,
    'notify', case when v_email is null then null else json_build_object(
      'email', v_email,
      'first_name', coalesce(v_first, ''),
      'store_name', v_req.store_name,
      'company_name', coalesce(v_company, ''),
      'kind', v_req.kind,
      'note', v_note
    ) end
  );
end;
$$;

revoke all on function public.admin_reject_store_request(uuid, text) from public, anon;
grant execute on function public.admin_reject_store_request(uuid, text) to authenticated, service_role;
