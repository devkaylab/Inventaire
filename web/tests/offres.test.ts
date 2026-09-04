import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OFFRES, OFFRE_PHARE, SUPPLEMENT, APPAREILS_MAX, economie, parAppareil, offrePour, euros } from '../lib/offres'

const lire = (p: string) => readFileSync(join(__dirname, p), 'utf8')

describe('la grille tarifaire', () => {
  it('couvre les appareils sans trou ni recouvrement', () => {
    expect(OFFRES[0].min).toBe(1)
    for (let i = 1; i < OFFRES.length; i++) {
      expect(OFFRES[i].min, `${OFFRES[i].nom} doit reprendre où ${OFFRES[i - 1].nom} s’arrête`)
        .toBe(OFFRES[i - 1].max + 1)
    }
    expect(OFFRES[OFFRES.length - 1].max).toBe(APPAREILS_MAX)
  })

  it('reste dégressive : le prix par appareil baisse à chaque palier', () => {
    // C'est la règle posée par Julien — la petite offre coûte le plus cher à
    // l'unité — et c'est elle qui rend l'empilement perdant.
    const parAppareils = OFFRES.map(parAppareil)
    for (let i = 1; i < parAppareils.length; i++) {
      expect(parAppareils[i], `${OFFRES[i].nom} doit coûter moins par appareil`)
        .toBeLessThan(parAppareils[i - 1])
    }
    // Et le supplément au-delà du plafond continue de descendre : au tarif
    // moyen d'Enterprise (9 450 ÷ 100) il reconduirait le palier au lieu de le
    // prolonger, et figerait la dégressivité.
    const dernier = parAppareils[parAppareils.length - 1]
    expect(SUPPLEMENT.an / SUPPLEMENT.par).toBeLessThan(dernier)
  })

  it('rend l’empilement perdant, sans avoir besoin d’un verrou', () => {
    // Un prix qui a besoin d'une clause juridique pour tenir est mal calé :
    // couvrir un palier en cumulant l'offre du dessous doit coûter plus cher.
    for (let i = 1; i < OFFRES.length; i++) {
      const cible = OFFRES[i]
      const dessous = OFFRES[i - 1]
      const licences = Math.ceil(cible.max / dessous.max)
      expect(licences * dessous.an, `${licences} ${dessous.nom} doivent coûter plus que ${cible.nom}`)
        .toBeGreaterThan(cible.an)
    }
  })

  it('récompense le paiement annuel dans les trois offres', () => {
    for (const o of OFFRES) {
      expect(economie(o), `${o.nom} doit être moins cher à l’année`).toBeGreaterThan(0)
      // Douze mensualités, pas treize : la piste « toutes les 4 semaines » a
      // été écartée le 30 août 2026.
      expect(o.mois * 12).toBeGreaterThan(o.an)
    }
    expect(OFFRES.map(economie)).toEqual([118, 420, 1230])
  })

  it('désigne la bonne offre pour un nombre d’appareils', () => {
    expect(offrePour(1)?.nom).toBe('Essential')
    expect(offrePour(2)?.nom).toBe('Essential')
    expect(offrePour(3)?.nom).toBe('Advanced')
    expect(offrePour(20)?.nom).toBe('Advanced')
    expect(offrePour(21)?.nom).toBe('Enterprise')
    expect(offrePour(100)?.nom).toBe('Enterprise')
    expect(offrePour(101), 'au-delà du plafond, le tarif se construit').toBeNull()
  })

  it('met en forme les montants sans dépendre d’ICU', () => {
    // Le séparateur de milliers d'ICU diffère entre Node et le navigateur
    // selon les versions : une page rendue des deux côtés se désynchronise.
    expect(euros(690)).toBe('690 €')
    expect(euros(2400)).toBe('2 400 €')
    expect(euros(6900)).toBe('6 900 €')
  })
})

