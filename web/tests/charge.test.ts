// Tenue en charge — les deux corrections du 21 août 2026.
//
// Question posée : « Quantinvo peut-il résister à 200 magasins faisant un
// inventaire avec 100 compteurs chacun, au même moment ? » L'étude a montré
// deux plafonds atteints bien avant que Postgres ne peine à écrire les scans,
// et tous deux tiennent à quelques lignes de code — pas à la puissance louée.
// D'où ces gardes : les deux régressions se réécrivent en une ligne, et ne se
// verraient qu'en production, un jour de gros inventaire.
//
//  1. Les totaux du tableau de bord se calculent **sur le serveur**. La version
//     d'origine téléchargeait toutes les lignes de `counts` de l'inventaire
//     toutes les huit secondes, par superviseur connecté.
//  2. Les téléphones **ne rejoignent plus** le canal temps réel : ils envoient
//     leur battement en broadcast HTTP. En v2, chaque battement était recopié
//     vers les 99 autres téléphones — un coût en n² pour un service en n.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

const inventaire = lire('../lib/inventory.ts')
const presenceMobile = lire('../../src/lib/presence.ts')
const presenceSite = lire('../lib/presence.ts')
const migration = lire('../../supabase/migrations/20260821240001_totaux_comptage_serveur.sql')
const live = lire('../hooks/useSessionLive.ts')
const donnees = lire('../hooks/useSessionData.ts')
const page = lire('../app/dashboard/[sessionId]/page.tsx')
const offlineSync = lire('../../src/lib/offlineSync.ts')

/**
 * Corps d'une fonction exportée, jusqu'à l'export suivant.
 *
 * Découpage volontairement grossier : on cherche à repérer un `select` remis
 * par mégarde, pas à analyser du TypeScript.
 */
function corps(source: string, nom: string): string {
  const debut = source.search(new RegExp(`export (async )?function ${nom}\\b`))
  expect(debut, `${nom} introuvable`).toBeGreaterThan(-1)
  // On s'arrête à l'accolade fermante de la fonction, en colonne zéro, et non
  // au prochain `export` : une fonction interne glissée entre les deux faisait
  // déborder l'extrait sur la suivante, et le test lisait ce qu'il ne visait
  // pas (constaté le 22 août 2026 sur `pingSession`).
  // Une ligne qui ne contient qu'une accolade fermante : c'est la fin du
  // corps. Pas `\n}` seul — un type de retour sur plusieurs lignes se termine
  // par `}>`, et l'extrait s'arrêtait avant même la première ligne de code.
  const fin = source.indexOf('\n}\n', debut)
  return source.slice(debut, fin === -1 ? undefined : fin + 3)
}

describe('un téléphone ne compte que pour un appareil', () => {
  // Anomalie relevée par Julien le 22 août 2026, capture à l'appui : « j'ai
  // 1 appareil connecté physiquement, quand il passe en comptage ou en audit
  // le nombre passe à 2 ».
  //
  // Cause : la clé d'appareil était tirée dans le hook, à chaque montage. Or
  // **deux écrans le montent en même temps** — l'écran de l'inventaire reste
  // monté dans la pile sous l'écran de comptage. Deux clés, donc deux
  // appareils à l'écran du superviseur, pour un seul téléphone.

  it('tire sa clé une fois par lancement, pas par écran', () => {
    expect(presenceMobile).toContain('const DEVICE_KEY = newDeviceKey()')
    // Rien ne doit recréer une clé à l'intérieur du hook.
    const hook = corps(presenceMobile, 'useSessionPresence')
    expect(hook).not.toContain('newDeviceKey')
    expect(hook).not.toContain('useMemo')
  })

  it('n’a qu’un émetteur, quel que soit le nombre d’écrans montés', () => {
    // Un émetteur par écran multipliait les battements et, surtout, cassait
    // `pingSession` : le second montage écrasait la référence, et son
    // démontage la remettait à `null` alors que le premier écran vivait
    // toujours — les scans ne réveillaient plus le tableau de bord.
    expect(presenceMobile).toContain('let engine: Engine | null = null')
    expect(presenceMobile).toContain('function syncEngine()')
    expect(corps(presenceMobile, 'pingSession')).toContain('engine.markDirty()')
  })

  it('laisse l’écran du dessus donner le mode', () => {
    // La pile des écrans est celle de la navigation : ouvrir le comptage
    // par-dessus l'inventaire met l'appareil en « comptage », le refermer le
    // rend à « rien » — sans message de départ entre les deux.
    expect(presenceMobile).toContain('let holders: Holder[] = []')
    expect(presenceMobile).toMatch(/mode: gone \? null : \(top\(\)\?\.mode \?\? null\)/)
  })

  it('ne coupe pas l’émission en changeant d’écran du même inventaire', () => {
    // Redémarrer l'émetteur enverrait un message de départ : l'appareil
    // clignoterait sur le tableau de bord à chaque ouverture du scanner.
    expect(presenceMobile).toContain('if (engine && engine.sessionId === holder.sessionId)')
    // Mais le changement d'écran doit se voir tout de suite : sans ce rappel,
    // fermer le comptage laisserait l'appareil « en comptage » jusqu'au
    // battement suivant, soit trente secondes.
    expect(presenceMobile).toContain('if (change) engine.markDirty()')
  })
})

