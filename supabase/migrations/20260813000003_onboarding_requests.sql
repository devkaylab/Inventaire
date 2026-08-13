-- ─────────────────────────────────────────────────────────────────────────
-- Parcours d'inscription : demandes entreprise et superviseur.
--
-- Jusqu'ici l'inscription était en libre-service : n'importe qui créait un
-- compte superviseur (`handle_new_user` attribuait le rôle par défaut), puis
-- s'auto-affectait à un magasin en saisissant son code (`join_store`).
-- L'administrateur Quantinvo ne voyait jamais passer la demande.
--
-- Le parcours cible est l'inverse : on demande, Quantinvo valide, puis la
-- personne est invitée à créer son mot de passe. Cette migration pose les deux
-- tables de demandes et refond `handle_new_user` en conséquence.
--
-- Les codes (entreprise, magasin) restent confidentiels : ces tables ne
-- portent aucune policy permissive, tout passe par des fonctions SECURITY
-- DEFINER (même convention que `store_team`).
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Prénom / nom ────────────────────────────────────────────────────────────
-- L'app n'avait qu'un champ « nom complet ». Le parcours cible demande prénom
-- et nom séparés. On ajoute les deux colonnes sans toucher à `full_name`, qui
-- reste la valeur affichée partout et qu'on maintient par recomposition.

alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name  text not null default '';

alter table public.team_invitations
  add column if not exists first_name text not null default '',
  add column if not exists last_name  text not null default '';

-- Magasins auxquels rattacher le compteur invité. Vide = tous ceux de son
-- superviseur (comportement historique), sinon la sélection du superviseur.
alter table public.team_invitations
  add column if not exists store_ids uuid[] not null default '{}';

