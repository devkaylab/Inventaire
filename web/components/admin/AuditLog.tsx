'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { money } from '@/lib/format'

type Entry = {
  id: number
  actor_label: string
  action: string
  target_type: string
  target_id: string
  target_label: string
  details: Record<string, unknown>
  created_at: string
}

/**
 * Journal des actions d'administration (constat M4 de l'audit RGPD).
 *
 * Chaque ligne est écrite par la base elle-même, dans la même transaction que
 * l'action : ce qui s'affiche ici est exhaustif par construction. Lecture
 * seule — il n'existe aucun moyen côté client d'écrire ou d'effacer une ligne.
 * Conservation : 1 an, puis purge par `purge_expired_data()`.
 */
const ACTION_LABEL: Record<string, string> = {
  entreprise_creee: 'Entreprise créée',
  entreprise_creee_depuis_demande: 'Entreprise créée (demande client)',
  entreprise_supprimee: 'Entreprise supprimée',
  magasin_ajoute: 'Magasin ajouté',
  magasin_supprime: 'Magasin supprimé',
  superviseur_affecte: 'Superviseur affecté',
  superviseur_retire: 'Superviseur retiré',
  demande_superviseur_validee: 'Demande superviseur validée',
  demande_superviseur_refusee: 'Demande superviseur refusée',
  compte_supprime: 'Compte supprimé',
  devis_envoye: 'Devis envoyé',
  statut_demande_entreprise: 'Statut de demande modifié',
  demande_entreprise_supprimee: 'Demande d’inscription supprimée',
}

const STATUT_FR: Record<string, string> = {
  accepted: 'acceptée',
  paid: 'payée',
  rejected: 'refusée',
}

function frDateTime(s: string) {
  return new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Une ligne de contexte, à partir des détails propres à chaque action. */
function detailText(e: Entry): string {
  const d = e.details ?? {}
  const parts: string[] = []
  if (typeof d.entreprise === 'string' && d.entreprise) parts.push(d.entreprise)
  if (typeof d.utilisateur === 'string' && d.utilisateur) parts.push(d.utilisateur)
  if (typeof d.email === 'string' && d.email) parts.push(d.email)
  if (typeof d.statut === 'string' && d.statut) parts.push(STATUT_FR[d.statut] ?? d.statut)
  if (typeof d.reference === 'string' && d.reference) parts.push(`réf. ${d.reference}`)
  if (typeof d.montant_cents === 'number') {
    parts.push(`${money(d.montant_cents / 100)} €`)
  }
  if (typeof d.magasins === 'number') parts.push(`${d.magasins} magasin${d.magasins > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

const PAGE = 30

export function AuditLog() {
  const [rows, setRows] = useState<Entry[] | null>(null)
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.rpc('admin_list_audit_log', { p_limit: 500 })
      setRows((data as Entry[]) ?? [])
    })()
  }, [])

  if (rows === null) return <p className="muted">Chargement…</p>
  if (rows.length === 0) {
    return <p className="muted">Aucune action enregistrée pour l&apos;instant. Chaque action d&apos;administration s&apos;inscrira ici, conservée un an.</p>
  }

  return (
    <>
      <div className="journal-list">
        {rows.slice(0, shown).map((e) => (
          <div className="journal-row" key={e.id}>
            <span className="journal-when">{frDateTime(e.created_at)}</span>
            <div className="journal-body">
              <span className="journal-action">{ACTION_LABEL[e.action] ?? e.action}</span>
              {e.target_label && <span className="journal-target">{e.target_label}</span>}
              {detailText(e) && <span className="muted small">{detailText(e)}</span>}
            </div>
            <span className="journal-actor muted small">par {e.actor_label || 'inconnu'}</span>
          </div>
        ))}
      </div>
      {rows.length > shown && (
        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => setShown(shown + PAGE)}>
          Afficher plus ({rows.length - shown} restantes)
        </button>
      )}
    </>
  )
}
