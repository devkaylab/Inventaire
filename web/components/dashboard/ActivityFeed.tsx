'use client'

import { useMemo } from 'react'
import type { CountEvent } from '@/lib/activity'
import { fmtQty, relativeTime } from '@/lib/format'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Les derniers scans, tels qu'ils sont arrivés.
 *
 * **Sans nom, délibérément** : le fil sert à voir que l'inventaire avance et à
 * repérer une saisie aberrante, pas à suivre le rythme de chacun. Nommer
 * l'auteur en direct rétablirait le suivi nominatif que l'agrégation retire
 * (voir `lib/presence-summary.ts`). L'auteur reste enregistré en base et
 * figure dans le rapport : arbitrer un écart ne se fait pas en direct.
 *
 * Les lignes de quantité négative sont affichées, et c'est volontaire : dans ce
 * modèle une correction n'écrase rien, elle ajoute une ligne opposée. Les
 * masquer donnerait l'illusion d'un comptage qui ne se trompe jamais.
 */
export function ActivityFeed({ events, zoneNames, limit = 25 }: {
  events: CountEvent[]
  zoneNames: Record<string, string | null>
  limit?: number
}) {
  const rows = useMemo(() => events.slice(0, limit), [events, limit])

  if (rows.length === 0) {
    return <EmptyState title="Aucun scan pour l'instant" hint="Les comptages apparaîtront ici dès le premier article scanné." />
  }

  return (
    <div className="feed">
      {rows.map(e => {
        const mode = e.pass_number === 2 ? 'audit' : 'comptage'
        const qty = Number(e.qty)
        const zone = e.zone ? ` · balise ${e.zone}${zoneNames[e.zone] ? ` (${zoneNames[e.zone]})` : ''}` : ''
        return (
          <div className="feed-row" key={e.id}>
            <span className={`mode-badge mode-badge-${e.pass_number === 2 ? 'audit' : 'count'}`}>{mode}</span>
            <span className="feed-what">
              <span className="num">{qty < 0 ? fmtQty(qty) : `+${fmtQty(qty)}`}</span>
              {' '}{e.sku}{zone}
            </span>
            <span className="feed-when">{relativeTime(e.created_at)}</span>
          </div>
        )
      })}
    </div>
  )
}
