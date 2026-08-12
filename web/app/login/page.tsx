'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase, supabaseConfigured } from '@/lib/supabaseClient'
import { getMySpacePath, homePathForRole } from '@/lib/auth'

/**
 * Un échec réseau et un mauvais mot de passe ne doivent pas dire la même chose.
 * Quand les variables d'environnement Supabase manquent (cas vu sur une preview
 * Vercel dont la portée « Preview » n'était pas cochée), le client tape sur une
 * URL de repli qui n'existe pas : `signInWithPassword` échoue sur le `fetch`, et
 * un message unique « e-mail ou mot de passe incorrect » envoie chercher pendant
 * des heures du côté du compte, qui n'y est pour rien.
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

        {!supabaseConfigured && (
          <div className="error">
            Ce site n&apos;est pas relié à sa base de données : la connexion ne peut pas
            fonctionner ici. Ce n&apos;est pas votre mot de passe. Si vous êtes sur une
            adresse de test, ses variables d&apos;environnement Supabase ne sont pas
            renseignées.
          </div>
        )}

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
          <button type="submit" className="btn btn-primary btn-block" disabled={loading || !supabaseConfigured}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <div className="center-link">
          <Link href="/">← Retour à l&apos;accueil</Link>
        </div>
      </div>
    </div>
  )
}
