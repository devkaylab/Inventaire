'use client'

import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
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
import { lireJetonDuLien, ouvrirLeLien, type JetonDuLien } from '@/lib/jetonDuLien'
import { envoyerLienDeConnexion } from '@/lib/envoyerLienDeConnexion'

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
  const [jeton, setJeton] = useState<JetonDuLien | null>(null)
  const [ouverture, setOuverture] = useState(false)
  // Le renvoi depuis l'écran « Lien expiré » : on ne connaît plus l'adresse,
  // puisqu'il n'y a ni jeton ni session. On la demande.
  const [relanceMail, setRelanceMail] = useState('')
  const [relanceEnvoi, setRelanceEnvoi] = useState(false)
  const [relanceFaite, setRelanceFaite] = useState(false)
  const [relanceErreur, setRelanceErreur] = useState<string | null>(null)
  const actif = useRef(true)

  // Remplit le formulaire depuis la session ouverte ; sans session, la page
  // dit « lien expiré ».
  async function apply(s: Session | null) {
    if (!actif.current) return
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
    if (!actif.current) return
    if (prof) {
      setRole((prof as { role: string | null }).role)
      // Le profil fait foi s'il porte déjà un prénom / nom.
      const p = prof as { first_name: string | null; last_name: string | null }
      if (p.first_name) setFirstName(p.first_name)
      if (p.last_name) setLastName(p.last_name)
    }
    setReady(true)
  }

  useEffect(() => {
    actif.current = true
    let unsubscribe: (() => void) | undefined
    ;(async () => {
      // ⚠️⚠️ **UNE SESSION DÉJÀ OUVERTE PRIME SUR LE JETON.** Relevé par Julien :
      // sur un téléphone, le navigateur recharge la page tout seul (onglet
      // repris, mémoire récupérée). Le jeton, lui, a été consommé au premier
      // « Continuer » et retiré de l'adresse — la page ne trouvait donc plus
      // rien et annonçait « Lien expiré » à quelqu'un qui était ENCORE
      // CONNECTÉ, à un clic de finir. C'est ce cul-de-sac qui a fait supprimer
      // un compte.
      //
      // ⚠️ Ça n'affaiblit pas la protection du clic (`lib/jetonDuLien.ts`) :
      // un analyseur de liens qui ouvre la page n'a pas de session, donc il
      // retombe sur le bouton et ne consomme toujours rien.
      const dejaOuverte = (await supabase.auth.getSession()).data.session
      if (dejaOuverte) { await apply(dejaOuverte); return }

      // ⚠️ Un lien neuf porte son jeton : on attend le clic (`lib/jetonDuLien.ts`).
      const j = lireJetonDuLien()
      if (j) { if (actif.current) { setJeton(j); setReady(true) } return }
      // Ancien lien : le client Supabase consomme le jeton présent dans l'URL
      // et ouvre la session ; `onAuthStateChange` évite la course avec cette
      // lecture.
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) void apply(s) })
      unsubscribe = () => sub.subscription.unsubscribe()
      // Sans jeton exploitable, on n'attend pas indéfiniment.
      setTimeout(() => { if (actif.current) setReady(true) }, 2500)
    })()
    return () => { actif.current = false; unsubscribe?.() }
  }, [])

  /**
   * ⚠️ CE BOUTON ENVOIE, IL NE RENVOIE PAS VERS UN FORMULAIRE. Première
   * version (9 octobre) : un lien vers « Mot de passe oublié ». Julien a
   * cliqué « Recevoir un nouveau lien » et n'a rien reçu — mesuré ensuite dans
   * les journaux, ZÉRO appel à la fonction d'envoi. Le bouton disait ce qu'il
   * ne faisait pas : il remplaçait un cul-de-sac par un détour.
   */
  async function renvoyer(e: React.FormEvent) {
    e.preventDefault()
    const mail = relanceMail.trim()
    setRelanceErreur(null)
    if (!mail.includes('@')) {
      setRelanceErreur(t('Indiquez votre adresse e-mail.'))
      return
    }
    setRelanceEnvoi(true)
    const ok = await envoyerLienDeConnexion(mail, `${window.location.origin}/bienvenue`)
    setRelanceEnvoi(false)
    if (!ok) {
      setRelanceErreur(t("L'e-mail n'a pas pu être envoyé pour le moment. Réessayez dans quelques instants."))
      return
    }
    setRelanceFaite(true)
  }

  async function continuer() {
    if (!jeton) return
    setOuverture(true)
    let session = await ouvrirLeLien(jeton)
    // ⚠️ Le jeton ne sert QU'UNE FOIS. S'il a déjà servi — second clic depuis
    // l'e-mail, page rouverte — l'échange échoue, mais la session ouverte au
    // premier clic est peut-être encore là. On regarde avant de conclure.
    if (!session) session = (await supabase.auth.getSession()).data.session
    setOuverture(false)
    setJeton(null)
    await apply(session)
  }

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
      data: {
        first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName,
      // ⚠️⚠️ LE MARQUEUR QUI DIT « CE COMPTE EST FINI ». Aucune colonne de
      // Supabase ne le dit : `encrypted_password` est renseigné DÈS
      // L'INVITATION, avec un mot de passe aléatoire — les neuf comptes de la
      // production en portaient un, y compris ceux qui n'avaient jamais rien
      // choisi (mesuré le 10 octobre 2026). Le badge « Mot de passe à créer »
      // et le bouton « Renvoyer le lien » ont donc besoin d'un fait que NOUS
      // enregistrons, au moment exact où il se produit.
      mot_de_passe_cree: true,
      },
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

  if (jeton) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>{t('Finaliser mon compte')}</h1>
            <p className="sub">{t('Continuez pour vérifier vos informations et choisir votre mot de passe.')}</p>
          </div>
          <button className="btn btn-primary btn-block" disabled={ouverture} onClick={() => void continuer()}>
            {ouverture ? t('Ouverture…') : t('Continuer')}
          </button>
        </div>
        <LangueToggle />
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>{t('Lien expiré')}</h1>
            <p className="sub">
              {t("Ce lien ne sert qu'une fois, et il a déjà servi. Vous pouvez en recevoir un nouveau à la même adresse — y compris si vous n'avez jamais choisi de mot de passe.")}
            </p>
          </div>
          {/* ⚠️ LA SORTIE EXISTAIT DEPUIS LE 6 OCTOBRE, ET PERSONNE NE LA VOYAIT :
              « Mot de passe oublié » renvoie un lien neuf à quelqu'un qui n'en a
              jamais eu (`demander_reinitialisation` ne contrôle que l'existence
              de l'adresse dans `auth.users`, et une personne invitée y est dès
              l'invitation). Cet écran envoyait chercher la personne qui avait
              invité — un détour qui a fini par faire supprimer un compte.
              ⚠️ Et le remplacer par un LIEN vers cette page était un second
              détour : l'envoi se fait ici. */}
          {relanceFaite ? (
            <p className="sub">
              {t('Si un compte existe pour ')}<strong>{relanceMail.trim()}</strong>
              {t(", un lien vient d'être envoyé. Pensez à vérifier vos indésirables.")}
            </p>
          ) : (
            <form onSubmit={renvoyer}>
              <div className="field">
                <label htmlFor="relance-mail">{t('Adresse e-mail')}</label>
                <input
                  id="relance-mail" type="email" autoComplete="email"
                  value={relanceMail} placeholder="marie.dupont@exemple.fr"
                  onChange={(e) => { setRelanceMail(e.target.value); setRelanceErreur(null) }}
                />
              </div>
              {relanceErreur && <div className="error" role="alert">{relanceErreur}</div>}
              <button className="btn btn-primary btn-block" disabled={relanceEnvoi} style={{ marginTop: 12 }}>
                {relanceEnvoi ? t('Envoi…') : t('Recevoir un nouveau lien')}
              </button>
            </form>
          )}
          <Link href="/login" className="btn btn-ghost btn-block" style={{ marginTop: 10 }}>
            {t('J’ai déjà un mot de passe : me connecter')}
          </Link>
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
