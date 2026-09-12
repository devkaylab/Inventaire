// La vitrine — ce que la refonte du 5 septembre 2026 ne doit pas défaire.
//
// Constat de Julien, après une comparaison avec qonto.com/fr : « les sections
// se ressemblent toutes et je n'arrive pas à distinguer chacune d'entre elles,
// on aurait dit une page brouillon faite par un débutant ». Mesuré : nos huit
// sections vivaient sur une seule couleur, sans surtitre, sans preuve, sans
// image du produit et sans prix. Ces gardes figent le remède.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFRES } from '../lib/offres'
import { AUTO_MS, apparitionFinie, avanceAutorisee, suivante } from '../lib/diaporama'

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
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*\{[^]*?\.duo-points li \{ opacity: 1/)

    // ⚠️ CETTE GARDE INTERDISAIT `IntersectionObserver` TOUT COURT, et ce
    // raccourci a tenu tant qu'aucun autre usage n'existait. Depuis le
    // 12 septembre 2026 le diaporama avance seul et s'en sert pour savoir s'il
    // est regardé. Ce qu'il faut défendre n'a pas changé : la RÉVÉLATION des
    // points ne dépend pas du défilement. On le vérifie donc directement.
    // ⚠️ On DÉCOUPE sur les effets au lieu de borner une expression : le
    // rappel de l'observateur délègue à une fonction voisine, et un motif qui
    // s'arrête à la première virgule ne voit que sa moitié.
    const effets = diapo.split('useEffect(')
    const observateur = effets.find((e) => e.includes('IntersectionObserver')) ?? ''
    expect(observateur.length).toBeGreaterThan(0)
    expect(observateur).toContain('setActif')
    expect(observateur, 'l’observateur ne décide pas de ce qui s’affiche').not.toContain('setVus')

    // Et l'effet qui révèle les points ne dépend pas de cet état : un lecteur
    // qui ne fait pas défiler la section doit quand même voir sa liste.
    const revelation = effets.find((e) => e.includes('setVus(')) ?? ''
    expect(revelation.length).toBeGreaterThan(0)
    const deps = /\}, \[([^\]]*)\]\)/.exec(revelation)?.[1] ?? ''
    expect(deps.length).toBeGreaterThan(0)
    expect(deps, 'la révélation ne dépend pas du défilement').not.toContain('actif')
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

  it('⚠️ le héros est aligné à gauche, en bas, et ses boutons à droite', () => {
    // Julien, 11 septembre 2026, capture annotée : « le texte doit être aligné
    // à gauche ». Le bloc de texte en bas à gauche, les deux boutons en bas à
    // droite — et rien de centré, ce qui est aussi l'un des tics qu'il a nommés
    // le même jour.
    const bloc = /\.hero-accueil\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc).toMatch(/text-align:\s*left/)
    expect(bloc).toMatch(/grid-template-columns:[^;]*auto/)
    expect(bloc).toMatch(/align-items:\s*end/)
    // ⚠️ Et il annule le `margin: 0 auto` de `.container` : sans ça, la marge
    // automatique l'emporte sur `align-items: stretch` et le bloc se recentre
    // à la largeur de son contenu — le texte n'est plus au bord.
    expect(bloc).toMatch(/margin:\s*0[;\s]/)
    // Le héros plein écran cale son contenu en BAS, plus au milieu.
    const plein = /\.hero-plein\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(plein).toMatch(/justify-content:\s*flex-end/)

    // ⚠️ `.hero p.lead` pose un `margin: … auto …` qui RECENTRERAIT le
    // paragraphe. La règle qui l'annule doit donc exister, ne pas réintroduire
    // le `auto`, et surtout venir APRÈS dans la feuille — à spécificité égale,
    // c'est l'ordre qui tranche (leçon de `.zone-form-unique`, 7 septembre).
    const lead = /\.hero-accueil p\.lead\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(lead.length).toBeGreaterThan(0)
    expect(lead).not.toContain('auto')
    expect(css.indexOf('.hero-accueil p.lead')).toBeGreaterThan(css.indexOf('.hero p.lead'))
  })

  it('⚠️ les deux échelles sont ÉCHANGÉES', () => {
    // Julien, 11 septembre 2026 : « fais l'inverse ». Ce que le titre portait,
    // les trois prestations le portent — et réciproquement.
    //
    // ⚠️ La garde compare les DEUX RÈGLES entre elles, jamais une valeur figée :
    // changer l'échelle du héros doit rester possible sans faire tomber le test,
    // c'est l'échange qui est défendu.
    const taille = (sel: string) => {
      const bloc = new RegExp(sel.replace(/[.\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(css)?.[1] ?? ''
      return /font-size:\s*([^;]+)/.exec(bloc)?.[1].trim() ?? ''
    }
    const titreDeBase = taille('.hero h1')
    const annonceDeBase = taille('.hero p.lead-trois')
    expect(titreDeBase).not.toBe('')
    expect(annonceDeBase).not.toBe('')
    expect(titreDeBase).not.toBe(annonceDeBase)
    expect(taille('.hero-accueil p.lead-trois')).toBe(titreDeBase)
    expect(taille('.hero-accueil h1')).toBe(annonceDeBase)
    // Même piège que le `margin auto` : à spécificité égale, c'est l'ordre qui
    // renverse — ces deux règles viennent APRÈS celles qu'elles annulent.
    expect(css.indexOf('.hero-accueil p.lead-trois')).toBeGreaterThan(css.indexOf('.hero p.lead-trois'))
    expect(css.indexOf('.hero-accueil h1')).toBeGreaterThan(css.indexOf('.hero h1'))

    // ⚠️ Et les deux blocs alignent leurs TRACÉS, pas leurs boîtes : une lettre
    // garde un blanc à gauche proportionnel au corps, donc 5,4 px sous les
    // prestations contre 1,6 sous la signature — 3,8 px d'écart à l'œil pour
    // deux boîtes au même pixel (constat de Julien, 11 septembre 2026).
    // La compensation est en EM, jamais en pixels : la taille est fluide.
    for (const sel of ['.hero-accueil p.lead-trois', '.hero-accueil h1']) {
      const b = new RegExp(sel.replace(/[.\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(css)?.[1] ?? ''
      expect(b).toMatch(/margin-left:\s*-0?\.\d+em/)
    }
  })

  it('⚠️ les trois prestations passent AVANT le titre', () => {
    // L'ordre vient de l'annotation : « Inventaires / Comptage en équipe /
    // Écarts en direct / La simplicité en main ». Elles annoncent ce qu'on
    // fait, le titre conclut.
    const code = sansCommentaires(accueil)
    const lead = code.indexOf('lead-trois')
    const titre = code.indexOf('<h1')
    expect(lead).toBeGreaterThan(-1)
    expect(titre).toBeGreaterThan(-1)
    expect(lead).toBeLessThan(titre)
    // ⚠️ Une ligne chacune, et la garde DÉDUIT les trois : citer les libellés
    // la ferait tomber au prochain mot changé — ils l'ont été deux fois en une
    // journée. Ce qu'elle défend, c'est qu'il y ait bien trois lignes posées à
    // la main, pas une phrase laissée au hasard de la largeur.
    const trois = /className="lead lead-trois"[^>]*>([\s\S]*?)<\/p>/.exec(code)?.[1] ?? ''
    expect(trois.match(/\{t\('[^']+'\)\}/g) ?? []).toHaveLength(3)
    expect(trois.match(/<br \/>/g) ?? []).toHaveLength(2)
  })

  it('⚠️ la barre ne répète pas le titre de la diapositive', () => {
    // Constat de Julien, 11 septembre 2026 : « retire le texte "Du scan dans
    // le rayon" répétitif ». Il s'écrivait DEUX fois sur le même écran — en
    // titre du bloc de texte, et en légende sous les pastilles. Une légende
    // qui recopie le titre juste au-dessus n'apprend rien.
    //
    // Ce qui reste : chaque pastille porte le titre de sa diapositive en
    // `aria-label`, donc un lecteur d'écran sait toujours où il va.
    const diapo = sansCommentaires(lire('../components/DiaporamaProduit.tsx'))
    expect(diapo).not.toMatch(/diaporama-legende/)
    expect(diapo).toMatch(/aria-label=\{d\.titre\}/)
    expect(css).not.toContain('.diaporama-legende')
  })

  it('⚠️ les deux boutons du diaporama ont la même taille', () => {
    // « Précédent » est plus long que « Suivant » : à largeur libre la rangée
    // penche, et les pastilles ne tombent plus au centre. La garde porte sur
    // le mécanisme — une largeur PLANCHER commune aux deux — pas sur sa
    // valeur, qui bougera avec la police ou les libellés.
    const bloc = /\.diaporama-nav\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(bloc).toMatch(/min-width:\s*\d+px/)
    // Et elle ne doit pas être annulée par un étirement : un bouton qui grandit
    // pour remplir la rangée reprendrait deux largeurs différentes.
    expect(bloc).toMatch(/flex:\s*0\s+0\s+auto/)
    // ⚠️ Et sur un petit écran c'est `flex: 1` qui prend le relais : la largeur
    // plancher ferait déborder la rangée, les deux boutons se partagent alors
    // la place — toujours à parts égales.
    // ⚠️ On prend le DERNIER `.diaporama-nav` qui suit une requête « petit
    // écran », pas le premier venu : la règle de BASE est déclarée entre deux
    // requêtes 520 px, si bien qu'une regex non gourmande — puis un filtre sur
    // le mot « flex » — tombaient l'une comme l'autre sur elle.
    const petit = css.split('@media (max-width: 520px)').slice(1)
      .map((m) => /\.diaporama-nav\s*\{([^}]*)\}/.exec(m)?.[1] ?? '')
      .filter((m) => m !== '').at(-1) ?? ''
    expect(petit).toMatch(/flex:\s*1\s+1\s+0/)
    expect(petit).toMatch(/min-width:\s*0/)
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

  it('⚠️ la capture du tableau de bord garde sa taille et DÉBORDE À GAUCHE', () => {
    // Demande de Julien, 12 septembre 2026 : « Dashboard text à droite de la
    // capture pas en dessous […] ne rétrécis pas le dashboard, bouge-le un peu
    // à gauche ». La capture fait 1 472 px à 1568 px d'écran et le texte en
    // réclame 420 de plus : la ranger entière à côté de son texte reviendrait à
    // la réduire de moitié, ce qui avait fait dire « ça fait trop bizarre
    // d'avoir deux tailles ». Elle sort donc du cadre par la gauche.
    const bloc = sansCommentaires(/\.duo--paysage\s*\{([^}]*)\}/.exec(css)?.[1] ?? '')
    expect(bloc.length).toBeGreaterThan(0)

    // Le texte est une COLONNE à droite, pas une rangée dessous.
    expect(bloc).toContain('grid-template-columns')
    expect(bloc).not.toContain('display: block')

    // ⚠️ LA LARGEUR DE LA CAPTURE NE DÉPEND PAS DE SA COLONNE. C'est elle qui
    // accorde les deux diapositives — 1 472 px de large font 705 px de haut,
    // soit deux pixels du téléphone d'en face. Un `width: 100%` la ferait
    // suivre sa colonne, donc grandir avec la scène, et les hauteurs se
    // désaccorderaient de 200 px.
    const img = sansCommentaires(
      /\.duo--paysage \.duo-ecran img\s*\{([^}]*)\}/.exec(css)?.[1] ?? '',
    )
    expect(img.length).toBeGreaterThan(0)
    expect(img).toMatch(/width: min\(/)
    expect(img).not.toMatch(/width: 100%/)

    // ⚠️ SON BORD DROIT SE CALE SUR SA COLONNE, et c'est ce qui rend le débord
    // AUTOMATIQUE : il vaut exactement ce qui manque, et tombe à zéro dès que
    // l'écran est assez large — mesuré 396 px de capture hors cadre à 1568 px,
    // et plus rien à 1990. Aucun seuil n'est écrit pour ça.
    const fig = sansCommentaires(
      /\.duo--paysage \.duo-ecran\s*\{([^}]*)\}/.exec(css)?.[1] ?? '',
    )
    expect(fig).toMatch(/justify-content: flex-end/)

    // ⚠️ LE DÉBORD PART DONC À GAUCHE, JAMAIS À DROITE. Une abscisse négative
    // n'est pas atteignable au défilement ; un dépassement par la droite, lui,
    // ajouterait une barre horizontale à toute la page.
    expect(img).not.toContain('margin-right')

    // ⚠️ LA SCÈNE VA JUSQU'AU BORD DE L'ÉCRAN, elle ne s'arrête pas au gabarit
    // de la section. Sans ça, sur un écran large le texte s'arrêtait à 259 px
    // du bord droit pendant qu'on coupait la capture de 209 à gauche — faute
    // de place dans un gabarit, pas faute de place à l'écran.
    expect(bloc).toMatch(/--scene: min\(calc\(100vw/)
    expect(bloc).toMatch(/width: var\(--scene\)/)

    // ⚠️ Et la colonne de la scène est bornée : dimensionnée par son contenu,
    // elle grandirait avec une diapositive plus large que la section, et la
    // page entière déborderait par la droite.
    expect(css).toMatch(/\.diaporama \{[^}]*grid-template-columns: minmax\(0, 1fr\)/)

    // ⚠️ La colonne de texte suit l'écran. À valeur fixe, la part de capture
    // hors cadre reste constante pendant que la capture rétrécit : mesuré 29 %
    // à 1568 px mais 36 % à 1280.
    expect(bloc).toMatch(/--paysage-texte: clamp\([^)]*vw[^)]*\)/)

    // Sous 1180 px le débord mangerait plus du tiers : la capture reprend toute
    // la largeur et son texte repasse dessous, en une rangée de points.
    const petit = css.slice(css.indexOf('@media (max-width: 1180px)'))
    expect(petit).toMatch(/\.duo--paysage \{[^}]*display: block/)
    expect(petit).toMatch(/\.duo--paysage \.duo-points \{[^}]*flex-direction: row/)
  })

  it('⚠️ le diaporama avance seul, et QUATRE choses l’en empêchent', () => {
    // Demande de Julien, 12 septembre 2026. Le risque d'une section qui tourne,
    // c'est qu'elle se referme avant qu'on ait fini de lire : chacun de ces
    // quatre garde-fous répond à un défaut précis, et chacun doit suffire à
    // lui seul à bloquer l'avance.
    const nominal = {
      arrete: false, actif: true, enPause: false, mouvementReduit: false,
    }
    expect(avanceAutorisee(nominal)).toBe(true)
    for (const [quoi, etat] of [
      ['le lecteur a choisi une diapositive', { ...nominal, arrete: true }],
      ['la section n’est pas à l’écran', { ...nominal, actif: false }],
      ['on la survole ou on la parcourt au clavier', { ...nominal, enPause: true }],
      ['« moins d’animation » est demandé au système', { ...nominal, mouvementReduit: true }],
    ] as const) {
      expect(avanceAutorisee(etat), `doit s’arrêter quand ${quoi}`).toBe(false)
    }

    // ⚠️ ELLE LAISSE LES POINTS ARRIVER. Sur une diapositive à quatre points,
    // le dernier apparaît à 3,2 s : changer avant reviendrait à ne jamais le
    // montrer. La garde compare les deux constantes L'UNE À L'AUTRE — une
    // valeur recopiée ici se périmerait au premier ajustement du rythme.
    expect(AUTO_MS).toBeGreaterThan(apparitionFinie(4))
    // Et il reste de quoi lire une fois le dernier point posé.
    expect(AUTO_MS - apparitionFinie(4)).toBeGreaterThanOrEqual(3000)

    // Elle boucle, et un diaporama vide ne bouge pas.
    expect(suivante(0, 2)).toBe(1)
    expect(suivante(1, 2)).toBe(0)
    expect(suivante(0, 0)).toBe(0)
  })

  it('⚠️ et le composant BRANCHE réellement ces quatre garde-fous', () => {
    // La règle vit dans un module pur parce qu'un `IntersectionObserver` est
    // suspendu dans un onglet masqué — donc invérifiable au volet. Ce qui reste
    // à garder, c'est le branchement.
    const diapo = sansCommentaires(lire('../components/DiaporamaProduit.tsx'))
    expect(diapo).toMatch(/avanceAutorisee\(\{ arrete, actif, enPause, mouvementReduit \}\)/)

    // ⚠️ L'arrêt est posé DANS `aller`, pas dans les gestionnaires de clic :
    // toute navigation volontaire passe par là, donc une commande ajoutée plus
    // tard ne pourra pas oublier de le faire.
    expect(diapo).toMatch(/const aller = useCallback\([^}]*setArrete\(true\)/)

    // Ne tourner que quand on est regardé : à l'écran ET dans un onglet au
    // premier plan.
    expect(diapo).toContain('new IntersectionObserver')
    expect(diapo).toMatch(/document\.hidden/)
    expect(diapo).toMatch(/addEventListener\('visibilitychange'/)
    expect(diapo).toMatch(/removeEventListener\('visibilitychange'/)

    // ⚠️ Le clavier compte autant que la souris : sans `onFocusCapture`, la
    // section défile sous les doigts de qui la parcourt à la tabulation.
    for (const attr of ['onMouseEnter', 'onMouseLeave', 'onFocusCapture', 'onBlurCapture']) {
      expect(diapo, `le conteneur doit porter ${attr}`).toContain(attr)
    }

    // La préférence système est lue au moment de décider.
    expect(diapo).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/)
  })

  it('⚠️ les deux diapositives GLISSENT, et celle qu’on ne voit pas est inerte', () => {
    // Demande de Julien, 12 septembre 2026 : « add slide effect btw phone and
    // dashboard ». Elles sont donc empilées dans la même cellule : une
    // diapositive masquée par `hidden` prend `display: none`, et on n'anime
    // pas ce qui n'occupe plus de place.
    const diapo = sansCommentaires(lire('../components/DiaporamaProduit.tsx'))
    // ⚠️ `\s` avant le mot : sans lui, le motif attrape `aria-hidden={…}`,
    // qui est justement ce qu'on EXIGE deux lignes plus bas.
    expect(diapo).not.toMatch(/\shidden=\{/)
    expect(diapo).toMatch(/diapo-active/)
    expect(diapo).toMatch(/diapo-avant/)
    expect(diapo).toMatch(/diapo-apres/)

    // ⚠️ Ce que `hidden` faisait gratuitement et qu'il faut désormais écrire :
    // sans ça, la tabulation traverse des liens invisibles et un lecteur
    // d'écran annonce les deux diapositives à la suite.
    expect(diapo).toMatch(/inert=\{n !== courante\}/)
    expect(diapo).toMatch(/aria-hidden=\{n !== courante\}/)

    // La scène empile les diapositives et laisse la barre en dessous.
    expect(css).toMatch(/\.diaporama > \.diapo \{[^}]*grid-row: 1;[^}]*grid-column: 1/)

    // ⚠️ `visibility` est dans la transition : sans elle, la diapositive
    // sortante reste cliquable pendant toute l'animation.
    // ⚠️ Ancré en début de ligne : sinon le motif attrape `.diaporama > .diapo`.
    const bloc = sansCommentaires(/^\.diapo \{([^}]*)\}/m.exec(css)?.[1] ?? '')
    expect(bloc).toContain('visibility')
    for (const etat of ['avant', 'apres']) {
      expect(css).toMatch(new RegExp(`\\.diapo-${etat} \\{[^}]*visibility: hidden`))
    }

    // ⚠️ LE DÉCALAGE NE DÉPASSE PAS LA MARGE DE LA SCÈNE. `visibility: hidden`
    // ne retire pas la diapositive du calcul du débordement : à 56 px, celle
    // qu'on ne voit pas poussait la page de 32 px vers la droite — en
    // permanence, pas seulement pendant l'animation — et `overflow-x: clip` sur
    // la racine ne l'arrêtait pas. La scène s'arrête à 24 px du bord dans tous
    // les cas de figure : c'est l'amplitude maximale qui ne peut rien pousser.
    for (const etat of ['avant', 'apres']) {
      const px = /translateX\((-?\d+)px\)/.exec(
        new RegExp(`\\.diapo-${etat} \\{([^}]*)\\}`).exec(css)?.[1] ?? '',
      )?.[1]
      expect(px, `.diapo-${etat} doit porter un décalage en pixels`).toBeDefined()
      expect(Math.abs(Number(px)), `.diapo-${etat} pousserait la page`).toBeLessThanOrEqual(24)
    }

    // Et le mouvement se coupe quand la personne l'a demandé au système.
    const doux = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('.duo figcaption')))
    expect(doux).toMatch(/\.diapo \{ transition: none/)
    expect(doux).toMatch(/\.diapo-avant, \.diapo-apres \{ transform: none/)
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

  it('⚠️ « moins d’animation » l’empêche de partir, et la largeur choisit le fichier', () => {
    // Deux règles distinctes, et il ne faut pas les confondre :
    //   · « moins d'animation » est une préférence d'ACCESSIBILITÉ — une vidéo
    //     qui tourne est exactement ce qu'elle vise. Rien ne se télécharge, il
    //     reste l'image d'attente ;
    //   · la largeur, elle, ne bloque plus rien depuis le 11 septembre 2026
    //     (demande de Julien : la vidéo joue aussi sur mobile). Elle CHOISIT
    //     entre deux fichiers — un téléphone de 390 px n'a rien à faire d'une
    //     source en 1920.
    expect(video).toContain('preload="none"')
    expect(video).toMatch(/prefers-reduced-motion[^\n]*\)\.matches\) return/)
    expect(video).toMatch(/innerWidth < 900 \? srcMobile : src/)
    const garde = video.indexOf('prefers-reduced-motion')
    const pose = video.indexOf('setSource(')
    expect(garde).toBeGreaterThan(0)
    expect(pose, 'la source doit être posée APRÈS la garde').toBeGreaterThan(garde)
  })

  it('⚠️ et le fichier mobile est RÉELLEMENT plus léger', () => {
    // Une garde sur le nom du fichier ne dirait rien : ce qui compte est qu'il
    // pèse moins. Sans cela, pointer les deux sources vers le même fichier
    // passerait sans bruit.
    const grand = statSync(path.resolve(__dirname, '../public/vitrine/hero.mp4')).size
    const petit = statSync(path.resolve(__dirname, '../public/vitrine/hero-mobile.mp4')).size
    expect(petit).toBeLessThan(grand / 1.8)
    expect(grand).toBeLessThan(2.6 * 1024 * 1024)
  })

  it('⚠️ le voile est PLUS DENSE sur mobile', () => {
    // Le héros y est portrait et la vidéo paysage : le recadrage zoome fort et
    // remonte sous le texte des zones bien plus claires. Mesuré à 390 px, le
    // contraste du titre tombait à 4,21 — sous le seuil AA — avec le voile du
    // bureau ; il remonte à 6,27 avec celui-ci.
    expect(css).toMatch(/@media \(max-width: 900px\) \{\s*\.hero-film-fond::after \{[^}]*background:/)
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

describe('⚠️ la vitrine n’a plus de surtitres', () => {
  // Demande de Julien, 11 septembre 2026, et c'est une RÈGLE, pas une
  // correction ponctuelle : « tu n'utiliseras plus ce genre de design qui fait
  // trop IA ». La pastille de surtitre au-dessus de chaque titre — « En
  // pratique », « Ce qui nous distingue », « Ce que ça fait » — est l'un des
  // signes les plus reconnaissables d'une page générée : elle annonce ce que
  // le titre juste dessous dit déjà, et elle le dit dans une capsule colorée.
  //
  // ⚠️ LA GARDE BALAIE, ELLE NE CITE PAS. Huit surtitres ont été retirés sur
  // quatre fichiers ; celui qu'on écrira demain sur une page neuve doit se
  // signaler tout seul.
  const dossier = path.resolve(__dirname, '../components/vitrine')
  const pages = readdirSync(dossier).filter((f) => f.endsWith('.tsx'))

  it('aucune page de la vitrine ne porte de pastille de surtitre', () => {
    expect(pages.length).toBeGreaterThan(4)
    for (const f of pages) {
      const src = readFileSync(path.join(dossier, f), 'utf8')
      expect(sansCommentaires(src), `${f} porte un surtitre`).not.toContain('eyebrow')
    }
  })

  it('et son style a disparu avec lui', () => {
    // Un style laissé derrière est une invitation à s'en resservir.
    expect(css).not.toContain('.eyebrow')
  })

  it('⚠️ ni sur les deux pages d’achat, où l’idiome portait d’autres noms', () => {
    // Le 11 septembre 2026, Julien : « même chose sur les pages inscription et
    // souscrire ». La pastille n'y portait pas la classe `eyebrow`, mais la
    // même forme — une petite capitale espacée au-dessus d'un groupe :
    //   · `/souscrire` disait « VOTRE OFFRE » juste au-dessus des offres. Un
    //     surtitre pur : il annonçait ce que les cartes montrent. Retiré.
    //   · `/inscription` dit « ÉTAPE 3 SUR 8 ». Celui-là porte une information
    //     que la jauge au-dessus ne donne pas — combien d'étapes restent. On a
    //     retiré la FORME, gardé le fait : il est en phrase, plus en capitales.
    expect(css).not.toContain('.souscrire-label')
    expect(lire('../components/vitrine/PageSouscrire.tsx')).not.toContain('souscrire-label')
    const pas = /\.ins-pas \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(pas.length).toBeGreaterThan(0)
    expect(pas).not.toContain('uppercase')
    expect(pas).not.toContain('letter-spacing')
    // Et l'information, elle, ne se perd pas.
    expect(lire('../components/vitrine/PageInscription.tsx')).toContain('Étape %{n} sur %{total}')
  })
})
