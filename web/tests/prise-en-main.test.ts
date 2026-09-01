import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPTURES_LE, CAPTURES_A_REFAIRE, PARCOURS } from '../lib/priseEnMain'

const here = path.dirname(fileURLToPath(import.meta.url))
const web = (p: string) => path.join(here, '..', p)
const lire = (p: string) => readFileSync(web(p), 'utf8')

/**
 * Le guide de prise en main, dans la boîte à outils.
 *
 * ⚠️ **Un guide qui montre des écrans disparus est pire que pas de guide.**
 * C'est ce qui a tué le tutoriel intégré de l'application, dont le retour est
 * interdit pour cette raison. Ces gardes portent donc autant sur la fraîcheur
 * des captures que sur le rendu.
 */
describe('prise en main', () => {
  it('chaque étape a sa capture, réellement présente', () => {
    // ⚠️ Une image manquante ne casse rien au build : elle laisse un cadre
    // vide dans un guide qu'on remet à une recrue. Seul un test le voit.
    const manquantes: string[] = []
    for (const p of PARCOURS) {
      for (const e of p.etapes) {
        if (!existsSync(web(`public/prise-en-main/${e.image}.png`))) manquantes.push(e.image)
      }
    }
    expect(manquantes).toEqual([])
  })

  it('les deux parcours sont là, et rien d’autre', () => {
    // Décision du 1er septembre 2026 : compteur et superviseur suffisent. Un
    // administrateur d'entreprise est un superviseur au périmètre plus large.
    expect(PARCOURS.map(p => p.cle)).toEqual(['compteur', 'superviseur'])
    for (const p of PARCOURS) expect(p.etapes.length).toBeGreaterThanOrEqual(6)
  })

  it('⚠️ chaque étape cite le repère que l’application affiche', () => {
    // C'est ce qui relie le guide à l'app au lieu d'en faire un document
    // parallèle : un superviseur qui forme une recrue dit exactement ce
    // qu'elle lira ensuite sur son téléphone.
    for (const p of PARCOURS) {
      for (const e of p.etapes) {
        expect(e.repere.length, `${e.image} doit citer son repère`).toBeGreaterThan(20)
        expect(e.titre.length).toBeGreaterThan(0)
      }
    }
  })

  it('⚠️ la date des captures est affichée, et leur péremption avouée', () => {
    const page = lire('app/outils/prise-en-main/page.tsx')
    expect(page).toContain('CAPTURES_LE')
    expect(page).toContain('CAPTURES_A_REFAIRE')
    expect(CAPTURES_LE).toMatch(/\d{4}/)
    // Tant que ce drapeau est vrai, la page dit au lecteur que les écrans ont
    // bougé. Le passer à faux se fait dans le même commit que les captures
    // refaites — jamais avant.
    expect(typeof CAPTURES_A_REFAIRE).toBe('boolean')
  })

  it('la boîte à outils y mène, et ne dit plus « Bientôt »', () => {
    const outils = lire('app/outils/page.tsx')
    expect(outils).toContain('/outils/prise-en-main')
    expect(outils).not.toContain('Bientôt')
    expect(outils).not.toMatch(/<button[^>]*disabled/)
  })

  it('⚠️ le guide s’imprime, et une étape n’est pas coupée en deux', () => {
    // Une feuille affichée en réserve vaut mieux qu'un lien. Et sur le papier
    // les DEUX parcours s'impriment : l'onglet masqué à l'écran ne l'est plus.
    const css = lire('app/globals.css')
    const bloc = css.slice(css.indexOf('@media print'))
    expect(bloc).toContain('.pem-etape')
    expect(bloc).toContain('break-inside: avoid')
    expect(bloc).toMatch(/\.pem-cache \{ display: block/)
  })
})
