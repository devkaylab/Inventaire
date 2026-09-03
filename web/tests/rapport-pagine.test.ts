import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition, fichierDe } from './migrations'

/**
 * Le rapport se lit par pages (3 septembre 2026).
 *
 * L'écran chargeait TOUTES les lignes — 400 000 sur un gros inventaire — puis
 * calculait totaux, recherche et tri dans le navigateur. Le serveur ne rendait
 * plus la main (6,3 s mesurées pour un plafond de 8 s) et l'écran ne s'ouvrait
 * plus du tout.
 *
 * Ces gardes protègent les trois choses qui font qu'un tableau paginé est
 * juste : les totaux portent sur tout, l'ordre est total, et l'export reste
 * complet.
 */
const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const onglet = lire('../components/dashboard/tabs/RapportTab.tsx')
const acces = lire('../lib/inventory.ts')

describe('le rapport se lit par pages', () => {
  it('⚠️ l’écran ne demande plus TOUTES les lignes', () => {
    // C'est le défaut corrigé : `get_session_results` rendait 400 000 lignes
    // en une réponse que le serveur ne peut pas produire dans son délai.
    const code = sansCommentaires(onglet)
    expect(code).not.toContain('getSessionResults(')
    expect(code).toContain('getRapportPage(')
    expect(code).toContain('getRapportResume(')
  })

  it('⚠️ les totaux viennent de la BASE, pas d’une addition de la page', () => {
    // Additionner la page donnerait des tuiles qui changent quand on tourne
    // les pages — un écart total qui bouge n'est plus un écart total.
    const code = sansCommentaires(onglet)
    expect(code).not.toMatch(/rows\.reduce\(/)
    expect(code).toContain('resume?.ecart_valeur')
    expect(code).toContain('resume?.non_arbitres')
  })

  it('la recherche et le tri sont faits par le serveur', () => {
    const code = sansCommentaires(onglet)
    // Plus de filtrage ni de tri local sur l'ensemble.
    expect(code).not.toMatch(/rows\.filter\(/)
    expect(code).not.toMatch(/\[\.\.\.filtered\]\.sort\(/)
    expect(code).toContain('recherche,')
    expect(code).toContain('tri: sort.key')
  })

  it('⚠️ l’EXPORT contient toujours tout', () => {
    // C'est ce que le client reçoit : il doit être complet. La pagination ne
    // concerne que l'écran ; le fichier parcourt les pages et les assemble.
    const code = sansCommentaires(onglet)
    expect(code).toContain('getAllRapportRows(')
    expect(code).toContain('getSessionDetail(')
    expect(acces).toContain('async function toutesLesPages')
  })

  it('⚠️ la boucle d’export s’arrête, quoi que réponde le serveur', () => {
    // Deux conditions d'arrêt : une page incomplète, et le total atteint. Sans
    // la seconde, un serveur qui répondrait toujours une page pleine ferait
    // tourner le navigateur sans fin.
    expect(acces).toContain('r.rows.length < taille || tout.length >= total')
  })

  it('⚠️ l’ordre est TOTAL : le sku départage', () => {
    // Sans ordre total, deux lignes de même valeur peuvent changer de place
    // entre deux pages : on en voit une deux fois, et une autre jamais.
    const { corps } = derniereDefinition('rapport_page')
    const code = corps.replace(/^\s*--.*$/gm, '')
    expect(code).toMatch(/order by[\s\S]*f\.r_sku\s*\n?\s*offset/)
    const detail = derniereDefinition('rapport_detail_page').corps.replace(/^\s*--.*$/gm, '')
    expect(detail).toMatch(/order by[\s\S]*t\.a_sku/)
  })

  it('⚠️ aucun SQL n’est fabriqué à partir du tri demandé', () => {
    // Règle du projet, déjà posée pour `vider_import` : le paramètre choisit
    // entre des branches écrites en clair, il ne devient jamais du SQL.
    const { corps } = derniereDefinition('rapport_page')
    expect(corps).not.toMatch(/\bexecute\b/i)
    expect(corps).not.toContain('format(')
    expect(corps).toContain("case p_tri when 'label'")
  })

  it('⚠️ le serveur borne la page, quoi que demande l’appelant', () => {
    // Sinon on redemande les 400 000 lignes par la porte de derrière.
    const { corps } = derniereDefinition('rapport_page')
    expect(corps).toContain('least(greatest(coalesce(p_limite, 100), 1), 5000)')
  })

  it('les droits sont reposés, anon nommément', () => {
    const fichier = fichierDe('rapport_page')
    for (const fn of ['rapport_resume', 'rapport_page', 'rapport_detail_page']) {
      expect(fichier).toContain(`revoke all on function public.${fn}(`)
    }
    expect(fichier).toMatch(/from public, anon/)
  })
})

/**
 * Les écarts d'audit, par pages (3 septembre 2026).
 *
 * ⚠️ La règle qui décide CE QUI EST UN ÉCART vivait dans le navigateur : elle
 * avait besoin de toutes les lignes pour trancher, donc elle ne pouvait pas
 * paginer. Elle est passée en base, clause par clause.
 */
describe('les écarts d’audit se lisent par pages', () => {
  const onglet = sansCommentaires(lire('../components/dashboard/tabs/EcartsTab.tsx'))

  it('⚠️ la règle est reprise CLAUSE PAR CLAUSE', () => {
    // Les trois exclusions, dans l'ordre où `computeDiscrepancies` les pose.
    const { corps } = derniereDefinition('ecarts_page')
    const code = corps.replace(/^\s*--.*$/gm, '')
    expect(code).toContain("a.status <> 'resolved'")
    expect(code).toContain('(coalesce(a.qty_pass2, 0) - coalesce(a.qty_pass1, 0)) <> 0')
    // ⚠️ Le point qui évite les faux positifs : dans une balise, on ne compare
    // que si l'audit de CETTE balise est terminé.
    expect(code).toContain("z.audit_status = 'done'")
    expect(code).toContain('else a.qty_pass2 is not null end')
  })

  it('les trois genres d’écart sont les mêmes qu’au navigateur', () => {
    const { corps } = derniereDefinition('ecarts_page')
    expect(corps).toContain("then 'missing-count'")
    expect(corps).toContain("then 'missing-audit'")
    expect(corps).toContain("else 'quantity'")
  })

  it('⚠️ les compteurs portent sur TOUT, pas sur la page', () => {
    // Un « écarts à traiter » qui changerait en tournant les pages ne voudrait
    // rien dire.
    expect(onglet).toContain('resume?.total')
    expect(onglet).toContain('resume?.arbitres')
    expect(onglet).not.toContain('summarize(')
    expect(onglet).not.toContain('resolvedLines(')
  })

  it('⚠️ les deux listes ont un ordre TOTAL', () => {
    const ecarts = derniereDefinition('ecarts_page').corps.replace(/^\s*--.*$/gm, '')
    expect(ecarts).toMatch(/order by[\s\S]*f\.e_sku\s*\n?\s*offset/)
    // Deux arbitrages faits dans la même seconde ont le même `updated_at` :
    // sans l'id, la pagination en répéterait un.
    const arb = derniereDefinition('ecarts_arbitres_page').corps.replace(/^\s*--.*$/gm, '')
    expect(arb).toContain('order by a.updated_at desc nulls last, a.id')
  })

  it('le filtre par emplacement est servi par le serveur', () => {
    // Il se déduisait de la liste complète ; sans cette fonction il aurait
    // disparu avec la pagination.
    expect(onglet).toContain('getEcartsZones(')
    expect(onglet).not.toContain('new Set<string>()')
  })

  it('les droits sont reposés, anon nommément', () => {
    const fichier = fichierDe('ecarts_page')
    for (const fn of ['ecarts_resume', 'ecarts_page', 'ecarts_zones', 'ecarts_arbitres_page']) {
      expect(fichier).toContain(`revoke all on function public.${fn}(`)
    }
  })
})
