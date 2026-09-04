'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getEcartsArbitres, getEcartsPage, getEcartsResume, getEcartsZones,
  recomputeAudit, resolveAudit,
  type ArticleAudit, type ArticleLabel, type EcartsResume,
} from '@/lib/inventory'
import type { ZoneDashboardRow } from '@/lib/zones'
import {
  auditKey, groupDiscrepancies, KIND_LABELS,
  type Discrepancy,
} from '@/lib/discrepancies'
import { fmtQty, fmtSigned, money, parseDecimal, relativeTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination, useRetourEnHaut } from '@/components/ui/Pagination'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { Figure, Stat } from '@/components/ui/Stat'

/**
 * ⚠️ LA LISTE SE LIT PAR PAGES (3 septembre 2026).
 *
 * Avant, l'onglet chargeait toutes les lignes d'audit — 400 000 sur un gros
 * inventaire, 12,9 s pour un plafond de 8 s : il ne s'ouvrait plus. La règle
 * qui décide ce qui est un écart est passée en base, à l'identique.
 */
const PAGE = 50

export function EcartsTab({ sessionId, zones, readOnly, onResolved }: {
  sessionId: string
  zones: ZoneDashboardRow[]
  readOnly: boolean
  onResolved: () => Promise<void> | void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [loading, setLoading] = useState(true)
  const [chargeantPage, setChargeantPage] = useState(false)
  const [resume, setResume] = useState<EcartsResume | null>(null)
  const [zoneOptions, setZoneOptions] = useState<{ nom: string; lignes: number }[]>([])
  const [pageRows, setPageRows] = useState<Discrepancy[]>([])
  const [pageZoneNames, setPageZoneNames] = useState<Record<string, string | null>>({})
  const [totalFiltre, setTotalFiltre] = useState(0)
  const [page, setPage] = useState(0)
  const [resolved, setResolved] = useState<ArticleAudit[]>([])
  const [labels, setLabels] = useState<Record<string, ArticleLabel>>({})
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  /** Bouge à chaque arbitrage : c'est ce qui fait relire la page. */
  const [version, setVersion] = useState(0)
  /** Le haut de la liste : on y revient à chaque changement de page. */
  const hautDeListe = useRetourEnHaut(page)

  /**
   * Le travail lourd : le recalcul, les totaux et la liste des emplacements.
   * ⚠️ Il ne se refait PAS en tournant les pages — le recalcul réécrit
   * `article_audit`, et le rejouer à chaque page coûterait des secondes.
   */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Un seul recalcul explicite, au chargement de l'onglet — pas un par
      // onglet visité comme auparavant.
      await recomputeAudit(sessionId)
      const [r, z, arb] = await Promise.all([
        getEcartsResume(sessionId),
        getEcartsZones(sessionId),
        getEcartsArbitres(sessionId, { limite: 50 }),
      ])
      setResume(r); setZoneOptions(z)
      setResolved(arb.rows)
      setLabels(l => ({ ...l, ...arb.labels }))
      setVersion(v => v + 1)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId, toast])

  useEffect(() => { void load() }, [load])

  // Changer d'emplacement ramène à la première page.
  useEffect(() => { setPage(0) }, [zoneFilter])

  /** La page affichée — recherchée, filtrée et ordonnée par le serveur. */
  useEffect(() => {
    let vivant = true
    setChargeantPage(true)
    getEcartsPage(sessionId, {
      zone: zoneFilter === 'all' ? null : zoneFilter,
      offset: page * PAGE,
      limite: PAGE,
    })
      .then(({ rows, labels: l, zoneNames, total }) => {
        if (!vivant) return
        setPageRows(rows)
        setPageZoneNames(zoneNames)
        setLabels(prev => ({ ...prev, ...l }))
        setTotalFiltre(total)
      })
      .catch((err) => { if (vivant) toast.error(friendlyError(err)) })
      .finally(() => { if (vivant) setChargeantPage(false) })
    return () => { vivant = false }
  }, [sessionId, zoneFilter, page, version, toast])

  // Le nom des balises : celui de la page, complété par le tableau de bord
  // déjà en mémoire — un emplacement sans écart n'est pas dans la page.
  const zoneNames = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const z of zones) m[z.code] = z.name
    return { ...m, ...pageZoneNames }
  }, [zones, pageZoneNames])

  // ⚠️ On ne groupe QUE la page. Le serveur la rend déjà dans l'ordre des
  // balises, donc les groupes restent cohérents d'une page à l'autre — une
  // balise qui déborde repart simplement sous son titre à la page suivante.
  const groups = useMemo(() => groupDiscrepancies(pageRows, zoneNames), [pageRows, zoneNames])

  // ⚠️ Les compteurs portent sur TOUT l'inventaire, pas sur la page : un
  // « écarts à traiter » qui changerait en tournant les pages ne voudrait
  // rien dire.
  const stats = useMemo(() => ({
    total: resume?.total ?? 0,
    byKind: {
      quantity: resume?.quantite ?? 0,
      'missing-audit': resume?.manque_audit ?? 0,
      'missing-count': resume?.manque_comptage ?? 0,
    },
  }), [resume])

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

  // ⚠️ L'ATTENTE SE DIT. Le recalcul des écarts prend plusieurs secondes sur
  // un gros inventaire ; une ossature muette ressemble à une page vide, et le
  // « 0 » des tuiles se lisait comme un résultat (constat de Julien).
  const pagesEcarts = Math.max(1, Math.ceil(totalFiltre / PAGE))
  const compteAffiche = totalFiltre === 0
    ? 'Aucun écart à afficher'
    : `${(page * PAGE + 1).toLocaleString('fr-FR')}–${Math.min(totalFiltre, (page + 1) * PAGE).toLocaleString('fr-FR')}`
      + ` sur ${totalFiltre.toLocaleString('fr-FR')} écart${totalFiltre > 1 ? 's' : ''}`

  if (loading) {
    return (
      <div>
        <p className="chargement-note" role="status">
          Recherche des écarts en cours… Sur un inventaire de plusieurs dizaines de milliers de
          références, comptez quelques secondes.
        </p>
        <SkeletonRows rows={4} />
      </div>
    )
  }

  return (
    <div>
      {/* ⚠️ Sans résumé, « — » et jamais « 0 » : un zéro d'écart se lit comme
          une victoire, et celui-là n'aurait rien mesuré. */}
      <div className="dash-stats">
        <Stat
          label="Écarts à traiter"
          value={resume ? String(stats.total) : '—'}
          tone={!resume ? 'neutral' : stats.total > 0 ? 'neg' : 'pos'}
        />
        <Stat label="Quantités différentes" value={resume ? String(stats.byKind.quantity) : '—'} />
        <Stat
          label="Non retrouvés à l’audit"
          value={resume ? String(stats.byKind['missing-audit']) : '—'}
          tone={resume && stats.byKind['missing-audit'] > 0 ? 'warn' : 'neutral'}
        />
        <Stat label="Arbitrés" value={resume ? String(resume.arbitres) : '—'} tone={resume ? 'pos' : 'neutral'} />
      </div>

      {!resume && (
        <div className="banner banner-warn">
          Les écarts n’ont pas pu être calculés — le serveur a mis trop de temps à répondre.
          Rien n’est perdu, les comptages sont intacts :{' '}
          <button type="button" className="link-btn" onClick={() => void load()}>réessayer</button>.
        </div>
      )}

      <p className="muted small" style={{ marginBottom: 12 }}>
        L’écart se lit <strong>du point de vue de l’auditeur</strong> : écart = quantité de l’auditeur
        moins quantité du compteur. La comparaison n’a lieu que dans une balise dont l’audit est
        terminé — sinon tout article pas encore repassé ressortirait à tort en écart.
      </p>

      {zoneOptions.length > 1 && (
        <div className="toolbar">
          <label htmlFor="zone-filter" className="dash-section-label">Emplacement</label>
          <select id="zone-filter" value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
            <option value="all">Tous ({stats.total})</option>
            {zoneOptions.map(z => (
              <option key={z.nom} value={z.nom}>{z.nom} ({z.lignes})</option>
            ))}
          </select>
        </div>
      )}

      {/* ⚠️ Les boutons sont AUSSI en tête : sur un écran de 14 pouces, la
          liste des écarts dépasse la fenêtre et ceux du bas restent hors de
          vue (constat de Julien, 3 septembre 2026). */}
      <div ref={hautDeListe} />
      {totalFiltre > 0 && (
        <Pagination page={page} pages={pagesEcarts} chargement={chargeantPage} onPage={setPage}>
          <span className="muted small">
            {compteAffiche}
            {chargeantPage && ' · chargement…'}
          </span>
        </Pagination>
      )}

      {groups.length === 0 && !chargeantPage ? (
        <EmptyState
          tone={(resume?.arbitres ?? 0) > 0 || stats.total > 0 ? 'ok' : 'neutral'}
          title={stats.total === 0
            ? 'Aucun écart entre le comptage et l’audit'
            : 'Aucun écart dans cet emplacement'}
          hint={stats.total === 0
            ? 'Soit les chiffres concordent, soit l’audit des balises concernées n’est pas encore terminé.'
            : 'Choisissez « Tous » pour voir les autres emplacements.'}
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

      {totalFiltre > 0 && (
        <Pagination page={page} pages={pagesEcarts} chargement={chargeantPage} onPage={setPage}>
          <span className="muted small">{compteAffiche}</span>
        </Pagination>
      )}

      {resolved.length > 0 && (
        <details className="collapsible">
          <summary>Écarts arbitrés ({resume?.arbitres ?? resolved.length})</summary>
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
