// Un aperçu n'écrit pas dans la production (4 octobre 2026).
//
// Le défaut réparé : `lib/supabaseClient.ts` porte l'adresse de production en
// repli, donc un déploiement d'aperçu sans variables d'environnement tourne
// SUR LA BASE DES VRAIS CLIENTS, sans rien dire — un `console.warn` que
// personne n'ouvre. Mesuré sur l'aperçu On-Demand.
//
// Ce que ces gardes empêchent de défaire : que le refus redevienne un simple
// avertissement, qu'il devienne un bandeau par-dessus un site utilisable, et
// — l'inverse, aussi grave — qu'il puisse éteindre la production.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { hoteEstUnApercu } from '../lib/apercuSansBase'

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const codeSeul = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

const regle = codeSeul(lire('lib/apercuSansBase.ts'))
const garde = codeSeul(lire('components/GardeApercu.tsx'))
const layout = codeSeul(lire('app/layout.tsx'))
const client = codeSeul(lire('lib/supabaseClient.ts'))

describe('⚠️ la production ne peut pas être éteinte par ce garde', () => {
  it('le domaine du site n’est jamais pris pour un aperçu', () => {
    // C'est LA garde qui compte. Un refus trop large arrêterait le site en
    // ligne, ce qui serait bien pire que le défaut qu'on répare.
    expect(hoteEstUnApercu('www.quantinvo.com')).toBe(false)
    expect(hoteEstUnApercu('quantinvo.com')).toBe(false)
    // ⚠️ Et pas par un simple `includes` : un domaine qui contiendrait
    // « vercel.app » ailleurs que dans son suffixe resterait la production.
    expect(hoteEstUnApercu('vercel.app.quantinvo.com')).toBe(false)
  })

  it('un aperçu Vercel, lui, est reconnu', () => {
    expect(hoteEstUnApercu('quantinvo-git-on-demand-devkaylab.vercel.app')).toBe(true)
  })

  it('⚠️ une production qui se nomme n’est JAMAIS bloquée', () => {
    // Le site en ligne répond aussi sur son adresse `*.vercel.app`. Sans cette
    // sortie, une production tournant elle-même sur le repli — ce qui est
    // permis, et documenté dans supabaseClient.ts — s'y verrait refusée.
    expect(regle).toMatch(/porteeEstProduction = porteeDuBuild === 'production'/)
    expect(garde, 'le garde ne sort pas quand Vercel annonce « production »')
      .toMatch(/!porteeEstProduction && configDeRepli/)
  })

  it('le repli SEUL ne bloque rien', () => {
    // La production tourne elle aussi sur le repli, volontairement. Il faut
    // donc DEUX conditions : repli ET aperçu. Un `export const apercuSansBase
    // = configDeRepli` suffirait à éteindre le site en ligne.
    expect(regle).toMatch(/apercuSansBase\s*=\s*porteeDuBuild === 'preview' && configDeRepli/)
    expect(garde).toMatch(/configDeRepli && hoteEstUnApercu\(/)
  })
})

describe('le refus est un refus, pas un avertissement', () => {
  it('⚠️ l’écran REMPLACE l’app, il ne se pose pas dessus', () => {
    // Un bandeau par-dessus un site qui marche laisserait le formulaire de
    // connexion atteignable — donc l'écriture en production possible.
    expect(garde).toMatch(/if \(bloque\) return <EcranSansBase \/>/)
    expect(garde, 'les enfants doivent être rendus APRÈS le refus')
      .toMatch(/if \(bloque\)[\s\S]*return <>\{children\}<\/>/)
  })

  it('aucun chemin d’écriture ne subsiste sur cet écran', () => {
    // ⚠️ AMENDÉE EN ÉCRIVANT. La première version cherchait le mot
    // « supabase » dans tout le fichier : elle mordait sur le NOM des deux
    // variables citées à l'écran, qui est justement ce qu'il doit dire. On
    // mesure donc ce qui compte vraiment — pas de champ ni de bouton DANS
    // l'écran, et aucun client Supabase importé dans le fichier.
    const ecran = garde.slice(garde.indexOf('function EcranSansBase'),
                              garde.indexOf('export function GardeApercu'))
    expect(ecran.length, 'l’écran de refus est introuvable').toBeGreaterThan(100)
    for (const interdit of ['<input', '<form', '<button', 'onClick']) {
      expect(ecran, `l’écran de refus contient ${interdit}`).not.toContain(interdit)
    }
    expect(garde, 'le garde importe un client Supabase')
      .not.toMatch(/from '@?\/?(lib\/)?supabase/)
  })

  it('il dit ce qui manque et où le poser', () => {
    // Un refus muet renverrait à la même enquête que le défaut d'origine.
    expect(garde).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(garde).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    expect(garde, 'la portée Preview est le geste à faire').toMatch(/Preview/)
  })
})

describe('le garde est réellement branché', () => {
  it('il enveloppe tout l’arbre du layout, providers compris', () => {
    expect(layout).toContain('<GardeApercu>')
    // ⚠️ MESURÉ, PAS SUPPOSÉ : tout ce que le body rendait doit être DEDANS.
    // Un `<GardeApercu>` posé autour de `{children}` seul laisserait les
    // providers monter, et surtout ne prouverait pas qu'on n'en a pas sorti un
    // depuis.
    const corps = layout.slice(layout.indexOf('<body>'), layout.indexOf('</body>'))
    const dedans = corps.slice(corps.indexOf('<GardeApercu>'), corps.indexOf('</GardeApercu>'))
    for (const bloc of ['<LangueProvider>', '{children}', '<ThemeToggle />']) {
      expect(dedans, `${bloc} est hors du garde`).toContain(bloc)
    }
  })

  it('⚠️ une seule définition du repli, partagée', () => {
    // Deux lectures de `process.env` — une ici, une dans le client Supabase —
    // divergeraient à la première correction portée sur une seule.
    expect(client).toContain("from './apercuSansBase'")
    expect(client, 'le client Supabase recalcule le repli au lieu de le lire')
      .not.toMatch(/const env(Url|AnonKey)\s*=/)
  })

  it('les deux signaux d’aperçu sont là', () => {
    // La variable de Vercel peut être désactivée dans le tableau de bord ; le
    // nom d'hôte ne se lit pas au rendu serveur. Il faut les deux.
    expect(regle).toContain('NEXT_PUBLIC_VERCEL_ENV')
    expect(regle).toContain('.vercel.app')
  })
})
