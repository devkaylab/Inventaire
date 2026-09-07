import { describe, expect, it } from 'vitest'
import { deciderScan, type ContexteScan, type DecisionScan } from '@/lib/scan'
import { balisePayload, parseBalise } from '@/lib/baliseCode'

/**
 * Ce que fait le scan, dans toutes les situations.
 *
 * Le défaut d'origine (Julien, 7 septembre 2026, capture à l'appui) : viser un
 * QR en phase balise et lire « **Zone fermée** — scannez d'abord une balise
 * pour ouvrir une zone ». Le message était celui de l'article scanné trop tôt,
 * et il répondait à TOUT code non reconnu — donc aussi à un QR qui n'est pas
 * une balise. On croit que le scan a voulu FERMER quelque chose, alors qu'il
 * n'a simplement pas reconnu l'étiquette. La saisie manuelle, elle, marchait :
 * elle ne passe pas par `parseBalise`.
 *
 * D'où sa demande : « vérifie que le scan fonctionne à 100 % dans toutes les
 * situations, compte, audit ». C'est l'objet de ce fichier.
 */

const CTX = (p: Partial<ContexteScan> = {}): ContexteScan => ({
  parBalises: true, baliseOuverte: null, passe: 'count', ...p,
})

const PASSES = ['count', 'audit'] as const

describe('une balise ouvre, ferme, ou passe à la suivante', () => {
  it.each(PASSES)('aucune zone ouverte → elle ouvre la sienne (%s)', (passe) => {
    const d = deciderScan(balisePayload('1000'), CTX({ passe }))
    expect(d).toEqual({ action: 'ouvrir', code: '1000' })
  })

  it.each(PASSES)('la MÊME balise rescannée clôture (%s)', (passe) => {
    const d = deciderScan(balisePayload('1000'), CTX({ passe, baliseOuverte: '1000' }))
    expect(d).toEqual({ action: 'cloturer' })
  })

  it.each(PASSES)('une AUTRE balise clôture puis ouvre (%s)', (passe) => {
    const d = deciderScan(balisePayload('1001'), CTX({ passe, baliseOuverte: '1000' }))
    expect(d).toEqual({ action: 'changer', code: '1001' })
  })

  it('un numéro de balise non numérique passe aussi', () => {
    // Les plages sont numériques, mais rien dans le format ne l'impose : le
    // code voyage tel quel jusqu'à `set_balise`, qui le normalise.
    expect(deciderScan('SCB1:A-12', CTX())).toEqual({ action: 'ouvrir', code: 'A-12' })
  })

  it('⚠️ un deux-points dans le numéro ne coupe pas la balise en deux', () => {
    // `parseBalise` recolle tout ce qui suit le préfixe. Sans ça, « SCB1:1:2 »
    // ouvrirait la balise « 1 » — une autre que celle qu'on vise.
    expect(deciderScan('SCB1:1:2', CTX())).toEqual({ action: 'ouvrir', code: '1:2' })
  })

  it('les espaces autour du code sont ignorés', () => {
    expect(deciderScan('  SCB1:1000  ', CTX())).toEqual({ action: 'ouvrir', code: '1000' })
  })
})