describe('totaux du tableau de bord', () => {
  it('demande l’addition au serveur', () => {
    expect(corps(inventaire, 'getCountTotals')).toContain('get_session_count_totals')
  })

  it('ne télécharge jamais les lignes de comptage', () => {
    // La régression tient en une ligne : `.from('counts').select(...)` remis
    // « pour déboguer ». Sur un magasin à cent compteurs, c'est plusieurs
    // centaines de milliers de lignes transférées toutes les huit secondes.
    expect(corps(inventaire, 'getCountTotals')).not.toContain("from('counts')")
  })

  it('la fonction de base n’est pas ouverte à `anon`', () => {
    // `create or replace` rend EXECUTE à PUBLIC : sans ces lignes, les totaux
    // d'un magasin seraient lisibles sans compte.
    expect(migration).toContain('revoke all on function public.get_session_count_totals(uuid) from public')
    expect(migration).toContain('grant execute on function public.get_session_count_totals(uuid) to authenticated')
  })

  it('la fonction de base contrôle l’accès avant de répondre', () => {
    expect(migration).toContain('can_access_session')
    expect(migration).toContain("raise exception 'forbidden'")
  })
})

describe('battements du mobile', () => {
  it('n’ouvre aucune connexion temps réel', () => {
    // `subscribe()` rétablirait à la fois la connexion permanente par téléphone
    // (20 000 pour un plafond de 10 000) et la recopie de chaque message vers
    // tous les membres du canal.
    expect(presenceMobile).not.toContain('.subscribe(')
    expect(presenceMobile).not.toContain('.track(')
  })

  it('envoie son battement en broadcast HTTP, sur un canal privé', () => {
    expect(presenceMobile).toContain('httpSend')
    expect(presenceMobile).toContain('private: true')
  })

  it('regroupe les scans au lieu d’émettre à chaque fois', () => {
    // C'est ce qui remplace le `sync` par scan : sans borne minimale, cent
    // compteurs reproduisent le millier de messages par seconde de la v2.
    expect(presenceMobile).toMatch(/MIN_GAP_MS\s*=\s*[\d_]+/)
    expect(corps(presenceMobile, 'pingSession')).not.toContain('httpSend')
  })

  it('garde la même version de contrat des deux côtés', () => {
    // Une dérive serait silencieuse : le site afficherait « aucun appareil
    // connecté » sans que rien ne le signale.
    const version = (s: string) => s.match(/export const BEAT_V = (\d+)/)?.[1]
    expect(version(presenceMobile)).toBe(version(presenceSite))
    expect(version(presenceSite)).toBeTruthy()
  })

  it('le site lit encore la présence v2 pendant la transition', () => {
    // Les téléphones déjà installés émettent toujours en v2. Retirer cette
    // lecture avant que le nouveau build soit partout ferait disparaître de
    // l'écran des équipes bel et bien au travail.
    const hook = lire('../hooks/useSessionLive.ts')
    expect(hook).toContain('flattenPresence')
    expect(hook).toContain('readBeat')
  })
})

