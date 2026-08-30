'use client'

// « Écrire à l'administrateur » (30 août 2026) — le ticket de la maquette.
//
// Le bouton n'apparaît PAS pour l'administrateur d'entreprise : le message
// lui serait adressé à lui-même, et un bouton qui refuse est pire que pas de
// bouton. Le dépôt passe par la fonction edge `message-admin` (notification
// aux administrateurs + e-mail avec reply_to vers l'expéditeur) et retombe
// sur la RPC directe si l'edge est injoignable — le message passe alors sans
// e-mail, plutôt que de ne pas passer du tout. Un refus reste SOUS le
// formulaire le temps qu'on corrige, jamais dans une notification qui
// s'efface.

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/Toast'

export function MessageAdmin() {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const [sujet, setSujet] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  function fermer() {
    setOuvert(false)
    setErreur(null)
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    if (envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      const { data, error } = await supabase.functions.invoke('message-admin', {
        body: { sujet, message },
      })
      let succes = !error && data?.success
      let refus: string | null = !succes ? (data?.error ?? null) : null
      if (error && !refus) {
        // Edge injoignable : la RPC directe dépose quand même (sans e-mail).
        const direct = await supabase.rpc('deposer_message_admin', { p_sujet: sujet, p_message: message })
        succes = !direct.error && direct.data?.success
        refus = direct.error?.message ?? null
      }
      if (succes) {
        toast.success('Message envoyé à l’administrateur de votre entreprise.')
        setSujet('')
        setMessage('')
        fermer()
      } else {
        setErreur(refus ?? 'Envoi impossible pour le moment.')
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost tb-rond"
        title="Écrire à l’administrateur de votre entreprise"
        aria-label="Écrire à l’administrateur de votre entreprise"
        onClick={() => setOuvert(true)}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.9-.9L3 20l1.2-4.3A8 8 0 0 1 3.5 11.5a8.38 8.38 0 0 1 8.5-8.3 8.38 8.38 0 0 1 9 8.3z" />
        </svg>
      </button>

      {ouvert && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) fermer() }}>
          <form className="modal" role="dialog" aria-modal="true" aria-labelledby="message-admin-titre" onSubmit={envoyer}>
            <div className="modal-head">
              <h2 className="modal-title" id="message-admin-titre">Écrire à l’administrateur</h2>
              <button type="button" className="modal-x" aria-label="Fermer" onClick={fermer}>×</button>
            </div>
            <p className="modal-message">
              Votre message est remis à l’administrateur de votre entreprise, dans ses
              notifications et par e-mail. Il pourra vous répondre directement.
            </p>
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="message-admin-sujet">Sujet</label>
              <input
                id="message-admin-sujet" type="text" maxLength={120} required
                value={sujet} onChange={(e) => setSujet(e.target.value)}
                placeholder="Balises, accès, magasin…"
              />
            </div>
            <div className="field">
              <label htmlFor="message-admin-corps">Message</label>
              <textarea
                id="message-admin-corps" rows={5} maxLength={2000} required
                value={message} onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {erreur && <div className="error">{erreur}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={fermer}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={envoi}>
                {envoi ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
