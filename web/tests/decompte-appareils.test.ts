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
  // ⚠️ CHAQUE FONCTION EST LUE DANS SON PROPRE FICHIER. Une garde qui lisait
  // « le fichier de `prendre_place_appareil` » pour y chercher les droits des
  // trois autres est devenue fausse à la première migration qui redéfinit
  // celle-là seule. `fichierDe` répond « la dernière définition », pas « la
  // migration d'origine » — c'est tout son intérêt, encore faut-il l'appeler
  // par fonction.

  it('aucune des fonctions n’est ouverte à anon', () => {
    const fns: [string, string][] = [
      ['prendre_place_appareil', 'prendre_place_appareil(uuid, text)'],
      ['rendre_place_appareil', 'rendre_place_appareil(uuid, text)'],
      ['appareils_du_magasin', 'appareils_du_magasin(uuid)'],
      ['plafond_appareils', 'plafond_appareils(uuid)'],
      ['prevenir_forfait_trop_juste', 'prevenir_forfait_trop_juste(uuid, integer, integer)'],
    ]
    for (const [fn, signature] of fns) {
      expect(fichierDe(fn)).toContain(`revoke all on function public.${signature} from public, anon`)
    }
  })

  it('les deux fonctions internes sont injoignables même connecté', () => {
    // Les autres sont SECURITY DEFINER : elles n'ont pas besoin de ce droit.
    for (const s of ['plafond_appareils(uuid)', 'prevenir_forfait_trop_juste(uuid, integer, integer)']) {
      const f = fichierDe(s.split('(')[0])
      expect(f).toContain(`revoke all on function public.${s} from public, anon, authenticated`)
      expect(f).toContain(`grant execute on function public.${s} to service_role`)
      expect(f).not.toContain(`grant execute on function public.${s} to authenticated`)
    }
  })

  it('les deux tables portent la RLS et n’ont aucune policy', () => {
    const fichier = fichierDe('appareils_du_magasin')
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
    expect(p?.action).toBe('Passer à 120 appareils')
    // Le prix vient de la grille, jamais d'une addition faite sur place.
    expect(p?.mois).toBe(890 + 2 * SUPPLEMENT.mois)
    expect(p?.an).toBe(9450 + 2 * SUPPLEMENT.an)
  })

  it('le bouton dit toujours « Passer à … »', () => {
    // Décision de Julien : un seul verbe. « Ajouter 20 appareils » décrivait
    // un geste différent des autres boutons pour exactement la même chose.
    for (const [plafond, besoin] of [[2, 7], [2, 40], [20, 40], [100, 112], [100, 250]]) {
      expect(proposer(plafond, besoin)?.action).toMatch(/^Passer à /)
    }
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

describe('la console Quantinvo', () => {
  it('lit tous les magasins d’une entreprise en un seul appel', () => {
    // Une boucle d'appels par magasin serait le motif retiré partout ailleurs
    // pour la tenue en charge.
    const { corps } = derniereDefinition('appareils_des_magasins')
    expect(corps).toContain('jsonb_agg')
    expect(corps).toContain('where s.company_id = p_company_id')
    const console_ = lire('web/app/admin/entreprise/[companyId]/page.tsx')
    expect(console_).toContain("supabase.rpc('appareils_des_magasins'")
  })

  it('la garde est celle de l’entreprise', () => {
    const { corps } = derniereDefinition('appareils_des_magasins')
    expect(corps).toContain('public.is_admin() or public.is_company_admin(p_company_id)')
    expect(fichierDe('appareils_des_magasins'))
      .toContain('revoke all on function public.appareils_des_magasins(uuid) from public, anon')
  })

  it('elle ne rend pas le pic — il ne dit plus rien', () => {
    // Depuis que le verrou ferme la porte, le pic ne peut plus dépasser le
    // plafond. Le rendre inviterait à s'en servir.
    const { corps } = derniereDefinition('appareils_des_magasins')
    expect(corps).not.toContain("'pic'")
  })

  it('la ligne est en lecture seule — on n’envoie plus de devis', () => {
    const console_ = lire('web/app/admin/entreprise/[companyId]/page.tsx')
    const i = console_.indexOf('function AppareilsMagasin')
    expect(i).toBeGreaterThan(0)
    const bloc = sansCommentaires(console_.slice(i, i + 1400))
    expect(bloc).not.toMatch(/<button|<Link|devis/i)
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

describe('le forfait trop juste se dit au client', () => {
  it('la cloche accepte le type AUX DEUX FILTRES', () => {
    // ⚠️ Leçon du 3 septembre 2026, payée en direct : la contrainte ET la
    // liste blanche de `mes_notifications`. Un seul des deux suffit à rendre
    // la cloche muette sans le moindre message d'erreur.
    const fichier = fichierDe('prevenir_forfait_trop_juste')
    expect(fichier).toContain("'forfait_trop_juste'::text")
    expect(derniereDefinition('mes_notifications').corps).toContain("'forfait_trop_juste'")
  })

  it('elle ne part qu’une fois par magasin et par mois', () => {
    const { corps } = derniereDefinition('prevenir_forfait_trop_juste')
    // Un appareil éconduit redemande sa place toutes les trente secondes.
    expect(corps).toContain("interval '30 days'")
    expect(corps).toContain("type = 'forfait_trop_juste'")
  })

  it('elle ne va qu’à l’administrateur d’entreprise', () => {
    // Un superviseur ne décide pas de la licence, un compteur encore moins.
    const { corps } = derniereDefinition('prevenir_forfait_trop_juste')
    expect(corps).toContain('p.is_company_admin')
  })

  it('elle porte des nombres, jamais un nom d’offre', () => {
    // L'échelle des paliers vit dans `web/lib/offres.ts` et nulle part
    // ailleurs : la figer en base en ferait une quatrième copie.
    const { corps } = derniereDefinition('prevenir_forfait_trop_juste')
    expect(corps).toContain("'forfait', p_plafond::text")
    expect(corps).toContain("'besoin', p_besoin::text")
    expect(corps).not.toMatch(/Essential|Advanced|Enterprise/)
  })

  it('une cloche cassée ne désactive pas le verrou', () => {
    // `usePlaceAppareil` accorde sur toute erreur (borne 3) : une exception
    // ici ferait tomber le verrou en silence.
    const { corps } = derniereDefinition('prendre_place_appareil')
    const i = corps.indexOf('prevenir_forfait_trop_juste')
    expect(i).toBeGreaterThan(0)
    expect(corps.slice(i, i + 200)).toContain('exception when others')
  })

  it('le rang de la cloche déduit l’offre, il ne la lit pas', () => {
    const cloche = lire('web/components/Notifications.tsx')
    expect(cloche).toContain("case 'forfait_trop_juste'")
    expect(cloche).toContain('proposer(')
    // ⚠️ Le libellé NOMME l'offre : « Découvrir » seul ne dit pas quoi, et une
    // invitation sans objet ne fait pas agir.
    expect(cloche).toContain('`Découvrir ${offre.nom}`')
  })

  it('une bannière double la cloche, en haut à droite', () => {
    // La cloche attend qu'on l'ouvre — or un forfait trop juste est
    // précisément ce qu'on ne va pas chercher : on ne sait pas encore qu'il y
    // a quelque chose à savoir. (Julien, 4 septembre 2026.)
    const cloche = lire('web/components/Notifications.tsx')
    const css = lire('web/app/globals.css')
    expect(cloche).toContain('function AvisForfait')
    expect(cloche).toContain("n.type === 'forfait_trop_juste' && !n.lu")
    expect(css).toContain('.avis-forfait {')
    expect(css).toMatch(/\.avis-forfait \{[^}]*top: 16px; right: 16px/)
  })

  it('la bannière ne se sert d’aucun appel supplémentaire', () => {
    // Elle vit dans le composant de la cloche pour cette seule raison : la
    // liste est déjà chargée. Un second `mes_notifications` par page serait du
    // bruit pur.
    const cloche = lire('web/components/Notifications.tsx')
    expect(cloche.match(/rpc\('mes_notifications'\)/g)?.length ?? 0).toBe(1)
  })

  it('elle ne revient pas d’une page à l’autre, mais un avis neuf s’affiche', () => {
    const cloche = lire('web/components/Notifications.tsx')
    // La clé porte l'identifiant : sans lui, le premier refus de l'année
    // ferait taire tous les suivants.
    expect(cloche).toContain('`avis-forfait-${notif.id}`')
    // ⚠️ `sessionStorage` lève en navigation privée : sans garde, la bannière
    // ferait tomber la cloche entière.
    expect(cloche).toMatch(/try \{ if \(sessionStorage/)
  })

  it('l’appel à l’action porte le dessin des autres boutons', () => {
    // Une pastille en contour se lisait comme une étiquette et n'incitait à
    // rien (constat de Julien, 4 septembre 2026).
    const cloche = lire('web/components/Notifications.tsx')
    expect(cloche).toContain('className="btn btn-primary btn-sm notif-cta"')
  })

  it('… mais reste un span, jamais un bouton dans un bouton', () => {
    // Le rang entier est déjà un bouton : un <button> imbriqué serait du HTML
    // invalide, et deux cibles pour un seul geste se disputeraient le clic.
    const cloche = lire('web/components/Notifications.tsx')
    const i = cloche.indexOf('btn btn-primary btn-sm notif-cta')
    expect(cloche.slice(i - 40, i)).toContain('<span')
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

  it('l’écran de refus ne vend rien', () => {
    // Il s'ouvre devant un compteur, debout dans un rayon. La proposition
    // commerciale est sur le site, pour qui paie.
    //
    // ⚠️ AMENDÉE LE 5 SEPTEMBRE 2026, ET RECENTRÉE SUR SON INTENTION. Elle
    // refusait le mot « offre » — qui était alors, forcément, le début d'une
    // vente. Depuis que « offre » a remplacé « forfait » PARTOUT (décision de
    // Julien sur la maquette), c'est aussi le nom de ce que le magasin a déjà
    // payé : « L'offre de ce magasin couvre 2 appareils » est un constat, pas
    // une proposition. Ce qu'on interdit ici, ce sont donc les prix, les noms
    // de palier et les verbes d'achat — pas un mot devenu du vocabulaire
    // courant. Ne pas l'affaiblir davantage : chacun de ces motifs a été
    // vérifié en défaut.
    const i = scanner.indexOf("place.etat === 'refusee'")
    expect(i).toBeGreaterThan(0)
    const bloc = sansCommentaires(scanner.slice(i, i + 2500))
    expect(bloc).not.toMatch(/€|Essential|Advanced|Enterprise/i)
    expect(bloc).not.toMatch(/passer à|souscri|découvrir|changer d’offre|tarif/i)
    expect(bloc).toContain('Réessayer')
    // ⚠️ ET IL NOMME L'ADMINISTRATEUR, PAS « VOTRE RESPONSABLE » (Julien,
    // 4 septembre 2026, l'écran sous les yeux depuis un compte de superviseur) :
    // « votre responsable » sonne faux à qui est déjà le responsable du
    // magasin. Élargir un forfait est le geste de l'administrateur.
    expect(bloc).toContain('administrateur')
    expect(bloc).not.toContain('Votre responsable')
  })
})

describe('une alerte s’éteint quand le geste qui la règle est fait', () => {
  it('l’ambre des refus suit le verdict, pas le compte', () => {
    // ⚠️ Les refus restent trente jours. Après un passage à l'offre
    // supérieure, la tuile serait restée ambre un mois durant pour un problème
    // résolu — et une alerte qui persiste après le geste qui la règle est une
    // alerte qu'on cesse de lire. Même famille que « un zéro ne porte aucune
    // couleur » (29 août 2026).
    const fiche = readFileSync(
      path.resolve(__dirname, '../app/magasins/[storeId]/page.tsx'), 'utf8')
    expect(fiche).toContain("tone={verdict.etat === 'depasse' ? 'warn' : 'neutral'}")
    expect(fiche).not.toContain("tone={appareils.refus > 0 ? 'warn' : 'neutral'}")
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CHANGER D'OFFRE SANS AVOIR ÉTÉ REFUSÉ (5 septembre 2026)
// ---------------------------------------------------------------------------
// Constat de Julien : « sur le site je ne vois nulle part où je peux upgrade
// mon abonnement ». Le panneau de paiement n'existait que sous
// `verdict.etat === 'depasse'` : il fallait s'être heurté au verrou pour avoir
// le droit d'acheter. On n'avait construit que le chemin de la RÉACTION, et
// jamais celui de l'ANTICIPATION — qui est pourtant le cas normal.
// ═══════════════════════════════════════════════════════════════════════════
describe('changer d’offre ne demande pas d’avoir été refusé', () => {
  const fiche = lire('web/app/magasins/[storeId]/page.tsx')
  const panneau = lire('web/components/PayerEnLigne.tsx')

  it('le panneau est rendu hors de la branche « dépassé »', () => {
    // La seule condition est qu'aucun changement n'attende déjà son paiement.
    expect(fiche).toContain('{!offreEnCours && (\n            <ChangerOffre')
    // ⚠️ Et il n'est PAS enfermé dans la condition du bandeau d'alerte : c'est
    // exactement le défaut qu'on corrige. Le bandeau, lui, la garde.
    const i = fiche.indexOf('<ChangerOffre')
    const j = fiche.indexOf("verdict.etat === 'depasse' && verdict.proposition")
    expect(j).toBeGreaterThan(0)
    expect(i).toBeGreaterThan(j)
  })

  it('il ne se propose pas par-dessus un paiement en attente', () => {
    // Proposer d'acheter ce qu'on est en train d'acheter n'a pas de sens — et
    // le serveur le refuserait (`deja_en_cours`). Le bandeau au-dessus porte
    // alors les deux sorties : reprendre, ou annuler.
    expect(sansCommentaires(fiche)).toContain('{!offreEnCours && (')
  })

  it('il ne recopie aucun montant : la grille reste dans lib/offres', () => {
    const i = panneau.indexOf('export function ChangerOffre')
    expect(i).toBeGreaterThan(0)
    const bloc = sansCommentaires(panneau.slice(i))
    // Le prix vient de `proposer()`, jamais d'une addition faite sur place.
    expect(bloc).toContain('proposer(0, devices)')
    for (const o of OFFRES) {
      expect(bloc).not.toContain(String(o.mois))
      expect(bloc).not.toContain(String(o.an))
    }
  })

  it('il passe par la fonction edge, sans repli sur une RPC directe', () => {
    // ⚠️ Règle de `/souscrire` : sans la fonction edge il n'y a pas de session
    // Stripe, donc rien à payer. Déposer la demande quand même laisserait
    // quelqu'un persuadé d'avoir souscrit.
    const i = panneau.indexOf('export function ChangerOffre')
    const bloc = sansCommentaires(panneau.slice(i))
    expect(bloc).not.toContain("rpc('deposer_changement_offre')")
    // Il compose le panneau de paiement existant plutôt que d'en écrire un
    // second : deux chemins de paiement divergeraient au premier ajustement.
    expect(bloc).toContain('<PayerEnLigne')
  })

  it('la saisie qui ne changerait rien se dit AVANT le clic', () => {
    const i = panneau.indexOf('export function ChangerOffre')
    const bloc = sansCommentaires(panneau.slice(i))
    expect(bloc).toContain('devices <= plafond')
  })
})

describe('le lien qu’on envoie tombe sur la section', () => {
  it('la section porte l’ancre', () => {
    expect(lire('web/app/magasins/[storeId]/page.tsx'))
      .toContain('<section className="admin-section" id="appareils">')
  })

  it('l’e-mail et la cloche la visent', () => {
    // « Le changement se fait en ligne, depuis la fiche du magasin » : le lien
    // doit poser le lecteur sur la section, pas en haut d'une fiche où il faut
    // ensuite chercher.
    expect(lire('supabase/functions/alerte-anomalies/index.ts'))
      .toContain('/magasins/${f.session_id}#appareils')
    expect(lire('web/components/Notifications.tsx'))
      .toContain('/magasins/${d.store_id}#appareils')
  })
})

describe('on écrit « offre », jamais « forfait »', () => {
  // Décision de Julien le 5 septembre 2026, sur la maquette : « change le mot
  // forfait par autre chose ». « Assiette » était déjà interdit — c'est notre
  // mot de facturation ; « forfait » faisait un second nom pour ce que la page
  // Tarifs appelle une offre, et deux mots pour la même chose dans la même
  // carte font douter qu'il s'agisse de la même chose.
  //
  // ⚠️ LES CLÉS NE BOUGENT PAS : `forfait_trop_juste` est une valeur de la
  // base (contrainte de `notifications` ET liste blanche de
  // `mes_notifications`), `forfait_plein` un code de refus du serveur, et
  // `dans_le_forfait` un identifiant d'état. Ce sont des identifiants, pas du
  // texte.
  const cles = /forfait_trop_juste|forfait_plein|sans_forfait|dans_le_forfait|avis-forfait|AvisForfait|d\.forfait|'forfait'|nature !== 'forfait'|e-mail forfait|alerte forfait|forfaits/
  const ecrans = [
    'web/app/magasins/[storeId]/page.tsx',
    'web/components/PayerEnLigne.tsx',
    'web/components/Notifications.tsx',
    'web/lib/appareils.ts',
    'web/lib/journal.ts',
    'web/app/admin/entreprise/[companyId]/page.tsx',
    'supabase/functions/alerte-anomalies/index.ts',
    'supabase/functions/stripe-webhook/index.ts',
    'supabase/functions/libre-service/index.ts',
    'src/components/scanner.tsx',
  ]

  for (const f of ecrans) {
    it(`${f} n’affiche plus le mot`, () => {
      for (const ligne of sansCommentaires(lire(f)).split('\n')) {
        if (!/orfait/i.test(ligne)) continue
        expect(ligne, `${f} : ${ligne.trim()}`).toMatch(cles)
      }
    })
  }
})

describe('la tuile instantanée a disparu', () => {
  it('la fiche ne compte plus les appareils « en ce moment »', () => {
    // Elle vaut zéro dès que personne ne scanne — donc la plupart du temps
    // quand on ouvre la page — et ce qu'elle mesurait vraiment (le magasin
    // tient-il dans son offre) est dans les deux tuiles qui restent.
    const fiche = sansCommentaires(lire('web/app/magasins/[storeId]/page.tsx'))
    expect(fiche).not.toContain('En train de compter')
    expect(fiche).not.toContain('appareils.maintenant')
  })
})

describe('les deux phrases qui vivent en base disent « offre »', () => {
  // ⚠️ Elles auraient survécu au renommage sans que rien ne le signale : ce
  // sont des textes que le client lit, mais ils ne sont dans aucun écran.
  it('le refus sous le bouton', () => {
    const { corps } = derniereDefinition('deposer_changement_offre')
    expect(corps).toContain("'Votre offre couvre déjà '")
    expect(sansCommentaires(corps)).not.toContain('Votre forfait couvre')
  })

  it('la ligne qui part dans l’e-mail d’alerte', () => {
    const { corps } = derniereDefinition('anomalies_a_signaler')
    expect(corps).toContain("l''offre en couvre")
    expect(sansCommentaires(corps)).not.toContain('le forfait en couvre')
  })

  it('et le helper retrouve bien une migration écrite en majuscules', () => {
    // ⚠️ `pg_get_functiondef` rend « CREATE OR REPLACE FUNCTION ». Repartir de
    // la base est le moyen le plus sûr de ne réécrire QUE la phrase visée —
    // encore faut-il que la garde voie la migration qui en sort.
    const source = readFileSync(path.resolve(__dirname, 'migrations.ts'), 'utf8')
    expect(source).toContain("'gi')")
  })
})
