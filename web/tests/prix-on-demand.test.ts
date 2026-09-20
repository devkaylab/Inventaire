// Le prix On-Demand — la garde.
//
// Le produit tient sur une phrase : « le prix affiché est le prix payé, sans
// devis ». Trois choses doivent donc rester d'accord, et rien ne les tient
// ensemble tout seul :
//
//   · les réglages, qui vivent en base (`reglages_prix`) ;
//   · le tableau d'exemples de `docs/entreprise/on-demand/02-le-prix.md` ;
//   · les prix dessinés dans la maquette, que Julien a validés.
//
// ⚠️ CETTE GARDE NE CITE NI LES RÉGLAGES NI LES PRIX : elle lit les premiers
// dans la migration, les seconds dans le document, rejoue la chaîne, et compare.
// Changer un taux horaire sans reprendre le document fait tomber la garde —
// c'est exactement ce qu'on veut, parce que ce jour-là la maquette ment.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, dossierMigrations } from './migrations'
import { REGLAGES, DEPARTEMENTS_DESSERVIS, chaine as chaineAffichee } from '../lib/prixOnDemand'
import { devis as devisAffiche } from '../lib/prixOnDemand'

const racine = path.resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(--|\/\/).*$/gm, '')

/** Le SQL débarrassé des corps `$function$ … $function$`. */
const sansCorpsDeFonction = (t: string) =>
  t.replace(/\$function\$[\s\S]*?\$function\$/g, ' ').replace(/\$\$[\s\S]*?\$\$/g, ' ')

/** Tout le SQL du dépôt, dans l'ordre des migrations. */
function migrations(): { fichier: string; sql: string }[] {
  return readdirSync(dossierMigrations)
    .filter((f) => f.endsWith('.sql')).sort()
    .map((fichier) => ({
      fichier, sql: readFileSync(path.join(dossierMigrations, fichier), 'utf8'),
    }))
}

/**
 * Le fichier de migration qui pose la version de lancement des réglages.
 *
 * ⚠️ **CE N'EST PLUS CELUI QUI DÉFINIT `prix_mission`**, et c'est le genre de
 * lien qui casse sans bruit. La garde remontait à la migration du moteur pour
 * y lire l'`insert` des réglages — les deux vivaient dans le même fichier. Le
 * 20 septembre 2026, `20260920230001_a_la_carte` a redéfini le moteur sans
 * reposer de réglages : la garde a cherché un `insert` là où il n'y en a plus.
 * Elle cherche donc maintenant l'`insert` lui-même, où qu'il soit.
 */
function migrationDuPrix(): string {
  // ⚠️ **HORS CORPS DE FONCTION**, et c'est un piège qui s'est refermé le jour
  // même : `admin_poser_reglages_prix` contient elle aussi un
  // `insert into public.reglages_prix`, avec des `coalesce(...)` à la place
  // des valeurs. La garde l'a trouvé en premier et a lu `NaN` partout.
  const avec = migrations().filter((m) =>
    sansCorpsDeFonction(sansCommentaires(m.sql)).includes('insert into public.reglages_prix'))
  expect(avec.length, 'une migration doit poser les réglages').toBeGreaterThan(0)
  return sansCorpsDeFonction(avec[avec.length - 1].sql)
}

/**
 * Les défauts d'une colonne ajoutée par `alter table`, lus dans le SQL.
 *
 * ⚠️ Les réglages du logiciel seul ne sont pas dans l'`insert` de la version 1
 * — ils sont arrivés après, par `add column … default`. Les recopier ici en
 * ferait une troisième source de vérité.
 */
function defautColonne(colonne: string): number {
  const motif = new RegExp(
    `add column if not exists ${colonne}\\s+integer\\s+not null\\s+default\\s+(\\d+)`, 'i')
  for (const m of [...migrations()].reverse()) {
    const trouve = sansCommentaires(m.sql).match(motif)
    if (trouve) return Number(trouve[1])
  }
  throw new Error(`Aucune migration ne pose ${colonne}`)
}

