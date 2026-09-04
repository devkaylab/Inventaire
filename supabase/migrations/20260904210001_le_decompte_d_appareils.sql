-- ============================================================================
-- LE DÉCOMPTE D'APPAREILS (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- La page de tarifs promet « deux appareils à la fois » depuis le 30 août 2026,
-- et l'assiette de la licence est ce nombre-là depuis le 2 septembre. **Rien ne
-- le mesurait, et rien ne l'appliquait** : une entreprise Essential pouvait
-- faire compter cinquante téléphones sans que personne ne le sache — ni elle,
-- ni nous.
--
-- ⚠️ LA RÈGLE, ARBITRÉE PAR JULIEN LE 4 SEPTEMBRE 2026 : « on n'accepte ni
-- magasin, ni appareil supplémentaires sans paiement ». Le plafond n'est donc
-- **pas** indicatif — le troisième appareil d'un forfait Essential ne peut pas
-- ouvrir son écran de comptage.
--
-- Cette note remplace le « plafond souple » posé le 27 août pour l'offre Solo.
-- Elle ne vaut que pour les appareils et les magasins : un plafond de VOLUME
-- compté, s'il revient un jour, reste une autre question.
--
-- ⚠️⚠️ LES TROIS BORNES DU VERROU. Elles ne sont pas des adoucissements, ce
-- sont les conditions pour qu'il ne casse pas un inventaire. Ne pas les défaire
-- sans que Julien rouvre le sujet.
--
--   1. **Un appareil qui compte n'est JAMAIS éjecté.** Le verrou refuse une
--      entrée, il n'interrompt pas un travail en cours. Un appareil qui a déjà
--      sa place la garde, même si le plafond a baissé entre-temps — d'où le
--      chemin « il est déjà là » AVANT tout comptage.
--   2. **Hors ligne, on laisse compter.** Un téléphone sans réseau ne peut ni
--      réserver ni se voir refuser : le contrôle est en ligne, et seulement en
--      ligne. C'est une limite assumée, pas un oubli — on ne bloque pas une
--      réserve parce que le wifi est tombé.
--   3. **Sans plafond connu, aucun refus.** Un magasin dont `devices` est nul
--      et dont l'entreprise n'a pas de `plan` n'a pas d'assiette : on mesure, on
--      ne juge pas. Un plafond inventé fermerait la porte à tort.
--      ⚠️ Au 4 septembre 2026, **les deux entreprises en base sont des
--      entreprises d'essai** — il n'y a encore aucun client réel. Ce n'est donc
--      pas un historique à ménager, c'est le cas normal d'un magasin créé
--      autrement que par un devis ou une souscription.
--
-- ⚠️ CONSÉQUENCE À CONNAÎTRE : LE PIC NE PEUT PLUS DÉPASSER LE PLAFOND. Tant
-- que le verrou mord, « sept appareils ont compté sur un forfait de deux » ne
-- peut plus arriver. Le signal commercial n'est donc pas le pic, c'est le
-- **nombre de refus** : « douze fois ce mois-ci, un appareil n'a pas pu
-- compter ». C'est lui qui vaut une montée d'offre, et c'est lui que la fiche
-- du magasin met en avant — et il compte des APPAREILS DISTINCTS, jamais des
-- tentatives : un téléphone éconduit redemande sa place toutes les trente
-- secondes, et « douze refus » ne doit pas vouloir dire « une personne a
-- patienté six minutes ». D'où la colonne `refuse` sur `appareils_actifs`.
-- ============================================================================


