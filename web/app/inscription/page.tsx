'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'

/**
 * Demande d'inscription d'une entreprise — première étape du parcours.
 *
 * Rien n'est créé ici : le formulaire dépose une demande que l'administrateur
 * Quantinvo devise, facture, puis transforme en entreprise et magasins. Les
 * codes ne sont générés qu'après encaissement, dans la console admin.
 */
export default function CompanyRequestPage() {
  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [storeCount, setStoreCount] = useState('1')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const count = Number.parseInt(storeCount, 10)
    if (!Number.isFinite(count) || count < 1) {
      setError('Indiquez un nombre de magasins valide.')
      return
    }
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('submit_company_request', {
      p_company_name: companyName,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email,
      p_phone: phone,
      p_store_count: count,
      p_message: message,
    })
    setLoading(false)
    if (rpcError) {
      setError('Envoi impossible. Vérifiez votre connexion, puis réessayez.')
      return
    }
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
            <h1>Demande envoyée</h1>
            <p className="sub">
              Notre équipe étudie votre demande et vous adresse un devis à l&apos;adresse {email}.
              Une fois le devis validé et la facture réglée, vous recevrez votre code entreprise
              et un code par magasin.
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
          <h1>Inscrire mon entreprise</h1>
          <p className="sub">
            Décrivez votre besoin : nous revenons vers vous avec un devis adapté au nombre de magasins.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="company">Nom de l&apos;entreprise</label>
            <input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ACME Retail" />
          </div>
          <div className="field">
            <label htmlFor="firstName">Prénom du contact</label>
            <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marie" />
          </div>
          <div className="field">
            <label htmlFor="lastName">Nom du contact</label>
            <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Durand" />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marie.durand@acme.fr" />
          </div>
          <div className="field">
            <label htmlFor="phone">Téléphone</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 23 45 67 89" />
          </div>
          <div className="field">
            <label htmlFor="stores">Nombre de magasins</label>
            <input id="stores" type="number" min={1} max={500} value={storeCount} onChange={(e) => setStoreCount(e.target.value)} />
            <p className="field-hint">Un code d&apos;accès sera généré pour chaque magasin.</p>
          </div>
          <div className="field">
            <label htmlFor="message">Votre besoin (facultatif)</label>
            <textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Volumétrie, échéance, contraintes…" />
          </div>

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
          <MentionCollecte finalite="traiter votre demande d’inscription, vous adresser un devis et vous recontacter à son sujet" />
        </form>

        <div className="center-link">
          <Link href="/login">J&apos;ai déjà un compte</Link>
        </div>
      </div>
    </div>
  )
}