type Reglages = {
  version: number
  tauxInventoriste: number
  tauxResponsable: number
  productivite: number
  dureeCibleMin: number
  fraisFixes: number
  margeCible: number
  margeMinimum: number
  tarifAppareil: number
  fraisFixesLogiciel: number
}

/** Les réglages, LUS dans l'`insert` de la migration — jamais recopiés ici. */
function reglages(): Reglages {
  const sql = sansCommentaires(migrationDuPrix())
  const i = sql.indexOf('insert into public.reglages_prix')
  expect(i, 'la migration doit poser une version de réglages').toBeGreaterThan(0)
  const bloc = sql.slice(i, sql.indexOf(';', i))
  const colonnes = bloc
    .slice(bloc.indexOf('(') + 1, bloc.indexOf(')'))
    .split(',')
    .map((c) => c.trim())
  const valeurs = bloc
    .slice(bloc.indexOf('values (') + 'values ('.length)
    .split(',')
    .map((v) => v.trim())

  const val = (nom: string) => {
    const k = colonnes.indexOf(nom)
    expect(k, `la colonne ${nom} doit être posée explicitement`).toBeGreaterThanOrEqual(0)
    return Number(valeurs[k])
  }
  return {
    version: val('version'),
    tauxInventoriste: val('taux_inventoriste_cents'),
    tauxResponsable: val('taux_responsable_cents'),
    productivite: val('productivite'),
    dureeCibleMin: val('duree_cible_minutes'),
    fraisFixes: val('frais_fixes_cents'),
    margeCible: val('marge_cible'),
    margeMinimum: val('marge_minimum'),
    tarifAppareil: defautColonne('tarif_appareil_cents'),
    fraisFixesLogiciel: defautColonne('frais_fixes_logiciel_cents'),
  }
}

/**
 * ⚠️ **LE TEST NE RÉIMPLÉMENTE PAS LA CHAÎNE, IL UTILISE CELLE DU SITE.** Une
 * troisième copie ici ferait passer la garde pendant que le site affiche autre
 * chose que la base — exactement ce contre quoi elle existe.
 */
function chaine(articles: number, r: Reglages, coefficient = 1) {
  expect(
    { productivite: r.productivite, duree: r.dureeCibleMin, resp: r.tauxResponsable },
    'les réglages du site doivent être ceux de la base',
  ).toEqual({
    productivite: REGLAGES.productivite,
    duree: REGLAGES.dureeCibleMinutes,
    resp: REGLAGES.tauxResponsableCents,
  })
  const c = chaineAffichee(articles, coefficient)
  return {
    inventoristes: c.inventoristes,
    responsable: c.responsable,
    minutes: c.dureeMinutes,
    equipe: c.equipeCents,
    cout: c.coutCents,
    prix: c.prixCents,
    marge: c.marge,
    remunerationInventoriste: c.remunerationInventoristeCents,
  }
}

type Exemple = {
  magasin: string; articles: number; inventoristes: number; responsable: boolean
  minutes: number; equipe: number; cout: number; prix: number
}

/** Le tableau d'exemples du document de conception, LU dans le document. */
function exemples(): Exemple[] {
  const doc = lire('docs/entreprise/on-demand/02-le-prix.md')
  const euros = (t: string) => Number(t.replace(/[^\d]/g, '')) * 100
  const lignes: Exemple[] = []
  for (const ligne of doc.split('\n')) {
    // | Magasin | 10 000 | 3 + 1 | 4 h 30 | 396 € | 442 € | **589 €** |
    // ⚠️ Les cellules d'argent sont prises entières puis nettoyées : la
    // dernière est en gras, et une expression qui exige « € » juste avant la
    // barre ne l'attrape pas.
    const m = ligne.match(
      /^\|([^|]+)\|([^|]+)\|\s*(\d+)\s*\+\s*(\d+)\s*\|\s*(\d+)\s*h\s*(\d+)\s*\|([^|]+)\|([^|]+)\|([^|]+)\|\s*$/,
    )
    if (!m) continue
    if (![m[7], m[8], m[9]].every((c) => c.includes('€'))) continue
    lignes.push({
      magasin: m[1].trim(),
      articles: Number(m[2].replace(/[^\d]/g, '')),
      inventoristes: Number(m[3]),
      responsable: Number(m[4]) > 0,
      minutes: Number(m[5]) * 60 + Number(m[6]),
      equipe: euros(m[7]),
      cout: euros(m[8]),
      prix: euros(m[9]),
    })
  }
  return lignes
}

