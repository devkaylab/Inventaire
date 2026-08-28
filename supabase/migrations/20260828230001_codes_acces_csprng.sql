-- VR-004 — les codes d'accès sortent d'un générateur cryptographique.
--
-- `gen_store_code()` et `gen_company_code()` tiraient leurs caractères avec
-- `random()`, le générateur pseudo-aléatoire ordinaire de PostgreSQL (CWE-338).
--
-- Or `join_code` EST un secret dans ce produit : c'est la clé d'entrée dans un
-- magasin, et la colonne est révoquée en SELECT pour `anon` et `authenticated`
-- précisément pour qu'un compteur ne la voie jamais. L'incohérence se voyait à
-- côté : les jetons de devis utilisent `gen_random_uuid()`, cryptographique.
-- Le produit choisissait le bon générateur pour le lien d'un devis, et le
-- mauvais pour la clé d'entrée d'un magasin.
--
-- Portée réelle, sans la surestimer : l'espace est de 32^6 ≈ 1,07 milliard, la
-- devinette au hasard n'est pas praticable, et l'exploitation supposerait
-- d'observer plusieurs codes issus du même processus serveur pour inférer
-- l'état du générateur. C'est un défaut de robustesse, pas une urgence — mais
-- il ne coûte rien à fermer.
--
-- ⚠️ `extensions.gen_random_bytes`, QUALIFIÉ PAR SON SCHÉMA. Supabase installe
-- pgcrypto dans `extensions`, et ces fonctions figent `search_path` à
-- 'public' : l'appel nu échoue avec « function gen_random_bytes(integer) does
-- not exist ». Constaté en appliquant — la première version de cette migration
-- a cassé la création de magasin le temps de s'en apercevoir. `gen_random_uuid`
-- ne pose pas ce problème : depuis PG13 elle est dans `pg_catalog`.
--
-- ⚠️ `% 32` NE BIAISE PAS ici, et c'est ce qui rend le modulo acceptable :
-- l'alphabet fait exactement 32 caractères et 256 est un multiple de 32, donc
-- chaque caractère a la même probabilité. Cela cesserait d'être vrai si on
-- touchait à l'alphabet — l'ambiguïté visuelle (I, O, 0, 1) en est déjà exclue,
-- il n'y a pas de raison d'y revenir.
--
-- ⚠️ LES CODES EXISTANTS NE CHANGENT PAS. Les regénérer invaliderait les codes
-- déjà affichés aux clients et communiqués à leurs équipes. Le correctif ne
-- vaut que pour ce qui sera créé après.

create or replace function public.gen_store_code()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; v_i int; v_octets bytea;
begin
  loop
    v_code := '';
    v_octets := extensions.gen_random_bytes(6);
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_octets, v_i - 1) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.stores where join_code = v_code);
  end loop;
  return v_code;
end; $function$;

create or replace function public.gen_company_code()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; v_i int; v_octets bytea;
begin
  loop
    v_code := '';
    v_octets := extensions.gen_random_bytes(6);
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_octets, v_i - 1) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.companies where join_code = v_code);
  end loop;
  return v_code;
end; $function$;

-- ⚠️ ET LA RÉVOCATION EST LA MOITIÉ LA PLUS UTILE DU CORRECTIF. Les deux
-- fonctions étaient exécutables par `authenticated` : n'importe quel compte
-- connecté pouvait donc appeler `gen_store_code()` autant de fois qu'il
-- voulait et observer les sorties du générateur. C'est précisément l'oracle
-- qui rend une faiblesse de PRNG exploitable — inférer l'état interne demande
-- d'observer la suite. Sans lui, il n'y a plus rien à observer.
--
-- Vérifié avant de révoquer : les six appelants (admin_create_company,
-- create_company, fulfil_paid_request, admin_fulfil_company_request,
-- admin_add_store) sont TOUS en SECURITY DEFINER, donc ils s'exécutent sous le
-- propriétaire et ne dépendent pas de ce droit.
revoke all on function public.gen_store_code() from public, anon, authenticated;
revoke all on function public.gen_company_code() from public, anon, authenticated;
