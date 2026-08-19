'use client'

import { useState } from 'react'
import { setBalise, type ZoneDashboardRow } from '@/lib/zones'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { BaliseGrid } from '@/components/dashboard/BaliseGrid'

/**
 * Détail des balises : la grille, et au clic une modale pour rouvrir ou
 * clôturer un cycle — utile quand un compteur a quitté l'application en
 * laissant une balise ouverte.
 */
export function BaliseDetail({ sessionId, zones, readOnly, onChanged }: {
  sessionId: string
  zones: ZoneDashboardRow[]
  readOnly: boolean
  onChanged: () => Promise<void> | void
}) {
  const toast = useToast()
  const [selected, setSelected] = useState<ZoneDashboardRow | null>(null)

  async function onToggleBalise(z: ZoneDashboardRow, mode: 'count' | 'audit', open: boolean) {
    try {
      const r = await setBalise(sessionId, z.code, mode, open)
      if (!r.success) { toast.error(r.error ?? 'Action impossible.'); return }
      toast.success(
        open
          ? `Balise ${z.code} rouverte en ${mode === 'count' ? 'comptage' : 'audit'}.`
          : `Balise ${z.code} marquée terminée en ${mode === 'count' ? 'comptage' : 'audit'}.`,
      )
      setSelected(null)
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        {readOnly
          ? 'Cliquez sur une balise pour consulter son état.'
          : 'Cliquez sur une balise pour rouvrir ou clôturer son comptage ou son audit — utile quand un compteur a quitté l’application en laissant une balise ouverte.'}
      </p>
      <BaliseGrid zones={zones} onSelect={setSelected} showGroupLabels={false} />

      {selected && (
        <Modal title={`Balise ${selected.code}`} onClose={() => setSelected(null)}>
          <p className="modal-message">
            {selected.name ?? 'Sans emplacement'}
            {' · '}
            {selected.count_lines} référence(s) comptée(s), {selected.audit_lines} auditée(s).
          </p>

          <div className="dash-info-grid" style={{ marginTop: 16 }}>
            <BaliseCycle
              label="Comptage" status={selected.count_status} readOnly={readOnly}
              onOpen={() => onToggleBalise(selected, 'count', true)}
              onClose={() => onToggleBalise(selected, 'count', false)}
            />
            <BaliseCycle
              label="Audit" status={selected.audit_status} readOnly={readOnly}
              onOpen={() => onToggleBalise(selected, 'audit', true)}
              onClose={() => onToggleBalise(selected, 'audit', false)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

const STATUS_FR: Record<string, string> = {
  pending: 'Pas commencé', open: 'En cours', done: 'Terminé',
}

function BaliseCycle({ label, status, readOnly, onOpen, onClose }: {
  label: string
  status: 'pending' | 'open' | 'done'
  readOnly: boolean
  onOpen: () => void
  onClose: () => void
}) {
  return (
    <div className="dash-info-row">
      <span className="dash-info-label">{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="dash-info-value">{STATUS_FR[status]}</span>
        {!readOnly && (
          status === 'done'
            ? <button type="button" className="link-btn" onClick={onOpen}>Rouvrir</button>
            : <button type="button" className="link-btn" onClick={onClose}>Marquer terminé</button>
        )}
      </span>
    </div>
  )
}
