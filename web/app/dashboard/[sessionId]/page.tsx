'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import {
  deleteAuditLine, deleteSession, fmtQty, getArticleLabels, getAudits,
  getCountTotals, getSession, getSessionMembers, getSessionResults, getZoneDashboard,
  money, recomputeAudit, resolveAudit, STATUS_LABELS,
  type ArticleAudit, type ArticleLabel, type Member, type Session,
  type SessionResultRow, type ZoneDashboardRow,
} from '@/lib/inventory'

type Tab = 'report' | 'audit' | 'info'

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [zones, setZones] = useState<ZoneDashboardRow[]>([])
  const [totals, setTotals] = useState<{ counted: number; audited: number }>({ counted: 0, audited: 0 })
  const [members, setMembers] = useState<Member[]>([])
  const [tab, setTab] = useState<Tab>('report')

  const loadProgress = useCallback(async (s: Session) => {
    if (s.uses_zones) setZones(await getZoneDashboard(sessionId))
    else setTotals(await getCountTotals(sessionId))
  }, [sessionId])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session: auth } } = await supabase.auth.getSession()
      if (!auth) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
      if (prof?.role !== 'supervisor') { router.replace('/account'); return }
      const s = await getSession(sessionId)
      if (!s) { router.replace('/dashboard'); return }
      if (!active) return
      setSession(s)
      await loadProgress(s)
      setMembers(await getSessionMembers(sessionId))
      if (active) setReady(true)
    })()
    return () => { active = false }
  }, [router, sessionId, loadProgress])

  async function onClose() {
    if (!session) return
    if (!confirm(`Clôturer l'inventaire « ${session.name || session.store_name} » ?\n\nCela supprime définitivement les comptages, le stock théorique, les audits et les membres. Le catalogue articles est conservé. Action IRRÉVERSIBLE.`)) return
    if (!confirm(`Dernière confirmation : supprimer « ${session.inventory_number} » et toutes ses données ?`)) return
    const r = await deleteSession(sessionId)
    if (!r.success) { alert('Erreur : ' + (r.error ?? 'inconnue')); return }
    router.replace('/dashboard')
  }

  if (!ready || !session) return <div className="auth-wrap"><p className="muted">Chargement…</p></div>

  const closed = session.status === 'closed'
  const zoneTotal = zones.length
  const zoneCounted = zones.filter(z => z.count_status === 'done').length
  const zoneAudited = zones.filter(z => z.audit_status === 'done').length
  const countPct = zoneTotal > 0 ? Math.round((zoneCounted / zoneTotal) * 100) : 0
  const auditPct = zoneTotal > 0 ? Math.round((zoneAudited / zoneTotal) * 100) : 0

  return (
    <div className="dash">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard" className="btn btn-ghost">← Tableau de bord</Link>
          <Link href="/account" className="btn btn-ghost">Mon compte</Link>
        </div>
      </div>

      <div className="dash-detail-head">
        <div>
          <h1 className="admin-title" style={{ margin: 0 }}>{session.name || session.store_name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{session.store_name} · {session.inventory_number}</p>
        </div>
        <span className={`dash-badge dash-badge-${session.status}`}>
          <span className="dash-dot" />{STATUS_LABELS[session.status] ?? session.status}
        </span>
      </div>

      <div className="dash-detail">
        {/* Colonne progression */}
        <aside className="dash-progress panel">
          <div className="dash-section-label">Progression</div>
          {session.uses_zones ? (
            <>
              <div className="dash-big">{countPct}<span className="dash-big-unit">%</span></div>
              <div className="dash-progress-sub">{countPct}% des balises comptées</div>
              <div className="dash-progress-sub">{auditPct}% des balises auditées</div>
              <div className="dash-bar"><div className="dash-bar-fill" style={{ width: `${countPct}%` }} /></div>
              <MissingZones zones={zones} />
            </>
          ) : (
            <>
              <div className="dash-big">{fmtQty(totals.counted)}</div>
              <div className="dash-progress-sub">pièce{totals.counted > 1 ? 's' : ''} scannée{totals.counted > 1 ? 's' : ''}</div>
              <div className="dash-progress-sub">{fmtQty(totals.audited)} pièce{totals.audited > 1 ? 's' : ''} auditée{totals.audited > 1 ? 's' : ''}</div>
            </>
          )}
        </aside>

        {/* Colonne principale : onglets */}
        <div className="dash-main">
          <div className="dash-tabs">
            <button className={`dash-tab${tab === 'report' ? ' active' : ''}`} onClick={() => setTab('report')}>Rapport</button>
            <button className={`dash-tab${tab === 'audit' ? ' active' : ''}`} onClick={() => setTab('audit')}>Audit &amp; écart</button>
            <button className={`dash-tab${tab === 'info' ? ' active' : ''}`} onClick={() => setTab('info')}>Infos</button>
          </div>

          {tab === 'report' && <ReportTab sessionId={sessionId} />}
          {tab === 'audit' && <AuditTab sessionId={sessionId} readOnly={closed} />}
          {tab === 'info' && <InfoTab session={session} members={members} />}
        </div>
      </div>

      {!closed && (
        <div className="dash-danger">
          <button className="btn btn-danger" onClick={onClose}>Clôturer l'inventaire</button>
          <span className="muted small">Supprime définitivement les données de comptage de cet inventaire.</span>
        </div>
      )}
    </div>
  )
}

