// Un référentiel de 30 000 articles ne se compte ni ne se remplace plus au
// rythme d'une ligne à la fois.
//
// Le défaut visible était un encadré rouge portant `{"message":""}` (constat de
// Julien, 3 septembre 2026). Derrière : la policy `articles_supervisor` appelle
// `is_session_participant(session_id)`, qui porte la colonne de la LIGNE, donc
// s'évalue une fois par ligne — 11,7 s pour compter 29 382 articles, au-delà du
// délai serveur. PostgREST rend alors une erreur SANS TEXTE, et l'écran la
// sérialisait en JSON.
//
// Ces gardes tiennent les deux moitiés : le chemin serveur, et le fait qu'une
// erreur muette ne redevienne jamais du JSON à l'écran.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { errorMessage, friendlyError } from '@/lib/errors'
import { derniereDefinition, fichierDe } from './migrations'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

/** ⚠️ Une garde qui vérifie une ABSENCE lit le code SANS ses commentaires :
 *  ces fichiers expliquent le défaut, donc ils citent ce qu'ils n'emploient
 *  plus. Le piège s'est présenté quatre fois sur ce projet. */
const sansCommentaires = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('--'))
    .join('\n')

describe('compter et vider un gros référentiel', () => {
  it('passe par une RPC, jamais par un comptage exact au navigateur', () => {
    const code = sansCommentaires(lire('../lib/inventory.ts'))
    expect(code).toContain("supabase.rpc('etat_import'")
    // C'est le motif qui expirait : deux HEAD `count: 'exact'` sur des tables
    // dont la policy s'évalue par ligne.
    expect(code).not.toContain("count: 'exact'")
  })

  it('vide par une RPC des deux côtés, site et application', () => {
    for (const fichier of ['../lib/import.ts', '../../src/lib/import.ts']) {
      const code = sansCommentaires(lire(fichier))
      expect(code, fichier).toContain("supabase.rpc('vider_import'")
      expect(code, fichier).toContain("p_cible: 'articles'")
      expect(code, fichier).toContain("p_cible: 'stock'")
      expect(code, fichier).not.toContain("from('articles').delete()")
      expect(code, fichier).not.toContain("from('theoretical_stock').delete()")
      expect(code, fichier).not.toMatch(/\.from\(\s*'(articles|theoretical_stock)'\s*\)\s*\n?\s*\.delete\(\)/)
    }
  })

  it("les deux fonctions contrôlent le droit UNE fois, et c'est la qual de la policy", () => {
    for (const fn of ['etat_import', 'vider_import']) {
      const corps = derniereDefinition(fn).corps
      // ⚠️ `can_access_session` EST, à la lettre, la qual des policies
      // contournées : `get_my_role() = 'supervisor' and
      // is_session_participant(...)`. La garde ne s'élargit donc pas.
      expect(corps, fn).toContain('public.can_access_session(p_session_id)')
      expect(corps, fn).toContain("raise exception 'forbidden'")
      expect(corps, fn).toContain('security definer')
    }
  })

  it('vider_import ne prend pas un nom de table, mais un choix entre deux branches', () => {
    const corps = sansCommentaires(derniereDefinition('vider_import').corps)
    expect(corps).toContain("p_cible = 'articles'")
    expect(corps).toContain("p_cible = 'stock'")
    expect(corps).toContain("raise exception 'cible inconnue'")
    // Jamais de SQL fabriqué à partir du paramètre : ce serait une injection.
    expect(corps).not.toContain('execute ')
    expect(corps).not.toContain('format(')
    // ⚠️ Bornée à UN inventaire. Ne jamais l'élargir à une liste — c'est ce qui
    // la sépare du DELETE sur critère libre fermé par VR-007.
    expect(corps).not.toMatch(/uuid\s*\[\s*\]/)
  })

  it("et anon ne peut exécuter ni l'une ni l'autre", () => {
    // ⚠️ `create` rend EXECUTE à PUBLIC : le revoke vise `public` ET `anon`.
    // Constat n°6 du 28 août 2026, qui se reproduit à chaque fonction nouvelle.
    for (const fn of ['etat_import', 'vider_import']) {
      const fichier = fichierDe(fn)
      expect(fichier, fn).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`))
      expect(fichier, fn).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated, service_role`))
    }
  })
})

describe("une erreur sans texte ne s'affiche pas en JSON", () => {
  it("c'est le cas exact qui a produit l'encadré rouge", () => {
    // Ce que PostgREST fabrique d'une réponse en erreur au corps vide.
    expect(errorMessage({ message: '' })).not.toContain('{')
    expect(friendlyError({ message: '' })).not.toContain('{"message"')
  })

  it('aucune forme muette ne repasse en JSON', () => {
    for (const muet of [{}, { message: '' }, { message: null }, { details: '' }, { code: '' }]) {
      expect(errorMessage(muet), JSON.stringify(muet)).not.toContain('{')
      expect(friendlyError(muet), JSON.stringify(muet)).not.toContain('{')
    }
  })

  it('mais le code technique survit quand il existe — il retrouve l’incident', () => {
    expect(errorMessage({ code: '57014' })).toContain('57014')
  })

  it('un délai dépassé se dit, et ne se confond pas avec une coupure réseau', () => {
    const dit = friendlyError({ message: 'canceling statement due to statement timeout', code: '57014' })
    expect(dit).toMatch(/trop de temps/i)
    expect(dit).not.toMatch(/réseau/i)
  })

  it('les messages déjà lisibles ne bougent pas', () => {
    expect(friendlyError(new Error('forbidden'))).toMatch(/Accès refusé/)
    expect(friendlyError(new Error('42501'))).toMatch(/Action refusée/)
    expect(friendlyError(new Error('Failed to fetch'))).toMatch(/Connexion perdue/)
    expect(errorMessage(new Error('Boum'))).toBe('Boum')
    expect(errorMessage('Boum')).toBe('Boum')
    expect(errorMessage({ message: 'Boum', code: '23505' })).toBe('Boum [23505]')
  })
})
