// Le rapport consolidé d'un magasin (4 septembre 2026)
//
// Julien : « Commence d'abord par le rapport par magasin, qui sera également
// consultable par l'admin entreprise en plus de admin Quantinvo. »
//
// Ces gardes tiennent les quatre décisions qui portent le chantier, et qui ne
// se devinent ni dans le SQL ni dans le JSX :
//
//  1. l'accès est réservé à l'administrateur d'entreprise et à Quantinvo — un
//     superviseur n'a pas à lire le rapport du secteur de son collègue ;
//  2. seuls les inventaires CLÔTURÉS entrent dans le total, et c'est le
//     serveur qui le décide, pas la case cochée ;
//  3. les quantités s'additionnent, et le rapport le SIGNALE ;
//  4. le périmètre est confronté au magasin visé, et il est borné.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition, fichierDe } from './migrations'
import {
  buildStoreDetailRows, buildStoreVarianceRows, storeReportFilename,
} from '@/lib/report'
import type { LigneDetailMagasin, LigneRapportMagasin } from '@/lib/rapportMagasin'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

/** ⚠️ Une garde qui vérifie une ABSENCE lit le code SANS ses commentaires :
 *  ces fichiers racontent la décision, donc ils citent ce qu'ils n'emploient
 *  pas. Le piège s'est présenté six fois sur ce projet. */
const sansCommentaires = (src: string) =>
  src
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('--'))
    .join('\n')

const AGREGATS = ['rapport_magasin_resume', 'rapport_magasin_page', 'rapport_magasin_detail'] as const
const TOUTES = ['rapport_magasin_inventaires', ...AGREGATS] as const

describe('qui peut lire le rapport d’un magasin', () => {
  it('les quatre fonctions passent par la même garde', () => {
    for (const fn of TOUTES) {
      expect(sansCommentaires(derniereDefinition(fn).corps), fn)
        .toContain('public.peut_lire_rapport_magasin(p_store_id)')
    }
  })

  // ⚠️ La garde nomme les deux autorités, et rien d'autre. Un superviseur —
  // même participant, même créateur de l'inventaire — n'y figure pas : c'est
  // toute la décision de Julien.
  it('et cette garde ne connaît que l’admin d’entreprise et Quantinvo', () => {
    const def = sansCommentaires(derniereDefinition('peut_lire_rapport_magasin').corps)
    expect(def).toContain('public.is_admin()')
    expect(def).toContain('public.is_company_admin(s.company_id)')
    // Le cloisonnement passe par l'entreprise DU MAGASIN, jamais par un
    // paramètre de l'appelant — même règle que `ca_store_detail`.
    expect(def).toContain('from public.stores s')
    expect(def).not.toContain('is_session_participant')
    expect(def).not.toContain('can_access_session')
  })

  // ⚠️ Ce n'est PAS une surface cliente : les quatre fonctions qui l'appellent
  // sont SECURITY DEFINER, elles n'ont pas besoin de ce droit.
  it('la garde elle-même n’est joignable par aucun client', () => {
    const fichier = fichierDe('peut_lire_rapport_magasin')
    expect(fichier).toContain(
      'revoke all on function public.peut_lire_rapport_magasin(uuid) from public, anon, authenticated',
    )
    expect(fichier).not.toMatch(
      /grant execute on function public\.peut_lire_rapport_magasin\(uuid\) to [^;]*authenticated/,
    )
  })

  // ⚠️ `create` rend EXECUTE à PUBLIC *et* à `anon` (droits par défaut de
  // Supabase) : le `revoke` vise les deux. Constat n°6 du 28 août 2026, qui se
  // reproduit à chaque fonction nouvelle.
  it('et aucune des quatre n’est ouverte à anon', () => {
    for (const fn of TOUTES) {
      const fichier = fichierDe(fn)
      const revoke = new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`)
      const grant = new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated, service_role`)
      expect(fichier, fn).toMatch(revoke)
      expect(fichier, fn).toMatch(grant)
    }
  })
})

