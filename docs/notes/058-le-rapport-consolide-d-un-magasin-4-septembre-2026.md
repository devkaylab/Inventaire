# Le rapport consolidé d'un magasin (4 septembre 2026)

*« Commence d'abord par le rapport par magasin, qui sera également consultable
par l'admin entreprise en plus de admin Quantinvo. »* Un grand magasin ouvre un
inventaire par étage, par réserve, par corner : jusqu'ici personne ne pouvait
dire ce que le magasin, **entier**, avait donné. Maquette validée avant codage :
https://claude.ai/code/artifact/271da757-20b0-4728-b83f-610a265ae127

Migration `20260904180001` (plus `…180002`, qui donne à la liste l'identité du
magasin), écran `/magasins/<id>/rapport`, atteint depuis la fiche du magasin et
depuis la fiche entreprise de la console.

## Les quatre décisions, et elles ne se devinent pas dans le code

- **⚠️ QUI Y A ACCÈS : l'administrateur d'entreprise et l'administrateur
  Quantinvo, personne d'autre.** Julien : « le superviseur d'un secteur n'a pas
  besoin de voir le rapport de son collègue d'un autre secteur du magasin ». Il
  garde le rapport de SES inventaires, par l'onglet Rapport de chacun. La garde
  vit en un seul point — `peut_lire_rapport_magasin`, révoquée à `anon` **et à
  `authenticated`** : les quatre fonctions qui l'appellent sont SECURITY
  DEFINER, elles n'ont pas besoin de ce droit. Une garde recopiée quatre fois,
  c'est VR-006 qui recommence.
- **⚠️ SEULS LES INVENTAIRES CLÔTURÉS S'ADDITIONNENT, et c'est le SERVEUR qui
  le décide**, pas la case cochée. Un inventaire en cours ferait bouger le
  rapport d'heure en heure. Il est **listé** — le cacher ferait croire à un
  magasin qui ne compte plus — mais pas cochable, et un identifiant d'inventaire
  ouvert passé quand même est simplement absent du résultat.
- **⚠️ LES QUANTITÉS S'ADDITIONNENT, et le rapport le SIGNALE.** Arbitré par
  Julien. D'où `doublons` dans le résumé, un bandeau qui le dit, la colonne
  « Inventaires » du tableau, et un filtre « Ne voir que celles-ci ». Une
  référence vue deux fois n'est pas une anomalie dans un magasin qui compte
  étage par étage ; on ne laisse pas le lecteur le découvrir.
- **⚠️ LE PÉRIMÈTRE EST UNE LISTE D'INVENTAIRES, jamais une plage de dates
  posée en base.** Les deux dates (90 jours par défaut) ne font que *proposer*
  une sélection ; ce qui part au serveur est ce qui est coché. Sans cela, deux
  écrans ouverts sur la même période ne montreraient pas la même chose dès
  qu'un inventaire est clôturé entre-temps.

## Ce qui porte le calcul

- **⚠️ LA VALEUR SE CALCULE INVENTAIRE PAR INVENTAIRE, PUIS S'ADDITIONNE.**
  `articles.unit_purchase_price` est porté **par inventaire** : le même SKU peut
  valoir 41 € en septembre et 38 € en août. Un prix moyen serait une invention —
  d'où l'absence de colonne « Prix achat unitaire » dans l'export, et l'absence
  de colonne « Statut » (un statut d'audit appartient à un inventaire, pas à un
  magasin). La valeur, elle, reste juste, et c'est exactement ce que le client
  retrouve en additionnant ses rapports.
- **Les quatre tuiles se décomposent** (Σ compté×prix − Σ théo×prix, par
  inventaire) : pas d'univers de SKU à fabriquer. Seuls le nombre de références
  et le nombre de doublons demandent de rassembler l'univers — une passe, une
  agrégation.
- **⚠️ Le filtre d'inventaire se pose AVANT le `full join`**, jamais dans le
  `on` : c'est le piège du matin même (800 156 lignes au lieu de 400 000). Les
  deux côtés sont filtrés par leur jointure sur `sess`.
- **Le périmètre reste fixé par le serveur** : `store_id = p_store_id`, liste
  bornée à **200** inventaires, page bornée à **5 000** lignes, ordre **total**
  (le SKU départage). La fiche d'un article (libellé, marque, code-barres) n'est
  cherchée que pour les 50 lignes affichées, et c'est la plus récente : un
  référentiel réimporté a pu changer le libellé entre deux inventaires.
