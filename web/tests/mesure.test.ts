import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  lireUsage, compteursLisibles, aRevoir, ecartTotalEuros,
  phraseConstat, LIBELLES, type MagasinUsage,
} from '@/lib/mesure'

const magasin = (p: Partial<MagasinUsage>): MagasinUsage => ({
  id: 'm', name: 'Magasin', units: null, sqm: null, annual_price_cents: null,
  inventaires: 0, plancher: null, compteurs: 0, lignes: 0, dernier: null, ...p,
})

describe('la règle d’asymétrie', () => {
  it('conclut quand le plancher dépasse la borne de la tranche', () => {
    // 47 300 pièces comptées en un seul inventaire pour une licence Boutique
    // (jusqu'à 10 000) : on ne compte pas ce qu'on n'a pas.
    const l = lireUsage(magasin({ units: 9_000, plancher: 47_300 }))
    expect(l.etat).toBe('au-dela')
    expect(l.payee?.profil).toBe('Boutique')
    expect(l.due?.profil).toBe('Magasin')
    expect(l.ecartEuros).toBe(4_200 - 2_100)
  })

  it('ne conclut RIEN quand le plancher est en dessous', () => {
    // Un inventaire tournant ne couvre qu'un rayon : un plancher bas n'est pas
    // une preuve d'honnêteté, seulement une absence de mesure.
    const l = lireUsage(magasin({ units: 200_000, plancher: 12_000 }))
    expect(l.etat).toBe('rien-a-signaler')
    expect(l.ecartEuros).toBeNull()
    expect(l.due).toBeNull()
  })

  it('ne dit jamais « conforme » ni « cohérent »', () => {
    // Ces deux mots affirmeraient une vérification qui n'a pas eu lieu, et
    // feraient renouveler un contrat sur une impression fausse.
    const mots = Object.values(LIBELLES).join(' ').toLowerCase()
    expect(mots).toContain('rien à signaler')
    expect(mots).not.toContain('conforme')
    expect(mots).not.toContain('cohérent')
    expect(mots).not.toContain('vérifié')
  })

  it('pile sur la borne ne dépasse pas', () => {
    expect(lireUsage(magasin({ units: 9_000, plancher: 10_000 })).etat).toBe('rien-a-signaler')
    expect(lireUsage(magasin({ units: 9_000, plancher: 10_001 })).etat).toBe('au-dela')
  })
})

describe('ce qu’on ne peut pas lire', () => {
  it('sans volume déclaré, il n’y a pas de terme de comparaison', () => {
    // C'est un manque à combler, pas une absence de mesure : le magasin a été
    // créé à la main, ou le rattrapage n'a pas trouvé sa demande d'origine.
    const l = lireUsage(magasin({ units: null, plancher: 500_000 }))
    expect(l.etat).toBe('volume-inconnu')
    expect(l.ecartEuros).toBeNull()
  })

  it('sans inventaire, rien n’est mesurable — et ce n’est pas une alerte', () => {
    // Un magasin qui ne compte pas suit son rythme. Ces lignes ont été retirées
    // de « À traiter » le 22 août 2026, la règle vaut ici aussi.
    expect(lireUsage(magasin({ units: 40_000, plancher: null })).etat).toBe('pas-mesurable')
    expect(lireUsage(magasin({ units: 40_000, plancher: 0 })).etat).toBe('pas-mesurable')
  })

  it('la dernière tranche n’a pas de borne, donc rien ne la dépasse', () => {
    // Au-delà d'un million le prix est sur devis : annoncer un écart chiffré
    // serait inventer un montant.
    const l = lireUsage(magasin({ units: 2_000_000, plancher: 5_000_000 }))
    expect(l.etat).toBe('rien-a-signaler')
    expect(l.ecartEuros).toBeNull()
  })
})

describe('les compteurs détachés', () => {
  it('distingue « personne n’a compté » de « on ne sait plus qui »', () => {
    // `counts.counted_by` passe à NULL à la suppression d'un compte (migration
    // 20260818000001). Afficher « 0 » ferait croire que personne n'a compté.
    expect(compteursLisibles(magasin({ compteurs: 3, lignes: 200 }))).toBe(3)
    expect(compteursLisibles(magasin({ compteurs: 0, lignes: 200 }))).toBeNull()
    expect(compteursLisibles(magasin({ compteurs: 0, lignes: 0 }))).toBe(0)
  })
})

describe('le constat', () => {
  const parc = [
    magasin({ id: 'a', name: 'Maison Blanc Paris 8', units: 9_000, plancher: 47_300 }),
    magasin({ id: 'b', name: 'Nord Roubaix', units: 45_000, plancher: 68_900 }),
    magasin({ id: 'c', name: 'Alltricks Vélizy', units: 180_000, plancher: 142_000 }),
  ]

  it('ne retient que ce qui appelle un geste, le plus gros écart d’abord', () => {
    const liste = aRevoir(parc)
    expect(liste.map((m) => m.id)).toEqual(['b', 'a'])
    expect(ecartTotalEuros(parc)).toBe(2_400 + 2_100)
  })

  it('nomme les magasins au lieu d’annoncer un nombre', () => {
    // « deux magasins » obligerait à ouvrir le tableau pour savoir lesquels.
    const p = phraseConstat(parc) ?? ''
    expect(p).toContain('Nord Roubaix')
    expect(p).toContain('Maison Blanc Paris 8')
    // Le séparateur de milliers français est une espace insécable étroite : on
    // reconstruit l'attendu au lieu de le taper, sinon le test échoue sur un
    // caractère invisible.
    expect(p).toContain(`${(4_500).toLocaleString('fr-FR')} €`)
  })

  it('se tait quand il n’y a rien à dire', () => {
    expect(phraseConstat([parc[2]])).toBeNull()
    expect(phraseConstat([])).toBeNull()
    expect(ecartTotalEuros([])).toBe(0)
  })

  it('accorde le verbe au nombre de magasins', () => {
    expect(phraseConstat([parc[0]])).toContain('a compté')
    expect(phraseConstat(parc)).toContain('ont compté')
  })
})

