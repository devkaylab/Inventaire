-- On-Demand : le socle des droits et du profil inventoriste (20 septembre 2026)
--
-- Conception : docs/entreprise/on-demand/01-comptes-et-droits.md
-- Maquette : https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV
--
-- ⚠️ CETTE MIGRATION NE TOUCHE À AUCUN OBJET EXISTANT. Elle ajoute trois
-- tables et quatre fonctions. Rien de ce qui fait tourner Quantinvo OS n'est
-- modifié — c'est ce qui permet de l'appliquer sans rejouer les parcours
-- payants.
--
-- ⚠️ ET `handle_new_user` N'EST PAS TOUCHÉE NON PLUS, parce qu'elle fait déjà
-- ce qu'il faut : depuis le 5 septembre elle accepte une adresse dont le code
-- e-mail a été consommé il y a moins de quinze minutes, et le profil qui en
-- sort est `employee` sans entreprise. C'est EXACTEMENT le compte d'un
-- inventoriste. La porte du prospect sert aussi au prestataire — on n'en ouvre
-- pas une seconde, et la limitation de débit de `demander_code_email` couvre
-- les deux.
--
-- Le principe que ces tables mettent en place : l'authentification répond
-- « qui », jamais « a le droit de ». Un compte existe sans rien acheter.

-- ─── Ce à quoi une entreprise a droit ──────────────────────────────────────
--
-- ⚠️ ON N'EN DÉDUIT PAS UN DROIT DE L'ABSENCE D'UN AUTRE. Une entreprise
-- suspendue pour impayé doit pouvoir perdre On-Demand sans perdre OS, et
-- l'inverse. D'où une ligne par produit, et pas un booléen sur `companies`.
create table if not exists public.entitlements (
  company_id uuid not null references public.companies(id) on delete cascade,
  produit    text not null check (produit in ('os', 'on_demand')),
  etat       text not null default 'actif' check (etat in ('actif', 'suspendu', 'ferme')),
  source     text not null default 'libre' check (source in ('abonnement', 'libre', 'admin')),
  ouvert_le  timestamptz not null default now(),
  ferme_le   timestamptz,
  primary key (company_id, produit)
);

alter table public.entitlements enable row level security;
revoke all on table public.entitlements from public, anon, authenticated;
grant select on table public.entitlements to authenticated;

comment on table public.entitlements is
  'Ce à quoi une entreprise a droit, produit par produit. On-Demand s''ouvre à la création de l''entreprise et ne coûte rien ; OS suit l''abonnement.';

-- Une personne voit les droits de SON entreprise, et d'aucune autre.
-- ⚠️ La garde est sur la ligne visée (`company_id` de la ligne), pas sur le
-- rôle de l'appelant : c'est le motif de défaut relevé quatre fois sur ce
-- projet, dont le 8 septembre sur `ensure_zone`.
drop policy if exists entitlements_lire_la_sienne on public.entitlements;
create policy entitlements_lire_la_sienne on public.entitlements
  for select to authenticated
  using (company_id = (select p.company_id from public.profiles p where p.id = auth.uid()));

-- Aucune policy d'écriture : ces lignes ne se posent que par les fonctions
-- ci-dessous, en `service_role`. Une entreprise qui pourrait s'écrire un droit
-- n'en serait plus un.

-- ─── On-Demand s'ouvre avec l'entreprise ───────────────────────────────────
--
-- Le compte est gratuit et n'engage à rien : c'est tout le point 41 du plan.
--
-- ⚠️ **PAS DE DÉCLENCHEUR SUR `companies`, ET C'EST VOLONTAIRE.** La première
-- version en posait un : une entreprise créée recevait son droit On-Demand
-- automatiquement. C'était commode, et ça mettait du code On-Demand sur le
-- chemin de création d'entreprise de Quantinvo OS — celui qu'emprunte un
-- client qui vient de payer. Un défaut là-dedans casse un encaissement.
--
-- À la place : les entreprises existantes reçoivent leur droit ici, une fois,
-- et `reserver_ma_mission` le pose pour les suivantes au moment où quelqu'un
-- réserve. On-Demand s'ouvre donc quand On-Demand sert, et le parcours payant
-- d'OS ne traverse aucune ligne de ce chantier.
insert into public.entitlements (company_id, produit, etat, source)
  select c.id, 'on_demand', 'actif', 'libre' from public.companies c
  on conflict (company_id, produit) do nothing;

