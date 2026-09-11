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

  it('⚠️ les deux diapositives ont la MÊME taille', () => {
    // Constat de Julien, 11 septembre 2026 : « ça fait trop bizarre d'avoir
    // deux tailles ». Le téléphone avait une largeur figée, la capture suivait
    // l'écran : 718 px de haut contre 468 sur un portable. La largeur du
    // téléphone se CALCULE donc à partir de celle de la section, pour que les
    // deux hauteurs s'égalent quelle que soit la largeur d'écran.
    //
    // ⚠️ La garde porte sur le mécanisme, pas sur la valeur : elle citait
    // « minmax(180px, 236px) » mot pour mot, et elle est tombée deux fois sur
    // des changements voulus sans rien avoir protégé.
    const bloc = /\.duo\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    // Un plafond en pixels — sans lui la capture s'étirerait au-delà de sa
    // résolution sur un grand écran.
    expect(bloc).toMatch(/min\(\s*\d+px\s*,/)
    // Et une largeur qui SUIT celle de la section, sinon les deux se
    // désaccordent dès qu'on change d'écran.
    expect(bloc).toMatch(/calc\([^)]*100vw/)
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

  it('⚠️ la capture du tableau de bord prend TOUTE la largeur', () => {
    // C'est la seule façon qu'elle atteigne la hauteur du téléphone d'en face :
    // deux fois plus large que haute, il lui faudrait 1 500 px de large pour
    // l'égaler — plus que la section entière. Elle n'est donc pas une colonne
    // d'une grille à deux, et son texte passe dessous.
    const bloc = /\.duo--paysage\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc).toContain('display: block')
    expect(bloc).not.toContain('grid-template-columns')
    // Les quatre points forment une rangée sous la capture.
    expect(css).toMatch(/\.duo--paysage \.duo-points \{[^}]*flex-direction: row/)
  })

  it('⚠️ l’en-tête et le pied tiennent les DEUX BORDS de l’écran', () => {
    // `.container` plafonne à 1080 px : c'est une largeur de TEXTE. Une barre
    // de navigation bridée à cette largeur flotte au milieu avec deux marges
    // vides — constat de Julien, 11 septembre 2026, Qonto à l'appui.
    //
    // ⚠️ Cela ne vaut QUE pour la coquille : les blocs de texte gardent leur
    // largeur de lecture. La garde vérifie donc aussi que `.container` n'a pas
    // été élargi au passage.
    expect(css).toMatch(/\.site-header \.inner,\s*\n\.site-footer \.inner \{[^}]*max-width: none/)
    expect(css).toMatch(/\.container \{[^}]*max-width: var\(--max\)/)
    expect(css).toMatch(/--max:\s*1080px/)
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

describe('le héros filmé', () => {
  const video = lire('../components/FondVideo.tsx')

  it('⚠️ la vidéo ne change pas la hauteur de la section', () => {
    // C'est la demande, mot pour mot : « sans qu'on touche à la taille de la
    // section ». Elle est posée sur toute la surface et recadrée — c'est elle
    // qui s'ajuste au héros, jamais l'inverse.
    const bloc = /\.hero-film \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc).toContain('position: absolute')
    expect(bloc).toContain('inset: 0')
    expect(bloc).toContain('object-fit: cover')
    // Et rien qui pousse : pas de hauteur imposée au héros par la vidéo.
    expect(bloc).not.toMatch(/min-height|aspect-ratio/)
  })

  it('⚠️ elle tourne en boucle, muette, sans plein écran forcé', () => {
    // `muted` n'est pas un confort : c'est la CONDITION de la lecture
    // automatique dans tous les navigateurs. `playsInline` empêche iOS de
    // passer en plein écran au démarrage.
    for (const attr of ['muted', 'loop', 'playsInline']) {
      expect(video, `la vidéo doit être ${attr}`).toContain(attr)
    }
  })

  it('⚠️ elle ne se télécharge PAS quand elle ne doit pas', () => {
    // Deux mégaoctets imposés à quelqu'un en 4G pour un décor, ce serait le
    // prendre en otage — et une vidéo qui tourne est exactement ce qu'une
    // préférence « moins d'animation » vise. La source n'est posée qu'après
    // ces deux contrôles ; sinon il reste l'image d'attente.
    expect(video).toContain('prefers-reduced-motion')
    expect(video).toContain('innerWidth < 900')
    expect(video).toContain('preload="none"')
    const garde = video.indexOf('prefers-reduced-motion')
    const pose = video.indexOf('setSource(src)')
    expect(garde).toBeGreaterThan(0)
    expect(pose, 'la source doit être posée APRÈS les gardes').toBeGreaterThan(garde)
  })

  it('⚠️ le voile existe : sans lui le titre n’est plus lisible', () => {
    // Mesuré sur six instants de la vidéo : le contraste du titre tombe entre
    // 4,65 et 5,55 au pixel le plus clair. Sans le voile il passe sous le
    // seuil. Ce n'est pas une décoration.
    expect(css).toMatch(/\.hero-film-fond::after \{[^}]*background:/)
  })

  it('⚠️ le héros est une bande ENCRE dans les deux thèmes', () => {
    // La vidéo ouvre et ferme sur un fondu au noir (1,5 s et 1,3 s, mesurés) :
    // sur un fond clair, ces fondus feraient deux éclairs noirs toutes les onze
    // secondes. La règle vit donc hors de toute requête de thème.
    const i = css.indexOf('.hero-film-fond {')
    expect(i).toBeGreaterThan(0)
    const avant = css.slice(0, i)
    const ouvertes = (avant.match(/@media[^{]*\{/g) ?? []).length
    const fermees = (avant.match(/\}/g) ?? []).length
    // Si la règle était dans un @media, il resterait une accolade ouverte.
    expect(ouvertes, 'la bande encre ne doit pas dépendre du thème').toBeLessThan(fermees)
    expect(css.slice(i, i + 400)).toContain('var(--encre)')
  })
})

describe('le héros va à l’essentiel, et les réglages sont dans la coquille', () => {
  const chrome = lire('../components/SiteChrome.tsx')
  const drapeau = lire('../components/Drapeau.tsx')

  it('⚠️ le titre est d’une seule encre, et sans surtitre', () => {
    // Demande de Julien, 11 septembre 2026. « Outil d'inventaire » répétait ce
    // que la phrase juste dessous dit mieux, et le dégradé coupait le titre en
    // deux à l'endroit où il doit se lire d'un trait.
    // ⚠️ Sans les commentaires : celui du héros explique pourquoi le dégradé
    // est parti, et « dégradé » contient « grad ». La garde se lisait
    // elle-même.
    const code = sansCommentaires(accueil)
    const hero = code.slice(code.indexOf('hero-plein'), code.indexOf('</section>'))
    expect(hero).not.toContain('eyebrow')
    expect(hero).not.toContain('grad')
  })

  it('⚠️ la langue est dans la BARRE et dans le PIED', () => {
    // Elle était une pastille flottante dans un coin, où elle se prend pour un
    // bouton d'aide. Les deux places : on la voit en arrivant, et on la
    // retrouve en bas quand on ne l'a pas vue en haut.
    const barre = chrome.slice(chrome.indexOf('<header'), chrome.indexOf('</header>'))
    const pied = chrome.slice(chrome.indexOf('<footer'))
    expect(barre).toMatch(/<LangueToggle place="pose"/)
    expect(pied).toMatch(/<LangueToggle place="pose"/)
  })

  it('⚠️ le thème est au pied, et le bouton flottant s’efface alors', () => {
    // Il vit dans le layout RACINE, donc sur toutes les pages — y compris
    // l'espace connecté et la page de devis, qui n'ont ni barre ni pied où le
    // poser. On ne le retire pas : on le masque là où il ferait doublon.
    const pied = chrome.slice(chrome.indexOf('<footer'))
    expect(pied).toMatch(/<ThemeToggle place="pose"/)
    expect(lire('../app/layout.tsx')).toContain('<ThemeToggle />')
    expect(css).toMatch(/body:has\(\.site-footer\) \.theme-toggle \{[^}]*display: none/)
  })

  it('⚠️ les drapeaux sont DESSINÉS, jamais des émoji', () => {
    // `🇫🇷` ne s'affiche comme un drapeau que sur Apple et Android : sur
    // Windows le navigateur rend deux lettres, « FR ». Un visiteur sur PC —
    // donc la majorité — verrait un code là où on annonce un drapeau.
    // ⚠️ Sans les commentaires, là encore : celui du fichier CITE les deux
    // émoji pour dire qu'on ne les emploie pas.
    expect(drapeau).toContain('<svg')
    expect(sansCommentaires(drapeau)).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u)
  })
})
