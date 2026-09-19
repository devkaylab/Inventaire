# Le détail d'une balise, et de quoi la reprendre (2 septembre 2026)

*« Je m'aperçois qu'il n'y a pas de détail de ce qui a été scanné par balise sur
le site. Je veux pouvoir cliquer sur le numéro de balise et voir ce qui a été
compté dessus. »* Maquette validée avant codage :
https://claude.ai/code/artifact/6d6c86cd-cffe-4b4e-82c9-8a3862375c4b

La fenêtre existait déjà — cliquer sur une balise l'ouvrait pour clôturer un
cycle resté ouvert. Elle ne disait pas ce qu'il y avait dedans : « 2
référence(s) comptée(s) », et rien d'autre. Pour savoir ce qu'un rayon avait
donné, il fallait ouvrir le rapport de l'inventaire entier et y chercher sa
balise.

## Ce que la fenêtre montre

Une ligne par référence : article, comptage, audit, écart. Plus deux marqueurs
qui disent ce qui ne se lit pas dans les chiffres — « créé au scan » pour un
article né d'« Article inconnu », « arbitré · N » pour une ligne dont un
superviseur a tranché la quantité.

- **⚠️ L'écart ne s'affiche qu'une fois l'audit de la BALISE clôturé.** Tant
  qu'il tourne, une quantité auditée à zéro ne distingue pas « l'auditeur n'a
  rien trouvé » de « l'auditeur n'est pas encore passé ». C'est déjà la règle de
  `computeDiscrepancies` ; l'afficher quand même accuserait quelqu'un à tort.
  Le serveur ne calcule donc **pas** l'écart : il rend les deux quantités et le
  statut de l'audit, `ecartLigne` (`web/lib/zones.ts`) décide. Une ligne
  **arbitrée** se tait aussi — la quantité retenue remplace la comparaison.
- **⚠️ Bornée à une balise.** `get_session_detail` produisait déjà ce tableau,
  mais pour l'inventaire entier : le rapatrier au navigateur pour n'en montrer
  qu'un rayon est exactement le motif retiré en août 2026 pour la tenue en
  charge. D'où `get_balise_detail(p_session_id, p_code)`, qui ne descend jamais
  que la balise regardée. Ne pas « simplifier » en filtrant côté client.
- **Une référence ramenée à zéro n'apparaît pas.** `counts` est en ajout pur :
  un article scanné puis entièrement corrigé a des lignes et zéro pièce. Même
  filtre que `get_session_detail` — la balise 1000 de La Samaritaine porte six
  références en base, la fenêtre en montre deux.
- La fenêtre passe à **640 px** (`.modal-large`) : quatre colonnes ne tiennent
  pas dans les 460 px des modales du site. La liste défile à l'intérieur — un
  rayon peut porter deux cents références, la fenêtre ne grandit pas avec lui.
- **Pas de nom de compteur** (décision de Julien). La donnée existe et vit dans
  le rapport, où elle sert à arbitrer ; l'onglet Suivi a été dépersonnalisé le
  19 août 2026 et décrit le travail, pas les personnes.

## ⚠️ « Rouvrir » a quitté le site

Décision de Julien : rouvrir une balise est un geste de **terrain**, qui n'a de
sens que sur le téléphone de la personne qui va la recompter. Rouverte depuis un
ordinateur, elle restait ouverte sur aucun appareil, et la seule chose qui avait
changé était le tableau de bord. Le site affiche donc, à la place du bouton,
« Pour rouvrir, passez par l'application ».

Ce qui reste : **clôturer**, avec un libellé qui dit ce qu'il fait — « Marquer
comptée » / « Marquer auditée » plutôt qu'un « Marquer terminé » commun aux
deux. Un test refuse la réapparition d'un `setBalise(..., true)` dans cet écran.

## ⚠️ Vider une balise — et pourquoi ce n'est pas VR-007

`vider_balise(p_session_id, p_code)` efface les comptages **et** les audits
d'une balise, puis remet ses deux cycles à « pas commencé » : elle redevient à
faire. Pour une balise comptée dans le mauvais rayon, ou un comptage à reprendre
de zéro — sans ce geste il fallait corriger article par article.

C'est la demande explicite de Julien, et elle ressemble à ce que la revue de
sécurité du 28 août avait retiré. **La différence est ce qui rend ce geste
acceptable, et il faut la garder en tête avant d'y toucher :**

- ce qui a été fermé par VR-007, c'est la policy `counts_delete_supervisor` —
  un DELETE **sur un critère choisi par le client**, qui permettait d'effacer en
  masse les lignes de toute l'équipe. Ici le périmètre est **fixé par le
  serveur** : une balise, entière, nommée. Exactement comme `delete_audit_line`
  est bornée à un SKU dans une zone. **Ne jamais l'élargir à une liste de
  balises ni à un filtre libre** — un test refuse un paramètre tableau ;