describe('le périmètre est fixé par le serveur', () => {
  // ⚠️ SEULS LES CLÔTURÉS. Un inventaire en cours ferait bouger le rapport
  // d'heure en heure ; on le liste, on ne l'additionne pas. La règle est en
  // base, pas dans la case cochée.
  it('seuls les inventaires clôturés sont additionnés', () => {
    for (const fn of AGREGATS) {
      const def = sansCommentaires(derniereDefinition(fn).corps)
      expect(def, fn).toContain("s.status = 'closed'")
      expect(def, fn).toContain('s.store_id = p_store_id')
    }
  })

  // Un identifiant d'ailleurs n'est pas refusé, il est absent du résultat —
  // et la liste est bornée : une liste sans borne est une invitation.
  it('la liste d’inventaires est bornée à 200', () => {
    for (const fn of AGREGATS) {
      expect(sansCommentaires(derniereDefinition(fn).corps), fn)
        .toContain("(coalesce(p_sessions, '{}'::uuid[]))[1:200]")
    }
  })

  it('et une page ne dépasse jamais 5 000 lignes', () => {
    for (const fn of ['rapport_magasin_page', 'rapport_magasin_detail'] as const) {
      expect(sansCommentaires(derniereDefinition(fn).corps), fn).toContain('5000)')
    }
  })

  // ⚠️ ORDRE TOTAL. Sans départage, une même valeur change de place d'une page
  // à l'autre : on voit une ligne deux fois et une autre jamais.
  it('le tri se départage toujours', () => {
    expect(sansCommentaires(derniereDefinition('rapport_magasin_page').corps))
      .toMatch(/desc nulls last,\s*\n\s*f\.sku\s*\n\s*offset/)
    expect(sansCommentaires(derniereDefinition('rapport_magasin_detail').corps))
      .toContain('order by s.numero, p.sku')
  })

  // ⚠️ Dans un `full join`, une condition posée dans le `on` ne filtre pas :
  // elle décide de l'appariement, et les lignes des AUTRES inventaires
  // ressortent du côté externe. Le filtre vient donc de la jointure sur
  // `sess`, en amont. Piège payé le 4 septembre 2026 (800 156 lignes au lieu
  // de 400 000).
  it('le filtre d’inventaire précède la jointure externe', () => {
    for (const fn of ['rapport_magasin_page', 'rapport_magasin_detail'] as const) {
      const def = sansCommentaires(derniereDefinition(fn).corps)
      expect(def, fn).toContain('join sess on sess.id = a.session_id')
      expect(def, fn).toContain('join sess on sess.id = t.session_id')
      expect(def, fn).toContain('full join theo th\n        on th.session_id = c.session_id and th.sku = c.sku')
    }
  })

  // Le SQL ne se fabrique jamais à partir d'un paramètre, et le périmètre ne
  // s'élargit pas à un filtre libre : ce sont des lectures, mais la règle du
  // projet vaut aussi pour elles.
  it('aucun SQL n’est fabriqué à partir d’un paramètre', () => {
    for (const fn of TOUTES) {
      const def = sansCommentaires(derniereDefinition(fn).corps)
      expect(def, fn).not.toContain('execute ')
      expect(def, fn).not.toContain('format(')
    }
  })
})

describe('les doublons s’additionnent, et se disent', () => {
  it('le résumé compte les références vues dans plusieurs inventaires', () => {
    const def = sansCommentaires(derniereDefinition('rapport_magasin_resume').corps)
    expect(def).toContain('select count(*) from univers where n > 1')
  })

  it('et le tableau porte le nombre d’inventaires par référence', () => {
    const def = sansCommentaires(derniereDefinition('rapport_magasin_page').corps)
    expect(def).toContain('count(*)                                        as r_inv')
    expect(def).toContain('k.r_inv > 1')
  })

  const page = () => lire('../app/magasins/[storeId]/rapport/page.tsx')

  it('l’écran signale les doublons et sait ne montrer qu’elles', () => {
    const src = page()
    expect(src).toContain('additionnées')
    expect(src).toContain('Ne voir que celles-ci')
    expect(src).toContain('Voir toutes les références')
  })

  // Un filtre qui survivrait à la disparition des doublons laisserait un
  // tableau vide sans rien pour l'expliquer.
  it('et le filtre ne survit pas à la disparition des doublons', () => {
    expect(sansCommentaires(page()))
      .toContain('if (multi && resume && resume.doublons === 0) setMulti(false)')
  })
})

describe('l’écran du rapport de magasin', () => {
  const page = () => lire('../app/magasins/[storeId]/rapport/page.tsx')

  it('n’est atteignable que par les deux autorités', () => {
    expect(sansCommentaires(page()))
      .toContain('if (!guard.profile.is_company_admin && !guard.profile.is_admin)')
  })

  // ⚠️ Un zéro se lit comme un résultat. Constat de Julien le 3 septembre
  // 2026 : « c'est juste écrit 0 écart, si le client n'attend pas, il pourrait
  // crier victoire alors qu'en réalité ça load ».
  it('n’écrit jamais 0 tant que les totaux ne sont pas calculés', () => {
    const src = sansCommentaires(page())
    expect(src).toContain("resume ? fmtQty(resume.theorique) : '—'")
    expect(src).toContain("resume ? fmtSigned(resume.ecart_unites) : '—'")
    expect(src).toContain('chargement-note')
  })

  // Sur un écran de 14 pouces, cinquante lignes passent sous le pli.
  it('rend les boutons de page en haut comme en bas', () => {
    const src = page()
    expect(src.match(/<Pagination/g)?.length).toBe(2)
    expect(src).toContain('useRetourEnHaut')
  })

  it('et les deux portes du rapport existent', () => {
    expect(lire('../app/magasins/[storeId]/page.tsx')).toContain('/rapport`')
    expect(lire('../app/admin/entreprise/[companyId]/page.tsx')).toContain('/rapport`')
  })
})

