// Le décompte d'appareils — les gardes.
//
// La règle qu'elles défendent, arbitrée par Julien le 4 septembre 2026 : « on
// n'accepte ni magasin, ni appareil supplémentaires sans paiement ». Le
// plafond n'est pas indicatif, il ferme la porte — et ce sont ses trois bornes
// qui l'empêchent de casser un inventaire.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'
import { OFFRES, SUPPLEMENT, APPAREILS_MAX } from '../lib/offres'
import { lireAppareils, nomDuPalier, proposer, type AppareilsMagasin } from '../lib/appareils'

const racine = path.resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/** ⚠️ Une assertion d'ABSENCE lit le code sans ses commentaires : ceux-ci
 *  citent forcément ce qu'ils décrivent. Cinquième variante du même piège. */
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(--|\/\/).*$/gm, '')

const faits = (p: Partial<AppareilsMagasin>): AppareilsMagasin => ({
  plafond: null, maintenant: 0, pic: 0, pic_le: null,
  refus: 0, refus_le: null, besoin: 0, besoin_le: null, jours: 30, ...p,
})

describe('le verrou, en base', () => {
  it('refuse un appareil de plus quand le forfait est plein', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    expect(corps).toContain("'forfait_plein'")
    expect(corps).toContain('v_actifs >= v_plafond')
  })

  it('borne 1 — un appareil déjà là garde sa place avant tout comptage', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    const iDeja = corps.indexOf('into v_deja')
    const iCompte = corps.indexOf('v_actifs >= v_plafond')
    expect(iDeja).toBeGreaterThan(0)
    // La lecture « est-il déjà là » PRÉCÈDE la comparaison au plafond, et la
    // comparaison est gardée par `not v_deja` : un plafond abaissé
    // n'interrompt personne.
    expect(iDeja).toBeLessThan(iCompte)
    expect(corps).toContain('if not v_deja and v_plafond is not null then')
  })

  it('borne 3 — sans plafond connu, rien n’est refusé', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    expect(corps).toContain('v_plafond is not null')
    const { corps: plafond } = derniereDefinition('plafond_appareils')
    expect(plafond).toContain('return null')
  })

  it('sérialise les demandes concurrentes sur le magasin', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    // Sans le verrou de ligne, deux téléphones obtiennent la même dernière
    // place — le motif de VR-001, sur un autre objet.
    expect(sansCommentaires(corps)).toContain('for update')
  })

  it('ne compte un refus qu’une fois par appareil, jamais par tentative', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    // Un téléphone éconduit redemande toutes les trente secondes : sans cette
    // garde, « douze refus » voudrait dire « une personne a patienté ».
    expect(corps).toContain('if not v_refuse then')
    expect(corps).toContain('refuse = true')
  })

  it('un appareil refusé ne tient aucune place', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    // Les deux comptages du plafond excluent les refusés.
    const occurrences = corps.match(/store_id = v_store and not refuse/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(2)
  })

  it('le pic ne retient que ce qui a été accordé', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    // Le refus écrit `pic = 0` ; seul le chemin accordé écrit `v_actifs`.
    const iRefus = corps.indexOf("'forfait_plein'")
    const iPic = corps.indexOf('greatest(appareils_par_jour.pic')
    expect(iPic).toBeGreaterThan(iRefus)
  })

  it('la garde est l’appartenance à l’inventaire — un compteur passe', () => {
    for (const fn of ['prendre_place_appareil', 'rendre_place_appareil']) {
      expect(derniereDefinition(fn).corps).toContain('is_session_participant')
    }
  })

  it('la clé d’appareil est bornée et vérifiée', () => {
    const { corps } = derniereDefinition('prendre_place_appareil')
    expect(corps).toContain('length(v_cle) > 64')
    expect(corps).toContain("v_cle !~ '^[A-Za-z0-9._:-]+$'")
  })
})