-- ── 1. Ce qui tient la place d'un appareil ─────────────────────────────────
--
-- Une ligne par appareil EN TRAIN DE COMPTER, et rien d'autre. Les lignes
-- périmées sont supprimées à la volée par `prendre_place_appareil` : cette
-- table ne garde donc que le présent, jamais un historique de qui était où.
--
-- ⚠️ AUCUN `user_id`, ET C'EST LE POINT. On compte des appareils, jamais des
-- personnes — c'est la règle depuis le retrait du suivi nominatif (constat E3,
-- 19 août 2026). Y ajouter le porteur du téléphone reconstituerait exactement
-- le dispositif qu'on a démonté. Ce qui reste nominatif, et doit le rester,
-- c'est `counts.counted_by` : arbitrer un écart suppose de savoir qui a compté.
create table if not exists public.appareils_actifs (
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Identifiant tiré une fois sur le téléphone et rangé dans le trousseau.
  -- Opaque, sans lien avec un compte, et stable d'une connexion à l'autre.
  appareil text not null,
  vu_le timestamptz not null default now(),
  -- ⚠️ VRAI POUR UN APPAREIL QUI S'EST VU REFUSER SA PLACE. Il ne tient aucune
  -- place (toutes les mesures excluent `refuse`), il sert à ne compter le refus
  -- QU'UNE FOIS : un téléphone éconduit redemande toutes les trente secondes, et
  -- sans cette marque « douze refus » voudrait dire « une personne a patienté six
  -- minutes ». Ce chiffre décide d'une montée d'offre : il doit compter des
  -- appareils, pas des tentatives.
  refuse boolean not null default false,
  primary key (store_id, appareil)
);

-- Posée à part pour que la migration se rejoue sur une table déjà créée.
alter table public.appareils_actifs
  add column if not exists refuse boolean not null default false;

comment on table public.appareils_actifs is
  'Les appareils qui comptent en ce moment, par magasin. Purgee a la volee : elle ne garde pas d''historique.';

alter table public.appareils_actifs enable row level security;
-- Aucune policy : rien ne s'y lit ni ne s'y écrit directement. Tout passe par
-- les fonctions ci-dessous, en SECURITY DEFINER. Même configuration que
-- `submission_attempts`, `alertes_envoyees` et `stripe_events_traites`.

create index if not exists appareils_actifs_store_vu_idx
  on public.appareils_actifs (store_id, vu_le);


-- ── 2. Ce qui garde la trace du mois ───────────────────────────────────────
--
-- Une ligne par magasin et par jour : le pic d'appareils simultanés, et le
-- nombre de fois où un appareil s'est vu refuser sa place. Deux nombres, pas
-- un journal — on ne conserve ni l'heure, ni l'appareil, ni la personne.
create table if not exists public.appareils_par_jour (
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Le jour en Europe/Paris : un inventaire commencé à 6 h et fini à 22 h est
  -- un seul jour, et un magasin ne raisonne pas en UTC.
  jour date not null,
  pic integer not null default 0,
  refus integer not null default 0,
  primary key (store_id, jour)
);

comment on table public.appareils_par_jour is
  'Pic d''appareils simultanes et nombre de refus, par magasin et par jour (Europe/Paris).';

alter table public.appareils_par_jour enable row level security;


