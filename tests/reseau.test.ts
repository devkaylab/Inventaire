import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { avecDelai, DELAI_INTERACTIF_MS, DELAI_DE_FOND_MS } from '@/lib/reseau'
import { isNetworkError } from '@/lib/offline'

/**
 * Les délais d'attente — la garde (9 octobre 2026).
 *
 * ⚠️⚠️ **LE DÉFAUT QUE TOUT CECI FERME : LA ZONE GRISE.** Julien : « ça affiche
 * 5G mais en réalité il n'y a rien qui se passe, donc le téléphone mouline. »
 * Le hors ligne ne s'enclenchait que sur l'ÉCHEC d'une requête — et en zone
 * grise une requête n'échoue pas, elle pend. L'app attendait le délai d'iOS.
 *
 * ⚠️ La pièce la plus fragile de l'ensemble n'est pas le délai : c'est le fait
 * qu'une annulation soit comprise comme une PANNE RÉSEAU. Si elle ne l'était
 * pas, le budget court couperait la requête et l'écran afficherait
 * « Enregistrement impossible » au lieu de basculer hors ligne — l'app serait
 * plus cassante qu'avant. C'est le premier test ci-dessous.
 */

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('⚠️ une annulation de délai EST une panne réseau', () => {
  it('reconnue par son nom', () => {
    // Ce que `postgrest-js` relance tel quel quand le signal coupe.
    expect(isNetworkError({ name: 'AbortError', message: 'Aborted' })).toBe(true)
  })

  it('et par son code, selon la plateforme', () => {
    expect(isNetworkError({ name: 'Error', code: 'ABORT_ERR', message: '' })).toBe(true)
  })

  it('sans confondre avec un refus du serveur', () => {
    // ⚠️ La borne qui compte dans l'autre sens : un refus doit RESTER un refus
    // visible, pas devenir une mise en attente silencieuse. C'est la règle
    // écrite en tête d'`offlineSync.ts`.
    expect(isNetworkError({ name: 'PostgrestError', message: 'inventaire clôturé' })).toBe(false)
    expect(isNetworkError({ name: 'PostgrestError', message: 'permission denied' })).toBe(false)
  })
})

describe('avecDelai coupe, et ne laisse rien derrière', () => {
  it('annule le signal au bout du budget', async () => {
    let coupe = false
    const promesse = avecDelai(20, (signal) =>
      new Promise<never>((_, rejeter) => {
        signal.addEventListener('abort', () => {
          coupe = true
          rejeter(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
        })
      }))

    await expect(promesse).rejects.toThrow(/aborted/i)
    expect(coupe, 'le signal n’a pas été annulé').toBe(true)
  })

  it('rend la valeur sans attendre quand l’appel répond', async () => {
    const debut = Date.now()
    await expect(avecDelai(5_000, async () => 'ok')).resolves.toBe('ok')
    expect(Date.now() - debut, 'l’appel a attendu le budget au lieu de rendre').toBeLessThan(1_000)
  })

  it('⚠️ et l’annulation qu’il produit fait bien basculer hors ligne', async () => {
    // Le bout par lequel tout se tient : le budget coupe, l'erreur remonte, et
    // `isNetworkError` la reconnaît. Si ce test tombe, la zone grise devient
    // une erreur à l'écran.
    const erreur = await avecDelai(10, (signal) =>
      new Promise<unknown>((resoudre) => {
        signal.addEventListener('abort', () =>
          resoudre(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
      }))
    expect(isNetworkError(erreur)).toBe(true)
  })
})

describe('⚠️ les budgets sont posés là où quelqu’un attend', () => {
  /** Les appels de `queries.ts` qui portent un budget, déduits du fichier. */
  const sousBudget = () => {
    const src = sansCommentaires(lire('src/lib/queries.ts'))
    return [...src.matchAll(/export async function (\w+)\([\s\S]*?\n\}/g)]
      .filter((m) => m[0].includes('avecDelai('))
      .map((m) => m[1])
  }

  it('le scan, l’enregistrement et la balise', () => {
    // ⚠️ CES TROIS-LÀ ET PAS D'AUTRES PAR OBLIGATION : ce sont les appels qu'un
    // compteur attend, caméra en main. Le reste est couvert par le filet large
    // du client. Si un quatrième appel interactif apparaît, il doit entrer ici.
    const avec = sousBudget()
    for (const fn of ['resolveArticle', 'insertCount', 'setBalise']) {
      expect(avec, `${fn} n’a plus de budget : la zone grise y remouline`).toContain(fn)
    }
  })

  it('⚠️ et le budget interactif reste court', () => {
    // Deux secondes et demie est un choix de produit : au-delà, c'est une panne
    // du point de vue de celui qui scanne. Un budget qui dériverait vers dix
    // secondes rendrait le moulinage au compteur.
    expect(DELAI_INTERACTIF_MS).toBeLessThanOrEqual(3_000)
    expect(DELAI_INTERACTIF_MS, 'si court qu’un réseau lent mais valide basculerait')
      .toBeGreaterThanOrEqual(1_000)
    expect(DELAI_DE_FOND_MS, 'le filet doit rester plus large que l’interactif')
      .toBeGreaterThan(DELAI_INTERACTIF_MS)
  })

  it('⚠️ le filet du client s’efface devant le signal de l’appelant', () => {
    // Sans cette priorité, le filet large écraserait les budgets courts et
    // l'app remoulinerait vingt secondes par scan.
    const src = sansCommentaires(lire('src/lib/supabase.ts'))
    expect(src, 'le client ne pose plus de filet').toContain('AbortController')
    expect(src, 'le filet ne rend pas la main au signal de l’appelant')
      .toMatch(/if \(init\?\.signal\) return fetch\(/)
    expect(src, 'le minuteur du filet n’est plus nettoyé').toMatch(/clearTimeout/)
  })
})

describe('⚠️ le scan lit le cache avant le réseau', () => {
  it('l’ordre est local, puis serveur', () => {
    // La mesure du « zéro appel » vit dans `tests/offlineSync.test.ts`, qui
    // compte les appels. Ici on tient l'ORDRE dans le code, parce qu'une
    // inversion rendrait la mesure fausse sans rien casser d'autre.
    const src = sansCommentaires(lire('src/lib/offlineSync.ts'))
    const corps = /export async function resolveArticle\([\s\S]*?\n\}/.exec(src)?.[0] ?? ''
    expect(corps, 'resolveArticle ne se lit plus').not.toBe('')
    const local = corps.indexOf('off.resolveArticleOffline')
    const serveur = corps.indexOf('q.resolveArticle')
    expect(local, 'le cache local n’est plus consulté').toBeGreaterThan(-1)
    expect(serveur, 'le serveur n’est plus consulté du tout').toBeGreaterThan(-1)
    expect(local, 'le serveur est redevenu le premier interrogé').toBeLessThan(serveur)
  })
})
