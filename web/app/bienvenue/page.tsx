'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'
import { PasswordRules } from '@/components/PasswordRules'
import { StoreBadges } from '@/components/StoreBadges'
import { friendlyPasswordError, passwordError, MIN_PASSWORD_LENGTH } from '@/lib/password'
import { Chargement } from '@/components/Chargement'
import { LangueToggle } from '@/components/LangueToggle'
import { useTraduction } from '@/lib/i18n'

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
  const { t } = useTraduction()
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
      setError(t('Renseignez votre prénom et votre nom.'))
      return
    }
    // Mêmes règles que le serveur (voir `lib/password.ts`) : les énoncer ici
    // évite un refus en anglais après envoi.
    const pwdError = passwordError(password)
    if (pwdError) {
      setError(t(pwdError))
      return
    }
    if (password !== confirm) {
      setError(t('Les deux mots de passe ne correspondent pas.'))
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
      setError(authError ? t(friendlyPasswordError(authError.message)) : t('Enregistrement impossible.'))
      return
    }

    // Répercuter une éventuelle correction sur le profil.
    const { error: profError } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName })
      .eq('id', updated.user.id)
    setBusy(false)
    if (profError) {
      setError(t('Mot de passe enregistré, mais votre nom n’a pas pu être mis à jour. Vous pourrez le corriger depuis votre compte.'))
      return
    }
    setDone(true)
  }

  if (!ready) {
    return <Chargement />
  }

  if (!hasSession) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>{t('Lien expiré')}</h1>
            <p className="sub">
              {t("Ce lien d'invitation n'est plus valable ou a déjà été utilisé. Si vous avez déjà choisi votre mot de passe, connectez-vous. Sinon, demandez une nouvelle invitation à la personne qui vous a ajouté.")}
            </p>
          </div>
          <Link href="/login" className="btn btn-primary btn-block">{t('Se connecter')}</Link>
        </div>
        <LangueToggle />
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
            <h1>{t('Compte activé')}</h1>
            <p className="sub">
              {isSupervisor ? (
                <>{t('Bienvenue %{prenom}. Votre compte est actif : vous pouvez vous connecter dès maintenant.', { prenom: firstName })}</>
              ) : (
                <>
                  {t("Bienvenue %{prenom}. Il ne reste qu'à installer l'application Quantinvo, puis à vous connecter avec ", { prenom: firstName })}
                  <b>{email}</b>{t(' et le mot de passe que vous venez de choisir.')}
                </>
              )}
            </p>
          </div>
          {isSupervisor ? (
            <button className="btn btn-primary btn-block" onClick={() => router.replace('/account')}>
              {t('Accéder à mon espace')}
            </button>
          ) : (
            /* Le cul-de-sac d'avant : cette page disait « ouvrez l'application »
               sans dire où la prendre. Les badges vivaient sur /open, donc à un
               clic de plus, derrière un lien qui ne mène quelque part que si
               l'application est DÉJÀ installée. Or cette page s'ouvre depuis une
               messagerie, au téléphone : c'est le seul moment du parcours où
               montrer la boutique ne coûte rien.

               « Ouvrir l'application » reste l'action première : tant que
               `PUBLIEE` vaut faux, un badge mène à une recherche qui ne trouve
               rien. Les badges suivent `appStores.ts` — le jour de la
               publication, une seule ligne change là-bas et cette page dit vrai
               toute seule, phrase d'attente comprise.

               Et rien ne renvoie vers le web : un compteur y atterrirait sur
               « Mon compte », que l'espace connecté referme sous 720 px — il
               lirait « cet espace se pilote depuis un ordinateur » sur
               l'appareil qu'il tient. */
            <>
              <Link href="/open" className="btn btn-primary btn-block">{t("Ouvrir l'application")}</Link>
              <StoreBadges />
            </>
          )}
        </div>
        <LangueToggle />
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>{t('Finaliser mon compte')}</h1>
          <p className="sub">
            {t('Vérifiez vos informations et choisissez votre mot de passe.')}
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">{t('E-mail')}</label>
            <input id="email" value={email} disabled readOnly />
            <p className="field-hint">{t("C'est l'adresse à laquelle vous avez été invité.")}</p>
          </div>
          <div className="field">
            <label htmlFor="firstName">{t('Prénom')}</label>
            <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lastName">{t('Nom')}</label>
            <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">{t('Mot de passe')}</label>
            <input
              id="password" type="password" autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={t('%{n} caractères minimum', { n: MIN_PASSWORD_LENGTH })}
            />
            <PasswordRules password={password} />
          </div>
          <div className="field">
            <label htmlFor="confirm">{t('Confirmer le mot de passe')}</label>
            <input
              id="confirm" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('Activation…') : t('Activer mon compte')}
          </button>
          <MentionCollecte finalite={t('créer votre compte et vous permettre de vous connecter')} />
        </form>
      </div>
      <LangueToggle />
    </div>
  )
}
