// Synthèse agrégée de la présence, en remplacement du suivi nominatif.
//
// Le superviseur a besoin de savoir *combien* de personnes travaillent et dans
// quel mode — pas *qui* fait quoi minute par minute : il est dans le magasin
// avec son équipe. L'information de pilotage (quelle zone avance, quelle
// balise est ouverte) vit dans l'avancement par zone, rattachée au travail et
// non aux personnes.
//
// Ce que cela retire : l'observation nominative continue, c'est-à-dire le
// critère « surveillance systématique » qui pèse le plus lourd dans les
// obligations de l'entreprise cliente (voir docs/conformite/
// suivi-activite-analyse.md). Ce que cela conserve : `counted_by` en base,
// dans le rapport et dans l'export — finalité distincte (arbitrer un écart,
// reprendre avec la bonne personne), usage différé, pas de la surveillance.

import { STALE_MS, type PresencePayload } from '@/lib/presence'

export type PresenceSummary = {
  /** Appareils connectés à l'inventaire. */
  devices: number
  /** Appareils dont le mode courant est le comptage. */
  counting: number
  /** Appareils dont le mode courant est l'audit. */
  auditing: number
}

/**
 * Compte les appareils par mode.
 *
 * On compte des **appareils**, pas des personnes : deux téléphones font deux
 * entrées, et c'est ce que le superviseur veut savoir. Un appareil hors écran
 * de scan n'est ni en comptage ni en audit — il est connecté, sans plus.
 *
 * Les entrées périmées sont écartées : une socket fermée brutalement (réseau
 * coupé, application tuée) reste un moment dans l'état du canal, et sans ce
 * filtre elle gonflerait durablement le compteur — un superviseur croirait
 * l'équipe au travail alors que plus personne ne compte.
 */
export function summarizePresence(
  presence: Record<string, PresencePayload>,
  now: number = Date.now(),
): PresenceSummary {
  let devices = 0
  let counting = 0
  let auditing = 0
  for (const p of Object.values(presence)) {
    if (now - (p.beat ?? 0) > STALE_MS) continue
    devices += 1
    if (p.mode === 'count') counting += 1
    else if (p.mode === 'audit') auditing += 1
  }
  return { devices, counting, auditing }
}
