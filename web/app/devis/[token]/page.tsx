'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'

/**
 * Le devis, vu par le prospect — et accepté sans compte.
 *
 * ⚠️ **Hors de la coquille `AppShell`**, comme /bienvenue et /reinitialisation :
 * le lien arrive par e-mail, donc s'ouvre le plus souvent sur un téléphone. La
 * porte des 720 px qui ferme l'espace connecté n'a pas cours ici.
 *
 * Il n'y a pas de session à ce stade du parcours : c'est le **jeton de
 * l'adresse** qui tient lieu de clé, et les deux RPC appelées ici sont les
 * seules ouvertes à `anon` sur ce sujet. La page n'affiche jamais l'adresse
 * e-mail du contact — un lien transféré ne doit rien apprendre de plus que le
 * devis lui-même.
 *
 * L'acceptation passe par l'edge `accept-quote`, qui écrit les deux e-mails
 * **et ouvre la session Stripe Checkout** : la réponse porte `paymentUrl`, et
 * la page y envoie le client dans la foulée. Le repli sur la RPC directe
 * enregistre l'accord sans paiement — mieux qu'un bouton qui ne répond pas.
 *
 * Au retour de Stripe (`?paiement=ok`), le webhook a le plus souvent déjà
 * créé l'entreprise ou le magasin : la page relit le devis et le dit. Sinon
 * elle l'annonce comme imminent — le paiement SEPA, lui, met quelques jours.
 */

type Ligne = {
  libelle?: string | null
  unites?: number | null
  tranche?: string | null
  prixCents?: number | null
}

type Devis = {
  found: boolean
  company_name?: string
  contact_first_name?: string
  reference?: string
  amount_cents?: number | null
  lines?: Ligne[]
  status?: 'pending' | 'quoted' | 'accepted' | 'paid' | 'created' | 'rejected'
  sent_at?: string
  expires_at?: string
  accepted_at?: string | null
  expired?: boolean
}

