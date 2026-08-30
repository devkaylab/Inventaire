import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { TRANCHES, densite, libelleTranche, totalAnnuel, trancheDe } from '../lib/tarifs'
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

  // ⚠️ Trois gardes ont vécu ici jusqu'au 30 août 2026 : elles vérifiaient que
  // cette grille correspondait à l'annexe 2 des CGV et aux profils du deck.
  // Elles n'ont plus d'objet — le prix ne suit plus le volume de stock mais le
  // nombre d'appareils comptant simultanément (hypothèse 4). La garde n'a pas
  // disparu, elle a DÉMÉNAGÉ dans tests/offres.test.ts, où elle porte sur la
  // grille qui tarife réellement.
  //
  // Ce module reste utilisé pour DIMENSIONNER une installation (MagasinSaisie)
  // et pour le recoupement stock / surface de lib/secteurs — pas pour établir
  // un prix. Ne pas y raccrocher les CGV.

})

describe('Recoupement stock / surface', () => {
  it('calcule la densité, et se tait quand un chiffre manque', () => {
    expect(densite(240_000, 1_800)).toBeCloseTo(133.3, 1)
    expect(densite(240_000, null)).toBeNull()
    expect(densite(null, 1_800)).toBeNull()
    expect(densite(240_000, 0)).toBeNull()
  })

  it('ne juge plus la densité ici : c’est l’affaire du secteur', () => {
    // Le seuil unique a été retiré volontairement. Le laisser à côté de la
    // fourchette sectorielle aurait fait deux vérités concurrentes.
    const tarifs = readFileSync(join(racine, 'web/lib/tarifs.ts'), 'utf8')
    expect(tarifs).not.toContain('DENSITE_MIN')
    expect(tarifs).not.toContain('densitePlausible')
    expect(tarifs).toContain('secteurs.ts')
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

describe('une demande d’inscription prévient tout le monde (22 août 2026)', () => {
  // Julien : « il faut que je puisse recevoir un mail de demande
  // d'inscription ». Ce n'était pas prévu : /inscription écrivait en base et
  // personne ne le savait — ni Quantinvo, ni le prospect.
  const edge = readFileSync(join(racine, 'supabase/functions/submit-company-request/index.ts'), 'utf8')
  const page = readFileSync(join(racine, 'web/app/inscription/page.tsx'), 'utf8')

  it('l’edge appelle la RPC, puis écrit l’accusé et l’avis interne', () => {
    // ⚠️ La version « detailed », depuis le 28 août 2026 : la surface publique
    // répond la même chose qu'une demande soit créée ou déjà en cours, et
    // c'est ici — donc par e-mail, à qui possède l'adresse — que la différence
    // se dit. Voir `formulaires-publics.test.ts`.
    expect(edge).toContain("rpc('submit_company_request_detailed'")
    expect(edge).toContain("rpc('admin_notify_emails')")
    expect(edge).toContain('Votre demande est bien reçue')
    expect(edge).toContain('Nouvelle demande d’inscription')
    expect(edge).toContain('emailQuantinvo')
  })

  it('un e-mail qui ne part pas n’annule pas la demande', () => {
    expect(edge).toContain('emailed')
    expect(edge).toContain("if (!resendKey) return json({ success: true, received: true, emailed: false })")
  })

  it('la page retombe sur la RPC directe si l’edge est injoignable', () => {
    expect(page).toContain("functions.invoke('submit-company-request'")
    expect(page).toContain("supabase.rpc('submit_company_request'")
  })
})
