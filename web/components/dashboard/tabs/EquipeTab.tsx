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
import { AddCounter } from '@/components/dashboard/AddCounter'

export function EquipeTab({ session, members, invitations, isCreator, onChanged, onDeleted }: {
  session: Session
  members: Member[]
  invitations: SessionInvitation[]
  isCreator: boolean
  onChanged: () => Promise<void> | void
  onDeleted: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const closed = session.status === 'closed'

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copié.`)
    } catch {
      toast.error('Copie impossible : sélectionnez la valeur puis copiez-la manuellement.')
    }
  }

  async function onRemove(m: Member) {
    const ok = await confirm({
      title: `Retirer ${m.full_name || 'ce membre'} ?`,
      message: 'La personne perdra l’accès à cet inventaire.',
      details: ['Ses comptages déjà enregistrés sont conservés.'],
      confirmLabel: 'Retirer',
      tone: 'danger',
    })
    if (!ok) return
    try {
      const r = await removeSessionMember(session.id, m.user_id)
      if (!r.success) { toast.error(r.error ?? 'Retrait impossible.'); return }
      toast.success('Membre retiré.')
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  async function onCancelInvitation(inv: SessionInvitation) {
    try {
      await deleteSessionInvitation(inv.id)
      toast.success('Invitation annulée.')
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }




  return (
    <div>
      <div className="dash-section-label">Identifiants de connexion</div>
      <p className="muted small" style={{ margin: '6px 0 12px' }}>
        À communiquer aux compteurs pour qu’ils rejoignent l’inventaire depuis l’application mobile.
      </p>
      <div className="cred-row">
        <span className="dash-info-label">N° d’inventaire</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="cred-value">{session.inventory_number}</span>
          <button type="button" className="link-btn" onClick={() => copy(session.inventory_number, 'Numéro d’inventaire')}>
            Copier
          </button>
        </span>
      </div>
      {session.security_code && (
        <div className="cred-row">
          <span className="dash-info-label">Code d’accès</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="cred-value">{session.security_code}</span>
            <button type="button" className="link-btn" onClick={() => copy(session.security_code!, 'Code d’accès')}>
              Copier
            </button>
          </span>
        </div>
      )}

      <div
        className="dash-section-label"
        style={{ margin: '28px 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <span>Membres ({members.length})</span>
        {!closed && <AddCounter onAdded={onChanged} />}
      </div>
      {members.length === 0 ? (
        <EmptyState
          title="Aucun membre"
          hint="Ajoutez un compteur à votre équipe, ou communiquez le numéro d’inventaire et son code d’accès."
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
                    {m.full_name || 'Sans nom'}
                    <span className="role-tag">
                      {isOwner ? 'Créateur' : m.session_role === 'supervisor' ? 'Co-superviseur' : 'Compteur'}
                    </span>
                  </div>
                  {m.joined_at && <div className="person-meta">A rejoint le {fmtDate(m.joined_at)}</div>}
                </div>
                {isCreator && !closed && !isOwner && (
                  <button type="button" className="link-btn danger-link" onClick={() => onRemove(m)}>
                    Retirer
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
            Invitations en attente ({invitations.length})
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
                    {inv.email} · en attente d’inscription · invitée le {fmtDateTime(inv.created_at)}
                  </div>
                </div>
                {isCreator && (
                  <button type="button" className="link-btn danger-link" onClick={() => onCancelInvitation(inv)}>
                    Annuler
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

