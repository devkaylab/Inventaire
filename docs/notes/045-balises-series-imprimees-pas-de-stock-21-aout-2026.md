# Balises : séries imprimées, pas de stock (21 août 2026)

La création de balises ne passe plus par le serveur. Le superviseur choisit
une numérotation (simples `1, 2, 3…`, 4 chiffres `1000…9999`, 5 chiffres
`10000…99999`), un premier numéro et un nombre, et la planche PDF est produite
sur place. **Elle se crée partout où on en a besoin**, avec le mode d'emploi en
trois étapes (imprimer, coller, indiquer) écrit pour des personnes peu à l'aise :

- app : profil et écran Zones d'un inventaire (`BaliseCreator`, formulaire
  `BaliseSheetModal`, dessin `src/lib/balises.ts`) ;
- site : Mon compte et onglet Set up (`BaliseSheetPanel`, dessin
  `web/lib/balisePdf.ts`, téléchargement du PDF dans le navigateur).

La logique des séries est dupliquée volontairement (`src/lib/baliseSeries.ts`
et `web/lib/baliseSeries.ts`, un test garde l'identité : `web/tests/balises.test.ts`).
**Les deux dessins de planche doivent rester identiques** (gabarit Avery L7160,
QR `SCB1:<numéro>`) : une balise imprimée depuis le site doit se scanner comme
une balise imprimée depuis l'app. **Aucun compteur de balises n'est affiché**,
ni dans l'app ni sur le site : personne n'en a l'usage, les zones s'affectent
par plage libre (`define_zone`).

**Une balise hors plage se propose à l'ajout** (21 août 2026). Scanner une
balise qu'aucune plage ne couvre affichait « Balise non définie » avec un seul
bouton : le compteur restait devant une étiquette bien réelle sans moyen
d'avancer. L'alerte propose maintenant « Ajouter », qui rappelle `set_balise`
avec `p_allow_create := true` — la zone est créée sans emplacement, et le
superviseur la nomme ensuite depuis l'écran Zones. La création n'est **jamais**
tentée au premier passage : sans cette précaution, un numéro mal saisi créerait
une zone en silence.

Limite connue : **hors ligne, l'ajout n'est pas proposé**. La file accepte
l'ouverture sans interroger la base, et l'échec ne se découvre qu'à la
synchronisation, où l'opération part dans les échecs (`failedOps`). À reprendre
si le cas se présente en vrai.

La RPC `generate_company_balises` et la colonne `companies.balise_count`
**restent en base** tant que des builds mobiles antérieurs peuvent encore les
appeler — même règle que pour `get_session_activity` : code déployé d'abord,
objets supprimés ensuite. À supprimer dans une migration ultérieure, une fois
le nouveau build installé sur les téléphones ; ne plus rien y lire d'ici là.