-- Recompose « Prénom Nom » en gardant la valeur existante si les deux
-- colonnes sont vides (comptes créés avant cette migration).
create or replace function public.compose_full_name(p_first text, p_last text, p_fallback text default '')
returns text language sql immutable as $$
  select coalesce(
    nullif(btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')), ''),
    coalesce(p_fallback, '')
  );
$$;

-- ── Demande d'inscription d'une entreprise ─────────────────────────────────
-- Déposée depuis le site public, traitée par l'administrateur Quantinvo :
--   pending → quoted (devis émis) → accepted (devis validé par l'entreprise)
--           → paid (facture encaissée) → created (entreprise + magasins créés)
--   rejected à tout moment.
-- L'entreprise et ses codes ne sont créés qu'en sortie de `paid`.

create table if not exists public.company_requests (
  id                 uuid primary key default gen_random_uuid(),
  company_name       text not null,
  contact_first_name text not null,
  contact_last_name  text not null,
  contact_email      text not null,
  contact_phone      text not null default '',
  store_count        int  not null check (store_count between 1 and 500),
  message            text not null default '',
  status             text not null default 'pending'
                       check (status in ('pending','quoted','accepted','paid','created','rejected')),
  quote_reference    text not null default '',
  quote_amount_cents bigint,
  quote_sent_at      timestamptz,
  accepted_at        timestamptz,
  paid_at            timestamptz,
  company_id         uuid references public.companies(id) on delete set null,
  admin_note         text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.company_requests enable row level security;
-- Aucune policy : lecture/écriture réservées aux fonctions SECURITY DEFINER.

create index if not exists company_requests_status_idx
  on public.company_requests (status, created_at desc);

-- ── Demande d'inscription d'un superviseur ─────────────────────────────────
-- Accompagnée du code magasin remis à l'administrateur de l'entreprise. Le code
-- est résolu à la soumission : l'administrateur Quantinvo retrouve donc
-- l'entreprise et le magasin sans avoir à chercher.
--
-- `store_code` n'est pas conservé en clair : il ne sert qu'à résoudre le
-- magasin, et le garder ferait fuiter un secret dans une table de demandes.

create table if not exists public.supervisor_requests (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  email       text not null,
  phone       text not null default '',
  store_id    uuid not null references public.stores(id)    on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending','approved','active','rejected')),
  admin_note  text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  user_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.supervisor_requests enable row level security;

-- Une seule demande vivante par e-mail : les demandes traitées (active,
-- rejected) n'empêchent pas d'en redéposer une.
create unique index if not exists supervisor_requests_open_email
  on public.supervisor_requests (lower(email))
  where status in ('pending','approved');

create index if not exists supervisor_requests_status_idx
  on public.supervisor_requests (status, created_at desc);

-- ── Inscription : le rôle et le rattachement viennent du serveur ───────────
--
-- Ordre de résolution, du plus spécifique au plus général :
--   1. demande superviseur validée  → superviseur, entreprise + magasin affecté
--   2. invitation à un inventaire   → compteur (voir note ci-dessous)
--   3. invitation d'équipe          → compteur, magasins choisis par le superviseur
--   4. sinon                        → refus
--
-- Note sur (2) : auparavant, une `session_invitations` portant `role =
-- 'supervisor'` créait un profil **superviseur**, sans code magasin ni
-- validation Quantinvo — un superviseur pouvait donc en fabriquer un autre par
-- simple invitation à un inventaire. Le rôle de profil est désormais toujours
-- `employee` ; `session_members.role` continue de porter la co-supervision au
-- sein de l'inventaire, qui est une notion distincte.
--
-- Note sur (4) : plus d'auto-inscription. Seule exception, une base vierge
-- (aucun profil), pour pouvoir amorcer le premier administrateur.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email   text := lower(trim(new.email));
  v_first   text;
  v_last    text;
  v_name    text;
  v_sup     public.supervisor_requests%rowtype;
  v_team    public.team_invitations%rowtype;
  v_company uuid;
  v_session_count int;
  r record;
begin
  -- Prénom / nom éventuellement transmis à l'inscription.
  v_first := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  v_last  := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'),  ''), '');

  select * into v_sup from public.supervisor_requests
   where lower(email) = v_email and status = 'approved'
   order by created_at desc limit 1;

  select count(*) into v_session_count
    from public.session_invitations si where si.email = v_email;

  select * into v_team from public.team_invitations where email = v_email limit 1;

  -- 1. Superviseur validé par Quantinvo.
  if v_sup.id is not null then
    v_first := coalesce(nullif(v_first, ''), v_sup.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_sup.last_name);
    v_name  := public.compose_full_name(v_first, v_last,
                 nullif(trim(new.raw_user_meta_data->>'full_name'), ''));

    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'supervisor', v_sup.company_id);

    -- Affectation au magasin de la demande : c'est elle qui ouvre les droits.
    insert into public.store_supervisors (store_id, user_id)
      values (v_sup.store_id, new.id) on conflict do nothing;

    update public.supervisor_requests
       set status = 'active', user_id = new.id where id = v_sup.id;

  -- 2. Invitation à un inventaire (profil compteur, quel que soit le rôle
  --    demandé dans l'inventaire).
  elsif v_session_count > 0 then
    select company_id into v_company
      from public.session_invitations where email = v_email order by created_at limit 1;
    v_name := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      (select nullif(full_name, '') from public.session_invitations
        where email = v_email order by created_at limit 1),
      ''));

    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'employee', v_company);

    for r in select * from public.session_invitations where email = v_email loop
      insert into public.session_members (session_id, user_id, role)
        values (r.session_id, new.id, r.role)
        on conflict (session_id, user_id) do update set role = excluded.role;
      insert into public.store_team (store_id, user_id)
        select s.store_id, new.id from public.inventory_sessions s where s.id = r.session_id
        on conflict do nothing;
    end loop;
    delete from public.session_invitations where email = v_email;
    delete from public.team_invitations where email = v_email;

  -- 3. Compteur pré-inscrit par son superviseur.
  elsif v_team.id is not null then
    v_first := coalesce(nullif(v_first, ''), v_team.first_name);
    v_last  := coalesce(nullif(v_last,  ''), v_team.last_name);
    v_name  := public.compose_full_name(v_first, v_last, coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(v_team.full_name, ''), ''));

    insert into public.profiles (id, full_name, first_name, last_name, role, company_id)
      values (new.id, v_name, v_first, v_last, 'employee', v_team.company_id);

    -- Magasins choisis par le superviseur ; à défaut, tous les siens.
    if array_length(v_team.store_ids, 1) is not null then
      insert into public.store_team (store_id, user_id)
        select unnest(v_team.store_ids), new.id on conflict do nothing;
    else
      insert into public.store_team (store_id, user_id)
        select ss.store_id, new.id from public.store_supervisors ss
        where ss.user_id = v_team.created_by on conflict do nothing;
    end if;
    delete from public.team_invitations where id = v_team.id;

  -- 4. Personne ne s'inscrit de son propre chef.
  else
    if not exists (select 1 from public.profiles) then
      -- Base vierge : amorçage du premier administrateur.
      insert into public.profiles (id, full_name, first_name, last_name, role)
        values (new.id, public.compose_full_name(v_first, v_last,
                  coalesce(new.raw_user_meta_data->>'full_name', '')),
                v_first, v_last, 'supervisor');
    else
      raise exception 'Aucune invitation ni demande validée pour cet e-mail. Déposez une demande sur le site, ou demandez à votre superviseur de vous ajouter.';
    end if;
  end if;

  return new;
end;
$function$;

-- Backfill : renseigner prénom / nom des comptes existants à partir de
-- `full_name` (premier mot = prénom, le reste = nom). Approximation assumée,
-- corrigeable depuis le profil ; sans elle les écrans afficheraient du vide.
update public.profiles
   set first_name = split_part(btrim(full_name), ' ', 1),
       last_name  = btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1))
 where first_name = '' and last_name = '' and btrim(full_name) <> '';