describe('un article ne s’enregistre que dans une zone ouverte', () => {
  it.each(PASSES)('zone ouverte → il part au comptage (%s)', (passe) => {
    const d = deciderScan('5056635611789', CTX({ passe, baliseOuverte: '1000' }))
    expect(d).toEqual({ action: 'article', code: '5056635611789' })
  })

  it.each(PASSES)('⚠️ aucune zone → un refus qui ne parle plus de « zone fermée » (%s)', (passe) => {
    const d = deciderScan('5056635611789', CTX({ passe }))
    expect(d.action).toBe('refus')
    if (d.action !== 'refus') return
    // ⚠️ Le titre ne parle NI de fermeture NI d'un état de zone : les deux
    // laissent croire que le scan a voulu clore quelque chose, alors qu'il
    // vient seulement de ne pas reconnaître ce qu'il a lu. Règle rappelée par
    // Julien le 7 septembre 2026 : « scanner une balise avant de compter doit
    // ouvrir la zone, le téléphone n'est pas censé chercher à la fermer ».
    expect(d.titre).toBe('Code non reconnu')
    expect(d.titre).not.toContain('fermée')
    expect(d.titre).not.toContain('zone')
    // Et il dit le geste qui débloque : ouvrir.
    expect(d.texte).toContain('ouvrir')
  })

  it('⚠️ le refus DIT CE QU’IL A LU', () => {
    // C'est ce qui manquait au correctif du matin : les trois refus disaient
    // pourquoi, aucun ne disait QUOI. Sans cette ligne, un refus se discute ;
    // avec elle, il se tranche — ou le code commence par « SCB1: » et notre
    // lecture est fautive, ou il porte autre chose et ce n'est pas une balise.
    const d = deciderScan('5056635611789', CTX())
    expect(d.action === 'refus' && d.texte).toContain('Code lu : 5056635611789')
  })

  it('⚠️ le code lu est la PREMIÈRE chose du message', () => {
    // Le bandeau d'erreur coupe à trois lignes : posée à la fin, la ligne
    // n'apparaissait pas du tout. Vu sur le Pixel le 7 septembre 2026.
    for (const code of ['5056635611789', 'https://exemple.fr/page']) {
      const d = deciderScan(code, CTX())
      expect(d.action === 'refus' && d.texte.startsWith('Code lu : '), code).toBe(true)
    }
    const b = deciderScan(balisePayload('1'), CTX({ parBalises: false }))
    expect(b.action === 'refus' && b.texte.startsWith('Code lu : ')).toBe(true)
  })

  it('⚠️ un code interminable ne fait pas déborder la carte', () => {
    const d = deciderScan('X'.repeat(300), CTX())
    if (d.action !== 'refus') throw new Error('refus attendu')
    // C'est la PREMIÈRE ligne qui doit tenir : le bandeau coupe à trois, et
    // un QR peut porter une page entière.
    const premiere = d.texte.split('\n')[0]
    expect(premiere.length).toBeLessThan(60)
    expect(premiere).toContain('…')
  })
})

describe('⚠️ un QR qui n’est pas une balise le DIT', () => {
  // C'est le défaut que Julien a vu : ces codes tombaient tous sur
  // « Zone fermée », qui n'a rien à voir avec ce qui vient d'être lu.
  const qrs = [
    'https://exemple.fr/page',
    'HTTP://EXEMPLE.FR',
    'mailto:contact@quantinvo.com',
    'tel:+33123456789',
    'WIFI:S:Boutique;T:WPA;P:secret;;',
    'BEGIN:VCARD\nVERSION:3.0\nFN:Julien\nEND:VCARD',
    'otpauth://totp/Quantinvo:julien?secret=ABC',
  ]

  it.each(qrs)('%s → « Ce n’est pas une balise »', (code) => {
    const d = deciderScan(code, CTX())
    expect(d.action).toBe('refus')
    if (d.action !== 'refus') return
    expect(d.titre).toBe('Ce n’est pas une balise')
    // Le geste qui débloque reste dit : on saisit le numéro.
    expect(d.texte).toContain('numéro')
  })

  it('⚠️ mais un code-barres d’article garde SON refus', () => {
    // Les deux disent d'aller chercher la balise ; ils ne décrivent pas la
    // même erreur, et c'est la seule chose que l'heuristique décide.
    for (const ean of ['5056635611789', '045496428280', 'REF-12', 'SKU_01']) {
      const d = deciderScan(ean, CTX())
      expect(d.action === 'refus' && d.titre, ean).toBe('Code non reconnu')
    }
  })

  it('⚠️ dans une zone ouverte, ce QR redevient un article', () => {
    // On ne devine plus : la personne a ouvert sa zone, elle scanne ce qu'elle
    // veut, et c'est « Article inconnu » qui tranchera après le serveur.
    const d = deciderScan('https://exemple.fr/page', CTX({ baliseOuverte: '1000' }))
    expect(d).toEqual({ action: 'article', code: 'https://exemple.fr/page' })
  })
})

describe('⚠️ un inventaire SANS balises', () => {
  it.each(PASSES)('un code-barres part directement au comptage (%s)', (passe) => {
    const d = deciderScan('5056635611789', CTX({ parBalises: false, passe }))
    expect(d).toEqual({ action: 'article', code: '5056635611789' })
  })

  it('⚠️ une balise scannée là ne devient PAS un article à créer', () => {
    // Avant, elle partait en `resolveArticle`, ne trouvait rien, et ouvrait
    // « Article inconnu » sur « SCB1:1 » : on proposait de créer un article
    // portant le numéro d'une balise dans le référentiel de l'inventaire.
    const d = deciderScan(balisePayload('1'), CTX({ parBalises: false }))
    expect(d.action).toBe('refus')
    if (d.action !== 'refus') return
    expect(d.titre).toBe('Balise inutile ici')
  })

  it('et le refus emploie le verbe de la passe', () => {
    const c = deciderScan(balisePayload('1'), CTX({ parBalises: false, passe: 'count' }))
    const a = deciderScan(balisePayload('1'), CTX({ parBalises: false, passe: 'audit' }))
    expect(c.action === 'refus' && c.texte).toContain('compter')
    expect(a.action === 'refus' && a.texte).toContain('auditer')
  })
})

