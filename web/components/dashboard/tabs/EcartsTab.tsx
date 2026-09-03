'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getEcarts, recomputeAudit, resolveAudit,
  type ArticleAudit, type ArticleLabel,
} from '@/lib/inventory'
import type { ZoneDashboardRow } from '@/lib/zones'
import {
  auditKey, computeDiscrepancies, groupDiscrepancies, KIND_LABELS, resolvedLines, summarize,
  type Discrepancy,
} from '@/lib/discrepancies'
import { fmtQty, fmtSigned, money, parseDecimal, relativeTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { Figure, Stat } from '@/components/ui/Stat'

export function EcartsTab({ sessionId, zones, readOnly, onResolved }: {
  sessionId: string
  zones: ZoneDashboardRow[]
  readOnly: boolean
  onResolved: () => Promise<void> | void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [loading, setLoading] = useState(true)
  const [audits, setAudits] = useState<ArticleAudit[]>([])
  const [labels, setLabels] = useState<Record<string, ArticleLabel>>({})
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [zoneFilter, setZoneFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Un seul recalcul explicite, au chargement de l'onglet — pas un par
      // onglet visité comme auparavant.
      await recomputeAudit(sessionId)
      const { audits: a, labels: l } = await getEcarts(sessionId)
      setAudits(a); setLabels(l)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId, toast])

  useEffect(() => { void load() }, [load])

  const zoneNames = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const z of zones) m[z.code] = z.name
    return m
  }, [zones])

  const auditedZones = useMemo(
    () => new Set(zones.filter(z => z.audit_status === 'done').map(z => z.code)),
    [zones],
  )

  const all = useMemo(
    () => computeDiscrepancies(audits, labels, auditedZones),
    [audits, labels, auditedZones],
  )

  const filtered = useMemo(
    () => (zoneFilter === 'all' ? all : all.filter(d => (zoneNames[d.audit.zone] ?? '—') === zoneFilter)),
    [all, zoneFilter, zoneNames],
  )

  const groups = useMemo(() => groupDiscrepancies(filtered, zoneNames), [filtered, zoneNames])
  const stats = useMemo(() => summarize(all), [all])
  const resolved = useMemo(() => resolvedLines(audits), [audits])

  const zoneOptions = useMemo(() => {
    const set = new Set<string>()
    for (const d of all) set.add(zoneNames[d.audit.zone] ?? '—')
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [all, zoneNames])

  async function onResolve(d: Discrepancy, qty: number) {
    setBusy(d.key)
    try {
      const r = await resolveAudit(sessionId, d.audit.sku, qty, d.audit.zone)
      if (!r.success) {
        toast.error(r.error === 'invalid_qty' ? 'Quantité invalide.' : 'Correction impossible.')
        return
      }
      setInputs(p => { const next = { ...p }; delete next[d.key]; return next })
      toast.success(`${labels[d.audit.sku]?.label || d.audit.sku} : ${fmtQty(qty)} retenu.`)
      await load()
      await onResolved()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  async function onResolveTyped(d: Discrepancy) {
    const raw = inputs[d.key]
    const qty = raw == null || raw.trim() === '' ? d.audited : parseDecimal(raw)
    if (qty == null || qty < 0) {
      toast.error('Entrez une quantité valide (nombre positif). La virgule est acceptée.')
      return
    }
    await onResolve(d, qty)
  }

  async function onUndo(a: ArticleAudit) {
    const ok = await confirm({
      title: 'Annuler cet arbitrage ?',
      message: 'La ligne repassera en écart et devra être arbitrée à nouveau.',
      confirmLabel: 'Annuler l’arbitrage',
    })
    if (!ok) return
    setBusy(auditKey(a))
    try {
      // `recompute_session_audit` recalcule le statut à partir des comptages
      // dès que la ligne n'est plus « resolved » ; il suffit donc de la
      // supprimer de l'agrégat, sans toucher aux comptages eux-mêmes.
      await recomputeAuditAfterUndo(sessionId, a)
      toast.success('Arbitrage annulé.')
      await load()
      await onResolved()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <SkeletonRows rows={4} />

  return (
    <div>
      <div className="dash-stats">
        <Stat label="Écarts à traiter" value={String(stats.total)} tone={stats.total > 0 ? 'neg' : 'pos'} />
        <Stat label="Quantités différentes" value={String(stats.byKind.quantity)} />
        <Stat
          label="Non retrouvés à l’audit"
          value={String(stats.byKind['missing-audit'])}
          tone={stats.byKind['missing-audit'] > 0 ? 'warn' : 'neutral'}
        />
        <Stat label="Arbitrés" value={String(resolved.length)} tone="pos" />
      </div>

      <p className="muted small" style={{ marginBottom: 12 }}>
        L’écart se lit <strong>du point de vue de l’auditeur</strong> : écart = quantité de l’auditeur
        moins quantité du compteur. La comparaison n’a lieu que dans une balise dont l’audit est
        terminé — sinon tout article pas encore repassé ressortirait à tort en écart.
      </p>

      {zoneOptions.length > 1 && (
        <div className="toolbar">
          <label htmlFor="zone-filter" className="dash-section-label">Emplacement</label>
          <select id="zone-filter" value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
            <option value="all">Tous ({all.length})</option>
            {zoneOptions.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          tone={audits.length > 0 ? 'ok' : 'neutral'}
          title={audits.length === 0
            ? 'Aucun article compté pour l’instant'
            : 'Aucun écart entre le comptage et l’audit'}
          hint={audits.length === 0
            ? 'Les articles apparaîtront ici dès les premiers scans.'
            : 'Soit les chiffres concordent, soit l’audit des balises concernées n’est pas encore terminé.'}
        />
      ) : groups.map(g => (
        <div key={g.zone || '_'} style={{ marginBottom: 20 }}>
          {g.zone !== '' && (
            <div className="group-head">
              <div className="dash-section-label">
                Balise {g.zone}{g.name ? ` · ${g.name}` : ''}
              </div>
              <span className="dash-audit-badge dash-audit-badge-failed">
                {g.rows.length} écart{g.rows.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="dash-audit-list">
            {g.rows.map(d => {
              const lbl = labels[d.audit.sku]
              const typed = inputs[d.key] ?? ''
              const invalid = typed.trim() !== '' && (parseDecimal(typed) == null || (parseDecimal(typed) ?? -1) < 0)
              return (
                <div className={`dash-audit-row dash-audit-${d.kind}`} key={d.audit.id}>
                  <div className="dash-audit-info">
                    <div className="dash-art-label">{lbl?.label || d.audit.sku}</div>
                    <div className="muted small">
                      SKU {d.audit.sku}{lbl?.brand ? ` · ${lbl.brand}` : ''}
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>{KIND_LABELS[d.kind]}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <Figure label="Compteur" value={fmtQty(d.counted)} />
                    <Figure label="Auditeur" value={fmtQty(d.audited)} />
                    <Figure label="Écart" value={`${fmtSigned(d.ecart)} u`} tone={d.ecart < 0 ? 'neg' : 'pos'} />
                    <Figure label="Valeur" value={`${money(d.ecartValue)} €`} tone={d.ecartValue < 0 ? 'neg' : undefined} />
                  </div>

                  {!readOnly && (
                    <div className="dash-audit-actions">
                      <button
                        type="button" className="btn btn-compteur btn-sm"
                        disabled={busy === d.key}
                        onClick={() => onResolve(d, d.counted)}
                        title="Retenir la quantité du compteur"
                      >
                        Compteur
                      </button>
                      <button
                        type="button" className="btn btn-auditeur btn-sm"
                        disabled={busy === d.key}
                        onClick={() => onResolve(d, d.audited)}
                        title="Retenir la quantité de l'auditeur"
                      >
                        Auditeur
                      </button>
                      <input
                        className="dash-audit-input"
                        inputMode="decimal"
                        aria-label="Quantité retenue"
                        aria-invalid={invalid}
                        placeholder="Autre"
                        value={typed}
                        onChange={e => setInputs(p => ({ ...p, [d.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') void onResolveTyped(d) }}
                      />
                      <button
                        type="button" className="btn btn-ghost btn-sm"
                        disabled={busy === d.key || invalid}
                        onClick={() => onResolveTyped(d)}
                      >
                        Retenir
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {resolved.length > 0 && (
        <details className="collapsible">
          <summary>Écarts arbitrés ({resolved.length})</summary>
          <div className="collapsible-body">
            <p className="muted small" style={{ marginBottom: 12 }}>
              Ces lignes ont été tranchées : c’est la quantité retenue qui part dans le rapport.
              Un nouveau comptage ne l’écrase pas.
            </p>
            <div className="dash-audit-list">
              {resolved.map(a => (
                <div className="dash-audit-row" key={a.id}>
                  <div className="dash-audit-info">
                    <div className="dash-art-label">{labels[a.sku]?.label || a.sku}</div>
                    <div className="muted small">
                      SKU {a.sku}{a.zone ? ` · balise ${a.zone}` : ''} · arbitré {relativeTime(a.updated_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <Figure label="Compteur" value={fmtQty(Number(a.qty_pass1 ?? 0))} />
                    <Figure label="Auditeur" value={fmtQty(Number(a.qty_pass2 ?? 0))} />
                    <Figure label="Retenu" value={fmtQty(Number(a.final_qty ?? 0))} tone="accent" />
                  </div>
                  {!readOnly && (
                    <div className="dash-audit-actions">
                      <span className="dash-audit-badge dash-audit-badge-resolved">Arbitré</span>
                      <button
                        type="button" className="link-btn"
                        disabled={busy === auditKey(a)}
                        onClick={() => onUndo(a)}
                      >
                        Annuler l’arbitrage
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * Annule un arbitrage.
 *
 * `resolve_audit` ne sait que poser `resolved`, et `recompute_session_audit`
 * préserve délibérément ce statut. Pour revenir en arrière sans toucher aux
 * comptages, on repasse la ligne par la table : la policy `audit_supervisor`
 * autorise l'UPDATE à un superviseur participant, et le recalcul suivant
 * rétablit le statut réel (validated / failed / pending) à partir des passes.
 */
async function recomputeAuditAfterUndo(sessionId: string, a: ArticleAudit): Promise<void> {
  const { supabase } = await import('@/lib/supabaseClient')
  const { error } = await supabase
    .from('article_audit')
    .update({ status: 'pending', final_qty: null, resolved_by: null })
    .eq('session_id', sessionId)
    .eq('sku', a.sku)
    .eq('zone', a.zone)
  if (error) throw error
  // `force` : on vient d'écrire dans `article_audit` sans toucher aux
  // comptages, donc le raccourci du recalcul ne verrait rien bouger.
  await recomputeAudit(sessionId, true)
}
