'use client'

import { fmtDate, fmtDateTime } from '@/lib/format'
import { t } from '@/lib/i18n'

/**
 * Informations d'un inventaire — magasin, statut, mode, dates.
 *
 * Ce bloc vivait tout en bas de l'onglet Équipe, après les membres et les
 * invitations : l'endroit de la page où l'on regarde le moins, pour des
 * renseignements qu'on veut sous les yeux. Il devient une tuile du rail de
 * gauche, sous la progression, visible quel que soit l'onglet ouvert.
 */

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  counting: 'En cours',
  closed: 'Clôturée',
}

export type SessionInfoData = {
  store_name: string
  status: string
  uses_zones: boolean
  created_at: string
  closed_at: string | null
}

export function SessionInfo({ session }: { session: SessionInfoData }) {
  return (
    <section className="panel">
      <div className="dash-section-label">{t('Informations')}</div>
      <div className="dash-info-grid" style={{ marginTop: 12 }}>
        <Info label={t('Magasin')} value={session.store_name} />
        <Info label={t('Statut')} value={t(STATUS_LABELS[session.status] ?? session.status)} />
        <Info label={t('Mode')} value={session.uses_zones ? t('Zones et balises') : t('Classique (sans balise)')} />
        <Info label={t('Créé le')} value={fmtDate(session.created_at)} />
        {session.closed_at && <Info label={t('Clôturé le')} value={fmtDateTime(session.closed_at)} />}
      </div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-info-row">
      <span className="dash-info-label">{label}</span>
      <span className="dash-info-value">{value}</span>
    </div>
  )
}
