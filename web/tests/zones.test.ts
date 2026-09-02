import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  codeRange, ecartLigne, groupByName, sortCodes, UNNAMED, validateRange,
  type BaliseLigne, type ZoneDashboardRow,
} from '@/lib/zones'
import { ACTIONS } from '@/lib/journal'
import { derniereDefinition, fichierDe } from './migrations'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

function zone(partial: Partial<ZoneDashboardRow> & { code: string }): ZoneDashboardRow {
  return {
    id: `id-${partial.code}`,
    name: null,
    count_status: 'pending',
    audit_status: 'pending',
    count_units: 0,
    count_lines: 0,
    count_units_autres: 0,
    count_lines_autres: 0,
    audit_units_autres: 0,
    audit_lines_autres: 0,
    audit_units: 0,
    audit_lines: 0,
    ...partial,
  }
}

describe('sortCodes', () => {
  it('trie numériquement, pas alphabétiquement', () => {
    // Un tri alphabétique placerait « 10 » avant « 2 » : sur une liste de
    // balises à retrouver en magasin, c'est illisible.
    expect(sortCodes(['10', '2', '1'])).toEqual(['1', '2', '10'])
  })

  it('range les codes non numériques après, par ordre alphabétique', () => {
    expect(sortCodes(['B', '3', 'A', '1'])).toEqual(['1', '3', 'A', 'B'])
  })
})

describe('codeRange', () => {
  it('résume une plage contiguë', () => {
    expect(codeRange(['1', '2', '3'])).toBe('1 → 3')
  })

  it('signale les trous plutôt que de faire croire à une plage pleine', () => {
    expect(codeRange(['1', '2', '9'])).toBe('1 → 9 (3)')
  })

  it('gère un code unique et la liste vide', () => {
    expect(codeRange(['7'])).toBe('7')
    expect(codeRange([])).toBe('—')
  })
})

describe('groupByName', () => {
  const rows = [
    zone({ code: '1', name: 'Réserve', count_status: 'done', audit_status: 'done' }),
    zone({ code: '2', name: 'Réserve', count_status: 'done' }),
    zone({ code: '3', name: 'Réserve' }),
    zone({ code: '10', name: 'Surface de vente', count_status: 'done' }),
    zone({ code: '4' }),
  ]

  it('regroupe les balises par emplacement et compte les deux cycles', () => {
    const groups = groupByName(rows)
    const reserve = groups.find(g => g.name === 'Réserve')!
    expect(reserve.total).toBe(3)
    expect(reserve.counted).toBe(2)
    expect(reserve.audited).toBe(1)
    expect(reserve.codes).toEqual(['1', '2', '3'])
  })

  it('rassemble les balises sans emplacement sous un libellé identifiable', () => {
    const groups = groupByName(rows)
    const orphans = groups.find(g => g.name === UNNAMED)!
    expect(orphans.total).toBe(1)
    expect(orphans.unnamed).toBe(true)
  })

  it('trie les emplacements par nom', () => {
    expect(groupByName(rows).map(g => g.name))
      .toEqual([UNNAMED, 'Réserve', 'Surface de vente'])
  })
})

describe('validateRange', () => {
  it('accepte une plage valide', () => {
    expect(validateRange('Réserve', '1', '10')).toBeNull()
  })

  it('exige un nom d’emplacement', () => {
    expect(validateRange('  ', '1', '10')).toMatch(/nom de l/i)
  })

  it('refuse une plage inversée', () => {
    expect(validateRange('Réserve', '10', '1')).toMatch(/inférieure/i)
  })

  it('refuse les bornes vides ou non entières', () => {
    expect(validateRange('Réserve', '', '10')).toMatch(/première et la dernière/i)
    expect(validateRange('Réserve', '1,5', '10')).toMatch(/première et la dernière/i)
  })

  it('applique la même limite que le serveur', () => {
    expect(validateRange('Réserve', '1', '2000')).toBeNull()
    expect(validateRange('Réserve', '1', '2001')).toMatch(/trop grande/i)
  })
})

// ── Le détail d'une balise (2 septembre 2026) ───────────────────────────────
//
// Demande de Julien : « je veux pouvoir cliquer sur le numéro de balise et voir
// ce qui a été compté dessus ». La fenêtre existait, elle ne disait pas ce
// qu'il y avait dedans.

function ligne(p: Partial<BaliseLigne> & { sku: string }): BaliseLigne {
  return {
    ean: null, brand: '', label: '',
    counted_qty: 0, audited_qty: 0, final_qty: null, audit_status: 'done',
    ...p,
  }
}

