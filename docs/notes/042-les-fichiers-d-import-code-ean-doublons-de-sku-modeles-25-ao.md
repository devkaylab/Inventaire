# Les fichiers d'import : « Code Ean », doublons de SKU, modèles (25 août 2026)

Trois demandes de Julien après l'inventaire d'essai « Fwee », et les trois se
tiennent : sa colonne s'appelait **« Code Ean »**, inconnue des deux
`lib/import.ts` — donc tous les EAN sortaient nuls, **donc** les lignes au
même SKU s'écrasaient (« dernière valeur conservée ») au lieu d'être gardées
chacune sous son EAN.

- **`codeean` et `codeean13` sont dans `EAN_KEYS`**, des deux côtés. ⚠️ Les
  deux `lib/import.ts` sont dupliqués (l'app et le site ne compilent pas
  ensemble) : un test de `web/tests/import.test.ts` lit le fichier mobile et
  échoue si les listes divergent.
- **Les doublons de SKU voulus marchaient déjà** — un SKU peut porter
  plusieurs EAN (une taille par code-barres), chaque ligne supplémentaire est
  importée sous son EAN (contrainte UNIQUE (session_id, sku) oblige). Rien à
  « rendre possible » : c'est la colonne EAN non reconnue qui neutralisait ce
  mécanisme. Ne pas « corriger » l'écrasement des vrais doublons (même SKU
  sans EAN distinct) : lui est voulu.
- **Deux modèles à télécharger dans la boîte à outils du site**
  (`web/lib/modeles.ts`, `components/ModelesPanel.tsx`) : Référencement et
  Stock théorique, en `.xlsx` dessinés sur place par la bibliothèque déjà
  vendorisée. **Toutes les cellules sont des chaînes** — c'est ce qui type les
  colonnes en Texte dans Excel et préserve les zéros de tête, le piège que
  l'écran d'import documente. Le modèle Référencement montre le cas des
  doublons : ART-001 sur deux lignes, deux EAN. **Chaque modèle traverse son
  propre import dans un test** — un gabarit dont une colonne ne serait pas
  relue serait pire que pas de gabarit. Pas de fichiers statiques dans
  `public/` : ils divergeraient du code d'import sans qu'aucun test le voie.
  (La boîte à outils de l'app n'a pas ces modèles : un tableur s'ouvre sur un
  ordinateur, et l'import de fichiers est le travail du site.)

Vérifié au navigateur (route jetable, retirée) : le panneau en clair et en
sombre, et les deux téléchargements réels — classeurs relus, cellules en
texte. Tests de garde : `web/tests/import.test.ts`, blocs « Code Ean » et
« les modèles de la boîte à outils ».
