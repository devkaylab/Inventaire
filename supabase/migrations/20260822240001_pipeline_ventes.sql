-- Les ventes en cours, d'un bout à l'autre, sur le tableau de bord (22 août 2026).
--
-- Julien, une fois le devis envoyé : « où passent les infos sur mon compte
-- admin ? Je vois rien ». Et plus loin : « je veux vraiment que tu penses au
-- flow de A à Z ». Le parcours, déroulé étape par étape, avait trois trous :
--
--   1. /admin ne voyait que les demandes `pending` — une demande devisée,
--      acceptée ou encaissée disparaissait alors qu'elle attend un geste ;
--      et les inscriptions d'entreprise n'y figuraient pas du tout ;
--   2. `admin_list_store_requests` ne rendait que `pending` ou « traité
--      depuis 90 jours » : une demande en `quoted` / `accepted` / `paid` n'a
--      pas de `handled_at`, donc tombait dans un trou — invisible jusque dans
--      la fiche de l'entreprise ;
--   3. l'acceptation du client, le moment le plus important du parcours, ne
--      remontait que par une variable d'environnement jamais posée.
--
-- Ce fichier règle les deux premiers. Le troisième est dans `accept-quote`.
--
-- `admin_pipeline` rend **tout ce qui n'est pas terminé**, dans les deux
-- tables, sous une forme unique : l'écran n'a plus à connaître deux modèles.
-- Il rend des faits (statut, dates), pas des jugements : « à relancer » ou
-- « en attente du client » se décident dans `web/lib/pipeline.ts`, qui se
-- teste sans base.

create or replace function public.admin_pipeline()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;

  return (
    select coalesce(json_agg(x order by x.created_at desc), '[]'::json)
      from (
        -- Inscriptions d'entreprise
        select json_build_object(
                 'kind', 'company',
                 'id', r.id,
                 'company_id', r.company_id,
                 'company_name', r.company_name,
                 'label', r.company_name,
                 'detail', r.store_count::text || ' magasin' || case when r.store_count > 1 then 's' else '' end,
                 'contact', btrim(r.contact_first_name || ' ' || r.contact_last_name),
                 'status', r.status,
                 'quote_reference', r.quote_reference,
                 'quote_amount_cents', r.quote_amount_cents,
                 'created_at', r.created_at,
                 'quote_sent_at', r.quote_sent_at,
                 'quote_expires_at', r.quote_expires_at,
                 'accepted_at', r.accepted_at,
                 'paid_at', r.paid_at
               ) as x, r.created_at
          from public.company_requests r
         where r.status in ('pending', 'quoted', 'accepted', 'paid')

        union all

        -- Demandes de magasin (ajout comme suppression)
        select json_build_object(
                 'kind', case when s.kind = 'remove' then 'store_removal' else 'store' end,
                 'id', s.id,
                 'company_id', s.company_id,
                 'company_name', c.name,
                 'label', s.store_name,
                 'detail', c.name,
                 'contact', s.requested_label,
                 'status', s.status,
                 'quote_reference', s.quote_reference,
                 'quote_amount_cents', s.quote_amount_cents,
                 'created_at', s.created_at,
                 'quote_sent_at', s.quote_sent_at,
                 'quote_expires_at', s.quote_expires_at,
                 'accepted_at', s.accepted_at,
                 'paid_at', s.paid_at
               ) as x, s.created_at
          from public.store_requests s
          join public.companies c on c.id = s.company_id
         where s.status in ('pending', 'quoted', 'accepted', 'paid')
      ) x);
end;
$$;

-- ── La fiche entreprise et la console ne perdent plus les demandes en cours ──
-- Même correction de fond : « en cours » n'est plus « pending », c'est
-- « pas terminé ».
create or replace function public.admin_list_store_requests()
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé';
  end if;
  return (
    select coalesce(json_agg(json_build_object(
             'id', r.id,
             'kind', r.kind,
             'company_id', r.company_id,
             'company_name', c.name,
             'store_id', r.store_id,
             'store_name', r.store_name,
             'message', r.message,
             'units', r.units,
             'sqm', r.sqm,
             'status', r.status,
             'requested_label', r.requested_label,
             'admin_note', r.admin_note,
             'created_at', r.created_at,
             'handled_at', r.handled_at,
             'quote_reference', r.quote_reference,
             'quote_amount_cents', r.quote_amount_cents,
             'quote_sent_at', r.quote_sent_at,
             'quote_expires_at', r.quote_expires_at,
             'accepted_at', r.accepted_at,
             'paid_at', r.paid_at
           ) order by (r.status in ('pending', 'quoted', 'accepted', 'paid')) desc, r.created_at desc), '[]'::json)
      from public.store_requests r
      join public.companies c on c.id = r.company_id
     where r.status in ('pending', 'quoted', 'accepted', 'paid')
        or r.handled_at > now() - interval '90 days');
end;
$$;

-- ── L'adresse qui reçoit l'avis d'acceptation ─────────────────────────────
-- Lue par `accept-quote` en `service_role`, à défaut de `QUOTE_NOTIFY_EMAIL`.
-- Le premier administrateur Quantinvo, c'est celui qui tient la boutique.
create or replace function public.admin_notify_emails()
returns text[]
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(array_agg(lower(u.email::text) order by u.created_at), '{}')
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.is_admin and u.email is not null;
$$;

revoke all on function public.admin_pipeline() from public, anon;
grant execute on function public.admin_pipeline() to authenticated, service_role;
revoke all on function public.admin_list_store_requests() from public, anon;
grant execute on function public.admin_list_store_requests() to authenticated, service_role;
-- Réservée au serveur : elle liste des adresses.
revoke all on function public.admin_notify_emails() from public, anon, authenticated;
grant execute on function public.admin_notify_emails() to service_role;
