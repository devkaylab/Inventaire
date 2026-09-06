-- Les deux policies des premiers jours (6 septembre 2026)
--
-- Troisième et dernière passe du rattrapage. Après les neuf objets (5 sept.) et
-- les cinq colonnes (ce matin), la question de Julien — « est-ce
-- problématique ? » — méritait une mesure plutôt qu'une opinion : sur les
-- 37 policies, les 6 déclencheurs et les 29 index explicites de la base,
-- **deux policies** n'étaient décrites nulle part. Les déclencheurs et les index
-- le sont tous.
--
-- ⚠️ CE N'ÉTAIT PAS UN TROU DE SÉCURITÉ, ET C'EST VÉRIFIÉ, PAS SUPPOSÉ. Les
-- deux sont correctement cloisonnées — l'une par l'appartenance à l'inventaire,
-- l'autre par `is_admin()`. Ce qui posait problème n'était pas leur contenu :
-- c'est qu'une revue de sécurité menée depuis le dossier ne les aurait pas vues.
-- La règle du projet (« l'analyse porte sur la base réelle, jamais sur
-- `supabase/migrations/` ») existait précisément pour ça ; elle n'a plus à
-- couvrir ce cas.
--
-- Comme les deux passes précédentes : ce fichier déclare l'existant sous garde
-- d'absence, et l'appliquer ne change aucune ligne de catalogue.

do $policies$
begin
  -- Un membre d'un inventaire lit le catalogue de CET inventaire.
  --
  -- ⚠️ C'est la policy qui rend le comptage possible : sans elle, un compteur
  -- ne verrait aucun article et chaque scan sortirait « inconnu ». Elle est
  -- bornée par `session_members`, donc un membre ne voit que les inventaires
  -- où il a été ajouté — jamais le catalogue d'un autre client.
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'articles'
                    and policyname = 'articles_member_read') then
    create policy articles_member_read on public.articles for select using (
      exists (select 1 from public.session_members sm
               where sm.session_id = articles.session_id and sm.user_id = auth.uid())
    );
  end if;

  -- L'administrateur Quantinvo lit toutes les entreprises.
  --
  -- ⚠️ `is_admin()` porte l'exigence aal2 conditionnelle depuis le 19 août
  -- 2026 : une session restée au mot de passe seul n'ouvre pas cette lecture.
  -- Sa voisine `companies_member_select` borne, elle, chaque client à la
  -- sienne — et le code d'entreprise reste illisible dans les deux cas, la
  -- colonne étant révoquée en SELECT (`20260807000003`).
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'companies'
                    and policyname = 'companies_admin_select') then
    create policy companies_admin_select on public.companies for select using (is_admin());
  end if;
end;
$policies$;
