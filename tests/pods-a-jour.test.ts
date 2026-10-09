import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Le `Podfile.lock` dit la vérité sur `node_modules` — la garde (9 octobre 2026).
 *
 * ⚠️⚠️ **LE DÉFAUT QUE CECI FERME EST SILENCIEUX.** Après un
 * `npx expo install --fix`, `pod install` **sort à 0 en laissant le lock
 * périmé** : CocoaPods ne touche pas à une version déjà verrouillée. Ce jour-là
 * il n'a prévenu que pour UN pod sur dix-neuf — `Expo` lui-même restait à
 * 56.0.11 dans le lock quand 56.0.23 était installé.
 *
 * Autrement dit : le `package.json` annonce les nouvelles versions et la
 * compilation iOS part sur l'ancien code natif. Rien dans le code de retour ne
 * le dit, et la consigne « LIRE la sortie de `pod install` » n'aurait attrapé
 * qu'un cas sur dix-neuf. **Ce qui le voit, c'est cette comparaison.**
 *
 * Correctif quand elle mord : `pod update <les pods nommés> --no-repo-update`
 * depuis `ios/`. ⚠️ En zsh, `pod update $PODS` passe toute la liste comme UN
 * seul nom de pod — écrire `${=PODS}`.
 */

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/**
 * ⚠️ Ces deux-là portent par convention une version de podspec sans rapport
 * avec celle de leur paquet (`Yoga` à 0.0.0, `hermes-engine` à un horodatage).
 * Les comparer produirait un faux positif permanent, donc une garde qu'on
 * apprend à ignorer — pire que pas de garde.
 */
const VERSIONS_DE_CONVENTION = new Set(['Yoga', 'hermes-engine'])

/** Les pods servis depuis `node_modules`, avec la version que le lock leur prête. */
function podsLocaux() {
  const lock = lire('ios/Podfile.lock')
  const versions = new Map(
    [...lock.matchAll(/^ {2}- (\S+) \((\d[^)]*)\)/gm)].map((m) => [m[1], m[2]]),
  )
  return [...lock.matchAll(/^ {2}- (\S+) \(from `\.\.\/node_modules\/([^`"]+?)(?:\/[^`]*)?`\)/gm)]
    .map(([, pod, chemin]) => ({
      pod,
      // Un paquet sous portée (`@expo/ui`) garde ses deux segments.
      paquet: chemin.startsWith('@') ? chemin.split('/').slice(0, 2).join('/') : chemin.split('/')[0],
      versionLock: versions.get(pod),
    }))
    .filter((p) => p.versionLock && !VERSIONS_DE_CONVENTION.has(p.pod))
}

describe('⚠️⚠️ aucun pod ne compile du code plus vieux que celui installé', () => {
  it('le lock et node_modules disent la même version', () => {
    const retards: string[] = []
    let compares = 0

    for (const { pod, paquet, versionLock } of podsLocaux()) {
      const pj = path.join(racine, 'node_modules', paquet, 'package.json')
      if (!existsSync(pj)) continue
      const installee = JSON.parse(readFileSync(pj, 'utf8')).version as string
      compares += 1
      if (installee !== versionLock) {
        retards.push(`${pod} : lock ${versionLock}, installé ${installee}`)
      }
    }

    // ⚠️ Sans ce garde-fou, un lock illisible ou des pods renommés feraient
    // passer la garde en ne comparant rien — verte et aveugle.
    expect(compares, 'aucun pod comparé : la lecture du Podfile.lock a changé de forme')
      .toBeGreaterThan(20)

    expect(
      retards,
      'pods en retard — la compilation iOS partirait sur l’ancien code natif. ' +
        'Depuis ios/ : pod update ${=PODS} --no-repo-update\n' +
        retards.join('\n'),
    ).toEqual([])
  })
})