describe('la RPC ne rend que des faits', () => {
  const migration = readFileSync(
    join(process.cwd(), '..', 'supabase', 'migrations', '20260823140001_usage_constate.sql'),
    'utf8',
  )
  const debut = migration.indexOf('function public.admin_usage_overview')
  // Le corps s'arrête au `$$;` de clôture : au-delà vivent les GRANT et le
  // `comment on function`, qui parle légitimement de tranches sans en faire.
  const corps = migration.slice(debut, migration.indexOf('$$;', debut) + 3)
  const bloc = migration.slice(debut)

  it('est en lecture seule et gardée par is_admin', () => {
    expect(corps).toContain('stable security definer')
    expect(corps).toContain('if not public.is_admin() then raise exception')
    for (const ecriture of ['insert into', 'update public.', 'delete from']) {
      expect(corps.toLowerCase()).not.toContain(ecriture)
    }
  })

  it('prend le plus gros inventaire, jamais la somme de l’année', () => {
    // Un magasin compte son stock plusieurs fois par an — les additionner ne
    // voudrait rien dire. C'est le constat de Julien du 23 août 2026.
    expect(corps).toContain('max(pieces)')
    expect(corps).not.toContain('sum(pieces)')
  })

  it('ne compte que la passe 1, pour ne pas additionner l’audit', () => {
    expect(corps).toContain('filter (where c.pass_number = 1)')
  })

  it('n’est pas ouverte à anon', () => {
    expect(bloc).toContain('revoke all on function public.admin_usage_overview(uuid) from public, anon')
  })

  it('sert tout le parc sans dédoubler sa signature', () => {
    // Ajouter un paramètre aurait créé une SECONDE fonction et rendu un appel
    // à un argument ambigu — le piège de `ca_request_store`, puis
    // d'`admin_add_store` le matin même. `p_company_id` accepte simplement nul.
    const parc = readFileSync(
      join(process.cwd(), '..', 'supabase', 'migrations', '20260823150001_usage_tout_le_parc.sql'),
      'utf8',
    )
    expect(parc).toContain('admin_usage_overview(p_company_id uuid default null)')
    expect(parc).not.toContain('drop function')
    // Chaque magasin porte son entreprise : sans elle le filtre de la page
    // n'aurait rien sur quoi s'appuyer, et une liste longue ne se lirait pas.
    expect(parc).toContain("'company_name'")
    // Le filtre est optionnel des deux côtés — sinon `null` ne rendrait rien.
    expect(parc).toContain('p_company_id is null or s.company_id = p_company_id')
    expect(parc).toContain('p_company_id is null or st.company_id = p_company_id')
  })

  it('le jugement ne descend pas en SQL', () => {
    // Les seuils et le vocabulaire vivent dans lib/mesure.ts, testable sans
    // base. Une comparaison de tranche en SQL les figerait en deux endroits.
    for (const mot of ['Rien à signaler', 'Au-delà', 'tranche']) {
      expect(corps).not.toContain(mot)
    }
  })
})

describe('les deux écrans', () => {
  const page = readFileSync(join(process.cwd(), 'app', 'admin', 'usage', 'page.tsx'), 'utf8')
  const section = readFileSync(
    join(process.cwd(), 'components', 'admin', 'UsageConstate.tsx'), 'utf8',
  )
  const shell = readFileSync(join(process.cwd(), 'components', 'AppShell.tsx'), 'utf8')

  /** Les deux fichiers portent l'interdiction EN COMMENTAIRE : sans ce
   *  nettoyage, le test attrape la consigne au lieu du code. */
  const sansCommentaires = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('n’écrivent jamais le verdict à la main', () => {
    // Le vocabulaire vit dans LIBELLES, pour qu'un mot ne puisse pas dériver
    // d'un écran à l'autre — et surtout pour que la règle d'asymétrie ne se
    // perde pas en route.
    for (const source of [page, section]) {
      const code = sansCommentaires(source)
      expect(code).toContain('LIBELLES')
      expect(code).not.toContain('Conforme')
      expect(code).not.toContain('Cohérent')
    }
  })

  it('la page du parc a son onglet dans la console', () => {
    // Sans entrée de navigation, elle n'existe que pour qui connaît l'adresse.
    expect(shell).toContain("{ href: '/admin/usage', label: 'Usage' }")
  })

  it('la page du parc lit tout le parc, pas une entreprise', () => {
    expect(page).toContain('p_company_id: null')
  })

  it('la section de la fiche lit une seule entreprise', () => {
    expect(section).toContain('p_company_id: companyId')
  })
})
