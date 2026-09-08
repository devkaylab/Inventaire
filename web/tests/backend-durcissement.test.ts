// Durcissement du backend — modélisation de menaces du 28 août 2026.
//
// Ces tests empêchent de défaire cinq constats trouvés en balayant les 127
// fonctions, les 38 policies et les déclencheurs par MOTIF de défaut plutôt
// que par lecture linéaire.
//
// Ce qu'ils gardent :
//   · VR-006 — un refus de devis ne peut plus écraser une acceptation ;
//   · VR-005 — quatre fonctions de la console ne franchissent plus deux fois
//     la même transition d'état ;
//   · VR-007 — un superviseur invité ne peut plus effacer les comptages
//     d'autrui, SANS perdre son droit d'arbitrer ;
//   · VR-008 — l'invariant de `profiles` ne se contourne plus par l'INSERT ;
//   · VR-009 — `join_code` n'est plus modifiable en droits de colonne.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { derniereDefinition, dossierMigrations, fichierDe } from './migrations'

const here = path.dirname(fileURLToPath(import.meta.url))

const toutesLesMigrations = readdirSync(dossierMigrations)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(path.join(dossierMigrations, f), 'utf8'))
  .join('\n')

describe('VR-006 · un refus n’écrase pas une acceptation', () => {
  const corps = derniereDefinition('decline_quote_by_token').corps

  it('verrouille la ligne avant de décider', () => {
    // Sans `for update`, le contrôle de statut n'est qu'une lecture : un accord
    // et un refus concurrents passent tous les deux, et le refus écrase.
    expect(corps.match(/for update;/g)?.length, 'les deux branches').toBe(2)
  })

  it('et garde ses deux UPDATE, comme sa jumelle', () => {
    // L'asymétrie avec `accept_quote_by_token` était le signe de l'oubli.
    expect(corps.match(/and status = 'quoted'/g)?.length).toBe(2)
    expect(derniereDefinition('accept_quote_by_token').corps).toContain("and status = 'quoted'")
  })
})

describe('VR-005 · la console ne crée pas en double', () => {
  // L'acteur est de confiance : ce n'est pas une attaque, c'est un double-clic
  // pendant que la réponse tarde.
  for (const fn of [
    'admin_fulfil_company_request',
    'admin_fulfil_store_request',
    'admin_fulfil_store_removal',
    'admin_quote_store_request',
  ]) {
    it(`${fn} verrouille sa lecture initiale`, () => {
      expect(derniereDefinition(fn).corps, fn).toContain('for update;')
    })
  }

  it('⚠️ le verrou suffit : chacune rejette déjà l’état d’arrivée', () => {
    // C'est ce qui distingue ce correctif de celui du webhook, où le contrôle
    // laissait passer et où il a fallu garder l'UPDATE en plus.
    expect(derniereDefinition('admin_fulfil_company_request').corps).toContain("v_req.status <> 'paid'")
    expect(derniereDefinition('admin_fulfil_store_removal').corps).toContain("v_req.status <> 'pending'")
  })
})

