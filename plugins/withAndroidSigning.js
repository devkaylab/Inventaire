const { withAppBuildGradle } = require('expo/config-plugins')

/**
 * La signature de publication d'Android.
 *
 * ⚠️ **Le gabarit Expo signe le release avec la clé de DEBUG.** C'est
 * commode — l'APK s'installe sur un téléphone sans rien configurer — et
 * **interdit sur Google Play** : la boutique refuse un binaire signé par la
 * clé de débogage publique du SDK Android, que tout le monde possède. C'est
 * écrit depuis le 29 août dans AGENTS.md ; ce plugin est ce qui le règle.
 *
 * ⚠️ **Cela ne peut pas s'écrire dans `android/`** : le dossier est GÉNÉRÉ et
 * ignoré par git, une modification à la main disparaîtrait au prochain
 * `expo prebuild`. C'est le chemin que la note « toute configuration durable
 * passe par app.json ou par un plugin » prévoit.
 *
 * ⚠️ **Et le secret n'entre jamais dans le dépôt.** Les quatre valeurs sont
 * lues dans les propriétés Gradle de la machine — `~/.gradle/gradle.properties`
 * —, jamais dans un fichier versionné, jamais dans `app.json`. Un dépôt privé
 * reste un dépôt : une clé de signature qui fuit permet de publier une mise à
 * jour de l'application à notre place.
 *
 * ⚠️ **Sans ces propriétés, le build release retombe sur la clé de debug** au
 * lieu d'échouer. C'est délibéré : `pixel.sh` doit continuer à produire un APK
 * installable sur le téléphone de test sans rien demander à personne. C'est la
 * commande de publication (`./scripts/play.sh`) qui, elle, refuse de produire
 * un AAB non signé — le contrôle est là où il protège, pas là où il gêne.
 *
 * Les quatre propriétés à poser dans `~/.gradle/gradle.properties` :
 *
 *   QUANTINVO_UPLOAD_STORE_FILE=/Users/…/quantinvo-upload.keystore
 *   QUANTINVO_UPLOAD_STORE_PASSWORD=…
 *   QUANTINVO_UPLOAD_KEY_ALIAS=upload
 *   QUANTINVO_UPLOAD_KEY_PASSWORD=…
 */
const BLOC = `
    // Signature de publication — posée par plugins/withAndroidSigning.js.
    // Les valeurs viennent de ~/.gradle/gradle.properties, jamais du dépôt.
    quantinvoUpload {
        if (project.hasProperty('QUANTINVO_UPLOAD_STORE_FILE')) {
            storeFile file(QUANTINVO_UPLOAD_STORE_FILE)
            storePassword QUANTINVO_UPLOAD_STORE_PASSWORD
            keyAlias QUANTINVO_UPLOAD_KEY_ALIAS
            keyPassword QUANTINVO_UPLOAD_KEY_PASSWORD
        }
    }
`

module.exports = function withAndroidSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents

    if (g.includes('quantinvoUpload')) return cfg

    // 1. Déclarer la configuration de signature, à côté de celle de debug.
    g = g.replace(/(signingConfigs \{\n)/, `$1${BLOC}`)

    // 2. La faire employer par le type release — mais seulement si la clé
    //    est réellement configurée sur la machine.
    g = g.replace(
      /(buildTypes \{[\s\S]*?release \{\n)([\s\S]*?)(signingConfig signingConfigs\.debug)/,
      (_m, tete, milieu) =>
        `${tete}${milieu}signingConfig project.hasProperty('QUANTINVO_UPLOAD_STORE_FILE') ? signingConfigs.quantinvoUpload : signingConfigs.debug`,
    )

    cfg.modResults.contents = g
    return cfg
  })
}