describe('l’écart d’une ligne de balise', () => {
  it('ne se calcule pas tant que l’audit de la balise n’est pas clôturé', () => {
    // ⚠️ Le cœur de la règle : une quantité auditée à zéro ne distingue pas
    // « l'auditeur n'a rien trouvé » de « l'auditeur n'est pas encore passé ».
    // Afficher −4 ici accuserait quelqu'un à tort.
    expect(ecartLigne(ligne({ sku: 'A', counted_qty: 4, audited_qty: 0, audit_status: 'open' }))).toBeNull()
    expect(ecartLigne(ligne({ sku: 'A', counted_qty: 4, audited_qty: 0, audit_status: 'pending' }))).toBeNull()
  })

  it('se calcule une fois l’audit clôturé, dans les deux sens', () => {
    expect(ecartLigne(ligne({ sku: 'A', counted_qty: 4, audited_qty: 1 }))).toBe(-3)
    expect(ecartLigne(ligne({ sku: 'A', counted_qty: 1, audited_qty: 3 }))).toBe(2)
    expect(ecartLigne(ligne({ sku: 'A', counted_qty: 2, audited_qty: 2 }))).toBe(0)
    // Audit clôturé et rien trouvé : là, le zéro veut bien dire quelque chose.
    expect(ecartLigne(ligne({ sku: 'A', counted_qty: 4, audited_qty: 0 }))).toBe(-4)
  })

  it('se tait quand la ligne a été arbitrée', () => {
    // La quantité retenue remplace la comparaison : c'est elle qui fera foi au
    // rapport, une soustraction à côté ne dirait plus rien.
    expect(ecartLigne(ligne({ sku: 'A', counted_qty: 4, audited_qty: 1, final_qty: 3 }))).toBeNull()
  })
})

describe('le serveur borne le détail à une balise', () => {
  const detail = derniereDefinition('get_balise_detail').corps
  const vider = derniereDefinition('vider_balise').corps

  it('ne descend jamais le détail de l’inventaire entier', () => {
    // Le motif retiré en août 2026 pour la tenue en charge : `getSessionDetail`
    // rend toutes les balises. Ici la requête est filtrée sur celle demandée.
    expect(detail).toContain('norm_balise(coalesce(c.zone, \'\')) = v_key')
    expect(detail).toContain('can_access_session')
  })

  it('écarte les références ramenées à zéro', () => {
    // `counts` est en ajout pur : un article scanné puis entièrement corrigé a
    // des lignes et zéro pièce. Même filtre que `get_session_detail`.
    expect(detail).toContain("coalesce(cnt.qty, 0) <> 0 or coalesce(aud.qty, 0) <> 0")
  })

  it('ne calcule pas l’écart côté serveur', () => {
    // Il rend les deux quantités et le statut de l'audit ; c'est l'écran qui
    // décide s'il peut soustraire (voir `ecartLigne`).
    expect(detail).toContain('audit_status')
    expect(detail).not.toMatch(/audited_qty\s*-\s*counted_qty|counted_qty\s*-\s*audited_qty/)
  })
})

describe('vider une balise', () => {
  const vider = derniereDefinition('vider_balise').corps

  it('reste bornée à UNE balise, nommée', () => {
    // ⚠️ C'est ce qui la distingue de la policy retirée par VR-007 : le
    // périmètre est fixé par le serveur, pas par un filtre que le client
    // choisit. Ne jamais l'élargir à une liste ni à un critère libre.
    expect(vider).toContain('p_code text')
    expect(vider).not.toMatch(/p_codes|text\[\]/)
  })

  it('efface les comptages ET les audits, puis remet la balise à faire', () => {
    expect(vider).toContain('delete from public.counts')
    expect(vider).toContain('delete from public.article_audit')
    expect(vider).toContain("count_status = 'pending'")
    expect(vider).toContain("audit_status = 'pending'")
    expect(vider).toContain('count_done_at = null')
  })

  it('laisse une trace — c’est l’aggravation relevée par VR-007', () => {
    expect(vider).toContain('company_audit_log')
    expect(vider).toContain("'balise_videe'")
  })

  it('refuse un inventaire clôturé et un non-superviseur', () => {
    // Le rapport d'un inventaire clôturé est sorti, souvent exporté.
    expect(vider).toContain("s.status <> 'closed'")
    expect(vider).toContain('can_access_session')
  })

  it('n’est ouverte ni à anon ni à public', () => {
    const fichier = fichierDe('vider_balise')
    expect(fichier).toMatch(/revoke all on function public\.vider_balise\(uuid, text\) from public, anon/)
    expect(fichier).toMatch(/grant execute on function public\.vider_balise\(uuid, text\) to authenticated/)
  })
})