describe('la matrice entière', () => {
  /**
   * ⚠️ **Le balayage, et ce qu'il garde vraiment.** Les cas nommés ci-dessus
   * décrivent ce qu'on attend ; celui-ci vérifie qu'aucune combinaison ne
   * tombe dans un trou — pas de retour indéfini, pas d'action inconnue, et
   * jamais un refus muet. C'est la réponse à « 100 % dans toutes les
   * situations » : la matrice est petite, autant la parcourir en entier.
   */
  const codes = [
    balisePayload('1000'), balisePayload('1001'), balisePayload('A:B'),
    '5056635611789', '045496428280', 'REF-12',
    'https://exemple.fr', 'BEGIN:VCARD\nEND:VCARD',
    '', '   ',
  ]
  const actions = ['cloturer', 'changer', 'ouvrir', 'article', 'refus']

  it('aucune combinaison ne tombe dans un trou', () => {
    let n = 0
    for (const parBalises of [true, false]) {
      for (const baliseOuverte of [null, '1000']) {
        for (const passe of PASSES) {
          for (const code of codes) {
            const d: DecisionScan = deciderScan(code, { parBalises, baliseOuverte, passe })
            const ou = `${parBalises ? 'balises' : 'classique'}/${baliseOuverte ?? 'aucune'}/${passe}/${JSON.stringify(code)}`
            expect(actions, ou).toContain(d.action)
            if (d.action === 'refus') {
              expect(d.titre.length, ou).toBeGreaterThan(0)
              expect(d.texte.length, ou).toBeGreaterThan(0)
              // ⚠️ Tout refus dit ce qu'il a lu — sauf le code vide, où il n'y
              // a précisément rien à montrer.
              if (code.trim()) expect(d.texte, ou).toContain('Code lu :')
            }
            if (d.action === 'article' || d.action === 'ouvrir' || d.action === 'changer') {
              expect(d.code.length, ou).toBeGreaterThan(0)
            }
            n++
          }
        }
      }
    }
    expect(n).toBe(2 * 2 * 2 * codes.length)
  })

  it('⚠️ un code vide ne s’enregistre jamais', () => {
    for (const code of ['', '   ', '\n']) {
      for (const parBalises of [true, false]) {
        for (const baliseOuverte of [null, '1000']) {
          const d = deciderScan(code, { parBalises, baliseOuverte, passe: 'count' })
          expect(d.action, JSON.stringify(code)).toBe('refus')
        }
      }
    }
  })

  it('⚠️ la passe ne change JAMAIS l’action, seulement les mots', () => {
    // Compter et auditer se scannent pareil : c'est le même geste sur le même
    // rayon. Si un jour la passe faisait diverger une décision, ce serait un
    // défaut — l'écran, lui, n'a qu'un seul chemin.
    for (const parBalises of [true, false]) {
      for (const baliseOuverte of [null, '1000']) {
        for (const code of codes) {
          const c = deciderScan(code, { parBalises, baliseOuverte, passe: 'count' })
          const a = deciderScan(code, { parBalises, baliseOuverte, passe: 'audit' })
          expect(a.action, code).toBe(c.action)
        }
      }
    }
  })
})

describe('le format du QR, celui que la planche imprime', () => {
  it('ce que `balisePayload` écrit, `parseBalise` le relit', () => {
    // La boucle complète : c'est ce que le scan doit reconnaître, et c'est ce
    // que le PDF dessine (`balises.ts` appelle `balisePayload`).
    for (const code of ['1', '42', '1000', '99999', 'A-12']) {
      expect(parseBalise(balisePayload(code))).toEqual({ code })
      expect(deciderScan(balisePayload(code), CTX())).toEqual({ action: 'ouvrir', code })
    }
  })

  it('⚠️ un préfixe voisin n’est pas une balise', () => {
    for (const faux of ['SCB:1', 'SCB2:1', 'scb1:1', 'XSCB1:1', 'SCB1', 'SCB1:']) {
      expect(parseBalise(faux), faux).toBeNull()
    }
  })
})
