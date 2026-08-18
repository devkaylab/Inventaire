'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'

/**
 * Finalisation de compte, à l'arrivée du lien reçu par e-mail.
 *
 * Sert les deux parcours d'invitation — superviseur validé par Quantinvo, et
 * compteur ajouté par son superviseur. Dans les deux cas l'utilisateur auth
 * existe déjà (créé par `inviteUserByEmail`) : il ne s'inscrit pas, il
 * **confirme ses informations et choisit son mot de passe**.
 *
 * Le prénom et le nom sont pré-remplis depuis les métadonnées posées à
 * l'invitation par la personne qui a invité. Ils restent modifiables : c'est
 * le sens de l'étape, on demande de vérifier. Toute correction est répercutée
 * sur le profil, que le trigger `handle_new_user` a créé au moment de
 * l'invitation avec les valeurs d'origine.
 *
 * Le rôle, l'entreprise et le magasin ne sont pas touchés ici — ils viennent
 * du serveur, et le trigger `profiles_pin_privileged` les fige.
 */
export default function WelcomePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      // Le client Supabase consomme le jeton présent dans l'URL et ouvre la
      // session ; `onAuthStateChange` évite la course avec cette lecture.
      const { data: { session } } = await supabase.auth.getSession()
      const apply = async (s: typeof session) => {
        if (!active) return
        if (!s) { setReady(true); return }
        setHasSession(true)
        setEmail(s.user.email ?? '')
        const meta = s.user.user_metadata ?? {}
        setFirstName(typeof meta.first_name === 'string' ? meta.first_name : '')
        setLastName(typeof meta.last_name === 'string' ? meta.last_name : '')
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, first_name, last_name')
          .eq('id', s.user.id)
          .maybeSingle()
        if (!active) return
        if (prof) {
          setRole((prof as { role: string | null }).role)
          // Le profil fait foi s'il porte déjà un prénom / nom.
          const p = prof as { first_name: string | null; last_name: string | null }
          if (p.first_name) setFirstName(p.first_name)
          if (p.last_name) setLastName(p.last_name)
        }
        setReady(true)
      }

      if (session) { await apply(session); return }
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) void apply(s) })
      // Sans jeton exploitable, on n'attend pas indéfiniment.
      setTimeout(() => { if (active) setReady(true) }, 2500)
      return () => sub.subscription.unsubscribe()
    })()
    return () => { active = false }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Renseignez votre prénom et votre nom.')
      return
    }
    // 12 caractères : le seuil que retient la CNIL pour un mot de passe seul,
    // sans second facteur ni mécanisme de blocage après échecs répétés.
    if (password.length < 12) {
      setError('Le mot de passe doit comporter au moins 12 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setBusy(true)
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { data: updated, error: authError } = await supabase.auth.updateUser({
      password,
      data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName },
    })
    if (authError || !updated.user) {
      setBusy(false)
      setError(authError?.message ?? 'Enregistrement impossible.')
      return
    }

    // Répercuter une éventuelle correction sur le profil.
    const { error: profError } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName })
      .eq('id', updated.user.id)
    setBusy(false)
    if (profError) {
      setError('Mot de passe enregistré, mais votre nom n’a pas pu être mis à jour. Vous pourrez le corriger depuis votre compte.')
      return
    }
    setDone(true)
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
              Ce lien d&apos;invitation n&apos;est plus valable ou a déjà été utilisé.
              Si vous avez déjà choisi votre mot de passe, connectez-vous.
              Sinon, demandez une nouvelle invitation à la personne qui vous a ajouté.
            </p>
          </div>
          <Link href="/login" className="btn btn-primary btn-block">Se connecter</Link>
        </div>
      </div>
    )
  }

  if (done) {
    const isSupervisor = role === 'supervisor'
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>Compte activé</h1>
            <p className="sub">
              Bienvenue {firstName}. Votre compte est actif : vous pouvez vous connecter dès maintenant.
            </p>
          </div>
          {isSupervisor ? (
            <button className="btn btn-primary btn-block" onClick={() => router.replace('/account')}>
              Accéder à mon espace
            </button>
          ) : (
            <>
              <Link href="/open" className="btn btn-primary btn-block">Ouvrir l&apos;application</Link>
              <p className="sub" style={{ marginTop: 16, fontSize: 13, textAlign: 'center' }}>
                Le comptage se fait depuis l&apos;application Quantinvo, sur votre téléphone.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Finaliser mon compte</h1>
          <p className="sub">
            Vérifiez vos informations et choisissez votre mot de passe.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" value={email} disabled readOnly />
            <p className="field-hint">C&apos;est l&apos;adresse à laquelle vous avez été invité.</p>
          </div>
          <div className="field">
            <label htmlFor="firstName">Prénom</label>
            <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lastName">Nom</label>
            <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password" type="password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="12 caractères minimum"
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
            {busy ? 'Activation…' : 'Activer mon compte'}
          </button>
          <MentionCollecte finalite="créer votre compte et vous permettre de vous connecter" />
        </form>
      </div>
    </div>
  )
}
