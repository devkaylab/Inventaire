import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { APPAREILS_MAX, PLAFOND_LIBRE_SERVICE, SUPPLEMENT } from '../lib/offres'

/**
 * Les textes publics disent ce que le produit FAIT (5 septembre 2026).
 *
 * Constat de Julien : la page Tarifs promettait encore « nous ne refusons
 * jamais un appareil pendant un comptage — le dépassement se règle au
 * renouvellement ». C'était vrai du « plafond souple » du 27 août ; le
 * 4 septembre il a tranché l'inverse — « on n'accepte ni magasin, ni appareil
 * supplémentaires sans paiement » — et le verrou refuse réellement l'appareil
 * en trop. **La page promettait donc le contraire du produit.**
 *
 * ⚠️ CES GARDES BALAIENT, ELLES NE CITENT PAS. Une garde qui nommerait la
 * phrase d'aujourd'hui ne protégerait que celle-là ; ce qu'on défend, ce sont
 * les DÉCISIONS — et n'importe quelle page peut les contredire demain.
 */

const racine = path.join(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/** Le code sans ses commentaires : ils citent forcément ce qu'ils interdisent. */
const code = (src: string) =>
  src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

/** Toutes les pages publiques, déduites — l'espace connecté ne parle pas au marché. */
const PAGES_PUBLIQUES = (() => {
  const app = path.join(racine, 'app')
  const connecte = new Set([
    'admin', 'dashboard', 'magasins', 'equipe', 'journal', 'inventaires',
    'account', 'messages', 'outils', 'entreprise',
  ])
  const out: string[] = []
  const marcher = (dir: string, rel: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (rel === '' && connecte.has(e.name)) continue
        marcher(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name)
      } else if (e.name === 'page.tsx') {
        out.push(rel ? `app/${rel}/page.tsx` : 'app/page.tsx')
      }
    }
  }
  marcher(app, '')
  return out
})()

const TEXTES = () => [...PAGES_PUBLIQUES, 'components/TarifsGrille.tsx']
  .map((f) => [f, code(lire(f))] as const)

describe('aucune page publique ne contredit le verrou d’appareils', () => {
  it('⚠️ aucune ne promet qu’on ne refuse jamais un appareil', () => {
    // C'est la promesse exacte que Julien a fait retirer. Elle datait du
    // plafond souple, remplacé le 4 septembre.
    const interdits = [
      /ne refusons jamais/i,
      /jamais un appareil/i,
      /se règle au renouvellement/i,
      /rien ce jour-là/i,
    ]
    for (const [f, src] of TEXTES()) {
      for (const r of interdits) {
        expect(r.test(src), `${f} promet encore ce que le verrou ne fait plus : ${r}`).toBe(false)
      }
    }
  })

  it('mais elles disent ce qui reste vrai : personne n’est interrompu', () => {
    // C'est la première borne du verrou, et elle vaut d'être dite — sans elle
    // le refus se lit comme une coupure en plein inventaire.
    expect(lire('app/tarifs/page.tsx')).toContain('jamais interrompu en plein comptage')
  })
})

describe('aucune page publique ne renvoie au parcours de devis', () => {
  it('⚠️ le devis a disparu de la vente le 4 septembre 2026', () => {
    // « plus besoin de passer par un devis pour quoi que ce soit » : l'offre est
    // publique et s'achète en ligne. Un texte qui parle de devis renvoie à un
    // parcours qui n'existe plus.
    for (const [f, src] of TEXTES()) {
      // `/devis/<jeton>` reste servie pour les devis déjà émis : c'est la page
      // elle-même, pas une promesse commerciale.
      if (f.startsWith('app/devis')) continue
      expect(/nous établissons un devis|sur devis|parlons-en/i.test(src),
        `${f} renvoie encore au parcours de devis`).toBe(false)
    }
  })
})

