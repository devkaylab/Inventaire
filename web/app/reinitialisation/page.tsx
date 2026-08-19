'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { getMySpacePath } from '@/lib/auth'

/**
 * Choix d'un nouveau mot de passe, à l'arrivée du lien « mot de passe oublié ».
 *
 * Le client Supabase consomme le jeton de récupération présent dans l'URL et
 * ouvre une session — même mécanique que /bienvenue pour les invitations, sans
 * la vérification du prénom et du nom : ici la personne a déjà un compte
 * complet, seul le mot de passe change.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    const apply = (hasOne: boolean) => {
      if (!active) return
      if (hasOne) setHasSession(true)
      setReady(true)
    }
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { apply(true); return }
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) apply(true) })
      // Sans jeton exploitable, on n'attend pas indéfiniment.
      setTimeout(() => { if (active) setReady(true) }, 2500)
      return () => sub.subscription.unsubscribe()
    })()
    return () => { active = false }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // Même seuil que /bienvenue : 12 caractères, le repère CNIL pour un mot de
    // passe seul, sans second facteur.
    if (password.length < 12) {
      setError('Le mot de passe doit comporter au moins 12 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    const { error: authError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (authError) {
      setError(authError.message ?? 'Enregistrement impossible.')
      return
    }
    setDone(true)
  }

  async function goToSpace() {
    const path = await getMySpacePath()
    router.replace(path ?? '/login')
  }

  if (!ready) {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  if (!hasSession) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>Lien expiré</h1>
            <p className="sub">
              Ce lien de réinitialisation n&apos;est plus valable ou a déjà été utilisé.
              Demandez-en un nouveau depuis la page « Mot de passe oublié ».
            </p>
          </div>
          <Link href="/mot-de-passe-oublie" className="btn btn-primary btn-block">
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>Mot de passe modifié</h1>
            <p className="sub">
              Votre nouveau mot de passe est enregistré : c&apos;est lui qu&apos;il faudra
              utiliser à la prochaine connexion.
            </p>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => void goToSpace()}>
            Accéder à mon espace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Nouveau mot de passe</h1>
          <p className="sub">Choisissez le mot de passe de votre compte.</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password">Nouveau mot de passe</label>
            <input
              id="password" type="password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="12 caractères minimum"
            />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirmer le mot de passe</label>
            <input
              id="confirm" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}
