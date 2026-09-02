-- « Article inconnu » : un compteur peut créer la ligne du code qu'il scanne.
--
-- CONSTAT (1er septembre 2026). L'écran de comptage propose « Article inconnu »
-- à tout le monde — c'est la sortie de secours quand une étiquette n'est pas au
-- référentiel. Mais `articles` n'avait que deux policies : lecture pour les
-- membres de l'inventaire, écriture pour les seuls superviseurs. Un compteur
-- qui remplissait ce formulaire recevait donc `42501` : « new row violates
-- row-level security policy ». Vérifié en base, session simulée, transaction
-- annulée.
--
-- Autrement dit, la fonctionnalité était **inatteignable pour le rôle à qui
-- elle est destinée**, et rien à l'écran ne l'expliquait. Le hors ligne l'a
-- révélée en faisant échouer la même saisie avec « fetch failed » : la file
-- d'attente créée le même jour aurait mis l'article de côté, l'aurait envoyé au
-- retour du réseau, et le serveur l'aurait refusé — l'échec aurait simplement
-- changé de moment.
--
-- ⚠️ TROIS BORNES, et elles ne sont pas décoratives :
--
--  1. INSERT SEULEMENT. Un compteur ajoute ce qui manque ; il ne récrit ni
--     n'efface le fichier importé par le superviseur. `articles_supervisor`
--     reste la seule policy `ALL`. L'unicité (session_id, sku) fait le reste :
--     un article existant ne peut pas être remplacé par une insertion.
--  2. INVENTAIRE OUVERT. Même condition que `counts_insert_member` : on
--     n'écrit rien dans un inventaire clôturé, dont le rapport est déjà sorti.
--  3. PRIX D'ACHAT À ZÉRO. Un compteur constate une **présence**, pas une
--     valeur : la valorisation vient du fichier du superviseur. Sans cette
--     borne, n'importe quel membre pourrait poser un prix arbitraire sur une
--     référence qu'il invente, et gonfler l'« écart valeur » du rapport. C'est
--     exactement ce que la modale envoie (`unit_purchase_price: 0`) — elle n'a
--     pas de champ prix.

DROP POLICY IF EXISTS "articles_insert_member" ON public.articles;

CREATE POLICY "articles_insert_member" ON public.articles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_members sm
      WHERE sm.session_id = articles.session_id
        AND sm.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.inventory_sessions s
      WHERE s.id = articles.session_id
        AND s.status <> 'closed'
    )
    AND unit_purchase_price = 0
  );
