'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'

/**
 * Demande de réinitialisation du mot de passe.
 *
 * La réponse est **la même que l'adresse ait un compte ou non** : dire « aucun
 * compte pour cette adresse » ferait de ce formulaire un oracle d'énumération
 * d'e-mails — exactement ce que le correctif M3 a fermé sur les formulaires
 * publics. Côté serveur, Supabase n'envoie l'e-mail qu'aux comptes existants
 * et applique sa propre limitation de débit.
 *
 * Le lien reçu mène à /reinitialisation (à déclarer dans les Redirect URLs de
 * la console Supabase — voir AGENTS.md).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  // Même identifiant mémorisé que la page de connexion.
  useEffect(() => {
    const saved = window.localStorage.getItem('quantinvo-identifiant')
    if (saved) setEmail(saved)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Indiquez votre adresse e-mail.')
      return
    }
    setBusy(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reinitialisation`,
    })
    setBusy(false)
    if (resetError) {
      // Un échec ici est un problème d'envoi (réseau, limitation de débit),
      // jamais une information sur l'existence du compte.
      setError("L'e-mail n'a pas pu être envoyé pour le moment. Réessayez dans quelques instants.")
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>E-mail envoyé</h1>
            <p className="sub">
              Si un compte existe pour <strong>{email.trim()}</strong>, un e-mail de
              réinitialisation vient de lui être envoyé. Ouvrez le lien qu&apos;il contient
              pour choisir un nouveau mot de passe. Pensez à vérifier vos indésirables.
            </p>
          </div>
          <Link href="/login" className="btn btn-primary btn-block">Retour à la connexion</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Mot de passe oublié</h1>
          <p className="sub">
            Indiquez l&apos;adresse e-mail de votre compte : vous recevrez un lien pour
            choisir un nouveau mot de passe.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Envoi…' : 'Envoyer le lien'}
          </button>
          <MentionCollecte finalite="vous envoyer le lien de réinitialisation de votre mot de passe" />
        </form>

        <div className="center-link">
          <Link href="/login">← Retour à la connexion</Link>
        </div>
      </div>
    </div>
  )
}
