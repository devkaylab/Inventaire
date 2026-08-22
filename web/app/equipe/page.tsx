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
import { useConfirm } from '@/components/ui/ConfirmDialog'
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
  last_count_at: string | null
  sessions_counted: number
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
  is_active: boolean; sessions_counted: number; last_count_at: string | null
}
type StoreTeam = { id: string; name: string; counters: Counter[] }
type TeamSup = { stores: StoreTeam[]; invitations: Invitation[] }

/** Date courte, comme sur la maquette : « 14/08 ». */
function jourCourt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

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
  const confirm = useConfirm()
  const [company, setCompany] = useState<Company | null>(null)
  const [ca, setCa] = useState<TeamCA | null>(null)
  const [sup, setSup] = useState<TeamSup | null>(null)
  const [mfaEnrolled, setMfaEnrolled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filtre, setFiltre] = useState('')
  const [magasinFiltre, setMagasinFiltre] = useState('')

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

  /**
   * Supprimer un compte de l'entreprise — administrateur d'entreprise seulement.
   *
   * « Retirer les accès » et « Supprimer le compte » sont voisins à l'écran et
   * n'ont rien de commun : le premier laisse le compte en vie, le second
   * l'efface. D'où la recopie du nom — un clic de travers ne doit pas suffire.
   *
   * Ce qui est dit dans la confirmation est ce que fait vraiment `ca_delete_user` :
   * les comptages sont conservés mais détachés, donc le rapport d'un inventaire
   * passé ne dira plus qui a compté ces lignes.
   */
  async function supprimerCompte(p: { id: string; full_name: string | null; email: string | null }) {
    const nom = (p.full_name ?? '').trim()
    const ok = await confirm({
      title: 'Supprimer définitivement ce compte ?',
      message: 'Cette suppression est définitive.',
      details: [
        `${nom || 'Sans nom'} — ${p.email ?? 'adresse inconnue'}`,
        'La personne perd l’accès à Quantinvo immédiatement.',
        'Ses comptages restent, mais son nom disparaît des rapports déjà faits.',
        'Ses invitations en cours sont annulées.',
      ],
      confirmLabel: 'Supprimer définitivement',
      tone: 'danger',
      requireText: nom || p.email || 'SUPPRIMER',
    })
    if (!ok) return
    appliquer('ca_delete_user', { p_user: p.id })
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const storeById: Record<string, Store> = {}
  for (const s of ca?.stores ?? []) storeById[s.id] = s
  const superviseurs = (ca?.members ?? []).filter((m) => m.role === 'supervisor')
  // Les compteurs de l'entreprise que la liste par magasin ne montre pas :
  // l'administrateur ne supervise pas forcément les magasins où ils comptent,
  // et son droit de suppression, lui, porte sur toute l'entreprise.
  // Pour l'administrateur, l'équipe se lit **personne par personne** : il doit
  // pouvoir répondre à « où travaille Sofia, et quand a-t-elle compté pour la
  // dernière fois ? ». Un rangement par magasin ne répond jamais à ça, et il
  // laissait hors de vue les compteurs des magasins qu'il ne supervise pas.
  const compteurs = estAdmin
    ? (ca?.members ?? []).filter((m) => m.role !== 'supervisor')
    : []
  const recherche = filtre.trim().toLowerCase()
  const compteursFiltres = compteurs.filter((m) => {
    if (magasinFiltre && !m.store_ids.includes(magasinFiltre)) return false
    if (!recherche) return true
    return (m.full_name ?? '').toLowerCase().includes(recherche)
      || (m.email ?? '').toLowerCase().includes(recherche)
  })

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">Mon équipe</h1>
        <AddCounter onAdded={rafraichir} />
      </div>

      {estAdmin && !mfaEnrolled && (
        <div className="banner banner-warn">
          Vous gérez les accès de l&apos;entreprise&nbsp;: protégez votre compte avec la double
          authentification, depuis <Link href="/account" style={{ textDecoration: 'underline' }}>Mon compte</Link>.
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
                    {/* Sa propre ligne et celle d'un autre administrateur n'ont
                        aucune action : ces comptes-là restent chez Quantinvo. */}
                    {!m.is_company_admin && (
                      <div className="req-actions">
                        <button
                          className="link-btn"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Retirer tous les accès ?',
                              message: `${m.full_name || 'Cette personne'} garde son compte, mais n’aura plus accès à aucun magasin.`,
                              confirmLabel: 'Retirer les accès',
                            })
                            if (ok) appliquer('ca_remove_supervisor', { p_user: m.id })
                          }}
                        >Retirer les accès</button>
                        <span className="action-sep" />
                        <button className="link-btn danger-link" onClick={() => supprimerCompte(m)}>
                          Supprimer le compte
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Un administrateur d'entreprise a tous les magasins, par
                      construction (déclencheurs de la migration 20260822150001).
                      Ses affectations ne se modifient donc pas : une croix qui
                      ne marche pas est pire que pas de croix. */}
                  <div className="store-sup">
                    {m.is_company_admin ? (
                      <span className="muted small">
                        Tous les magasins de l&apos;entreprise
                        {m.store_ids.length > 0 && ` (${m.store_ids.length})`}
                      </span>
                    ) : (
                      <>
                        {m.store_ids.length === 0 && <span className="muted small">Aucun magasin</span>}
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
                      </>
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

      {/* ── Compteurs ──
          L'administrateur les lit personne par personne (il les a tous) ;
          un superviseur les lit magasin par magasin, parce que c'est ainsi
          qu'il travaille : un saisonnier part d'un magasin, pas de tous.
          Le bloc « autres magasins » du matin n'a plus d'objet — cette liste
          couvre toute l'entreprise. ── */}
      {estAdmin ? (
        <>
          <div className="dash-sub">Compteurs ({compteurs.length})</div>
          {compteurs.length === 0 ? (
            <p className="muted">Aucun compteur dans votre entreprise.</p>
          ) : (
            <>
              <div className="toolbar" style={{ marginTop: 0, marginBottom: 12 }}>
                <div className="toolbar-grow">
                  <input
                    type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)}
                    placeholder="Rechercher une personne…"
                    aria-label="Rechercher une personne"
                  />
                </div>
                <select
                  className="store-sup-select"
                  value={magasinFiltre}
                  onChange={(e) => setMagasinFiltre(e.target.value)}
                  aria-label="Filtrer par magasin"
                >
                  <option value="">Tous les magasins</option>
                  {(ca?.stores ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {compteursFiltres.length === 0 ? (
                <p className="muted small">Personne ne correspond à cette recherche.</p>
              ) : (
                <div className="req-list">
                  {compteursFiltres.map((m) => (
                    <div className="req-row req-row-block" key={m.id}>
                      <div>
                        <div className="req-name">
                          {m.full_name || 'Sans nom'}
                          {!m.is_active && <BadgeEnAttente />}
                        </div>
                        <div className="muted small">
                          {m.email}
                          {m.sessions_counted > 0
                            ? ` · a compté ${m.sessions_counted} inventaire${m.sessions_counted > 1 ? 's' : ''}`
                            : ' · pas encore de comptage'}
                          {m.last_count_at && ` · dernier le ${jourCourt(m.last_count_at)}`}
                        </div>
                        <div className="store-sup" style={{ marginTop: 6 }}>
                          {m.store_ids.length === 0 && <span className="muted small">Aucun magasin</span>}
                          {m.store_ids.map((sid) => (
                            <span className="chip" key={sid}>
                              {storeById[sid]?.name || 'Magasin'}
                              <button
                                className="chip-x"
                                aria-label={`Retirer du magasin ${storeById[sid]?.name || ''}`}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Retirer du magasin ${storeById[sid]?.name || ''} ?`,
                                    message: `${m.full_name || 'Cette personne'} garde son compte : elle n’aura plus accès aux inventaires de ce magasin.`,
                                    confirmLabel: 'Retirer du magasin',
                                  })
                                  if (ok) appliquer('remove_counter_from_store', { p_user: m.id, p_store_id: sid })
                                }}
                              >×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="req-actions">
                        <button className="link-btn danger-link" onClick={() => supprimerCompte(m)}>
                          Supprimer le compte
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (sup?.stores ?? []).length === 0 ? (
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
                        {c.last_count_at && ` · dernier le ${jourCourt(c.last_count_at)}`}
                      </div>
                    </div>
                    <div className="req-actions">
                      {/* Le geste quotidien du superviseur : un saisonnier part,
                          il le retire de SON magasin — pas de partout. */}
                      <button
                        className="link-btn"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Retirer du magasin ${s.name} ?`,
                            message: `${c.full_name || 'Cette personne'} garde son compte : elle n’aura plus accès aux inventaires de ce magasin.`,
                            confirmLabel: 'Retirer du magasin',
                          })
                          if (ok) appliquer('remove_counter_from_store', { p_user: c.id, p_store_id: s.id })
                        }}
                      >Retirer du magasin</button>
                    </div>
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
                {/* L'administrateur annule toute invitation de son entreprise ;
                    un superviseur annule celles qu'il a envoyées — une adresse
                    mal tapée doit pouvoir se rattraper. */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Annuler cette invitation ?',
                      message: `${i.first_name} ${i.last_name} ne recevra pas d’accès. Vous pourrez l’inviter à nouveau.`,
                      confirmLabel: 'Annuler l’invitation',
                      cancelLabel: 'Revenir',
                    })
                    if (ok) appliquer(estAdmin ? 'ca_cancel_invitation' : 'cancel_my_invitation', { p_id: i.id })
                  }}
                >Annuler</button>
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
        Vous pourrez lui donner un magasin plus tard.
      </p>
    </form>
  )
}