describe('le fichier remis au client', () => {
  const lignes: LigneRapportMagasin[] = [
    { sku: 'A1', ean: '3760112458903', brand: 'Sandro', label: 'Manteau laine',
      theoretical_qty: 42, counted_qty: 31, variance_units: -11, variance_value: -1683, inventaires: 2 },
    { sku: 'A2', ean: null, brand: '', label: 'Pull',
      theoretical_qty: 10, counted_qty: 12, variance_units: 2, variance_value: 40, inventaires: 1 },
  ]

  const detail: LigneDetailMagasin[] = [
    { inventaire: 'Niveau 1', numero: 'INV-1', cloture_le: '03/09/2026',
      sku: 'A1', ean: '3760112458903',
      brand: 'Sandro', label: 'Manteau laine',
      theoretical_qty: 20, counted_qty: 15, variance_units: -5, variance_value: -765 },
  ]

  // ⚠️ PAS DE COLONNE PRIX. Le prix est porté PAR INVENTAIRE : le même SKU
  // peut valoir 41 € en septembre et 38 € en août. Une colonne unique
  // obligerait à en inventer un — alors que la valeur, elle, reste juste,
  // calculée inventaire par inventaire puis additionnée.
  it('ne prétend pas connaître un prix unique par référence', () => {
    const colonnes = Object.keys(buildStoreVarianceRows(lignes)[0])
    expect(colonnes).not.toContain('Prix achat unitaire')
    // Le statut d'audit appartient à un inventaire, pas à un magasin.
    expect(colonnes).not.toContain('Statut')
    expect(colonnes).toContain('Inventaires')
  })

  it('totalise les écarts sur une dernière ligne', () => {
    const rows = buildStoreVarianceRows(lignes)
    expect(rows).toHaveLength(3)
    const total = rows[2]
    expect(total.SKU).toBe('TOTAL')
    expect(total['Écart (unités)']).toBe(-9)
    expect(total['Écart (valeur achat)']).toBe(-1643)
  })

  // ⚠️ Les quantités restent des NOMBRES : figées en texte, elles ne
  // s'additionneraient plus dans le tableur — sur la colonne même que le
  // rapport existe pour montrer.
  it('et les quantités restent des nombres', () => {
    const r = buildStoreVarianceRows(lignes)[0]
    expect(typeof r['Écart (unités)']).toBe('number')
    expect(typeof r['Écart (valeur achat)']).toBe('number')
  })

  // La contrepartie de l'addition : sans cette feuille, un écart sur une
  // référence vue dans trois inventaires ne se rattache à aucun rayon.
  it('la seconde feuille dit de quel inventaire vient chaque ligne, et de quand', () => {
    const colonnes = Object.keys(buildStoreDetailRows(detail)[0])
    expect(colonnes[0]).toBe('Inventaire')
    expect(colonnes[1]).toBe('N° inventaire')
    // ⚠️ Quand une référence revient dans trois lignes, c'est la date qui dit
    // laquelle est la plus récente (Julien, 4 septembre 2026).
    expect(colonnes[2]).toBe('Clôturé le')
    expect(buildStoreDetailRows(detail)[0]['Clôturé le']).toBe('03/09/2026')
  })

  // ⚠️ La date vient du SERVEUR, déjà formatée en Europe/Paris. Un horodatage
  // brut arriverait en UTC dans le tableur et daterait du 12 août un
  // inventaire clôturé le 13 à une heure du matin.
  it('et cette date est celle de la clôture, en heure de Paris', () => {
    const def = sansCommentaires(derniereDefinition('rapport_magasin_detail').corps)
    expect(def).toContain("to_char(s.closed_at at time zone 'Europe/Paris', 'DD/MM/YYYY')")
  })

  it('le nom du fichier porte le magasin et la date', () => {
    expect(storeReportFilename('La Samaritaine', 'xlsx', new Date('2026-09-04T10:00:00Z')))
      .toBe('rapport_magasin_la_samaritaine_2026-09-04.xlsx')
  })
})