describe('les réglages retombent sur les prix de la maquette', () => {
  const r = reglages()
  const tableau = exemples()

  it('le document porte bien les quatre magasins de la maquette', () => {
    // ⚠️ Si le tableau disparaît du document, la garde ne doit pas se taire :
    // elle passerait sur zéro ligne sans rien vérifier.
    expect(tableau.length).toBeGreaterThanOrEqual(4)
  })

  for (const e of tableau) {
    it(`${e.magasin} — ${e.articles} articles`, () => {
      const c = chaine(e.articles, r)
      expect(c.inventoristes, 'inventoristes').toBe(e.inventoristes)
      expect(c.responsable, 'responsable').toBe(e.responsable)
      expect(c.minutes, 'durée en minutes').toBe(e.minutes)
      expect(c.equipe, 'versé à l’équipe').toBe(e.equipe)
      expect(c.cout, 'coût').toBe(e.cout)
      expect(c.prix, 'prix affiché').toBe(e.prix)
      // La marge est un réglage, pas une variable : elle ressort identique
      // d'un magasin à l'autre, à l'arrondi à l'euro près.
      expect(Math.abs(c.marge - r.margeCible)).toBeLessThan(0.005)
      expect(c.marge).toBeGreaterThanOrEqual(r.margeMinimum)
    })
  }

  it('l’inventoriste touche la même chose sur les quatre', () => {
    // C'est ce qui rend sa rémunération annonçable avant qu'il accepte : elle
    // ne dépend que de la durée, jamais du prix payé par le client.
    const paies = new Set(tableau.map((e) => chaine(e.articles, r).remunerationInventoriste))
    expect(paies.size).toBe(1)
  })

  it('une réservation groupée additionne les quatre', () => {
    const total = tableau.reduce((s, e) => s + chaine(e.articles, r).prix, 0)
    const annonce = lire('docs/entreprise/on-demand/02-le-prix.md').match(
      /réservation groupée\s*:\s*\*\*([\d\s ]+)\s*€/,
    )
    expect(annonce, 'le document doit annoncer le total du groupe').toBeTruthy()
    expect(total).toBe(Number(annonce![1].replace(/[^\d]/g, '')) * 100)
  })
})

describe('les coefficients sont neutres au lancement', () => {
  /**
   * ⚠️ **ILS DOIVENT L'ÊTRE POUR QUE LA MAQUETTE SOIT VRAIE.** Le document de
   * conception annonce « Paris et petite couronne 1,10 », mais ses propres
   * exemples ne l'appliquent pas : Paris Rivoli y vaut 949 €, soit 712 ÷ 0,75,
   * sans coefficient. Avec le coefficient parisien ce serait 1 044 €, et les
   * quatre prix dessinés seraient faux. Les allumer est une décision de prix —
   * cette garde est là pour qu'elle soit prise, pas subie.
   */
  it('aucun coefficient ne s’écarte de 1,00', () => {
    const sql = sansCommentaires(migrationDuPrix())
    const i = sql.indexOf('insert into public.coefficients_prix')
    expect(i).toBeGreaterThan(0)
    const bloc = sql.slice(i, sql.indexOf(';', i))
    const valeurs = [...bloc.matchAll(/,\s*(\d+\.\d+)\s*\)/g)].map((m) => Number(m[1]))
    expect(valeurs.length).toBeGreaterThanOrEqual(6)
    for (const v of valeurs) expect(v).toBe(1)
  })

  it('les départements desservis ne sont pas majorés non plus', () => {
    const sql = sansCommentaires(migrationDuPrix())
    const i = sql.indexOf('insert into public.zones_desservies')
    const bloc = sql.slice(i, sql.indexOf(';', i))
    const valeurs = [...bloc.matchAll(/,\s*(\d+\.\d+)\s*\)/g)].map((m) => Number(m[1]))
    expect(valeurs.length).toBeGreaterThanOrEqual(10)
    for (const v of valeurs) expect(v).toBe(1)
  })
})