describe('les droits', () => {
  const fichier = fichierDe('prendre_place_appareil')

  it('aucune des fonctions n’est ouverte à anon', () => {
    for (const fn of ['prendre_place_appareil(uuid, text)', 'rendre_place_appareil(uuid, text)',
                      'appareils_du_magasin(uuid)', 'plafond_appareils(uuid)']) {
      expect(fichier).toContain(`revoke all on function public.${fn} from public, anon`)
    }
  })

  it('le plafond est une fonction interne, injoignable même connecté', () => {
    // Les trois autres sont SECURITY DEFINER : elles n'ont pas besoin de ce droit.
    expect(fichier).toContain('revoke all on function public.plafond_appareils(uuid) from public, anon, authenticated')
    expect(fichier).toContain('grant execute on function public.plafond_appareils(uuid) to service_role')
    expect(fichier).not.toContain('grant execute on function public.plafond_appareils(uuid) to authenticated')
  })

  it('les deux tables portent la RLS et n’ont aucune policy', () => {
    for (const t of ['appareils_actifs', 'appareils_par_jour']) {
      expect(fichier).toContain(`alter table public.${t} enable row level security`)
    }
    expect(sansCommentaires(fichier)).not.toContain('create policy')
  })

  it('la lecture passe par la porte du rapport de magasin, pas par une garde recopiée', () => {
    const { corps } = derniereDefinition('appareils_du_magasin')
    expect(corps).toContain('peut_lire_rapport_magasin')
    // Une garde recopiée est une garde qui divergera (VR-006).
    expect(corps).not.toContain('is_company_admin(')
  })
})

describe('le ménage', () => {
  it('les deux tables sont purgées', () => {
    const { corps } = derniereDefinition('purge_expired_data')
    expect(corps).toContain('delete from public.appareils_actifs')
    expect(corps).toContain('delete from public.appareils_par_jour')
  })
})

describe('les paliers de la base suivent la grille du site', () => {
  it('les trois plafonds sont ceux d’`offres.ts`', () => {
    const { corps } = derniereDefinition('plafond_appareils')
    // ⚠️ Duplication assumée — le site et la base ne compilent pas ensemble.
    // Ce test est le remède : les deux bougent ensemble.
    for (const o of OFFRES) {
      expect(corps).toContain(`return ${o.max};`)
    }
    expect(corps).toContain(`return ${APPAREILS_MAX} + ${SUPPLEMENT.par} * ceil`)
  })

  it('le plafond est le HAUT du palier, pas le nombre devisé', () => {
    const { corps } = derniereDefinition('plafond_appareils')
    // Un client devisé sur 7 appareils paie Advanced : il a droit à 20.
    expect(corps).toContain(`if v_dec <= ${OFFRES[1].max}  then return ${OFFRES[1].max};`)
  })
})

describe('le jugement — quelle offre proposer', () => {
  it('propose l’offre qui COUVRE le besoin, pas le rang suivant', () => {
    // Arbitré par Julien : un magasin Essential dont le besoin monte à 40
    // passe directement à Enterprise. Advanced le laisserait au-dessus de son
    // forfait dès le lendemain.
    const p = proposer(2, 40)
    expect(p?.nom).toBe('Enterprise')
    expect(p?.action).toBe('Passer à Enterprise')
  })

  it('propose Advanced pour un besoin qui tient dans Advanced', () => {
    const p = proposer(2, 7)
    expect(p?.nom).toBe('Advanced')
    expect(p?.couvre).toBe(20)
    expect(p?.mois).toBe(310)
    expect(p?.an).toBe(3300)
  })

  it('au-delà d’Enterprise, ajoute des tranches de dix', () => {
    const p = proposer(100, 112)
    expect(p?.nom).toBe('Enterprise')
    expect(p?.tranches).toBe(2)
    expect(p?.couvre).toBe(120)
    expect(p?.action).toBe('Ajouter 20 appareils')
    // Le prix vient de la grille, jamais d'une addition faite sur place.
    expect(p?.mois).toBe(890 + 2 * SUPPLEMENT.mois)
    expect(p?.an).toBe(9450 + 2 * SUPPLEMENT.an)
  })

  it('ne propose rien quand le forfait couvre déjà le besoin', () => {
    expect(proposer(20, 20)).toBeNull()
    expect(proposer(20, 3)).toBeNull()
  })

  it('ne propose rien sans assiette connue', () => {
    expect(proposer(null, 40)).toBeNull()
    expect(lireAppareils(faits({ plafond: null, besoin: 40 })).etat).toBe('sans_forfait')
  })

  it('nomme le palier payé', () => {
    expect(nomDuPalier(2)).toBe('Essential')
    expect(nomDuPalier(20)).toBe('Advanced')
    expect(nomDuPalier(100)).toBe('Enterprise')
    expect(nomDuPalier(120)).toBe('Enterprise')
    expect(nomDuPalier(null)).toBeNull()
  })

  it('un dépassement se lit sur les REFUS, pas sur le pic', () => {
    // Depuis que le verrou mord, le pic ne peut plus dépasser le plafond.
    const v = lireAppareils(faits({ plafond: 2, pic: 2, refus: 5, besoin: 7 }))
    expect(v.etat).toBe('depasse')
    expect(v.proposition?.nom).toBe('Advanced')
  })
})

