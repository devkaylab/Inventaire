import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/en'
import { ERREURS_SERVEUR, PREFIXES, traduireErreurServeur } from '@/lib/erreursServeur'

// L'espace connecté du site parle anglais depuis le 10 septembre 2026 ; la
// vitrine, les e-mails, les PDF et les exports restent en français. Même
// contrat que l'application (`tests/i18n.test.ts` à la racine) : la phrase
// française est la clé, et une clé inconnue s'affiche en français.

const racine = path.resolve(__dirname, '..')
const depot = path.resolve(racine, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

function fichiers(dossier: string, ext = /\.tsx?$/): string[] {
  const out: string[] = []
  for (const nom of readdirSync(dossier)) {
    const p = path.join(dossier, nom)
    if (statSync(p).isDirectory()) { if (!['node_modules', '.next'].includes(nom)) out.push(...fichiers(p, ext)) }
    else if (ext.test(nom)) out.push(p)
  }
  return out
}

const normaliser = (s: string) => s.replace(/[  ]/g, ' ')
function decoder(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n')
}

function clesDemandees(): Map<string, string> {
  const motif = /(?<![\w.$])tn?\(\s*(['"])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g
  const cles = new Map<string, string>()
  for (const f of [...fichiers(path.join(racine, 'app')), ...fichiers(path.join(racine, 'components')), ...fichiers(path.join(racine, 'lib'))]) {
    if (f.endsWith(`lib${path.sep}i18n.tsx`)) continue
    const texte = readFileSync(f, 'utf8')
    for (const m of texte.matchAll(motif)) cles.set(normaliser(decoder(m[2])), path.relative(racine, f))
  }
  return cles
}

describe('l’espace connecté en anglais', () => {
  const dictionnaire = new Map(Object.entries(en).map(([k, v]) => [normaliser(k), v]))

  it('toute phrase demandée par t() ou tn() a sa traduction', () => {
    const manquantes = [...clesDemandees()]
      .filter(([cle]) => !dictionnaire.has(cle))
      .map(([cle, f]) => `${f} : ${JSON.stringify(cle)}`)
    expect(manquantes, manquantes.join('\n')).toEqual([])
  })

  it('une clé de tn() porte ses deux formes', () => {
    const src = [...fichiers(path.join(racine, 'app')), ...fichiers(path.join(racine, 'components')), ...fichiers(path.join(racine, 'lib'))]
      .map((f) => readFileSync(f, 'utf8')).join('\n')
    const pluriels = new Set<string>()
    for (const m of src.matchAll(/(?<![\w.$])tn\(\s*(['"])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g)) pluriels.add(normaliser(decoder(m[2])))
    const sansPluriel = [...pluriels].filter((k) => typeof dictionnaire.get(k) === 'string')
    expect(sansPluriel, `tn() attend { one, other } pour : ${sansPluriel.join(' · ')}`).toEqual([])
  })

  it('aucune traduction n’est vide, et chaque %{variable} traverse', () => {
    const defauts: string[] = []
    for (const [cle, val] of Object.entries(en)) {
      const formes = typeof val === 'string' ? [val] : [val.one, val.other]
      const vars = new Set([...cle.matchAll(/%\{(\w+)\}/g)].map((m) => m[1]))
      for (const forme of formes) {
        if (!forme.trim()) defauts.push(`vide : ${cle}`)
        for (const v of vars) if (!forme.includes(`%{${v}}`)) defauts.push(`%{${v}} perdu : ${cle}`)
      }
    }
    expect(defauts, defauts.join('\n')).toEqual([])
  })

  it('la langue se choisit sur le site (toggle) et dans Mon compte, et suit le navigateur par défaut', () => {
    const i18n = lire('lib/i18n.tsx')
    expect(i18n).toContain('navigator.language')
    expect(i18n).toContain('qlang')
    expect(lire('components/AppShell.tsx')).toContain('<LangueToggle')
    expect(lire('app/login/page.tsx')).toContain('<LangueToggle')
    expect(lire('app/account/page.tsx')).toContain('langue-choix')
    expect(lire('app/layout.tsx')).toContain('<LangueProvider')
  })

  it('les textes légaux restent en français, et le disent en anglais', () => {
    const note = lire('components/NoteVersionFrancaise.tsx')
    expect(note).toContain("langue === 'fr'")
    expect(note).toContain('la version française fait foi')
    expect(lire('app/mentions-legales/page.tsx')).toContain('<NoteVersionFrancaise />')
    expect(lire('app/confidentialite/page.tsx')).toContain('<NoteVersionFrancaise />')
  })

  it('le message d’erreur passe par la traduction avant l’écran', () => {
    const errors = lire('lib/errors.ts')
    expect(errors).toContain("from '@/lib/erreursServeur'")
    expect(errors).toContain('traduireErreurServeur(')
    expect(traduireErreurServeur('Accès refusé')).toBe('Access denied')
    expect(traduireErreurServeur('Accès refusé [42501]')).toBe('Access denied [42501]')
    expect(traduireErreurServeur('Une phrase inconnue')).toBe('Une phrase inconnue')
  })

  it('tout refus écrit par une fonction SQL a sa traduction', () => {
    // Les fonctions répondent `'error', 'Phrase'` : chaque phrase littérale
    // doit être connue, ou commencer par un préfixe (message concaténé).
    const refus = new Set<string>()
    const dossier = path.join(depot, 'supabase', 'migrations')
    for (const f of fichiers(dossier, /\.sql$/)) {
      const sql = readFileSync(f, 'utf8')
      for (const m of sql.matchAll(/'error'\s*,\s*'((?:[^']|'')+)'/g)) refus.add(m[1].replace(/''/g, "'"))
    }
    expect(refus.size).toBeGreaterThan(100)
    const inconnues = [...refus].filter((r) => !(r in ERREURS_SERVEUR) && !PREFIXES.some(([debut]) => r.startsWith(debut) || debut.startsWith(r)))
    expect(inconnues, inconnues.join('\n')).toEqual([])
  })
})

// ── La vitrine en anglais, sous /en (11 septembre 2026) ─────────────────────
import { CHEMINS_VITRINE, cheminDansLangue, langueDuChemin, lienVitrine } from '@/lib/vitrine'
import { existsSync } from 'node:fs'

describe('la vitrine a deux adresses par page', () => {
  it('chaque page française de la vitrine a sa jumelle sous /en, et les deux lisent la même entrée de métadonnées', () => {
    for (const c of CHEMINS_VITRINE) {
      const fr = path.join(racine, 'app', c === '/' ? '' : c, 'page.tsx')
      const en = path.join(racine, 'app', 'en', c === '/' ? '' : c, 'page.tsx')
      expect(existsSync(fr), `${c} n’a pas de page française`).toBe(true)
      expect(existsSync(en), `${c} n’a pas de jumelle sous /en`).toBe(true)
      const srcFr = readFileSync(fr, 'utf8')
      const srcEn = readFileSync(en, 'utf8')
      // Même composant, même entrée META_VITRINE — seule la langue change.
      const comp = (s: string) => /import \{ (\w+) \} from '@\/components\/vitrine\//.exec(s)?.[1]
      const meta = (s: string) => /META_VITRINE\.(\w+)\(/.exec(s)?.[1]
      expect(comp(srcEn), `${c} : composant`).toBe(comp(srcFr))
      expect(meta(srcEn), `${c} : métadonnées`).toBe(meta(srcFr))
      expect(srcFr).toContain("('fr')")
      expect(srcEn).toContain("('en')")
    }
  })

  it('les métadonnées déclarent les deux langues l’une à l’autre (hreflang), x-default sur le français', () => {
    const m = lire('lib/metaVitrine.ts')
    expect(m).toContain("languages: { fr: cheminFr, en: cheminEn, 'x-default': cheminFr }")
    expect(m).toContain("canonical: langue === 'en' ? cheminEn : cheminFr")
  })

  it('la langue d’une page de la vitrine vient de son adresse, pas du cookie', () => {
    expect(langueDuChemin('/en')).toBe('en')
    expect(langueDuChemin('/en/tarifs')).toBe('en')
    expect(langueDuChemin('/tarifs')).toBe('fr')
    expect(langueDuChemin('/tarifs#offres')).toBe('fr')
    // Hors vitrine, personne n'impose rien : c'est le choix de l'appareil.
    expect(langueDuChemin('/login')).toBeNull()
    expect(langueDuChemin('/entreprise')).toBeNull()
    expect(langueDuChemin('/devis/abc')).toBeNull()
    // `useLangue` applique cette règle.
    expect(lire('lib/i18n.tsx')).toContain('return imposee ?? choisie')
  })

  it('un lien de la vitrine change d’adresse en anglais ; un lien de l’espace connecté, jamais', () => {
    expect(lienVitrine('en', '/')).toBe('/en')
    expect(lienVitrine('en', '/tarifs')).toBe('/en/tarifs')
    expect(lienVitrine('en', '/souscrire?offre=advanced')).toBe('/en/souscrire?offre=advanced')
    expect(lienVitrine('en', '/#fonctionnalites')).toBe('/en#fonctionnalites')
    expect(lienVitrine('en', '/login')).toBe('/login')
    expect(lienVitrine('en', 'mailto:x@y.z')).toBe('mailto:x@y.z')
    expect(lienVitrine('fr', '/tarifs')).toBe('/tarifs')
    expect(cheminDansLangue('/en/tarifs', 'fr')).toBe('/tarifs')
    expect(cheminDansLangue('/tarifs', 'en')).toBe('/en/tarifs')
    expect(cheminDansLangue('/en', 'fr')).toBe('/')
  })

  it('le bouton FR/EN navigue sur la vitrine, et change sur place ailleurs', () => {
    const b = lire('components/LangueToggle.tsx')
    expect(b).toContain('if (langueDuChemin(chemin)) router.push(cheminDansLangue(')
    expect(b).toContain('changerLangue(autre)')
    // Il est monté sur la coquille publique, donc sur toute la vitrine.
    expect(lire('components/SiteChrome.tsx')).toContain('<LangueToggle />')
  })

  it('la détection automatique ne renvoie que du français vers l’anglais, et jamais un robot', () => {
    const r = lire('components/RedirectionLangue.tsx')
    expect(r).toContain("if (langueDuChemin(chemin) !== 'fr') return")
    expect(r).toContain('navigator.userAgent')
    expect(r).toContain("if (langueEnregistree() !== 'en') return")
    expect(r).toContain('router.replace(')
    expect(r).not.toContain('router.push(')
  })

  it('les liens écrits dans la vitrine passent par lien() — aucun href de vitrine en dur', () => {
    const dossier = path.join(racine, 'components', 'vitrine')
    for (const f of fichiers(dossier)) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const durs = [...src.matchAll(/href="(\/[a-z0-9-]*)"/g)].map((m) => m[1])
        .filter((h) => (CHEMINS_VITRINE as readonly string[]).includes(h))
      expect(durs, `${path.basename(f)} écrit en dur : ${durs.join(', ')}`).toEqual([])
    }
  })

  it('le plan du site porte les pages /en', () => {
    const site = lire('lib/site.ts')
    for (const c of CHEMINS_VITRINE) {
      expect(site).toContain(`chemin: '${lienVitrine('en', c)}'`)
    }
  })
})
