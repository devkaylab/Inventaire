-- ─────────────────────────────────────────────────────────────────────────
-- Autorisation Realtime : la présence d'un inventaire n'appartient qu'à ses
-- participants.  (Constat C1 de l'audit du 13 août 2026.)
--
-- Toute la base est verrouillée par RLS — sauf le temps réel, qui ne passe pas
-- par la base. Les canaux de présence étaient créés en mode **public**, et
-- `realtime.messages` n'avait aucune policy. Un canal public ne consulte
-- aucune autorisation : il suffisait de connaître l'UUID d'un inventaire, qui
-- figure dans l'URL du tableau de bord et que tout participant connaît, pour
-- lire en continu le nom des compteurs, leur balise ouverte, leur mode et leur
-- présence au premier plan. Et pour y émettre.
--
-- Conséquence la plus nette : `remove_session_member` coupait l'accès aux
-- données mais pas l'écoute du canal. Retirer quelqu'un d'un inventaire
-- n'était donc pas effectif.
--
-- Note sur l'état constaté : la RLS était bien **activée** sur la table
-- parente `realtime.messages` (les partitions affichent `false`, ce qui prête
-- à confusion — c'est la parente qui fait foi). Ce qui manquait, ce sont les
-- policies : sans elles, un canal privé est refusé à tout le monde, et
-- l'application utilisait donc des canaux publics.
--
-- Cette migration pose l'autorisation. Elle ne change rien tant que les
-- clients n'ont pas basculé en `private: true` — les canaux publics
-- continuent d'ignorer ces policies. C'est délibéré : on veut pouvoir poser
-- la règle sans interrompre un inventaire en cours.
--
-- Appliquée en base live via l'outil MCP.
-- ─────────────────────────────────────────────────────────────────────────

-- Extrait l'inventaire d'un nom de canal et vérifie la participation.
-- Format attendu : `session:<uuid>:presence` (voir src/lib/presence.ts et
-- web/lib/presence.ts, qui doivent rester d'accord sur ce contrat).
--
-- Tout autre nom de canal est refusé : mieux vaut fermer par défaut et ouvrir
-- explicitement le jour où un second canal apparaîtra.
create or replace function public.can_join_session_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_match text[]; v_id uuid;
begin
  if p_topic is null then return false; end if;
  v_match := regexp_match(p_topic, '^session:([0-9a-fA-F-]{36}):presence$');
  if v_match is null then return false; end if;
  begin
    v_id := v_match[1]::uuid;
  exception when others then
    return false;
  end;
  return public.is_session_participant(v_id);
end;
$function$;

revoke all on function public.can_join_session_topic(text) from public, anon;
grant execute on function public.can_join_session_topic(text) to authenticated;

-- Lecture et écriture du canal : réservées aux participants, et jamais au
-- rôle `anon` — un visiteur non connecté n'a rien à faire sur la présence.
drop policy if exists session_presence_read on realtime.messages;
create policy session_presence_read
  on realtime.messages for select to authenticated
  using (public.can_join_session_topic(realtime.topic()));

drop policy if exists session_presence_write on realtime.messages;
create policy session_presence_write
  on realtime.messages for insert to authenticated
  with check (public.can_join_session_topic(realtime.topic()));
