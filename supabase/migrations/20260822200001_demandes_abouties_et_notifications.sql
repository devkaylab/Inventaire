-- Une demande aboutie disparaît de l'écran du client, et il est prévenu par
-- e-mail (22 août 2026).
--
-- Constat de Julien, capture à l'appui : la demande « Alltricks » restait
-- affichée sous « Demandes de magasin » avec la pastille « Magasin créé »,
-- alors que le magasin avait été créé — puis supprimé, puisque c'était un
-- essai. La liste montrait donc une trace sans objet, sous un titre qui
-- annonce des demandes en cours.
--
-- Règle posée : **la liste du client ne montre que ce sur quoi il peut encore
-- agir** — ses demandes en attente (qu'il peut annuler) et ses demandes
-- refusées (dont il doit lire le motif). Une demande aboutie n'est plus une
-- demande : le magasin apparu dans la liste juste au-dessus est la
-- confirmation, et l'e-mail de création la double.
--
-- La trace, elle, ne bouge pas : la ligne reste en base, visible dans la
-- console Quantinvo (`admin_list_store_requests`, 90 jours) et purgée à un an
-- comme les journaux. On cesse de l'afficher, on ne l'efface pas.

create or replace function public.ca_list_store_requests()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare v_company uuid;
begin
  if not public.is_company_admin() then
    raise exception 'Accès réservé à l''administrateur de l''entreprise.';
  end if;
  select company_id into v_company from public.profiles where id = auth.uid();

  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id,
             'kind', r.kind,
             'store_id', r.store_id,
             'store_name', r.store_name,
             'message', r.message,
             'units', r.units,
             'sqm', r.sqm,
             'status', r.status,
             'requested_label', r.requested_label,
             'admin_note', r.admin_note,
             'created_at', r.created_at,
             'handled_at', r.handled_at
           ) order by r.created_at desc), '[]'::json)
      from public.store_requests r
     where r.company_id = v_company
       -- Ce qui appelle encore un geste : une demande en cours s'annule, une
       -- demande refusée porte un motif à lire. Les demandes abouties
       -- (`created`, `removed`) sortent de l'écran dès qu'elles aboutissent.
       and (r.status = 'pending'
            or (r.status = 'rejected' and r.handled_at > now() - interval '30 days')));
end;
$$;

-- ── De quoi écrire l'e-mail de création ───────────────────────────────────
-- La fonction rendait le seul retour d'`admin_add_store` (identifiant du
-- magasin et code d'accès). L'edge function qui prévient le demandeur a besoin
-- de savoir **à qui** écrire : on ajoute un objet `notify`, sans rien retirer
-- de ce que la console lit déjà.
--
-- Le **code d'accès n'y figure pas**, et c'est délibéré : il ouvre l'entrée
-- dans le magasin, il n'a rien à faire dans une boîte aux lettres. L'e-mail
-- renvoie vers la fiche du magasin, où l'administrateur le lit derrière sa
-- session.
--
-- `notify` vaut null si le demandeur n'a plus de compte : la création reste
-- valide, il n'y a simplement personne à prévenir.
create or replace function public.admin_fulfil_store_request(p_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_req public.store_requests%rowtype;
  v_res json;
  v_email text;
  v_first text;
  v_company text;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Accès refusé');
  end if;
  select * into v_req from public.store_requests where id = p_id;
  if not found then
    return json_build_object('success', false, 'error', 'Demande introuvable');
  end if;
  if v_req.status <> 'pending' then
    return json_build_object('success', false, 'error', 'Cette demande a déjà été traitée.');
  end if;

  v_res := public.admin_add_store(v_req.company_id, v_req.store_name);
  if not coalesce((v_res ->> 'success')::boolean, false) then
    return v_res;
  end if;

  update public.store_requests
     set status = 'created', handled_at = now(), store_id = (v_res ->> 'store_id')::uuid
   where id = p_id;

  perform public.log_admin_action('demande_magasin_creee', 'entreprise', v_req.company_id::text,
    v_req.store_name, json_build_object('magasin', v_res ->> 'store_id')::jsonb);

  select lower(u.email::text), p.first_name
    into v_email, v_first
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_req.requested_by;

  select c.name into v_company from public.companies c where c.id = v_req.company_id;

  return (v_res::jsonb || jsonb_build_object(
    'notify', case when v_email is null then null else jsonb_build_object(
      'email', v_email,
      'first_name', coalesce(v_first, ''),
      'store_name', v_req.store_name,
      'company_name', coalesce(v_company, ''),
      'store_id', v_res ->> 'store_id'
    ) end
  ))::json;
end;
$$;

revoke all on function public.ca_list_store_requests() from public, anon;
revoke all on function public.admin_fulfil_store_request(uuid) from public, anon;
grant execute on function public.ca_list_store_requests() to authenticated, service_role;
grant execute on function public.admin_fulfil_store_request(uuid) to authenticated, service_role;