describe('le moteur, en base', () => {
  it('monte l’équipe à l’entier supérieur et la durée à la demi-heure', () => {
    const { corps } = derniereDefinition('prix_mission')
    const sql = sansCommentaires(corps)
    expect(sql).toMatch(/v_inv := ceil\(/)
    expect(sql).toMatch(/v_minutes := ceil\(/)
    // ⚠️ L'arrondi EST la marge de sécurité, et il n'en faut pas d'autre :
    // aucun pourcentage de prudence ne doit s'ajouter par-dessus.
    expect(sql).not.toMatch(/securite|coussin|\*\s*1\.[12]/i)
  })

  it('refuse plutôt que de servir sous la marge minimum', () => {
    const { corps } = derniereDefinition('prix_mission')
    expect(sansCommentaires(corps)).toContain("'marge_insuffisante'")
    expect(sansCommentaires(corps)).toContain('v_marge < r.marge_minimum')
  })

  it('refuse franchement hors zone, sans proposer de devis', () => {
    const { corps } = derniereDefinition('prix_mission')
    expect(sansCommentaires(corps)).toContain("'hors_zone'")
  })

  /**
   * ⚠️ Le moteur rend `cout_cents`, `marge_cents` et les rémunérations. Un
   * client qui l'appellerait saurait au centime ce que Quantinvo gagne sur son
   * inventaire, et ce que touche l'inventoriste qui est chez lui.
   */
  it('n’est pas appelable depuis un navigateur de client', () => {
    const sql = migrationDuPrix()
    expect(sql).toMatch(/revoke all on function public\.prix_mission\([^)]*\)\s*\n?\s*from public, anon, authenticated;/)
    expect(sql).not.toMatch(/grant execute on function public\.prix_mission\([^)]*\)\s*\n?\s*to [^;]*authenticated/)
  })

  it('la porte du tunnel ne rend ni coût ni marge', () => {
    const { corps } = derniereDefinition('devis_mission')
    const retour = corps.slice(corps.lastIndexOf('return jsonb_build_object'))
    for (const interdit of ['cout_cents', 'marge_cents', 'equipe_cents', 'remuneration']) {
      expect(retour, `« ${interdit} » ne sort pas par le devis`).not.toContain(interdit)
    }
    expect(retour).toContain('prix_cents')
  })

  /**
   * ⚠️ Un changement de réglage ne touche jamais une mission déjà réservée :
   * sinon « le prix affiché est le prix payé » ne veut plus rien dire.
   */
  it('le prix d’une mission réservée est figé en base', () => {
    const { corps } = derniereDefinition('missions_figer_le_prix')
    const sql = sansCommentaires(corps)
    expect(sql).toContain('prix_cents is distinct from old.prix_cents')
    // Le dimensionnement aussi : une équipe rabotée après coup, c'est le même
    // mensonge par un autre chemin.
    expect(sql).toContain('inventoristes is distinct from old.inventoristes')
    expect(sql).toContain('raise exception')
  })
})