-- ─── Le profil de l'inventoriste ───────────────────────────────────────────
--
-- ⚠️ PAS DE `company_id`. Le rattacher à une entreprise « Quantinvo » serait
-- commode et faux : il hériterait des droits de cette entreprise sur ses
-- inventaires. Son accès à un inventaire passera par `mission_access`, une
-- mission à la fois (migration suivante).
--
-- ⚠️ NI IBAN NI PIÈCE D'IDENTITÉ ICI, ET NULLE PART. Avec Stripe Connect,
-- c'est Stripe qui les collecte et qui a l'obligation de vérifier — on garde
-- son identifiant de compte et on LIT l'état qu'il rend. Poser un champ IBAN
-- dans cette base serait un risque gratuit : rien dans le produit n'a besoin
-- de le relire.
create table if not exists public.provider_profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  etat               text not null default 'incomplet'
                       check (etat in ('incomplet','en_revue','verifie','actif','suspendu','refuse')),
  niveau             text not null default 'nouveau'
                       check (niveau in ('nouveau','confirme','expert','responsable')),
  forme_juridique    text,
  siret              text,
  experience_annees  integer check (experience_annees between 0 and 60),
  secteurs           text[] not null default '{}',
  langues            text[] not null default '{}',
  mobilite           text,
  rayon_km           integer not null default 20 check (rayon_km between 1 and 200),
  stripe_account_id  text unique,
  paiements_ouverts  boolean not null default false,
  verifie_le         timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.provider_profiles enable row level security;
revoke all on table public.provider_profiles from public, anon, authenticated;
grant select on table public.provider_profiles to authenticated;

comment on table public.provider_profiles is
  'Le profil professionnel d''un inventoriste. Aucune entreprise, aucune coordonnée bancaire : Stripe Connect détient l''IBAN et l''identité, on ne garde que son identifiant de compte et l''état qu''il rend.';

-- Chacun voit le sien. Personne ne voit celui d'un autre — pas même un
-- superviseur : un inventoriste n'appartient à aucune entreprise cliente.
drop policy if exists provider_lire_le_sien on public.provider_profiles;
create policy provider_lire_le_sien on public.provider_profiles
  for select to authenticated
  using (user_id = auth.uid());

-- ⚠️ AUCUNE POLICY D'ÉCRITURE, ET C'EST LE POINT. Avec un `update` ouvert,
-- n'importe qui se poserait `etat = 'actif'`, `niveau = 'expert'` et
-- `paiements_ouverts = true`. On passe par la fonction ci-dessous, qui
-- n'écrit QUE les colonnes déclaratives.

