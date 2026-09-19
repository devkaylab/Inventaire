# Le clavier ne cache plus les champs (2 septembre 2026)

*« Saisir quelque chose comme le mot de passe ou le code inventaire, le clavier
sur des plus petits écrans cache les champs de saisie. »* Constat de Julien.

## ⚠️ La cause, LUE dans la source de React Native

`KeyboardAvoidingView` mélange deux repères, et il faut l'avoir lu pour ne pas
tourner en rond (`Libraries/Components/Keyboard/KeyboardAvoidingView.js`) :

- il mémorise sa géométrie avec `this._frame = event.nativeEvent.layout`,
  c'est-à-dire **relative à son parent** ;
- il calcule
  `Math.max(frame.y + frame.height - (keyboardFrame.screenY - offset), 0)`,
  où `screenY` est en coordonnées **écran**.

Les deux ne coïncident que si le parent commence en haut de l'écran. Sous un
en-tête de navigation, le rembourrage est donc **court de toute la hauteur de
l'en-tête** — environ 91 points sur un téléphone à encoche. Sur un grand écran
la marge restante absorbe l'erreur ; sur un petit, le dernier champ passe sous
le clavier. Aucun `keyboardVerticalOffset` n'existait dans le projet.

## ⚠️ IL EN FAUT DEUX, ET C'EST MESURÉ

Les trois configurations ont été photographiées au simulateur, clavier logiciel
ouvert, sur le dernier champ de « Mot de passe ». C'est le cœur de ce chantier,
et aucune des deux moitiés ne suffit :

| configuration | résultat |
|---|---|
| garde-clavier avec le bon décalage, seul | **champ couvert** — il rétrécit la zone visible, il ne déplace rien |
| `automaticallyAdjustKeyboardInsets`, seul | **champ couvert** — UIKit pose l'encart mais ne fait pas défiler |
| **les deux ensemble** | **champ ET bouton dégagés** |

Le rétrécissement du cadre déclenche la passe d'UIKit qui amène le premier
répondant à l'écran. La règle est donc : `ClavierEvite` **autour**, et le
`ScrollView` **à l'intérieur** portant `automaticallyAdjustKeyboardInsets` et
`keyboardShouldPersistTaps="handled"`. Retirer l'un des deux ramène le défaut —
un test le vérifie sur les neuf écrans à champs.

## `ClavierEvite`, une seule définition de la règle

- **La hauteur se lit dans `HeaderHeightContext`, pas par `useHeaderHeight()`** :
  ce hook LÈVE une exception hors d'un écran à en-tête, et deux écrans n'en ont
  pas (la connexion, la planche de balises). Le contexte rend `undefined`, donc
  aucun décalage — exactement la réponse voulue.
- **Chemin interne d'expo-router**, comme `usePreventRemove` : un test vérifie
  que le fichier existe, sans quoi une mise à jour d'Expo ferait retomber le
  décalage à zéro **en silence**.
- **⚠️ ANDROID SUIT LA MÊME RÈGLE, et c'est un renversement de ce que le projet
  croyait.** Le motif laissait `behavior` indéfini là-bas, en s'appuyant sur
  `android:windowSoftInputMode="adjustResize"` — bien présent dans le manifeste
  généré. Mais le thème est **bord à bord** (`statusBarColor` et
  `navigationBarColor` transparents) et la cible est l'API 36 : depuis
  Android 15, le système n'y redimensionne plus la fenêtre, c'est à
  l'application de consommer l'encart du clavier. **Le garde-clavier ne faisait
  donc RIEN DU TOUT sur le Pixel**, quelle que soit la taille de l'écran —
  constaté appareil en main, champ et bouton sous le clavier. `padding` est sûr
  dans les deux mondes : si une version d'Android redimensionne encore, la
  hauteur mesurée exclut déjà le clavier et le calcul rend zéro.
- Plus aucun `KeyboardAvoidingView` nu dans l'application — treize écrans
  convertis, un test refuse la réapparition.

## L'écran de connexion ne défilait pas du tout

Il n'avait **aucun `ScrollView`** : avec le clavier ouvert sur un petit écran,
le bouton « Se connecter » devenait non pas masqué mais **inatteignable**.
⚠️ Son `container` passe de `flex: 1` à **`flexGrow: 1`** : c'est ce qui lui
permet de rester centré quand il y a la place ET de défiler sinon. Avec
`flex: 1`, le contenu est contraint à la zone visible et rien ne défile.

## ⚠️ Deux pièges de méthode, à ne pas refaire

1. **`autoFocus` ne reproduit pas un appui.** Il place le curseur AVANT que le
   clavier existe, donc rien ne peut faire défiler — la première mesure a
   accusé à tort `automaticallyAdjustKeyboardInsets`. Un focus différé de 1,5 s,
   clavier déjà ouvert, est la sonde fidèle.
2. **Le simulateur est en clavier MATÉRIEL par défaut**, donc le clavier
   logiciel ne s'affiche jamais et tout semble tenir à l'écran :
   `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false`,
   puis relancer Simulator. **Le remettre après** (`defaults delete`) : c'est
   une préférence de la machine, pas du projet.

## ⚠️ Et une règle de garde, tirée de quatre échecs le même jour

**Une garde qui vérifie une ABSENCE doit lire le code sans ses commentaires.**
Quatre tests ont échoué aujourd'hui sur leur propre documentation — le fichier
explique pourquoi il n'utilise pas telle fonction, donc il la cite. Le motif
était déjà écrit pour `formulaires-publics.test.ts` et pour le comptage des
`for update` ; il vaut désormais pour toute assertion en `not.toContain`.

## Ce qui est prouvé, et ce qui ne l'est pas

- **iOS : réglé et vérifié.** Champ ET bouton dégagés, clavier ouvert, sur le
  dernier champ de « Mot de passe ».
- **Android : réglé pour l'usage.** Avant, rien ne bougeait du tout. Maintenant
  le contenu défile et **le champ visé est visible**, ce qui était la plainte.
  Le bouton de validation demande encore de faire défiler ou de refermer le
  clavier, et ⚠️ **sur Android un glissement REFERME le clavier** — mesuré,
  `mInputShown` passe à faux au premier `swipe`.
  · **⚠️ ARBITRÉ PAR JULIEN le 2 septembre 2026, appareil en main : « c'est bon
    j'ai testé, aucune gêne ».** Ne pas y revenir sans qu'il le redemande. Trois
    hypothèses ont déjà été démenties par la mesure dans cette seule journée, et
    ce qui reste ne coûte rien à l'usage : le poursuivre reviendrait à risquer
    une régression sur un défaut que personne ne ressent.
- **✅ Confirmé par Julien, appareil en main, le 2 septembre 2026** : « testé et
  c'est fonctionnel », sur les deux plateformes et sur l'écran où il avait vu le
  défaut. C'est la seule preuve qui valait pour ce chantier — de mon côté, le
  plus petit appareil disponible faisait 6,1 pouces (ni iPhone SE au
  simulateur, ni écran plus petit sous la main), donc la correction n'était
  mesurée que sur la mécanique : le champ passe au-dessus du clavier.

Tests de garde : `tests/compte.test.ts`, bloc « le clavier ne cache plus les
champs ».
