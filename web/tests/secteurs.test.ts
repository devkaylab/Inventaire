import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SECTEURS, SECTEUR_INCONNU, densiteAttendue, secteurDe } from '../lib/secteurs'
import { densite } from '../lib/tarifs'

const racine = join(__dirname, '..', '..')

describe('Secteur d’activité', () => {
  it('reconnaît un code APE tel que le registre le sert', () => {
    expect(secteurDe('47.71Z').cle).toBe('equipement') // habillement
    expect(secteurDe('47.59A').cle).toBe('volumineux') // meubles
    expect(secteurDe('47.73Z').cle).toBe('petitsarticles') // pharmacie
    expect(secteurDe('47.61Z').cle).toBe('culture') // livres
    expect(secteurDe('47.11D').cle).toBe('alimentaire') // supermarché
    expect(secteurDe('47.19B').cle).toBe('nonspecialise') // grand magasin
  })

  it('tolère les écritures sans point', () => {
    // Toutes les sources ne mettent pas le séparateur.
    expect(secteurDe('4771Z').cle).toBe('equipement')
    expect(secteurDe('4771').cle).toBe('equipement')
  })

  it('retombe sur l’inconnu plutôt que de deviner', () => {
    // Une activité hors commerce de détail, ou un code absent, ne doit pas
    // être rangée de force dans un secteur : la fourchette resterait fausse.
    expect(secteurDe(null)).toBe(SECTEUR_INCONNU)
    expect(secteurDe('')).toBe(SECTEUR_INCONNU)
    expect(secteurDe('62.01Z')).toBe(SECTEUR_INCONNU) // programmation
    expect(secteurDe('47')).toBe(SECTEUR_INCONNU) // trop court
  })

  it('n’attribue pas une même classe NAF à deux secteurs', () => {
    // Un doublon rendrait le résultat dépendant de l'ordre du tableau.
    const vues = new Set<string>()
    for (const s of SECTEURS) {
      for (const naf of s.naf) {
        expect(vues.has(naf), `${naf} apparaît deux fois`).toBe(false)
        vues.add(naf)
      }
    }
  })

  it('garde des fourchettes cohérentes', () => {
    for (const s of [...SECTEURS, SECTEUR_INCONNU]) {
      expect(s.min, `${s.cle} : minimum`).toBeGreaterThan(0)
      expect(s.min, `${s.cle} : min < max`).toBeLessThan(s.max)
    }
  })
})

describe('Repère de densité', () => {
  it('resserre le jugement au secteur', () => {
    // 1 800 m² pour 240 000 pièces = 133 u/m². Plausible en habillement,
    // absurde en ameublement : c'est exactement ce qu'une fourchette unique
    // ne savait pas dire.
    const d = densite(240_000, 1_800)
    expect(densiteAttendue(d, '47.71Z')?.plausible).toBe(true)
    expect(densiteAttendue(d, '47.59A')?.plausible).toBe(false)
  })

  it('attrape le zéro oublié, qui est le vrai cas d’usage', () => {
    // 240 000 pièces saisies 24 000 dans un magasin d'habillement de 1 800 m² :
    // 13 u/m², sous le plancher du secteur.
    expect(densiteAttendue(densite(24_000, 1_800), '47.71Z')?.plausible).toBe(false)
    expect(densiteAttendue(densite(240_000, 1_800), '47.71Z')?.plausible).toBe(true)
  })

  it('ne dit rien quand un chiffre manque', () => {
    expect(densiteAttendue(densite(240_000, null), '47.71Z')).toBeNull()
    expect(densiteAttendue(null, '47.71Z')).toBeNull()
  })

  it('reste large quand le secteur est inconnu', () => {
    // Mieux vaut ne rien signaler que d'accuser à tort sur une fourchette
    // qu'on n'a aucune raison d'appliquer.
    const r = densiteAttendue(densite(240_000, 1_800), null)
    expect(r?.secteur).toBe(SECTEUR_INCONNU)
    expect(r?.plausible).toBe(true)
  })

  it('resserre la fourchette, sans devenir un détecteur de mensonge', () => {
    // Ce test garde une limite qu'il ne faut pas oublier en lisant le repère
    // dans la console : il attrape les ordres de grandeur, pas les fraudes.
    //
    // Toutes les fourchettes sectorielles sont plus étroites que la fourchette
    // unique d'avant — c'est le gain, et il est mesurable.
    const largeurInconnu = SECTEUR_INCONNU.max / SECTEUR_INCONNU.min
    for (const s of SECTEURS) {
      expect(s.max / s.min, `${s.cle} n'est pas plus discriminant qu'avant`).toBeLessThanOrEqual(
        largeurInconnu,
      )
    }

    // Mais une sous-déclaration modérée passe encore. Un magasin d'habillement
    // de 1 800 m² qui détient 240 000 pièces (133 u/m²) peut en déclarer
    // 50 000 (28 u/m²) et rester dans la fourchette : c'est un facteur 5, pas
    // un ordre de grandeur. Resserrer assez pour l'attraper signalerait à tort
    // les commerces réellement peu denses.
    expect(densiteAttendue(densite(50_000, 1_800), '47.71Z')?.plausible).toBe(true)

    // Et le repère reste contournable de toute façon : stock et surface sont
    // déclarés par la même personne, qui peut les rendre cohérents entre eux.
    expect(densiteAttendue(densite(50_000, 400), '47.71Z')?.plausible).toBe(true)
  })
})

describe('Où le repère s’affiche, et comment', () => {
  it('reste dans la console d’administration, jamais sur le formulaire public', () => {
    // Sur un formulaire public, le repère soupçonnerait le prospect avant le
    // devis — et surtout lui indiquerait quel chiffre ajuster pour changer de
    // tranche.
    const page = readFileSync(join(racine, 'web/app/inscription/page.tsx'), 'utf8')
    expect(page).not.toContain('densiteAttendue')
    expect(page).not.toContain('secteurs')

    const admin = readFileSync(join(racine, 'web/components/admin/CompanyRequests.tsx'), 'utf8')
    expect(admin).toContain('densiteAttendue')
  })

  it('dit ce qu’il fait, et pas plus', () => {
    // « Cohérent » laissait croire à une validation. Ce n'en est pas une :
    // stock et surface sont déclarés par la même personne.
    const admin = readFileSync(join(racine, 'web/components/admin/CompanyRequests.tsx'), 'utf8')
    expect(admin).toContain('vérifier qu’il ne manque pas un zéro')
    expect(admin).not.toContain("'Cohérent'")
    expect(admin).not.toContain("'À vérifier'")
  })

  it('transmet le code APE avec la demande', () => {
    // Sans lui, la fourchette retombe sur la générique et ne signale rien.
    const page = readFileSync(join(racine, 'web/app/inscription/page.tsx'), 'utf8')
    expect(page).toContain('p_ape')
  })
})
