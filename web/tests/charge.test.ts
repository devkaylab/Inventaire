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

/**
 * Corps d'une fonction exportée, jusqu'à l'export suivant.
 *
 * Découpage volontairement grossier : on cherche à repérer un `select` remis
 * par mégarde, pas à analyser du TypeScript.
 */
function corps(source: string, nom: string): string {
  const debut = source.search(new RegExp(`export (async )?function ${nom}\\b`))
  expect(debut, `${nom} introuvable`).toBeGreaterThan(-1)
  const suite = source.indexOf('\nexport ', debut + 1)
  return source.slice(debut, suite === -1 ? undefined : suite)
}

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
    expect(live).toContain('const askRefresh = () => { if (!disposed) refresh() }')
  })

  it('laisse la personne passer outre', () => {
    // Le bouton de l'en-tête et le retour sur l'onglet sont des gestes, pas
    // des automatismes : ils actualisent tout de suite. Sans cela, une minute
    // d'attente deviendrait une minute d'impuissance.
    expect(live).toContain('refresh: refreshNow')
    expect(live).toContain("document.visibilityState === 'visible') refresh(true)")
  })
})
