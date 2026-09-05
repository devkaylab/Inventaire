'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { CONTACT_EMAIL } from '@/lib/contact'
import { MENTION_TVA, TVA_APPLICABLE } from '@/lib/offres'

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
  /** Appareils déclarés — l'assiette depuis le 2 septembre 2026. */
  appareils?: number | null
  offre?: string | null
  /** ⚠️ Volume de stock : les devis d'avant la bascule n'ont que lui. */
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
  billing_period?: 'monthly' | 'yearly'
  status?: 'pending' | 'quoted' | 'accepted' | 'paid' | 'created' | 'rejected' | 'declined'
  sent_at?: string
  expires_at?: string
  accepted_at?: string | null
  declined_at?: string | null
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
  // Le refus : un panneau discret, un motif facultatif. On ne force pas la
  // raison — mais s'il la donne, Quantinvo la lit.
  const [declinerOuvert, setDeclinerOuvert] = useState(false)
  const [motif, setMotif] = useState('')

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
      setErreur(message || `L’acceptation n’a pas abouti. Réessayez${CONTACT_EMAIL ? `, ou écrivez-nous à ${CONTACT_EMAIL}` : ''}.`)
      return
    }
    await charger()
  }

  async function decliner() {
    setBusy(true)
    setErreur('')
    let ok = false
    let message = ''
    const { data, error } = await supabase.functions.invoke('decline-quote', { body: { token, reason: motif.trim() } })
    if (!error && data?.success) {
      ok = true
    } else if (error) {
      const direct = await supabase.rpc('decline_quote_by_token', { p_token: token, p_reason: motif.trim() })
      ok = !direct.error && direct.data?.success
      message = direct.data?.error ?? direct.error?.message ?? ''
    } else {
      message = data?.error ?? ''
    }
    setBusy(false)
    if (!ok) {
      setErreur(message || `La réponse n’a pas pu être enregistrée. Réessayez${CONTACT_EMAIL ? `, ou écrivez-nous à ${CONTACT_EMAIL}` : ''}.`)
      return
    }
    setDeclinerOuvert(false)
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
              e-mail fonctionne.{CONTACT_EMAIL ? <> Écrivez-nous à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> et nous vous le renvoyons.</> : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const accepte = devis.status === 'accepted' || devis.status === 'paid' || devis.status === 'created'
  const refuse = devis.status === 'rejected'
  const decline = devis.status === 'declined'
  const perime = !accepte && devis.expired
  const lignes = devis.lines ?? []
  const mensuel = devis.billing_period === 'monthly'
  // Les devis d'avant le 2 septembre 2026 portent un volume de stock, pas des
  // appareils. La colonne dit ce que la ligne contient : on ne réécrit pas un
  // document déjà envoyé.
  const surAppareils = lignes.some((l) => l.appareils != null)

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
        {decline && (
          <div className="devis-etat">
            <strong>Vous avez décliné ce devis</strong>
            <span>
              C’est noté{devis.declined_at ? ` le ${jour(devis.declined_at)}` : ''}, vous ne recevrez pas de relance.
              {CONTACT_EMAIL
                ? <> Si le montant ou le périmètre ne convenait pas, écrivez-nous à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>&nbsp;: une nouvelle proposition est toujours possible.</>
                : ' Une nouvelle proposition reste toujours possible.'}
            </span>
          </div>
        )}
        {refuse && (
          <div className="devis-etat">
            <strong>Ce devis n’est plus d’actualité</strong>
            <span>{CONTACT_EMAIL ? <>Écrivez-nous à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> si vous souhaitez une nouvelle proposition.</> : 'Une nouvelle proposition reste possible.'}</span>
          </div>
        )}
        {perime && !refuse && !decline && (
          <div className="devis-etat">
            <strong>Ce devis a expiré</strong>
            {/* ⚠️ L'adresse, ou le silence — règle du 22 août 2026. Ses deux
                voisins la respectaient, pas celui-ci. Trouvé par la garde
                des textes, le 5 septembre. */}
            <span>{CONTACT_EMAIL
              ? <>Écrivez-nous à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>&nbsp;: nous vous en établissons un nouveau, aux tarifs en vigueur.</>
              : 'Un nouveau devis reste possible, aux tarifs en vigueur.'}</span>
          </div>
        )}

        {lignes.length > 0 && (
          <div className="devis-lignes">
            <div className="devis-ligne devis-ligne-tete">
              <span>Magasin</span>
              <span className="n">{surAppareils ? 'Appareils' : 'Stock déclaré'}</span>
              <span className="n">
                {mensuel ? 'Abonnement mensuel' : 'Licence annuelle'}{TVA_APPLICABLE ? ' HT' : ''}
              </span>
            </div>
            {lignes.map((l, i) => (
              <div className="devis-ligne" key={i}>
                <span>{(l.libelle ?? '').trim() || `Magasin ${i + 1}`}</span>
                <span className="n muted">
                  {surAppareils
                    ? l.appareils == null ? '—' : `${nb(l.appareils)} appareil${l.appareils > 1 ? 's' : ''}`
                    : l.unites == null ? '—' : `${nb(l.unites)} pièces`}
                </span>
                <span className="n">{l.prixCents == null ? 'sur devis' : euros(l.prixCents)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="devis-total">
          {/* ⚠️ En franchise en base, il n'y a pas de « hors taxes » : le
              total est le montant dû. La mention réglementaire est portée par
              le PDF, qui est le document qui engage. */}
          <span>
            {mensuel ? 'Total mensuel' : 'Total annuel'}{TVA_APPLICABLE ? ' hors taxes' : ''}
          </span>
          <b>{euros(devis.amount_cents)}</b>
        </div>

        {/* La mention que porte le PDF, portée aussi par l'écran : c'est ici
            qu'on accepte, et le total affiché est le montant dû. */}
        {!TVA_APPLICABLE && <p className="devis-mention">{MENTION_TVA}.</p>}

        {erreur && <div className="error">{erreur}</div>}

        <div className="devis-actions">
          {!accepte && !perime && !refuse && !decline && (
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

        {/* Décliner : en retrait des deux boutons, parce que ce n'est pas le
            geste qu'on attend — mais il doit exister. Un client qui ne veut
            pas du devis n'a sinon rien à cliquer, et on le relance pour rien. */}
        {devis.status === 'quoted' && !perime && !declinerOuvert && (
          <button type="button" className="link-btn devis-decliner" onClick={() => setDeclinerOuvert(true)} disabled={busy}>
            Je ne souhaite pas donner suite
          </button>
        )}
        {devis.status === 'quoted' && !perime && declinerOuvert && (
          <div className="devis-decliner-panneau">
            <label htmlFor="motif">Pouvez-vous nous dire pourquoi&nbsp;? (facultatif)</label>
            <textarea
              id="motif"
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Trop cher, pas le bon moment, un autre outil retenu…"
              maxLength={500}
            />
            <div className="devis-actions">
              <button type="button" className="btn btn-ghost" onClick={decliner} disabled={busy}>
                {busy ? 'Enregistrement…' : 'Confirmer : je décline'}
              </button>
              <button type="button" className="link-btn" onClick={() => setDeclinerOuvert(false)} disabled={busy}>
                Revenir
              </button>
            </div>
          </div>
        )}

        {/* ⚠️ « comptages et compteurs illimités » était vrai de la grille au
            volume ; il ne l'est plus. C'est le nombre d'appareils qui comptent
            en même temps qui est facturé — le dire ici évite de le découvrir
            aux conditions générales. Et le moyen de paiement suit le rythme :
            le SEPA convient à une facture annuelle, pas à un abonnement. */}
        <p className="devis-note">
          {mensuel
            ? 'Abonnement mensuel par magasin, pour le nombre d’appareils indiqué. Inventaires illimités. L’acceptation vaut bon pour accord ; le règlement se fait en ligne par carte, et vos accès sont créés dès le premier prélèvement. La facture de chaque échéance vous est envoyée automatiquement.'
            : 'Licence annuelle par magasin, pour le nombre d’appareils indiqué. Inventaires illimités. L’acceptation vaut bon pour accord ; le règlement se fait en ligne, par carte ou prélèvement SEPA, et vos accès sont créés dès réception. La facture vous est envoyée automatiquement.'}
        </p>
      </div>
    </div>
  )
}