-- ── 3. Le plafond d'un magasin ─────────────────────────────────────────────
--
-- ⚠️ TROIS SOURCES, DANS CET ORDRE, ET L'ORDRE COMPTE :
--
--   1. `stores.devices` — l'assiette réellement devisée et payée. Elle fait foi
--      quand elle existe : c'est ce que le client a signé.
--   2. le plafond de l'offre de l'entreprise (`companies.plan`) — c'est le cas
--      d'une souscription en ligne, que `deposer_souscription` n'écrit PAS dans
--      `stores.devices` (vérifié le 4 septembre 2026). Sans ce repli, un client
--      qui a souscrit Advanced en ligne n'aurait aucun plafond du tout.
--   3. rien — et alors rien n'est refusé (borne n° 3).
--
-- ⚠️ LES TROIS NOMBRES (2, 20, 100) ET LA TRANCHE DE DIX SONT LA COPIE DE
-- `OFFRES[].max` ET DE `SUPPLEMENT.par` DANS `web/lib/offres.ts`. Le site et la
-- base ne compilent pas ensemble : c'est la même duplication assumée que la
-- grille de `_shared/devis.ts`, avec le même remède — un test de garde compare
-- les deux, et ils bougent ensemble.
create or replace function public.plafond_appareils(p_store_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dec integer;
begin
  select coalesce(
           s.devices,
           case c.plan
             when 'essential'  then 2
             when 'advanced'   then 20
             when 'enterprise' then 100
             else null
           end)
    into v_dec
    from public.stores s
    join public.companies c on c.id = s.company_id
   where s.id = p_store_id;

  if v_dec is null or v_dec < 1 then
    return null;
  end if;

  -- ⚠️ LE PLAFOND EST LE HAUT DU PALIER, PAS LE NOMBRE DEVISÉ. La grille vend
  -- des paliers : Advanced, c'est « 3 à 20 appareils » pour 310 €. Un client
  -- devisé sur 7 appareils paie Advanced et a donc droit à 20 — lui en refuser
  -- un huitième lui vendrait moins que ce que la page publique lui promet.
  -- C'est aussi ce qui rend la comparaison « besoin > plafond » lisible : les
  -- deux bornes sont alors sur la même échelle.
  if v_dec <= 2   then return 2;   end if;
  if v_dec <= 20  then return 20;  end if;
  if v_dec <= 100 then return 100; end if;
  -- Au-delà d'Enterprise, le palier se prolonge par tranches de dix ENTAMÉES,
  -- exactement comme `prixCents` les facture : 112 devisés, 120 couverts.
  return 100 + 10 * ceil((v_dec - 100) / 10.0)::integer;
end;
$$;

-- ⚠️ Fonction interne : elle n'a aucune raison d'être appelable par un client.
-- Les trois fonctions ci-dessous sont SECURITY DEFINER, elles s'exécutent avec
-- les droits du propriétaire et n'ont pas besoin de ce GRANT.
revoke all on function public.plafond_appareils(uuid) from public, anon, authenticated;
grant execute on function public.plafond_appareils(uuid) to service_role;


-- ── 4. Demander sa place ───────────────────────────────────────────────────
--
-- Appelée par le téléphone à l'ouverture d'un écran de comptage ou d'audit,
-- puis à chaque battement de présence pour garder la place.
--
-- ⚠️ LA FENÊTRE VAUT `STALE_MS` DE `lib/presence.ts` — 90 SECONDES — ET CE
-- N'EST PAS UNE COÏNCIDENCE. Le tableau de bord du superviseur considère un
-- appareil parti au bout de trois battements manqués ; si le verrou retenait sa
-- place plus longtemps, l'écran dirait « un appareil » pendant que le verrou en
-- compterait deux. Un seul silence, une seule conclusion. Le battement existant
-- porte l'appel : aucune minuterie nouvelle sur le téléphone.
create or replace function public.prendre_place_appareil(
  p_session_id uuid,
  p_appareil text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fenetre constant interval := interval '90 seconds';
  v_store   uuid;
  v_cle     text;
  v_plafond integer;
  v_deja    boolean;
  v_refuse  boolean;
  v_actifs  integer;
  v_jour    date := (now() at time zone 'Europe/Paris')::date;
begin
  -- La garde est l'appartenance à l'inventaire, comme pour un comptage : un
  -- compteur doit pouvoir demander sa place, c'est lui qui compte.
  if not public.is_session_participant(p_session_id) then
    return jsonb_build_object('accorde', false, 'code', 'interdit');
  end if;

  -- Une clé d'appareil est opaque et courte. On la borne ici plutôt que de
  -- faire confiance au téléphone : c'est la seule valeur que le client choisit.
  v_cle := btrim(coalesce(p_appareil, ''));
  if v_cle = '' or length(v_cle) > 64 or v_cle !~ '^[A-Za-z0-9._:-]+$' then
    return jsonb_build_object('accorde', false, 'code', 'cle_invalide');
  end if;

  select s.store_id into v_store
    from public.inventory_sessions s
   where s.id = p_session_id;
  if v_store is null then
    return jsonb_build_object('accorde', false, 'code', 'introuvable');
  end if;

  -- ⚠️ LE VERROU DE LIGNE SÉRIALISE LES DEMANDES CONCURRENTES SUR CE MAGASIN.
  -- Sans lui, deux téléphones qui demandent la dernière place au même instant
  -- lisent tous deux « une place libre » et l'obtiennent tous deux — le
  -- motif exact de VR-001 (28 août 2026), sur un objet différent.
  perform 1 from public.stores where id = v_store for update;

  -- Le ménage à la volée : la table ne garde que le présent. Borné à ce
  -- magasin, donc à quelques dizaines de lignes.
  delete from public.appareils_actifs
   where store_id = v_store and vu_le < now() - fenetre;

  v_plafond := public.plafond_appareils(v_store);

  -- Borne n° 1 : il est déjà là, il garde sa place quoi qu'il arrive. Ce
  -- chemin passe AVANT tout comptage, et c'est ce qui garantit qu'un plafond
  -- abaissé n'interrompt personne.
  --
  -- Une seule lecture pour les deux questions : tient-il déjà une place
  -- (`not refuse`), et s'est-il déjà vu refuser ? Les deux sont fausses s'il
  -- n'a aucune ligne — d'où les `coalesce`, qu'un `bool_or` sur zéro ligne
  -- rendrait nuls.
  select coalesce(bool_or(not refuse), false), coalesce(bool_or(refuse), false)
    into v_deja, v_refuse
    from public.appareils_actifs
   where store_id = v_store and appareil = v_cle;

  if not v_deja and v_plafond is not null then
    select count(*) into v_actifs
      from public.appareils_actifs where store_id = v_store and not refuse;
    if v_actifs >= v_plafond then
      -- ⚠️ LE REFUS SE COMPTE UNE FOIS PAR APPAREIL, PAS PAR TENTATIVE. Un
      -- téléphone éconduit redemande sa place toutes les trente secondes ;
      -- sans cette garde, « douze refus » voudrait dire « une personne a
      -- patienté six minutes », et ce chiffre décide d'une montée d'offre.
      if not v_refuse then
        insert into public.appareils_par_jour (store_id, jour, pic, refus)
          values (v_store, v_jour, 0, 1)
          on conflict (store_id, jour)
          do update set refus = appareils_par_jour.refus + 1;
      end if;
      -- L'appareil refusé garde une ligne — marquée, donc sans place — pour
      -- que sa prochaine demande sache qu'il a déjà été compté.
      insert into public.appareils_actifs (store_id, appareil, vu_le, refuse)
        values (v_store, v_cle, now(), true)
        on conflict (store_id, appareil) do update set vu_le = now(), refuse = true;
      return jsonb_build_object(
        'accorde', false, 'code', 'forfait_plein',
        'plafond', v_plafond, 'appareils', v_actifs);
    end if;
  end if;

  insert into public.appareils_actifs (store_id, appareil, vu_le, refuse)
    values (v_store, v_cle, now(), false)
    on conflict (store_id, appareil) do update set vu_le = now(), refuse = false;

  select count(*) into v_actifs
    from public.appareils_actifs where store_id = v_store and not refuse;

  -- Le pic ne retient que ce qui a été ACCORDÉ : un refus n'est pas de la
  -- consommation, et le faire entrer dans le pic ferait facturer du vide.
  insert into public.appareils_par_jour (store_id, jour, pic, refus)
    values (v_store, v_jour, v_actifs, 0)
    on conflict (store_id, jour)
    do update set pic = greatest(appareils_par_jour.pic, excluded.pic);

  return jsonb_build_object(
    'accorde', true, 'plafond', v_plafond, 'appareils', v_actifs);
end;
$$;

revoke all on function public.prendre_place_appareil(uuid, text) from public, anon;
grant execute on function public.prendre_place_appareil(uuid, text) to authenticated, service_role;


-- ── 5. Rendre sa place ─────────────────────────────────────────────────────
--
-- Appelée quand l'écran de comptage se ferme. Sans elle, la place resterait
-- prise quatre-vingt-dix secondes de plus, et un collègue qui prend le relais
-- sur un forfait plein attendrait pour rien.
--
-- ⚠️ Elle ne demande AUCUN droit particulier au-delà de l'appartenance : rendre
-- une place n'ouvre rien, et un appel de trop est sans conséquence.
create or replace function public.rendre_place_appareil(
  p_session_id uuid,
  p_appareil text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
begin
  if not public.is_session_participant(p_session_id) then
    return jsonb_build_object('success', false);
  end if;

  select s.store_id into v_store
    from public.inventory_sessions s where s.id = p_session_id;
  if v_store is null then
    return jsonb_build_object('success', false);
  end if;

  delete from public.appareils_actifs
   where store_id = v_store and appareil = btrim(coalesce(p_appareil, ''));

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.rendre_place_appareil(uuid, text) from public, anon;
grant execute on function public.rendre_place_appareil(uuid, text) to authenticated, service_role;


-- ── 6. Ce que le site en montre ────────────────────────────────────────────
--
-- ⚠️ MÊME PORTE QUE LE RAPPORT DU MAGASIN : `peut_lire_rapport_magasin`, donc
-- l'administrateur d'entreprise et l'administrateur Quantinvo, personne
-- d'autre. Ce n'est pas une donnée d'inventaire, c'est l'état d'une licence —
-- le superviseur d'un secteur n'a rien à en faire, et un compteur encore moins.
-- Une garde recopiée serait une garde qui divergera : elle a une définition.
create or replace function public.appareils_du_magasin(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fenetre constant interval := interval '90 seconds';
  jours   constant integer := 30;
  v_depuis date := (now() at time zone 'Europe/Paris')::date - jours;
  v_res jsonb;
begin
  if not public.peut_lire_rapport_magasin(p_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'plafond', public.plafond_appareils(p_store_id),
    'maintenant', (select count(*) from public.appareils_actifs
                    where store_id = p_store_id and not refuse
                      and vu_le >= now() - fenetre),
    'pic', coalesce((select max(pic) from public.appareils_par_jour
                      where store_id = p_store_id and jour >= v_depuis), 0),
    'pic_le', (select max(jour) from public.appareils_par_jour a
                where a.store_id = p_store_id and a.jour >= v_depuis
                  and a.pic = (select max(b.pic) from public.appareils_par_jour b
                                where b.store_id = p_store_id and b.jour >= v_depuis)),
    'refus', coalesce((select sum(refus) from public.appareils_par_jour
                        where store_id = p_store_id and jour >= v_depuis), 0),
    'refus_le', (select max(jour) from public.appareils_par_jour
                  where store_id = p_store_id and jour >= v_depuis and refus > 0),
    -- ⚠️ CE QU'IL AURAIT FALLU, LE JOUR OÙ IL EN A FALLU LE PLUS. C'est le
    -- chiffre qui décide de l'offre à proposer, et il ne peut PAS être le pic :
    -- une fois le verrou en place, le pic ne dépasse jamais le plafond, par
    -- construction. `pic + refus` du même jour est la seule mesure de la
    -- demande réelle dont on dispose. Elle MAJORE légèrement — deux appareils
    -- refusés à deux heures d'écart s'additionnent alors qu'ils n'étaient pas
    -- simultanés —, et l'écran le dit (« au moins »), il n'affirme pas.
    'besoin', coalesce((select max(pic + refus) from public.appareils_par_jour
                         where store_id = p_store_id and jour >= v_depuis), 0),
    'besoin_le', (select max(jour) from public.appareils_par_jour a
                   where a.store_id = p_store_id and a.jour >= v_depuis
                     and a.pic + a.refus = (select max(b.pic + b.refus)
                                              from public.appareils_par_jour b
                                             where b.store_id = p_store_id and b.jour >= v_depuis)),
    'jours', jours
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.appareils_du_magasin(uuid) from public, anon;
grant execute on function public.appareils_du_magasin(uuid) to authenticated, service_role;


-- ── 7. Le ménage ───────────────────────────────────────────────────────────
--
-- `appareils_actifs` se purge d'elle-même à chaque demande de place ; ce qui
-- reste ici, ce sont les magasins qui ont cessé de compter et dont plus
-- personne ne réveille les lignes. Sept jours suffisent — au-delà d'une minute
-- et demie, une ligne ne veut déjà plus rien dire.
--
-- `appareils_par_jour` porte deux nombres par magasin et par jour : on la garde
-- treize mois, de quoi comparer un inventaire annuel au précédent.
--
-- ⚠️ La fonction est REPOSÉE EN ENTIER, comme toujours : `create or replace` ne
-- fusionne rien. Ses droits sont reposés dans la même migration — `create` rend
-- EXECUTE à PUBLIC, et un `revoke … from public` ne retire pas `anon`.
create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invitations_ttl      constant interval := interval '3 months';
  demandes_sup_ttl     constant interval := interval '1 year';
  demandes_ent_rej_ttl constant interval := interval '1 year';
  demandes_ent_ttl     constant interval := interval '3 years';
  suppressions_ttl     constant interval := interval '1 year';
  journal_admin_ttl    constant interval := interval '1 year';
  journal_entrep_ttl   constant interval := interval '1 year';
  demandes_mag_ttl     constant interval := interval '1 year';
  evenements_ttl       constant interval := interval '30 days';
  notifications_ttl    constant interval := interval '90 days';
  messages_ttl         constant interval := interval '1 year';
  appareils_ttl        constant interval := interval '7 days';
  appareils_jour_ttl   constant interval := interval '13 months';
  rapport              jsonb := '{}'::jsonb;
  n                    int;
begin
  delete from public.team_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('team_invitations_supprimees', n);

  delete from public.session_invitations where created_at < now() - invitations_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('session_invitations_supprimees', n);

  update public.supervisor_requests
     set first_name = '', last_name = '',
         email = 'expire+' || id::text || '@invalide.local', phone = ''
   where status in ('active', 'rejected')
     and created_at < now() - demandes_sup_ttl
     and email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('supervisor_requests_anonymisees', n);

  delete from public.company_requests
   where status = 'rejected' and updated_at < now() - demandes_ent_rej_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_supprimees', n);

  update public.company_requests
     set contact_first_name = '', contact_last_name = '',
         contact_email = 'expire+' || id::text || '@invalide.local', contact_phone = ''
   where updated_at < now() - demandes_ent_ttl
     and contact_email not like 'expire+%';
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('company_requests_anonymisees', n);

  delete from public.account_deletion_requests where created_at < now() - suppressions_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('deletion_requests_supprimees', n);

  delete from public.admin_audit_log where created_at < now() - journal_admin_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_admin_supprime', n);

  delete from public.company_audit_log where created_at < now() - journal_entrep_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('journal_entreprise_supprime', n);

  delete from public.store_requests
   where handled_at is not null and handled_at < now() - demandes_mag_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('demandes_magasin_supprimees', n);

  delete from public.stripe_events_traites where recu_le < now() - evenements_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('evenements_stripe_supprimes', n);

  delete from public.notifications where created_at < now() - notifications_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('notifications_supprimees', n);

  delete from public.message_fils where dernier_le < now() - messages_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('fils_supprimes', n);

  delete from public.appareils_actifs where vu_le < now() - appareils_ttl;
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_actifs_supprimes', n);

  delete from public.appareils_par_jour
   where jour < ((now() at time zone 'Europe/Paris')::date - appareils_jour_ttl);
  get diagnostics n = row_count;  rapport := rapport || jsonb_build_object('appareils_par_jour_supprimes', n);

  return rapport || jsonb_build_object('execute_le', now());
end;
$$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
