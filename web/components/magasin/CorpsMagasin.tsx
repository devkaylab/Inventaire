'use client'

// Ce qu'on lit d'un magasin : ce qui cloche, ses inventaires, son équipe.
//
// Le même corps sert deux fois — replié dans la liste des magasins, déroulé
// sur la fiche d'un magasin. Une seule définition : deux écrans qui montrent la
// même chose doivent la montrer de la même façon.

import Link from 'next/link'
import { STATUS_LABELS } from '@/lib/inventory'
import { alertesMagasin, avancement, type SessionBloc, type StoreBloc } from '@/lib/entreprise'
// `relativeTime` et `nb` viennent de lib/format : ils existaient déjà, les
// redéfinir ici aurait fait diverger « il y a 3 j » et « il y a 3 jours ».
import { nb, relativeTime } from '@/lib/format'

/** Le résumé d'un magasin, lisible sans ouvrir son volet. */
export function resumeMagasin(store: StoreBloc): string {
  const ouverts = store.sessions.filter((s) => s.status !== 'closed').length
  const morceaux = [
    ouverts > 0
      ? `${ouverts} inventaire${ouverts > 1 ? 's' : ''} en cours`
      : store.last_session_at
        ? `dernier inventaire ${relativeTime(store.last_session_at)}`
        : 'aucun inventaire',
    `${nb(store.counters)} compteur${store.counters > 1 ? 's' : ''}`,
  ]
  if (store.supervisors.length > 0) {
    morceaux.push(store.supervisors.map((p) => p.full_name || 'Sans nom').join(', '))
  }
  return morceaux.join(' · ')
}

export function LigneInventaire({ s }: { s: SessionBloc }) {
  const pct = avancement(s)
  const clos = s.status === 'closed'
  return (
    <div className="req-row">
      <div>
        <div className="req-name">
          {s.name}
          <span className={`dash-badge dash-badge-${s.status}`} style={{ marginLeft: 8 }}>
            <span className="dash-dot" />{STATUS_LABELS[s.status] ?? s.status}
          </span>
        </div>
        <div className="muted small">
          {clos
            ? <>clôturé {relativeTime(s.closed_at)} · {nb(s.pieces)} pièces</>
            : <>
                {s.members} personne{s.members > 1 ? 's' : ''} · {nb(s.pieces)} pièces ·
                {' '}dernier scan {relativeTime(s.last_count_at)}
              </>}
          {s.created_by_label && ` · créé par ${s.created_by_label}`}
        </div>
      </div>
      <div className="req-actions">
        {pct !== null && !clos && (
          <span className="mag-prog" title={`${nb(s.pieces)} sur ${nb(s.expected)} attendues`}>
            <i style={{ width: `${pct}%` }} />
          </span>
        )}
        <Link href={`/dashboard/${s.id}`} className="btn btn-ghost btn-sm">
          {clos ? 'Rapport' : 'Ouvrir'}
        </Link>
      </div>
    </div>
  )
}

export function CorpsMagasin({ store, lienFiche = true }: { store: StoreBloc; lienFiche?: boolean }) {
  const alertes = alertesMagasin(store)
  const ouverts = store.sessions.filter((s) => s.status !== 'closed')
  const clos = store.sessions.filter((s) => s.status === 'closed')

  return (
    <div className="mag-corps">
      {alertes.length > 0 && (
        <div className="mag-part">
          <div className="mag-lab">Ce qui demande votre attention</div>
          {alertes.map((a) => (
            <div className="signal signal-alerte" key={a.cle}>
              <div className="signal-txt">
                <strong>{a.titre}</strong>
                <div className="muted small">{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mag-part">
        <div className="mag-lab">Inventaires</div>
        {store.sessions.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Aucun inventaire sur ce magasin.</p>
        ) : (
          <>
            {ouverts.map((s) => <LigneInventaire key={s.id} s={s} />)}
            {clos.map((s) => <LigneInventaire key={s.id} s={s} />)}
          </>
        )}
      </div>

      <div className="mag-part">
        <div className="mag-lab">Équipe</div>
        <div className="mag-equipe">
          {store.supervisors.length === 0 ? (
            <span className="jeton">Aucun superviseur affecté</span>
          ) : (
            store.supervisors.map((p) => (
              <span className="jeton" key={p.id}><b>{p.full_name || 'Sans nom'}</b> · superviseur</span>
            ))
          )}
          <span className="jeton"><b>{nb(store.counters)}</b> compteur{store.counters > 1 ? 's' : ''}</span>
          <span className="jeton">
            {store.counters_active > 0
              ? <><b>{nb(store.counters_active)}</b> actif{store.counters_active > 1 ? 's' : ''} ce mois</>
              : 'aucun actif ce mois'}
          </span>
        </div>
      </div>

      {lienFiche && (
        <div className="mag-part">
          <Link href={`/magasins/${store.id}`} className="btn btn-ghost btn-sm">
            Ouvrir le magasin
          </Link>
        </div>
      )}
    </div>
  )
}
