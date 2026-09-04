'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  cloturerAuditBalise, ecartLigne, getBaliseDetail, setBalise, viderBalise,
  type BaliseLigne, type ZoneDashboardRow,
} from '@/lib/zones'
import { friendlyError } from '@/lib/errors'
import { plural } from '@/lib/format'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { BaliseGrid } from '@/components/dashboard/BaliseGrid'

/**
 * Détail des balises : la grille, et au clic une fenêtre qui montre **ce qui a
 * été compté dessus**.
 *
 * Elle ne montrait que « 2 référence(s) comptée(s) » et les deux cycles. Le
 * superviseur qui voulait savoir ce qu'un rayon avait donné devait ouvrir le
 * rapport de l'inventaire entier et y chercher sa balise (demande de Julien,
 * 2 septembre 2026).
 */
export function BaliseDetail({ sessionId, zones, readOnly, onChanged }: {
  sessionId: string
  zones: ZoneDashboardRow[]
  readOnly: boolean
  onChanged: () => Promise<void> | void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [selected, setSelected] = useState<ZoneDashboardRow | null>(null)

  async function onMarquerComptee(z: ZoneDashboardRow) {
    try {
      const r = await setBalise(sessionId, z.code, 'count', false)
      if (!r.success) { toast.error(r.error ?? 'Action impossible.'); return }
      toast.success(`Balise ${z.code} marquée comptée.`)
      setSelected(null)
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  /**
   * ⚠️ Passe par `cloturerAuditBalise`, PAS par `setBalise`.
   *
   * Basculer le statut seul déclarait l'audit terminé, donc l'écart
   * calculable : toute la balise sortait à moins la totalité du comptage,
   * comme si l'auditeur était passé et n'avait rien trouvé. Ranger un audit que
   * personne n'a fait fabriquait une démarque intégrale sur ce rayon.
   *
   * Quand rien n'a été audité, le serveur reprend le comptage — et l'écran le
   * dit avant, parce que ce n'est plus un simple changement d'état : des lignes
   * sont écrites.
   */
  async function onMarquerAuditee(z: ZoneDashboardRow) {
    if (z.audit_lines === 0) {
      const ok = await confirm({
        title: `Marquer la balise ${z.code} auditée ?`,
        message: 'Personne n’a audité cette balise. Les quantités du comptage seront reprises telles quelles.',
        details: [
          `${plural(z.count_lines, 'référence')} reprise${z.count_lines > 1 ? 's' : ''}, ${plural(Math.round(z.count_units), 'pièce')}`,
          'La balise sortira donc sans écart : le comptage fait foi.',
          'Pour auditer réellement, ouvrez la balise en audit depuis l’application.',
        ],
        confirmLabel: 'Reprendre le comptage',
      })
      if (!ok) return
    }
    try {
      const r = await cloturerAuditBalise(sessionId, z.code)
      if (!r.success) { toast.error(r.error ?? 'Action impossible.'); return }
      toast.success(
        r.reprises
          ? `Balise ${z.code} marquée auditée — ${r.reprises} référence(s) reprise(s) du comptage.`
          : `Balise ${z.code} marquée auditée.`,
      )
      setSelected(null)
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  async function onVider(z: ZoneDashboardRow) {
    // ⚠️ La recopie du numéro est ce qui sépare ce bouton d'un clic de travers :
    // il est à quelques centimètres de « Marquer comptée », et il efface le
    // travail de toute l'équipe sur ce rayon.
    const ok = await confirm({
      title: `Vider la balise ${z.code} ?`,
      message: `Tout ce qui a été relevé sur cette balise sera effacé, et elle repassera « à faire ».`,
      details: [
        `${z.count_lines} référence${z.count_lines > 1 ? 's' : ''} comptée${z.count_lines > 1 ? 's' : ''}, ${Math.round(z.count_units)} pièce${z.count_units > 1 ? 's' : ''}`,
        'Les audits et arbitrages de cette balise partent aussi.',
        'C’est définitif : les comptages ne se récupèrent pas.',
      ],
      confirmLabel: 'Vider la balise',
      tone: 'danger',
      requireText: z.code,
    })
    if (!ok) return
    try {
      const r = await viderBalise(sessionId, z.code)
      if (!r.success) { toast.error(r.error ?? 'Suppression impossible.'); return }
      toast.success(`Balise ${z.code} vidée — ${r.lignes ?? 0} ligne(s) effacée(s).`)
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
          ? 'Cliquez sur une balise pour voir ce qui a été compté dessus.'
          : 'Cliquez sur une balise pour voir ce qui a été compté dessus, et clôturer son comptage ou son audit — utile quand un compteur a quitté l’application en laissant une balise ouverte.'}
      </p>
      <BaliseGrid zones={zones} onSelect={setSelected} showGroupLabels={false} />

      {selected && (
        <Modal title={`Balise ${selected.code}`} onClose={() => setSelected(null)} large>
          <p className="modal-sub">{selected.name ?? 'Sans emplacement'}</p>

          <div className="dash-info-grid" style={{ marginTop: 16 }}>
            <BaliseCycle
              label="Comptage" statut={selected.count_status} readOnly={readOnly}
              action="Marquer comptée" onCloturer={() => onMarquerComptee(selected)}
            />
            <BaliseCycle
              label="Audit" statut={selected.audit_status} readOnly={readOnly}
              action="Marquer auditée" onCloturer={() => onMarquerAuditee(selected)}
            />
          </div>

          <LignesBalise sessionId={sessionId} code={selected.code} />

          {!readOnly && (
            <div className="balise-zone-sensible">
              <button type="button" className="link-btn danger" onClick={() => onVider(selected)}>
                Vider la balise
              </button>
              <span className="muted small">Efface les comptages et repasse la balise « à faire ».</span>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

const STATUS_FR: Record<string, string> = {
  pending: 'Pas commencé', open: 'En cours', done: 'Terminé',
}

/**
 * Un cycle et son seul geste : le clôturer.
 *
 * ⚠️ **« Rouvrir » a été retiré du site** (décision de Julien, 2 septembre
 * 2026) : rouvrir une balise est un geste de terrain, qui n'a de sens que sur
 * le téléphone de la personne qui va la recompter. Rouverte depuis un
 * ordinateur, elle restait ouverte sur aucun appareil, et la seule chose qui
 * avait changé était le tableau de bord. La phrase le dit à sa place.
 */
function BaliseCycle({ label, statut, readOnly, action, onCloturer }: {
  label: string
  statut: 'pending' | 'open' | 'done'
  readOnly: boolean
  action: string
  onCloturer: () => void
}) {
  return (
    <div className="dash-info-row">
      <span className="dash-info-label">{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="dash-info-value">{STATUS_FR[statut]}</span>
        {!readOnly && (
          statut === 'done'
            ? <span className="muted small">Pour rouvrir, passez par l’application</span>
            : <button type="button" className="link-btn" onClick={onCloturer}>{action}</button>
        )}
      </span>
    </div>
  )
}

/** La liste elle-même. Chargée à l'ouverture de la fenêtre, pas avant : rien ne
 *  descend tant qu'on n'a pas demandé une balise. */
function LignesBalise({ sessionId, code }: { sessionId: string; code: string }) {
  const [lignes, setLignes] = useState<BaliseLigne[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setErreur(null)
    try {
      setLignes(await getBaliseDetail(sessionId, code))
    } catch (err) {
      setErreur(friendlyError(err))
    }
  }, [sessionId, code])

  useEffect(() => { void charger() }, [charger])

  if (erreur) return <p className="balise-vide">{erreur}</p>
  if (lignes === null) return <p className="balise-vide">Chargement…</p>

  if (lignes.length === 0) {
    return (
      <div className="balise-bloc">
        <div className="balise-bloc-head"><span className="balise-bloc-title">Ce qui a été compté</span></div>
        <div className="balise-vide">
          <strong>Rien pour l’instant</strong>
          Aucun article n’a encore été scanné sur cette balise.
        </div>
      </div>
    )
  }

  const pieces = lignes.reduce((n, l) => n + Number(l.counted_qty), 0)
  const auditees = lignes.reduce((n, l) => n + Number(l.audited_qty), 0)
  const audit = lignes[0].audit_status

  return (
    <div className="balise-bloc">
      <div className="balise-bloc-head">
        <span className="balise-bloc-title">Ce qui a été compté</span>
        <span className="balise-bloc-count">
          {lignes.length} référence{lignes.length > 1 ? 's' : ''} · {pieces} pièce{pieces > 1 ? 's' : ''} comptée{pieces > 1 ? 's' : ''}
          {auditees > 0 && ` · ${auditees} auditée${auditees > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="balise-tbl">
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th className="num">Comptage</th>
              <th className="num">Audit</th>
              <th className="num">Écart</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(l => <Ligne key={l.sku} l={l} />)}
          </tbody>
        </table>
      </div>

      {audit !== 'done' && (
        <p className="balise-note">
          L’écart se calcule une fois l’audit de la balise clôturé : tant qu’il tourne,
          « pas encore vu » et « pas trouvé » ne se distinguent pas.
        </p>
      )}
    </div>
  )
}

function Ligne({ l }: { l: BaliseLigne }) {
  const nom = l.label || l.brand || l.sku
  const ecart = ecartLigne(l)
  return (
    <tr>
      <td>
        <div className="balise-art">
          {nom}
          {l.label === 'INCONNU' && <span className="tag tag-inconnu">créé au scan</span>}
          {l.final_qty != null && <span className="tag tag-arbitre">arbitré · {Number(l.final_qty)}</span>}
        </div>
        {nom !== l.sku && <div className="balise-ref">{l.sku}</div>}
      </td>
      <td className="num">{Number(l.counted_qty)}</td>
      <td className="num">{l.audited_qty ? Number(l.audited_qty) : <span className="balise-neant">—</span>}</td>
      <td className="num">
        {ecart === null
          ? <span className="balise-neant">—</span>
          : ecart === 0
            ? <span className="balise-neant">0</span>
            : <span className={ecart < 0 ? 'ecart-neg' : 'ecart-pos'}>{ecart > 0 ? '+' : '−'}{Math.abs(ecart)}</span>}
      </td>
    </tr>
  )
}
