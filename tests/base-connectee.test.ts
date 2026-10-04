// L'app dit sur quelle base elle écrit (4 octobre 2026).
//
// Le site a reçu son garde le matin même : un aperçu Vercel sans variables
// tombait sur l'adresse de production écrite en dur et écrivait chez les vrais
// clients. L'app a le même défaut sous une autre forme — son adresse est
// figée au bundle, dans un `.env` unique, et l'identifiant d'un build d'essai
// est celui de l'app publiée. Rien ne les distingue une fois installés.
//
// Ce que ces gardes empêchent de défaire : que l'hôte de production devienne
// lui-même une variable d'environnement, qu'une adresse absente passe pour la
// production, que le bandeau coûte quoi que ce soit à l'app publiée, et qu'il
// disparaisse du layout.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { hoteDeLaBase, repereDeLaBase, surLaProduction } from '@/lib/baseConnectee'

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const codeSeul = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

const PRODUCTION = 'https://heabesqvlinzarqenymj.supabase.co'
const ESSAI = 'https://lqgusznqcunjhrqslcug.supabase.co'

const origine = process.env.EXPO_PUBLIC_SUPABASE_URL
afterEach(() => { process.env.EXPO_PUBLIC_SUPABASE_URL = origine })

describe('la règle reconnaît la production, et elle seule', () => {
  it('la production est la production', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = PRODUCTION
    expect(surLaProduction()).toBe(true)
  })

  it('une autre base ne l’est pas', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = ESSAI
    expect(surLaProduction()).toBe(false)
    expect(repereDeLaBase()).toBe('lqgusznqcunjhrqslcug')
  })

  it('⚠️ une adresse absente n’est PAS la production', () => {
    // Le cas qu'on oublie : un build sans `.env`. Il ne se connecte à rien, et
    // le prendre pour la production ferait disparaître le bandeau au pire
    // moment.
    delete process.env.EXPO_PUBLIC_SUPABASE_URL
    expect(surLaProduction()).toBe(false)
    expect(hoteDeLaBase()).toBe('')
    expect(repereDeLaBase()).toBe('aucune')
  })

  it('une adresse illisible non plus', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'pas-une-adresse'
    expect(surLaProduction()).toBe(false)
  })

  it('⚠️ et une adresse qui CONTIENT l’hôte ne suffit pas', () => {
    // `includes` laisserait passer un hôte fabriqué pour ressembler.
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://heabesqvlinzarqenymj.supabase.co.ailleurs.net'
    expect(surLaProduction()).toBe(false)
  })
})

describe('l’hôte de production ne peut pas être déplacé', () => {
  const regle = codeSeul(lire('src/lib/baseConnectee.ts'))

  it('⚠️ il est écrit en dur, jamais lu dans l’environnement', () => {
    // C'est l'environnement qu'on met en doute : le lire là-dedans rendrait la
    // règle circulaire, et un `.env` d'essai se déclarerait production.
    expect(regle).toMatch(/const HOTE_PRODUCTION = 'heabesqvlinzarqenymj\.supabase\.co'/)
    const comparaison = regle.slice(regle.indexOf('export function surLaProduction'))
    expect(comparaison, 'la comparaison lit l’environnement au lieu de la constante')
      .not.toContain('process.env')
  })
})

describe('le bandeau ne coûte rien à l’app publiée', () => {
  const bandeau = codeSeul(lire('src/components/BandeauBaseEssai.tsx'))

  it('⚠️ sur la production il rend `null`, et c’est la PREMIÈRE chose qu’il fait', () => {
    // Une bande de hauteur nulle réserverait quand même la zone sûre et
    // décalerait l'en-tête de chaque écran de l'app publiée.
    expect(bandeau).toMatch(/if \(surLaProduction\(\)\) return null/)
    const corps = bandeau.slice(bandeau.indexOf('export function BandeauBaseEssai'))
    expect(
      corps.indexOf('return null') < corps.indexOf('<View'),
      'le bandeau construit sa vue avant de sortir',
    ).toBe(true)
  })

  it('il ne s’anime pas et ne se referme pas', () => {
    // Ce n'est pas un état qui change : c'est ce qu'est ce build.
    for (const interdit of ['Animated', 'useState', 'onPress', 'setTimeout']) {
      expect(bandeau, `le bandeau utilise ${interdit}`).not.toContain(interdit)
    }
  })

  it('⚠️ ses couleurs ne viennent pas du thème', () => {
    // Un thème se charge, peut échouer, et se choisit. Cette bande doit
    // s'afficher même quand tout le reste est encore gris.
    expect(bandeau).not.toContain('useTheme')
    expect(bandeau).toMatch(/const FOND = '#[0-9A-Fa-f]{6}'/)
  })

  it('il dit quelle base, pas seulement « pas la production »', () => {
    // Deux bases d'essai se confondraient sans ce repère.
    expect(bandeau).toContain('repereDeLaBase()')
  })
})

describe('le bandeau est réellement monté', () => {
  const layout = codeSeul(lire('src/app/_layout.tsx'))

  it('⚠️ dans le layout racine, AVANT le bandeau hors ligne', () => {
    // Monté dans un écran, il manquerait partout ailleurs. Et il passe en
    // premier : savoir sur quelle base on écrit prime sur le réseau.
    expect(layout).toContain('<BandeauBaseEssai />')
    expect(
      layout.indexOf('<BandeauBaseEssai />') < layout.indexOf('<OfflineTopBanner />'),
      'le bandeau de base passe après le hors-ligne',
    ).toBe(true)
  })
})

describe('le script de simulateur ne peut pas mentir sur la base', () => {
  const script = lire('scripts/simulateur.sh')

  it('⚠️ BASE refuse le mode Debug', () => {
    // En Debug le JS vient de Metro, lancé ailleurs, qui lit `.env` : la base
    // choisie ne l'atteindrait pas et l'app tournerait sur la PRODUCTION en
    // affichant qu'elle est sur une base d'essai. Pire que rien.
    const bloc = script.slice(script.indexOf('if [ -n "$BASE" ]'))
    expect(bloc).toMatch(/if \[ "\$CONFIG" != "Release" \]/)
    expect(bloc.slice(0, bloc.indexOf('set -a'))).toContain('exit 1')
  })

  it('il n’écrit jamais dans `.env`', () => {
    // Un `.env` échangé puis restauré se perd au premier Ctrl-C, et le build
    // suivant part sur la base d'essai sans que personne ne l'ait demandé.
    expect(script).not.toMatch(/(cp|mv|>)\s+["']?\$?\{?RACINE\}?\/?\.env["']?\s*$/m)
    expect(script).not.toMatch(/>\s*\.env\b/)
  })

  it('un fichier d’environnement absent arrête tout', () => {
    const bloc = script.slice(script.indexOf('if [ -n "$BASE" ]'))
    expect(bloc).toMatch(/if \[ ! -f "\$FICHIER" \]/)
  })
})