const euros = (cents?: number | null) =>
  cents == null
    ? '—'
    : (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

const nb = (n?: number | null) => (n == null ? '—' : n.toLocaleString('fr-FR'))

const jour = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

// `useSearchParams` impose une frontière Suspense au rendu statique.
export default function DevisPage() {
  return (
    <Suspense fallback={<div className="auth-wrap"><div className="auth-card"><p className="sub">Chargement du devis…</p></div></div>}>
      <DevisContenu />
    </Suspense>
  )
}

function DevisContenu() {
  const params = useParams<{ token: string }>()
  const token = typeof params?.token === 'string' ? params.token : ''
  const search = useSearchParams()
  const retourPaiement = search?.get('paiement') === 'ok'
  const [devis, setDevis] = useState<Devis | null>(null)
  const [chargement, setChargement] = useState(true)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    if (!token) return
    setChargement(true)
    const { data, error } = await supabase.rpc('quote_by_token', { p_token: token })
    setChargement(false)
    if (error) {
      setErreur('Ce devis n’a pas pu être chargé. Réessayez dans un instant.')
      return
    }
    setDevis((data ?? { found: false }) as Devis)
  }, [token])

  useEffect(() => { charger() }, [charger])

  async function accepter() {
    setBusy(true)
    setErreur('')
    let ok = false
    let message = ''
    const { data, error } = await supabase.functions.invoke('accept-quote', { body: { token } })
    if (!error && data?.success) {
      ok = true
      if (typeof data.paymentUrl === 'string' && data.paymentUrl) {
        // Stripe prend la main : la page est quittée ici.
        window.location.assign(data.paymentUrl)
        return
      }
    } else if (error) {
      // Edge injoignable : la RPC porte les mêmes gardes.
      const direct = await supabase.rpc('accept_quote_by_token', { p_token: token })
      ok = !direct.error && direct.data?.success
      message = direct.data?.error ?? direct.error?.message ?? ''
    } else {
      message = data?.error ?? ''
    }
    setBusy(false)
    if (!ok) {
      setErreur(message || 'L’acceptation n’a pas abouti. Réessayez, ou répondez à notre e-mail.')
      return
    }
    await charger()
  }

  const pdfUrl = token
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/quote-pdf?token=${encodeURIComponent(token)}`
    : '#'

  if (chargement) {
    return (
      <div className="auth-wrap">
        <div className="auth-card"><p className="sub">Chargement du devis…</p></div>
      </div>
    )
  }

  if (!devis?.found) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="head">
            <Link href="/"><Logo size={56} /></Link>
            <h1>Ce lien n’est plus valable</h1>
            <p className="sub">
              Le devis a peut-être été renvoyé depuis&nbsp;: dans ce cas, seul le lien du dernier
              e-mail fonctionne. Répondez à notre message et nous vous le renvoyons.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const accepte = devis.status === 'accepted' || devis.status === 'paid' || devis.status === 'created'
  const refuse = devis.status === 'rejected'
  const perime = !accepte && devis.expired
  const lignes = devis.lines ?? []

  return (
    <div className="auth-wrap">
      <div className="auth-card devis-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Devis {devis.reference || ''}</h1>
          <p className="sub">
            Établi pour <strong>{devis.company_name}</strong> le {jour(devis.sent_at)}
            {!accepte && !perime && devis.expires_at ? ` · valable jusqu’au ${jour(devis.expires_at)}` : ''}
          </p>
        </div>

        {(devis.status === 'paid' || devis.status === 'created') && (
          <div className="devis-etat devis-etat-ok">
            <strong>Paiement reçu — merci</strong>
            <span>
              {devis.status === 'created'
                ? 'Tout est en place. Vous recevez par e-mail le lien pour créer votre accès, et la facture Stripe.'
                : 'Vos accès sont en cours de création : l’e-mail arrive dans la minute.'}
            </span>
          </div>
        )}
        {devis.status === 'accepted' && retourPaiement && (
          <div className="devis-etat devis-etat-ok">
            <strong>Paiement en cours de confirmation</strong>
            <span>
              Stripe nous confirme le règlement d’ici quelques instants — quelques jours pour un prélèvement
              SEPA. Vos accès sont créés à ce moment-là, et vous recevez un e-mail.
            </span>
          </div>
        )}
        {devis.status === 'accepted' && !retourPaiement && (
          <div className="devis-etat devis-etat-ok">
            <strong>Devis accepté</strong>
            <span>
              Votre accord est enregistré{devis.accepted_at ? ` le ${jour(devis.accepted_at)}` : ''}. Il ne reste
              qu’à régler la licence : vos accès sont créés dès le paiement.
            </span>
          </div>
        )}
        {refuse && (
          <div className="devis-etat">
            <strong>Ce devis n’est plus d’actualité</strong>
            <span>Répondez à notre e-mail si vous souhaitez une nouvelle proposition.</span>
          </div>
        )}
        {perime && !refuse && (
          <div className="devis-etat">
            <strong>Ce devis a expiré</strong>
            <span>Écrivez-nous&nbsp;: nous vous en établissons un nouveau, aux tarifs en vigueur.</span>
          </div>
        )}

        {lignes.length > 0 && (
          <div className="devis-lignes">
            <div className="devis-ligne devis-ligne-tete">
              <span>Magasin</span>
              <span className="n">Stock déclaré</span>
              <span className="n">Licence annuelle HT</span>
            </div>
            {lignes.map((l, i) => (
              <div className="devis-ligne" key={i}>
                <span>{(l.libelle ?? '').trim() || `Magasin ${i + 1}`}</span>
                <span className="n muted">{l.unites == null ? '—' : `${nb(l.unites)} pièces`}</span>
                <span className="n">{l.prixCents == null ? 'sur devis' : euros(l.prixCents)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="devis-total">
          <span>Total annuel hors taxes</span>
          <b>{euros(devis.amount_cents)}</b>
        </div>

        {erreur && <div className="error">{erreur}</div>}

        <div className="devis-actions">
          {!accepte && !perime && !refuse && (
            <button type="button" className="btn btn-primary" onClick={accepter} disabled={busy}>
              {busy ? 'Enregistrement…' : 'J’accepte ce devis'}
            </button>
          )}
          {devis.status === 'accepted' && !retourPaiement && (
            // Même appel : sur un devis déjà accepté, l'edge rend la même
            // session Checkout (clé d'idempotence) — jamais une seconde.
            <button type="button" className="btn btn-primary" onClick={accepter} disabled={busy}>
              {busy ? 'Ouverture du paiement…' : 'Régler la licence'}
            </button>
          )}
          <a className="btn btn-ghost" href={pdfUrl}>Télécharger le PDF</a>
        </div>

        <p className="devis-note">
          Licence annuelle par magasin, comptages et compteurs illimités. L’acceptation vaut bon pour
          accord&nbsp;; le règlement se fait en ligne, par carte ou prélèvement SEPA, et vos accès sont créés
          dès réception. La facture vous est envoyée automatiquement.
        </p>
      </div>
    </div>
  )
}