describe('la page tarifs', () => {
  const page = lire('../app/tarifs/page.tsx')
  const grille = lire('../components/TarifsGrille.tsx')

  it('reste hors de la coquille', () => {
    // Elle s'ouvre au téléphone — c'est la première page qu'un prospect
    // regarde, souvent depuis un lien. AppShell la fermerait sous 720 px.
    expect(page).not.toContain('<AppShell')
    expect(page).toContain('<SiteHeader />')
    expect(page).toContain('<SiteFooter />')
  })

  it('n’écrit aucun prix en dur', () => {
    // Une seule définition : lib/tarifs.ts. Un prix recopié dans le JSX
    // divergerait au premier ajustement.
    for (const montant of ['690', '2 400', '2 400', '6 900', '6 900', '225 €', '650 €']) {
      expect(grille, `le montant ${montant} ne doit pas être écrit en dur`).not.toContain(montant)
    }
    expect(grille).toContain("from '@/lib/offres'")
  })

  it('affiche le mensuel par défaut', () => {
    // Le mensuel est le chiffre auquel un acheteur compare ; l'annuel est
    // présenté comme une économie.
    expect(grille).toContain('useState(false)')
    expect(grille).toContain('economie(o)')
  })

  it('met en avant une seule offre, celle du milieu', () => {
    expect(OFFRE_PHARE).toBe('advanced')
    expect(OFFRES.filter((o) => o.cle === OFFRE_PHARE)).toHaveLength(1)
  })

  it('n’annonce pas la remise réseau, reportée après le lancement', () => {
    // Elle est chiffrée dans docs/entreprise/hypotheses-tarifaires.md mais
    // n'existe pas encore : l'annoncer serait une promesse sans tarif.
    for (const texte of [page, grille, lire('../lib/offres.ts').split('export type')[1] ?? '']) {
      expect(texte).not.toMatch(/−\s?(10|20|30)\s?%/)
    }
  })

  it('figure dans la navigation publique', () => {
    const chrome = lire('../components/SiteChrome.tsx')
    expect(chrome.match(/href="\/tarifs"/g) ?? [], 'en-tête et pied').toHaveLength(2)
  })
})

describe('le contrat dit la même chose que la page', () => {
  // Reprise de la garde qui vivait dans inscription-entreprise.test.ts avant le
  // 30 août 2026 : c'est le contrat qui fait foi, et un montant qui changerait
  // d'un côté sans l'autre ferait souscrire à un prix que les CGV ne prévoient
  // pas.
  const cgv = readFileSync(join(__dirname, '../../docs/entreprise/cgv-quantinvo-brouillon.md'), 'utf8')
  // Les retours à la ligne du markdown tombent où ils veulent, et le fichier
  // mêle les deux apostrophes : on compare le texte, pas sa mise en forme.
  const plat = cgv.replace(/\s+/g, ' ').replace(/\u2019/g, "'")
  // euros() groupe les milliers par une espace insécable étroite ; le markdown
  // écrit une espace ordinaire. On compare des montants, pas des blancs.
  const sansBlanc = (t: string) => t.replace(/\s+/g, ' ')

  it('reprend la grille à l’annexe 2 des CGV', () => {
    for (const o of OFFRES) {
      expect(plat, `${o.nom} absente de l’annexe 2`).toContain(`| ${o.nom} |`)
      expect(plat, `le prix mensuel de ${o.nom}`).toContain(sansBlanc(`| ${euros(o.mois)} |`))
      expect(plat, `le prix annuel de ${o.nom}`).toContain(sansBlanc(`| ${euros(o.an)} |`))
    }
    expect(plat, 'le supplément mensuel').toContain(sansBlanc(`**${euros(SUPPLEMENT.mois)} par mois**`))
    expect(plat, 'le supplément annuel').toContain(sansBlanc(`**${euros(SUPPLEMENT.an)} par an**`))
  })

  it('dit que le prix ne suit ni le stock ni le nombre d’inventaires', () => {
    expect(plat).toContain('Ni le volume de stock')
    expect(plat).toContain("ni le nombre d'Inventaires réalisés dans l'année")
  })

  it('énonce les deux engagements, qui ne sont pas les mêmes', () => {
    // Mensuel sans engagement, annuel dû jusqu'au terme (décision du 30 août
    // 2026). La page l'annonce, le contrat doit le tenir — et l'inverse.
    expect(plat, 'le mensuel s’arrête quand on veut').toContain("**aucune somme n'est due au-delà**")
    expect(plat, 'l’annuel reste dû').toContain("le prix de l'année entière reste dû")
    expect(plat, 'l’accès est maintenu jusqu’au terme').toContain("conserve l'accès complet au Service jusqu'au terme")
  })

  it('ne promet aucun remboursement au Client qui résilie de lui-même', () => {
    // La page dit « sans engagement » en tête : c'est vrai du mensuel, et
    // seulement de lui. Le contrat ne doit pas laisser croire l'inverse.
    expect(plat).toContain('ne donne lieu à aucun remboursement, même au prorata')
    // Mais le prorata reste dû quand le manquement vient de l'Éditeur.
    expect(plat).toContain('la part de licence non consommée est remboursée au prorata')
  })
})

