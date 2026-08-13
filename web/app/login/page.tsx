'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { getMySpacePath, homePathForRole } from '@/lib/auth'

/**
 * Un échec réseau et un mauvais mot de passe ne doivent pas dire la même chose.
 * Une coupure réseau échoue sur le `fetch`, et un message unique « e-mail ou mot
 * de passe incorrect » envoie alors chercher du côté du compte, qui n'y est pour
 * rien — c'est exactement ce qui s'est produit sur une preview déployée sans
 * configuration Supabase (voir le repli dans `lib/supabaseClient.ts`).
 */
function isNetworkFailure(e: unknown): boolean {
  const err = e as { name?: string; status?: number; message?: string } | null
  if (!err) return false
  if (err.name === 'AuthRetryableFetchError') return true
  if (err.status === 0 || err.status === undefined) {
    return /fetch|network|timeout/i.test(err.message ?? '')
  }
  return false
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Déjà connecté : rediriger vers l'espace au lieu de redemander le mot de passe.
  useEffect(() => {
    getMySpacePath().then((path) => { if (path) router.replace(path) })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error || !data.user) {
      setLoading(false)
      setError(
        isNetworkFailure(error)
          ? 'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.'
          : 'E-mail ou mot de passe incorrect.',
      )
      return
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', data.user.id)
      .maybeSingle()
    setLoading(false)
    router.replace(homePathForRole(prof as { role: string | null; is_admin: boolean | null } | null))
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Connexion</h1>
          <p className="sub">Accédez à votre espace Quantinvo.</p>
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
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="center-link">
          <Link href="/superviseur">Demander un accès superviseur</Link>
        </div>
        <div className="center-link" style={{ marginTop: 8 }}>
          <Link href="/inscription">Inscrire mon entreprise</Link>
        </div>
        <div className="center-link" style={{ marginTop: 8 }}>
          <Link href="/">← Retour à l&apos;accueil</Link>
        </div>
      </div>
    </div>
  )
}
