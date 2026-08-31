const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins')

/**
 * ⚠️ Android repeignait l'application lui-même.
 *
 * Constat de Julien le 31 août 2026, en compteur sur le Pixel : « la page
 * change de couleur dark puis clair ou vice versa », et une moitié d'écran
 * dans un thème, l'autre dans l'autre — l'en-tête clair, la liste noire.
 *
 * Le gabarit Expo produit `Theme.AppCompat.DayNight`, qui **suit le mode nuit
 * du système**. Quand ce mode bascule — et le Pixel était en « auto », donc au
 * coucher du soleil — Android applique son *force dark* : il assombrit
 * algorithmiquement les vues qu'il croit claires. Les cartes ressortaient en
 * `#000000` et le fond en `#08090C`, deux valeurs **qui ne sont dans aucune de
 * nos deux palettes** — c'est ce qui a trahi le mécanisme.
 *
 * Or l'application gère son thème elle-même (`src/lib/theme.tsx` : clair,
 * sombre, ou système, avec préférence mémorisée). Deux autorités pour une
 * seule décision, et elles ne se parlent pas.
 *
 * ⚠️ Cela ne peut PAS se régler dans `app.json` : `userInterfaceStyle` n'écrit
 * qu'une chaîne lue par expo-system-ui, elle ne touche pas au thème Android.
 * Et `android/` est un dossier GÉNÉRÉ, donc éditer `styles.xml` à la main ne
 * survivrait pas au prochain `prebuild`. D'où ce plugin — c'est le chemin que
 * la note « la configuration durable passe par app.json ou par un plugin »
 * prévoit exactement.
 *
 * ⚠️ iOS n'a pas d'équivalent et n'a jamais eu le défaut : ne pas chercher de
 * symétrie ici.
 */
module.exports = function withAndroidForceDark(config) {
  return withAndroidStyles(config, (cfg) => {
    cfg.modResults = AndroidConfig.Styles.assignStylesValue(cfg.modResults, {
      add: true,
      parent: { name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' },
      name: 'android:forceDarkAllowed',
      value: 'false',
    })
    return cfg
  })
}
