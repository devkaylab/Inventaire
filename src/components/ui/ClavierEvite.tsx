import { useContext } from 'react'
import { KeyboardAvoidingView, Platform, type ViewStyle } from 'react-native'
// ⚠️ Chemin interne, comme `usePreventRemove` : expo-router embarque sa copie
// de react-navigation mais n'expose pas ses éléments au premier niveau. Un
// test vérifie que ce fichier existe — sans lui, une mise à jour d'Expo ferait
// retomber le décalage à zéro EN SILENCE, et le défaut reviendrait sans qu'une
// seule erreur ne le signale.
import { HeaderHeightContext } from 'expo-router/build/react-navigation/elements'

/**
 * Le clavier ne recouvre plus les champs.
 *
 * ⚠️ **POURQUOI UN DÉCALAGE EST NÉCESSAIRE, et ce n'est pas une superstition.**
 * Lu dans la source de React Native
 * (`Libraries/Components/Keyboard/KeyboardAvoidingView.js`) plutôt que déduit :
 *
 * - la vue mémorise sa géométrie avec `this._frame = event.nativeEvent.layout`,
 *   c'est-à-dire **relative à son parent** ;
 * - elle calcule ensuite
 *   `Math.max(frame.y + frame.height - (keyboardFrame.screenY - offset), 0)`,
 *   où `screenY` est en coordonnées **écran**.
 *
 * Les deux repères ne coïncident que si le parent commence en haut de l'écran.
 * Sous un en-tête de navigation, `frame.y + frame.height` vaut à peu près
 * « hauteur d'écran moins hauteur d'en-tête », alors que le clavier est mesuré
 * depuis le vrai sommet : **le rembourrage est court de toute la hauteur de
 * l'en-tête**, environ 91 points sur un téléphone à encoche.
 *
 * Sur un grand écran la marge restante absorbe l'erreur et personne ne la voit.
 * Sur un petit, le dernier champ passe sous le clavier — constat de Julien, le
 * 2 septembre 2026, sur le mot de passe et le code d'inventaire.
 *
 * ⚠️ **La hauteur se lit dans le CONTEXTE, pas par `useHeaderHeight()`.** Ce
 * hook LÈVE une exception hors d'un écran à en-tête (« Couldn't find the header
 * height »), et deux de nos écrans n'en ont pas — la connexion et la planche de
 * balises. Le contexte rend `undefined` dans ce cas, ce qui est exactement la
 * réponse voulue : aucun décalage.
 *
 * ⚠️ **ANDROID A LA MÊME RÈGLE, et c'est un renversement.** Le motif du projet
 * laissait `behavior` indéfini là-bas, en s'appuyant sur
 * `android:windowSoftInputMode="adjustResize"` — bien présent dans le manifeste
 * généré. Mais le thème est **bord à bord** (barres transparentes) et la cible
 * est l'API 36 : depuis Android 15, le système n'y redimensionne plus la
 * fenêtre, c'est à l'application de consommer l'encart du clavier. Le
 * garde-clavier ne faisait donc **rien du tout** sur le Pixel, quelle que soit
 * la taille de l'écran — vérifié appareil en main, clavier ouvert, champ et
 * bouton sous le clavier.
 *
 * `padding` est sûr dans les deux mondes : si une version d'Android
 * redimensionne encore, la hauteur mesurée exclut déjà le clavier et le calcul
 * rend zéro.
 *
 * ⚠️ **IL EN FAUT DEUX, ET C'EST MESURÉ, PAS DÉDUIT.** Les trois
 * configurations ont été photographiées au simulateur, clavier logiciel ouvert,
 * sur le dernier champ de « Mot de passe » :
 *
 * - ce composant SEUL : le champ reste couvert. Un garde-clavier autour d'un
 *   `ScrollView` ne déplace rien — il rétrécit la zone visible, et le contenu
 *   reste ancré en haut ;
 * - `automaticallyAdjustKeyboardInsets` SEUL : couvert aussi. UIKit pose bien
 *   l'encart, mais ne fait pas défiler jusqu'au champ visé ;
 * - **les deux ensemble : le champ ET le bouton dégagés.** Le rétrécissement du
 *   cadre déclenche la passe d'UIKit qui amène le premier répondant à l'écran.
 *
 * Donc : ce composant AUTOUR, et le `ScrollView` À L'INTÉRIEUR portant
 * `automaticallyAdjustKeyboardInsets` et `keyboardShouldPersistTaps="handled"`.
 * Retirer l'un des deux ramène le défaut.
 */
export function ClavierEvite({
  children,
  style,
}: {
  children: React.ReactNode
  style?: ViewStyle
}) {
  const entete = useContext(HeaderHeightContext)

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={entete ?? 0}
      style={style ?? { flex: 1 }}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
