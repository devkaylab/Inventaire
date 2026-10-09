import { describe, expect, it } from 'vitest'
import { realpathSync } from 'node:fs'
import path from 'node:path'

/**
 * Le chemin du projet ne contient pas d'espace — la garde (9 octobre 2026).
 *
 * ⚠️⚠️ **CE QUI A ÉTÉ PAYÉ POUR ÇA.** Le dossier s'appelait « App inventaire ».
 * Certaines script phases générées par les pods s'exécutent en
 * `bash -l -c "<chemin>"` : avec `-c`, bash interprète le chemin comme une
 * commande et coupe au premier espace — « bash: /Users/julien/Documents/App:
 * No such file or directory ». Il a fallu un `post_install` écrit à la main
 * dans `ios/Podfile` pour retirer le `-c` à chaque `pod install`, et ce
 * correctif ne survivait à aucune régénération du Podfile par Expo.
 *
 * Le dossier a été renommé, et **le contournement a donc été retiré**. C'est
 * précisément ce qui rend cette garde nécessaire : remettre le projet dans un
 * chemin contenant un espace ne rate plus sur un correctif absent, ça rate sur
 * une compilation iOS incompréhensible — l'erreur désigne un dossier tronqué,
 * pas le nom du dossier.
 *
 * ⚠️ On lit le chemin RÉEL (`realpathSync`) : un lien symbolique sans espace
 * posé devant un dossier qui en contient tromperait la garde, et il a existé —
 * c'est le lien temporaire qui a permis le renommage à chaud.
 */

const racine = realpathSync(path.resolve(__dirname, '..'))

describe('⚠️ le chemin du projet se passe d’espace', () => {
  it('aucune espace, nulle part dans le chemin', () => {
    expect(
      /\s/.test(racine),
      `le projet vit dans « ${racine} », qui contient une espace : la compilation iOS ` +
        'coupera le chemin au premier blanc, avec une erreur qui désigne un dossier ' +
        'tronqué. Déplacer le projet, ne pas remettre le contournement du Podfile.',
    ).toBe(false)
  })

  it('⚠️ et pas d’autre blanc exotique qu’un test d’espace raterait', () => {
    // Une tabulation, une espace insécable : rares, mais elles cassent de la
    // même façon et ne se voient pas dans le Finder.
    expect(
      [...racine].some((c) => /[\s   ]/.test(c)),
      `caractère blanc dans « ${racine} »`,
    ).toBe(false)
  })
})
