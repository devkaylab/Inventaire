// La vitrine — ce que la refonte du 5 septembre 2026 ne doit pas défaire.
//
// Constat de Julien, après une comparaison avec qonto.com/fr : « les sections
// se ressemblent toutes et je n'arrive pas à distinguer chacune d'entre elles,
// on aurait dit une page brouillon faite par un débutant ». Mesuré : nos huit
// sections vivaient sur une seule couleur, sans surtitre, sans preuve, sans
// image du produit et sans prix. Ces gardes figent le remède.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFRES } from '../lib/offres'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const accueil = lire('../components/vitrine/Accueil.tsx')
const css = lire('../app/globals.css')

/** Le code seul : un commentaire qui EXPLIQUE une règle en cite les mots. */
const sansCommentaires = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('la vitrine alterne ses fonds', () => {
  it('les quatre bandes existent, et chacune porte un fond', () => {
    // Une section n'est pas une marge : sans fond, huit blocs empilés se lisent
    // comme une seule colonne de texte.
    for (const bande of ['bande-surface', 'bande-encre', 'bande-accent']) {
      expect(css, `.${bande} n’a plus de fond`).toMatch(
        new RegExp(`\\.${bande}\\s*\\{[^}]*background:`),
      )
      expect(accueil, `l’accueil n’emploie plus ${bande}`).toContain(bande)
    }
  })

  it('⚠️ l’accent ne sert QU’UNE FOIS, à la fin', () => {
    // Un accent qui revient trois fois ne conclut plus rien : c'est ce qui
    // distingue un rappel final d'un fond parmi d'autres.
    const code = sansCommentaires(accueil)
    expect(code.match(/bande-accent/g) ?? []).toHaveLength(1)
    // Et c'est bien la dernière bande de la page.
    expect(code.lastIndexOf('bande-accent')).toBeGreaterThan(code.lastIndexOf('bande-surface'))
  })

  it('⚠️ l’encre est sombre dans les DEUX thèmes, et TRANCHE sur le fond de page', () => {
    // C'est le bandeau de la charte, celui des e-mails et de l'en-tête de
    // l'app : il reste sombre même en thème clair.
    //
    // ⚠️ ET LA SECONDE MOITIÉ EST CELLE QU'ON OUBLIE. Premier jet du
    // 5 septembre 2026 : --encre valait #0b0f19 partout, donc exactement --bg
    // en thème sombre — la bande disparaissait. Les deux valeurs étaient
    // justes prises isolément ; c'est leur RAPPORT qui était faux. Une garde
    // qui ne regarde qu'une couleur ne voit pas ça.
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    // ⚠️ Les jetons sont posés par PLUSIEURS blocs `:root` — celui d'en-tête et
    // celui de la vitrine. Ne lire que le premier, c'est déclarer absent un
    // jeton défini trois mille lignes plus bas.
    const blocs = (selecteur: RegExp) => [...css.matchAll(selecteur)].map((m) => m[1]).join('\n')
    const jeton = (src: string, nom: string) =>
      new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})`, 'i').exec(src)?.[1]

    const sombre = blocs(/:root\s*\{([\s\S]*?)\n\}/g)
    const clair = blocs(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/g)

    for (const [theme, src] of [['sombre', sombre], ['clair', clair]] as const) {
      const encre = jeton(src, 'encre')
      const fond = jeton(src, 'bg')
      expect(encre, `--encre est absente du thème ${theme}`).toBeTruthy()
      expect(fond, `--bg est absente du thème ${theme}`).toBeTruthy()
      expect(lum(encre!), `l’encre du thème ${theme} n’est plus sombre`).toBeLessThan(0.1)
      expect(encre, `en thème ${theme}, l’encre a la couleur du fond de page : la bande disparaît`)
        .not.toBe(fond)
    }
  })
})

describe('la preuve est chiffrée, vraie, et ne vend pas le point de rupture', () => {
  it('⚠️ elle n’annonce jamais le plafond mesuré', () => {
    // 400 000 références est la LIMITE relevée le 3 septembre 2026, et le
    // produit s'alerte lui-même dès 150 000. L'écrire sur la vitrine, c'est
    // promettre le point où il casse. Voir AGENTS.md, « On est prévenu avant
    // le client ».
    const code = sansCommentaires(accueil)
    expect(code).not.toMatch(/400[\s ]?000/)
    expect(code).not.toMatch(/150[\s ]?000/)
  })

  it('⚠️ « jusqu’à » porte les deux promesses qui ne tiennent pas ensemble', () => {
    // Cent compteurs, c'est vrai sur un inventaire ordinaire ; sur un
    // inventaire de 400 000 références, le treizième appel simultané dépasse
    // déjà le délai serveur. Le mot dit le plafond sans promettre les deux.
    const code = sansCommentaires(accueil)
    const ligne = code.split('\n').find((l) => /100\b/.test(l) && /compteurs/.test(l))
    expect(ligne, 'la ligne des compteurs a disparu de la preuve').toBeTruthy()
    expect(ligne, 'elle promet cent compteurs sans réserve').toMatch(/[Jj]usqu’à/)
  })

  it('aucun client n’est inventé', () => {
    // On n'en a pas encore un seul, et une fausse référence se paie cher.
    expect(sansCommentaires(accueil)).not.toMatch(/nous font confiance|clients? satisfaits?|témoignage/i)
  })
})

describe('le prix vit sur l’accueil, et vient d’un seul endroit', () => {
  it('les trois offres sont affichées', () => {
    expect(accueil).toContain('OFFRES.map')
    expect(accueil).toContain('OFFRE_PHARE')
  })

  it('⚠️ aucun montant n’est écrit en dur', () => {
    // Sinon la grille se met à exister en deux endroits, et une revalorisation
    // laisse la vitrine sur l'ancien tarif — le défaut exact qui a fait
    // redéployer `subscribe-online` le 4 septembre 2026.
    const code = sansCommentaires(accueil)
    for (const o of OFFRES) {
      for (const montant of [o.mois, o.an]) {
        const motif = new RegExp(`\\b${montant.toLocaleString('fr-FR').replace(/\s| | /g, '[\\\\s\\u00a0\\u202f]?')}\\b`)
        expect(code, `${o.nom} : le montant ${montant} est écrit en dur`).not.toMatch(motif)
      }
    }
    expect(code).toContain('euros(o.mois)')
  })
})

describe('chaque bouton mène là où son libellé le promet', () => {
  it('⚠️ le bouton d’une offre porte CETTE offre jusqu’à la souscription', () => {
    // Vu le 5 septembre 2026 en parcourant les liens un par un : les trois
    // boutons pointaient sur `/souscrire` tout court, et cet écran retombe sur
    // son offre par défaut. « Commencer avec Enterprise » ouvrait Essential.
    expect(accueil).toContain('href={lien(`/souscrire?offre=${o.cle}`)}')
    // Et l'écran d'arrivée lit bien ce paramètre — sinon on le passerait dans
    // le vide.
    expect(lire('../components/vitrine/PageSouscrire.tsx')).toContain("params.get('offre')")
  })

  it('les liens internes de l’accueil visent des routes qui existent', () => {
    // Une route renommée laisse un bouton qui mène à un 404, et rien ne le dit.
    // Les liens de la vitrine passent par `lien('…')`, qui préfixe `/en` sur la
    // version anglaise : on lit l'adresse française qu'il reçoit.
    const routes = [
      ...[...accueil.matchAll(/href="(\/[a-z0-9/-]*)"/g)].map((m) => m[1]),
      ...[...accueil.matchAll(/href=\{lien\('(\/[a-z0-9/-]*)'\)\}/g)].map((m) => m[1]),
    ]
    expect(routes.length, 'plus aucun lien interne sur l’accueil').toBeGreaterThan(0)
    for (const r of new Set(routes)) {
      const page = path.resolve(__dirname, '../app' + (r === '/' ? '' : r) + '/page.tsx')
      expect(() => readFileSync(page), `${r} ne correspond à aucune page`).not.toThrow()
    }
  })

  it('l’ancre du héros et celle de la barre tombent sur une section', () => {
    for (const ancre of [...accueil.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1])) {
      expect(accueil, `l’ancre #${ancre} ne désigne aucune section`).toContain(`id="${ancre}"`)
    }
    // La barre publique renvoie vers #fonctionnalites : elle vit ailleurs, mais
    // c'est l'accueil qui doit porter la cible.
    const barre = lire('../components/SiteChrome.tsx')
    for (const ancre of [...barre.matchAll(/href="\/#([\w-]+)"/g)].map((m) => m[1])) {
      expect(accueil, `la barre vise #${ancre}, absent de l’accueil`).toContain(`id="${ancre}"`)
    }
  })
})

