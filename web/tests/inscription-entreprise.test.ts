import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  DENSITE_MAX,
  DENSITE_MIN,
  TRANCHES,
  densite,
  densitePlausible,
  libelleTranche,
  totalAnnuel,
  trancheDe,
} from '../lib/tarifs'
import { formaterSiren, messageSiren, normaliserSiren, sirenValide } from '../lib/siren'

const racine = join(__dirname, '..', '..')
const cgv = readFileSync(join(racine, 'docs/entreprise/cgv-quantinvo-brouillon.md'), 'utf8')

describe('Grille tarifaire', () => {
  it('place chaque volume dans la bonne tranche, bornes comprises', () => {
    // Les bornes sont ce qui se conteste au moment du devis : elles sont
    // vérifiées une par une, de part et d'autre.
    const cas: [number, string | null][] = [
      [1, 'Boutique'],
      [10_000, 'Boutique'],
      [10_001, 'Magasin'],
      [50_000, 'Magasin'],
      [50_001, 'Grande surface'],
      [200_000, 'Grande surface'],
      [200_001, 'Grand magasin'],
      [500_000, 'Grand magasin'],
      [500_001, 'Très grand magasin'],
      [1_000_000, 'Très grand magasin'],
      [1_000_001, 'Hypermarché'],
    ]
    for (const [unites, profil] of cas) {
      expect(trancheDe(unites)?.profil, `${unites} unités`).toBe(profil)
    }
  })

  it('ne devine pas une tranche sur une saisie incomplète', () => {
    // Zéro n'est pas « une petite boutique » : c'est un champ pas encore rempli.
    expect(trancheDe(0)).toBeNull()
    expect(trancheDe(-5)).toBeNull()
    expect(trancheDe(null)).toBeNull()
    expect(trancheDe(undefined)).toBeNull()
    expect(trancheDe(Number.NaN)).toBeNull()
  })

  it('affiche le profil avant les bornes', () => {
    expect(libelleTranche(TRANCHES[3])).toBe('Grand magasin — 200 001 à 500 000')
  })

  it('somme les licences sans noyer les magasins au cas par cas', () => {
    // Un magasin au-delà d'un million n'a pas de prix de grille : l'ajouter
    // pour zéro donnerait un total faux, l'oublier ferait disparaître le
    // magasin. Il est donc compté à part.
    const t = totalAnnuel([5_000, 240_000, 3_000_000, null, 0])
    expect(t.euros).toBe(2_100 + 10_200)
    expect(t.surDevis).toBe(1)
    expect(t.chiffres).toBe(3)
  })

  it('reste d’accord avec l’annexe 2 des CGV', () => {
    // C'est le contrat qui fait foi. Changer un montant ici sans changer les
    // CGV — ou l'inverse — doit casser la suite : le devis sortirait sinon
    // avec un prix que le contrat ne prévoit pas.
    const attendus: [string, string][] = [
      ["Jusqu'à 10 000 unités", '2 100 €'],
      ['De 10 001 à 50 000 unités', '4 200 €'],
      ['De 50 001 à 200 000 unités', '6 600 €'],
      ['De 200 001 à 500 000 unités', '10 200 €'],
      ['De 500 001 à 1 000 000 unités', '14 400 €'],
    ]
    for (const [libelle, prix] of attendus) {
      expect(cgv, `${libelle} dans l’annexe 2`).toContain(`| ${libelle} | ${prix} |`)
    }
    expect(cgv).toContain('| Au-delà de 1 000 000 unités | Sur devis |')

    // Et chaque montant du module doit se retrouver dans le contrat.
    for (const t of TRANCHES) {
      if (t.prixEuros === null) continue
      expect(cgv, `${t.prixEuros} € absent des CGV`).toContain(
        `${t.prixEuros.toLocaleString('fr-FR').replace(/ | /g, ' ')} €`,
      )
    }
  })

  it('nomme les profils de la même façon dans le code, les CGV et le deck', () => {
    // Les profils s'affichent au prospect sur /inscription et sur la
    // diapositive « L'offre ». Les laisser diverger d'un support à l'autre
    // ferait douter, au moment précis où on demande de la confiance.
    const deck = readFileSync(join(racine, 'docs/entreprise/deck/build.js'), 'utf8')
    for (const t of TRANCHES) {
      expect(cgv, `profil « ${t.profil} » absent des CGV`).toContain(`| ${t.profil} |`)
      expect(deck, `profil « ${t.profil} » absent du deck`).toContain(t.profil)
    }

    // Les noms n'engagent pas : seul le volume détermine la tranche, et le
    // contrat doit le dire — sans quoi un client pourrait plaider son profil.
    expect(cgv).toContain('Seul le volume de stock détermine la')
  })

  it('compte en unités, et les CGV le disent', () => {
    // L'ancienne rédaction laissait le choix ouvert (« nombre de références ou
    // d'unités »). C'était trois tranches d'écart sur un même magasin.
    expect(cgv).toContain('unités en stock')
    expect(cgv).not.toContain('nombre de références ou d’unités')
    expect(cgv).not.toContain("nombre de références ou d'unités")
  })
})