describe('l’engagement annoncé est celui des CGV', () => {
  it('⚠️ « résiliable à tout moment » ne vaut QUE pour le mensuel', () => {
    // L'article 7 des CGV : l'annuel court douze mois, payés d'avance, et la
    // résiliation « ne donne lieu à aucun remboursement ». Une promesse qu'un
    // contrat contredit se retourne au premier client qui la lit.
    for (const [f, src] of TEXTES()) {
      const phrases = src.match(/[^.!?]*résiliable[^.!?]*/gi) ?? []
      for (const p of phrases) {
        expect(/mois/i.test(p), `${f} promet une résiliation sans dire qu’elle vise le mensuel : « ${p.trim()} »`)
          .toBe(true)
      }
    }
  })

  it('et le pied de la page Tarifs dit les deux rythmes', () => {
    // ⚠️ On normalise les espaces invisibles avant de comparer : la typographie
    // française pose une INSÉCABLE devant le point-virgule, et le message
    // d'échec montre alors deux chaînes qui paraissent identiques. Piège déjà
    // payé le 4 septembre sur le séparateur de milliers.
    const sansInsecables = (t: string) => t.replace(/[\u00a0\u202f]/g, ' ')
    expect(sansInsecables(lire('app/tarifs/page.tsx')))
      .toContain('Mensuel sans engagement ; annuel dû jusqu’à son terme')
  })
})

describe('la grille dit où elle s’arrête', () => {
  it('⚠️ le supplément se prolonge jusqu’à la borne, et le dit', () => {
    // Découvrir au moment de payer que l'offre s'arrête est le pire endroit
    // pour l'apprendre — même raisonnement que la décomposition du prix.
    const g = lire('components/TarifsGrille.tsx')
    expect(g).toContain('PLAFOND_LIBRE_SERVICE')
    expect(g).toContain('prend sa propre licence')
    // ⚠️ Aucun montant ni palier écrit en dur : tout vient de `lib/offres`.
    for (const n of [APPAREILS_MAX, PLAFOND_LIBRE_SERVICE, SUPPLEMENT.par]) {
      expect(code(g), `le nombre ${n} ne s’écrit pas en dur`).not.toMatch(new RegExp(`[^\\w.]${n}[^\\w]`))
    }
  })
})

describe('aucun texte n’invite à écrire sans dire où', () => {
  it('⚠️ règle du 22 août 2026 — l’adresse, ou le silence', () => {
    for (const [f, src] of TEXTES()) {
      // `contactez-nous` / `écrivez-nous` ne s'écrit que dans une branche qui
      // porte l'adresse : `CONTACT_EMAIL` ou l'assistant `ecrivezNous()`.
      const phrases = src.match(/[^.!?<>{}]*(contactez-nous|écrivez-nous)[^.!?<>{}]*/gi) ?? []
      for (const p of phrases) {
        const contexte = src.slice(Math.max(0, src.indexOf(p) - 260), src.indexOf(p) + p.length + 120)
        expect(/CONTACT_EMAIL|ecrivezNous|mailto:/.test(contexte),
          `${f} invite à écrire sans donner d’adresse : « ${p.trim()} »`).toBe(true)
      }
    }
  })
})

describe('aucun bouton ne promet une inscription fermée', () => {
  it('⚠️ tout chemin vers /inscription passe par InscriptionLink', () => {
    // La garde du 5 septembre cherchait le libellé « Inscrire mon entreprise » ;
    // « Équiper plusieurs magasins » lui a donc échappé. Celle-ci vise le LIEN,
    // pas le mot — n'importe quel libellé futur est couvert.
    // ⚠️ On balaie AUSSI tous les composants : un lien en dur dans l'un d'eux
    // échapperait à une garde qui ne regarde que les pages.
    const composants = readdirSync(path.join(racine, 'components'))
      .filter((n) => n.endsWith('.tsx')).map((n) => `components/${n}`)
    for (const f of [...PAGES_PUBLIQUES, ...composants]) {
      const src = code(lire(f))
      // La page d'inscription elle-même, et le composant, sont la destination.
      if (f.includes('inscription') || f.includes('Inscription')) continue
      // Un composant qui lit le verdict lui-même sait quoi dire : il est juste.
      if (src.includes('venteOuverte()')) continue
      expect(src.includes('href="/inscription"'),
        `${f} pointe vers /inscription en dur : il promettra l’inscription même fermée`).toBe(false)
    }
  })

  it('et le composant reste la seule porte', () => {
    const c = lire('components/InscriptionLink.tsx')
    expect(c).toContain('venteOuverte()')
    expect(c).toContain('href="/inscription"')
  })
})