- **⚠️ `p_sessions` est une liste choisie par le client** — le motif que VR-007
  a fermé — mais en lecture, et chaque identifiant est confronté au magasin
  visé, lui-même confronté à l'entreprise de l'appelant. Ne jamais l'élargir à
  un filtre libre.

## L'export

Deux feuilles, comme le rapport d'un inventaire : **« Consolidé »** (une ligne
par référence, tous inventaires additionnés, plus le nombre d'inventaires) et
**« Par inventaire »** (la même chose ligne par ligne, avec l'inventaire
d'origine). La seconde est la contrepartie de l'addition : sans elle, un écart
de 12 pièces sur une référence vue dans trois inventaires ne se rattache à aucun
rayon. Le fichier contient **tout** le périmètre, demandé par tranches de 5 000.

**⚠️ La feuille « Par inventaire » porte la DATE DE CLÔTURE** (Julien, le jour
même : « par inventaire dans le rapport il faut ajouter la date »). Quand une
référence revient dans trois lignes, c'est elle qui dit laquelle est la plus
récente — le numéro (`INV-AAAAMMJJ-XXXX`) ne le dit qu'à qui connaît la
nomenclature. Elle est **formatée en base, en Europe/Paris** : un horodatage
brut arriverait en UTC dans le tableur et daterait du 12 août un inventaire
clôturé le 13 à une heure du matin. Migration `20260904190001`, en `drop` puis
`create` — on ne change pas une liste de colonnes de retour par un
`create or replace`.

`forceTextColumns` est sortie de `downloadXlsx` (`forcerEnTexte`) : les deux
exports ont les mêmes colonnes de codes, et deux copies de cette boucle
divergeraient au premier ajout de colonne.

## Vérifications

- **En base, en transactions annulées, sur les fonctions réellement
  appliquées** : le résumé d'un magasin à un inventaire est **identique au
  centime** à `rapport_resume` de ce même inventaire ; sur trois inventaires,
  les six chiffres correspondent à un recalcul indépendant ; une référence
  injectée dans deux inventaires ressort à **9 unités théoriques** (4 + 5) et
  **−75 €** (−4×10 puis −5×7 — la preuve que le prix reste celui de chaque
  inventaire), `doublons` passe à 1 et le filtre « multi » ne rend qu'elle.
- **La matrice d'accès** : admin d'entreprise et admin Quantinvo passent ;
  superviseur, compteur, admin d'une autre entreprise et `anon` sont refusés ;
  la garde interne est injoignable même pour `authenticated`. Un inventaire en
  cours et un inventaire d'un autre magasin passés dans la liste sont **ignorés**
  (1 retenu au lieu de 2).
- **Zéro résidu contrôlé** : 29 553 articles, 165 comptages, 62 audits,
  156 lignes de stock, 1 inventaire clôturé — identiques à avant.
- **Les gardes mordent** : cinq sabotages (statut clôturé retiré, borne des 200
  retirée, garde de l'écran ouverte à tous, garde interne accordée à
  `authenticated`, une des deux paginations supprimée) font échouer exactement
  les cinq tests correspondants.
- **Au navigateur**, par route jetable (retirée, `git status` contrôlé), **clair
  et sombre**, à 1280 px et à 820 px : le périmètre, la liste cochable, les
  quatre tuiles, le bandeau et son filtre, le tableau. **Débordement horizontal
  nul** aux deux largeurs. Un défaut trouvé ainsi : les deux champs de date
  étaient sur `--surface-2`, qui vaut `#fff` en clair — donc sans fond sur un
  panneau blanc. Même défaut que `.magasin-top input` le 22 août 2026.
- 961 tests du site, `tsc --noEmit`, `eslint .` à **zéro erreur**, `next build`
  avec la table de routes inchangée plus `/magasins/[storeId]/rapport`.

**Non vu à l'écran** : la page complète demande une session d'administrateur
d'entreprise ou de Quantinvo, que je n'ai pas. Ce qui est prouvé, c'est que les
quatre chemins serveur répondent juste et aux bonnes personnes, et que le rendu
tient dans les deux thèmes.

**Ce qui n'est pas mesuré** : le rapport d'un magasin portant plusieurs
inventaires de 400 000 références. La consolidation demande l'univers des SKU —
elle ne se décompose pas — et le plafond reste 8 s. Les jeux de démonstration
ayant été supprimés, ce chiffre-là attend un vrai gros client ; l'écran dit
alors « le serveur a mis trop de temps » et invite à réduire le périmètre,
plutôt que d'afficher un zéro.

Tests de garde : `web/tests/rapport-magasin.test.ts`.
