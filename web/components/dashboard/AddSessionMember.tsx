'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getStoreDirectory, inviteToSession,
  type DirectoryEntry, type Member, type SessionInvitation, type SessionRole,
} from '@/lib/inventory'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'

/**
 * Ajouter quelqu'un à un inventaire : on cherche, on ne saisit pas.
 *
 * L'onglet Équipe d'un inventaire proposait un formulaire prénom / nom /
 * e-mail qui appelait `invite-teammate` — la fonction qui **crée un compte
 * pour l'entreprise**. Deux choses clochaient : ce n'est pas le geste attendu
 * ici (créer un compteur se fait depuis « Mon équipe »), et surtout personne
 * n'était ajouté à l'inventaire. On remplissait le formulaire, l'équipe de
 * l'inventaire ne bougeait pas.
 *
 * On choisit désormais parmi l'équipe du magasin, par nom, prénom ou e-mail,
 * avec les suggestions qui se réduisent à la frappe — le même parcours que
 * l'application mobile, qui appelle la même edge function `invite-to-session`.
 */
export function AddSessionMember({ sessionId, storeId, members, invitations, currentUserId, onAdded }: {
  sessionId: string
  storeId: string | null
  members: Member[]
  invitations: SessionInvitation[]
  currentUserId: string
  onAdded: () => Promise<void> | void
}) {
  const toast = useToast()
  const [annuaire, setAnnuaire] = useState<DirectoryEntry[]>([])
  const [query, setQuery] = useState('')
  const [choisi, setChoisi] = useState<DirectoryEntry | null>(null)
  const [role, setRole] = useState<SessionRole>('counter')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!storeId) return
    let vivant = true
    getStoreDirectory(storeId)
      .then(rows => { if (vivant) setAnnuaire(rows) })
      .catch(() => { if (vivant) setAnnuaire([]) })
    return () => { vivant = false }
  }, [storeId])

  // Déjà dans l'inventaire : on ne les propose pas. Les reproposer ferait
  // découvrir le doublon au moment de l'envoi.
  const exclus = useMemo(() => {
    const ids = new Set<string>([currentUserId])
    for (const m of members) ids.add(m.user_id)
    return ids
  }, [members, currentUserId])
  const exclusMails = useMemo(
    () => new Set(invitations.map(i => i.email.toLowerCase())),
    [invitations],
  )

  const q = query.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (!q || choisi) return []
    return annuaire
      .filter(d => !exclus.has(d.user_id) && !exclusMails.has((d.email ?? '').toLowerCase()))
      .filter(d =>
        (d.full_name ?? '').toLowerCase().includes(q)
        || (d.email ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [annuaire, q, choisi, exclus, exclusMails])

  const rienTrouve = q.length > 0 && !choisi && suggestions.length === 0

  function choisir(entry: DirectoryEntry) {
    setChoisi(entry)
    setQuery(entry.full_name || entry.email)
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault()
    if (!choisi || busy) return
    setBusy(true)
    try {
      const r = await inviteToSession({
        sessionId,
        fullName: choisi.full_name || '',
        email: choisi.email,
        role,
      })
      if (!r.success) { toast.error(r.error ?? 'Ajout impossible.'); return }
      const qui = choisi.full_name || choisi.email
      toast.success(
        r.outcome === 'added'
          ? `${qui} a rejoint l’inventaire.`
          : `${qui} recevra un e-mail pour rejoindre l’inventaire.`,
      )
      setChoisi(null)
      setQuery('')
      setRole('counter')
      await onAdded()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!storeId) return null

  return (
    <form onSubmit={ajouter} className="member-search">
      <label htmlFor="recherche-membre" className="dash-section-label">
        Ajouter quelqu’un à cet inventaire
      </label>
      <p className="muted small" style={{ margin: '6px 0 10px' }}>
        Cherchez une personne de l’équipe du magasin par nom, prénom ou adresse e-mail.
        Pour créer un compte, passez par <strong>Mon équipe</strong>.
      </p>

      <div className="member-search-row">
        <div className="member-search-field">
          <input
            id="recherche-membre"
            type="search"
            value={query}
            autoComplete="off"
            placeholder="Nom, prénom ou e-mail…"
            onChange={e => { setQuery(e.target.value); setChoisi(null) }}
          />
          {suggestions.length > 0 && (
            <ul className="member-suggestions" role="listbox">
              {suggestions.map(d => (
                <li key={d.user_id}>
                  <button type="button" onClick={() => choisir(d)}>
                    <span className="member-suggestion-name">{d.full_name || d.email}</span>
                    <span className="member-suggestion-mail">{d.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <select
          value={role}
          onChange={e => setRole(e.target.value as SessionRole)}
          aria-label="Rôle dans l’inventaire"
        >
          <option value="counter">Compteur</option>
          <option value="supervisor">Co-superviseur</option>
        </select>

        <button type="submit" className="btn btn-primary btn-sm" disabled={!choisi || busy}>
          {busy ? 'Ajout…' : 'Ajouter'}
        </button>
      </div>

      {choisi && (
        <p className="muted small" style={{ marginTop: 8 }}>
          <strong>{choisi.full_name || choisi.email}</strong> — {choisi.email}
          {' · '}
          <button type="button" className="link-btn" onClick={() => { setChoisi(null); setQuery('') }}>
            changer
          </button>
        </p>
      )}

      {rienTrouve && (
        <p className="muted small" style={{ marginTop: 8 }}>
          Personne de l’équipe de ce magasin ne correspond à «&nbsp;{query.trim()}&nbsp;». Si la
          personne n’a pas encore de compte, créez-le depuis <strong>Mon équipe</strong> ; elle
          apparaîtra ensuite ici.
        </p>
      )}
    </form>
  )
}
