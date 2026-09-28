// `app.config` doit être DANS l'application, et son absence doit se voir.
//
// ⚠️⚠️ **CETTE GARDE VIENT D'UN REFUS D'APPLE**, le 22 septembre 2026 :
// version 1.0 build 5, Guideline 2.1(a), plantage au lancement, revue sur un
// iPad Air 11" (M3). Vérifié sur l'archive réellement livrée :
// `EXConstants.bundle` ne contenait que son `Info.plist` — `app.config` était
// absent.
//
// La chaîne, remontée dans le code installé :
//
//   Constants.expoConfig est nul
//     → expo-linking `resolveScheme()` LÈVE, sans condition, en autonome
//       (« needs access to the expo-constants manifest »)
//     → et expo-router l'appelle AU DÉMARRAGE : getInitialURL() →
//       getLinkingURL() rend null quand l'app est ouverte depuis l'écran
//       d'accueil → getRootURL() → Linking.createURL('/')
//     → exception JS non rattrapée, ~116 ms, RCTFatal → abort, avant tout
//       rendu. Trois rapports de crash sur trois, identiques.
//
// ⚠️ **ET CE N'ÉTAIT PAS UN DÉFAUT D'iPAD.** Le build 5 se fermait aussi sur
// iPhone ; Apple est simplement tombée dessus sur un iPad.
//
// ⚠️ **CAUSE POSSIBLE, PAS CAUSE DÉMONTRÉE.** Les archives des builds 2, 3 et
// 4 manquaient du même fichier. Le défaut est réel et la garde reste bonne,
// mais il n'explique pas à lui seul le refus du build 5.
//
// ⚠️ **CE QUI A LAISSÉ PASSER ÇA, C'EST DU SILENCE**, à deux endroits :
// une phase Xcode en `if [ -f "$SRC" ]; then cp …; fi` qui ne faisait rien
// quand la source manquait, et un contrôle d'avant-dépôt qui se contentait
// d'un avertissement. Les deux rendaient un vert. Cette garde tient les deux
// fermés.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/**
 * Le script d'une phase, débarrassé de ses commentaires.
 *
 * ⚠️ **NEUVIÈME FOIS QUE CE PIÈGE SE PRÉSENTE SUR CE DÉPÔT.** L'en-tête de la
 * phase CITE le chemin fautif pour expliquer ce qu'on a retiré ; une garde qui
 * lit le texte brut se signale donc elle-même. Une garde doit lire le CODE.
 */
const sansCommentaires = (s: string) =>
  s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

