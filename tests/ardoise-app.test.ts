// Ardoise et Registre, côté application (6 septembre 2026).
//
// Le site est passé à Ardoise le matin, l'application l'après-midi. C'est le
// même abonnement : un superviseur ouvre le site puis le téléphone, il ne doit
// pas avoir l'impression de changer de produit.
//
// Ces gardes ne figent pas un dessin — elles figent ce qui a été DÉCIDÉ, et la
// frontière entre les deux pistes. Un dessin se retouche ; une frontière
// effacée ne se remarque pas.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const racine = path.join(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const ink = lire('src/constants/ink.ts')
const layout = lire('src/app/_layout.tsx')
const logo = lire('src/components/AppLogo.tsx')
const splash = lire('src/components/SplashAnimation.tsx')
const overlay = lire('src/components/GeneratingOverlay.tsx')
const icones = lire('scripts/generate-icons.mjs')

/** Le code sans ses commentaires — une garde d'absence se lirait elle-même. */
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

/** Tous les fichiers source de l'application. */
function sources(): string[] {
  const out: string[] = []
  const balayer = (dossier: string) => {
    for (const e of readdirSync(dossier)) {
      const f = path.join(dossier, e)
      if (statSync(f).isDirectory()) balayer(f)
      else if (f.endsWith('.ts') || f.endsWith('.tsx')) out.push(f)
    }
  }
  balayer(path.join(racine, 'src'))
  return out
}

