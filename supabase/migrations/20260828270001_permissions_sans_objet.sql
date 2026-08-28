-- VR-007, VR-008, VR-009 — trois permissions que personne n'utilise et qui
-- permettent plus que ce qu'elles devraient.
--
-- ⚠️ Les trois se corrigent par un RETRAIT, pas par un resserrement. C'est la
-- règle apprise avec `get_company_directory` le 28 août : une permission que
-- personne n'appelle et qui ouvre plus que nécessaire n'a pas besoin d'un
-- contrôle de rôle, elle a besoin d'être injoignable. Chaque retrait ci-dessous
-- a été précédé d'une vérification de l'absence d'appelant, dans le code de
-- l'app **et** du site **et** des fonctions edge.

-- ── VR-007 · un superviseur invité ne peut plus effacer les comptages ───────
--
-- La policy autorisait :
--   DELETE on counts : get_my_role() = 'supervisor' AND is_session_participant(session_id)
-- sans aucune restriction sur `counted_by`. Tout superviseur participant
-- pouvait donc supprimer n'importe quelle ligne de la session — celles de
-- toute l'équipe, en une requête.
--
-- ⚠️ C'ÉTAIT LA MOITIÉ RESTÉE OUVERTE DU TROU FERMÉ LE 21 AOÛT. Ce jour-là,
-- `delete_session` a été réservée au créateur et à l'administrateur
-- d'entreprise, et la policy DELETE d'`inventory_sessions` supprimée, parce
-- qu'« un co-superviseur pouvait effacer comptages, stock théorique, audits,
-- membres et référentiel d'un inventaire qu'il n'avait pas créé ». L'inventaire
-- était protégé ; son contenu se vidait encore ligne à ligne. Et `counts`
-- n'est pas journalisée : la destruction ne laisse aucune trace.
--
-- ⚠️ CE QUE CE RETRAIT NE TOUCHE PAS, ET C'EST LE POINT. Un superviseur invité
-- sur un inventaire y est parce qu'il supervise aussi : il ne peut ni
-- clôturer ni supprimer, mais il doit pouvoir superviser et **arbitrer**. Rien
-- de cela ne passe par cette policy :
--
--   · `resolve_audit` (l'arbitrage, qui pose `final_qty`) est SECURITY
--     DEFINER, gardée par `can_access_session` : hors RLS, inchangée ;
--   · `delete_audit_line` — le geste légitime de retrait d'une ligne — est
--     elle aussi SECURITY DEFINER et gardée par `can_access_session`. Elle
--     supprime dans `counts`, mais **bornée à un SKU dans une zone**, et elle
--     est appelée par l'app (`src/lib/queries.ts`) comme par le site
--     (`web/lib/inventory.ts`). Elle continue de fonctionner à l'identique ;
--   · la lecture des comptages (`counts_select_supervisor`) ne bouge pas ;
--   · les corrections restent des lignes négatives — `counts` est en ajout pur
--     et n'a toujours aucune policy UPDATE.
--
-- Ce qui disparaît est donc la seule chose qu'aucun écran n'offrait : la
-- suppression brute, en masse, sur un critère choisi par le client. Vérifié
-- avant d'écrire : aucun `delete` sur `counts` dans l'app, le site ou les
-- fonctions edge — `src/lib/queries.ts` ne fait que `select` et `insert`.

drop policy if exists counts_delete_supervisor on public.counts;

-- ── VR-008 · l'invariant de `profiles` ne se contourne plus par l'INSERT ────
--
-- `profiles_pin_privileged` fige `role`, `company_id` et `is_admin` — mais
-- c'est un déclencheur BEFORE **UPDATE**. La policy `profiles_insert`
-- autorisait un client à insérer sa propre ligne (`id = auth.uid()`) sans
-- aucune contrainte sur ces colonnes.
--
-- ⚠️ C'est la forme exacte de VR-003 : un invariant posé sur un verbe,
-- contourné par un autre.
--
-- Non atteignable aujourd'hui, et il faut savoir pourquoi la protection
-- tenait : `handle_new_user` crée le profil dans la même transaction que
-- l'insertion dans `auth.users`, donc la ligne existe avant que la personne
-- puisse s'authentifier ; `id` est clé primaire, donc un second INSERT échoue ;
-- et il n'existe aucune policy DELETE sur `profiles`, donc personne ne peut
-- faire disparaître sa ligne pour la recréer. La sûreté tenait à un
-- enchaînement, pas à une règle.
--
-- Vérifié : aucun client n'insère de profil. `handle_new_user` est SECURITY
-- DEFINER, donc hors RLS — le retrait de la policy ne la gêne pas.
-- `profiles_update` reste en place : chacun modifie son prénom et son nom.

drop policy if exists profiles_insert on public.profiles;

-- ── VR-009 · `join_code` n'est plus modifiable en droits de colonne ─────────
--
-- Le code d'accès est bien **illisible** par un client : sur `stores`,
-- `authenticated` ne peut lire que `company_id, created_at, id, name`. Mais la
-- révocation d'origine n'avait porté que sur SELECT — `anon` et
-- `authenticated` gardaient INSERT, UPDATE et REFERENCES sur la colonne, dans
-- `stores` comme dans `companies`.
--
-- Inexploitable aujourd'hui : ces deux tables n'ont aucune policy d'écriture,
-- donc la RLS refuse tout write client avant que le droit de colonne n'entre
-- en jeu. C'est une permission sans objet — mais le jour où quelqu'un ajoute
-- une policy UPDATE sur `stores` (pour renommer un magasin sans passer par une
-- RPC, par exemple), le code d'accès deviendrait modifiable par un
-- superviseur : de quoi verrouiller dehors les compteurs d'un magasin, ou y
-- poser un code déjà partagé.

revoke insert, update, references on public.stores from anon, authenticated;
revoke insert, update, references on public.companies from anon, authenticated;