/** Le script d'une phase Xcode, déséchappé depuis le pbxproj. */
function phaseXcode(nom: string): string {
  const pbx = lire('ios/Inventaire.xcodeproj/project.pbxproj')
  const m = new RegExp(`name = "${nom}";[\\s\\S]*?shellScript = "((?:[^"\\\\]|\\\\.)*)";`).exec(pbx)
  expect(m, `la phase « ${nom} » doit exister dans le projet Xcode`).toBeTruthy()
  return m![1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

describe('app.config est embarqué, et son absence se voit', () => {
  const phase = phaseXcode('Generate EXConstants app.config')

  /**
   * ⚠️ **GÉNÉRER, PAS COPIER.** L'ancienne phase recopiait depuis
   * `${BUILT_PRODUCTS_DIR}/../../EXConstants/…` — un chemin qui résout en
   * compilation ordinaire et PAS en archivage. C'est cette différence, et
   * elle seule, qui a livré une app qui ne s'ouvre pas.
   */
  it('la phase Xcode génère le fichier au lieu de le copier d’à-côté', () => {
    expect(phase).toContain('getAppConfig.js')
    expect(sansCommentaires(phase), 'plus de copie depuis le dossier d’un autre pod')
      .not.toContain('/../../EXConstants/')
  })

  /**
   * ⚠️ **ET ELLE DOIT ÉCHOUER FORT.** Un build qui passe au vert en livrant
   * une application qui se ferme au lancement est pire qu'un build rouge.
   */
  it('la phase interrompt le build si le fichier manque', () => {
    expect(phase, 'un test d’existence doit précéder la sortie en erreur')
      .toMatch(/if \[ ! -s "\$DEST\/app\.config" \]/)
    expect(phase).toContain('exit 1')
    expect(phase, 'et l’échec doit être visible dans le journal Xcode')
      .toMatch(/echo "error:/)
  })

  /**
   * ⚠️ **LE MOTIF SILENCIEUX NE DOIT PAS REVENIR.** `if [ -f … ]; then cp`
   * autour d'une étape obligatoire, c'est une étape facultative.
   */
  it('aucune phase du projet n’avale l’absence d’app.config', () => {
    const pbx = lire('ios/Inventaire.xcodeproj/project.pbxproj')
    expect(pbx, 'le test d’existence muet autour d’une copie est proscrit')
      .not.toMatch(/if \[ -f \\"\$SRC\\" \]; then\\n\s*cp/)
  })

  /**
   * ⚠️ **LA SECONDE BARRIÈRE.** `scripts/appstore.sh` inspectait l'archive et
   * se contentait d'un avertissement, au motif — faux — qu'`expo-constants`
   * n'avait qu'un lecteur, avec repli. Il en avait un second, sans repli, sur
   * le chemin du démarrage.
   */
  it('le contrôle d’avant-dépôt refuse au lieu d’avertir', () => {
    const script = lire('scripts/appstore.sh')
    // ⚠️ **LE BLOC, PAS UNE FENÊTRE DE N CARACTÈRES.** La première version
    // lisait 900 caractères à partir du test d'existence : elle débordait sur
    // « Aucun .ipa produit », qui porte son propre `exit 1`. Elle trouvait
    // celui-là et passait au vert même après sabotage. Trouvé en sabotant —
    // jamais en relisant.
    const debut = script.indexOf('if [[ ! -f "$APP/EXConstants.bundle/app.config" ]]')
    expect(debut, 'appstore.sh doit inspecter l’archive').toBeGreaterThan(0)
    const fin = script.indexOf('\nfi', debut)
    expect(fin, 'le bloc doit se refermer').toBeGreaterThan(debut)
    const bloc = script.slice(debut, fin)
    expect(bloc, 'l’absence doit faire sortir en erreur').toContain('exit 1')
    expect(bloc, 'et ne plus être présentée comme sans effet')
      .not.toContain('sans effet ici')
  })

  /**
   * ⚠️ **LE MOTIF QUI A ÉGARÉ LA DÉCISION** : « un seul appelant, et il a un
   * repli ». `expo-linking` lit `Constants.expoConfig` sans repli, et
   * `expo-router` l'appelle au démarrage. Si cette dépendance disparaît un
   * jour, la garde le dira — et on pourra rediscuter du motif.
   */
  it('expo-linking lève bien quand le manifeste manque', () => {
    const schemes = readFileSync(
      path.join(racine, 'node_modules/expo-linking/build/Schemes.js'), 'utf8')
    expect(schemes).toContain('needs access to the expo-constants manifest')
    expect(schemes).toMatch(/function hasConstantsManifest/)
    const routeur = readFileSync(
      path.join(racine, 'node_modules/expo-router/build/link/linking.js'), 'utf8')
    expect(routeur, 'expo-router fabrique bien l’URL racine au démarrage')
      .toContain("Linking.createURL('/')")
  })

  /**
   * ⚠️ **LE SDK iOS 27 FABRIQUE UNE APPLICATION QUI PLANTE AU LANCEMENT.**
   * Il impose le cycle de vie UIScene, qu'Expo 56 n'adopte pas. Mesuré le
   * 22 septembre 2026 dans les deux sens, sur le même iPad simulé : binaire
   * SDK 26 → démarre sous iOS 27 ; binaire SDK 27 → plante. Le contrôle porte
   * sur le SDK de COMPILATION, et Apple ne recompile rien.
   *
   * La garde du script LIT la version sur l'outil qui va compiler — elle ne
   * cite pas un chemin en dur, qui deviendrait faux au prochain Xcode.
   */
  it('le script d’archive refuse un SDK iOS qui n’est pas en 26', () => {
    const script = sansCommentaires(lire('scripts/appstore.sh'))
    const bloc = script.slice(0, script.indexOf('find-identity'))
    expect(bloc, 'la version est lue, pas décidée')
      .toContain('xcodebuild -showsdks')
    expect(bloc, 'seul un SDK 26 passe').toContain('iphoneos26*')
    expect(bloc, 'tout le reste est refusé').toMatch(/\*\)[\s\S]*exit 1/)
  })
})
