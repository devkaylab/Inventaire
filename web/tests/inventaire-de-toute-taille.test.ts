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
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition, dossierMigrations, fichierDe } from './migrations'

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
  // ⚠️ CE BLOC A ÉTÉ RÉCRIT LE JOUR MÊME, et le revirement compte.
  //
  // Le premier correctif remplaçait l'anti-jointure par un MARQUEUR : l'upsert
  // touchait chaque ligne vivante, le delete retirait ce qui gardait une autre
  // valeur. Plan-proof, et mesuré à 87 ms sur 29 889 lignes.
  //
  // Il n'a pas survécu au passage à 400 000 références : le marqueur EXIGE de
  // réécrire toutes les lignes à chaque recalcul, soit dix secondes d'écriture
  // pour rien. La protection est donc passée du côté du PLAN — la boucle
  // imbriquée est fermée dans la fonction, ce qui rend le mauvais choix
  // impossible quelles que soient les statistiques — et l'upsert n'écrit plus
  // que ce qui change.
  it('ferme le plan qui s’effondre plutôt que d’éviter la jointure', () => {
    const def = derniereDefinition('recompute_session_audit').corps
    expect(def).toContain('set enable_nestloop to off')
    const code = sansCommentaires(def)
    // L'anti-jointure est de retour, et c'est assumé : en hachage elle vaut
    // 53 ms là où la boucle imbriquée dépassait 45 s.
    expect(code).toContain('not exists')
    // Le marqueur, lui, a disparu : il coûtait une réécriture complète.
    expect(code).not.toContain('v_marque')
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
  it('le site lit les écarts par le serveur, libellés compris', () => {
    // ⚠️ Amendé le 3 septembre 2026, PAS affaibli. Cette garde interdisait le
    // retour au balayage direct d'`article_audit` ; elle l'interdit toujours.
    // Ce qui a changé, c'est qu'un appel unique ne suffisait plus : à 400 000
    // lignes il demandait 12,9 s pour un plafond de 8 s. On lit maintenant par
    // pages — et l'exigence devient donc plus forte, pas moins.
    const lib = sansCommentaires(lire('../lib/inventory.ts'))
    expect(lib).toContain("supabase.rpc('ecarts_page'")
    expect(lib).toContain("supabase.rpc('ecarts_resume'")
    expect(lib).not.toContain(".from('article_audit')")
    // Les libellés partaient en 150 requêtes de 200 SKU sur un gros catalogue.
    expect(lib).not.toContain("SKU_CHUNK")

    const onglet = sansCommentaires(lire('../components/dashboard/tabs/EcartsTab.tsx'))
    expect(onglet).toContain('getEcartsPage(sessionId')
    expect(onglet).not.toContain('getEcarts(sessionId)')
    expect(onglet).not.toContain('getArticleLabels')
    // ⚠️ Et la règle ne se calcule plus dans le navigateur : elle ne pourrait
    // pas paginer, puisqu'elle a besoin de toutes les lignes pour trancher.
    expect(onglet).not.toContain('computeDiscrepancies(')
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

// ── 400 000 références (3 septembre 2026) ───────────────────────────────────
//
// « Un vrai inventaire peut aller jusqu'à 400 000 références, on doit voir
// large. » Mesuré sur 382 057 références et 764 114 comptages : tout passait
// sauf le recalcul des écarts, à 16,5 s. Et il n'existe pas de version rapide
// du recalcul COMPLET — l'`insert … on conflict` doit sonder chacune des
// 382 057 lignes même quand il n'écrit rien, soit ~6 s de plancher. La seule
// issue est de ne plus tout recalculer à chaque ouverture.
describe('le recalcul des écarts ne repart pas de zéro à chaque fois', () => {
  it('s’arrête net quand aucun comptage n’est arrivé', () => {
    const code = sansCommentaires(derniereDefinition('recompute_session_audit').corps)
    expect(code).toContain('select count(*) into v_comptages from public.counts')
    expect(code).toContain('from public.audit_empreintes')
    expect(code).toContain("'inchange', true")
  })

  it('mais jamais quand on le force — l’annulation d’un arbitrage en dépend', () => {
    // L'annulation écrit dans `article_audit` sans toucher aux comptages :
    // l'empreinte ne bouge pas, et sans `p_force` la ligne resterait « à
    // traiter » au lieu de retrouver son vrai statut.
    const code = sansCommentaires(derniereDefinition('recompute_session_audit').corps)
    expect(code).toContain('p_force boolean default false')
    expect(code).toContain('if not p_force and v_connue is not null')

    const site = sansCommentaires(lire('../components/dashboard/tabs/EcartsTab.tsx'))
    expect(site).toContain('recomputeAudit(sessionId, true)')
    const app = sansCommentaires(lire('../../src/lib/queries.ts'))
    expect(app).toContain('recomputeAudit(sessionId, true)')
  })

  it('n’écrit que ce qui change', () => {
    const code = sansCommentaires(derniereDefinition('recompute_session_audit').corps)
    expect(code).toContain('where public.article_audit.qty_pass1 is distinct from excluded.qty_pass1')
  })

  it('et le mauvais plan du ménage final est rendu impossible', () => {
    // En boucle imbriquée, l'anti-jointure reparcourt tous les comptages de
    // l'inventaire pour CHAQUE ligne d'audit ; en hachage elle vaut 53 ms.
    const code = derniereDefinition('recompute_session_audit').corps
    expect(code).toContain('set enable_nestloop to off')
    // Le tout premier recalcul d'un inventaire entièrement compté crée autant
    // de lignes qu'il y a de références : ~15 s à 400 000, incompressible.
    expect(code).toContain("set statement_timeout to '60s'")
  })

  it('l’ancienne signature à un argument est SUPPRIMÉE, pas laissée à côté', () => {
    // `p_force` ayant un défaut, Postgres garderait les deux et un appel à un
    // argument deviendrait ambigu — le piège de `p_event_id` et de
    // `ca_request_store`.
    const fichier = fichierDe('recompute_session_audit')
    expect(fichier).toContain('drop function if exists public.recompute_session_audit(uuid);')
  })
})

describe('l’empreinte ne peut pas mentir', () => {
  it('elle vit dans une table que personne ne peut écrire', () => {
    // ⚠️ Pas sur `inventory_sessions` : un superviseur a le droit d'y écrire
    // (policy `sessions_supervisor_update`), il pourrait donc figer une
    // empreinte fausse depuis le navigateur et geler ses chiffres d'audit.
    const fichier = fichierDe('oublier_empreinte_audit')
    expect(fichier).toContain('alter table public.audit_empreintes enable row level security')
    expect(fichier).toContain('revoke all on table public.audit_empreintes from public, anon, authenticated')
    expect(fichier).not.toContain('create policy')
  })

  it('et son effacement n’est pas une surface cliente', () => {
    const fichier = fichierDe('oublier_empreinte_audit')
    expect(fichier).toContain('revoke all on function public.oublier_empreinte_audit(uuid) from public, anon, authenticated')
    expect(fichier).toContain('grant execute on function public.oublier_empreinte_audit(uuid) to service_role')
  })

  it('⚠️ TOUTE fonction qui supprime des comptages efface l’empreinte', () => {
    // C'est ce qui rend le raccourci EXACT. `counts` est en ajout pur : hors
    // suppression, le nombre de lignes ne peut que croître. Sans cette règle,
    // une suppression suivie d'un ajout redonnerait le même compte et l'audit
    // resterait faux, en silence.
    const exemptes: Record<string, string> = {
      // Supprime l'inventaire entier : la ligne d'empreinte part en cascade.
      delete_session: 'cascade sur la suppression de l’inventaire',
      // Révoquée à `authenticated` depuis le 13 août 2026 (elle permettait de
      // rouvrir un inventaire clôturé), donc injoignable. La redéfinir rendrait
      // EXECUTE à PUBLIC et rouvrirait ce trou pour un gain nul.
      revert_pass: 'injoignable — révoquée à authenticated',
    }

    const fichiers = readdirSync(dossierMigrations).filter(f => f.endsWith('.sql')).sort()
    // La DERNIÈRE définition de chaque fonction, tous fichiers confondus.
    const derniere = new Map<string, string>()
    for (const f of fichiers) {
      const texte = readFileSync(path.join(dossierMigrations, f), 'utf8')
      const morceaux = texte.split(/create (?:or replace )?function public\./g).slice(1)
      for (const m of morceaux) {
        const nom = m.match(/^(\w+)\s*\(/)?.[1]
        if (nom) derniere.set(nom, m)
      }
    }

    const fautives: string[] = []
    for (const [nom, corps] of derniere) {
      const code = sansCommentaires(corps)
      if (!/delete\s+from\s+public\.counts/.test(code)) continue
      if (nom in exemptes) continue
      if (!code.includes('oublier_empreinte_audit')) fautives.push(nom)
    }
    expect(fautives, `ces fonctions suppriment des comptages sans effacer l'empreinte : ${fautives.join(', ')}`)
      .toEqual([])
  })
})

describe('l’agrégat n’a plus à trier', () => {
  it('l’index porte EXACTEMENT l’expression du group by', () => {
    // Sans lui, regrouper 764 114 comptages passait par un tri sur disque.
    // ⚠️ Si l'expression diverge du `group by`, l'index cesse d'être utilisable
    // et le tri revient sans que rien ne le signale.
    const fichier = fichierDe('recompute_session_audit')
    expect(fichier).toContain("on public.counts (session_id, sku, (coalesce(zone, '')))")
    const code = sansCommentaires(derniereDefinition('recompute_session_audit').corps)
    expect(code).toContain("group by sku, coalesce(zone, '')")
  })
})

/**
 * Les gros écrans ne construisent plus l'univers des articles
 * (4 septembre 2026).
 *
 * Constat de Julien : avec deux inventaires de 400 000 références en base, le
 * tableau de bord d'atterrissage ne se rafraîchit plus. Reproduit sur la base
 * réelle — `tableau_de_bord_superviseur` mettait **8 459 ms**, pour un plafond
 * de 8 s sur le rôle `authenticated`.
 *
 * ⚠️ LE MOTIF EST TOUJOURS LE MÊME : le serveur assemblait l'inventaire ENTIER
 * pour rendre trois tuiles, cinquante lignes ou un anneau à cinq parts. Le
 * travail doit dépendre de ce qu'on affiche, pas de la taille de l'inventaire.
 */
describe('les gros écrans n’assemblent plus tout l’inventaire', () => {
  it('⚠️ l’écart du tableau de bord se DÉCOMPOSE en deux sommes', () => {
    // Σ (compté − théorique) × prix = Σ compté×prix − Σ théorique×prix.
    // Chaque terme est une jointure et une somme ; plus d'univers de SKU à
    // fabriquer. Identité arithmétique, vérifiée identique au centime sur les
    // quatre inventaires réels et deux jeux de 400 000 références.
    const { corps } = derniereDefinition('tableau_de_bord_superviseur')
    const code = corps.replace(/^\s*--.*$/gm, '')
    expect(code).toContain('cross join lateral')
    // L'union des SKU a disparu de cette fonction.
    expect(code).not.toMatch(/univers as \(/)
    expect(code).not.toMatch(/from public\.theoretical_stock t\s*\n?\s*join fen/)
  })

  it('⚠️ le Rapport assemble en UNE passe, par jointure externe complète', () => {
    // Il a besoin d'une ligne par SKU : on ne peut pas décomposer la somme.
    // Mais « théorique UNION compté » puis trois jointures gauches, c'est ce
    // que fait un `full join` entre deux ensembles déjà uniques par SKU.
    for (const fn of ['rapport_resume', 'rapport_page']) {
      const code = derniereDefinition(fn).corps.replace(/^\s*--.*$/gm, '')
      expect(code, fn).toContain('full join theo ts on ts.sku = l.s')
      expect(code, fn).not.toContain('univers as (')
    }
  })

  it('⚠️ le filtre d’inventaire est posé AVANT la jointure complète', () => {
    // Dans un `full join`, une condition du `on` ne filtre pas : elle décide
    // seulement de l'appariement, et les lignes des AUTRES inventaires
    // ressortent du côté externe. Essayé : 800 156 lignes au lieu de 400 000.
    for (const fn of ['rapport_resume', 'rapport_page']) {
      const code = derniereDefinition(fn).corps.replace(/^\s*--.*$/gm, '')
      expect(code, fn).toMatch(
        /theo as \(\s*select t\.sku, t\.theoretical_qty\s*from public\.theoretical_stock t\s*where t\.session_id = p_session_id/,
      )
      // Et jamais la forme piégeuse.
      expect(code, fn).not.toContain('full join public.theoretical_stock')
    }
  })

  it('⚠️ l’anneau des écarts se départage à égalité', () => {
    // Trouvé en prouvant l'équivalence : deux inventaires à 0,00 € d'écart
    // sortaient dans un ordre différent d'une exécution à l'autre. Sur une
    // liste qui n'en garde que cinq, la cinquième part changeait
    // d'inventaire. Défaut antérieur à la réécriture ; même règle que la
    // pagination — un ordre doit être TOTAL.
    const code = derniereDefinition('tableau_de_bord_superviseur').corps.replace(/^\s*--.*$/gm, '')
    expect(code).toContain('order by abs(ps.ecart_valeur) desc, f.id')
    expect(code).toContain('order by abs(m.ecart_valeur) desc, m.store_id')
    expect(code).not.toMatch(/order by abs\(ps\.ecart_valeur\) desc\)/)
  })

  it('les trois fonctions reposent leurs droits, anon nommément', () => {
    // `create or replace` rend EXECUTE à PUBLIC — le constat n°6 du 28 août,
    // qui se reproduit à chaque redéfinition.
    for (const fn of ['tableau_de_bord_superviseur', 'rapport_resume', 'rapport_page']) {
      const fichier = fichierDe(fn)
      expect(fichier, fn).toContain(`revoke all on function public.${fn}(`)
      expect(fichier, fn).toMatch(/from public, anon/)
      expect(fichier, fn).toContain('to authenticated, service_role')
    }
  })
})
