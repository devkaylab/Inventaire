'use client'

import { useEffect, useRef, useState } from 'react'
import { closeSession, deleteSession, reopenSession, type Session } from '@/lib/inventory'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

/**
 * Actions de l'inventaire — clôture, réouverture, suppression.
 *
 * Elles vivaient en bas de l'onglet Équipe, dans un encadré rouge qu'il fallait
 * aller chercher derrière les membres et les invitations. Elles rejoignent
 * l'en-tête, à côté du statut : ce sont des actions sur l'inventaire entier,
 * pas sur son équipe.
 *
 * Les textes de confirmation sont repris tels quels — la suppression demande
 * toujours de recopier le numéro d'inventaire, ce qui est la vraie protection.
 */
export function SessionActionsMenu({ session, isCreator, onChanged, onDeleted }: {
  session: Session
  isCreator: boolean
  onChanged: () => Promise<void> | void
  onDeleted: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [ouvert, setOuvert] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closed = session.status === 'closed'

  // Un clic ailleurs ou Échap referme : sans cela le menu reste ouvert
  // par-dessus la page pendant qu'on travaille derrière.
  useEffect(() => {
    if (!ouvert) return
    function auClic(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    function auClavier(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', auClic)
    document.addEventListener('keydown', auClavier)
    return () => {
      document.removeEventListener('mousedown', auClic)
      document.removeEventListener('keydown', auClavier)
    }
  }, [ouvert])

  async function onClose() {
    setOuvert(false)
    const ok = await confirm({
      title: 'Clôturer l’inventaire ?',
      message: 'L’inventaire passe en lecture seule : plus aucun comptage ne pourra y être enregistré, y compris depuis les téléphones encore ouverts sur la session.',
      details: [
        'Toutes les données sont conservées.',
        'Le rapport reste consultable et téléchargeable.',
        'Vous pourrez rouvrir l’inventaire si besoin.',
      ],
      confirmLabel: 'Clôturer',
    })
    if (!ok) return
    setBusy(true)
    try {
      await closeSession(session.id)
      toast.success('Inventaire clôturé.')
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onReopen() {
    setOuvert(false)
    const ok = await confirm({
      title: 'Rouvrir l’inventaire ?',
      message: 'Le comptage pourra reprendre et le rapport évoluera de nouveau.',
      confirmLabel: 'Rouvrir',
    })
    if (!ok) return
    setBusy(true)
    try {
      await reopenSession(session.id)
      toast.success('Inventaire rouvert.')
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    setOuvert(false)
    const ok = await confirm({
      title: 'Supprimer définitivement cet inventaire ?',
      message: 'Cette action est irréversible et ne peut pas être annulée.',
      details: [
        'Tous les comptages seront supprimés',
        'Le stock théorique sera supprimé',
        'Les audits et arbitrages seront supprimés',
        'Les membres seront retirés',
        'Le référentiel articles de cet inventaire sera supprimé',
      ],
      confirmLabel: 'Supprimer définitivement',
      tone: 'danger',
      requireText: session.inventory_number,
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await deleteSession(session.id)
      if (!r.success) { toast.error(r.error ?? 'Suppression impossible.'); return }
      toast.success('Inventaire supprimé.')
      onDeleted()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-menu" ref={ref}>
      <button
        type="button"
        className="refresh-btn"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Actions de l’inventaire"
        disabled={busy}
        onClick={() => setOuvert(v => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {ouvert && (
        <div className="dash-menu-pop" role="menu">
          <button type="button" role="menuitem" className="dash-menu-item" onClick={closed ? onReopen : onClose}>
            {closed ? 'Rouvrir l’inventaire' : 'Clôturer l’inventaire'}
          </button>
          {isCreator && (
            <button type="button" role="menuitem" className="dash-menu-item dash-menu-danger" onClick={onDelete}>
              Supprimer définitivement
            </button>
          )}
        </div>
      )}
    </div>
  )
}
