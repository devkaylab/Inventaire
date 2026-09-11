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
import { t, tn } from '@/lib/i18n'

/** Le résumé d'un magasin, lisible sans ouvrir son volet. */
export function resumeMagasin(store: StoreBloc): string {
  const ouverts = store.sessions.filter((s) => s.status !== 'closed').length
  const morceaux = [
    ouverts > 0
      ? tn('%{count} inventaire en cours', '%{count} inventaires en cours', ouverts)
      : store.last_session_at
        ? t('dernier inventaire %{quand}', { quand: relativeTime(store.last_session_at) })
        : t('aucun inventaire'),
    tn('%{count} compteur', '%{count} compteurs', store.counters),
  ]
  if (store.supervisors.length > 0) {
    morceaux.push(store.supervisors.map((p) => p.full_name || t('Sans nom')).join(', '))
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
            <span className="dash-dot" />{t(STATUS_LABELS[s.status] ?? s.status)}
          </span>
        </div>
        <div className="muted small">
          {clos
            ? <>{t('clôturé %{quand}', { quand: relativeTime(s.closed_at) })} · {t('%{n} pièces', { n: nb(s.pieces) })}</>
            : <>
                {tn('%{count} personne', '%{count} personnes', s.members)} · {t('%{n} pièces', { n: nb(s.pieces) })} ·
                {' '}{t('dernier comptage %{quand}', { quand: relativeTime(s.last_count_at) })}
              </>}
          {s.created_by_label && ` · ${t('créé par %{qui}', { qui: s.created_by_label })}`}
        </div>
      </div>
      <div className="req-actions">
        {pct !== null && !clos && (
          <span className="mag-prog" title={t('%{n} pièces comptées sur %{attendues} attendues', { n: nb(s.pieces), attendues: nb(s.expected) })}>
            <i style={{ width: `${pct}%` }} />
          </span>
        )}
        <Link href={`/dashboard/${s.id}`} className="btn btn-ghost btn-sm">
          {clos ? t('Rapport') : t('Ouvrir')}
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
          <div className="mag-lab">{t('Ce qui demande votre attention')}</div>
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
        <div className="mag-lab">{t('Inventaires')}</div>
        {store.sessions.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>{t('Aucun inventaire sur ce magasin.')}</p>
        ) : (
          <>
            {ouverts.map((s) => <LigneInventaire key={s.id} s={s} />)}
            {clos.map((s) => <LigneInventaire key={s.id} s={s} />)}
          </>
        )}
      </div>

      <div className="mag-part">
        <div className="mag-lab">{t('Équipe')}</div>
        <div className="mag-equipe">
          {store.supervisors.length === 0 ? (
            <span className="jeton">{t('Aucun superviseur')}</span>
          ) : (
            store.supervisors.map((p) => (
              <span className="jeton" key={p.id}><b>{p.full_name || t('Sans nom')}</b> · {t('superviseur')}</span>
            ))
          )}
          <span className="jeton"><b>{nb(store.counters)}</b> {tn('compteur', 'compteurs', store.counters)}</span>
          <span className="jeton">
            {store.counters_active > 0
              ? <><b>{nb(store.counters_active)}</b> {tn('a compté ce mois', 'ont compté ce mois', store.counters_active)}</>
              : t('personne n’a compté ce mois')}
          </span>
        </div>
      </div>

      {lienFiche && (
        <div className="mag-part">
          <Link href={`/magasins/${store.id}`} className="btn btn-ghost btn-sm">
            {t('Ouvrir le magasin')}
          </Link>
        </div>
      )}
    </div>
  )
}
