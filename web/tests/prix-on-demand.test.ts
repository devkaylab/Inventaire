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
import { derniereDefinition, dossierMigrations, fichierDe } from './migrations'
import {
  REGLAGES, DEPARTEMENTS_DESSERVIS, chaine as chaineAffichee,
  FORMULE_EQUIPE_OUVERTE, formuleParDefaut, formuleDemandee,
  TRANCHES_ARTICLES, TARIF_ENTREE_APPAREILS, minimumAppareils, moisCouvrant, prixPonctuel,
  trancheDesPieces, appareilsPourPieces, PLAFOND_PIECES,
} from '../lib/prixOnDemand'
import { prixFerme as prixAffiche } from '../lib/prixOnDemand'
import { APPAREILS_MAX, OFFRES, SUPPLEMENT } from '../lib/offres'
import { PIECES_EN_STOCK } from '../lib/inscription'

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
/**
 * La dernière migration qui pose CE QU'ON CHERCHE — pas « la dernière qui
 * parle de prix ».
 *
 * ⚠️ La distinction a mordu le 28 septembre 2026 : la grille à deux axes a
 * ajouté une migration qui pose les réglages mais NI les coefficients, NI les
 * zones, NI l'ancienne fonction. Une garde qui prenait « la dernière du
 * sujet » les cherchait dedans et tombait, alors que rien n'était cassé. On
 * cherche donc chacun là où il est DÉFINI, comme `derniereDefinition()` le
 * fait pour les fonctions.
 */
function derniereMigrationAvec(motif: string | RegExp): string {
  const avec = migrations().filter((m) => {
    const sql = sansCorpsDeFonction(sansCommentaires(m.sql))
    return typeof motif === 'string' ? sql.includes(motif) : motif.test(sql)
  })
  expect(avec.length, `aucune migration ne pose ${motif}`).toBeGreaterThan(0)
  return sansCorpsDeFonction(avec[avec.length - 1].sql)
}

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
  partDuMois: number
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
    partDuMois: val('part_du_mois'),
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
  // ⚠️ La formule est NOMMÉE : le défaut a basculé vers le logiciel seul le
  // 28 septembre 2026, et ce bloc rejoue les exemples de la formule ÉQUIPE.
  const c = chaineAffichee(articles, coefficient, 'equipe_quantinvo')
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
    const sql = sansCommentaires(derniereMigrationAvec(/insert into public\.coefficients_prix[\s\S]*values/))
    const i = sql.indexOf('insert into public.coefficients_prix')
    expect(i).toBeGreaterThan(0)
    const bloc = sql.slice(i, sql.indexOf(';', i))
    const valeurs = [...bloc.matchAll(/,\s*(\d+\.\d+)\s*\)/g)].map((m) => Number(m[1]))
    expect(valeurs.length).toBeGreaterThanOrEqual(6)
    for (const v of valeurs) expect(v).toBe(1)
  })

  it('les départements desservis ne sont pas majorés non plus', () => {
    const sql = sansCommentaires(derniereMigrationAvec('insert into public.zones_desservies'))
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

  it('refuse franchement hors zone, sans rien proposer en échange', () => {
    const { corps } = derniereDefinition('prix_mission')
    expect(sansCommentaires(corps)).toContain("'hors_zone'")
  })

  /**
   * ⚠️ Le moteur rend `cout_cents`, `marge_cents` et les rémunérations. Un
   * client qui l'appellerait saurait au centime ce que Quantinvo gagne sur son
   * inventaire, et ce que touche l'inventoriste qui est chez lui.
   */
  it('n’est pas appelable depuis un navigateur de client', () => {
    const sql = derniereMigrationAvec('grant execute on function public.prix_mission')
    expect(sql).toMatch(/revoke all on function public\.prix_mission\([^)]*\)\s*\n?\s*from public, anon, authenticated;/)
    expect(sql).not.toMatch(/grant execute on function public\.prix_mission\([^)]*\)\s*\n?\s*to [^;]*authenticated/)
  })

  it('la porte du tunnel ne rend ni coût ni marge', () => {
    const { corps } = derniereDefinition('prix_ferme_mission')
    const retour = corps.slice(corps.lastIndexOf('return jsonb_build_object'))
    for (const interdit of ['cout_cents', 'marge_cents', 'equipe_cents', 'remuneration']) {
      expect(retour, `« ${interdit} » ne sort pas par le prix ferme`).not.toContain(interdit)
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
      // ⚠️ AJOUTÉE LE 5 OCTOBRE 2026, et elle manquait : la part du mois décide
      // à elle seule du prix de toute location. Sabotée à 1,25 côté base, la
      // garde passait au vert pendant que le site facturait 1,10.
      partDuMois: REGLAGES.partDuMois,
    }).toEqual({
      version: r.version,
      tauxInventoristeCents: r.tauxInventoriste,
      tauxResponsableCents: r.tauxResponsable,
      productivite: r.productivite,
      dureeCibleMinutes: r.dureeCibleMin,
      fraisFixesCents: r.fraisFixes,
      margeCible: r.margeCible,
      margeMinimum: r.margeMinimum,
      partDuMois: r.partDuMois,
    })
  })

  it('les deux autres réglages de la chaîne aussi', () => {
    // `responsable_des_n` et `arrondi_minutes` ont une valeur par défaut en
    // base : la garde les lit dans la DÉFINITION de la table, pas dans l'insert.
    const sql = sansCommentaires(migrationDuPrix())
    const table = sansCommentaires(
      derniereMigrationAvec('create table if not exists public.reglages_prix'),
    ).slice(0)
    expect(table).toContain(`responsable_des_n       integer not null default ${REGLAGES.responsableDesN}`)
    expect(table).toContain(`arrondi_minutes         integer not null default ${REGLAGES.arrondiMinutes}`)
  })

  it('les départements desservis sont les mêmes des deux côtés', () => {
    const sql = sansCommentaires(derniereMigrationAvec('insert into public.zones_desservies'))
    const i = sql.indexOf('insert into public.zones_desservies')
    const bloc = sql.slice(i, sql.indexOf(';', i))
    const enBase = [...bloc.matchAll(/\('(\d{2})',/g)].map((m) => m[1]).sort()
    expect([...DEPARTEMENTS_DESSERVIS].sort()).toEqual(enBase)
  })

  it('le délai de constitution d’équipe est le même des deux côtés', async () => {
    const { DELAI_HEURES } = await import('../lib/prixOnDemand')
    const { corps } = derniereDefinition('prix_ferme_mission')
    expect(sansCommentaires(corps)).toContain(`interval '${DELAI_HEURES} hours'`)
  })
})