describe('l’écran de la balise', () => {
  const ecran = lire('../components/dashboard/BaliseDetail.tsx')
  const nu = ecran.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('ne propose plus de rouvrir depuis le site', () => {
    // Décision de Julien : rouvrir est un geste de terrain, qui n'a de sens que
    // sur le téléphone de la personne qui va recompter.
    expect(nu).not.toMatch(/setBalise\([^)]*true\)/)
    expect(nu).toContain('Pour rouvrir, passez par l’application')
  })

  it('nomme les deux clôtures par ce qu’elles font', () => {
    expect(nu).toContain('Marquer comptée')
    expect(nu).toContain('Marquer auditée')
  })

  it('exige la recopie du numéro avant de vider', () => {
    // Le bouton est à quelques centimètres de « Marquer comptée » et efface le
    // travail de toute l'équipe sur ce rayon.
    expect(nu).toMatch(/requireText: z\.code/)
    expect(nu).toContain("tone: 'danger'")
  })

  it('a un libellé de journal pour l’action qu’il déclenche', () => {
    // Sans lui, /journal afficherait le mot technique brut.
    expect(ACTIONS.balise_videe).toBeTypeOf('function')
  })
})

// ── Clôturer un audit que personne n'a fait (2 septembre 2026) ──────────────
//
// Constat de Julien : « marquer auditée alors qu'il n'y a pas de quantité
// auditée doit prendre le compte d'origine, c'est-à-dire celui du compteur ».
// Sans cela, ranger un audit jamais fait déclarait l'écart calculable et
// sortait toute la balise à moins la totalité du comptage — une démarque
// intégrale fabriquée par un clic de rangement.
describe('clôturer l’audit d’une balise', () => {
  const fn = derniereDefinition('cloturer_audit_balise').corps

  it('reprend le comptage quand la balise n’a AUCUNE ligne d’audit', () => {
    expect(fn).toContain('c.pass_number = 2')
    expect(fn).toContain('insert into public.counts')
    // La reprise écrit de la passe 2 à partir de la passe 1.
    expect(fn).toMatch(/select p_session_id, c\.sku, 2, sum\(c\.qty\)/)
    expect(fn).toContain('c.pass_number = 1')
  })

  it('ne reprend jamais référence par référence', () => {
    // ⚠️ La garde qui protège la démarque : un auditeur passé qui n'a PAS
    // retrouvé un article compté est exactement ce que l'inventaire révèle.
    // La condition porte sur la balise entière (`not exists`), pas sur le SKU.
    const bloc = fn.slice(fn.indexOf('if not exists'), fn.indexOf('get diagnostics'))
    expect(bloc).toContain('not exists')
    expect(bloc).not.toMatch(/c2?\.sku\s*=\s*\w+\.sku/)
  })

  it('écarte une référence ramenée à zéro', () => {
    expect(fn).toContain('having sum(c.qty) > 0')
  })

  it('attribue la reprise au superviseur qui la déclenche', () => {
    // Le rapport doit pouvoir nommer qui a pris cette responsabilité.
    expect(fn).toContain('auth.uid()')
  })

  it('recalcule article_audit, qui est dérivée de counts', () => {
    // Poser `final_qty` à la main serait défait au premier recalcul.
    expect(fn).toContain('recompute_session_audit')
  })

  it('refuse un inventaire clôturé et un non-superviseur', () => {
    expect(fn).toContain("s.status <> 'closed'")
    expect(fn).toContain('can_access_session')
  })

  it('n’est ouverte ni à anon ni à public', () => {
    const fichier = fichierDe('cloturer_audit_balise')
    expect(fichier).toMatch(/revoke all on function public\.cloturer_audit_balise\(uuid, text\) from public, anon/)
  })
})

describe('« Marquer auditée » sur l’écran', () => {
  const ecran = lire('../components/dashboard/BaliseDetail.tsx')
  const nu = ecran.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('n’appelle plus setBalise en mode audit', () => {
    expect(nu).toContain('cloturerAuditBalise(sessionId, z.code)')
    expect(nu).not.toMatch(/setBalise\([^)]*'audit'/)
  })

  it('prévient avant de reprendre le comptage', () => {
    // Ce n'est plus un simple changement d'état : des lignes sont écrites.
    expect(nu).toContain('z.audit_lines === 0')
    expect(nu).toContain('Reprendre le comptage')
  })

  it('« Marquer comptée » reste un simple changement d’état', () => {
    expect(nu).toMatch(/setBalise\(sessionId, z\.code, 'count', false\)/)
  })
})
