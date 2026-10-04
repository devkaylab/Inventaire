-- ⚠️ ON NE POUVAIT PAS LOUER QUANTINVO (4 octobre 2026).
--
-- `missions_inventoristes_check` exigeait `inventoristes >= 1`. C'était juste
-- tant qu'une mission voulait dire « on envoie une équipe » : une mission sans
-- personne n'avait alors aucun sens.
--
-- La grille à deux axes du 28 septembre a changé ça sans que personne ne le
-- voie : en formule `logiciel_seul`, le prix vient d'une tranche d'articles et
-- **`inventoristes` vaut 0**. Toute réservation de location échouait donc sur
-- la contrainte, avec un message de Postgres brut à l'écran :
--
--   new row for relation "missions" violates check constraint
--   "missions_inventoristes_check"
--
-- ⚠️ **ET AUCUN TEST NE POUVAIT LE VOIR.** La chaîne de prix est éprouvée à
-- l'unité, la contrainte vit en base : les deux étaient justes séparément. Il a
-- fallu réserver pour de vrai, sur une base réelle, pour que ça tombe. C'est
-- exactement ce que la base d'essai sert à faire.
--
-- Julien, le même jour : « on reste uniquement sur la partie où on met
-- Quantinvo à dispo, la notion "envoyer une équipe" est nulle ». Zéro
-- inventoriste n'est donc plus un cas limite : c'est le cas NORMAL.
--
-- La borne haute reste : 60 était le garde-fou d'une équipe, et il ne coûte
-- rien de le garder tant que la colonne existe.

alter table public.missions drop constraint if exists missions_inventoristes_check;
alter table public.missions add constraint missions_inventoristes_check
  check (inventoristes >= 0 and inventoristes <= 60);
