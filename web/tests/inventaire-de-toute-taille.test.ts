// Un inventaire de n'importe quelle taille (3 septembre 2026)
//
// Constat de Julien, le matin même : « nous étions en inventaire ce matin et
// n'avons pas pu utiliser l'outil ». Sept erreurs dans les journaux entre 06:39
// et 06:47 UTC, toutes sur /rest/v1/articles, cinq depuis le navigateur et une
// depuis l'iPhone.
//
// DEUX CAUSES, mesurées sur la base réelle, et ces gardes tiennent les deux :
//
//  1. la policy RLS de `articles`, `counts` et `article_audit` appelle
//     `is_session_participant(session_id)` — la colonne de la LIGNE, donc une
//     évaluation par ligne, 0,44 ms chacune. Avec 8 s de délai serveur, toute
//     lecture directe qui balaie un inventaire casse au-delà de ~18 000 lignes ;
//  2. `recompute_session_audit` et `get_session_detail` dépendaient de la
//     FRAÎCHEUR DES STATISTIQUES — périmées juste après un import de 30 000
//     lignes. Même requête, mêmes données : 53 ms contre plus de 45 s.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition, fichierDe } from './migrations'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

/** ⚠️ Une garde qui vérifie une ABSENCE lit le code SANS ses commentaires :
 *  ces fichiers racontent le défaut corrigé, donc ils citent ce qu'ils
 *  n'emploient plus. Le piège s'est présenté cinq fois sur ce projet. */
const sansCommentaires = (src: string) =>
  src
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('--'))
    .join('\n')

const RPC = [
  'lister_articles',
  'lister_ecarts',
  'mes_balises_comptees',
  'scans_de_balise',
] as const

describe('le ménage de l’audit ne dépend plus du planificateur', () => {
  it('marque les lignes vivantes au lieu de les rechercher par jointure', () => {
    const { corps } = derniereDefinition('recompute_session_audit')
    const code = sansCommentaires(corps)
    // Le marqueur : posé par l'upsert, relu par le delete.
    expect(code).toContain('v_marque timestamptz')
    expect(code).toContain('updated_at = v_marque')
    expect(code).toContain('a.updated_at is distinct from v_marque')
  })

  it('et n’a plus de sous-requête corrélée — c’est la forme dont le plan s’effondre', () => {
    const code = sansCommentaires(derniereDefinition('recompute_session_audit').corps)
    expect(code).not.toContain('not exists')
    expect(code).not.toContain('c.sku = a.sku')
  })

  it('le rapport ne joint plus une CTE à elle-même', () => {
    const code = sansCommentaires(derniereDefinition('get_session_detail').corps)
    // `cnt` et `aud` étaient deux découpes de la même CTE, re-jointes ensuite :
    // une jointure sans aucune statistique, donc un plan deviné.
    expect(code).not.toContain('left join cnt on')
    expect(code).not.toContain('left join aud on')
    // Une seule passe d'agrégation, puis des jointures sur tables indexées.
    expect(code).toContain('filter (where c.pass_number = 1)')
    expect(code).toContain('left join public.articles a on a.session_id = p_session_id')
  })
})

