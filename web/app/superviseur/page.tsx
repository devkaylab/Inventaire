'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'

/**
 * Demande d'inscription d'un superviseur.
 *
 * Le code magasin est obligatoire : c'est lui qui rattache la demande à une
 * entreprise et à un magasin, et qui permet à l'administrateur Quantinvo de
 * la retrouver sans chercher. Il est remis par l'administrateur de
 * l'entreprise, jamais affiché dans l'application.
 *
 * Aucun mot de passe ici : il sera choisi par la personne, via le lien reçu
 * par e-mail une fois la demande validée.
 */
export default function SupervisorRequestPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [storeCode, setStoreCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    // La fonction edge fait le même dépôt, plus l'explication par e-mail que
    // l'écran n'a plus le droit de donner. Si elle est indisponible, on retombe
    // sur la fonction publique de la base : même réponse uniforme, sans e-mail.
    // La demande passe dans les deux cas — c'est ce qui compte.
    let data = null
    const viaEdge = await supabase.functions.invoke('submit-supervisor-request', {
      body: { firstName, lastName, email, phone, storeCode },
    })
    if (!viaEdge.error && viaEdge.data) {
      data = viaEdge.data
    } else {
      const viaRpc = await supabase.rpc('submit_supervisor_request', {
        p_first_name: firstName,
        p_last_name: lastName,
        p_email: email,
        p_phone: phone,
        p_store_code: storeCode,
      })
      if (viaRpc.error) {
        setLoading(false)
        setError('Envoi impossible. Vérifiez votre connexion, puis réessayez.')
        return
      }
      data = viaRpc.data
    }
    setLoading(false)
    if (!data?.success) {
      setError(data?.error ?? 'Envoi impossible.')
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
            <h1>Demande enregistrée</h1>
            {/* Réponse volontairement identique quel que soit le cas : dire ici
                « code introuvable » reviendrait à confirmer, code après code,
                lesquels sont valides. D'où la formulation conditionnelle, et le
                repère de délai qui rend une faute de frappe rattrapable. */}
            <p className="sub">
              Si ce code correspond à un magasin Quantinvo, votre demande est en cours de validation.
              Dès qu&apos;elle est acceptée, vous recevez un e-mail à l&apos;adresse {email} vous invitant
              à créer votre mot de passe. Votre accès est actif immédiatement après.
            </p>
            <p className="sub" style={{ marginTop: 12 }}>
              Sans nouvelle sous 48 heures, vérifiez le code magasin auprès de l&apos;administrateur de
              votre entreprise : c&apos;est la cause la plus fréquente. Et si vous avez déjà un compte,
              connectez-vous directement plutôt que de refaire une demande.
            </p>
          </div>
          <Link href="/" className="btn btn-primary btn-block">Retour à l&apos;accueil</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Demander un accès superviseur</h1>
          <p className="sub">
            Munissez-vous du code magasin remis par l&apos;administrateur de votre entreprise.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="firstName">Prénom</label>
            <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Paul" />
          </div>
          <div className="field">
            <label htmlFor="lastName">Nom</label>
            <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Martin" />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail professionnel</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="paul.martin@acme.fr" />
          </div>
          <div className="field">
            <label htmlFor="phone">Téléphone (facultatif)</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
          </div>
          <div className="field">
            <label htmlFor="storeCode">Code magasin</label>
            <input
              id="storeCode"
              value={storeCode}
              onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{ letterSpacing: 4, fontWeight: 700, textAlign: 'center' }}
            />
            <p className="field-hint">
              Ce code est confidentiel. Si vous ne l&apos;avez pas, demandez-le à l&apos;administrateur de votre entreprise.
            </p>
          </div>

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
          <MentionCollecte finalite="instruire votre demande d’accès superviseur et la soumettre à validation" />
        </form>

        <div className="center-link">
          <Link href="/login">J&apos;ai déjà un compte</Link>
        </div>
      </div>
    </div>
  )
}
