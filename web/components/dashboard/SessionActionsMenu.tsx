'use client'

import { useEffect, useRef, useState } from 'react'
import { closeSession, deleteSession, reopenSession, type Session } from '@/lib/inventory'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { t } from '@/lib/i18n'

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
export function SessionActionsMenu({ session, isCreator, canReopen, onChanged, onDeleted }: {
  session: Session
  isCreator: boolean
  /**
   * Clôturer ET rouvrir appartiennent au créateur, ou à l'administrateur de
   * l'entreprise.
   *
   * ⚠️ **La clôture y a été ajoutée le 8 septembre 2026** (Julien : « seul le
   * créateur de l'inventaire peut le clôturer »), ce qui révoque la règle du
   * 22 août — « clôturer est un geste de terrain ouvert à tout superviseur
   * participant ». Elle ne tenait plus : depuis le même jour, un invité ne
   * voit plus un inventaire une fois clôturé, donc il se retirerait l'écran
   * sous les doigts.
   */
  canReopen: boolean
  onChanged: () => Promise<void> | void
  onDeleted: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [ouvert, setOuvert] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closed = session.status === 'closed'
  // Archivé : le détail des scans est parti, la base refuse la réouverture
  // (déclencheur `sessions_archive_figee`). On ne propose pas un geste qui échoue.
  const archive = session.archived_at !== null

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
      title: t('Clôturer l’inventaire ?'),
      message: t('L’inventaire passe en lecture seule : plus aucun comptage ne pourra y être enregistré, y compris depuis les téléphones encore ouverts sur la session.'),
      details: [
        t('Toutes les données sont conservées.'),
        t('Le rapport reste consultable et téléchargeable.'),
        t('Vous pourrez rouvrir l’inventaire si besoin.'),
      ],
      confirmLabel: t('Clôturer'),
    })
    if (!ok) return
    setBusy(true)
    try {
      await closeSession(session.id)
      toast.success(t('Inventaire clôturé.'))
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
      title: t('Rouvrir l’inventaire ?'),
      message: t('Le comptage pourra reprendre et le rapport évoluera de nouveau.'),
      confirmLabel: t('Rouvrir'),
    })
    if (!ok) return
    setBusy(true)
    try {
      await reopenSession(session.id)
      toast.success(t('Inventaire rouvert.'))
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
      title: t('Supprimer définitivement cet inventaire ?'),
      message: t('Cette action est irréversible et ne peut pas être annulée.'),
      details: [
        t('Tous les comptages seront supprimés'),
        t('Le stock théorique sera supprimé'),
        t('Les audits et arbitrages seront supprimés'),
        t('Les membres seront retirés'),
        t('Le référentiel articles de cet inventaire sera supprimé'),
      ],
      confirmLabel: t('Supprimer définitivement'),
      tone: 'danger',
      requireText: session.inventory_number,
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await deleteSession(session.id)
      if (!r.success) { toast.error(r.error ?? t('Suppression impossible.')); return }
      toast.success(t('Inventaire supprimé.'))
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
        aria-label={t('Actions de l’inventaire')}
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
          {/* ⚠️ Ni clôturer ni rouvrir ne s'offrent à un invité : la base les
              refuse (policy `sessions_supervisor_update`, USING pour la
              réouverture et WITH CHECK pour la clôture), et un bouton qui
              échoue vaut moins que pas de bouton — on le découvre après avoir
              accepté une confirmation. */}
          {canReopen && (!closed || !archive) && (
            <button type="button" role="menuitem" className="dash-menu-item" onClick={closed ? onReopen : onClose}>
              {closed ? t('Rouvrir l’inventaire') : t('Clôturer l’inventaire')}
            </button>
          )}
          {!closed && !canReopen && (
            <div className="dash-menu-note">
              {t('Seul le créateur de l’inventaire peut le clôturer.')}
            </div>
          )}
          {closed && archive && (
            <div className="dash-menu-note">
              {t('Inventaire archivé : le détail de ses scans a été effacé, il ne se rouvre plus.')}
            </div>
          )}
          {closed && !archive && !canReopen && (
            <div className="dash-menu-note">
              {t('Cet inventaire a été clôturé par son créateur. Lui seul peut le rouvrir.')}
            </div>
          )}
          {isCreator && (
            <button type="button" role="menuitem" className="dash-menu-item dash-menu-danger" onClick={onDelete}>
              {t('Supprimer définitivement')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
