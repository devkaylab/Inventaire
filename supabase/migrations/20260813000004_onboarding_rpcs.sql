-- ─────────────────────────────────────────────────────────────────────────
-- Parcours d'inscription : dépôt des demandes (public) et traitement (admin).
--
-- Toutes ces fonctions sont SECURITY DEFINER : les deux tables de demandes
-- n'ont aucune policy permissive, elles ne sont donc atteignables que par ici.
-- Les fonctions `submit_*` sont ouvertes à `anon` (le formulaire du site est
-- public) ; les `admin_*` vérifient `is_admin()` en première ligne.
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Dépôt public : demande d'inscription d'une entreprise ──────────────────
create or replace function public.submit_company_request(
  p_company_name text, p_first_name text, p_last_name text,
  p_email text, p_phone text, p_store_count int, p_message text default '')
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if coalesce(btrim(p_company_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le nom de l''entreprise est requis.');
  end if;
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le prénom et le nom du contact sont requis.');
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;
  if p_store_count is null or p_store_count < 1 or p_store_count > 500 then
    return json_build_object('success', false, 'error', 'Le nombre de magasins doit être compris entre 1 et 500.');
  end if;

  -- Une seule demande en cours par e-mail : évite les doublons de formulaire
  -- sans bloquer une nouvelle demande après traitement.
  if exists (select 1 from public.company_requests
             where lower(contact_email) = v_email
               and status in ('pending','quoted','accepted','paid')) then
    return json_build_object('success', false,
      'error', 'Une demande est déjà en cours pour cette adresse. Notre équipe vous recontacte.');
  end if;

  insert into public.company_requests
    (company_name, contact_first_name, contact_last_name, contact_email, contact_phone,
     store_count, message)
  values
    (btrim(p_company_name), btrim(p_first_name), btrim(p_last_name), v_email,
     coalesce(btrim(p_phone), ''), p_store_count, coalesce(btrim(p_message), ''))
  returning id into v_id;

  return json_build_object('success', true, 'request_id', v_id::text);
end; $function$;

-- ── Dépôt public : demande d'inscription d'un superviseur ──────────────────
-- Le code magasin est résolu ici. C'est lui qui rattache la demande à une
-- entreprise et à un magasin : l'administrateur Quantinvo n'a rien à chercher.
create or replace function public.submit_supervisor_request(
  p_first_name text, p_last_name text, p_email text, p_phone text, p_store_code text)
returns json language plpgsql security definer set search_path to 'public', 'auth'
as $function$
declare
  v_store public.stores%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = '' then
    return json_build_object('success', false, 'error', 'Le prénom et le nom sont requis.');
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return json_build_object('success', false, 'error', 'Adresse e-mail invalide.');
  end if;

  select * into v_store from public.stores
   where join_code = upper(btrim(coalesce(p_store_code, '')));
  if not found then
    return json_build_object('success', false,
      'error', 'Code magasin introuvable. Demandez-le à l''administrateur de votre entreprise.');
  end if;

  -- Compte déjà existant : inutile de refaire le parcours.
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return json_build_object('success', false,
      'error', 'Un compte existe déjà pour cette adresse. Connectez-vous ou utilisez « mot de passe oublié ».');
  end if;

  if exists (select 1 from public.supervisor_requests
             where lower(email) = v_email and status in ('pending','approved')) then
    return json_build_object('success', false,
      'error', 'Une demande est déjà en cours pour cette adresse.');
  end if;

  insert into public.supervisor_requests
    (first_name, last_name, email, phone, store_id, company_id)
  values
    (btrim(p_first_name), btrim(p_last_name), v_email, coalesce(btrim(p_phone), ''),
     v_store.id, v_store.company_id)
  returning id into v_id;

  return json_build_object('success', true, 'request_id', v_id::text,
    'store_name', v_store.name);
end; $function$;

-- ── Console admin : demandes d'entreprise ─────────────────────────────────
create or replace function public.admin_list_company_requests()
returns table(id uuid, company_name text, contact_first_name text, contact_last_name text,
              contact_email text, contact_phone text, store_count int, message text,
              status text, quote_reference text, quote_amount_cents bigint,
              admin_note text, company_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.company_name, r.contact_first_name, r.contact_last_name, r.contact_email,
           r.contact_phone, r.store_count, r.message, r.status, r.quote_reference,
           r.quote_amount_cents, r.admin_note, r.company_id, r.created_at
    from public.company_requests r
    order by case r.status when 'pending' then 0 when 'accepted' then 1 when 'quoted' then 2
                           when 'paid' then 3 when 'created' then 4 else 5 end,
             r.created_at desc;
end; $function$;

-- Émission du devis : passe la demande en 'quoted'.
create or replace function public.admin_quote_company_request(
  p_id uuid, p_reference text, p_amount_cents bigint, p_note text default '')
returns json language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    return json_build_object('success', false, 'error', 'Montant invalide');
  end if;
  update public.company_requests
     set status = 'quoted', quote_reference = coalesce(btrim(p_reference), ''),
         quote_amount_cents = p_amount_cents, quote_sent_at = now(),
         admin_note = coalesce(btrim(p_note), admin_note), updated_at = now()
   where id = p_id and status in ('pending','quoted');
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable ou déjà traitée'); end if;
  return json_build_object('success', true);
end; $function$;

-- Étapes suivantes : devis accepté, facture encaissée, ou refus.
create or replace function public.admin_set_company_request_status(
  p_id uuid, p_status text, p_note text default '')
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare v_allowed_from text[];
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  v_allowed_from := case p_status
    when 'accepted' then array['quoted']
    when 'paid'     then array['accepted']
    when 'rejected' then array['pending','quoted','accepted','paid']
    else null end;
  if v_allowed_from is null then
    return json_build_object('success', false, 'error', 'Statut invalide');
  end if;

  update public.company_requests
     set status = p_status,
         accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
         paid_at     = case when p_status = 'paid'     then now() else paid_at end,
         admin_note  = coalesce(nullif(btrim(p_note), ''), admin_note),
         updated_at  = now()
   where id = p_id and status = any(v_allowed_from);
  if not found then
    return json_build_object('success', false, 'error', 'Transition impossible depuis le statut actuel');
  end if;
  return json_build_object('success', true);
end; $function$;

-- Création effective, après encaissement : l'entreprise et ses magasins
-- naissent ici, avec leurs codes. C'est le seul chemin qui crée une entreprise.
create or replace function public.admin_fulfil_company_request(
  p_id uuid, p_store_names text[] default null)
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_req public.company_requests%rowtype;
  v_company_id uuid; v_company_code text; v_store_code text;
  v_name text; v_i int; v_stores json[] := '{}';
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;

  select * into v_req from public.company_requests where id = p_id;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.status <> 'paid' then
    return json_build_object('success', false,
      'error', 'L''entreprise ne peut être créée qu''après encaissement de la facture.');
  end if;

  v_company_code := public.gen_company_code();
  insert into public.companies (name, join_code) values (v_req.company_name, v_company_code)
    returning id into v_company_id;

  for v_i in 1..v_req.store_count loop
    v_name := coalesce(nullif(btrim(p_store_names[v_i]), ''), 'Magasin ' || v_i);
    v_store_code := public.gen_store_code();
    insert into public.stores (company_id, name, join_code)
      values (v_company_id, v_name, v_store_code);
    v_stores := v_stores || json_build_object('name', v_name, 'join_code', v_store_code);
  end loop;

  update public.company_requests
     set status = 'created', company_id = v_company_id, updated_at = now() where id = p_id;

  return json_build_object('success', true, 'company_id', v_company_id::text,
    'company_code', v_company_code, 'stores', array_to_json(v_stores));
end; $function$;

-- ── Console admin : demandes de superviseur ───────────────────────────────
-- Le code magasin ayant déjà été résolu au dépôt, la liste porte directement
-- l'entreprise et le magasin.
create or replace function public.admin_list_supervisor_requests()
returns table(id uuid, first_name text, last_name text, email text, phone text,
              store_id uuid, store_name text, company_id uuid, company_name text,
              status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select r.id, r.first_name, r.last_name, r.email, r.phone,
           r.store_id, st.name, r.company_id, c.name,
           r.status, r.admin_note, r.created_at
    from public.supervisor_requests r
    join public.stores st on st.id = r.store_id
    join public.companies c on c.id = r.company_id
    order by case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
             r.created_at desc;
end; $function$;

-- Validation / refus. L'envoi du mail d'invitation est fait par l'edge
-- function `invite-supervisor`, qui appelle cette fonction puis crée
-- l'utilisateur auth — le mot de passe est choisi par la personne, jamais ici.
create or replace function public.admin_review_supervisor_request(
  p_id uuid, p_approve boolean, p_note text default '')
returns json language plpgsql security definer set search_path to 'public'
as $function$
declare v_req public.supervisor_requests%rowtype;
begin
  if not public.is_admin() then return json_build_object('success', false, 'error', 'Accès refusé'); end if;
  select * into v_req from public.supervisor_requests where id = p_id;
  if not found then return json_build_object('success', false, 'error', 'Demande introuvable'); end if;
  if v_req.status <> 'pending' then
    return json_build_object('success', false, 'error', 'Demande déjà traitée');
  end if;

  update public.supervisor_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = coalesce(nullif(btrim(p_note), ''), admin_note),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;

  return json_build_object('success', true, 'email', v_req.email,
    'first_name', v_req.first_name, 'last_name', v_req.last_name,
    'store_id', v_req.store_id::text, 'company_id', v_req.company_id::text);
end; $function$;

-- ── Droits ────────────────────────────────────────────────────────────────
-- Les formulaires du site sont publics : `anon` doit pouvoir déposer.
revoke all on function public.submit_company_request(text, text, text, text, text, int, text) from public;
grant execute on function public.submit_company_request(text, text, text, text, text, int, text) to anon, authenticated;
revoke all on function public.submit_supervisor_request(text, text, text, text, text) from public;
grant execute on function public.submit_supervisor_request(text, text, text, text, text) to anon, authenticated;

-- Le traitement reste réservé aux comptes connectés (et à `is_admin()` dedans).
revoke all on function public.admin_list_company_requests() from public, anon;
grant execute on function public.admin_list_company_requests() to authenticated;
revoke all on function public.admin_quote_company_request(uuid, text, bigint, text) from public, anon;
grant execute on function public.admin_quote_company_request(uuid, text, bigint, text) to authenticated;
revoke all on function public.admin_set_company_request_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_company_request_status(uuid, text, text) to authenticated;
revoke all on function public.admin_fulfil_company_request(uuid, text[]) from public, anon;
grant execute on function public.admin_fulfil_company_request(uuid, text[]) to authenticated;
revoke all on function public.admin_list_supervisor_requests() from public, anon;
grant execute on function public.admin_list_supervisor_requests() to authenticated;
revoke all on function public.admin_review_supervisor_request(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_supervisor_request(uuid, boolean, text) to authenticated;

revoke all on function public.compose_full_name(text, text, text) from public, anon;
grant execute on function public.compose_full_name(text, text, text) to authenticated;
