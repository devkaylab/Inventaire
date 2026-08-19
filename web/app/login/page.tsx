'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { getMySpacePath, homePathForRole } from '@/lib/auth'
import { challengeAndVerify, mfaPending, verifiedTotpFactor } from '@/lib/mfa'

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

/**
 * Seul l'identifiant est mémorisé, jamais la session : le jeton vit en
 * `sessionStorage` (voir `lib/supabaseClient.ts`), fermer le navigateur
 * déconnecte. La case ci-dessous ne fait que pré-remplir l'e-mail.
 */
const REMEMBER_KEY = 'quantinvo-identifiant'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Double authentification : identifiant du facteur à vérifier, ou null tant
  // que le mot de passe n'a pas été accepté (ou que le compte n'en a pas).
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')

  // Déjà connecté : rediriger vers l'espace au lieu de redemander le mot de
  // passe — sauf si la session attend encore son code de double
  // authentification, auquel cas c'est justement l'étape à afficher.
  useEffect(() => {
    ;(async () => {
      if (await mfaPending()) {
        const factorId = await verifiedTotpFactor()
        if (factorId) { setMfaFactorId(factorId); return }
      }
      const path = await getMySpacePath()
      if (path) router.replace(path)
    })()
  }, [router])

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBER_KEY)
    if (saved) { setEmail(saved); setRemember(true) }
  }, [])

  async function goToSpace(userId: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .maybeSingle()
    router.replace(homePathForRole(prof as { role: string | null; is_admin: boolean | null } | null))
  }

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
    if (remember) window.localStorage.setItem(REMEMBER_KEY, email.trim())
    else window.localStorage.removeItem(REMEMBER_KEY)

    // Compte avec double authentification : le mot de passe ne suffit pas,
    // place à la saisie du code.
    const factorId = await verifiedTotpFactor()
    if (factorId) {
      setLoading(false)
      setPassword('')
      setMfaFactorId(factorId)
      return
    }

    await goToSpace(data.user.id)
    setLoading(false)
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaFactorId) return
    setError(null)
    setLoading(true)
    const r = await challengeAndVerify(mfaFactorId, code)
    if (!r.success) {
      setLoading(false)
      setError('Code incorrect ou expiré. Vérifiez le code affiché par votre application.')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session) await goToSpace(session.user.id)
    setLoading(false)
  }

  async function cancelMfa() {
    // La session au mot de passe seul ne doit pas traîner : on la ferme.
    await supabase.auth.signOut()
    setMfaFactorId(null)
    setCode('')
    setError(null)
  }

  if (mfaFactorId) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>Double authentification</h1>
            <p className="sub">Saisissez le code affiché par votre application d&apos;authentification.</p>
          </div>

          {error && <div className="error">{error}</div>}

          <form onSubmit={handleCodeSubmit}>
            <div className="field">
              <label htmlFor="totp-code">Code de vérification</label>
              <input
                id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || code.trim().length < 6}>
              {loading ? 'Vérification…' : 'Vérifier'}
            </button>
          </form>

          <div className="center-link">
            <button type="button" className="link-btn" onClick={() => void cancelMfa()}>
              ← Revenir à la connexion
            </button>
          </div>
        </div>
      </div>
    )
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
          <div className="login-options">
            <label className="remember-label" htmlFor="remember">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Se souvenir de mon identifiant
            </label>
            <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
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
