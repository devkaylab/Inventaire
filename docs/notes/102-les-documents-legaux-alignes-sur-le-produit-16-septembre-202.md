# Les documents légaux alignés sur le produit (16 septembre 2026)

Revue des CGV, de la politique de confidentialité et des mentions légales à la
demande de Julien (« on doit se back up »). Les CGV dataient du 30 août et
contredisaient le produit sur six points : devis pour plusieurs magasins,
« aucun compte sans invitation », **dépassement d'appareils toléré jusqu'au
renouvellement** (le verrou refuse l'appareil de trop depuis le 4 septembre),
cycle d'un magasin ajouté, changement d'offre, identité de la société en
crochets. Tout est récrit dans `docs/entreprise/cgv-quantinvo-brouillon.md`.

Ajouts demandés : **article 9.5, usage limité aux Magasins déclarés** (un lieu
non déclaré est facturé au Client) ; **articles 8.4 à 8.6, sauvegardes ≠
archivage**, effacement du détail des comptages à douze mois, conservation et
suppressions à la charge du Client ; 13.2 exclut la responsabilité pour ces
pertes. La politique de confidentialité ne déclarait pas **Stripe** ni les
données de paiement et la conservation des factures (dix ans) : corrigé, et la
garde des prestataires l'exige désormais.

~~Ce qui bloquait~~ — **fait le jour même** (« fais 1 et 2 », Julien) :

- **Les conditions sont publiées** sur `/conditions-generales` (plan du site,
  pied de page). ⚠️ **La page LIT le fichier du dépôt à la construction** et ne
  garde que le passage entre « ## 1. Identification » et « ## Points à
  trancher » ; `passagePublie` fait ÉCHOUER le build s'il y reste un crochet,
  un ⚠️, un chemin ou un backtick. Les crochets ont donc été remplacés par des
  valeurs par défaut, listées au point 0 des « Points à trancher » — **à faire
  confirmer par le juriste**. L'annexe 1 (sous-traitance) est écrite en entier.
- **Elles s'acceptent** par une case (`AccepterConditions`, jamais cochée
  d'avance) sur l'inscription, la souscription et l'ajout de magasin — pas sur
  un changement d'offre, qui relève du contrat déjà accepté. ⚠️ **La preuve est
  en base** : les trois dépôts refusent (`code: 'conditions'`) toute version
  différente de `version_conditions()`, et consignent `cgv_version` +
  `cgv_acceptees_le` sur la demande. `VERSION_CONDITIONS` (site) et
  `version_conditions()` (base) bougent ENSEMBLE — un test les compare.
  Modifier le texte substantiellement = changer les deux.
- **L'adresse de chaque magasin est exigée** (8 à 200 caractères,
  `adresse_propre`) et suit jusqu'à `stores.address` à la création. Les
  magasins d'avant ce jour n'en ont pas.
- Migration `20260916120001` (trois dépôts en DROP puis CREATE, droits
  reposés) ; `inscription`, `subscribe-online` et `libre-service` redéployées,
  `verify_jwt` inchangé, fichiers identiques au dépôt.

Reste : **la relecture juridique**, et l'adresse n'est affichée nulle part
encore (ni fiche magasin ni console).

Tests de garde : `web/tests/offres.test.ts`, `web/tests/confidentialite.test.ts` et `web/tests/conditions-generales.test.ts`.