- **elle laisse une trace.** L'aggravation relevée par VR-007 était que `counts`
  n'est journalisée nulle part : la destruction ne se voyait pas après coup. La
  ligne écrite dans `company_audit_log` (`balise_videe`) porte l'inventaire, la
  balise, l'emplacement, le nombre de lignes et de pièces. L'administrateur de
  l'entreprise la lit depuis /journal — d'où le libellé dans
  `web/lib/journal.ts`, sans quoi le mot technique s'afficherait brut ;
- **elle refuse un inventaire clôturé.** Son rapport est sorti, souvent exporté :
  en effacer les comptages ferait bouger un document déjà remis.
  `delete_audit_line`, écrite avant cette règle, ne fait pas ce contrôle ;
- **un compteur est refusé** : la garde est `can_access_session`, qui exige le
  rôle superviseur. Vérifié — un compteur membre de l'inventaire ne peut ni
  vider ni même lire le détail.

Côté écran, deux précautions : le bouton vit **sous un filet, à distance** des
deux clôtures (`.balise-zone-sensible`), et la confirmation **exige la recopie
du numéro de balise** (`requireText`) — il est à quelques centimètres de
« Marquer comptée » et efface le travail de toute l'équipe sur ce rayon. Même
motif que la suppression d'un compte.

## Vérifications

- **En base, en transactions annulées, sur les données réelles de La
  Samaritaine** : le détail rend bien deux lignes sur les six références de la
  balise 1000 (les quatre autres à zéro sont écartées) ; un compteur est refusé
  sur les deux fonctions ; balise inexistante, code vide, inventaire clôturé et
  compte étranger sont refusés nommément ; le vidage réel efface 50 lignes et
  6 audits, remet la balise en `pending/pending` avec `count_done_at` à nul,
  **laisse la balise 1001 intacte**, et écrit la ligne de journal attendue.
  Zéro résidu contrôlé après annulation (63 comptages, 10 audits, journal à 4).
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), clair
  et sombre : les trois états, l'écart affiché ou tu selon le statut de l'audit,
  les deux marqueurs, un libellé long et une quantité à six chiffres — aucun
  débordement horizontal, ni du document ni du tableau.

## ⚠️ « Marquer auditée » reprend le comptage quand personne n'a audité

Constat de Julien le jour même : *« marquer auditée alors qu'il n'y a pas de
quantité auditée doit prendre le compte d'origine, c'est-à-dire celui du
compteur »*. Il avait raison, et le défaut était **antérieur à ce chantier** :
ce bouton ne faisait que basculer `zones.audit_status`, et la conséquence se
lisait ailleurs. L'audit déclaré terminé, l'écart devient calculable — et toutes
les références de la balise sortaient à **moins la totalité du comptage**, comme
si l'auditeur était passé et n'avait rien trouvé. Ranger un audit que personne
n'a fait fabriquait une démarque intégrale sur ce rayon.

`cloturer_audit_balise` remplace `set_balise` **pour ce seul bouton**.

- **⚠️ La reprise n'a lieu que si la balise n'a AUCUNE ligne de passe 2, jamais
  référence par référence.** C'est la garde qui protège le produit : quand
  personne n'est passé, il n'existe aucun jugement d'auditeur à contredire ; mais
  un auditeur qui est passé et n'a **pas retrouvé** un article compté, c'est
  précisément la démarque que l'inventaire existe pour révéler — la reprendre
  l'effacerait en silence. Une balise auditée à moitié garde donc ses écarts.
  Vérifié : sur une balise partiellement auditée, `reprises` vaut 0 et rien ne
  bouge. **Arbitré par Julien le 2 septembre 2026**, la question lui ayant été
  posée explicitement : *« cela ne concerne que les balises avec aucun audit,
  donc on reste comme ça »*. Ne pas « compléter » cette fonction en la passant
  par SKU — c'est une décision, pas un raccourci.
- **⚠️ Elle écrit de vraies lignes de comptage en passe 2**, et c'est
  obligatoire : `article_audit` est **dérivée** de `counts` par
  `recompute_session_audit`. Poser `final_qty` à la main serait défait au premier
  recalcul, que l'onglet Écarts déclenche à la demande. La fonction recalcule
  elle-même dans la foulée, sans quoi l'onglet afficherait l'état d'avant.
- **`counted_by` est le superviseur qui déclenche**, pas le compteur d'origine :
  c'est lui qui prend la responsabilité de la reprise, et le rapport doit
  pouvoir le nommer.
- **Une référence ramenée à zéro n'est pas reprise** (`having sum(c.qty) > 0`) :
  il n'y a rien à confirmer.
- **⚠️ L'application mobile garde `set_balise`.** Un auditeur physiquement
  devant le rayon qui n'a rien scanné n'a **rien trouvé** — lui reprendre le
  comptage effacerait son constat. La reprise est un geste de bureau.
- L'écran prévient avant : ce n'est plus un changement d'état, des lignes sont
  écrites. La confirmation annonce combien de références seront reprises et dit
  que la balise sortira sans écart.

Tests de garde : `web/tests/zones.test.ts`.
