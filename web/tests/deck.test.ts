import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { OFFRES, SUPPLEMENT, euros } from '../lib/offres'

/**
 * Les présentations de `docs/entreprise/deck/` ne doivent JAMAIS porter un
 * prix écrit à la main.
 *
 * ⚠️ Ce n'est pas une précaution théorique. Les decks du 24 août 2026 ont
 * porté la grille au volume de stock pendant une semaine après son
 * remplacement, et le deck Samaritaine promettait « compteurs illimités » et
 * « pas d'abonnement par appareil » — l'inverse exact de ce qu'on facture
 * depuis le 30 août. Un prix périmé dans un document qu'on présente en face à
 * face coûte plus cher qu'un bug.
 *
 * Le garde-fou est le même que celui de `devis.test.ts` pour la grille du
 * devis : on vérifie que la source de vérité est bien lue, et qu'aucune copie
 * ne s'est glissée à côté.
 */

const DECK = join(__dirname, '../../docs/entreprise/deck')

function generateurs(): { nom: string; src: string }[] {
  return readdirSync(DECK)
    .filter((f) => f.startsWith('build') && f.endsWith('.js'))
    .map((nom) => ({ nom, src: readFileSync(join(DECK, nom), 'utf8') }))
}

/** Le code sans ses commentaires : un commentaire cite les montants pour les expliquer. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * Toutes les espaces ramenées à l'espace ordinaire.
 *
 * ⚠️ Sans cette normalisation, la garde ne garde rien — et c'est le premier
 * essai qui l'a montré : `euros()` sépare les milliers par une espace FINE
 * INSÉCABLE (U+202F), alors que quelqu'un qui écrit un prix à la main tape une
 * espace ordinaire. « 2 400 € » figé dans un deck passait donc à travers un
 * test qui cherchait « 2 400 € ». On compare les deux formes après
 * normalisation, et aussi la forme sans séparateur (« 2400 € »).
 */
function normaliser(t: string): string {
  return t.replace(/[\u00A0\u202F\u2009\u2007]/g, ' ')
}

/** Les écritures plausibles d'un montant, une fois normalisées. */
function formes(m: number): string[] {
  return [normaliser(euros(m)), `${m} €`]
}

describe('les présentations lisent la grille, elles ne la recopient pas', () => {
  it('aucun générateur n’écrit un montant de la grille en dur', () => {
    // Les montants qui feraient un faux document s'ils étaient figés.
    const montants = [
      ...OFFRES.flatMap((o) => [o.mois, o.an]),
      SUPPLEMENT.mois,
      SUPPLEMENT.an,
    ]
    for (const { nom, src } of generateurs()) {
      const code = normaliser(sansCommentaires(src))
      for (const m of montants) {
        // On cherche la forme AFFICHÉE (« 2 400 € », « 225 € »), pas le nombre
        // nu : une coordonnée de mise en page peut valoir 690.
        for (const forme of formes(m)) {
          expect(code, `${nom} écrit « ${forme} » en dur au lieu de le lire`).not.toContain(forme)
        }
      }
    }
  })

  it('aucun générateur ne porte l’ancienne grille au volume de stock', () => {
    // Remplacée le 30 août 2026. Ces montants ne doivent plus apparaître nulle
    // part — ni en chiffres, ni dans les libellés de tranches qui les portaient.
    const perimes = ['2 100 €', '4 200 €', '6 600 €', '10 200 €', '14 400 €']
    for (const { nom, src } of generateurs()) {
      const code = normaliser(src)
      for (const p of perimes) {
        expect(code, `${nom} porte encore l’ancienne grille (${p})`).not.toContain(p)
      }
    }
  })

  it('aucun générateur ne promet des compteurs ou appareils illimités', () => {
    // ⚠️ Les inventaires SONT illimités — c'est ce qu'on vend. Les appareils
    // qui comptent en même temps ne le sont pas : c'est l'assiette du prix.
    const interdits = [
      'compteurs illimités',
      'appareils illimités',
      'plafond au nombre de compteurs',
      'abonnement par appareil',
    ]
    for (const { nom, src } of generateurs()) {
      for (const phrase of interdits) {
        expect(src.toLowerCase(), `${nom} promet « ${phrase} », ce que la grille ne permet plus`)
          .not.toContain(phrase)
      }
    }
  })

  it('les decks qui affichent un prix passent par le bloc partagé', () => {
    for (const { nom, src } of generateurs()) {
      const code = sansCommentaires(src)
      if (!code.includes('grilleOffres')) continue
      expect(code, `${nom} dessine la grille sans require('./blocs')`).toContain("require('./blocs')")
    }
  })
})