describe('Recoupement stock / surface', () => {
  it('calcule la densité, et se tait quand un chiffre manque', () => {
    expect(densite(240_000, 1_800)).toBeCloseTo(133.3, 1)
    expect(densite(240_000, null)).toBeNull()
    expect(densite(null, 1_800)).toBeNull()
    expect(densite(240_000, 0)).toBeNull()
  })

  it('repère l’invraisemblable sans arbitrer les écarts fins', () => {
    expect(densitePlausible(densite(240_000, 1_800))).toBe(true)
    expect(densitePlausible(densite(40_000, 3_000))).toBe(false) // 13 u/m²
    expect(densitePlausible(densite(500_000, 100))).toBe(false) // 5 000 u/m²
    expect(densitePlausible(null)).toBeNull()
    expect(DENSITE_MIN).toBeLessThan(DENSITE_MAX)
  })
})

describe('SIREN', () => {
  it('ne garde que les chiffres et groupe par trois', () => {
    expect(normaliserSiren('123 456 782')).toBe('123456782')
    expect(normaliserSiren('12a3-45.6 78 2 999')).toBe('123456782')
    expect(formaterSiren('123456782')).toBe('123 456 782')
    expect(formaterSiren('1234')).toBe('123 4')
  })

  it('valide par la clé de Luhn', () => {
    expect(sirenValide('123 456 782')).toBe(true)
    expect(sirenValide('356000000')).toBe(true) // exemple de référence
    expect(sirenValide('123456789')).toBe(false)
    expect(sirenValide('12345678')).toBe(false) // huit chiffres
  })

  it('écarte les répétitions, que la clé de Luhn laisserait passer', () => {
    // 000000000 a une somme de zéro : il passe la clé. Sans ce garde-fou, le
    // contrôle serait décoratif.
    expect(sirenValide('000000000')).toBe(false)
    expect(sirenValide('111111111')).toBe(false)
  })

  it('ne parle que de ce que la personne vient de taper', () => {
    // Un formulaire public ne doit rien apprendre d'autre à qui l'essaie : pas
    // de message tant que la saisie est en cours.
    expect(messageSiren('')).toBeNull()
    expect(messageSiren('123 45')).toBeNull()
    expect(messageSiren('123 456 782')).toBeNull()
    expect(messageSiren('123 456 789')).toContain('ne forment pas un SIREN valide')
  })
})

describe('Kbis', () => {
  it('n’est jamais réclamé : le SIREN suffit', () => {
    // Décision du 21 août 2026. Réintroduire une demande de Kbis ferait
    // collecter les date et lieu de naissance, la nationalité et l'adresse d'un
    // dirigeant pour vérifier qu'une société existe — et le document est de
    // toute façon téléchargeable par n'importe qui à partir du seul SIREN.
    const page = readFileSync(join(racine, 'web/app/inscription/page.tsx'), 'utf8')

    // Le SIREN est demandé…
    expect(page).toContain('siren')

    // …et le mot « Kbis » n'apparaît que pour rassurer, jamais pour réclamer.
    expect(page).toContain('aucun Kbis à fournir')
    expect(page).not.toMatch(/type="file"/)
    expect(page.toLowerCase()).not.toMatch(/joindre|téléverser|téléchargez votre/)
  })
})