describe('⚠️ annuler une location est gratuit', () => {
  /**
   * Cette garde en REMPLACE quatre, et il faut dire laquelle : « le barème
   * d'annulation retombe sur le document » défendait un barème à trois
   * paliers, et surtout le fait que les deux arrondis aillent chacun contre
   * Quantinvo — le client à l'euro inférieur, l'équipe à l'euro supérieur.
   *
   * Elle défendait bien quelque chose de vrai. Julien a décidé l'inverse le
   * 4 octobre 2026 : « 1 pas de frais ». Les frais payaient les inventoristes
   * qui s'étaient rendus disponibles pour une nuit — l'écran le disait mot
   * pour mot. Plus personne ne se rend disponible.
   *
   * ⚠️ On ne retire pas une garde parce qu'elle gêne : on la remplace par
   * celle de la décision qui l'a renversée. Le barème lui-même
   * (`reglages_annulation`) n'est pas supprimé : la formule équipe est fermée,
   * pas effacée.
   */
  it('la base ne réclame jamais rien', () => {
    const sql = sansCommentaires(derniereDefinition('frais_annulation').corps)
    expect(sql).toMatch(/'a_payer_cents', 0/)
    // Et le montant ne se calcule plus : un barème relu un jour reviendrait
    // par la fenêtre.
    expect(sql, 'les paliers sont relus').not.toMatch(/reglages_annulation/)
    expect(sql, 'la paie d’une équipe est recalculée').not.toMatch(/remuneration_totale/)
  })

  it('et l’écran ne montre plus de barème', () => {
    const ecran = sansCommentaires(readFileSync(
      path.resolve(__dirname, '..', 'app/on-demand/mes-inventaires/[id]/page.tsx'), 'utf8'))
      .replace(/\s+/g, ' ')
    expect(ecran, 'le tableau « si vous annulez / vous payez » est revenu')
      .not.toMatch(/Si vous annulez/)
    expect(ecran).toMatch(/L’annulation est gratuite/)
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
  /**
   * ⚠️ **LES DEUX FORMULES NE SE DIMENSIONNENT PLUS PAREIL, ET C'EST VOULU.**
   * Cette garde disait l'inverse jusqu'au 28 septembre 2026 — elle était juste
   * tant que le ponctuel était un devis d'équipe déguisé. Le ponctuel se cale
   * maintenant sur 500 articles/heure et sept heures ; l'équipe garde 800 et
   * 4 h 30, parce qu'on ne re-chiffre pas une formule fermée.
   */
  it('le ponctuel se dimensionne sur SA productivité, pas sur celle de l’équipe', () => {
    for (const articles of [2_000, 10_000, 20_000, 30_000, 50_000, 100_000]) {
      const logiciel = chaineAffichee(articles, 1, 'logiciel_seul')
      // Le minimum d'appareils : ce qu'il faut pour tenir en une soirée.
      const attendu = Math.max(1, Math.ceil(
        articles / (REGLAGES.productivitePonctuel * (REGLAGES.soireeMinutes / 60))))
      expect(logiciel.appareils, `${articles} — appareils`).toBe(attendu)
      // Et la durée retombe bien sous la soirée visée.
      expect(logiciel.dureeMinutes, `${articles} — durée`)
        .toBeLessThanOrEqual(REGLAGES.soireeMinutes)
    }
  })

  /**
   * ⚠️ **LA TAILLE IMPOSE UN MINIMUM, ET C'EST CE QUI TIENT LA GRILLE.** Sans
   * lui, déclarer 100 000 pièces sur deux appareils ramenait le mois de
   * référence à Essential, donc le prix à 44 €. Trouvé par Julien en
   * manipulant la maquette, le 28 septembre 2026.
   */
  it('⚠️ on ne descend pas sous le minimum d’appareils qu’impose la taille', () => {
    const c = chaineAffichee(100_000, 1, 'logiciel_seul', 2)
    expect(c.appareils).toBe(minimumAppareils(100_000))
    expect(c.appareils).toBeGreaterThan(2)
    expect(c.prixCents).toBe(
      TRANCHES_ARTICLES.find((t) => t.max === 100_000)?.prixCents)
  })

  /**
   * ⚠️⚠️ **LA RÈGLE DES DEUX INVENTAIRES EST MORTE** (5 octobre 2026). Elle
   * disait : deux réservations restent sous le mois d'abonnement, trois le
   * dépassent — donc le ponctuel valait la MOITIÉ d'un mois.
   *
   * Julien l'a reprise en relisant la grille : « 129 € pour 10/20 000 pièces,
   * 6 appareils, ça semble peu crédible non ? ». Six appareils, c'est Advanced
   * à 310 € par mois. On vendait une semaine du même produit 2,4 fois moins
   * cher qu'un seul mois : il fallait VINGT-SIX réservations dans l'année pour
   * que s'abonner redevienne intéressant. La location mangeait l'abonnement.
   *
   * La règle est maintenant : **la semaine vaut le mois + 10 %**, et le mois
   * s'interpole entre les trois paliers.
   */
  it('⚠️ la semaine vaut le mois d’abonnement, majoré de la part décidée', () => {
    for (const n of [1, 2, 3, 6, 10, 20, 21, 50, 100, 140]) {
      expect(prixPonctuel(n), `${n} appareils`)
        .toBe(Math.round(moisCouvrant(n) * REGLAGES.partDuMois / 100) * 100)
      // Un prix public ne se lit pas en centimes.
      expect(prixPonctuel(n) % 100, `${n} appareils — euros ronds`).toBe(0)
    }
    // ⚠️ ET LA PART EST BIEN AU-DESSUS DU MOIS. Une part sous 1 ramènerait le
    // défaut : louer moins cher que s'abonner.
    expect(REGLAGES.partDuMois).toBeGreaterThan(1)
  })

  /**
   * ⚠️ **LA PENTE PASSE PAR LE HAUT DE CHAQUE PALIER**, et les trois ancres
   * sont les prix d'abonnement de `offres.ts` — pas des nombres qu'on s'est
   * donnés. C'est là qu'un client a vraiment la capacité et pourrait s'abonner
   * à la place : c'est là que la règle doit tomber juste.
   */
  it('⚠️ les trois ancres sont les offres, au centime', () => {
    for (const o of OFFRES) {
      expect(moisCouvrant(o.max), `${o.nom} — ${o.max} appareils`).toBe(o.mois * 100)
    }
    // ⚠️ **LA COURBE NE REDESCEND JAMAIS, ET ELLE NE SAUTE QUE LÀ OÙ
    // L'ABONNEMENT SAUTE.** Un mur ailleurs qu'à une frontière d'offre serait
    // arbitraire — et c'est exactement ce qu'on reproche à un prix : un client
    // qui déclare cent pièces de plus et voit son prix tripler sous-déclare.
    // Les frontières sont DÉDUITES de `offres.ts` et du tarif d'entrée.
    const frontieres = new Set<number>([TARIF_ENTREE_APPAREILS, ...OFFRES.map((o) => o.max)])
    // Et au-delà du dernier palier, l'abonnement avance par paquets de dix :
    // chacun est une frontière légitime. Déduit de `offres.ts`, pas cité.
    const auDela = (n: number) => n > APPAREILS_MAX && (n - APPAREILS_MAX) % SUPPLEMENT.par === 0
    for (let n = 1; n < 140; n += 1) {
      const saut = prixPonctuel(n + 1) - prixPonctuel(n)
      expect(saut, `${n} → ${n + 1} appareils — la courbe redescend`).toBeGreaterThanOrEqual(0)
      if (saut > 4_000) {
        expect(frontieres.has(n) || auDela(n),
          `mur de ${saut / 100} € entre ${n} et ${n + 1} appareils`).toBe(true)
      }
    }
  })

  /**
   * ⚠️⚠️ **LA COURBE DU SITE EST CELLE DE LA BASE**, seuil par seuil.
   *
   * Les réglages étaient comparés un par un, mais pas la COURBE : le `case` du
   * SQL et `moisCouvrant()` sont deux implémentations indépendantes de la même
   * décision. Sabotage du 5 octobre 2026 — le tarif d'entrée étendu à six
   * appareils côté base seulement — : tout passait au vert pendant que le site
   * affichait 341 € et que la base facturait 152 €. Le navigateur affiche, la
   * base engage : c'est la base qui gagne, et le client voit l'autre prix.
   */
  it('⚠️ la courbe du site est celle de la base, seuil par seuil', () => {
    // ⚠️ Le `case` vit DANS le corps de la fonction : `derniereMigrationAvec`
    // le retire exprès (`sansCorpsDeFonction`). On passe donc par la
    // définition elle-même, comme partout ailleurs dans ce fichier.
    const corps = sansCommentaires(derniereDefinition('prix_mission').corps)
    const bloc = corps.slice(corps.indexOf('v_mois := case'))
    expect(bloc, 'le calcul du mois ne se lit plus dans la base').not.toBe('')
    const paliers = [...bloc.matchAll(/when v_appareils <= (\d+)\s*then\s+(\d+)\s*\n/g)]
      .map((m) => ({ seuil: Number(m[1]), valeur: Number(m[2]) }))
    expect(paliers.length, 'les paliers de la base ne se lisent plus')
      .toBeGreaterThanOrEqual(3)
    for (const { seuil, valeur } of paliers) {
      expect(moisCouvrant(seuil), `${seuil} appareils — le site et la base divergent`)
        .toBe(valeur)
    }
    // Le tarif d'entrée : la seule branche calculée, et son seuil doit être
    // celui du site.
    const entree = bloc.match(/when v_appareils <= (\d+)\s*then\s+round\(/)
    expect(entree, 'le tarif d’entrée ne se lit plus dans la base').toBeTruthy()
    expect(Number(entree![1]), 'le tarif d’entrée du site n’est pas celui de la base')
      .toBe(TARIF_ENTREE_APPAREILS)
  })

  /**
   * ⚠️ **LE PRIX VIENT DES APPAREILS, PLUS DE LA TRANCHE.** `prixCents` d'une
   * tranche dit seulement ce qu'elle coûte AU MINIMUM d'appareils qu'elle
   * impose — et la garde le RECALCULE, elle ne le relit pas. C'est ce qui a
   * attrapé une valeur mal arrondie le jour même (30–50 000 : 274 € écrit,
   * 273 € calculé).
   */
  it('⚠️ chaque tranche affiche le prix de son minimum d’appareils', () => {
    for (const t of TRANCHES_ARTICLES) {
      const minimum = minimumAppareils(t.max)
      expect(t.prixCents, `${t.nom}`).toBe(prixPonctuel(minimum))
      expect(chaineAffichee(t.max, 1, 'logiciel_seul').prixCents, `${t.nom} — chaîne`)
        .toBe(prixPonctuel(minimum))

      // Des appareils en plus se paient par la pente, pas par un supplément.
      const deuxDePlus = chaineAffichee(t.max, 1, 'logiciel_seul', minimum + 2)
      expect(deuxDePlus.prixCents).toBe(prixPonctuel(minimum + 2))
      expect(deuxDePlus.prixCents % 100, `${t.nom} — euros ronds`).toBe(0)
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

    // ⚠️ La formule est NOMMÉE des deux côtés depuis le 28 septembre 2026 :
    // le défaut n'est plus l'équipe (`FORMULE_EQUIPE_OUVERTE` est faux), donc
    // ne rien passer ne testait plus la règle qu'on croit tester.
    const dehors = `${horsZone}000`
    expect(prixAffiche({
      ...base, codePostal: dehors, debut: dansUnMois, formule: 'equipe_quantinvo' }).ok).toBe(false)
    expect(prixAffiche({
      ...base, codePostal: dehors, debut: dansUnMois, formule: 'logiciel_seul' }).ok).toBe(true)

    const dedans = `${DEPARTEMENTS_DESSERVIS[0]}000`
    expect(prixAffiche({
      ...base, codePostal: dedans, debut: dansTroisHeures, formule: 'equipe_quantinvo' }).ok).toBe(false)
    expect(prixAffiche({
      ...base, codePostal: dedans, debut: dansTroisHeures, formule: 'logiciel_seul' }).ok).toBe(true)
  })

  /**
   * ⚠️ **LA FORMULE ÉQUIPE EST FERMÉE, ET ON LE PROUVE.** Julien, 28 septembre
   * 2026 : trop lourd juridiquement, trop tôt. Rien n'est supprimé — donc rien
   * n'empêcherait, sans cette garde, qu'un chemin y ramène par accident.
   */
  it('⚠️ tant que l’équipe est fermée, aucun chemin n’y mène', () => {
    expect(FORMULE_EQUIPE_OUVERTE).toBe(false)
    expect(formuleParDefaut()).toBe('logiciel_seul')

    // L'adresse ne rouvre pas ce que le drapeau ferme.
    expect(formuleDemandee('equipe')).toBe('logiciel_seul')
    expect(formuleDemandee('logiciel')).toBe('logiciel_seul')
    expect(formuleDemandee(null)).toBe('logiciel_seul')

    // Et les deux surfaces publiques ne montrent la formule que sous le drapeau.
    for (const f of ['components/vitrine/PageOnDemand.tsx', 'components/vitrine/PageReserver.tsx']) {
      // ⚠️ Sans ses commentaires : le bloc qui EXPLIQUE la fermeture cite
      // forcément « Nous, avec la nôtre », et la garde se mordait la queue.
      // Et on ne compare pas LIGNE À LIGNE : le drapeau garde un bloc, il
      // n'est pas sur la même ligne que ce qu'il garde. Ce qu'on vérifie,
      // c'est qu'aucune de ces surfaces n'apparaît AVANT un drapeau.
      const source = sansCommentaires(lire(`web/${f}`))
      const drapeau = source.indexOf('FORMULE_EQUIPE_OUVERTE')
      for (const marque of ['Nous, avec la nôtre', 'autreFormule.ok', 'devenir-inventoriste']) {
        const ou = source.indexOf(marque)
        if (ou < 0) continue
        // ⚠️ **NE PAS EXIGER LE DRAPEAU QUAND IL N'Y A RIEN À GARDER.** La
        // page d'offre a été refaite le 28 septembre 2026 : la formule équipe
        // n'y est plus du tout, pas même sous condition. C'est plus fort qu'un
        // drapeau, et une garde qui réclamait sa présence aurait poussé à
        // réintroduire ce qu'on venait de retirer.
        expect(drapeau, `${f} : « ${marque} » sans drapeau`).toBeGreaterThanOrEqual(0)
        expect(ou, `${f} : « ${marque} » n’est pas sous le drapeau`).toBeGreaterThan(drapeau)
      }
    }
  })

  /**
   * ⚠️ **LE LOGICIEL SEUL NE DEMANDE NI ADRESSE NI SECTEUR**, et son prix ne
   * doit donc pas les exiger. La condition les réclamait encore le
   * 28 septembre 2026, et le tunnel répondait « il manque une réponse » à une
   * question qu'il ne posait plus. Trouvé en cliquant, pas en relisant.
   */
  it('⚠️ le prix du logiciel se calcule sans adresse ni secteur', () => {
    const dansUnMois = new Date(Date.now() + 30 * 24 * 3600_000)
    const r = prixAffiche({
      codePostal: '', secteur: '', trancheArticles: 'd',
      debut: dansUnMois, formule: 'logiciel_seul',
    })
    expect(r.ok, 'le logiciel seul doit rendre un prix sans adresse').toBe(true)
    // L'équipe, elle, les exige toujours : elle se déplace.
    expect(prixAffiche({
      codePostal: '', secteur: '', trancheArticles: 'd',
      debut: dansUnMois, formule: 'equipe_quantinvo',
    }).ok).toBe(false)
  })

  it('une date passée reste refusée, même sans équipe', () => {
    const hier = new Date(Date.now() - 24 * 3600_000)
    expect(prixAffiche({
      codePostal: `${DEPARTEMENTS_DESSERVIS[0]}000`, secteur: 'textile',
      trancheArticles: 'd', debut: hier, formule: 'logiciel_seul' }).ok).toBe(false)
  })

  it('personne ne vient : pas d’avance à l’arrivée', () => {
    const debut = new Date(Date.now() + 30 * 24 * 3600_000)
    const d = prixAffiche({
      codePostal: `${DEPARTEMENTS_DESSERVIS[0]}000`, secteur: 'textile',
      trancheArticles: 'd', debut, formule: 'logiciel_seul' })
    expect(d.ok).toBe(true)
    if (d.ok) expect(d.arrivee.getTime()).toBe(debut.getTime())
  })
})

/**
 * Le mot « devis » ne désigne plus le prix ferme.
 *
 * ⚠️ **CE PRODUIT NE FAIT PAS DE DEVIS, C'EST SA PHRASE FONDATRICE.** La
 * fonction qui rend le montant du tunnel s'appelait pourtant `devis_mission`.
 * Relevé par Julien le 20 septembre 2026, en trois mots : « quel devis ? ».
 *
 * ⚠️ **ET LE MOT EST PRIS, AILLEURS, POUR SON VRAI SENS** : Quantinvo OS a de
 * vrais devis — `/devis/[token]`, `quote_by_token` — des abonnements négociés
 * qu'un client accepte ou refuse. Deux choses opposées sous le même mot dans
 * la même base finissent confondues le jour où il faut aller vite.
 *
 * ⚠️ Cette garde ne dit rien des devis de Quantinvo OS : ils sont légitimes.
 * Elle tient une seule chose — qu'aucune fonction du chantier À la demande ne
 * reprenne ce nom.
 */
describe('à la demande ne dit pas « devis »', () => {
  it('la fonction du tunnel s’appelle prix_ferme_mission', () => {
    // Elle existe, et c'est bien elle que la garde du contenu lit plus haut.
    expect(() => derniereDefinition('prix_ferme_mission')).not.toThrow()
  })

  /**
   * ⚠️ **L'ANCIENNE DOIT ÊTRE SUPPRIMÉE, PAS SEULEMENT DOUBLÉE.** La laisser
   * en place la garderait appelable par `authenticated` — donc depuis un
   * navigateur — et le mot continuerait de vivre dans les journaux.
   */
  it('devis_mission est supprimée après sa dernière définition', () => {
    const tous = migrations()
    const derniereCreation = tous
      .filter((m) => /create (?:or replace )?function public\.devis_mission\s*\(/i
        .test(sansCommentaires(m.sql)))
      .at(-1)
    expect(derniereCreation, 'devis_mission doit avoir existé').toBeTruthy()
    const suppression = tous
      .filter((m) => /drop function if exists public\.devis_mission\s*\(/i
        .test(sansCommentaires(m.sql)))
      .at(-1)
    expect(suppression, 'aucune migration ne supprime devis_mission').toBeTruthy()
    expect(
      suppression!.fichier > derniereCreation!.fichier,
      `${suppression!.fichier} doit venir après ${derniereCreation!.fichier}`,
    ).toBe(true)
  })

  /**
   * ⚠️ **LE CODE LIVRÉ, PAS `tests/`.** Ce fichier-ci nomme `devis_mission`
   * pour prouver qu'elle a disparu : s'inclure dans son propre balayage le
   * ferait échouer sur sa propre preuve. Septième fois que ce piège se
   * présente sur ce dépôt — les six précédentes étaient des commentaires,
   * celle-ci est du code.
   */
  it('plus aucun code livré ne l’appelle', () => {
    const racines = ['lib', 'components', 'app']
    const fautes: string[] = []
    const parcourir = (dossier: string) => {
      for (const e of readdirSync(path.join(__dirname, '..', dossier), { withFileTypes: true })) {
        const rel = path.join(dossier, e.name)
        if (e.isDirectory()) { parcourir(rel); continue }
        if (!/\.tsx?$/.test(e.name)) continue
        const texte = sansCommentaires(readFileSync(path.join(__dirname, '..', rel), 'utf8'))
        if (texte.includes('devis_mission')) fautes.push(rel)
      }
    }
    for (const r of racines) parcourir(r)
    expect(fautes, fautes.join('\n')).toEqual([])
  })
})

describe('⚠️ « envoyer une équipe » ne gouverne plus rien sur le chemin location', () => {
  /**
   * Julien, 4 octobre 2026 : « on reste uniquement sur la partie où on met
   * Quantinvo à dispo, la notion "envoyer une équipe" est nulle ».
   *
   * Le défaut réparé ce jour-là : `/on-demand/groupe` grisait les magasins
   * d'un département « non desservi » et refusait de les réserver. Une
   * enseigne de dix magasins dont quatre hors zone n'en réservait que six —
   * alors que la base, elle, acceptait : `reserver_ma_mission` retombe sur
   * `logiciel_seul` quand la ligne ne dit rien de la formule. Le navigateur
   * refusait ce que le serveur autorisait, et aucune garde ne le voyait.
   */

  /** La liste SE DÉDUIT : tout fichier du site qui consulte la zone. */
  function fichiersQuiLisentLaZone(): string[] {
    const racine = path.resolve(__dirname, '..')
    const trouves: string[] = []
    const descendre = (rel: string) => {
      for (const e of readdirSync(path.join(racine, rel), { withFileTypes: true })) {
        const r = path.join(rel, e.name)
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') descendre(r); continue }
        if (!/\.tsx?$/.test(e.name)) continue
        // La définition elle-même ne compte pas : c'est ses APPELS qu'on garde.
        if (r === path.join('lib', 'prixOnDemand.ts')) continue
        const code = readFileSync(path.join(racine, r), 'utf8')
        if (/estDesservi\s*\(/.test(code)) trouves.push(r)
      }
    }
    for (const d of ['app', 'components', 'lib', 'hooks']) descendre(d)
    return trouves
  }

  it('aucun appel à la zone n’échappe à la formule', () => {
    for (const f of fichiersQuiLisentLaZone()) {
      const code = readFileSync(path.resolve(__dirname, '..', f), 'utf8')
      // La zone n'a de sens que pour l'équipe : un appel qui ne regarde pas la
      // formule refuse une location que la base accepterait.
      expect(/logiciel/i.test(code), `${f} consulte la zone sans regarder la formule`).toBe(true)
    }
  })

  it('la page « groupe » ne consulte plus la zone du tout', () => {
    // Elle ne connaît pas la formule, et n'a donc aucun moyen de poser la
    // question correctement. C'est de là que venait le défaut.
    const code = readFileSync(
      path.resolve(__dirname, '..', 'app/on-demand/groupe/page.tsx'), 'utf8')
    expect(code).not.toMatch(/estDesservi\s*\(/)
    expect(code, 'elle affiche encore un refus de zone').not.toMatch(/Pas encore desservi/)
  })

  it('le refus « hors zone » reste réservé à l’équipe', () => {
    // Côté bibliothèque, la règle était déjà juste : on la fige.
    const lib = readFileSync(path.resolve(__dirname, '..', 'lib/prixOnDemand.ts'), 'utf8')
    expect(lib).toMatch(/if \(!logiciel && !estDesservi\(r\.codePostal\)\) return \{ ok: false, refus: 'hors_zone' \}/)
  })
})

describe('⚠️ les magasins se lisent par une fonction, jamais par la table', () => {
  /**
   * 4 octobre 2026 : `/on-demand/groupe` rendait « permission denied for table
   * stores ». `mesEtablissements()` faisait `from('stores').select(...)`, et
   * `authenticated` n'a pas `select` sur cette table — ses droits sont `dDtm`.
   * L'écran n'avait donc JAMAIS fonctionné, ni en préversion ni en production :
   * il n'avait simplement jamais été exercé contre une vraie base.
   *
   * ⚠️ La réparation ne consiste PAS à ouvrir `stores` : ce serait élargir une
   * porte dans toute la production pour un écran d'une branche.
   */
  const racine = path.resolve(__dirname, '..')

  /** La liste SE DÉDUIT : tout fichier du site qui parle à Supabase. */
  function fichiersQuiLisentDesMagasins(): string[] {
    const trouves: string[] = []
    const descendre = (rel: string) => {
      for (const e of readdirSync(path.join(racine, rel), { withFileTypes: true })) {
        const r = path.join(rel, e.name)
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') descendre(r); continue }
        if (!/\.tsx?$/.test(e.name)) continue
        if (/from\(\s*'stores'\s*\)/.test(readFileSync(path.join(racine, r), 'utf8'))) trouves.push(r)
      }
    }
    for (const d of ['app', 'components', 'lib', 'hooks']) descendre(d)
    return trouves
  }

  it('aucun écran ne lit la table `stores` en direct', () => {
    const directs = fichiersQuiLisentDesMagasins()
    expect(directs, `lecture directe de stores (interdite à authenticated) : ${directs.join(', ')}`)
      .toEqual([])
  })

  it('la fonction referme sa porte et trie par l’appelant', () => {
    const def = derniereDefinition('mes_etablissements')
    // Elle trie sur `auth.uid()`, pas sur un paramètre de l'appelant.
    expect(def.corps).toContain('ss.user_id = auth.uid()')
    expect(def.corps).not.toMatch(/p_user|p_company/)
    // `create or replace` rend EXECUTE à PUBLIC : les droits se reposent.
    expect(fichierDe('mes_etablissements')).toMatch(
      /revoke all on function public\.mes_etablissements\(\) from public, anon/)
  })
})

describe('⚠️ louer Quantinvo, c’est zéro inventoriste', () => {
  /**
   * 4 octobre 2026, trouvé en réservant pour de vrai : `missions` portait
   * `check (inventoristes >= 1)`. Juste tant qu'une mission voulait dire « on
   * envoie une équipe » — plus du tout depuis la grille à deux axes, où le
   * `logiciel_seul` rend `inventoristes = 0`. **Toute location échouait**, sur
   * un message de Postgres brut à l'écran.
   *
   * ⚠️ Aucun test ne pouvait le voir : la chaîne de prix est éprouvée à
   * l'unité, la contrainte vit en base, et les deux étaient justes séparément.
   */
  it('la contrainte la plus récente accepte zéro', () => {
    // La liste SE DÉDUIT : le dernier fichier qui touche la contrainte fait foi.
    const fichiers = readdirSync(dossierMigrations)
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => readFileSync(path.join(dossierMigrations, f), 'utf8')
        .includes('missions_inventoristes_check'))
      .sort()
    expect(fichiers.length, 'plus aucune migration ne pose cette contrainte').toBeGreaterThan(0)
    const dernier = readFileSync(path.join(dossierMigrations, fichiers[fichiers.length - 1]), 'utf8')
    const pose = dernier.slice(dernier.lastIndexOf('add constraint missions_inventoristes_check'))
    expect(pose, 'la contrainte exige encore un inventoriste').toMatch(/inventoristes >= 0/)
  })

  it('et la chaîne de prix du logiciel seul en rend bien zéro', () => {
    // Les deux moitiés du défaut, tenues ensemble : si la chaîne se remettait à
    // rendre des inventoristes pour une location, la contrainte ne suffirait pas.
    const c = chaineAffichee(30000, 1, 'logiciel_seul', 9)
    expect(c.inventoristes).toBe(0)
  })
})

describe('⚠️ une location se compte en appareils, pas en équipe', () => {
  /**
   * 4 octobre 2026, Julien devant l'écran d'une réservation réelle : « On parle
   * encore d'équipe, je veux heure de début d'inventaire à la place de l'heure
   * d'arrivée et nombre d'appareil à la place d'équipe ».
   *
   * Derrière le libellé, un défaut de fond : `prix_mission` rend DEUX nombres —
   * `inventoristes` (les gens envoyés, 0 en location) et `appareils` (les
   * téléphones du client). La réservation ne gardait que le premier, et
   * `plafond_mission_en_cours` — **la seule pièce d'On-Demand qui touche
   * Quantinvo OS** — comptait les appareils depuis `inventoristes`. Une
   * location ouvrait donc **zéro appareil** : le neuvième téléphone se serait
   * fait refuser le soir du comptage.
   */
  const ecran = readFileSync(
    path.resolve(__dirname, '..', 'app/on-demand/mes-inventaires/[id]/page.tsx'), 'utf8')

  it('l’écran montre l’heure de début, pas l’heure d’arrivée', () => {
    expect(ecran).toContain('Début de l’inventaire')
    expect(ecran, 'il annonce encore l’arrivée d’une équipe')
      .not.toMatch(/L’équipe arrive à/)
  })

  it('il montre des appareils, pas des inventoristes', () => {
    expect(ecran).toContain('Appareils')
    expect(ecran).toContain('mission.appareils')
    expect(ecran, 'il compte encore des inventoristes').not.toMatch(/\{mission\.inventoristes\} inventoriste/)
  })

  it('⚠️ et le plafond d’appareils compte bien les APPAREILS', () => {
    // Le libellé seul aurait menti : sans cette ligne, l'écran dirait
    // « 9 appareils » pendant que la base en ouvrirait zéro.
    const corps = derniereDefinition('plafond_mission_en_cours').corps
    expect(corps).toContain('m.appareils')
  })

  it('et la réservation écrit les deux nombres', () => {
    const corps = derniereDefinition('reserver_ma_mission').corps
    expect(corps).toMatch(/inventoristes, appareils, responsable/)
    expect(corps).toMatch(/\(v_prix ->> 'appareils'\)::integer/)
  })
})

describe('⚠️ plus personne ne se déplace : le peigne', () => {
  /**
   * Julien, 4 octobre 2026 : « je t'ai donné le cap à suivre, fait en sorte que
   * tout s'adapte, vérifie chaque recoin ». Le cap : On-Demand, c'est louer
   * Quantinvo. Personne ne se déplace.
   *
   * ⚠️ LA LISTE SE DÉDUIT : on balaie les écrans que le CLIENT voit, et on
   * refuse les phrases qui décrivent une venue. Les pages de la console
   * Quantinvo et la formule équipe — fermée, pas supprimée — ne sont pas
   * concernées : elles parlent d'un métier qui rouvrira.
   */
  const racine = path.resolve(__dirname, '..')

  /** Les écrans du parcours client On-Demand. */
  function ecransDuClient(): string[] {
    const trouves: string[] = []
    const descendre = (rel: string) => {
      for (const e of readdirSync(path.join(racine, rel), { withFileTypes: true })) {
        const r = path.join(rel, e.name)
        if (e.isDirectory()) { descendre(r); continue }
        if (e.name === 'page.tsx') trouves.push(r)
      }
    }
    descendre(path.join('app', 'on-demand'))
    return trouves
  }

  /**
   * Le code sans ses commentaires, **et sur une seule ligne**.
   *
   * ⚠️ LE SAUT DE LIGNE A FAILLI RENDRE CETTE GARDE INUTILE. Le texte fautif
   * était coupé par l'éditeur — « Sans lui, nous\n            comptons » — et
   * un motif écrit avec une espace simple ne le voyait pas. Le sabotage l'a
   * dit : la garde est restée verte avec la phrase remise. Une phrase d'écran
   * ne se cherche donc jamais telle quelle, mais après avoir écrasé les
   * espaces.
   */
  const sansCommentaires = (s: string) =>
    s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
      .replace(/\s+/g, ' ')

  it('aucun écran client n’annonce la venue de quelqu’un', () => {
    // Chaque motif a été vu à l'écran le 4 octobre, et chacun était faux.
    const interdits = [
      /L’équipe arrive/, /équipe est sur place/, /Quelqu’un pour ouvrir/,
      /rémunérons les inventoristes/, /À prévoir sur place/,
      // ⚠️ Et le « nous » qui compte : « sans lui, NOUS comptons quand même »
      // laissait croire que Quantinvo tient la douchette. C'est le client.
      /nous comptons/i, /notre équipe/i, /nos compteurs/i, /nous intervenons/i,
    ]
    const ecrans = ecransDuClient()
    expect(ecrans.length, 'plus aucun écran client On-Demand').toBeGreaterThan(2)
    for (const f of ecrans) {
      const code = sansCommentaires(readFileSync(path.join(racine, f), 'utf8'))
      for (const motif of interdits) {
        expect(motif.test(code), `${f} annonce encore une venue : ${motif}`).toBe(false)
      }
    }
  })

  it('et aucun ne compte des inventoristes à la place des appareils', () => {
    for (const f of ecransDuClient()) {
      const code = sansCommentaires(readFileSync(path.join(racine, f), 'utf8'))
      expect(code, `${f} affiche des inventoristes`).not.toMatch(/inventoriste\{/)
    }
  })
})

describe('⚠️ la console d’une mission ne parle plus d’équipe', () => {
  /**
   * Julien, 4 octobre 2026 : « on ne propose plus d'équipe donc on ne garde
   * pas ce qui y fait référence ». La console d'une mission portait deux
   * sections entières — « L'équipe — N inventoristes », avec les places vides
   * et les rémunérations, et « Qui pourrait la faire », avec Proposer et
   * Retirer. Elles sont parties, et le code vit sur
   * `on-demand-inventoristes`.
   */
  const ecran = readFileSync(
    path.resolve(__dirname, '..', 'app/admin/reservations/[id]/page.tsx'), 'utf8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    .replace(/\s+/g, ' ')

  it('plus rien n’y propose ni ne retire quelqu’un', () => {
    for (const fn of ['admin_proposer_mission', 'admin_candidats_mission',
                      'admin_retirer_de_la_mission']) {
      expect(ecran, `la console appelle encore ${fn}`).not.toContain(fn)
    }
  })

  it('elle montre ce que le client a loué', () => {
    expect(ecran).toContain('Ce que le client a loué')
    expect(ecran, 'elle compte encore une équipe').not.toMatch(/L’équipe —/)
    expect(ecran, 'elle montre encore ce qui est versé à l’équipe')
      .not.toMatch(/Versé à l’équipe/)
  })

  it('⚠️ et la base lui rend le nombre d’appareils', () => {
    // Sans ça, l'écran retombe sur `inventoristes` et affiche « 0 appareil ».
    const corps = derniereDefinition('admin_mission').corps
    expect(corps).toMatch(/'appareils', v_m\.appareils/)
  })
})

describe('⚠️ rien ne doit bloquer le client et son inventaire', () => {
  /**
   * Julien, 4 octobre 2026 : « que rien ne bloque l'user et son inventaire ».
   *
   * ⚠️ **UNE MISSION RÉSERVÉE NE BOUGEAIT JAMAIS.**
   * `admin_avancer_mission` existe en base depuis le 20 septembre, et **aucun
   * écran ne l'appelait** — vérifié sur tout le dossier `web/`. Une
   * réservation restait à « Prix calculé ». Or la session d'inventaire n'est
   * créée qu'au passage « en cours », et les appareils ne s'ouvrent que par le
   * déclencheur qui suit ce même passage. Le client réservait, payait, et
   * attendait un inventaire qui ne pouvait pas commencer.
   */
  const racine = path.resolve(__dirname, '..')

  it('la console sait faire avancer une mission', () => {
    const ecran = readFileSync(
      path.join(racine, 'app/admin/reservations/[id]/page.tsx'), 'utf8')
    expect(ecran, 'plus aucun écran ne fait avancer une mission')
      .toContain("rpc('admin_avancer_mission'")
  })

  it('⚠️ et elle sait l’ouvrir — l’état qui ouvre l’accès', () => {
    // `en_cours` n'est pas un état comme un autre : c'est lui qui déclenche
    // l'ouverture de la fenêtre, donc les appareils en plus. Sans ce
    // bouton-là, les autres ne servent à rien.
    //
    // ⚠️ AMENDÉE LE 5 OCTOBRE : elle demandait aussi que cet état CRÉE la
    // session d'inventaire. Julien a ramené On-Demand à un accès — le client
    // crée ses inventaires lui-même. Ce qui reste vrai, c'est le déclencheur.
    const ecran = readFileSync(
      path.join(racine, 'app/admin/reservations/[id]/page.tsx'), 'utf8')
    expect(ecran).toMatch(/cle: 'en_cours'/)
    const trigger = derniereDefinition('missions_accorder_les_acces').corps
    expect(trigger).toMatch(/new\.etat = 'en_cours'/)
    expect(trigger).toContain('ouvrir_les_acces_mission')
  })

  it('⚠️ la console ne recopie pas la machine d’états', () => {
    // Deux tables qui divergent, c'est un bouton qui ne marche pas. La base
    // arbitre, et la console se contente de proposer.
    //
    // ⚠️ LA GARDE LIT LE CODE SANS SES COMMENTAIRES, et elle l'a appris en
    // mordant sur le commentaire qui NOMME la fonction d'arbitrage pour
    // expliquer qu'on ne la recopie pas. Une garde qui interdit un mot
    // interdit aussi de l'expliquer.
    const ecran = readFileSync(
      path.join(racine, 'app/admin/reservations/[id]/page.tsx'), 'utf8')
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
    expect(ecran, 'la console décide elle-même des transitions permises')
      .not.toMatch(/transition_mission_permise|TRANSITIONS\s*[:=]/)
  })

  it('louer crée une vraie entreprise, avec son administrateur', () => {
    // C'est ce qui rend le client « utilisateur lambda de Quantinvo OS » : il
    // peut ensuite inviter superviseurs et compteurs comme n'importe qui.
    const corps = derniereDefinition('reserver_ma_mission').corps
    expect(corps).toMatch(/insert into public\.companies/)
    expect(corps).toMatch(/role = 'supervisor', is_company_admin = true/)
    expect(corps).toMatch(/insert into public\.stores/)
  })
})

describe('⚠️ une location est arbitrée comme une location', () => {
  /**
   * Le défaut le plus grave du parcours, trouvé en le déroulant de bout en
   * bout (4 octobre 2026), et il tenait à une ligne manquante.
   *
   * `reserver_ma_mission` calculait bien le prix en `logiciel_seul` — le JSON
   * `calcul` le disait — mais **n'écrivait pas la colonne `formule`**. Elle
   * gardait son défaut, `equipe_quantinvo`. Or c'est elle que lit
   * `missions_verifier_transition` pour choisir la machine d'états :
   *
   *   location : confirmee → prete → en_cours
   *   équipe   : confirmee → en_constitution → equipe_complete → prete
   *
   * `confirmee → prete` était donc refusé, et `en_constitution` réclame une
   * équipe qu'on ne constitue plus. **La mission ne pouvait plus avancer du
   * tout** — ni session d'inventaire, ni appareils ouverts.
   */
  it('la réservation écrit la formule, elle ne la laisse pas par défaut', () => {
    const corps = derniereDefinition('reserver_ma_mission').corps
    expect(corps, 'la colonne `formule` n’est pas dans l’insert').toMatch(/formule, inventoristes/)
    expect(corps).toMatch(/coalesce\(v_prix ->> 'formule', 'logiciel_seul'\)/)
  })

  it('⚠️ et le déclencheur arbitre AVEC elle', () => {
    // S'il retombait sur le défaut de la fonction (`equipe_quantinvo`), écrire
    // la colonne ne servirait à rien.
    const corps = derniereDefinition('missions_verifier_transition').corps
    expect(corps).toMatch(/transition_mission_permise\(old\.etat, new\.etat, new\.formule\)/)
  })

  it('le parcours de la location va bien jusqu’à « en cours »', () => {
    // Les deux maillons qui portent tout le reste : la session d'inventaire
    // naît à `en_cours`, et les appareils s'ouvrent dans la foulée.
    const machine = derniereDefinition('transition_mission_permise').corps
    const partie = machine.slice(machine.indexOf("'logiciel_seul'"))
    expect(partie).toMatch(/when 'confirmee'\s*then array\['prete'/)
    expect(partie).toMatch(/when 'prete'\s*then array\['en_cours'/)
  })
})

describe('⚠️ une réservation ouvre un accès, elle ne crée rien', () => {
  /**
   * Cette garde en REMPLACE deux, et il faut dire lesquelles : « un seul
   * inventaire, et il naît avec la réservation » et « un inventaire loué est
   * toujours par zones ». Elles défendaient un choix que j'avais proposé — la
   * réservation crée l'inventaire — et Julien l'a renversé le 5 octobre 2026 :
   *
   *   « On veut juste que On-Demand donne accès à Quantinvo OS juste le temps
   *   d'un inventaire, c'est tout, le reste doit être la même chose que pour
   *   un utilisateur lambda. Ce qui change c'est la facturation et la durée
   *   d'utilisation. »
   *   « Une réservation ne crée pas automatiquement l'inventaire, c'est le
   *   client qui créera son inventaire. »
   *
   * ⚠️ Ce que je construisais était plus compliqué que le produit : j'en étais
   * à débattre du mode de comptage « puisque personne n'est là pour choisir »,
   * alors qu'il y a toujours quelqu'un — le client.
   */
  it('la réservation ne crée aucun inventaire', () => {
    const corps = derniereDefinition('reserver_ma_mission').corps.replace(/--.*$/gm, ' ')
    expect(corps, 'la réservation crée encore un inventaire')
      .not.toContain('creer_la_session_de_mission')
  })

  it('l’ouverture de l’accès non plus', () => {
    const corps = derniereDefinition('admin_avancer_mission').corps.replace(/--.*$/gm, ' ')
    expect(corps).not.toContain('creer_la_session_de_mission')
  })

  it('⚠️ et l’accès s’ouvre SANS qu’un inventaire existe', () => {
    // Le piège : `ouvrir_les_acces_mission` sortait en premier si la mission
    // n'avait pas de session. Sans inventaire créé d'office, la fenêtre ne se
    // serait jamais ouverte — donc aucun appareil en plus, jamais.
    const corps = derniereDefinition('ouvrir_les_acces_mission').corps.replace(/--.*$/gm, ' ')
    expect(corps, 'l’accès dépend encore d’un inventaire')
      .not.toMatch(/if not found or v_m\.inventory_session_id is null/)
  })

  it('⚠️ la fenêtre est celle qu’on vend : la semaine, depuis la date choisie', () => {
    // Elle valait « début + durée estimée + 2 h » — une nuit, le modèle de
    // l'équipe qui vient et repart. Et elle partait du jour où Quantinvo
    // appuie sur le bouton : mesuré, une réservation du 20 ouverte le 5
    // donnait 22 jours.
    const corps = derniereDefinition('ouvrir_les_acces_mission').corps.replace(/--.*$/gm, ' ')
    expect(corps).toMatch(/v_fin := v_m\.debut_prevu \+ make_interval\(days =>/)
    expect(corps, 'la fenêtre dure encore une nuit')
      .not.toMatch(/duree_prevue_minutes/)
    expect(corps).toMatch(/greatest\(now\(\), v_m\.debut_prevu\)/)
  })

  it('⚠️ et au bout des sept jours, l’inventaire se clôture — pas se supprime', () => {
    const corps = derniereDefinition('cloturer_les_inventaires_hors_fenetre').corps
    expect(corps).toMatch(/set status = 'closed'/)
    expect(corps.toLowerCase(), 'la tâche supprime au lieu de clôturer')
      .not.toContain('delete from')
    // Et seulement ce qui est né dans la fenêtre : un inventaire d'avant la
    // réservation ne la regarde pas.
    expect(corps).toMatch(/s\.created_at >= f\.acces_ouverts_le/)
  })

  it('une tâche l’exécute, et toutes les heures', () => {
    // Une fenêtre se referme à l'heure près — 20:00 ou 22:00 sept jours plus
    // tard. Une tâche nocturne laisserait l'inventaire ouvert jusqu'au matin.
    // ⚠️ **ON CHERCHE LA TÂCHE, PAS LE FICHIER QUI DÉFINIT LA FONCTION**
    // (corrigé le 7 octobre 2026). La garde lisait `fichierDe(…)` : le jour où
    // une autre migration a redéfini la fonction de clôture, ce helper a rendu
    // CETTE migration — qui programme une autre tâche — et la garde est tombée
    // sur du code juste. La programmation vit où elle a été posée ; on la
    // cherche dans toutes les migrations, et c'est la dernière qui compte.
    const posees = readdirSync(dossierMigrations)
      .filter((n) => n.endsWith('.sql')).sort()
      .map((n) => sansCommentaires(readFileSync(path.join(dossierMigrations, n), 'utf8')))
      .filter((sql) => /cron\.schedule\(\s*'cloturer-hors-fenetre'/.test(sql))
    expect(posees.length, 'plus aucune migration ne programme la clôture').toBeGreaterThan(0)
    const derniere = posees[posees.length - 1]
    expect(derniere).toMatch(/cron\.schedule\(\s*'cloturer-hors-fenetre',\s*'5 \* \* \* \*'/)
    expect(derniere, 'rejouer la migration créerait un doublon')
      .toMatch(/cron\.unschedule\('cloturer-hors-fenetre'\)/)
  })

  it('l’écran ne mène plus à un inventaire désigné', () => {
    const ecran = readFileSync(path.resolve(
      __dirname, '..', 'app/on-demand/mes-inventaires/[id]/page.tsx'), 'utf8')
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ').replace(/\s+/g, ' ')
    expect(ecran, 'il vise encore l’inventaire de la réservation')
      .not.toMatch(/dashboard\/\$\{mission\.inventory_session_id\}/)
    expect(ecran).toMatch(/Créez votre inventaire depuis votre tableau de bord/)
  })
})

describe('⚠️ les liens d’On-Demand mènent quelque part', () => {
  /**
   * 4 octobre 2026, en préparant un inventaire réservé pour de vrai : le
   * bouton « Préparer l'inventaire » rendait **404**. Les écrans On-Demand
   * pointaient vers `/inventaire/{id}`, et la route du produit est
   * `/dashboard/{id}`. Trois liens morts : préparer, suivre en direct, ouvrir
   * le rapport.
   *
   * ⚠️ **ET LA PREMIÈRE VERSION DE CETTE GARDE NE MORDAIT PAS.** Elle
   * vérifiait que le premier segment existe dans `app/` — or `inventaire`
   * existe : c'est la page vitrine. Ce qui manquait, c'est le `[id]` DERRIÈRE.
   * Le sabotage l'a dit : verte avec le lien mort remis. Une garde qui
   * contrôle le dossier parent ne contrôle pas la route.
   *
   * La liste SE DÉDUIT : on relève les liens internes des écrans On-Demand, et
   * un lien dynamique exige un segment dynamique dans le dossier visé.
   */
  const racine = path.resolve(__dirname, '..')

  /** Les liens internes des écrans On-Demand : leur cible, et s'ils sont dynamiques. */
  function liensInternes(): { fichier: string; cible: string; dynamique: boolean }[] {
    const trouves: { fichier: string; cible: string; dynamique: boolean }[] = []
    const descendre = (rel: string) => {
      for (const e of readdirSync(path.join(racine, rel), { withFileTypes: true })) {
        const r = path.join(rel, e.name)
        if (e.isDirectory()) { descendre(r); continue }
        if (!/\.tsx?$/.test(e.name)) continue
        const code = readFileSync(path.join(racine, r), 'utf8')
          .split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')
        for (const m of code.matchAll(/href=[{"]`?\/([a-z0-9-]+)(\/\$\{)?/gi)) {
          trouves.push({ fichier: r, cible: m[1], dynamique: Boolean(m[2]) })
        }
      }
    }
    descendre(path.join('app', 'on-demand'))
    descendre(path.join('app', 'reserver'))
    return trouves
  }

  it('aucun ne mène à une route inexistante', () => {
    const app = path.join(racine, 'app')
    const dossiers = new Set(readdirSync(app, { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name))
    const liens = liensInternes()
    expect(liens.length, 'plus aucun lien interne dans les écrans On-Demand').toBeGreaterThan(3)

    const morts = liens.filter(({ cible, dynamique }) => {
      if (!dossiers.has(cible)) return true
      if (!dynamique) return false
      // ⚠️ Un lien `/cible/${x}` exige un segment dynamique DANS `cible`.
      return !readdirSync(path.join(app, cible), { withFileTypes: true })
        .some((d) => d.isDirectory() && d.name.startsWith('['))
    })
    expect(morts.map((m) => `${m.fichier} → /${m.cible}${m.dynamique ? '/…' : ''}`),
      'liens vers une route qui n’existe pas').toEqual([])
  })
})

describe('⚠️ un inventaire loué travaille par zones', () => {
  /**
   * 5 octobre 2026, vu à l'écran sur une réservation réelle : « Mode :
   * Classique (sans balise) ». `creer_la_session_de_mission` décidait du mode
   * par `inventoristes >= 3` — les gens qu'on envoyait. En location ce nombre
   * vaut **0** par construction, donc tout inventaire loué naissait sans
   * zones, **même à neuf téléphones**.
   *
   * Les zones répartissent le magasin et font suivre l'avancement : à neuf
   * compteurs sans elles, personne ne sait qui compte quoi, et deux personnes
   * recomptent le même rayon.
   */
  it('⚠️ le mode ne dépend d’AUCUN seuil', () => {
    // Julien, 5 octobre 2026 : « c'est la norme ». La règle a tenu deux formes
    // fausses — `inventoristes >= 3`, puis `appareils >= 3`, qui corrigeait le
    // nombre lu et gardait le seuil. Sur une mission, personne n'est là pour
    // choisir : un seuil livrerait au client un inventaire moins bien rangé
    // que celui qu'il aurait créé lui-même.
    //
    // ⚠️ SANS SES COMMENTAIRES : ceux-ci CITENT les deux seuils écartés pour
    // expliquer pourquoi ils le sont, et une garde qui interdit un motif
    // interdirait aussi de l'expliquer. Troisième fois aujourd'hui.
    const corps = derniereDefinition('creer_la_session_de_mission').corps
      .replace(/--.*$/gm, ' ')
    const insert = corps.slice(corps.indexOf('insert into public.inventory_sessions'))
    expect(insert, 'le mode dépend encore d’un seuil').not.toMatch(/>= 3/)
    expect(insert).toMatch(/\n\s*true,\n/)
  })
})

describe('⚠️ un inventaire ouvert à la fois, sur un magasin loué', () => {
  /**
   * 5 octobre 2026. Julien déroule le parcours à voix haute : « comme j'ai
   * réservé pour un inventaire sur deux magasins, je peux n'avoir qu'une
   * session d'inventaire à la fois par magasin ». Il l'énonçait comme acquis.
   * `create_session` ne vérifie rien de tel : dix inventaires ouverts sur le
   * même magasin passaient.
   *
   * ⚠️ Et la règle ne vaut QUE pour les locations — son choix, posé en
   * connaissance de la contrepartie. Un abonné paie un abonnement avec des
   * appareils, pas « un inventaire ».
   */
  const regle = () => derniereDefinition('un_seul_inventaire_sur_un_magasin_loue').corps

  it('la règle vit à côté de Quantinvo OS, pas dans create_session', () => {
    // ⚠️ `create_session` est appelée par l'app ET par le site de tous les
    // abonnés. Y glisser la règle la ferait valoir pour eux aussi.
    const fautes = readdirSync(dossierMigrations)
      .filter((f) => f.endsWith('.sql') && f >= '20261005170001')
      .filter((f) => sansCommentaires(readFileSync(path.join(dossierMigrations, f), 'utf8'))
        .match(/create (?:or replace )?function public\.create_session\s*\(/i))
    expect(fautes, fautes.join('\n')).toEqual([])
  })

  it('⚠️ elle reconnaît une location à sa FENÊTRE, sans citer un seul état', () => {
    // Deux fausses pistes écartées : `plafond_appareils() is null` seul (il rend
    // `null` aussi pour le plan `standard`, absent de sa liste de cas), et une
    // liste d'états morts (`missions_etat_check` en compte seize). Dès qu'une
    // mission meurt, `fermer_les_acces_mission` pose une date passée.
    const corps = sansCommentaires(regle())
    expect(corps).toMatch(/acces_expirent_le is null or m\.acces_expirent_le > now\(\)/)
    const etats = [...readFileSync(
      path.join(dossierMigrations, '20260920130001_on_demand_la_mission.sql'), 'utf8')
      .matchAll(/'(brouillon|prix_calcule|confirmee|prete|en_cours|terminee|annulee|remboursee|echouee)'/g)]
      .map((m) => m[1])
    expect(etats.length, 'les états ne se lisent plus dans la migration de la mission')
      .toBeGreaterThan(5)
    const cites = [...new Set(etats)].filter((e) => corps.includes(`'${e}'`))
    expect(cites, `la règle cite des états : ${cites.join(', ')}`).toEqual([])
  })

  it('⚠️ un abonné qui n’a jamais loué ne lit jamais la suite', () => {
    // C'est ce test-là qui tient la règle hors de Quantinvo OS : il sort AVANT
    // tout le reste. Inverser l'ordre la ferait porter sur tout le monde.
    const corps = sansCommentaires(regle())
    const sortie = corps.indexOf('return new;')
    expect(corps.indexOf('from public.missions')).toBeLessThan(sortie)
    expect(corps.indexOf('from public.inventory_sessions')).toBeGreaterThan(sortie)
  })

  it('et elle lâche le client qui s’est abonné depuis', () => {
    const corps = sansCommentaires(regle())
    expect(corps).toMatch(/plafond_appareils\(new\.store_id\) is not null/)
  })

  it('elle REFUSE, elle ne clôture ni ne supprime rien', () => {
    const corps = sansCommentaires(regle()).toLowerCase()
    expect(corps).toContain('raise exception')
    expect(corps, 'la règle écrit au lieu de refuser').not.toContain('update public.')
    expect(corps, 'la règle efface').not.toContain('delete from')
  })

  it('son refus a sa traduction anglaise', async () => {
    const message = regle().match(/raise exception '((?:[^']|'')+)'/)?.[1].replace(/''/g, "'")
    expect(message).toBeTruthy()
    const { ERREURS_SERVEUR } = await import('../lib/erreursServeur')
    expect(Object.keys(ERREURS_SERVEUR), `« ${message} » n’est pas traduit`).toContain(message)
  })

  it('⚠️ la tâche horaire de la fenêtre sait se retirer, elle aussi', () => {
    // Manque trouvé le 5 octobre en relisant le retrait : `cloturer_les_…`
    // ÉCRIT dans `inventory_sessions` toutes les heures. Laissée programmée
    // après le retrait d'On-Demand, elle échoue chaque heure sur une table
    // `missions` disparue.
    const retrait = lire('scripts/replique/90-retirer.sql')
    expect(retrait).toContain("cron.unschedule('cloturer-hors-fenetre')")
    expect(retrait).toContain('drop function if exists public.cloturer_les_inventaires_hors_fenetre()')
  })

  it('⚠️ et la migration qui la programme se rejoue sans pg_cron', () => {
    // `scripts/replique/verifier.sh` rejoue les VRAIES migrations sur une base
    // locale, qui n'a pas l'extension — et il s'arrête au premier échec. Une
    // migration qu'on ne peut pas rejouer est une migration qu'on n'éprouve pas.
    const fichier = fichierDe('cloturer_les_inventaires_hors_fenetre')
    expect(fichier).toMatch(/if not exists \(select 1 from pg_namespace where nspname = 'cron'\)/)
  })
})

describe('⚠️ celui qui paie devient le client', () => {
  /**
   * 5 octobre 2026, cas soumis à Julien : un pro déjà connu de Quantinvo comme
   * COMPTEUR chez un de ses clients, qui loue à son tour pour son propre
   * inventaire. Sa réservation partait au nom de l'entreprise qui l'avait
   * invité, puis `create_session` lui répondait « Accès refusé » — elle exige
   * le rôle superviseur. Argent pris, inventaire impossible.
   *
   * Sa réponse : « c'est le compte client que l'on garde, celui qui a payé, pas
   * celui qui participe à un inventaire ».
   */
  it('un compteur qui réserve est traité comme un nouveau venu', () => {
    const corps = sansCommentaires(derniereDefinition('reserver_ma_mission').corps)
    // Le rôle est lu…
    expect(corps).toMatch(/select p\.company_id, p\.role into v_company, v_role/)
    // …et il remet l'entreprise à zéro, ce qui rouvre l'embranchement existant.
    expect(corps).toMatch(/if v_role = '\w+' then\s*v_company := null;/)
  })

  /**
   * ⚠️⚠️ **LA GARDE DÉDUIT LE RÔLE, ELLE NE LE CITE PAS** — et c'est la faute
   * que j'ai faite. Première version de la règle écrite avec `counter` : le
   * vocabulaire de `session_members.role`, pas celui de `profiles`, dont la
   * contrainte ne connaît que `supervisor` et `employee`. La règle compilait,
   * s'appliquait, et ne mordait jamais. Rien dans le code ne le disait ; c'est
   * la base qui a refusé le `update` de préparation du contrôle.
   */
  it('⚠️ et le rôle qu’elle nomme existe dans profiles', () => {
    const schema = readFileSync(
      path.join(dossierMigrations, '20260526000001_initial_schema.sql'), 'utf8')
    const liste = schema.match(/role text NOT NULL DEFAULT '\w+' CHECK \(role IN \(([^)]+)\)\)/)
    expect(liste, 'la contrainte de rôle ne se lit plus dans le schéma initial').toBeTruthy()
    const roles = [...liste![1].matchAll(/'(\w+)'/g)].map((m) => m[1])
    expect(roles).toContain('supervisor')
    const corps = sansCommentaires(derniereDefinition('reserver_ma_mission').corps)
    const nomme = corps.match(/if v_role = '(\w+)' then\s*v_company := null;/)?.[1]
    expect(roles, `« ${nomme} » n’est pas un rôle de profiles`).toContain(nomme)
    // Et ce n'est pas le superviseur : lui paie pour son entreprise.
    expect(nomme).not.toBe('supervisor')
  })

  it('et l’embranchement le fait superviseur et administrateur', () => {
    const corps = sansCommentaires(derniereDefinition('reserver_ma_mission').corps)
    const branche = corps.slice(corps.indexOf('if v_company is null then'))
    expect(branche).toMatch(/role = 'supervisor'/)
    expect(branche).toMatch(/is_company_admin = true/)
  })
})

describe('⚠️ la porte des missions ne s’ouvre pas sur la comptabilité', () => {
  /**
   * ⚠️⚠️ 5 octobre 2026, et le défaut était à moi. Pour réparer un
   * « permission denied for table missions », j'avais écrit la veille
   * `grant select on public.missions to authenticated` — **sans liste de
   * colonnes, donc sur les 47**, ce qui supersède le grant nominatif posé le
   * 20 septembre. Le client lisait `cout_cents`, `calcul` (la rémunération
   * d'une équipe), `reglages_version` et `stripe_payment_intent_id`.
   *
   * Aucun contrôle ne l'a vu : ni la garde de séparation, ni l'analyseur de
   * Supabase (un grant n'est pas un défaut de RLS). C'est un SCÉNARIO de la
   * réplique qui a répondu `1900` à « ne voit PAS ce qu'elle nous coûte » —
   * et il ne posait plus la question depuis un jour, parce qu'il mourait
   * seize lignes plus haut.
   *
   * ⚠️ LA GARDE REJOUE LES GRANTS DANS L'ORDRE DES FICHIERS, elle ne cherche
   * pas une phrase. C'est le seul moyen de connaître le droit EFFECTIF : quatre
   * migrations parlent de cette table.
   *
   * ⚠️⚠️ **ET UN `grant select (…)` S'AJOUTE, IL NE REMPLACE PAS** (corrigé le
   * 7 octobre 2026). Cette garde modélisait chaque grant nominatif comme un
   * remplacement : elle tenait tant qu'une seule migration en posait un. Le
   * jour où une seconde a ouvert quatre colonnes de facture, la garde a cru
   * que le client n'en lisait plus que quatre — elle est tombée sur du code
   * juste, et elle serait tombée du bon côté par hasard. Postgres, lui,
   * cumule : seul un `revoke` retire. Vérifié dans
   * `information_schema.column_privileges` sur le projet d'essai — 44 colonnes
   * lisibles avant, 48 après, et non 4.
   */
  const droitEffectif = (): { colonnes: Set<string> | 'toutes'; dernier: string } => {
    let colonnes: Set<string> | 'toutes' = new Set<string>()
    let dernier = '—'
    for (const f of readdirSync(dossierMigrations).filter((n) => n.endsWith('.sql')).sort()) {
      const sql = sansCommentaires(readFileSync(path.join(dossierMigrations, f), 'utf8'))
      for (const m of sql.matchAll(
        /(grant|revoke)\s+select\s*(\(([^)]*)\))?\s*(?:on|from)?\s*(?:on\s+)?(?:table\s+)?public\.missions\s+(?:to|from)\s+([^;]+);/gi)) {
        const [, verbe, , liste, cibles] = m
        if (!/authenticated/i.test(cibles)) continue
        dernier = f
        const nommees = (liste ?? '').split(',').map((c) => c.trim()).filter(Boolean)
        if (verbe.toLowerCase() === 'revoke') {
          // Un `revoke select` sans liste retire TOUT ; avec une liste, il ne
          // retire que celles-là.
          if (nommees.length === 0 || colonnes === 'toutes') colonnes = new Set<string>()
          else for (const c of nommees) (colonnes as Set<string>).delete(c)
        } else if (nommees.length > 0) {
          if (colonnes !== 'toutes') {
            for (const c of nommees) (colonnes as Set<string>).add(c)
          }
        } else colonnes = 'toutes'
      }
    }
    return { colonnes, dernier }
  }

  it('⚠️ le droit est nominatif — jamais la table entière', () => {
    const { colonnes, dernier } = droitEffectif()
    expect(colonnes, `le dernier grant (${dernier}) porte sur toutes les colonnes`).not.toBe('toutes')
    expect((colonnes as Set<string>).size).toBeGreaterThan(20)
  })

  it('et il laisse des colonnes dehors', () => {
    // Sans cette borne, une liste qui énumérerait les 47 colonnes passerait le
    // test précédent tout en rouvrant la porte.
    const { colonnes } = droitEffectif()
    // Les colonnes de la table : celles du `create table`, plus celles ajoutées
    // depuis. Déduites des migrations, pas recopiées.
    const toutes = new Set<string>()
    for (const f of readdirSync(dossierMigrations).filter((n) => n.endsWith('.sql')).sort()) {
      const sql = sansCommentaires(readFileSync(path.join(dossierMigrations, f), 'utf8'))
      const creation = sql.match(/create table (?:if not exists )?public\.missions\s*\(([\s\S]*?)\n\);/i)
      if (creation) {
        for (const ligne of creation[1].split('\n')) {
          const col = ligne.match(/^\s{2,}(\w+)\s+\w/)
          if (col && !/^(primary|unique|check|constraint|foreign)$/i.test(col[1])) toutes.add(col[1])
        }
      }
      for (const m of sql.matchAll(/alter table (?:if exists )?public\.missions\s+add column (?:if not exists )?(\w+)/gi)) {
        toutes.add(m[1])
      }
    }
    expect(toutes.size, 'les colonnes de missions ne se lisent plus').toBeGreaterThan(30)
    const dehors = [...toutes].filter((c) => !(colonnes as Set<string>).has(c))
    expect(dehors.length, 'plus aucune colonne de missions n’est retenue').toBeGreaterThan(0)
  })

  it('⚠️ et ce que le client lit à l’écran est bien dans le droit', () => {
    // L'autre moitié : refermer trop fort casse « Vos inventaires », et le
    // refus serait un « permission denied » illisible.
    const { colonnes } = droitEffectif()
    const src = lire('web/lib/onDemandClient.ts')
    const bloc = src.slice(src.indexOf('const COLONNES'), src.indexOf('ETATS_PASSES'))
    const lues = [...bloc.matchAll(/'([a-z_,]+)'/g)].flatMap((m) => m[1].split(',')).filter(Boolean)
    expect(lues.length, 'les colonnes lues par le client ne se lisent plus').toBeGreaterThan(15)
    const manquantes = lues.filter((c) => !(colonnes as Set<string>).has(c))
    expect(manquantes, `le client lit sans droit : ${manquantes.join(', ')}`).toEqual([])
  })
})

describe('⚠️ le tunnel réserve pour de vrai', () => {
  /**
   * ⚠️⚠️ 5 octobre 2026. Julien : « un pro qui revient avec une adresse connue
   * en tant que client doit pouvoir louer Quantinvo s'il le souhaite ».
   *
   * En cherchant où brancher ce cas, un trou plus large : **le tunnel ne créait
   * aucune réservation.** Son seul appel serveur était l'envoi d'un code
   * d'inscription ; `reserver_ma_mission` n'était appelée de nulle part dans le
   * site. L'écran d'arrivée affirmait pourtant « Votre réservation est
   * enregistrée avec ce prix », pour un visiteur comme pour un client connecté.
   */
  const tunnel = () => lire('web/components/vitrine/PageReserver.tsx')
  const client = () => lire('web/lib/onDemandClient.ts')

  it('⚠️ le tunnel appelle bien la fonction qui réserve', () => {
    expect(client()).toMatch(/rpc\('reserver_ma_mission'/)
    expect(tunnel(), 'l’écran ne réserve pas').toMatch(/reserverMaMission\(/)
  })

  it('⚠️ et il n’envoie aucun montant', () => {
    // « Laisser le client porter un montant, c'est le laisser réserver à un
    // centime » (docs/notes/074). Le prix est recalculé par `prix_mission`.
    const appel = client().slice(client().indexOf('p_reponses:'))
    const bloc = appel.slice(0, appel.indexOf('})'))
    expect(bloc, 'le navigateur porte un prix').not.toMatch(/prix|cents|montant|total/i)
  })

  it('⚠️ les deux boutons « Réserver » portent le verrou de vente', () => {
    // Celui de l'écran du prix l'avait, celui du récapitulatif NON — et tant
    // que rien n'était enregistré, ça ne se voyait pas.
    const src = tunnel().replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    const boutons = [...src.matchAll(/<button[\s\S]{0,400}?>[\s\S]{0,200}?Réserver[\s\S]{0,40}?<\/button>/g)]
      .map((m) => m[0])
    expect(boutons.length, 'les boutons de réservation ne se lisent plus').toBeGreaterThan(1)
    const nus = boutons.filter((b) => !/venteOuverte\(\)|disabled>/.test(b))
    expect(nus, `un bouton réserve sans verrou de vente : ${nus.join(' | ')}`).toEqual([])
  })

  it('⚠️ chaque refus de la base a sa phrase', () => {
    // Les codes se lisent dans les deux fonctions, ils ne se citent pas ici.
    const codes = new Set<string>()
    for (const fn of ['reserver_ma_mission', 'prix_mission']) {
      for (const m of derniereDefinition(fn).corps.matchAll(/'code'\s*,\s*'(\w+)'/g)) codes.add(m[1])
    }
    expect(codes.size, 'les codes de refus ne se lisent plus').toBeGreaterThan(8)
    const src = client()
    const table = src.slice(src.indexOf('REFUS_RESERVATION'), src.indexOf('export async function reserverMaMission'))
    const sans = [...codes].filter((c) => !new RegExp(`\\b${c}:`).test(table))
    expect(sans, `refus sans phrase : ${sans.join(', ')}`).toEqual([])
  })

  it('⚠️ l’écran d’arrivée ne dit « enregistrée » que si elle l’est', () => {
    // ⚠️ **LA GARDE DÉCOUPE LES BRANCHES, ELLE NE CITE PLUS LEUR CONDITION**
    // (reprise le 7 octobre 2026). Elle exigeait `etape === 7 && reference` mot
    // pour mot : le jour où la carte est devenue ce qui ouvre les accès, le
    // discriminant est passé à l'identifiant de la mission, et la garde est
    // tombée sur du code juste. Ce qu'elle doit tenir n'a pas changé : une
    // branche qui annonce une réservation doit être conditionnée par une preuve
    // venue du SERVEUR, pas par le simple fait d'être arrivé à l'étape 7.
    const src = tunnel()
    const branches = [...src.matchAll(/\{etape === 7([^(]*)\(([\s\S]*?)\n        \)\}/g)]
      // ⚠️ SANS LES COMMENTAIRES : la branche du visiteur en porte un qui dit
      // « la réservation reprend ici ». Une garde qui lit le texte brut se
      // satisfait du commentaire — ou, ici, se fâche contre lui.
      .map((m) => ({
        condition: m[1],
        // ⚠️ **ET SANS LES LIBELLÉS DE GESTES** (10 octobre 2026). Ce que cette
        // garde protège est une AFFIRMATION — « votre réservation est
        // enregistrée » quand elle ne l'est pas. Un bouton, lui, ne dit pas ce
        // qui EST : il dit ce que le clic fera. Le jour où la branche du
        // visiteur a reçu son bouton « Confirmer et réserver » — celui qui
        // manquait, et sans lequel un prospect était en cul-de-sac — la garde
        // est tombée sur du code juste. Troisième fois qu'elle est reprise, et
        // toujours pour la même raison : elle lisait des MOTS là où elle doit
        // lire une STRUCTURE.
        contenu: sansCommentaires(m[2])
          .replace(/<(button|Link)\b[\s\S]*?<\/\1>/g, ' ')
          .replace(/\s+/g, ' '),
      }))
    expect(branches.length, 'les branches de l’écran d’arrivée ne se lisent plus')
      .toBeGreaterThan(1)

    // Les preuves possibles : ce que `reserverMaMission` rend, et rien d'autre.
    const client = lire('web/lib/onDemandClient.ts')
    const rendu = /return \{\s*\n?\s*ok: true,([\s\S]*?)\n  \}/.exec(
      client.slice(client.indexOf('export async function reserverMaMission')))
    const preuves = [...(rendu?.[1] ?? '').matchAll(/^\s*(\w+)[,:]/gm)].map((m) => m[1])
    expect(preuves.length, 'ce que rend la réservation ne se lit plus').toBeGreaterThan(1)

    for (const b of branches) {
      if (!/réserv|enregistr/i.test(b.contenu)) continue
      const adossee = preuves.some((p) => new RegExp(`&&\\s*${p}\\b`).test(b.condition))
      expect(adossee, `une branche annonce une réservation sans preuve du serveur :`
        + ` « ${b.condition.trim()} »`).toBe(true)
    }
  })

  it('⚠️ la raison sociale se demande sur refus du serveur, elle ne se devine pas', () => {
    const src = sansCommentaires(tunnel())
    expect(src).toMatch(/r\.code === 'entreprise'/)
    // Et la page ne rejoue pas la règle de la base en relisant le rôle.
    expect(src, 'l’écran recopie la règle du serveur').not.toMatch(/'employee'|'counter'/)
  })

  it('⚠️ le retour de l’e-mail est une liste blanche, pas un chemin recopié', () => {
    // Un chemin pris dans le corps de la requête ferait de ce bouton une
    // redirection ouverte signée Quantinvo.
    const fn = lire('supabase/functions/inscription/index.ts')
    expect(fn).toMatch(/RETOURS: Record<string, \{ chemin: string; libelle: string \}>/)
    expect(fn).toMatch(/RETOURS\[texte\('retour'\)\] \?\? \{ chemin: '\/login'/)
    // ⚠️ L'ANCRE DOIT EXISTER AVANT D'ÊTRE LUE. Première version :
    // `fn.slice(fn.indexOf(…))` — `indexOf` rend -1 quand la ligne a disparu,
    // `slice(-1)` rend le dernier caractère, et la garde passait au vert sur un
    // fichier saboté. Trouvé en la sabotant, pas en la relisant.
    const i = fn.indexOf('bouton: { libelle: retour.libelle')
    expect(i, 'le bouton ne passe plus par la liste blanche').toBeGreaterThan(-1)
    // Et rien, nulle part, n'interpole une valeur de la requête dans un lien.
    expect(fn, 'un lien d’e-mail est bâti sur une valeur recopiée')
      .not.toMatch(/lien:\s*`[^`]*\$\{\s*texte\(/)
    // Et les deux tunnels disent d'où ils viennent.
    expect(lire('web/components/vitrine/PageReserver.tsx')).toMatch(/retour: 'reserver'/)
    expect(lire('web/components/vitrine/PageInscription.tsx')).toMatch(/retour: 'inscription'/)
  })
})

describe('⚠️ ce que le navigateur envoie, la base le lit', () => {
  /**
   * ⚠️⚠️ **UNE CLÉ MAL NOMMÉE NE LÈVE RIEN.** `p_reponses ->> 'code_postal'`
   * sur un objet qui porte `codePostal` rend `null`, et la réservation est
   * refusée pour une raison qui ne dit pas laquelle — ou pire, passe avec une
   * surface vide. Aucun type ne protège : c'est du JSON des deux côtés.
   *
   * La garde lit les clés que la fonction DEMANDE, dans la définition qui
   * tourne, et vérifie que l'appel les envoie toutes. Elle ne cite rien.
   */
  it('chaque clé lue par reserver_ma_mission est envoyée', () => {
    const corps = derniereDefinition('reserver_ma_mission').corps
    const lues = new Set([...corps.matchAll(/p_reponses\s*->>\s*'(\w+)'/g)].map((m) => m[1]))
    expect(lues.size, 'les clés lues par la base ne se lisent plus').toBeGreaterThan(12)

    const src = lire('web/lib/onDemandClient.ts')
    const appel = src.slice(src.indexOf('p_reponses: {'))
    const envoi = appel.slice(0, appel.indexOf('\n    },'))
    const envoyees = new Set([...envoi.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]))

    const oubliees = [...lues].filter((c) => !envoyees.has(c))
    expect(oubliees, `clés lues par la base mais jamais envoyées : ${oubliees.join(', ')}`).toEqual([])
  })

  it('et rien n’est envoyé que la base ne lise', () => {
    // L'autre sens : une clé inventée côté navigateur est du bruit, et elle
    // laisse croire qu'une réponse a été transmise.
    const corps = derniereDefinition('reserver_ma_mission').corps
    const lues = new Set([...corps.matchAll(/p_reponses\s*->>\s*'(\w+)'/g)].map((m) => m[1]))
    const src = lire('web/lib/onDemandClient.ts')
    const appel = src.slice(src.indexOf('p_reponses: {'))
    const envoi = appel.slice(0, appel.indexOf('\n    },'))
    const envoyees = [...envoi.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1])
    expect(envoyees.length, 'l’appel ne se lit plus').toBeGreaterThan(12)
    const inutiles = envoyees.filter((c) => !lues.has(c))
    expect(inutiles, `envoyées mais jamais lues : ${inutiles.join(', ')}`).toEqual([])
  })
})

/**
 * ⚠️⚠️ **LE VOLUME ANNONCÉ DÉSIGNE LA TRANCHE, ET IL EST SEUL À LE FAIRE.**
 *
 * Le tunnel offrait huit boutons de tranche ; depuis le 10 octobre 2026 il
 * demande un NOMBRE, et la tranche s'en déduit — exactement comme en base.
 * Deux choses doivent tenir, et elles sont indépendantes :
 *
 *  1. le site et la base choisissent la MÊME tranche pour un nombre donné ;
 *  2. le compteur d'appareils ne garde AUCUNE mémoire du volume précédent.
 */
describe('⚠️ le volume annoncé désigne la tranche', () => {
  it('la grille est triée par plafond croissant', () => {
    // `trancheDesPieces` prend la PREMIÈRE tranche qui couvre : une liste mal
    // ordonnée lui ferait rendre une tranche trop chère, sans rien casser.
    const plafonds = TRANCHES_ARTICLES.map((t) => t.max)
    expect(plafonds, 'la grille n’est plus triée')
      .toEqual([...plafonds].sort((a, b) => a - b))
    expect(PLAFOND_PIECES).toBe(plafonds[plafonds.length - 1])
  })

  it('⚠️ le site choisit la tranche que la base choisirait', () => {
    // La base : `plafond_articles >= p_articles_max order by plafond_articles
    // asc limit 1`. La garde la RELIT dans la migration plutôt que de la citer.
    const { corps } = derniereDefinition('prix_mission')
    const requete = corps.match(
      /from public\.tranches_prix\s+where[^;]*?plafond_articles\s*>=\s*p_articles_max[^;]*?order by\s+plafond_articles\s+asc\s+limit 1/i)
    expect(requete, 'la base ne cherche plus la première tranche qui couvre').toBeTruthy()

    // Un point dans chaque tranche, et les deux bords de chacune.
    const bords = TRANCHES_ARTICLES.flatMap((t) => [t.min + 1, t.max - 1, t.max])
    for (const v of bords) {
      const attendue = TRANCHES_ARTICLES.find((t) => t.max >= v)
      expect(trancheDesPieces(v)?.cle, `${v} pièces`).toBe(attendue?.cle)
    }
  })

  it('rien en dessous de 1 pièce, rien au-dessus du dernier plafond', () => {
    for (const v of [0, -1, Number.NaN]) expect(trancheDesPieces(v)).toBeNull()
    expect(trancheDesPieces(PLAFOND_PIECES)).not.toBeNull()
    expect(trancheDesPieces(PLAFOND_PIECES + 1), 'au-delà, ça se parle').toBeNull()
    expect(appareilsPourPieces(PLAFOND_PIECES + 1)).toBe(1)
  })

  /**
   * ⚠️⚠️ **LA SÉQUENCE QUI MORDAIT** (Julien, 10 octobre 2026) : « si j'ai 43
   * de base, sélectionner cette tranche appareil reste à 43, si j'en ai 15
   * sélectionner la même tranche garde 15 ». Le compteur était borné au minimum
   * de la tranche QUITTÉE. La garde rejoue tous les ordres possibles.
   */
  it('⚠️ le compteur ne garde aucune mémoire du volume précédent', () => {
    const volumes = TRANCHES_ARTICLES.map((t) => t.max)
    for (const avant of volumes) {
      for (const apres of volumes) {
        // On « passe par » `avant`, puis on annonce `apres`.
        expect(appareilsPourPieces(avant)).toBe(minimumAppareils(avant))
        expect(appareilsPourPieces(apres), `${avant} pièces puis ${apres}`)
          .toBe(minimumAppareils(apres))
      }
    }
  })

  /**
   * L'écran ne refait pas le calcul dans son coin : c'est ce qui empêche le
   * plancher de se glisser à nouveau entre le volume et le compteur.
   */
  it('le tunnel passe par la règle, il ne la recopie pas', () => {
    const src = readFileSync(
      path.join(__dirname, '..', 'components', 'vitrine', 'PageReserver.tsx'), 'utf8')
    const sansCommentaires = src
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(sansCommentaires, 'le tunnel n’utilise plus appareilsPourPieces')
      .toContain('appareilsPourPieces')
  })
})

/**
 * ⚠️ **LES DEUX PRODUITS POSENT LA MÊME QUESTION.** L'onboarding de
 * l'abonnement demande le volume de stock, le tunnel de la location aussi
 * (10 octobre 2026). Si leurs bornes divergent, une réponse ne se transporte
 * plus de l'un à l'autre sans retraduction — et c'est exactement le genre
 * d'écart qu'on ne voit qu'en lisant deux fichiers côte à côte.
 *
 * La garde vit ICI parce que `prixOnDemand` n'existe pas sur `main` : elle
 * tombe avec le chantier, et ne peut pas empêcher le site de se déployer.
 */
describe('⚠️ l’abonnement et la location comptent le stock pareil', () => {
  it('les bornes de l’onboarding sont des plafonds de la grille', () => {
    const plafonds = new Set(TRANCHES_ARTICLES.map((t) => t.max))
    const bornes = PIECES_EN_STOCK
      .map((v) => Number(v.valeur))
      .filter((n) => Number.isFinite(n))
    expect(bornes.length, 'plus aucune borne chiffrée').toBeGreaterThan(2)
    const etrangeres = bornes.filter((n) => !plafonds.has(n))
    expect(etrangeres, `bornes absentes de la grille à la demande : ${etrangeres.join(', ')}`)
      .toEqual([])
  })

  it('⚠️ et ni l’une ni l’autre ne reparle de références', () => {
    const fautives = PIECES_EN_STOCK.filter((v) => /référence/i.test(v.libelle))
    expect(fautives.map((v) => v.libelle)).toEqual([])
    const tunnel = TRANCHES_ARTICLES.filter((t) => /référence/i.test(t.nom))
    expect(tunnel.map((t) => t.nom)).toEqual([])
  })
})
