'use client'

// Mon équipe — l'espace de l'administrateur d'entreprise.
//
// Il gère lui-même ses superviseurs : invitation (l'e-mail part par l'edge
// function ca-invite-supervisor), affectation aux magasins, retrait des
// accès, annulation d'invitation. Chaque écriture passe par une RPC
// SECURITY DEFINER gardée par is_company_admin() côté base — double
// authentification conditionnelle comprise — et s'inscrit au journal de
// l'entreprise. La garde client n'est que du confort.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard, signOut } from '@/hooks/useAuthGuard'

type Store = { id: string; name: string }
type Member = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_company_admin: boolean
  email: string | null
  store_ids: string[]
}
type Invitation = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  store_ids: string[]
  created_at: string
}
type Team = { stores: Store[]; members: Member[]; invitations: Invitation[] }

export default function EquipePage() {
  const router = useRouter()
  const guard = useAuthGuard('auth')
  const [team, setTeam] = useState<Team | null>(null)
  const [mfaEnrolled, setMfaEnrolled] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('ca_list_team')
    if (!error && data) setTeam(data as Team)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    if (!guard.profile.is_company_admin) { router.replace('/account'); return }
    load()
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaEnrolled((data?.totp ?? []).some((f) => f.status === 'verified'))
    })
  }, [guard, router, load])

  async function inviteSupervisor(firstName: string, lastName: string, email: string, storeIds: string[]) {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('ca-invite-supervisor', {
      body: { email, firstName, lastName, storeIds },
    })
    setBusy(false)
    if (error || !data?.success) {
      alert('Erreur : ' + (data?.error ?? error?.message ?? 'inconnue'))
      await load()
      return false
    }
    alert(`Invitation envoyée. ${data.email} reçoit un e-mail pour créer son mot de passe.`)
    await load()
    return true
  }

  async function setStores(member: Member, storeIds: string[]) {
    const { data, error } = await supabase.rpc('ca_set_supervisor_stores', {
      p_user: member.id, p_store_ids: storeIds,
    })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function removeMember(member: Member) {
    const who = member.full_name || member.email || 'cette personne'
    if (!confirm(`Retirer tous les accès de ${who} ?\n\nSon compte n'est pas supprimé, mais il n'aura plus accès à aucun magasin.`)) return
    const { data, error } = await supabase.rpc('ca_remove_supervisor', { p_user: member.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function cancelInvitation(inv: Invitation) {
    if (!confirm(`Annuler l'invitation de ${inv.first_name} ${inv.last_name} ?`)) return
    const { data, error } = await supabase.rpc('ca_cancel_invitation', { p_id: inv.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  if (guard.status !== 'ready' || !team) {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const storeById: Record<string, Store> = {}
  for (const s of team.stores) storeById[s.id] = s
  const supervisors = team.members.filter((m) => m.role === 'supervisor')
  const counters = team.members.filter((m) => m.role !== 'supervisor')

  return (
    <div className="admin">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard" className="btn btn-ghost">Inventaires</Link>
          <Link href="/account" className="btn btn-ghost">Mon compte</Link>
          <button className="btn btn-ghost" onClick={async () => { await signOut(); router.replace('/login') }}>Déconnexion</button>
        </div>
      </div>

      <span className="pill">Administrateur d&apos;entreprise</span>
      <h1 className="admin-title">Mon équipe</h1>

      {!mfaEnrolled && (
        <div className="banner banner-warn">
          Votre compte administre les accès de l&apos;entreprise&nbsp;: activez la double
          authentification depuis <Link href="/account" style={{ textDecoration: 'underline' }}>Mon compte</Link> pour
          le protéger.
        </div>
      )}

      <section className="admin-section">
        <h2>Superviseurs</h2>
        {supervisors.length === 0 ? (
          <p className="muted">Aucun superviseur pour l&apos;instant. Invitez-en un ci-dessous.</p>
        ) : (
          <div className="store-blocks">
            {supervisors.map((m) => (
              <div className="store-block" key={m.id}>
                <div className="store-block-head">
                  <div>
                    <span className="store-block-name">{m.full_name || 'Sans nom'}</span>
                    {m.is_company_admin && <span className="pill" style={{ marginLeft: 8 }}>Admin</span>}
                    <div className="muted small">{m.email}</div>
                  </div>
                  {!m.is_company_admin && (
                    <button className="link-btn danger-link" onClick={() => removeMember(m)}>Retirer les accès</button>
                  )}
                </div>
                <div className="store-sup">
                  {m.store_ids.length === 0 && <span className="muted small">Aucun magasin affecté</span>}
                  {m.store_ids.map((sid) => (
                    <span className="chip" key={sid}>
                      {storeById[sid]?.name || 'Magasin'}
                      <button
                        className="chip-x"
                        onClick={() => setStores(m, m.store_ids.filter((x) => x !== sid))}
                        aria-label="Retirer ce magasin"
                      >×</button>
                    </span>
                  ))}
                  {team.stores.some((s) => !m.store_ids.includes(s.id)) && (
                    <select
                      className="store-sup-select"
                      value=""
                      onChange={(e) => { if (e.target.value) setStores(m, [...m.store_ids, e.target.value]) }}
                    >
                      <option value="">+ Affecter un magasin</option>
                      {team.stores.filter((s) => !m.store_ids.includes(s.id)).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Inviter un superviseur</h2>
        <InviteForm stores={team.stores} busy={busy} onInvite={inviteSupervisor} />
      </section>

      {team.invitations.length > 0 && (
        <section className="admin-section">
          <h2>Invitations en cours</h2>
          <div className="req-list">
            {team.invitations.map((inv) => (
              <div className="req-row" key={inv.id}>
                <div>
                  <div className="req-name">
                    {inv.first_name} {inv.last_name}{' '}
                    <span className="pill">{inv.role === 'company_admin' ? 'Admin' : inv.role === 'supervisor' ? 'Superviseur' : 'Compteur'}</span>
                  </div>
                  <div className="muted small">
                    {inv.email}
                    {inv.store_ids.length > 0 && ' · ' + inv.store_ids.map((sid) => storeById[sid]?.name || 'Magasin').join(', ')}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => cancelInvitation(inv)}>Annuler</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {counters.length > 0 && (
        <section className="admin-section">
          <h2>Compteurs</h2>
          <p className="muted small" style={{ marginTop: -8, marginBottom: 14 }}>
            Les compteurs sont ajoutés au quotidien par leurs superviseurs&nbsp;— vous pouvez seulement retirer des accès ici.
          </p>
          <div className="req-list">
            {counters.map((m) => (
              <div className="req-row" key={m.id}>
                <div>
                  <div className="req-name">{m.full_name || 'Sans nom'}</div>
                  <div className="muted small">
                    {m.email}
                    {m.store_ids.length > 0 && ' · ' + m.store_ids.map((sid) => storeById[sid]?.name || 'Magasin').join(', ')}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => removeMember(m)}>Retirer les accès</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function InviteForm({
  stores, busy, onInvite,
}: {
  stores: Store[]
  busy: boolean
  onInvite: (firstName: string, lastName: string, email: string, storeIds: string[]) => Promise<boolean>
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return
    const ok = await onInvite(firstName.trim(), lastName.trim(), email.trim(), selected)
    if (ok) { setFirstName(''); setLastName(''); setEmail(''); setSelected([]) }
  }

  return (
    <form onSubmit={submit} className="panel" style={{ marginTop: 0 }}>
      <div className="inline-form" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" style={{ minWidth: 140 }} />
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" style={{ minWidth: 140 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" style={{ minWidth: 220 }} />
      </div>
      {stores.length > 0 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          {stores.map((s) => (
            <label key={s.id} className="chip" style={{ cursor: 'pointer', gap: 8 }}>
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={() => toggle(s.id)}
                style={{ accentColor: 'var(--accent)' }}
              />
              {s.name}
            </label>
          ))}
        </div>
      )}
      <button className="btn btn-primary" disabled={busy || !firstName.trim() || !lastName.trim() || !email.trim()}>
        Envoyer l&apos;invitation
      </button>
      <p className="muted small" style={{ marginTop: 10 }}>
        La personne reçoit un e-mail pour vérifier ses informations et choisir son mot de passe.
        Sans magasin coché, vous pourrez l&apos;affecter plus tard.
      </p>
    </form>
  )
}