describe('VR-007 · les comptages ne s’effacent plus en masse', () => {
  it('la policy DELETE sur counts est retirée', () => {
    expect(toutesLesMigrations).toContain('drop policy if exists counts_delete_supervisor on public.counts')
  })

  it('⚠️ mais l’arbitrage reste : resolve_audit n’est pas touchée', () => {
    // Un superviseur invité supervise et arbitre — il ne peut ni clôturer ni
    // supprimer l'inventaire, mais il doit pouvoir trancher un écart.
    // `resolve_audit` est SECURITY DEFINER (hors RLS), donc gardée par
    // `can_access_session` et non par la policy retirée.
    expect(derniereDefinition('resolve_audit').corps).toContain('can_access_session')
  })

  it('⚠️ et plus aucun écran n’appelle delete_audit_line', () => {
    // Retiré des deux écrans le 29 août 2026 : « un écart d'audit est à
    // arbitrer, pas à supprimer » (Julien). La fonction reste en base — on
    // retire les appels d'abord, on supprime l'objet plus tard, règle du
    // projet — mais plus rien ne doit la rejoindre.
    for (const f of [
      '../lib/inventory.ts',
      '../components/dashboard/tabs/EcartsTab.tsx',
      '../../src/lib/queries.ts',
      '../../src/app/(supervisor)/[sessionId]/audits.tsx',
    ]) {
      // ⚠️ **Sans les commentaires.** Ces fichiers RACONTENT le retrait, donc
      // ils citent le nom de la fonction ; une garde qui lit le texte brut
      // échoue sur sa propre documentation. Piège déjà rencontré sur
      // `formulaires-publics.test.ts` et sur le comptage des `for update`.
      const code = readFileSync(path.join(here, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(code, f).not.toContain('delete_audit_line')
      expect(code, f).not.toContain('deleteAuditLine')
    }
  })

  it('⚠️ et counts reste en ajout pur : aucune policy UPDATE ne réapparaît', () => {
    // Une correction est une ligne négative. Une policy UPDATE contredirait le
    // principe sur lequel repose tout le rapport d'inventaire.
    expect(toutesLesMigrations).not.toMatch(/create policy \w*counts\w*update/i)
  })
})

describe('VR-008 et VR-009 · les permissions sans objet', () => {
  it('un client ne peut plus insérer son propre profil', () => {
    // `profiles_pin_privileged` est un déclencheur BEFORE UPDATE : il ne voyait
    // pas un INSERT. Même forme que VR-003, où un invariant posé sur un verbe
    // se contournait par un autre.
    expect(toutesLesMigrations).toContain('drop policy if exists profiles_insert on public.profiles')
  })

  it('join_code n’est plus modifiable', () => {
    // La révocation d'origine n'avait porté que sur SELECT.
    expect(toutesLesMigrations).toContain('revoke insert, update, references on public.stores from anon, authenticated')
    expect(toutesLesMigrations).toContain('revoke insert, update, references on public.companies from anon, authenticated')
  })
})

describe('les deux fonctions sœurs traitent la même erreur pareil', () => {
  // Elles servent LE MÊME geste à l'écran — `changerMagasins` route selon le
  // rôle. `ca_set_counter_stores` filtrait silencieusement un magasin étranger
  // là où sa jumelle refusait : l'action réussissait à moitié, avec moins de
  // magasins que cochés et rien pour le dire.
  const compteur = derniereDefinition('ca_set_counter_stores').corps
  const superviseur = derniereDefinition('ca_set_supervisor_stores').corps

  it('un magasin étranger est refusé des deux côtés', () => {
    const refus = "Un des magasins n''appartient pas à votre entreprise."
    expect(compteur, 'compteur').toContain(refus)
    expect(superviseur, 'superviseur').toContain(refus)
    // ⚠️ Et le filtre silencieux ne revient pas.
    expect(compteur).not.toContain('array_agg(st.id)')
  })

  it('⚠️ mais la liste vide reste acceptée pour un compteur', () => {
    // Un compteur sans magasin est un état normal — c'est ce qui a justifié
    // d'écrire cette fonction le 23 août, un compteur retiré de son dernier
    // magasin devenant invisible partout et donc irrécupérable. Un superviseur,
    // lui, garde toujours au moins un magasin. Ne pas « aligner » ça aussi.
    expect(superviseur).toContain('Un superviseur garde au moins un magasin')
    expect(compteur).not.toContain('garde au moins un magasin')
  })
})

/**
 * Deux fonctions mortes rendues injoignables (8 septembre 2026).
 *
 * Revue de sécurité d'avant publication. `ensure_zone` et `set_zone_status`
 * vérifiaient `get_my_role() = 'supervisor'` **OU** l'appartenance à la
 * session : la première branche suffit, et elle est vraie pour un superviseur
 * de N'IMPORTE QUELLE entreprise. Prouvé en direct, en transaction annulée —
 * une superviseure de Maison Oberlin a créé une balise dans un inventaire du
 * Groupe Bon Marché.
 *
 * ⚠️ Le correctif est un RETRAIT, pas un garde-fou : une fonction que personne
 * n'appelle et qui ouvre plus que nécessaire n'a pas besoin d'un contrôle,
 * elle a besoin d'être injoignable (leçon de `get_company_directory`).
 */
describe('les deux fonctions de zone des premiers jours sont injoignables', () => {
  const MORTES = ['ensure_zone', 'set_zone_status'] as const

  it('leurs droits sont retirés à anon ET à authenticated', () => {
    for (const fn of MORTES) {
      // ⚠️ Ancré en début de ligne : `toContain` trouverait la phrase jusque
      // dans un `-- revoke …` commenté (treizième variante de ce piège).
      expect(toutesLesMigrations).toMatch(
        new RegExp(`^revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`, 'm'),
      )
    }
  })

  /**
   * ⚠️ **C'est ce qui rend le retrait sûr, et il a été vérifié dans les trois
   * directions avant d'écrire la migration.** Le jour où un écran voudrait
   * l'une d'elles, ce test tombe — et il faudra alors lui écrire une vraie
   * garde, bornée à l'inventaire visé, plutôt que de rendre le droit.
   */
  it('et plus aucun écran ne les appelle', () => {
    const sources = [
      ...fichiersDe(path.join(here, '..', '..', 'src')),
      ...fichiersDe(path.join(here, '..', 'app')),
      ...fichiersDe(path.join(here, '..', 'lib')),
      ...fichiersDe(path.join(here, '..', 'components')),
      ...fichiersDe(path.join(here, '..', '..', 'supabase', 'functions')),
    ].filter((f) => !f.endsWith('database.types.ts'))
    for (const fn of MORTES) {
      const coupables = sources.filter((f) => readFileSync(f, 'utf8').includes(`'${fn}'`))
      expect(coupables, `${fn} est encore appelée par ${coupables.join(', ')}`).toHaveLength(0)
    }
  })
})

/** Tous les fichiers de code sous `dossier`, récursivement. */
function fichiersDe(dossier: string): string[] {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : fichiersDe(p)
    return /\.(ts|tsx)$/.test(e.name) ? [p] : []
  })
}