describe('Ardoise a remplacé Ink dans l’application', () => {
  it('⚠️ l’indigo a quitté TOUT le code de l’application', () => {
    // ⚠️ LA GARDE DÉDUIT SA LISTE : elle balaie `src/` en entier, donc l'écran
    // qu'on écrira demain est couvert sans qu'on y pense. Une garde qui
    // nommerait les fichiers d'aujourd'hui ne protégerait qu'eux.
    // ⚠️ `#8A82B8` s'est ajouté le 7 septembre 2026 : c'était le mauve du
    // mot-symbole de l'écran d'ouverture, le dernier indigo de l'application.
    // Il avait survécu à la passe du 6 parce que la liste ne le nommait pas —
    // une garde qui déduit son PÉRIMÈTRE (tout `src/`) doit aussi tenir sa
    // liste à jour, sans quoi elle balaie large et ne voit rien.
    const morts = ['#4F46E5', '#6366F1', '#4338CA', '#4636B0', '#6C5CE7', '#38C9FF', '#0B0F19', '#8A82B8']
    for (const f of sources()) {
      const src = code(readFileSync(f, 'utf8')).toUpperCase()
      for (const mort of morts) {
        expect(src, `${path.relative(racine, f)} : ${mort} est un reste de l’identité d’avant`)
          .not.toContain(mort)
      }
    }
  })

  it('⚠️ l’accent est le vert forêt du site, à la valeur près', () => {
    // Les deux produits partagent ces valeurs : `src/constants/ink.ts` est la
    // copie du bloc `:root` de `web/app/globals.css`. Ils bougent ensemble.
    const web = readFileSync(path.join(racine, 'web/app/globals.css'), 'utf8')
    const jeton = (bloc: string, nom: string) =>
      new RegExp(`--${nom}: (#[0-9a-f]{6});`, 'i').exec(bloc)?.[1]?.toUpperCase()
    const sombre = web.slice(web.indexOf(':root {'), web.indexOf(':root[data-theme="light"]'))
    const clair = web.slice(web.indexOf(':root[data-theme="light"]'))

    const app = (theme: 'lightTheme' | 'darkTheme', cle: string) => {
      const i = ink.indexOf(`export const ${theme}`)
      return new RegExp(`${cle}: '(#[0-9A-Fa-f]{6})'`).exec(ink.slice(i))?.[1]?.toUpperCase()
    }
    for (const [bloc, theme] of [[clair, 'lightTheme'], [sombre, 'darkTheme']] as const) {
      for (const [jetonWeb, cleApp] of [['accent', 'accent'], ['bg', 'background'], ['surface', 'surface'], ['text', 'textPrimary']] as const) {
        expect(app(theme, cleApp), `${theme}.${cleApp} a divergé du site`)
          .toBe(jeton(bloc, jetonWeb))
      }
    }
  })

  it('⚠️ une carte n’a plus d’ombre — mais ce qui flotte en garde une', () => {
    // Une carte se détache parce que son fond diffère de celui de la page.
    // Une feuille modale, elle, est AU-DESSUS : là, la profondeur dit vrai.
    // ⚠️ LA GARDE COMPTE, ELLE NE CHERCHE PAS UNE OCCURRENCE. Premier jet :
    // elle vérifiait qu'un `shadowCard: aucuneOmbre` existait. Remettre une
    // ombre sur le SEUL thème clair la laissait passer, parce que le thème
    // sombre gardait le sien — et le défaut ne se serait vu que sur la moitié
    // des téléphones. Une garde qui cherche UNE occurrence ne garde que la
    // première. (Même correction que le filtre des exports, le matin même.)
    const themes = (code(ink).match(/shadowElevated: (light|dark)ShadowElevated/g) ?? []).length
    expect(themes, 'plus aucune palette : la garde ne garde rien').toBeGreaterThan(1)
    for (const cle of ['shadowCard', 'shadowButton'] as const) {
      expect((code(ink).match(new RegExp(`${cle}: aucuneOmbre`, 'g')) ?? []).length,
        `${themes} palettes, mais ${cle} n'est pas neutralisé partout`)
        .toBe(themes)
    }
    // Et `aucuneOmbre` est bien vide : un objet qui porterait une élévation
    // ferait remonter les cartes sur Android seulement.
    expect(code(ink)).toContain('const aucuneOmbre = {} as const')
  })

  it('⚠️ deux rayons de bloc, un de bouton, et rien d’autre', () => {
    // ⚠️ AMENDÉE LE 7 SEPTEMBRE 2026, PAS AFFAIBLIE. Elle exigeait deux
    // rayons au plus, tous ≤ 4 — et elle a mordu quand `bouton: 12` est
    // arrivé. La décision de Julien, l'application en main : un bouton de
    // téléphone se TOUCHE, et ce qui dit « ceci se presse » sur une surface
    // tactile, c'est sa forme. La règle est donc plus fine, pas plus lâche :
    // les BLOCS restent à 3-4 px, le BOUTON a sa valeur, et il n'y en a
    // qu'une. C'est ce qui empêche de revenir aux dix-sept d'avant.
    const m = /export const Radius = \{([\s\S]*?)\n\} as const/.exec(ink)
    expect(m, 'l’échelle de rayons a disparu').toBeTruthy()
    const jetons = Object.fromEntries(
      [...m![1].matchAll(/^\s*(\w+): (\d+),/gm)].map((x) => [x[1], Number(x[2])]),
    )
    const blocs = new Set(
      Object.entries(jetons).filter(([k]) => !['bouton', 'pill'].includes(k)).map(([, v]) => v),
    )
    expect(blocs.size, `${blocs.size} rayons de bloc distincts : Ardoise en veut deux`)
      .toBeLessThanOrEqual(2)
    for (const r of blocs) expect(r, 'un bloc au-delà de 4 px').toBeLessThanOrEqual(4)
    // Un seul rayon de bouton, et il est rond pour de bon.
    expect(jetons.bouton, 'le rayon de bouton a disparu').toBeGreaterThanOrEqual(8)
    // La capsule est une FORME, pas un rayon.
    expect(jetons.pill).toBe(999)
  })

  it('⚠️ ce qui se touche est rond, et ça se déduit du NOM du style', () => {
    // Décision de Julien, 7 septembre 2026 : « use rounded corners buttons for
    // the app, as it was previously ». À 4 px, les boutons se lisaient comme
    // des bandeaux d'information.
    //
    // ⚠️ LA GARDE DÉDUIT SA LISTE — et c'est ce qui compte : j'avais converti
    // 54 styles à la main et j'en avais oublié six (le bouton flottant, les
    // deux boutons de la carte des notifications, les deux bascules de mode,
    // le pas-à-pas). Un balayage les aurait nommés tout de suite.
    const NOM = /btn|bouton|button|action|choix|cta|onglet|toggle|\bfab\b/i
    const fautifs: string[] = []
    for (const f of sources()) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/(\w+):\s*\{[^{}]*?borderRadius: Radius\.(\w+)/g)) {
        if (NOM.test(m[1]) && !['bouton', 'pill'].includes(m[2])) {
          fautifs.push(`${path.relative(racine, f)} · ${m[1]} → Radius.${m[2]}`)
        }
      }
    }
    expect(fautifs, 'ces contrôles se touchent : ils prennent Radius.bouton').toEqual([])
  })
})

