import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'

/**
 * Archiver un inventaire — douze mois après la clôture (6 septembre 2026).
 *
 * Julien a tranché deux points : une **durée annoncée** plutôt qu'un bouton
 * (« un bouton que personne ne presse ne rend jamais un octet »), et **douze
 * mois** après la clôture.
 *
 * ⚠️ CE QUI REND CE CHANTIER SÛR TIENT EN UNE PHRASE : on efface le journal des
 * scans, jamais le résultat. Le Rapport, les Écarts et le Rapport magasin
 * lisent `article_audit` — le consolidé — pas `counts`. C'est vérifié en base
 * (les 27 fonctions qui touchent `counts` ont été passées en revue) et c'est ce
 * que ces gardes protègent : le jour où quelqu'un « complète » l'archivage en
 * effaçant une table de plus, le rapport se vide.
 */

const racine = path.resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/** Le SQL sans ses commentaires : ils citent forcément ce qu'ils interdisent. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

const archivage = () => code(derniereDefinition('archiver_inventaires_anciens').corps)
const recompute = () => code(derniereDefinition('recompute_session_audit').corps)

describe('un inventaire archivé ne se recalcule plus', () => {
  it('⚠️ sans ce verrou, ouvrir l’onglet Écarts viderait le rapport', () => {
    // `recompute_session_audit` finit par supprimer les lignes d'audit qui
    // n'ont plus aucun comptage. Les comptages effacés, ce delete emporte TOUT
    // `article_audit` — donc le rapport, les écarts, et le rapport magasin.
    const c = recompute()
    expect(c, 'le verrou d’archivage a disparu du recalcul').toMatch(/archived_at is not null/)
  })

  it('⚠️ et il passe AVANT p_force', () => {
    // L'annulation d'un arbitrage force le recalcul. Sur un inventaire archivé,
    // forcer détruirait le rapport : le verrou doit être franchi le premier.
    // ⚠️ On ancre sur l'USAGE de `p_force`, pas sur le mot : il figure d'abord
    // dans la signature de la fonction, donc avant tout le corps. Un premier
    // jet comparait au mot et échouait sur du code juste.
    const c = recompute()
    const verrou = c.indexOf('archived_at is not null')
    const force = c.indexOf('if not p_force')
    expect(verrou, 'le verrou est introuvable').toBeGreaterThan(-1)
    expect(force, 'le raccourci de l’empreinte est introuvable').toBeGreaterThan(-1)
    expect(verrou, 'p_force est évalué avant le verrou : un recalcul forcé viderait le rapport')
      .toBeLessThan(force)
  })
})

describe('l’archivage n’efface QUE le journal des scans', () => {
  it('⚠️ effacer une table de plus viderait le rapport', () => {
    // ⚠️ ON COMPTE LES SUPPRESSIONS, ON NE LES COMPARE PAS À UNE LISTE.
    // Premier jet : la garde déduisait les « tables d'inventaire » du dossier
    // de migrations, et le sabotage `delete from public.articles` est passé —
    // `articles.session_id` a été ajoutée par une migration des tout premiers
    // jours qui n'a jamais eu de fichier. Une garde qui s'appuie sur un dossier
    // incomplet garde ce que le dossier veut bien lui montrer. Ici on lit la
    // fonction elle-même : une seule suppression, et c'est le journal des scans.
    const c = archivage()
    const cibles = [...c.matchAll(/delete\s+from\s+(?:public\.)?([a-z0-9_]+)/gi)]
      .map((m) => m[1].toLowerCase())
    expect(cibles, 'l’archivage ne doit effacer que le journal des scans').toEqual(['counts'])
  })

  it('et il pose le drapeau qui dit que le détail est parti', () => {
    expect(archivage()).toMatch(/update public\.inventory_sessions set archived_at = now\(\)/)
  })

  it('⚠️ il efface l’empreinte d’audit avec les comptages', () => {
    // Règle du 3 septembre 2026 : toute suppression de comptages efface
    // l'empreinte, sinon un recalcul retrouve le même compte et conclut à tort
    // que rien n'a bougé. Ici le verrou prend le relais — les deux, pas l'un.
    expect(archivage()).toMatch(/oublier_empreinte_audit/)
  })

  it('⚠️ et il ne touche aucune autre table d’inventaire', () => {
    // Le complément du test ci-dessus, vu de l'autre bout : le rapport vit sur
    // `article_audit`, `articles` et `theoretical_stock`. Qu'une seule de ces
    // trois parte, et il n'y a plus de rapport à conserver.
    for (const t of ['articles', 'article_audit', 'theoretical_stock', 'zones']) {
      expect(archivage(), `l’archivage touche ${t} : le rapport ne survivrait pas`)
        .not.toMatch(new RegExp(`delete\\s+from\\s+(?:public\\.)?${t}\\b`, 'i'))
    }
  })
})

describe('la durée annoncée est la durée appliquée', () => {
  /**
   * ⚠️ C'EST LA PAIRE QUI COMPTE. Notre politique de confidentialité annonce un
   * nombre de mois ; la purge en applique un autre. Les deux doivent bouger
   * ensemble — une politique qui promet douze mois pendant que la base en
   * efface six est un manquement, pas une coquille.
   */
  const MOIS = { douze: 12, six: 6, vingtQuatre: 24, trenteSix: 36 }

  const moisDeLaPurge = () => {
    const m = /inventaires_ttl\s+constant interval := interval '(\d+) months'/
      .exec(code(derniereDefinition('purge_expired_data').corps))
    expect(m, 'la durée d’archivage a disparu de la purge').not.toBeNull()
    return Number(m![1])
  }

  it('⚠️ la politique de confidentialité écrit le même nombre de mois', () => {
    const mois = moisDeLaPurge()
    expect(Object.values(MOIS)).toContain(mois)
    const enLettres: Record<number, string> = { 6: 'six', 12: 'douze', 24: 'vingt-quatre', 36: 'trente-six' }
    const politique = lire('docs/privacy.html')
    expect(politique, `la politique n’annonce pas ${enLettres[mois]} mois`)
      .toMatch(new RegExp(`${enLettres[mois]} mois après la clôture`, 'i'))
  })

  it('et l’écran de l’inventaire dit la même chose', () => {
    const mois = moisDeLaPurge()
    const enLettres: Record<number, string> = { 6: 'six', 12: 'douze', 24: 'vingt-quatre', 36: 'trente-six' }
    const page = lire('web/app/dashboard/[sessionId]/page.tsx')
    expect(page, 'le bandeau d’un inventaire archivé n’annonce pas la bonne durée')
      .toMatch(new RegExp(`${enLettres[mois]} mois après la clôture`, 'i'))
  })

  it('⚠️ et la fonction refuse une durée trop courte', () => {
    // Le paramètre efface. Un `interval '0'` passé par erreur en console
    // viderait tous les inventaires clôturés de la base.
    expect(archivage(), 'la borne basse a disparu').toMatch(/p_age < interval '1 month'/)
    expect(archivage()).toMatch(/raise exception/)
  })
})

