'use client'

// Mon équipe — les personnes, selon ce qu'on a le droit d'en faire.
//
// Un superviseur y gère ses compteurs, rangés par magasin comme le sont ses
// inventaires. Un administrateur d'entreprise voit en plus ses superviseurs :
// invitation (l'e-mail part par l'edge function ca-invite-supervisor),
// affectation aux magasins, retrait des accès, annulation d'invitation.
//
// Même écran, contenu selon le rôle — c'est ce qui évite deux pages qui se
// ressemblent. Chaque écriture passe par une RPC SECURITY DEFINER gardée
// côté base ; la garde client n'est que du confort.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { AddCounter } from '@/components/dashboard/AddCounter'
import { getMyCompany, type Company } from '@/lib/account'

type Store = { id: string; name: string }
type Member = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_company_admin: boolean
  email: string | null
  is_active: boolean
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
type TeamCA = { stores: Store[]; members: Member[]; invitations: Invitation[] }

type Counter = {
  id: string; full_name: string | null; email: string | null
  is_active: boolean; sessions_counted: number
}
type StoreTeam = { id: string; name: string; counters: Counter[] }
type TeamSup = { stores: StoreTeam[]; invitations: Invitation[] }

/** Pastille « le compte existe mais n'a pas encore servi ». */
function BadgeEnAttente() {
  return (
    <span className="dash-badge dash-badge-counting" style={{ marginLeft: 8 }}>
      <span className="dash-dot" />Mot de passe à créer
    </span>
  )
}

