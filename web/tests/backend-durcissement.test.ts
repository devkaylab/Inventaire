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
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { derniereDefinition, dossierMigrations } from './migrations'

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