describe('un inventaire archivé ne se rouvre pas', () => {
  const fige = () => code(derniereDefinition('inventaire_archive_fige').corps)

  it('⚠️ le déclencheur reste en SECURITY INVOKER', () => {
    // En DEFINER, `current_user` vaudrait le propriétaire et la condition ne
    // serait jamais vraie : le garde-fou ne s'appliquerait à personne. Même
    // règle que `profiles_pin_privileged`, et même piège.
    const entete = fichierDe('inventaire_archive_fige')
    const i = entete.indexOf('function public.inventaire_archive_fige')
    expect(entete.slice(i, i + 400)).toMatch(/security invoker/i)
    expect(entete.slice(i, i + 400), 'un déclencheur en DEFINER ne garde rien')
      .not.toMatch(/security definer/i)
  })

  it('il refuse le changement de statut et l’effacement du drapeau', () => {
    const f = fige()
    expect(f).toMatch(/new\.status is distinct from old\.status/)
    expect(f, 'sans ça, on efface le drapeau puis on rouvre')
      .toMatch(/new\.archived_at is distinct from old\.archived_at/)
  })

  it('⚠️ et l’écran ne propose pas un geste que la base refuse', () => {
    // Un bouton qui échoue vaut moins que pas de bouton : on le découvre après
    // avoir cliqué, sur une confirmation qu'on vient d'accepter.
    const menu = lire('web/components/dashboard/SessionActionsMenu.tsx')
    expect(menu).toMatch(/archived_at !== null/)
    expect(menu, 'la réouverture reste proposée sur un inventaire archivé')
      .toMatch(/canReopen && !archive/)
  })
})

describe('l’archivage ne s’appelle pas depuis un client', () => {
  it('⚠️ ni anon, ni authenticated', () => {
    const f = fichierDe('archiver_inventaires_anciens')
    expect(f).toMatch(
      /revoke all on function public\.archiver_inventaires_anciens\(interval\) from public, anon, authenticated;/,
    )
    expect(f).toMatch(
      /grant execute on function public\.archiver_inventaires_anciens\(interval\) to service_role;/,
    )
  })

  it('et elle tourne par la purge, pas par une tâche à elle', () => {
    // Toutes les durées de conservation vivent en un seul point depuis le
    // 18 août 2026. Une seconde tâche planifiée serait un second calendrier.
    expect(code(derniereDefinition('purge_expired_data').corps))
      .toMatch(/public\.archiver_inventaires_anciens\(inventaires_ttl\)/)
  })
})
