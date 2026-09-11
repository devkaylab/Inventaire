'use client'

import {
  deleteSessionInvitation, removeSessionMember,
  type Member, type Session, type SessionInvitation,
} from '@/lib/inventory'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddSessionMember } from '@/components/dashboard/AddSessionMember'
import { t } from '@/lib/i18n'

export function EquipeTab({ session, members, invitations, isCreator, currentUserId, onChanged, onDeleted }: {
  session: Session
  members: Member[]
  invitations: SessionInvitation[]
  isCreator: boolean
  /** Pour ne pas se proposer soi-même dans les suggestions. */
  currentUserId: string
  onChanged: () => Promise<void> | void
  onDeleted: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const closed = session.status === 'closed'

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('%{quoi} copié.', { quoi: label }))
    } catch {
      toast.error(t('Copie impossible : sélectionnez la valeur puis copiez-la manuellement.'))
    }
  }

  async function onRemove(m: Member) {
    const ok = await confirm({
      title: t('Retirer %{nom} ?', { nom: m.full_name || t('ce membre') }),
      message: t('La personne perdra l’accès à cet inventaire.'),
      details: [t('Ses comptages déjà enregistrés sont conservés.')],
      confirmLabel: t('Retirer'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      const r = await removeSessionMember(session.id, m.user_id)
      if (!r.success) { toast.error(r.error ?? t('Retrait impossible.')); return }
      toast.success(t('Membre retiré.'))
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  async function onCancelInvitation(inv: SessionInvitation) {
    try {
      await deleteSessionInvitation(inv.id)
      toast.success(t('Invitation annulée.'))
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }




  return (
    <div>
      <div className="dash-section-label">{t('Identifiants de connexion')}</div>
      <p className="muted small" style={{ margin: '6px 0 12px' }}>
        {t('À communiquer aux compteurs pour qu’ils rejoignent l’inventaire depuis l’application mobile.')}
      </p>
      <div className="cred-row">
        <span className="dash-info-label">{t('N° d’inventaire')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="cred-value">{session.inventory_number}</span>
          <button type="button" className="link-btn" onClick={() => copy(session.inventory_number, t('Numéro d’inventaire'))}>
            {t('Copier')}
          </button>
        </span>
      </div>
      {session.security_code && (
        <div className="cred-row">
          <span className="dash-info-label">{t('Code d’accès')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cred-value">{session.security_code}</span>
            <button type="button" className="link-btn" onClick={() => copy(session.security_code!, t('Code d’accès'))}>
              {t('Copier')}
            </button>
          </span>
        </div>
      )}

      {/* Le formulaire vivait DANS ce libellé, qui porte `text-transform:
          uppercase` : tout son texte partait en capitales, et la rangée
          `space-between` l'écrasait contre le compteur de membres. Il a son
          propre bloc. */}
      {!closed && (
        <AddSessionMember
          sessionId={session.id}
          storeId={session.store_id}
          members={members}
          invitations={invitations}
          currentUserId={currentUserId}
          onAdded={onChanged}
        />
      )}

      <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>
        {t('Membres')} ({members.length})
      </div>
      {members.length === 0 ? (
        <EmptyState
          title={t('Aucun membre')}
          hint={t('Ajoutez un compteur à votre équipe, ou communiquez le numéro d’inventaire et son code d’accès.')}
        />
      ) : (
        <div className="people-list">
          {members.map(m => {
            const isOwner = m.user_id === session.created_by
            return (
              <div className="person-row" key={m.user_id}>
                <div className="person-avatar" aria-hidden="true">
                  {(m.full_name?.trim()[0] ?? '?').toUpperCase()}
                </div>
                <div className="person-main">
                  <div className="person-name">
                    {m.full_name || t('Sans nom')}
                    <span className="role-tag">
                      {isOwner ? t('Créateur') : m.session_role === 'supervisor' ? t('Co-superviseur') : t('Compteur')}
                    </span>
                  </div>
                  {m.joined_at && <div className="person-meta">{t('A rejoint le %{date}', { date: fmtDate(m.joined_at) })}</div>}
                </div>
                {isCreator && !closed && !isOwner && (
                  <button type="button" className="link-btn danger-link" onClick={() => onRemove(m)}>
                    {t('Retirer')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {invitations.length > 0 && (
        <>
          <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>
            {t('Invitations en attente')} ({invitations.length})
          </div>
          <div className="people-list">
            {invitations.map(inv => (
              <div className="person-row" key={inv.id}>
                <div className="person-avatar" aria-hidden="true">
                  {(inv.full_name?.trim()[0] || inv.email[0]).toUpperCase()}
                </div>
                <div className="person-main">
                  <div className="person-name">{inv.full_name || inv.email}</div>
                  <div className="person-meta">
                    {inv.email} · {t('en attente d’inscription')} · {t('invitée le %{date}', { date: fmtDateTime(inv.created_at) })}
                  </div>
                </div>
                {isCreator && (
                  <button type="button" className="link-btn danger-link" onClick={() => onCancelInvitation(inv)}>
                    {t('Annuler')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  )
}