describe('les polices', () => {
  it('⚠️ Inter est partie, et de partout', () => {
    // C'est l'une des deux valeurs par défaut de l'époque, et l'un des trois
    // signes mesurés de l'air « fait par une IA ».
    const paquets = JSON.parse(lire('package.json'))
    expect(Object.keys(paquets.dependencies)).not.toContain('@expo-google-fonts/inter')
    for (const f of sources()) {
      expect(code(readFileSync(f, 'utf8')), `${path.relative(racine, f)} cite encore Inter`)
        .not.toMatch(/Inter_\d/)
    }
  })

  it('⚠️ chaque graisse s’importe par son chemin, jamais par la racine du paquet', () => {
    // MESURÉ le 6 septembre 2026, en exportant le paquet deux fois :
    //   · depuis la racine  → 64 fichiers de police, 6,74 Mo
    //   · par graisse       →  8 fichiers,           0,77 Mo
    // L'index de `@expo-google-fonts/<famille>` fait un `require()` de TOUTES
    // ses graisses et de toutes leurs italiques ; Metro les embarque toutes.
    //
    // ⚠️ ET LE DÉFAUT PRÉEXISTAIT : Inter était importée depuis sa racine
    // depuis le premier jour — 18 fichiers, **5,93 Mo** embarqués pour 1,68 Mo
    // réellement employés. Le changement de polices ne l'a pas créé, il l'a
    // rendu visible.
    for (const f of sources()) {
      const src = code(readFileSync(f, 'utf8'))
      const racines = [...src.matchAll(/from '@expo-google-fonts\/([^'/]+)'/g)]
      expect(racines.map((m) => m[1]),
        `${path.relative(racine, f)} importe une police par la racine du paquet : ` +
        'Metro embarquerait toutes ses graisses et toutes leurs italiques')
        .toEqual([])
    }
  })

  it('les huit fichiers déclarés sont ceux que le thème emploie', () => {
    // Une police chargée qu'aucun style ne nomme est du poids pour rien ; une
    // police nommée qu'on n'a pas chargée s'affiche dans celle du système.
    const charges = new Set(
      [...layout.matchAll(/^\s{4}([A-Za-z]+_\d{3}[A-Za-z]+),$/gm)].map((m) => m[1]),
    )
    const importees = new Set(
      [...layout.matchAll(/import \{ ([A-Za-z]+_\d{3}[A-Za-z]+) \} from '@expo-google-fonts/g)]
        .map((m) => m[1]),
    )
    expect([...charges].sort(), 'une police chargée qu’aucun import n’amène')
      .toEqual([...importees].sort())
    const employes = new Set(
      [...ink.matchAll(/'([A-Za-z]+_\d{3}[A-Za-z]+)'/g)].map((m) => m[1]),
    )
    expect(charges.size, 'plus aucune police chargée : la garde ne garde rien').toBeGreaterThan(0)
    expect([...employes].sort()).toEqual([...charges].sort())
  })

  it('⚠️ la serif et la chasse fixe ne servent QUE sur ce qui fait foi', () => {
    // C'est la frontière de « Registre » : il habille ce qu'on lit, et il
    // s'arrête là où l'on cesse de lire pour faire. Deux écrans, pas trois.
    const porteurs = sources()
      .filter((f) => /Font\.(serif|mono|monoMedium)/.test(code(readFileSync(f, 'utf8'))))
      .map((f) => path.relative(racine, f))
    expect(porteurs.sort()).toEqual([
      'src/app/(supervisor)/[sessionId]/audits.tsx',
      'src/app/(supervisor)/[sessionId]/results.tsx',
    ])
  })
})

describe('la marque', () => {
  it('⚠️ le cube isométrique a disparu, ici comme sur le site', () => {
    for (const [nom, src] of [['AppLogo', logo], ['les icônes', icones]] as const) {
      // Le cube était trois polygones et un faisceau ; le plan est quatre
      // rectangles. Aucun `polygon` ne doit subsister.
      expect(code(src).toLowerCase(), `${nom} porte encore un tracé du cube`)
        .not.toMatch(/polygon|faceTop|faceLeft|bgGrad/i)
    }
  })

  it('⚠️ la géométrie est la MÊME que celle du site, au dixième près', () => {
    // Trois fichiers la portent — le composant du site, celui de
    // l'application, et le script des icônes. Si l'un bouge, les trois bougent.
    const web = readFileSync(path.join(racine, 'web/components/Logo.tsx'), 'utf8')
    // ⚠️ On ne retient que les rectangles DE LA MARQUE. Le script des icônes
    // en dessine d'autres — le fond plein cadre, la tuile arrondie — et les
    // compter ferait échouer la garde sur du code juste.
    const MARQUE = new Set(['1.5,1.5,33,33', '11,3,3,30', '22,3,3,30', '3,3,8,30'])
    const rects = (src: string) =>
      [...src.matchAll(/x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
        .map((m) => m.slice(1, 5).join(','))
        .filter((r) => MARQUE.has(r))
        .sort()
    const attendu = rects(web)
    expect(attendu.length, 'la marque du site n’a plus de rectangles').toBe(4)
    expect(rects(logo), 'la marque de l’application a divergé du site').toEqual(attendu)
    expect(rects(icones), 'les icônes ont divergé du site').toEqual(attendu)
  })

  it('⚠️ l’icône du projet iOS suit la source, à l’octet près', () => {
    // ⚠️ `assets/images/` N'EST QUE LA SOURCE. Constat de Julien au premier
    // build du 6 septembre 2026 : « l'icône de l'app n'a pas changé ». Elle
    // avait bien changé — dans `assets/images/`, et nulle part ailleurs.
    // `ios/` est VERSIONNÉ et ne se régénère jamais : son icône vivait dans
    // `Images.xcassets` et datait du 19 juin. Le script l'y recopie désormais,
    // et cette garde vérifie que la copie a bien été refaite.
    //
    // (Android n'est pas garda-ble ici : son dossier est généré et gitignoré.
    // Il faut relancer `npx expo prebuild --platform android --clean`, ce que
    // le script rappelle en clair à la fin de son exécution.)
    const source = readFileSync(path.join(racine, 'assets/images/icon.png'))
    const iosIcon = readFileSync(path.join(
      racine, 'ios/Inventaire/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'))
    expect(iosIcon.equals(source),
      'l’icône du projet iOS a divergé de la source : relancer `node scripts/generate-icons.mjs`')
      .toBe(true)
  })

  it('⚠️ elle balaie à l’ouverture et pendant la génération des balises', () => {
    // Demande de Julien, 6 septembre 2026. Ce sont les deux moments où
    // l'application fait attendre : l'ouverture, et le dessin d'une planche de
    // 900 balises. Une roue dit « ça charge » ; ceci dit « Quantinvo travaille ».
    expect(code(splash)).toMatch(/<AppLogo[^/]*animated[\s/]/)
    expect(code(overlay)).toMatch(/<AppLogo[^/]*animated[\s/]/)
  })

  it('⚠️ l’écran d’ouverture porte le mot-symbole du site, et à sa mesure', () => {
    // Deux constats de Julien au build du 7 septembre 2026, capture à l'appui :
    // « attention à Quantinvo ici, toujours sous ancien format », et « utilise
    // une taille de logo naturellement moins intrusive ».
    //
    // ⚠️ LE NOM N'A QU'UNE MISE EN FORME, ET ELLE EST CELLE DU SITE. Partout
    // où il s'écrit — barre publique, pied de page, mentions légales — c'est
    // « Quantinvo » en Archivo gras, chasse resserrée. Les capitales espacées
    // de six points étaient une seconde façon d'écrire la marque, inventée
    // pour ce seul écran ; deux mises en forme du même mot, c'est déjà deux
    // marques. (Le mauve, lui, est refusé par la garde de l'indigo.)
    const c = code(splash)
    expect(c, 'le nom s’écrit « Quantinvo », comme partout ailleurs').toContain('>Quantinvo<')
    expect(c, 'les capitales espacées sont l’ancienne mise en forme').not.toContain('QUANTINVO')
    expect(c, 'la chasse du mot-symbole est resserrée, jamais étalée')
      .not.toMatch(/letterSpacing:\s*[1-9]/)

    // ⚠️ ET LA MARQUE NE PREND PLUS LA MOITIÉ DE L'ÉCRAN. Elle est la
    // première chose que l'application montre : à 50 % de la largeur elle
    // n'accueille pas, elle barre le passage.
    const m = /Math\.min\(width \* ([\d.]+), (\d+)\)/.exec(c)
    expect(m, 'la taille de la marque doit rester bornée').not.toBeNull()
    expect(Number(m![1]), 'la marque déborde de sa part d’écran').toBeLessThanOrEqual(0.3)
    expect(Number(m![2]), 'le plafond de taille est trop haut').toBeLessThanOrEqual(140)
  })

  it('⚠️ elle SUIT la préférence système — elle ne s’y soumet pas d’office', () => {
    // ⚠️ CETTE GARDE A FIGÉ UN DÉFAUT PENDANT UNE HEURE, et c'est sa leçon.
    // Elle exigeait `ReduceMotion.Always` — or dans Reanimated `Always` veut
    // dire « toujours RÉDUIRE », donc toujours désactiver : la marque ne
    // balayait sur aucun téléphone, et le test confirmait que tout allait
    // bien. Constat de Julien au premier build.
    //
    // Une garde qui recopie une valeur sans savoir ce qu'elle fait ne garde
    // rien : elle certifie l'erreur. Elle vise maintenant la valeur qui SUIT
    // le réglage de l'appareil, et refuse nommément les deux autres.
    expect(code(logo), 'l’animation doit suivre le réglage de l’appareil')
      .toContain('ReduceMotion.System')
    for (const faux of ['ReduceMotion.Always', 'ReduceMotion.Never']) {
      expect(code(logo), `${faux} décide à la place de la personne`).not.toContain(faux)
    }
  })

  it('⚠️ le décalage du balayage est en PIXELS, pas en unités de viewBox', () => {
    // Le SVG est rendu à `size` : une unité vaut `size / 36`. Oublier la
    // conversion déplacerait l'allée de 11 px au lieu de 11 unités — le piège
    // symétrique du `transform-box: view-box` qu'il a fallu poser côté web.
    expect(code(logo)).toMatch(/const unite = size \/ 36/)
    expect(code(logo)).toMatch(/POSITIONS\[i\] \* unite/)
  })
})

describe('Registre, sur les deux écrans qui font foi', () => {
  const registre = ['src/app/(supervisor)/[sessionId]/results.tsx', 'src/app/(supervisor)/[sessionId]/audits.tsx']

  it('⚠️ le bouton d’export porte l’accent, plus le vert du succès', () => {
    // Depuis qu'Ardoise a fait de l'accent un vert forêt, deux verts voisins
    // sur le même écran ne se distinguent plus — et le succès doit rester ce
    // qui a RÉUSSI.
    const src = code(lire(registre[0]))
    expect(src).toMatch(/exportBtn: \{ backgroundColor: t\.accent/)
    expect(src).not.toMatch(/exportBtn: \{ backgroundColor: t\.success/)
  })

  it('⚠️ mais les deux boutons de passe gardent leurs couleurs', () => {
    // Registre habille ce qu'on lit, il n'éteint pas ce qui engage. Le vert du
    // comptage et l'or de l'audit sont ceux du site depuis le 29 août.
    const src = lire(registre[1])
    expect(src).toContain('AUDIT_COLOR')
  })

  it('⚠️ pas de gris sous le seuil AA dans un document', () => {
    // Mesuré sur le site : ce gris donne 3,06:1 sur le papier — et il portait
    // les en-têtes, les codes-barres et les libellés, c'est-à-dire ce qu'on LIT.
    for (const f of registre) {
      const styles = code(lire(f)).slice(code(lire(f)).indexOf('function makeStyles'))
      expect(styles, `${f} : un gris sous AA est revenu dans le document`)
        .not.toContain('t.textMuted')
    }
  })

  it('les nombres passent en chasse fixe', () => {
    for (const f of registre) {
      expect(code(lire(f)), `${f} n’aligne pas ses nombres`).toMatch(/Font\.monoMedium/)
    }
  })
})

/**
 * L'application est un outil de TÉLÉPHONE (8 septembre 2026).
 *
 * Décision de Julien, à la revue d'avant publication : `supportsTablet` était
 * vrai, donc Apple aurait exigé des captures iPad — pour une application en
 * portrait, pensée pour une main et un rayon.
 *
 * ⚠️ **LA CLÉ VIT À DEUX ENDROITS, ET LE SECOND EST VERSIONNÉ.** `app.json`
 * ne gouverne que ce qu'`expo prebuild` régénère ; `ios/` ne se régénère
 * jamais. C'est le piège exact du 6 septembre avec `UIUserInterfaceStyle` :
 * changer `app.json` ne suffisait pas, il fallait toucher le projet Xcode à la
 * main. Les deux doivent dire la même chose.
 */
describe('l’application ne se déclare pas compatible iPad', () => {
  it('app.json et le projet Xcode disent la même chose', () => {
    const app = JSON.parse(lire('app.json'))
    expect(app.expo.ios.supportsTablet).toBe(false)

    const projet = lire('ios/Inventaire.xcodeproj/project.pbxproj')
    // 1 = iPhone, 2 = iPad. Les deux configurations (Debug et Release) sont
    // concernées : une seule des deux laisserait passer un build sur l'autre.
    // ⚠️ Xcode écrit la valeur SANS guillemets (`= 1;`) tant qu'elle est un
    // simple nombre, et avec guillemets dès qu'elle en porte deux (`= "1,2";`).
    // Une garde qui n'accepte que la forme entre guillemets ne trouve rien et
    // échoue sur un projet parfaitement juste — c'est ce qu'elle faisait.
    const familles = [...projet.matchAll(/TARGETED_DEVICE_FAMILY = "?([^";]*)"?;/g)]
      .map((m) => m[1])
    expect(familles.length).toBeGreaterThan(0)
    for (const f of familles) expect(f).toBe('1')
  })
})