describe('le site ne contredit plus la grille', () => {
  it('ne facture plus au volume de stock sur les pages publiques', () => {
    // La grille au volume a cessé d'être l'assiette le 30 août 2026. Une page
    // qui l'annonce encore promet un devis qu'on n'établit plus ainsi.
    for (const p of ['../app/page.tsx', '../app/pourquoi-nous-choisir/page.tsx', '../app/inscription/page.tsx']) {
      expect(lire(p), `${p} annonce encore l’ancienne grille`).not.toContain('au volume de votre stock')
    }
  })
})

describe('l’assiette est l’appareil, jamais le compte', () => {
  // ⚠️ Relevé par Julien le 4 septembre 2026 : Essential annonçait « un
  // magasin, deux comptes ». C'est un contresens sur le modèle même — on
  // facture les appareils qui comptent EN MÊME TEMPS, pas les personnes. Une
  // équipe de dix saisonniers peut tourner sur deux téléphones, et c'est
  // l'argument de vente, pas une tolérance.
  it('aucun argumentaire d’offre ne compte des personnes', () => {
    for (const o of OFFRES) {
      for (const point of o.points) {
        expect(point, `${o.nom} : « ${point} »`).not.toMatch(/\bcomptes?\b(?! illimités)/i)
        expect(point, `${o.nom} : « ${point} »`).not.toMatch(/utilisateurs?/i)
      }
    }
  })

  it('et Essential dit ce que couvre son palier', () => {
    const essential = OFFRES.find((o) => o.cle === 'essential')!
    expect(essential.points.join(' | ')).toContain('deux appareils à la fois')
    expect(essential.points.join(' | ')).toContain('comptes illimités')
  })
})

describe('les libellés de la grille', () => {
  it('annoncent « Jusqu’à N », jamais une borne basse', () => {
    // Julien, 4 septembre 2026 : une borne basse n'aide personne à choisir —
    // elle donne l'impression qu'on peut être « trop petit » pour une offre —
    // et elle est redondante, le palier en dessous dit déjà où il s'arrête.
    for (const o of OFFRES) {
      expect(o.plage).toBe(`Jusqu’à ${o.max} appareils`)
    }
  })

  it('la grille invite à commencer, elle ne fait pas choisir', () => {
    // « Choisir Essential » décrit un tri ; « Commencer avec Essential » dit ce
    // qui va se passer.
    const grille = lire('../components/TarifsGrille.tsx')
    expect(grille).toContain('Commencer avec {o.nom}')
    expect(grille).not.toContain('Choisir {o.nom}')
  })
})
