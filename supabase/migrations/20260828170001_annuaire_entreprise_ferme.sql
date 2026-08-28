-- ─────────────────────────────────────────────────────────────────────────
-- L'annuaire de toute l'entreprise n'est plus joignable (28 août 2026).
--
-- Constat n°7 de la revue de sécurité. `get_company_directory` rend le nom et
-- l'adresse e-mail de **chaque personne de l'entreprise**. Elle est
-- correctement cloisonnée — `company_id = get_my_company()`, donc jamais un
-- autre client — mais elle ne regarde pas le rôle de qui appelle : un
-- **compteur** pouvait récupérer l'annuaire complet, superviseurs compris.
--
-- Sa voisine `get_store_directory` exige `is_assigned_store`. La différence
-- n'avait pas l'air voulue.
--
-- ⚠️ LE CORRECTIF N'EST PAS UN CONTRÔLE DE RÔLE, C'EST UN RETRAIT. Vérifié
-- avant d'écrire : **plus aucun écran ne l'appelle**. Les deux applications
-- passent par `get_store_directory` depuis le 7 août 2026 (commit `8ba7e30`,
-- « invitation limitée à l'équipe du magasin »), et le téléphone a été
-- reconstruit plusieurs fois depuis. Une fonction que personne n'appelle et
-- qui rend les adresses de toute une entreprise n'a pas besoin d'un garde :
-- elle a besoin d'être injoignable.
--
-- L'enveloppe morte `getCompanyDirectory` part de `src/lib/queries.ts` dans le
-- même commit — c'est elle qui donnait l'illusion d'un appelant.
--
-- La fonction elle-même **reste en base**, comme le veut la règle du projet :
-- on retire le droit d'abord, on supprime l'objet plus tard, quand plus aucun
-- appel résiduel n'arrive. `service_role` la garde, si un dépannage en avait
-- besoin.
-- ─────────────────────────────────────────────────────────────────────────

revoke all on function public.get_company_directory() from public, anon, authenticated;

comment on function public.get_company_directory() is
  'Annuaire de toute l''entreprise (nom + e-mail). Plus joignable depuis les clients depuis le 28 aout 2026 : aucun ecran ne l''appelle, et un compteur y lisait les adresses de tout le monde. Utiliser get_store_directory, qui exige is_assigned_store.';