describe('cadence du tableau de bord', () => {
  const nombre = (nom: string) =>
    Number(live.match(new RegExp(`const ${nom} = ([\\d_]+)`))?.[1].replace(/_/g, ''))

  it('ne recalcule pas plus d’une fois par minute, automatiquement', () => {
    // Un rafraîchissement fait reparcourir tous les comptages de l'inventaire.
    // À 200 magasins, c'est ce chiffre qui décide de la charge.
    expect(nombre('AUTO_MIN_GAP_MS')).toBe(60_000)
  })

  it('sonde plus vite que la limite, pour ne pas doubler l’attente', () => {
    // Si le sondage battait à la même cadence que la limite, un
    // rafraîchissement déclenché par un scan ferait sauter le sondage suivant
    // et l'écran pourrait rester deux minutes sans bouger.
    expect(nombre('POLL_MS')).toBeLessThan(nombre('AUTO_MIN_GAP_MS'))
  })

  it('applique la limite au scan comme au sondage', () => {
    // C'est tout l'intérêt : un jour de gros inventaire, les scans arrivent en
    // continu. Limiter le sondage sans limiter les scans ne changerait rien.
    // Le déclencheur passe donc par `refresh()`, qui porte la limite, et
    // n'ajoute aucune temporisation qui lui soit propre — l'ancienne, de
    // 750 ms, se reportait à chaque message et n'arrivait jamais à son terme
    // sur un inventaire animé.
    const bloc = live.slice(live.indexOf('const askRefresh'), live.indexOf('channel\n'))
    expect(bloc).toContain('refresh()')
    expect(bloc).not.toContain('setTimeout')
    expect(live).not.toContain('SYNC_DEBOUNCE_MS')
  })

  it('laisse la personne passer outre', () => {
    // Le bouton de l'en-tête et le retour sur l'onglet sont des gestes, pas
    // des automatismes : ils actualisent tout de suite. Sans cela, une minute
    // d'attente deviendrait une minute d'impuissance.
    expect(live).toContain('refresh: refreshNow')
    expect(live).toContain("document.visibilityState === 'visible') refresh(true)")
  })
})

describe('repos quand rien ne se passe', () => {
  const nombre = (nom: string) =>
    Number(live.match(new RegExp(`const ${nom} = ([^\\n]+)`))?.[1]
      .replace(/_/g, '').replace(/\s/g, '').split('//')[0]
      .split('*').reduce((a, b) => a * Number(b), 1))

  it('espace le sondage bien au-delà de la minute quand rien n’est signalé', () => {
    expect(nombre('IDLE_MAX_MS')).toBeGreaterThan(nombre('AUTO_MIN_GAP_MS'))
  })

  it('ne s’endort jamais si le temps réel est tombé', () => {
    // C'est la garde qui rend ce repos acceptable : sans signal *et* sans
    // canal, l'écran resterait figé cinq minutes sans que rien ne l'explique.
    expect(live).toContain('!channelReadyRef.current')
  })

  it('une file hors ligne qui remonte prévient le tableau de bord', () => {
    // Sans ce signal, un retour de réserve verserait des centaines de
    // comptages que le site, justement au repos, ne verrait pas venir.
    expect(offlineSync).toContain('if (result.sent > 0) pingSession(')
  })
})