-- ─── Ce que l'inventoriste a le droit d'écrire lui-même ────────────────────
create or replace function public.enregistrer_mon_profil_inventoriste(
  p_forme_juridique   text,
  p_siret             text,
  p_experience_annees integer,
  p_secteurs          text[],
  p_langues           text[],
  p_mobilite          text,
  p_rayon_km          integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_entreprise uuid;
  v_avant record;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;

  -- ⚠️ UN SALARIÉ D'UNE ENTREPRISE CLIENTE NE DEVIENT PAS INVENTORISTE SUR LE
  -- MÊME COMPTE. Il compterait chez un concurrent de son employeur avec le
  -- compte que son employeur lui a ouvert, et `mission_access` se superposerait
  -- à son appartenance d'entreprise. Même réponse que `other_company` sur les
  -- invitations : on dit quoi faire, on ne dit pas juste « erreur ».
  select company_id into v_entreprise from public.profiles where id = v_user;
  if v_entreprise is not null then
    return jsonb_build_object('success', false, 'code', 'compte_d_entreprise');
  end if;

  select etat, siret, forme_juridique into v_avant
    from public.provider_profiles where user_id = v_user;

  -- ⚠️ `etat`, `niveau`, `stripe_account_id`, `paiements_ouverts` et
  -- `verifie_le` NE SONT PAS DANS CETTE LISTE, et ne doivent jamais y entrer.
  -- Ce sont eux qui décident si quelqu'un reçoit des missions et de l'argent.
  insert into public.provider_profiles as pp (
    user_id, forme_juridique, siret, experience_annees,
    secteurs, langues, mobilite, rayon_km)
  values (
    v_user, p_forme_juridique, p_siret, p_experience_annees,
    coalesce(p_secteurs, '{}'), coalesce(p_langues, '{}'),
    p_mobilite, coalesce(p_rayon_km, 20))
  on conflict (user_id) do update set
    forme_juridique   = excluded.forme_juridique,
    siret             = excluded.siret,
    experience_annees = excluded.experience_annees,
    secteurs          = excluded.secteurs,
    langues           = excluded.langues,
    mobilite          = excluded.mobilite,
    rayon_km          = excluded.rayon_km;

  -- Corriger une langue ne remet pas un profil vérifié en revue ; changer de
  -- SIRET ou de forme juridique, si — c'est l'identité de l'entreprise qui
  -- facture. La seule transition d'état que cette fonction s'autorise va vers
  -- le BAS : jamais vers « vérifié ».
  if v_avant.etat in ('verifie', 'actif')
     and (v_avant.siret is distinct from p_siret
          or v_avant.forme_juridique is distinct from p_forme_juridique) then
    update public.provider_profiles
       set etat = 'en_revue', verifie_le = null
     where user_id = v_user;
    return jsonb_build_object('success', true, 'code', 'repasse_en_revue');
  end if;

  return jsonb_build_object('success', true);
end;
$function$;

revoke all on function public.enregistrer_mon_profil_inventoriste(text, text, integer, text[], text[], text, integer)
  from public, anon;
grant execute on function public.enregistrer_mon_profil_inventoriste(text, text, integer, text[], text[], text, integer)
  to authenticated;

-- ─── Ses disponibilités ────────────────────────────────────────────────────
--
-- Une ligne par jour de semaine renseigné. Un jour absent = indisponible ;
-- c'est plus simple à lire qu'un drapeau, et ça évite sept lignes vides par
-- personne.
create table if not exists public.provider_availability (
  user_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  jour    smallint not null check (jour between 1 and 7),   -- 1 = lundi
  debut   time not null,
  fin     time not null,
  primary key (user_id, jour)
);

alter table public.provider_availability enable row level security;
revoke all on table public.provider_availability from public, anon, authenticated;
grant select on table public.provider_availability to authenticated;

comment on table public.provider_availability is
  'Les créneaux hebdomadaires d''un inventoriste. Un jour sans ligne est un jour indisponible. `fin` peut être avant `debut` : le créneau passe minuit.';

drop policy if exists dispo_lire_les_siennes on public.provider_availability;
create policy dispo_lire_les_siennes on public.provider_availability
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.enregistrer_mes_disponibilites(p_creneaux jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_ligne jsonb;
  v_jour smallint;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'code', 'non_connecte');
  end if;
  if not exists (select 1 from public.provider_profiles where user_id = v_user) then
    return jsonb_build_object('success', false, 'code', 'pas_de_profil');
  end if;
  if jsonb_typeof(p_creneaux) <> 'array' then
    return jsonb_build_object('success', false, 'code', 'format');
  end if;

  -- On remplace l'ensemble : la liste envoyée EST la semaine. Fusionner
  -- laisserait vivre un créneau que la personne croit avoir retiré.
  delete from public.provider_availability where user_id = v_user;

  for v_ligne in select * from jsonb_array_elements(p_creneaux) loop
    v_jour := (v_ligne->>'jour')::smallint;
    if v_jour is null or v_jour < 1 or v_jour > 7 then
      return jsonb_build_object('success', false, 'code', 'jour');
    end if;
    if v_ligne->>'debut' is null or v_ligne->>'fin' is null then
      return jsonb_build_object('success', false, 'code', 'heure_manquante');
    end if;
    insert into public.provider_availability (user_id, jour, debut, fin)
    values (v_user, v_jour, (v_ligne->>'debut')::time, (v_ligne->>'fin')::time)
    on conflict (user_id, jour) do update
      set debut = excluded.debut, fin = excluded.fin;
  end loop;

  return jsonb_build_object('success', true);
end;
$function$;

revoke all on function public.enregistrer_mes_disponibilites(jsonb) from public, anon;
grant execute on function public.enregistrer_mes_disponibilites(jsonb) to authenticated;

-- ─── Ce que l'application demande au démarrage ─────────────────────────────
--
-- Une seule réponse pour « qui suis-je et où vais-je » : le rôle dans
-- l'entreprise, les produits ouverts, et l'existence d'un profil inventoriste.
-- C'est elle qui remplace le `homePathForRole` étendu côté client — et elle
-- ne rend QUE ce qui concerne l'appelant.
create or replace function public.mon_acces()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_prof record;
  v_produits text[];
  v_prov record;
begin
  if v_user is null then
    return jsonb_build_object('connecte', false);
  end if;

  select p.role, p.is_admin, p.is_company_admin, p.company_id
    into v_prof from public.profiles p where p.id = v_user;

  select coalesce(array_agg(e.produit order by e.produit), '{}')
    into v_produits
    from public.entitlements e
   where e.company_id = v_prof.company_id and e.etat = 'actif';

  select pp.etat, pp.niveau into v_prov
    from public.provider_profiles pp where pp.user_id = v_user;

  return jsonb_build_object(
    'connecte', true,
    'role', v_prof.role,
    'admin', coalesce(v_prof.is_admin, false),
    'admin_entreprise', coalesce(v_prof.is_company_admin, false),
    'a_une_entreprise', v_prof.company_id is not null,
    'produits', coalesce(v_produits, '{}'),
    'inventoriste', case when v_prov.etat is null then null
                    else jsonb_build_object('etat', v_prov.etat, 'niveau', v_prov.niveau) end);
end;
$function$;

revoke all on function public.mon_acces() from public, anon;
grant execute on function public.mon_acces() to authenticated;
