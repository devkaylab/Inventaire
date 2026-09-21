'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'
import { LangueToggle } from '@/components/LangueToggle'
import { useTraduction } from '@/lib/i18n'

/**
 * Demande de réinitialisation du mot de passe.
 *
 * La réponse est **la même que l'adresse ait un compte ou non** : dire « aucun
 * compte pour cette adresse » ferait de ce formulaire un oracle d'énumération
 * d'e-mails — exactement ce que le correctif M3 a fermé sur les formulaires
 * publics.
 *
 * ⚠️ **L'E-MAIL PART DE QUANTINVO, PLUS DE SUPABASE** (20 septembre 2026).
 * Constat de Julien en recevant le message : « c'est un mail supabase qu'on
 * reçoit, pas de quantinvo, il faut changer ça ». C'était le seul courriel du
 * produit hors du gabarit maison — et un message d'un expéditeur inconnu, sans
 * logo, avec un lien à cliquer, a exactement la forme d'un hameçonnage.
 * L'envoi passe donc par la fonction edge `mot-de-passe-oublie`, qui demande
 * le lien à Supabase et le met dans NOTRE gabarit.
 *
 * ⚠️ **ET IL RESTE UN REPLI, PARCE QU'UN COMPTE VERROUILLÉ NE PEUT PAS
 * ATTENDRE.** Si la fonction est injoignable, on retombe sur
 * `resetPasswordForEmail` : le message est alors celui de Supabase, ce qui est
 * moins bien — mais quelqu'un qui ne peut plus entrer chez lui a besoin d'un
 * lien, pas d'une charte. Le repli est un dernier recours, pas un chemin
 * normal : la garde `web/tests/formulaires-publics.test.ts` vérifie que
 * l'appel à la fonction vient d'abord.
 *
 * Le lien reçu mène à /reinitialisation (à déclarer dans les Redirect URLs de
 * la console Supabase — voir AGENTS.md).
 */
export default function ForgotPasswordPage() {
  const { t } = useTraduction()
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
      setError(t('Indiquez votre adresse e-mail.'))
      return
    }
    setBusy(true)
    const redirectTo = `${window.location.origin}/reinitialisation`
    let envoye = false
    try {
      const { error: erreurEdge } = await supabase.functions.invoke('mot-de-passe-oublie', {
        body: { email: email.trim(), redirectTo },
      })
      envoye = !erreurEdge
    } catch {
      envoye = false
    }
    if (!envoye) {
      // ⚠️ REPLI : la fonction est injoignable (pas encore déployée, réseau,
      // panne). Le message partira de Supabase — moins bien, mais quelqu'un
      // qui ne peut plus entrer chez lui a besoin d'un lien, pas d'une charte.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      if (resetError) {
        setBusy(false)
        // Un échec ici est un problème d'envoi (réseau, limitation de débit),
        // jamais une information sur l'existence du compte.
        setError(t("L'e-mail n'a pas pu être envoyé pour le moment. Réessayez dans quelques instants."))
        return
      }
    }
    setBusy(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>{t('E-mail envoyé')}</h1>
            <p className="sub">
              {t('Si un compte existe pour ')}<strong>{email.trim()}</strong>{t(", un e-mail de réinitialisation vient de lui être envoyé. Ouvrez le lien qu'il contient pour choisir un nouveau mot de passe. Pensez à vérifier vos indésirables.")}
            </p>
          </div>
          <Link href="/login" className="btn btn-primary btn-block">{t('Retour à la connexion')}</Link>
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
          <h1>{t('Mot de passe oublié')}</h1>
          <p className="sub">
            {t("Indiquez l'adresse e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.")}
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">{t('E-mail')}</label>
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
            {busy ? t('Envoi…') : t('Envoyer le lien')}
          </button>
          <MentionCollecte finalite={t('vous envoyer le lien de réinitialisation de votre mot de passe')} />
        </form>

        <div className="center-link">
          <Link href="/login">{t('← Retour à la connexion')}</Link>
        </div>
      </div>
      <LangueToggle />
    </div>
  )
}