describe('le doublon d’affichage suit celui qui fait foi', () => {
  /**
   * ⚠️ `web/lib/prixOnDemand.ts` existe pour montrer un prix au visiteur AVANT
   * qu'il ait un compte — sans quoi il faudrait une cinquième fonction ouverte
   * à `anon`, et il y en a quatre. C'est donc le sixième doublon volontaire du
   * projet, et il suit la règle des cinq autres : les deux copies bougent
   * ensemble, ou cette garde tombe.
   */
  it('les réglages du site sont ceux de la base, un par un', () => {
    const r = reglages()
    expect({
      version: REGLAGES.version,
      tauxInventoristeCents: REGLAGES.tauxInventoristeCents,
      tauxResponsableCents: REGLAGES.tauxResponsableCents,
      productivite: REGLAGES.productivite,
      dureeCibleMinutes: REGLAGES.dureeCibleMinutes,
      fraisFixesCents: REGLAGES.fraisFixesCents,
      margeCible: REGLAGES.margeCible,
      margeMinimum: REGLAGES.margeMinimum,
    }).toEqual({
      version: r.version,
      tauxInventoristeCents: r.tauxInventoriste,
      tauxResponsableCents: r.tauxResponsable,
      productivite: r.productivite,
      dureeCibleMinutes: r.dureeCibleMin,
      fraisFixesCents: r.fraisFixes,
      margeCible: r.margeCible,
      margeMinimum: r.margeMinimum,
    })
  })

  it('les deux autres réglages de la chaîne aussi', () => {
    // `responsable_des_n` et `arrondi_minutes` ont une valeur par défaut en
    // base : la garde les lit dans la DÉFINITION de la table, pas dans l'insert.
    const sql = sansCommentaires(migrationDuPrix())
    const table = sql.slice(sql.indexOf('create table if not exists public.reglages_prix'))
    expect(table).toContain(`responsable_des_n       integer not null default ${REGLAGES.responsableDesN}`)
    expect(table).toContain(`arrondi_minutes         integer not null default ${REGLAGES.arrondiMinutes}`)
  })

  it('les départements desservis sont les mêmes des deux côtés', () => {
    const sql = sansCommentaires(migrationDuPrix())
    const i = sql.indexOf('insert into public.zones_desservies')
    const bloc = sql.slice(i, sql.indexOf(';', i))
    const enBase = [...bloc.matchAll(/\('(\d{2})',/g)].map((m) => m[1]).sort()
    expect([...DEPARTEMENTS_DESSERVIS].sort()).toEqual(enBase)
  })

  it('le délai de constitution d’équipe est le même des deux côtés', async () => {
    const { DELAI_HEURES } = await import('../lib/prixOnDemand')
    const { corps } = derniereDefinition('devis_mission')
    expect(sansCommentaires(corps)).toContain(`interval '${DELAI_HEURES} hours'`)
  })
})

describe('le barème d’annulation retombe sur le document', () => {
  /**
   * ⚠️ **LES DEUX PARTS NE S'ARRONDISSENT PAS DANS LE MÊME SENS**, et c'est la
   * règle que cette garde défend : ce que le client paie descend à l'euro
   * inférieur, ce que l'équipe touche monte à l'euro supérieur. Chaque arrondi
   * va contre Quantinvo. Le jour où quelqu'un « harmonise » les deux, un des
   * deux camps y perd des centimes et personne ne s'en aperçoit.
   */
  const bareme = () => {
    const { fichier } = derniereDefinition('frais_annulation')
    const sql = sansCommentaires(
      readFileSync(path.join(dossierMigrations, fichier), 'utf8'))
    const i = sql.indexOf('insert into public.reglages_annulation')
    expect(i, 'la migration doit poser un barème').toBeGreaterThan(0)
    const bloc = sql.slice(i, sql.indexOf(';', i))
    return [...bloc.matchAll(/\(\s*\d+\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)]
      .map((m) => ({ heures: Number(m[1]), client: Number(m[2]), equipe: Number(m[3]) }))
      .sort((a, b) => b.heures - a.heures)
  }

  /** Le tableau du document, LU dans le document. */
  const documente = () => {
    const doc = lire('docs/entreprise/on-demand/06-annulations.md')
    const lignes: { facture: number; equipe: number }[] = []
    for (const ligne of doc.split('\n')) {
      // | De 72 h à 24 h | **284 €** (30 %) | 67 € (10 % …) | 217 € |
      const m = ligne.match(/^\|([^|]+)\|([^|]*€[^|]*)\|([^|]*€[^|]*)\|([^|]*€[^|]*)\|\s*$/)
      if (!m || !/h avant|à 24 h|Moins de|sur place/.test(m[1])) continue
      const euros = (t: string) => Number((t.match(/([\d  ]+)\s*€/) ?? [])[1]?.replace(/\D/g, '') ?? '0') * 100
      lignes.push({ facture: euros(m[2]), equipe: euros(m[3]) })
    }
    return lignes
  }

  it('le document porte bien les quatre cas', () => {
    expect(documente().length).toBe(4)
  })

  it('les trois paliers chiffrés tombent juste, sur l’exemple du document', () => {
    const r = reglages()
    const exemple = exemples().find((e) => e.prix === 94900)
    expect(exemple, 'l’exemple à 949 € doit rester dans le document').toBeTruthy()
    const c = chaine(exemple!.articles, r)
    const cas = documente()
    const paliers = bareme()
    expect(paliers.length).toBe(3)

    // ⚠️ Déduits du barème et de la chaîne, pas recopiés : c'est ce qui rend
    // la garde utile le jour où l'un des deux bouge.
    paliers.forEach((p, i) => {
      expect(Math.floor((c.prix * p.client) / 100) * 100, `facturé au palier ${p.heures} h`)
        .toBe(cas[i].facture)
      expect(Math.ceil((c.equipe * p.equipe) / 100) * 100, `versé à l’équipe au palier ${p.heures} h`)
        .toBe(cas[i].equipe)
    })

    // Le quatrième cas n'est pas un palier : l'équipe est sur place, tout est dû.
    expect(cas[3].facture).toBe(c.prix)
    expect(cas[3].equipe).toBe(c.equipe)
  })

  it('l’équipe sur place est payée en entier, et Quantinvo ne gagne rien de plus', () => {
    const { corps } = derniereDefinition('frais_annulation')
    const sql = sansCommentaires(corps)
    expect(sql).toContain('v_client := v_m.prix_cents')
    expect(sql).toContain('v_equipe := public.remuneration_totale(p_mission)')
  })

  it('le client paie arrondi vers le BAS, l’équipe touche arrondi vers le HAUT', () => {
    const sql = sansCommentaires(derniereDefinition('frais_annulation').corps)
    expect(sql).toMatch(/v_client := floor\(/)
    expect(sql).toMatch(/v_equipe := ceil\(/)
  })

  it('ce que touche l’équipe ne sort pas vers un client', () => {
    const sql = sansCommentaires(derniereDefinition('frais_annulation').corps)
    expect(sql).toMatch(/'equipe_cents', case when v_admin then/)
  })
})

/**
 * La formule « logiciel seul » — Julien, 20 septembre 2026.
 *
 * ⚠️ **CE QUI EST GARDÉ ICI, C'EST CE QUI NE DOIT PAS DÉRIVER** : le
 * dimensionnement est commun aux deux formules, le prix ne l'est pas, et le
 * logiciel ne facture aucun travail humain. Les nombres ne sont pas cités :
 * les réglages viennent de la migration, la chaîne vient du site.
 */
describe('la formule logiciel seul', () => {
  const r = reglages()

  it('les réglages du site sont ceux de la base', () => {
    expect({
      tarif: REGLAGES.tarifAppareilCents,
      frais: REGLAGES.fraisFixesLogicielCents,
    }).toEqual({ tarif: r.tarifAppareil, frais: r.fraisFixesLogiciel })
  })

  /**
   * ⚠️ Le dimensionnement doit rester COMMUN. S'il divergeait, les deux prix
   * de la page ne seraient plus comparables — et c'est tout l'intérêt de les
   * mettre côte à côte.
   */
  it('le dimensionnement est le même dans les deux formules', () => {
    for (const articles of [2_000, 10_000, 20_000, 30_000, 50_000, 100_000]) {
      const equipe = chaineAffichee(articles, 1, 'equipe_quantinvo')
      const logiciel = chaineAffichee(articles, 1, 'logiciel_seul')
      expect(logiciel.compteursAttendus, `${articles} — compteurs`)
        .toBe(equipe.compteursAttendus)
      expect(logiciel.appareils, `${articles} — appareils`).toBe(equipe.appareils)
      expect(logiciel.dureeMinutes, `${articles} — durée`).toBe(equipe.dureeMinutes)
    }
  })

  it('le prix est la licence plus les frais, et rien d’autre', () => {
    for (const articles of [2_000, 20_000, 100_000]) {
      const c = chaineAffichee(articles, 1, 'logiciel_seul')
      expect(c.licenceCents).toBe(c.appareils * r.tarifAppareil)
      expect(c.prixCents).toBe(c.licenceCents + r.fraisFixesLogiciel)
      // ⚠️ L'arrondi à l'euro ne doit rien changer : un tarif et des frais en
      // euros ronds donnent un prix en euros ronds. Si ce test tombe un jour,
      // c'est qu'un réglage est passé aux centimes — et le prix affiché ne
      // serait plus le prix payé.
      expect(c.prixCents % 100).toBe(0)
    }
  })

  it('personne n’est payé, et rien n’est facturé comme du travail', () => {
    const c = chaineAffichee(20_000, 1, 'logiciel_seul')
    expect(c.equipeCents).toBe(0)
    expect(c.inventoristes).toBe(0)
    expect(c.responsable).toBe(false)
    expect(c.remunerationInventoristeCents).toBe(0)
    expect(c.remunerationResponsableCents).toBe(0)
  })

  it('le logiciel coûte moins cher que l’équipe, à volume égal', () => {
    for (const articles of [2_000, 10_000, 20_000, 30_000, 50_000, 100_000]) {
      const equipe = chaineAffichee(articles, 1, 'equipe_quantinvo')
      const logiciel = chaineAffichee(articles, 1, 'logiciel_seul')
      expect(logiciel.prixCents, `${articles} articles`).toBeLessThan(equipe.prixCents)
    }
  })

  /**
   * ⚠️ **LA ZONE ET LE DÉLAI NE VALENT QUE POUR L'ÉQUIPE.** Ils existent parce
   * que six personnes doivent se déplacer et qu'une équipe se constitue. Le
   * logiciel se livre partout et tout de suite : les appliquer reviendrait à
   * refuser de vendre ce qu'on sait livrer.
   */
  it('ni zone ni délai pour le logiciel, les deux pour l’équipe', () => {
    const dansUnMois = new Date(Date.now() + 30 * 24 * 3600_000)
    const dansTroisHeures = new Date(Date.now() + 3 * 3600_000)
    const base = { secteur: 'textile' as const, trancheArticles: 'd' }
    // Un département que la liste des desservis ne contient pas — déduit,
    // jamais cité : le jour où Bordeaux ouvre, ce test doit suivre.
    const horsZone = ['33', '13', '44', '31', '67']
      .find((d) => !(DEPARTEMENTS_DESSERVIS as readonly string[]).includes(d))
    expect(horsZone, 'il faut un département non desservi pour ce test').toBeTruthy()

    const dehors = `${horsZone}000`
    expect(devisAffiche({ ...base, codePostal: dehors, debut: dansUnMois }).ok).toBe(false)
    expect(devisAffiche({
      ...base, codePostal: dehors, debut: dansUnMois, formule: 'logiciel_seul' }).ok).toBe(true)

    const dedans = `${DEPARTEMENTS_DESSERVIS[0]}000`
    expect(devisAffiche({ ...base, codePostal: dedans, debut: dansTroisHeures }).ok).toBe(false)
    expect(devisAffiche({
      ...base, codePostal: dedans, debut: dansTroisHeures, formule: 'logiciel_seul' }).ok).toBe(true)
  })

  it('une date passée reste refusée, même sans équipe', () => {
    const hier = new Date(Date.now() - 24 * 3600_000)
    expect(devisAffiche({
      codePostal: `${DEPARTEMENTS_DESSERVIS[0]}000`, secteur: 'textile',
      trancheArticles: 'd', debut: hier, formule: 'logiciel_seul' }).ok).toBe(false)
  })

  it('personne ne vient : pas d’avance à l’arrivée', () => {
    const debut = new Date(Date.now() + 30 * 24 * 3600_000)
    const d = devisAffiche({
      codePostal: `${DEPARTEMENTS_DESSERVIS[0]}000`, secteur: 'textile',
      trancheArticles: 'd', debut, formule: 'logiciel_seul' })
    expect(d.ok).toBe(true)
    if (d.ok) expect(d.arrivee.getTime()).toBe(debut.getTime())
  })
})