describe('portée par section', () => {
  it('le Rapport et l’Équipe ne font rien recalculer', () => {
    expect(page).toMatch(/rapport:\s*'aucun'/)
    expect(page).toMatch(/equipe:\s*'aucun'/)
  })

  it('le fil des derniers scans n’est chargé que par Suivi', () => {
    expect(donnees).toContain("portee === 'suivi' ? getRecentCounts(sessionId)")
  })

  it('le premier chargement ignore la portée', () => {
    // Sinon un lien direct vers le Rapport afficherait un bandeau de
    // progression à zéro.
    expect(donnees).toContain("await chargerLive('suivi')")
  })

  it('changer de section recharge tout de suite', () => {
    expect(page).toContain('sectionPrecedente.current = tab')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Le rapport recense l'attendu, pas seulement le compté (22 août 2026)

describe('le rapport d’inventaire', () => {
  const migration = readFileSync(
    path.resolve(__dirname, '../../supabase/migrations/20260822090001_rapport_articles_attendus.sql'),
    'utf8',
  )
  const corpsFn = migration.split('$function$')[1] ?? ''

  it('part de l’attendu ET du compté, pas du seul compté', () => {
    // Un article présent au stock théorique et jamais scanné n'avait aucune
    // ligne : son théorique n'était pas additionné et son manque n'entrait pas
    // dans l'écart. L'inventaire ne montrait donc pas la démarque.
    expect(corpsFn).toContain('from public.theoretical_stock t')
    expect(corpsFn).toMatch(/union\s+select l\.s from lignes l/)
  })

  it('se réduit aux SKU comptés quand aucun théorique n’est fourni', () => {
    // Règle de Julien : sans stock théorique, seuls les SKU comptés
    // apparaissent. C'est l'union qui le fait d'elle-même — un `from
    // theoretical_stock` seul viderait le rapport des inventaires sans
    // fichier attendu, et une jointure interne ferait de même.
    const univers = corpsFn.split('univers as (')[1]?.split(')')[0] ?? ''
    expect(univers, 'les deux branches doivent être là').toContain('theoretical_stock')
    expect(univers).toContain('from lignes l')
    expect(corpsFn).toContain('left join lignes l on l.s = u.s')
    expect(corpsFn, 'les lignes comptées ne doivent jamais être filtrées par le théorique')
      .not.toContain('inner join public.theoretical_stock')
  })

  it('ne touche pas aux règles d’audit', () => {
    // La quantité qui fait foi et la priorité des statuts restent celles
    // d'avant : `uncounted` ne s'applique qu'aux SKU sans ligne d'audit.
    expect(corpsFn).toContain('coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)')
    expect(corpsFn).toContain("when bool_or(a.status = 'failed') then 'failed'")
    expect(corpsFn).toContain("coalesce(l.statut, 'uncounted')")
  })

  it('repose les droits que `create or replace` avait rendus à PUBLIC', () => {
    expect(migration).toMatch(/revoke all on function public\.get_session_results\(uuid\) from public, anon/)
    expect(migration).toContain('grant execute on function public.get_session_results(uuid) to authenticated')
  })

  it('le statut « Non compté » a son libellé des deux côtés', () => {
    const site = readFileSync(path.resolve(__dirname, '../lib/inventory.ts'), 'utf8')
    const mobile = readFileSync(path.resolve(__dirname, '../../src/lib/report.ts'), 'utf8')
    expect(site).toContain("uncounted: 'Non compté'")
    expect(mobile).toContain("uncounted: 'Non compté'")
  })
})

describe('la tuile « Références comptées »', () => {
  const suivi = readFileSync(path.resolve(__dirname, '../components/dashboard/tabs/SuiviTab.tsx'), 'utf8')

  it('affiche enfin `counted_skus`, à droite des pièces', () => {
    // Il traversait la RPC, le hook et les types sans jamais être rendu.
    expect(suivi).toContain('Références comptées')
    expect(suivi).toContain('totals.countedSkus')
    expect(suivi.indexOf('Pièces comptées')).toBeLessThan(suivi.indexOf('Références comptées'))
  })

  it('accorde son sous-titre', () => {
    // « 1 auditées » se lisait sur les deux tuiles.
    expect(suivi).toContain("plural(totals.audited, 'auditée', 'auditées')")
    expect(suivi).toContain("plural(totals.auditedSkus, 'auditée', 'auditées')")
  })

  it('ne compte que les références dont il reste quelque chose', () => {
    // `counts` est append-only : une correction est une ligne négative. Un
    // article scanné puis entièrement corrigé a des lignes mais un net nul —
    // il gonflait le décompte. Un `count(distinct sku)` sec le réintroduirait.
    const migration = readFileSync(
      path.resolve(__dirname, '../../supabase/migrations/20260822100001_references_comptees_net_positif.sql'),
      'utf8',
    )
    expect(migration).toContain('count(*) filter (where p.net_comptage > 0)')
    expect(migration).toContain('count(*) filter (where p.net_audit > 0)')
    expect(migration).not.toContain('count(distinct c.sku)')
    // Les totaux de pièces, eux, ne doivent pas changer.
    expect(migration).toContain('coalesce(sum(p.net_comptage), 0)')
    // Et les droits sont reposés, `create or replace` les ayant rendus à PUBLIC.
    expect(migration).toMatch(/revoke all on function public\.get_session_count_totals\(uuid\) from public, anon/)
  })

  it('tient sur une ligne à cinq tuiles', () => {
    const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')
    expect(suivi).toContain('dash-stats dash-stats-5')
    expect(css).toContain('.dash-stats-5 { grid-template-columns: repeat(auto-fit, minmax(116px, 1fr)); }')
  })
})