export default function EquipePage() {
  const guard = useAuthGuard('supervisor')
  const [company, setCompany] = useState<Company | null>(null)
  const [ca, setCa] = useState<TeamCA | null>(null)
  const [sup, setSup] = useState<TeamSup | null>(null)
  const [mfaEnrolled, setMfaEnrolled] = useState(true)
  const [busy, setBusy] = useState(false)

  const estAdmin = guard.status === 'ready' && !!guard.profile.is_company_admin

  const charger = useCallback(async (admin: boolean) => {
    const [c, s] = await Promise.all([
      getMyCompany().catch(() => null),
      supabase.rpc('my_team_by_store'),
    ])
    setCompany(c)
    if (!s.error && s.data) setSup(s.data as TeamSup)
    if (admin) {
      const { data, error } = await supabase.rpc('ca_list_team')
      if (!error && data) setCa(data as TeamCA)
    }
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger(!!guard.profile.is_company_admin)
    if (guard.profile.is_company_admin) {
      supabase.auth.mfa.listFactors().then(({ data }) => {
        setMfaEnrolled((data?.totp ?? []).some((f) => f.status === 'verified'))
      })
    }
  }, [guard, charger])

  async function rafraichir() { await charger(estAdmin) }

  async function inviterSuperviseur(firstName: string, lastName: string, email: string, storeIds: string[]) {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('ca-invite-supervisor', {
      body: { email, firstName, lastName, storeIds },
    })
    setBusy(false)
    if (error || !data?.success) {
      alert('Erreur : ' + (data?.error ?? error?.message ?? 'inconnue'))
      await rafraichir()
      return false
    }
    alert(`Invitation envoyée. ${data.email} reçoit un e-mail pour créer son mot de passe.`)
    await rafraichir()
    return true
  }

  async function appliquer(fn: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(fn, args)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return
    }
    rafraichir()
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const storeById: Record<string, Store> = {}
  for (const s of ca?.stores ?? []) storeById[s.id] = s
  const superviseurs = (ca?.members ?? []).filter((m) => m.role === 'supervisor')

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">Mon équipe</h1>
        <AddCounter onAdded={rafraichir} />
      </div>

      {estAdmin && !mfaEnrolled && (
        <div className="banner banner-warn">
          Votre compte administre les accès de l&apos;entreprise&nbsp;: activez la double
          authentification depuis <Link href="/account" style={{ textDecoration: 'underline' }}>Mon compte</Link>.
        </div>
      )}

      {/* ── Superviseurs : administrateur d'entreprise seulement ── */}
      {estAdmin && (
        <>
          <div className="dash-sub">Superviseurs</div>
          {superviseurs.length === 0 ? (
            <p className="muted">Aucun superviseur pour l&apos;instant.</p>
          ) : (
            <div className="store-blocks">
              {superviseurs.map((m) => (
                <div className="store-block" key={m.id}>
                  <div className="store-block-head">
                    <div>
                      <span className="store-block-name">{m.full_name || 'Sans nom'}</span>
                      {m.is_company_admin && <span className="pill" style={{ marginLeft: 8 }}>Admin</span>}
                      {!m.is_active && <BadgeEnAttente />}
                      <div className="muted small">{m.email}</div>
                    </div>
                    {!m.is_company_admin && (
                      <button
                        className="link-btn danger-link"
                        onClick={() => {
                          if (!confirm(`Retirer tous les accès de ${m.full_name || 'cette personne'} ?\n\nSon compte n'est pas supprimé, mais il n'aura plus accès à aucun magasin.`)) return
                          appliquer('ca_remove_supervisor', { p_user: m.id })
                        }}
                      >Retirer les accès</button>
                    )}
                  </div>
                  <div className="store-sup">
                    {m.store_ids.length === 0 && <span className="muted small">Aucun magasin affecté</span>}
                    {m.store_ids.map((sid) => (
                      <span className="chip" key={sid}>
                        {storeById[sid]?.name || 'Magasin'}
                        <button
                          className="chip-x"
                          aria-label="Retirer ce magasin"
                          onClick={() => appliquer('ca_set_supervisor_stores', {
                            p_user: m.id, p_store_ids: m.store_ids.filter((x) => x !== sid),
                          })}
                        >×</button>
                      </span>
                    ))}
                    {(ca?.stores ?? []).some((s) => !m.store_ids.includes(s.id)) && (
                      <select
                        className="store-sup-select"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return
                          appliquer('ca_set_supervisor_stores', {
                            p_user: m.id, p_store_ids: [...m.store_ids, e.target.value],
                          })
                        }}
                      >
                        <option value="">+ Affecter un magasin</option>
                        {(ca?.stores ?? []).filter((s) => !m.store_ids.includes(s.id)).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="dash-sub">Inviter un superviseur</div>
          <InviteForm stores={ca?.stores ?? []} busy={busy} onInvite={inviterSuperviseur} />
        </>
      )}

      {/* ── Compteurs, rangés par magasin ── */}
      {(sup?.stores ?? []).length === 0 ? (
        <>
          <div className="dash-sub">Compteurs</div>
          <p className="muted">Vous n&apos;êtes affecté à aucun magasin.</p>
        </>
      ) : (
        (sup?.stores ?? []).map((s) => (
          <div key={s.id}>
            <div className="dash-sub">Compteurs · {s.name}</div>
            {s.counters.length === 0 ? (
              <p className="muted small">Aucun compteur sur ce magasin.</p>
            ) : (
              <div className="req-list">
                {s.counters.map((c) => (
                  <div className="req-row" key={c.id}>
                    <div>
                      <div className="req-name">
                        {c.full_name || 'Sans nom'}
                        {!c.is_active && <BadgeEnAttente />}
                      </div>
                      <div className="muted small">
                        {c.email}
                        {c.sessions_counted > 0
                          ? ` · a compté ${c.sessions_counted} inventaire${c.sessions_counted > 1 ? 's' : ''}`
                          : ' · pas encore de comptage'}
                      </div>
                    </div>
                    {estAdmin && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          if (!confirm(`Retirer tous les accès de ${c.full_name || 'cette personne'} ?`)) return
                          appliquer('ca_remove_supervisor', { p_user: c.id })
                        }}
                      >Retirer</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {/* ── Invitations en cours ── */}
      {((estAdmin ? ca?.invitations : sup?.invitations) ?? []).length > 0 && (
        <>
          <div className="dash-sub">Invitations en cours</div>
          <div className="req-list">
            {((estAdmin ? ca?.invitations : sup?.invitations) ?? []).map((i) => (
              <div className="req-row" key={i.id}>
                <div>
                  <div className="req-name">
                    {i.first_name} {i.last_name}{' '}
                    <span className="pill">
                      {i.role === 'company_admin' ? 'Admin' : i.role === 'supervisor' ? 'Superviseur' : 'Compteur'}
                    </span>
                  </div>
                  <div className="muted small">{i.email}</div>
                </div>
                {estAdmin && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (!confirm(`Annuler l'invitation de ${i.first_name} ${i.last_name} ?`)) return
                      appliquer('ca_cancel_invitation', { p_id: i.id })
                    }}
                  >Annuler</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
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
