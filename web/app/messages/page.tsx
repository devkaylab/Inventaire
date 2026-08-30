'use client'

// La boîte de réception (30 août 2026).
//
// Constat de Julien au premier message réel : la cloche annonce et tronque —
// « je ne peux pas l'ouvrir car je n'ai pas de boîte de réception ». Voici
// l'écran qui manquait : les messages reçus, en entier, du plus récent au
// plus ancien.
//
// Réservé à qui en reçoit : l'administrateur d'entreprise (ses superviseurs
// lui écrivent) et l'administrateur Quantinvo (les entreprises clientes lui
// écrivent). Un superviseur ordinaire n'a pas de boîte — il écrit, il ne
// reçoit pas ; la garde le renvoie chez lui plutôt que de lui montrer un
// écran vide à jamais.
//
// Ouvrir la page marque les messages lus — et EUX SEULS : une invitation à
// un inventaire garde son point tant que la cloche ne l'a pas montrée.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany } from '@/lib/account'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { fmtDateTime, relativeTime } from '@/lib/format'

type Message = {
  id: number
  type: 'message_superviseur' | 'message_entreprise'
  donnees: Record<string, string | undefined>
  created_at: string
  lu: boolean
}

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}

export default function MessagesPage() {
  const guard = useAuthGuard('supervisor')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[] | null>(null)

  const recoitDesMessages = guard.status === 'ready'
    && (!!guard.profile.is_company_admin || !!guard.profile.is_admin)

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc('mes_messages')
    setMessages((data ?? []) as Message[])
    // Les lire, c'est les avoir lus — et ça ne touche qu'eux.
    await supabase.rpc('marquer_messages_lus')
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    if (!recoitDesMessages) { window.location.replace('/dashboard'); return }
    getMyCompany().then((c) => setCompanyName(c?.name ?? null)).catch(() => {})
    charger()
  }, [guard.status, recoitDesMessages, charger])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const deQui = guard.profile.is_admin ? 'des entreprises clientes' : 'de vos superviseurs'

  return (
    <AppShell profile={guard.profile} companyName={companyName}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-sub">Ce que vous recevez {deQui}, en entier.</p>
        </div>
      </div>

      {messages === null ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={3} height={96} /></div>
      ) : messages.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState
            title="Aucun message"
            hint={`Les messages ${deQui} arrivent ici, et vous préviennent par e-mail.`}
          />
        </div>
      ) : (
        <div className="msg-liste">
          {messages.map((m) => {
            const d = m.donnees
            const auteur = d.de || (m.type === 'message_entreprise' ? 'Une entreprise' : 'Un superviseur')
            return (
              <article className={`panel msg${m.lu ? '' : ' msg-neuf'}`} key={m.id}>
                <header className="msg-tete">
                  <span className="msg-avatar">{initiales(auteur)}</span>
                  <div className="msg-qui">
                    <div className="msg-de">
                      {auteur}
                      {d.entreprise && <span className="msg-cie"> — {d.entreprise}</span>}
                    </div>
                    <div className="msg-date" title={fmtDateTime(m.created_at)}>
                      {relativeTime(m.created_at)}
                    </div>
                  </div>
                </header>
                <h2 className="msg-sujet">{d.sujet}</h2>
                {/* pre-line : les retours à la ligne de l'expéditeur comptent
                    — un message est un texte, pas une étiquette. */}
                <p className="msg-corps">{d.message}</p>
              </article>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
