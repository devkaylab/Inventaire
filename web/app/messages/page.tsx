'use client'

// La boîte de réception (30 août 2026, second jet).
//
// Le premier jet empilait des cartes en lecture seule. Constat de Julien :
// « je ne peux rien faire avec ». Une boîte de réception, c'est une boîte
// mail : la liste des fils à gauche, la conversation à droite, et un champ
// pour répondre — c'est la réponse qui fait la différence.
//
// Conséquence : TOUT LE MONDE a une boîte, superviseur compris — il écrit à
// son administrateur, il doit lire la réponse. Le « il écrit sans recevoir »
// du premier jet est tombé avec le bouton Répondre.
//
// Ouvrir UN fil marque CE fil lu, pas les autres — et jamais les invitations
// à un inventaire, qui vivent dans la cloche.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany } from '@/lib/account'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { fmtDateTime, relativeTime } from '@/lib/format'

type Fil = {
  id: string
  sujet: string
  portee: 'entreprise' | 'quantinvo'
  entreprise: string | null
  avec: string
  dernier_le: string
  dernier_auteur: string
  dernier_extrait: string
  nb_messages: number
  non_lu: boolean
}
type MessageFil = {
  id: number
  auteur: string
  de_moi: boolean
  corps: string
  cree_le: string
}
type FilOuvert = {
  id: string
  sujet: string
  portee: 'entreprise' | 'quantinvo'
  entreprise: string | null
  messages: MessageFil[]
}

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}

export default function MessagesPage() {
  const toast = useToast()
  const guard = useAuthGuard('supervisor')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [fils, setFils] = useState<Fil[] | null>(null)
  const [ouvert, setOuvert] = useState<FilOuvert | null>(null)
  const [reponse, setReponse] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const chargerFils = useCallback(async () => {
    const { data } = await supabase.rpc('mes_fils')
    return (data ?? []) as Fil[]
  }, [])

  const ouvrirFil = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc('ouvrir_message_fil', { p_fil: id })
    if (error || !data) return
    setOuvert(data as FilOuvert)
    // Le fil vient d'être lu : la liste doit cesser de le signaler.
    setFils((prev) => prev?.map((f) => (f.id === id ? { ...f, non_lu: false } : f)) ?? prev)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then((c) => setCompanyName(c?.name ?? null)).catch(() => {})
    chargerFils().then((liste) => {
      setFils(liste)
      // La notification de la cloche mène à SON fil ; sinon on ouvre le
      // premier, comme une boîte mail.
      // `location.search` plutôt que `useSearchParams` : c'est la règle du
      // projet, elle évite la frontière Suspense que Next impose au prérendu
      // (le build échoue sinon).
      const demande = new URLSearchParams(window.location.search).get('fil')
      const cible = (demande && liste.some((f) => f.id === demande)) ? demande : liste[0]?.id
      if (cible) void ouvrirFil(cible)
    })
  }, [guard.status, chargerFils, ouvrirFil])

  async function repondre(e: React.FormEvent) {
    e.preventDefault()
    if (!ouvert || envoi || reponse.trim() === '') return
    setEnvoi(true)
    try {
      const { data, error } = await supabase.functions.invoke('message-admin', {
        body: { filId: ouvert.id, message: reponse },
      })
      let ok = !error && data?.success
      if (error && !data?.error) {
        // Edge injoignable : la réponse part quand même, sans e-mail.
        const direct = await supabase.rpc('repondre_fil', { p_fil: ouvert.id, p_message: reponse })
        ok = !direct.error && direct.data?.success
        if (direct.error) toast.error(friendlyError(direct.error))
      } else if (!ok) {
        toast.error(data?.error ?? 'Envoi impossible pour le moment.')
      }
      if (ok) {
        setReponse('')
        await ouvrirFil(ouvert.id)
        setFils(await chargerFils())
      }
    } finally {
      setEnvoi(false)
    }
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={companyName}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-sub">Vos conversations, la plus récente en premier.</p>
        </div>
      </div>

      {fils === null ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={4} height={72} /></div>
      ) : fils.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState
            title="Aucun message"
            hint={guard.profile.is_admin
              ? 'Les messages des entreprises clientes arrivent ici.'
              : guard.profile.is_company_admin
                ? 'Les messages de vos superviseurs arrivent ici — et vos échanges avec Quantinvo.'
                : 'Vos échanges avec l’administrateur de votre entreprise arrivent ici. Le bouton d’écriture est dans la barre de gauche.'}
          />
        </div>
      ) : (
        <div className="boite">
          <aside className="boite-liste" aria-label="Conversations">
            {fils.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`fil${ouvert?.id === f.id ? ' fil-actif' : ''}${f.non_lu ? ' fil-neuf' : ''}`}
                aria-current={ouvert?.id === f.id ? 'true' : undefined}
                onClick={() => void ouvrirFil(f.id)}
              >
                <div className="fil-haut">
                  <span className="fil-avec">{f.avec}</span>
                  <span className="fil-date">{relativeTime(f.dernier_le)}</span>
                </div>
                <div className="fil-sujet">
                  {f.non_lu && <span className="fil-point" aria-label="non lu" />}
                  {f.sujet}
                </div>
                <div className="fil-extrait">
                  {f.dernier_auteur} : {f.dernier_extrait}
                </div>
              </button>
            ))}
          </aside>

          <section className="boite-fil" aria-label="Conversation">
            {!ouvert ? (
              <p className="tb-vide">Choisissez une conversation.</p>
            ) : (
              <>
                <header className="fil-tete">
                  <h2>{ouvert.sujet}</h2>
                  <p className="fil-tete-sous">
                    {fils.find((f) => f.id === ouvert.id)?.avec}
                    {ouvert.entreprise && guard.profile.is_admin && ` · ${ouvert.entreprise}`}
                    {' · '}
                    {ouvert.messages.length} message{ouvert.messages.length > 1 ? 's' : ''}
                  </p>
                </header>

                <div className="fil-messages">
                  {ouvert.messages.map((m) => (
                    <article className={`bulle${m.de_moi ? ' bulle-moi' : ''}`} key={m.id}>
                      <div className="bulle-tete">
                        <span className="bulle-avatar">{initiales(m.auteur)}</span>
                        <span className="bulle-auteur">{m.de_moi ? 'Vous' : m.auteur}</span>
                        <span className="bulle-date" title={fmtDateTime(m.cree_le)}>
                          {relativeTime(m.cree_le)}
                        </span>
                      </div>
                      {/* pre-line : un message est un texte, ses retours à la
                          ligne comptent. */}
                      <p className="bulle-corps">{m.corps}</p>
                    </article>
                  ))}
                </div>

                <form className="fil-repondre" onSubmit={repondre}>
                  <label htmlFor="fil-reponse" className="sr-only">Votre réponse</label>
                  <textarea
                    id="fil-reponse" rows={3} maxLength={2000}
                    value={reponse} onChange={(e) => setReponse(e.target.value)}
                    placeholder="Répondre…"
                  />
                  <button type="submit" className="btn btn-primary" disabled={envoi || reponse.trim() === ''}>
                    {envoi ? 'Envoi…' : 'Répondre'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
