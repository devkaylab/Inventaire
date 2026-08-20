'use client'

import { useState } from 'react'
import {
  closeSession, deleteSession, deleteSessionInvitation, removeSessionMember, reopenSession,
  STATUS_LABELS, type Member, type Session, type SessionInvitation,
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
  const [busy, setBusy] = useState(false)
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

  async function onClose() {
    const ok = await confirm({
      title: 'Clôturer l’inventaire ?',
      message: 'L’inventaire passe en lecture seule : plus aucun comptage ne pourra y être enregistré, y compris depuis les téléphones encore ouverts sur la session.',
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
    const ok = await confirm({
      title: 'Rouvrir l’inventaire ?',
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
    const ok = await confirm({
      title: 'Supprimer définitivement cet inventaire ?',
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

      <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>Informations</div>
      <div className="dash-info-grid">
        <Info label="Magasin" value={session.store_name} />
        <Info label="Statut" value={STATUS_LABELS[session.status] ?? session.status} />
        <Info label="Mode" value={session.uses_zones ? 'Zones et balises' : 'Classique (sans balise)'} />
        <Info label="Créé le" value={fmtDate(session.created_at)} />
        {session.closed_at && <Info label="Clôturé le" value={fmtDateTime(session.closed_at)} />}
      </div>

      <div className="dash-danger">
        <div className="dash-danger-row">
          <div className="dash-danger-text">
            <strong>{closed ? 'Rouvrir l’inventaire' : 'Clôturer l’inventaire'}</strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              {closed
                ? 'Le comptage pourra reprendre. Les données n’ont pas été supprimées.'
                : 'Arrête le comptage et passe l’inventaire en lecture seule. Toutes les données sont conservées et le rapport reste téléchargeable.'}
            </p>
          </div>
          <button
            type="button"
            className={closed ? 'btn btn-primary' : 'btn btn-ghost'}
            disabled={busy}
            onClick={closed ? onReopen : onClose}
          >
            {closed ? 'Rouvrir' : 'Clôturer'}
          </button>
        </div>

        {isCreator && (
          <div className="dash-danger-row" style={{ borderTop: '1px solid var(--danger-border)', paddingTop: 16 }}>
            <div className="dash-danger-text">
              <strong>Supprimer définitivement</strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                Efface comptages, stock théorique, audits, membres et référentiel de cet inventaire.
                Pensez à télécharger le rapport avant. Action irréversible.
              </p>
            </div>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={onDelete}>
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-info-row">
      <span className="dash-info-label">{label}</span>
      <span className="dash-info-value">{value}</span>
    </div>
  )
}