function MissingZones({ zones }: { zones: ZoneDashboardRow[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, { total: number; counted: number }>()
    for (const z of zones) {
      const name = z.name ?? '(Sans nom)'
      const g = m.get(name) ?? { total: 0, counted: 0 }
      g.total += 1
      if (z.count_status === 'done') g.counted += 1
      m.set(name, g)
    }
    return [...m.entries()].map(([name, g]) => ({ name, ...g })).sort((a, b) => a.name.localeCompare(b.name))
  }, [zones])

  const missing = groups.filter(g => g.counted < g.total)
  if (zones.length === 0) return <p className="muted small" style={{ marginTop: 12 }}>Aucune balise affectée.</p>
  if (missing.length === 0) return <div className="dash-ok">Toutes les balises ont été comptées.</div>
  return (
    <div className="dash-missing">
      <div className="dash-section-label">Emplacements incomplets</div>
      {missing.map(g => (
        <div className="dash-missing-row" key={g.name}>
          <span>{g.name}</span>
          <span className="dash-missing-count">{g.counted}/{g.total}</span>
        </div>
      ))}
    </div>
  )
}

function ReportTab({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SessionResultRow[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      await recomputeAudit(sessionId)
      const r = await getSessionResults(sessionId)
      if (active) { setRows(r); setLoading(false) }
    })()
    return () => { active = false }
  }, [sessionId])

  const totals = useMemo(() => ({
    lines: rows.length,
    varUnits: rows.reduce((s, x) => s + Number(x.variance_units), 0),
    varValue: rows.reduce((s, x) => s + Number(x.variance_value), 0),
    shrink: rows.reduce((s, x) => s + Math.min(0, Number(x.variance_value)), 0),
  }), [rows])

  if (loading) return <p className="muted">Calcul du rapport…</p>

  return (
    <div>
      <div className="dash-stats">
        <Stat label="Articles comptés" value={String(totals.lines)} />
        <Stat label="Écart (unités)" value={fmtQty(totals.varUnits)} tone={totals.varUnits < 0 ? 'neg' : 'pos'} />
        <Stat label="Écart (valeur achat)" value={`${money(totals.varValue)} €`} tone={totals.varValue < 0 ? 'neg' : 'pos'} />
        <Stat label="Démarque" value={`${money(totals.shrink)} €`} tone="neg" />
      </div>

      {rows.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>Aucun résultat. Les écarts apparaissent après comptage et audit.</p>
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr><th>Article</th><th>Théorique</th><th>Compté</th><th>Écart</th><th>Valeur</th></tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const neg = Number(r.variance_units) < 0
                return (
                  <tr key={r.sku}>
                    <td>
                      <div className="dash-art-label">{r.label || r.sku}</div>
                      <div className="muted small">{r.brand}{r.ean ? ` · ${r.ean}` : ''}</div>
                    </td>
                    <td className="num">{fmtQty(Number(r.theoretical_qty))}</td>
                    <td className="num">{fmtQty(Number(r.counted_qty))}</td>
                    <td className={`num ${Number(r.variance_units) === 0 ? '' : neg ? 'neg' : 'pos'}`}>{fmtQty(Number(r.variance_units))}</td>
                    <td className={`num ${Number(r.variance_value) < 0 ? 'neg' : ''}`}>{money(Number(r.variance_value))} €</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type Discrepancy = { a: ArticleAudit; counted: number; audited: number; ecart: number; ecartValue: number }

function Fig({ label, value, tone }: { label: string; value: string; tone?: 'neg' | 'pos' }) {
  const color = tone === 'neg' ? '#dc2626' : tone === 'pos' ? '#059669' : undefined
  return (
    <div style={{ minWidth: 78 }}>
      <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</div>
    </div>
  )
}

function AuditTab({ sessionId, readOnly }: { sessionId: string; readOnly: boolean }) {
  const [loading, setLoading] = useState(true)
  const [audits, setAudits] = useState<ArticleAudit[]>([])
  const [labels, setLabels] = useState<Record<string, ArticleLabel>>({})
  const [zones, setZones] = useState<ZoneDashboardRow[]>([])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    await recomputeAudit(sessionId)
    const a = await getAudits(sessionId)
    const skus = [...new Set(a.map(x => x.sku))]
    const [l, z] = await Promise.all([getArticleLabels(sessionId, skus), getZoneDashboard(sessionId)])
    setAudits(a); setLabels(l); setZones(z); setLoading(false)
  }, [sessionId])

  useEffect(() => { load() }, [load])

  const keyOf = (a: ArticleAudit) => `${a.zone} ${a.sku}`
  const zoneName = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const z of zones) m[z.code] = z.name
    return m
  }, [zones])
  const auditedZones = useMemo(() => new Set(zones.filter(z => z.audit_status === 'done').map(z => z.code)), [zones])

  // Écart = Auditeur (P2) − Compteur (P1). On ne compare que dans une balise
  // AUDITÉE : un article compté mais non audité ressort avec −compté. En mode
  // classique (sans balise), on compare quand l'audit existe. Corrigés exclus.
  const groups = useMemo(() => {
    const rows: Discrepancy[] = []
    for (const a of audits) {
      if (a.status === 'resolved') continue
      const counted = Number(a.qty_pass1 ?? 0)
      const audited = Number(a.qty_pass2 ?? 0)
      const ecart = audited - counted
      if (ecart === 0) continue
      const zoned = a.zone && a.zone !== ''
      if (zoned ? !auditedZones.has(a.zone) : a.qty_pass2 == null) continue
      rows.push({ a, counted, audited, ecart, ecartValue: ecart * (labels[a.sku]?.price ?? 0) })
    }
    const map = new Map<string, Discrepancy[]>()
    for (const r of rows) {
      const list = map.get(r.a.zone) ?? []
      list.push(r); map.set(r.a.zone, list)
    }
    return [...map.entries()]
      .map(([zone, list]) => ({ zone, name: zoneName[zone] ?? null, list: list.sort((x, y) => x.a.sku.localeCompare(y.a.sku)) }))
      .sort((x, y) => {
        const nx = parseInt(x.zone, 10), ny = parseInt(y.zone, 10)
        if (!isNaN(nx) && !isNaN(ny)) return nx - ny
        return x.zone.localeCompare(y.zone)
      })
  }, [audits, labels, auditedZones, zoneName])

  const total = groups.reduce((s, g) => s + g.list.length, 0)

  async function onResolve(a: ArticleAudit, fallback: number) {
    const raw = inputs[keyOf(a)] ?? String(fallback)
    const qty = parseFloat(raw)
    if (isNaN(qty) || qty < 0) { alert('Entrez une quantité retenue valide (nombre positif).'); return }
    setBusy(keyOf(a))
    const r = await resolveAudit(sessionId, a.sku, qty, a.zone)
    setBusy(null)
    if (!r.success) { alert(r.error === 'invalid_qty' ? 'Quantité invalide.' : 'Correction impossible.'); return }
    await load()
  }

  async function onDelete(a: ArticleAudit) {
    if (!confirm('Supprimer cette ligne (comptages inclus) ?')) return
    setBusy(keyOf(a))
    const r = await deleteAuditLine(sessionId, a.sku, a.zone)
    setBusy(null)
    if (!r.success) { alert('Suppression impossible.'); return }
    await load()
  }

  if (loading) return <p className="muted">Calcul des écarts…</p>
  if (total === 0) return (
    <p className="muted">
      {audits.length === 0
        ? 'Les articles apparaîtront après le comptage.'
        : "Aucun écart : le comptage et l'audit concordent, ou l'audit n'a pas encore été réalisé."}
    </p>
  )

  return (
    <div>
      <p className="muted small" style={{ marginBottom: 12 }}>
        {total} écart{total > 1 ? 's' : ''} entre le comptage et l&apos;audit (l&apos;écart est calculé par rapport à l&apos;auditeur).
      </p>
      {groups.map(g => (
        <div key={g.zone || '_'} style={{ marginBottom: 20 }}>
          {g.zone !== '' && (
            <div className="dash-section-label" style={{ marginBottom: 8 }}>
              Balise {g.zone}{g.name ? ` · ${g.name}` : ''} — {g.list.length} écart{g.list.length > 1 ? 's' : ''}
            </div>
          )}
          <div className="dash-audit-list">
            {g.list.map(({ a, counted, audited, ecart, ecartValue }) => {
              const lbl = labels[a.sku]
              return (
                <div className="dash-audit-row" key={a.id} style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div className="dash-audit-info" style={{ minWidth: 160 }}>
                    <div className="dash-art-label">{lbl?.label || a.sku}</div>
                    <div className="muted small">SKU {a.sku}{lbl?.brand ? ` · ${lbl.brand}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <Fig label="Compteur" value={fmtQty(counted)} />
                    <Fig label="Auditeur" value={fmtQty(audited)} />
                    <Fig label="Écart" value={`${fmtQty(ecart)} u`} tone={ecart < 0 ? 'neg' : 'pos'} />
                    <Fig label="Écart valeur" value={`${money(ecartValue)} €`} tone={ecartValue < 0 ? 'neg' : undefined} />
                  </div>
                  {!readOnly && (
                    <div className="dash-audit-actions">
                      <input
                        className="dash-audit-input"
                        inputMode="decimal"
                        placeholder={`Retenu (${fmtQty(audited)})`}
                        value={inputs[keyOf(a)] ?? ''}
                        onChange={e => setInputs(p => ({ ...p, [keyOf(a)]: e.target.value }))}
                      />
                      <button className="btn btn-primary" disabled={busy === keyOf(a)} onClick={() => onResolve(a, audited)}>Corriger</button>
                      <button className="link-btn danger-link" disabled={busy === keyOf(a)} onClick={() => onDelete(a)}>Supprimer</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function InfoTab({ session, members }: { session: Session; members: Member[] }) {
  return (
    <div className="dash-info">
      <div className="dash-info-grid">
        <InfoRow label="N° d'inventaire" value={session.inventory_number} />
        <InfoRow label="Magasin" value={session.store_name} />
        <InfoRow label="Statut" value={STATUS_LABELS[session.status] ?? session.status} />
        <InfoRow label="Mode" value={session.uses_zones ? 'Zones / balises' : 'Classique'} />
        <InfoRow label="Créé le" value={new Date(session.created_at).toLocaleDateString('fr-FR')} />
      </div>

      <div className="dash-section-label" style={{ marginTop: 20 }}>Membres ({members.length})</div>
      {members.length === 0 ? (
        <p className="muted small">Aucun membre pour l'instant.</p>
      ) : (
        <div className="chips">
          {members.map(m => (
            <span className="chip" key={m.user_id}>
              {m.full_name || 'Sans nom'}{m.role === 'supervisor' ? ' · superviseur' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-info-row">
      <span className="dash-info-label">{label}</span>
      <span className="dash-info-value">{value}</span>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="dash-stat">
      <div className={`dash-stat-value${tone ? ' ' + tone : ''}`}>{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  )
}