/**
 * Un inventaire clôturé n'appartient plus qu'à son créateur (8 septembre 2026).
 *
 * Décisions de Julien : *« une personne invitée à un inventaire qui a été
 * clôturé ne le voit plus »*, puis *« seul le créateur de l'inventaire peut le
 * clôturer »*. La seconde découle de la première : un invité qui clôture se
 * retirerait l'écran sous les doigts.
 */
describe('un inventaire clôturé n’appartient plus qu’à son créateur', () => {
  const participant = derniereDefinition('is_session_participant').corps
    // ⚠️ Sans les commentaires : la fonction explique la règle, donc elle en
    // cite les mots. Quatorzième variante de ce piège sur ce dépôt.
    .replace(/--.*$/gm, '')

  it('la branche de l’invité s’éteint à la clôture, les deux autres non', () => {
    expect(participant).toMatch(/status <> 'closed'\s+and exists/)
    // ⚠️ Le créateur et l'administrateur d'entreprise gardent tout : le second
    // voit tout ce qui appartient à son entreprise depuis le 22 août, et le
    // rapport consolidé d'un magasin — qui additionne des inventaires
    // CLÔTURÉS — passe par lui. Les leur retirer viderait cet écran.
    expect(participant).toContain('s.created_by = auth.uid()')
    expect(participant).toContain('public.is_company_admin(s.company_id)')
    // La condition ne doit pas coiffer les trois branches.
    expect(participant).not.toMatch(/and s\.status <> 'closed'\s*\)?\s*;?\s*$/m)
  })

  it('et les droits sont reposés — `create or replace` les rend à PUBLIC', () => {
    const fichier = fichierDe('is_session_participant')
    expect(fichier).toMatch(/^revoke all on function public\.is_session_participant\(uuid\) from public, anon/m)
    expect(fichier).toMatch(/^grant execute on function public\.is_session_participant\(uuid\)/m)
  })

  /**
   * ⚠️ Les compteurs ont leur PROPRE policy, qui teste `session_members` en
   * direct : sans ce second geste, un compteur aurait continué de voir dans sa
   * liste un inventaire que plus personne ne lui ouvre.
   */
  it('les compteurs sont couverts par leur propre policy', () => {
    const m = toutesLesMigrations
    const i = m.lastIndexOf('create policy sessions_employee_select')
    expect(i).toBeGreaterThan(0)
    const policy = m.slice(i, m.indexOf(');', i))
    expect(policy).toContain("status <> 'closed'")
  })

  /**
   * ⚠️ **LA DISTINCTION SE FAIT PAR LE `WITH CHECK`, PAS PAR LE `USING`** —
   * c'est ce qui ferme la clôture SANS fermer « Commencer l'inventaire », qui
   * reste un geste de préparation ouvert à tout superviseur participant.
   */
  it('seul le créateur clôture, mais tout participant peut démarrer', () => {
    const m = toutesLesMigrations
    const i = m.lastIndexOf('create policy sessions_supervisor_update')
    expect(i).toBeGreaterThan(0)
    const policy = m.slice(i, m.indexOf('\n);', i))
    const [avant, apres] = policy.split('with check')
    expect(apres, 'le WITH CHECK doit porter la règle de clôture').toBeTruthy()
    for (const partie of [avant, apres]) {
      expect(partie).toMatch(/status <> 'closed' or created_by = auth\.uid\(\) or public\.is_company_admin\(company_id\)/)
    }
  })

  it('et les deux écrans ne proposent pas un geste que la base refuse', () => {
    const menu = readFileSync(path.join(here, '..', 'components', 'dashboard', 'SessionActionsMenu.tsx'), 'utf8')
    expect(menu).toMatch(/canReopen && \(!closed \|\| !archive\)/)
    const accueil = readFileSync(path.join(here, '..', '..', 'src', 'app', '(supervisor)', 'index.tsx'), 'utf8')
    expect(accueil).toContain('peutCloturer(item.session)')
  })
})
