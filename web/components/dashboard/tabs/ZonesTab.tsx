'use client'

import { useMemo, useState } from 'react'
import {
  codeRange, defineZoneRange, deleteZone, groupByName, setBalise,
  type ZoneDashboardRow, validateRange, MAX_RANGE,
} from '@/lib/zones'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { BaliseGrid } from '@/components/dashboard/BaliseGrid'
import { Modal } from '@/components/ui/Modal'
import { plural } from '@/lib/format'

export function ZonesTab({ sessionId, zones, readOnly, onChanged }: {
  sessionId: string
  zones: ZoneDashboardRow[]
  readOnly: boolean
  onChanged: () => Promise<void> | void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<ZoneDashboardRow | null>(null)

  const groups = useMemo(() => groupByName(zones), [zones])

  async function onDefine(e: React.FormEvent) {
    e.preventDefault()
    const error = validateRange(name, start, end)
    setFormError(error)
    if (error) return

    setBusy(true)
    try {
      const r = await defineZoneRange(sessionId, name.trim(), Number(start), Number(end))
      if (!r.success) { toast.error(r.error ?? "Affectation impossible."); return }
      toast.success(`${plural(r.created ?? 0, 'balise affectée', 'balises affectées')} à « ${name.trim()} ».`)
      setName(''); setStart(''); setEnd('')
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(zoneName: string, count: number) {
    const ok = await confirm({
      title: `Retirer l'emplacement « ${zoneName} » ?`,
      message: `Ses ${count} balises ne seront plus rattachées à un emplacement.`,
      details: ['Les comptages déjà enregistrés sur ces balises sont conservés.'],
      confirmLabel: 'Retirer',
      tone: 'danger',
    })
    if (!ok) return

    try {
      const r = await deleteZone(sessionId, zoneName)
      if (!r.success) { toast.error(r.error ?? 'Suppression impossible.'); return }
      toast.success(`Emplacement « ${zoneName} » retiré.`)
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

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
      {!readOnly && (
        <form className="panel" onSubmit={onDefine} style={{ marginTop: 0 }}>
          <h3>Affecter une plage de balises à un emplacement</h3>
          <p className="muted small" style={{ marginTop: 6, marginBottom: 16 }}>
            Indiquez quelles balises — déjà imprimées depuis votre profil — sont collées à quel endroit.
            Exemple : « Réserve » = balises 1 à 10, « Surface de vente » = 11 à 30.
            Réaffecter une plage déjà nommée la renomme. {MAX_RANGE} balises au maximum par affectation.
          </p>

          <div className="zone-form">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-name">Emplacement</label>
              <input
                id="zone-name" value={name} onChange={e => setName(e.target.value)}
                placeholder="Réserve" autoComplete="off"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-start">Balise début</label>
              <input id="zone-start" value={start} onChange={e => setStart(e.target.value)} inputMode="numeric" placeholder="1" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-end">Balise fin</label>
              <input id="zone-end" value={end} onChange={e => setEnd(e.target.value)} inputMode="numeric" placeholder="10" />
            </div>
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? 'Affectation…' : 'Affecter'}
            </button>
          </div>

          {formError && <div className="error" style={{ marginTop: 14, marginBottom: 0 }} role="alert">{formError}</div>}
        </form>
      )}

      <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>
        Emplacements ({groups.length})
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="Aucun emplacement affecté"
          hint={readOnly
            ? "Aucune balise n'a été rattachée à un emplacement sur cet inventaire."
            : 'Indiquez une première plage de balises ci-dessus pour pouvoir suivre l’avancement zone par zone.'}
        />
      ) : (
        <div className="zone-list">
          {groups.map(g => (
            <div className="zone-card" key={g.name}>
              <div className="zone-card-head">
                <div>
                  <div className="zone-name">{g.name}</div>
                  <div className="zone-range num">Balises {codeRange(g.codes)} · {g.total} au total</div>
                </div>
                {!readOnly && !g.unnamed && (
                  <button type="button" className="link-btn danger-link" onClick={() => onDelete(g.name, g.total)}>
                    Retirer
                  </button>
                )}
              </div>
              <div className="zone-chips">
                <span className="zone-chip">
                  <span className="zone-chip-dot" style={{ background: 'var(--accent)' }} />
                  Comptage <strong className="num">{g.counted}/{g.total}</strong>
                </span>
                <span className="zone-chip">
                  <span className="zone-chip-dot" style={{ background: 'var(--success)' }} />
                  Audit <strong className="num">{g.audited}/{g.total}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>
        Détail des balises
      </div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        {readOnly
          ? 'Cliquez sur une balise pour consulter son état.'
          : 'Cliquez sur une balise pour rouvrir ou clôturer son comptage ou son audit — utile quand un compteur a quitté l’application en laissant une balise ouverte.'}
      </p>
      <BaliseGrid zones={zones} onSelect={setSelected} />

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
