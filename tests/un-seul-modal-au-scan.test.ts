// Un seul `Modal` sur l'écran de scan, et c'est « article inconnu ».
//
// ⚠️⚠️ **CETTE GARDE VIENT D'UN DÉFAUT VU SUR UN VRAI TÉLÉPHONE**, au premier
// essai TestFlight du build 6, le 22 septembre 2026. Le volet d'aide « trois
// façons de scanner » était ouvert ; un article inconnu a été scanné pendant
// ce temps. La fiche « article inconnu » ne s'est jamais affichée, et l'écran
// est resté sourd : impossible de changer de mode de scan pendant un moment.
//
// La cause : deux `Modal` montées en même temps. iOS refuse de présenter un
// contrôleur par-dessus un autre — la seconde échoue en silence, et la
// présentation avortée mange les touches.
//
// ⚠️ **LE DÉPÔT AVAIT DÉJÀ PAYÉ CETTE LEÇON DEUX FOIS** : `GeneratingOverlay`
// le 23 août, puis la feuille des scans récents, posée en voile précisément
// parce que « la fiche article inconnu en est une [Modal] et les deux se
// bloqueraient ». Le volet d'aide, lui, était resté une `Modal`.
//
// **Qui garde la `Modal` ?** Celle qui ne doit JAMAIS échouer à s'ouvrir : la
// fiche « article inconnu ». Elle porte un champ de saisie, et elle est
// déclenchée par un scan — c'est-à-dire à un instant que personne ne choisit.
// Une aide, elle, se contente d'un voile.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const racine = path.resolve(__dirname, '..')

/**
 * Le code sans ses commentaires.
 *
 * ⚠️ **DIXIÈME FOIS QUE CE PIÈGE SE PRÉSENTE SUR CE DÉPÔT.** L'en-tête du
 * volet EXPLIQUE pourquoi il n'est plus une `Modal`, et le mot y figure quatre
 * fois. Une garde qui lit le texte brut compterait ces commentaires et
 * échouerait sur la correction elle-même.
 */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const scanner = sansCommentaires(
  readFileSync(path.join(racine, 'src/components/scanner.tsx'), 'utf8'))

describe('un seul Modal sur l’écran de scan', () => {
  /**
   * La garde COMPTE, elle ne cite pas. Si quelqu'un ajoute un troisième volet
   * en `Modal` demain, elle le dira sans avoir à connaître son nom.
   */
  it('le scanner ne monte qu’une seule `Modal`', () => {
    const montées = scanner.match(/<Modal[\s>]/g) ?? []
    expect(montées.length,
      'deux `Modal` à l’écran : iOS n’en présente qu’une, la seconde échoue en silence')
      .toBe(1)
  })

  /**
   * Et c'est bien la fiche « article inconnu » qui la garde — pas une autre.
   * Le test découpe sur la fonction, il ne cite pas un numéro de ligne.
   */
  it('la `Modal` restante est celle de « article inconnu »', () => {
    const debut = scanner.indexOf('function IllisibleModal')
    expect(debut, 'IllisibleModal existe toujours').toBeGreaterThan(-1)
    const suite = scanner.slice(debut)
    const fin = suite.indexOf('\n}\n')
    const corps = suite.slice(0, fin)
    expect(corps).toMatch(/<Modal[\s>]/)
  })

  /**
   * Le volet d'aide s'efface devant la fiche : deux panneaux superposés, c'est
   * celui du dessous qu'on ne peut plus fermer.
   */
  it('le volet d’aide ne s’ouvre pas par-dessus « article inconnu »', () => {
    expect(scanner, 'l’effet qui ouvre le volet tient compte de la fiche')
      .toMatch(/illisibleCode !== null \|\| !repereModes\.aVoir\) return/)
    expect(scanner, 'un article inconnu referme le volet ouvert')
      .toMatch(/setVolet\(null\)\s*\n\s*setIllisibleCode\(value\)/)
  })
})