describe('les lectures qui balaient un inventaire passent par une RPC', () => {
  it.each(RPC)('%s contrôle le droit UNE FOIS, avant de lire', (fn) => {
    const code = sansCommentaires(derniereDefinition(fn).corps)
    expect(code).toMatch(/if not public\.(can_access_session|membre_ou_superviseur)\(p_session_id\) then raise exception 'forbidden'/)
    expect(code).toContain('security definer')
    expect(code).toContain("set search_path to 'public'")
  })

  it.each(RPC)('%s est révoquée à public ET à anon', (fn) => {
    // ⚠️ `create` rend EXECUTE à PUBLIC, et un `revoke … from public` seul ne
    // retire pas `anon` : c'est le constat n°6 du 28 août 2026, qui se
    // reproduit à chaque fonction nouvelle.
    const fichier = fichierDe(fn)
    expect(fichier).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`))
    expect(fichier).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated, service_role`))
  })

  it('le garde partagé n’est PAS une surface cliente', () => {
    // `membre_ou_superviseur` répond « cette personne voit-elle cet
    // inventaire ». Les fonctions qui l'appellent sont SECURITY DEFINER : elles
    // s'exécutent avec les droits du propriétaire, elles n'ont pas besoin du
    // GRANT. Un client, lui, n'a rien à en faire.
    const fichier = fichierDe('membre_ou_superviseur')
    expect(fichier).toContain('revoke all on function public.membre_ou_superviseur(uuid) from public, anon, authenticated')
    expect(fichier).toContain('grant execute on function public.membre_ou_superviseur(uuid) to service_role')
  })

  it.each(RPC)('%s ne fabrique aucun SQL et ne prend aucune liste', (fn) => {
    const code = sansCommentaires(derniereDefinition(fn).corps)
    expect(code).not.toContain('execute ')
    expect(code).not.toContain('format(')
    // Le périmètre est fixé par le serveur — un inventaire, une balise. Jamais
    // une liste choisie par le client : c'est ce que VR-007 a fermé le 28 août.
    expect(code).not.toContain('[]')
  })

  it('la pagination du référentiel est par CLÉ, jamais par offset', () => {
    // Avec `offset`, la page N repayait le contrôle d'accès sur les N × 1000
    // lignes précédentes. Mesuré : page 1 → 388 ms, page 29 → 10 832 ms.
    const code = sansCommentaires(derniereDefinition('lister_articles').corps)
    expect(code).toContain('p_apres_sku is null or a.sku > p_apres_sku')
    expect(code).toContain('order by a.sku')
    expect(code).not.toContain('offset')
    // Et la tranche demandée est bornée : un client ne choisit pas sa charge.
    expect(code).toContain('least(greatest(coalesce(p_limite, 1000), 1), 5000)')
  })

  it('« ce que j’ai compté » filtre sur la personne connectée, en base', () => {
    // ⚠️ Ce n'était pas qu'un sujet de volume. `getMyCounts` ne filtrait sur
    // personne : c'est `counts_select_own` qui bornait un COMPTEUR à ses
    // lignes. Un SUPERVISEUR relève de `counts_select_supervisor` — il voyait
    // toute l'équipe sous un écran qui annonce son propre travail.
    const code = sansCommentaires(derniereDefinition('mes_balises_comptees').corps)
    expect(code).toContain('c.counted_by = auth.uid()')
  })
})

describe('les écrans ne balaient plus les tables eux-mêmes', () => {
  it('le site lit les écarts en un seul appel, libellés compris', () => {
    const lib = sansCommentaires(lire('../lib/inventory.ts'))
    expect(lib).toContain("supabase.rpc('lister_ecarts'")
    expect(lib).not.toContain(".from('article_audit')")
    // Les libellés partaient en 150 requêtes de 200 SKU sur un gros catalogue.
    expect(lib).not.toContain("SKU_CHUNK")

    const onglet = sansCommentaires(lire('../components/dashboard/tabs/EcartsTab.tsx'))
    expect(onglet).toContain('getEcarts(sessionId)')
    expect(onglet).not.toContain('getArticleLabels')
  })

  it('l’application lit les écarts de la même façon', () => {
    const q = sansCommentaires(lire('../../src/lib/queries.ts'))
    expect(q).toContain("supabase.rpc('lister_ecarts'")
    expect(q).toContain("supabase.rpc('mes_balises_comptees'")
    expect(q).toContain("supabase.rpc('scans_de_balise'")
    expect(q).toContain("supabase.rpc('lister_articles'")
    // `getArticleLabels` n'a plus d'appelant : ses deux écrans reçoivent les
    // libellés avec les lignes.
    expect(q).not.toContain('export async function getArticleLabels')
  })

  it('le cache hors ligne ne pagine plus par range', () => {
    const q = sansCommentaires(lire('../../src/lib/queries.ts'))
    expect(q).not.toContain('.range(')
    expect(q).toContain('p_apres_sku')
  })

  it('et la liste des scans ne s’agrège plus sur le téléphone', () => {
    const q = sansCommentaires(lire('../../src/lib/queries.ts'))
    // Le motif retiré : rapatrier chaque ligne de `counts`, sommer en JS, puis
    // recharger les articles par tranches de 300.
    expect(q).not.toContain("const CHUNK = 300")
    expect(q).not.toContain(".in('sku', slice)")
  })

  it('« ce que j’ai compté » n’interroge plus counts directement', () => {
    const q = sansCommentaires(lire('../../src/lib/queries.ts'))
    expect(q).not.toContain(".from('counts')\n    .select('*')")
    const ecran = sansCommentaires(lire('../../src/components/CountedBalisesList.tsx'))
    expect(ecran).not.toContain('getArticleLabels')
  })
})
