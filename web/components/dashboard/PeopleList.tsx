'use client'

import { describePerson, MODE_LABELS, TIER_LABELS, type PersonRow } from '@/lib/merge'
import { relativeTime, sinceDuration } from '@/lib/format'
import { EmptyState } from '@/components/ui/EmptyState'

const ROLE_LABELS: Record<PersonRow['sessionRole'], string> = {
  creator: 'Créateur',
  supervisor: 'Co-superviseur',
  counter: 'Compteur',
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}

/**
 * Liste des personnes sur l'inventaire.
 *
 * Une règle de lecture, et elle est volontairement stricte : « en ligne » ne
 * vient jamais des comptages, et « balise X » n'est présenté comme l'endroit
 * *actuel* que si la présence temps réel est fraîche. Sinon on écrit
 * « dernier scan », ce qui est vrai même quand le téléphone est mort dans une
 * réserve sans réseau.
 */
export function PeopleList({ people }: { people: PersonRow[] }) {
  if (people.length === 0) {
    return (
      <EmptyState
        title="Personne sur cet inventaire"
        hint="Invitez des compteurs depuis l'onglet Équipe, ou communiquez-leur le numéro d'inventaire et son code."
      />
    )
  }

  return (
    <div className="people-list">
      {people.map(p => (
        <div key={p.userId} className={`person-row${p.tier === 'online' ? ' person-row-online' : ''}`}>
          <div className="person-avatar" aria-hidden="true">{initial(p.name)}</div>

          <div className="person-main">
            <div className="person-name">
              {p.name}
              <span className="role-tag">{ROLE_LABELS[p.sessionRole]}</span>
              {p.mode && (
                <span className={`mode-badge mode-badge-${p.mode}`}>{MODE_LABELS[p.mode]}</span>
              )}
              {!p.isMember && <span className="role-tag">Non inscrit</span>}
            </div>
            <div className="person-meta">
              {describePerson(p, relativeTime, sinceDuration)}
              {p.eventsWindow > 0 && ` · ${p.eventsWindow} scans (15 min)`}
            </div>
          </div>

          <span className={`person-state person-state-${p.tier === 'online' ? 'online' : p.tier === 'recent' ? 'active' : 'idle'}`}>
            <span className={`live-pulse${p.tier === 'online' && !p.paused ? '' : ' live-pulse-off'}`} />
            {TIER_LABELS[p.tier]}
          </span>
        </div>
      ))}
    </div>
  )
}
