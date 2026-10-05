-- ⚠️⚠️ UN INVENTAIRE OUVERT À LA FOIS, SUR UN MAGASIN LOUÉ (Julien, 5 octobre 2026).
--
-- ⚠️⚠️ CETTE MIGRATION TOUCHE QUANTINVO OS : elle pose un DÉCLENCHEUR sur
-- `public.inventory_sessions`, une table du produit qui tourne. Elle n'y
-- réécrit rien — ni fonction, ni policy — mais tout `insert` d'inventaire,
-- abonné compris, passera désormais par son code. Son premier test est fait
-- pour qu'il ressorte aussitôt (voir plus bas), et son retrait est écrit dans
-- `scripts/replique/90-retirer.sql`.
--
-- « Comme j'ai réservé pour un inventaire sur deux magasins, je peux n'avoir
--   qu'une session d'inventaire à la fois par magasin. »
--
-- Il l'énonçait comme un fait acquis. Ce n'en était pas un : `create_session`
-- vérifie le rôle, l'entreprise et l'affectation du magasin — jamais le nombre
-- d'inventaires déjà ouverts. Dix sur le même magasin passaient, et c'est
-- exactement le défaut décrit le 4 octobre : « deux à l'écran, rien pour dire
-- lequel compte, et tout son travail dans l'autre ».
--
-- ⚠️ **LA RÈGLE NE VAUT QUE POUR LES LOCATIONS**, et c'est son choix explicite
-- (question du 5 octobre, option « seulement les locations »). Un abonné
-- Quantinvo OS paie un abonnement avec des appareils, pas « un inventaire » :
-- rien ne justifie de lui retirer une liberté qu'il a aujourd'hui, et l'app est
-- publiée — Bon Marché compte dedans.
--
-- ⚠️ **D'OÙ UN DÉCLENCHEUR À CÔTÉ, ET NON UNE LIGNE DANS `create_session`.**
-- Cette fonction est du Quantinvo OS pur, appelée par l'application ET par le
-- site de tous les abonnés (`src/lib/queries.ts`, `web/lib/inventory.ts`). La
-- règle d'AGENTS.md — On-Demand AJOUTE à côté, ne réécrit rien — vaut pour une
-- fonction autant que pour une policy.
--
-- Contrepartie assumée, annoncée avant de choisir : le refus remonte en
-- exception, donc à l'écran avec son code technique entre crochets
-- (`web/lib/errors.ts` le garde exprès), au lieu du `{success:false, error}`
-- soigné que rendrait `create_session`. L'écran l'affiche : `dashboard/new`
-- attrape et passe par `friendlyError`.
--
-- ⚠️ **CE QUI DÉSIGNE UN MAGASIN LOUÉ : LA FENÊTRE, PAS L'ABONNEMENT NI UNE
-- LISTE D'ÉTATS.**
--
-- Première fausse piste : `plafond_appareils() is null`. Elle rend `null` pour
-- un magasin sans appareils déclarés — mais AUSSI pour une entreprise au plan
-- `standard`, qui n'est pas dans sa liste de cas. S'en servir seul aurait
-- plafonné un abonné.
--
-- Seconde fausse piste : énumérer les états morts (`annulee`, `remboursee`,
-- `echouee`, …). Inutile, et `missions_etat_check` en compte seize : dès qu'une
-- mission tombe dans l'un d'eux, le déclencheur `missions_acces` appelle
-- `fermer_les_acces_mission`, qui pose `acces_expirent_le = least(coalesce(…,
-- now()), now())` — donc une date PASSÉE. La fenêtre dit déjà tout :
--
--   · `acces_expirent_le is null`  → réservée, pas encore ouverte : préparation ;
--   · `acces_expirent_le > now()`  → la semaine court ;
--   · `acces_expirent_le <= now()` → fini, quelle qu'en soit la raison.
--
-- Vérifié sur les deux missions de la base d'essai : l'annulée porte bien une
-- date passée sans avoir jamais été ouverte.
--
-- ⚠️ Reste un cas non borné : une réservation jamais ouverte par la console
-- garde `null` indéfiniment, donc le magasin reste limité. C'est tenable — le
-- client n'a alors aucun appareil non plus, et il n'a loué qu'un inventaire ;
-- et le jour où il s'abonne pour de vrai, `plafond_appareils` cesse d'être nul
-- et la règle le lâche. C'est à ça que sert le second test, pas à reconnaître
-- une location.
create or replace function public.un_seul_inventaire_sur_un_magasin_loue()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Aucune réservation vivante sur ce magasin : rien à dire. C'EST CE TEST QUI
  -- TIENT LA RÈGLE HORS DE QUANTINVO OS — un abonné qui n'a jamais loué ne lit
  -- jamais la suite.
  if not exists (
    select 1
      from public.missions m
     where m.store_id = new.store_id
       and (m.acces_expirent_le is null or m.acces_expirent_le > now())
  ) then
    return new;
  end if;

  -- Il s'est abonné depuis : il n'est plus locataire, il est client.
  if public.plafond_appareils(new.store_id) is not null then
    return new;
  end if;

  if exists (
    select 1
      from public.inventory_sessions s
     where s.store_id = new.store_id
       and s.status <> 'closed'
  ) then
    raise exception 'Un inventaire est déjà ouvert sur ce magasin. Clôturez-le avant d''en créer un autre.';
  end if;

  return new;
end;
$function$;

revoke all on function public.un_seul_inventaire_sur_un_magasin_loue() from public, anon, authenticated;

drop trigger if exists sessions_un_seul_en_location on public.inventory_sessions;
create trigger sessions_un_seul_en_location
  before insert on public.inventory_sessions
  for each row execute function public.un_seul_inventaire_sur_un_magasin_loue();
