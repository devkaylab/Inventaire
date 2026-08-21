import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chercherParSiren, lieuCourt } from '../lib/registre'

const racine = join(__dirname, '..', '..')

/** Réponse minimale du registre, réduite aux champs réellement lus. */
function reponse(corps: unknown, ok = true) {
  return async () =>
    ({
      ok,
      json: async () => corps,
    }) as unknown as Response
}

const LA_POSTE = {
  results: [
    {
      siren: '356000000',
      nom_complet: 'LA POSTE',
      nom_raison_sociale: 'LA POSTE',
      etat_administratif: 'A',
      activite_principale: '53.10Z',
      // Le registre sert aussi les dirigeants : la présence de ce champ dans
      // le jeu d'essai est délibérée, rien ne doit en ressortir.
      dirigeants: [{ nom: 'DUPONT', prenoms: 'Jean' }],
      siege: { libelle_commune: 'PARIS', code_postal: '75015', etat_administratif: 'A' },
    },
  ],
}

describe('Consultation du registre', () => {
  it('retient une entreprise trouvée, et rien de plus', async () => {
    const r = await chercherParSiren('356 000 000', { fetchImpl: reponse(LA_POSTE) as never })
    expect(r.etat).toBe('trouve')
    if (r.etat !== 'trouve') return

    expect(r.fiche).toEqual({
      siren: '356000000',
      raisonSociale: 'LA POSTE',
      active: true,
      commune: 'PARIS',
      codePostal: '75015',
      ape: '53.10Z',
    })

    // Le champ `dirigeants` — des noms de personnes physiques — ne doit sortir
    // sous aucune forme. C'est le garde-fou de minimisation du module.
    expect(JSON.stringify(r.fiche)).not.toContain('DUPONT')
    expect(Object.keys(r.fiche)).not.toContain('dirigeants')
  })

  it('refuse un résultat dont le SIREN ne correspond pas', async () => {
    // La recherche de l'API est floue : interroger neuf chiffres peut ramener
    // une société dont le nom les contient. Retenir ce résultat afficherait la
    // fiche de quelqu'un d'autre.
    const autre = { results: [{ ...LA_POSTE.results[0], siren: '999999999' }] }
    const r = await chercherParSiren('356000000', { fetchImpl: reponse(autre) as never })
    expect(r.etat).toBe('introuvable')
  })

  it('distingue « introuvable » de « registre injoignable »', async () => {
    // Confondre les deux ferait dire « cette société n'existe pas » à une
    // simple coupure réseau, et découragerait une demande légitime.
    const vide = await chercherParSiren('356000000', { fetchImpl: reponse({ results: [] }) as never })
    expect(vide.etat).toBe('introuvable')

    const erreur = await chercherParSiren('356000000', { fetchImpl: reponse({}, false) as never })
    expect(erreur.etat).toBe('indisponible')

    const casse = await chercherParSiren('356000000', {
      fetchImpl: (async () => {
        throw new Error('réseau coupé')
      }) as never,
    })
    expect(casse.etat).toBe('indisponible')
  })

  it('traite une entreprise non diffusée comme introuvable', async () => {
    // Une personne peut demander que ses données ne soient pas publiées. Le
    // registre répond alors sans raison sociale : afficher un cadre vide serait
    // pire que ne rien afficher.
    const masquee = {
      results: [{ siren: '356000000', nom_complet: null, nom_raison_sociale: null, siege: {} }],
    }
    const r = await chercherParSiren('356000000', { fetchImpl: reponse(masquee) as never })
    expect(r.etat).toBe('introuvable')
  })

  it('signale une entreprise cessée sans la cacher', async () => {
    const cessee = {
      results: [
        { ...LA_POSTE.results[0], siege: { ...LA_POSTE.results[0].siege, etat_administratif: 'C' } },
      ],
    }
    const r = await chercherParSiren('356000000', { fetchImpl: reponse(cessee) as never })
    expect(r.etat).toBe('trouve')
    if (r.etat === 'trouve') expect(r.fiche.active).toBe(false)
  })

  it('n’interroge rien sur un numéro incomplet', async () => {
    let appele = false
    const r = await chercherParSiren('3560', {
      fetchImpl: (async () => {
        appele = true
        return reponse(LA_POSTE)()
      }) as never,
    })
    expect(appele).toBe(false)
    expect(r.etat).toBe('introuvable')
  })

  it('compose un lieu court avec ce qui est disponible', () => {
    const base = { siren: '1', raisonSociale: 'X', active: true, ape: null }
    expect(lieuCourt({ ...base, commune: 'PARIS', codePostal: '75015' })).toBe('75015 PARIS')
    expect(lieuCourt({ ...base, commune: 'PARIS', codePostal: null })).toBe('PARIS')
    expect(lieuCourt({ ...base, commune: null, codePostal: null })).toBeNull()
  })
})

describe('Garde-fous du branchement', () => {
  it('ouvre la CSP au seul hôte du registre', () => {
    // `connect-src` est la ligne qui empêche une page de parler à n'importe
    // qui. L'ouvrir avec un joker annulerait le correctif M1.
    const config = readFileSync(join(racine, 'web/next.config.mjs'), 'utf8')
    expect(config).toContain('https://recherche-entreprises.api.gouv.fr')
    const ligne = config.split('\n').find((l) => l.includes('connect-src'))
    expect(ligne).toBeDefined()
    expect(ligne).not.toMatch(/\*\.gouv\.fr|https:\s|connect-src[^`]*\*/)
  })

  it('n’affiche jamais un exemple de SIREN qui désigne quelqu’un', () => {
    // Un numéro valide en placeholder invite à le saisir, et le registre
    // renverrait alors la raison sociale d'une vraie entreprise — un nom de
    // personne s'il s'agit d'un entrepreneur individuel.
    const page = readFileSync(join(racine, 'web/app/inscription/page.tsx'), 'utf8')
    expect(page).toContain("const SIREN_EXEMPLE = '123 456 789'")

    const luhn = (n: string) =>
      [...n].reverse().reduce((s, c, i) => {
        let d = Number(c)
        if (i % 2 === 1) {
          d *= 2
          if (d > 9) d -= 9
        }
        return s + d
      }, 0) % 10 === 0
    expect(luhn('123456789')).toBe(false)
  })

  it('déclare la consultation dans la politique de confidentialité', () => {
    const politique = readFileSync(join(racine, 'docs/privacy.html'), 'utf8')
    expect(politique).toContain('recherche-entreprises.api.gouv.fr')
  })
})