describe('le bouton dit le bénéfice, la barre dit la démarche', () => {
  it('⚠️ le héros ne dit plus « Inscrire mon entreprise »', () => {
    // Personne ne se lève le matin pour inscrire une entreprise. La barre du
    // haut, elle, garde le libellé explicite : c'est un repère de navigation,
    // pas un argument — Qonto fait exactement ce partage.
    const code = sansCommentaires(accueil)
    expect(code).toContain('Fiabiliser mon stock')
    expect(code, 'le héros a repris le libellé de la barre').not.toContain('Inscrire mon entreprise')
    expect(sansCommentaires(lire('../components/HeaderActions.tsx'))).toContain('Inscrire mon entreprise')
  })
})

describe('le produit se voit', () => {
  it('la capture citée existe vraiment', () => {
    // Une image absente ne casse pas le build : elle laisse un cadre vide sur
    // la vitrine. Même garde que le guide de prise en main.
    //
    // ⚠️ Elle ne cherchait que `src="…"`, la forme ATTRIBUT. Le 11 septembre
    // 2026 les images sont passées en propriétés (`src: '…'`) du diaporama :
    // la garde n'a plus rien trouvé, donc elle est passée au vert sans rien
    // vérifier. Les deux formes, et on exige d'en trouver au moins une.
    const citees = [...accueil.matchAll(/src[:=]\s*["'](\/[^"']+\.png)["']/g)].map((m) => m[1])
    expect(citees.length, 'aucune capture citée : la garde ne garde plus rien').toBeGreaterThan(0)
    for (const src of citees) {
      expect(
        () => readFileSync(path.resolve(__dirname, '../public' + src)),
        `la capture ${src} n’existe pas`,
      ).not.toThrow()
    }
  })

  it('⚠️ le tableau de bord est une CAPTURE, plus un dessin', () => {
    // Le bloc de droite était dessiné en code, avec des chiffres inventés —
    // 68 % des balises, 4 820 pièces. Décision de Julien, 11 septembre 2026 :
    // « je préfère une vraie capture ». Le composant dessiné reste dans le
    // dépôt, mais l'accueil ne l'appelle plus.
    expect(accueil).not.toContain('ApercuTableauDeBord')
    expect(accueil).toContain('/vitrine/suivi.png')
  })

  it('⚠️ les points du diaporama ne restent jamais invisibles', () => {
    // Ils apparaissent un par un, une seconde entre chacun. Deux façons de se
    // retrouver avec une liste vide à l'écran, et la garde tient les deux :
    // une préférence « moins d'animation » doit TOUT montrer d'un coup, et la
    // révélation ne doit pas dépendre du défilement (un lecteur qui ne fait
    // pas défiler la section ne verrait rien).
    const diapo = lire('../components/DiaporamaProduit.tsx')
    expect(diapo).toContain('prefers-reduced-motion')
    expect(diapo).toMatch(/setVus\(total\)/)
    expect(diapo).not.toContain('IntersectionObserver')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\{[^]*?\.duo-points li \{ opacity: 1/)
  })

  it('⚠️ la colonne du téléphone reste BORNÉE', () => {
    // Sur l'écran de Julien (1568 px), une grille à deux parts égales étirait
    // la capture à plus du double de sa résolution. Le remède du 5 septembre
    // 2026 : on remplit la largeur, on n'étire jamais.
    //
    // ⚠️ La garde porte sur la BORNE, pas sur sa valeur : elle citait
    // « minmax(180px, 236px) » mot pour mot et elle est tombée le 11 septembre
    // quand la colonne a grandi — sur un changement voulu, sans rien avoir
    // protégé. Ce qu'elle défend, c'est qu'il y ait un plafond en pixels.
    const bloc = /\.duo\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc).toMatch(/minmax\(\s*\d+px\s*,\s*\d+px\s*\)/)
    expect(bloc).not.toMatch(/grid-template-columns:[^;]*1fr\s+1fr/)
  })

  it('⚠️ montre la capture ENCADRÉE, et ne lui dessine aucun cadre', () => {
    // Constat de Julien, 11 septembre 2026 : « je veux celle avec l'encadré ».
    // La capture encadrée porte le téléphone dessiné sur fond TRANSPARENT —
    // un `border`, un `box-shadow` ou un `border-radius` en CSS tracerait donc
    // un rectangle autour de lui, ou lui rognerait les coins.
    expect(accueil).toContain('/vitrine/comptage-encadre.png')
    const bloc = /\.duo-tel img\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc.length).toBeGreaterThan(0)
    for (const interdit of ['border', 'box-shadow', 'radius']) {
      expect(bloc, `.duo-tel img ne doit pas porter ${interdit}`).not.toContain(interdit)
    }
  })

  it('⚠️ la capture du tableau de bord passe en pleine largeur avant le téléphone', () => {
    // À deux colonnes sur un écran de 900 px, elle tombait à 425 px et on n'y
    // lisait plus rien. Elle s'empile donc bien plus tôt que le téléphone, qui
    // est étroit par nature et tient à côté de son texte jusqu'au bout.
    const seuil = /@media \(max-width: (\d+)px\)\s*\{\s*\.duo--paysage \{[^}]*grid-template-columns: minmax\(0, 1fr\)/
      .exec(css)
    expect(seuil, 'le paysage ne s’empile nulle part').not.toBeNull()
    expect(Number(seuil![1])).toBeGreaterThan(900)
  })

  it('⚠️ la section des visuels sort du gabarit de LECTURE, et elle seule', () => {
    // `.container` plafonne à 1080 px parce que c'est une largeur de lecture.
    // Ici il n'y a pas de texte à lire mais deux visuels à voir : les brider à
    // une largeur de texte les rendait petits. Ne pas généraliser.
    expect(accueil).toContain('container container-large')
    expect(css).toMatch(/\.container-large\s*\{[^}]*max-width/)
    const usages = (accueil.match(/container-large/g) ?? []).length
    expect(usages, 'un seul bloc échappe au gabarit de lecture').toBe(1)
  })
})