describe('l’écran de la fiche magasin', () => {
  const page = lire('web/app/magasins/[storeId]/page.tsx')

  it('lit le décompte et le jugement', () => {
    expect(page).toContain("supabase.rpc('appareils_du_magasin'")
    expect(page).toContain('lireAppareils(')
  })

  it('dit « jusqu’à », jamais « au moins »', () => {
    // ⚠️ `besoin` MAJORE : deux appareils refusés à deux heures d'écart s'y
    // additionnent alors qu'ils n'étaient pas simultanés. Le vrai besoin est
    // donc AU PLUS ce chiffre. La première version écrivait « au moins »,
    // c'est-à-dire l'inverse de la vérité.
    expect(page).toContain('il en aurait fallu jusqu’à')
    expect(sansCommentaires(page)).not.toContain('au moins')
  })

  it('n’écrit ni « pic » ni « assiette » au client', () => {
    // Julien, 4 septembre 2026 : « un pic signifie que ça va redescendre
    // après, donc pas d'intérêt de passer à la tranche supérieure ». Ce qui
    // appelle une décision, c'est le refus. Et « assiette » est notre mot de
    // facturation, pas celui du client — à l'écran on écrit « forfait ».
    const vu = sansCommentaires(page)
    expect(vu).not.toMatch(/\bpic\b/i)
    expect(vu).not.toMatch(/assiette/i)
  })

  it('la tuile du milieu compte les appareils refusés', () => {
    expect(page).toContain('Refusés')
    expect(page).toContain('nb(appareils.refus)')
  })

  it('un chiffre absent n’emporte pas la page', () => {
    // La fiche s'affiche sans le décompte ; la section se tait.
    expect(page).toContain('setAppareils(ap.error ? null :')
    expect(page).toContain('{appareils && (')
  })
})

describe('l’application', () => {
  const appareil = lire('src/lib/appareil.ts')
  const scanner = lire('src/components/scanner.tsx')

  it('l’identifiant vit dans le trousseau, pas dans le stockage effacé au signOut', () => {
    // `oublierCachesLocaux` balaie AsyncStorage à chaque déconnexion : un
    // identifiant rangé là changerait à chaque relève d'équipe, et un
    // téléphone partagé compterait pour deux appareils.
    expect(appareil).toContain('SecureStore.setItemAsync')
    expect(appareil).toContain('SecureStore.getItemAsync')
  })

  it('l’identifiant n’est relié à aucun compte', () => {
    const code = sansCommentaires(appareil)
    // On compte des appareils, jamais des personnes (constat E3).
    expect(code).not.toContain('user_id')
    expect(code).not.toMatch(/auth\.uid|profile\?\.id|useAuth/)
  })

  it('borne 3 — seul un refus explicite ferme la porte', () => {
    // Réseau coupé, serveur muet, code inconnu : on accorde. Un magasin en
    // réserve doit pouvoir compter.
    expect(appareil).toContain("r.code === 'forfait_plein'")
    expect(appareil).toContain("setEtat('accordee')")
    const code = sansCommentaires(appareil)
    // Le `catch` accorde, il ne refuse pas.
    expect(code).toMatch(/catch\s*\{[^}]*setEtat\('accordee'\)/)
  })

  it('la place est rendue au démontage', () => {
    expect(appareil).toContain('void rendrePlace(sessionId)')
  })

  it('la place ne se prend que sur l’écran qui compte', () => {
    // L'assiette est « les appareils qui comptent en même temps » : un
    // téléphone posé sur l'écran d'un inventaire ne compte pas.
    expect(scanner).toContain('usePlaceAppareil(sessionId, !amorceNecessaire)')
    for (const f of ['src/app/(supervisor)/[sessionId]/index.tsx', 'src/app/(employee)/[sessionId]/index.tsx']) {
      expect(sansCommentaires(lire(f))).not.toContain('usePlaceAppareil')
    }
  })

  it('l’écran de refus ne cite aucun prix', () => {
    // Il s'ouvre devant un compteur, debout dans un rayon. La proposition
    // commerciale est sur le site, pour qui paie.
    const i = scanner.indexOf("place.etat === 'refusee'")
    expect(i).toBeGreaterThan(0)
    const bloc = sansCommentaires(scanner.slice(i, i + 2500))
    expect(bloc).not.toMatch(/€|Essential|Advanced|Enterprise|offre/i)
    expect(bloc).toContain('Réessayer')
  })
})
