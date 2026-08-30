'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { MentionCollecte } from '@/components/MentionCollecte'
import { supabase } from '@/lib/supabaseClient'
import { OFFRES, economie, euros, ttc, type CleOffre } from '@/lib/offres'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * La souscription en ligne.
 *
 * ⚠️ Publique et hors AppShell : celui qui souscrit n'a pas encore de compte,
 * et il arrive souvent depuis un téléphone.
 *
 * ⚠️ Aucune donnée bancaire ne transite ici. Le formulaire dépose la demande,
 * la fonction edge ouvre une session Stripe Checkout, et c'est Stripe qui
 * collecte la carte sur son propre domaine. Ne jamais ajouter de champ de
 * carte sur cette page.
 */
function Formulaire() {
  const params = useSearchParams()
  const paiementOk = params.get('paiement') === 'ok'

  const demande = params.get('offre')
  const depart = OFFRES.find((o) => o.cle === demande)?.cle ?? 'advanced'
  const [plan, setPlan] = useState<CleOffre>(depart)
  const [annuel, setAnnuel] = useState(params.get('rythme') === 'annuel')

  const [companyName, setCompanyName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [storeName, setStoreName] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [saitQuoiFaire, setSaitQuoiFaire] = useState(false)

  const offre = OFFRES.find((o) => o.cle === plan)!

  if (paiementOk) {
    return (
      <div className="card souscrire-fin">
        <h1>Merci, c’est enregistré.</h1>
        <p>
          Votre paiement est accepté. Nous créons votre espace et vous recevez, dans les
          minutes qui viennent, un e-mail contenant votre lien de connexion et le code de
          votre magasin.
        </p>
        <p className="muted">
          Rien ne vous est demandé d’ici là. Si l’e-mail n’arrive pas sous une heure,
          {CONTACT_EMAIL ? <> écrivez-nous à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</> : <> contactez-nous.</>}
        </p>
        <Link href="/" className="btn btn-ghost">Revenir à l’accueil</Link>
      </div>
    )
  }

  async function souscrire(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const { data, error } = await supabase.functions.invoke('subscribe-online', {
      body: {
        companyName, firstName, lastName, email, storeName,
        plan, billingPeriod: annuel ? 'yearly' : 'monthly',
      },
    })
    // ⚠️ Pas de repli sur une RPC directe, contrairement à /inscription : sans
    // la fonction edge il n'y a pas de session Stripe, donc rien à payer.
    // Déposer la demande quand même laisserait croire à une souscription faite.
    if (error || !data?.success) {
      setEnvoi(false)
      // ⚠️ Un refus d'adresse n'est pas une panne : il arrive AVANT tout
      // encaissement (le premier test réel avait payé puis échoué à inviter
      // l'administrateur), et il dit quoi faire. Le distinguer visuellement
      // évite de faire réessayer quelqu'un que rien ne débloquera.
      setSaitQuoiFaire(Boolean(data?.code))
      setErreur(data?.error ?? 'La souscription n’a pas pu s’ouvrir. Réessayez dans un instant.')
      return
    }
    window.location.href = data.paymentUrl
  }

  return (
    <form className="card souscrire" onSubmit={souscrire}>
      <h1>Souscrire à Quantinvo</h1>
      <p className="souscrire-intro">
        Quatre informations, puis le paiement. Votre espace est créé dès l’encaissement.
      </p>

      <div className="souscrire-choix">
        <span className="souscrire-label">Votre offre</span>
        <div className="souscrire-offres">
          {OFFRES.map((o) => (
            <button
              type="button"
              key={o.cle}
              className={o.cle === plan ? 'souscrire-offre actif' : 'souscrire-offre'}
              aria-pressed={o.cle === plan}
              onClick={() => setPlan(o.cle)}
            >
              <strong>{o.nom}</strong>
              <span>{o.plage}</span>
            </button>
          ))}
        </div>

        <div className="tarifs-bascule souscrire-rythme" role="group" aria-label="Rythme de paiement">
          <button type="button" className={annuel ? '' : 'actif'} aria-pressed={!annuel} onClick={() => setAnnuel(false)}>
            Par mois
          </button>
          <button type="button" className={annuel ? 'actif' : ''} aria-pressed={annuel} onClick={() => setAnnuel(true)}>
            À l’année
          </button>
        </div>

        <div className="souscrire-total">
          <strong>{euros(annuel ? offre.an : offre.mois)}</strong>
          <span>{annuel ? 'HT par an, pour un magasin' : 'HT par mois, pour un magasin'}</span>
          {/* ⚠️ Le TTC s'affiche ici et nulle part ailleurs : c'est le montant
              qui sera réellement prélevé. Annoncer le HT jusqu'au bout ferait
              découvrir l'écart sur le relevé bancaire. */}
          <span className="souscrire-ttc">
            soit {euros(ttc(annuel ? offre.an : offre.mois))} TTC, TVA 20 % incluse
          </span>
          <em>
            {annuel
              ? `Vous économisez ${euros(economie(offre))} par rapport au paiement mensuel. L’année est due jusqu’à son terme.`
              : `Sans engagement : vous arrêtez quand vous voulez. À l’année, vous économiseriez ${euros(economie(offre))}.`}
          </em>
        </div>
      </div>

      <div className="souscrire-champs">
        <div className="field">
          <label htmlFor="companyName">Nom de votre entreprise</label>
          <input id="companyName" required maxLength={80} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="storeName">Nom du magasin à équiper</label>
          <input id="storeName" required maxLength={80} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="firstName">Votre prénom</label>
          <input id="firstName" required maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lastName">Votre nom</label>
          <input id="lastName" required maxLength={80} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field souscrire-large">
          <label htmlFor="email">Votre adresse e-mail professionnelle</label>
          <input id="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="souscrire-aide">
            C’est votre identifiant, et l’adresse qui recevra vos accès.
          </span>
        </div>
      </div>

      {erreur && (
        <p className={saitQuoiFaire ? 'souscrire-erreur douce' : 'souscrire-erreur'} role="alert">
          {erreur}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={envoi}>
        {envoi ? 'Ouverture du paiement…' : `Payer ${euros(ttc(annuel ? offre.an : offre.mois))} TTC et créer mon espace`}
      </button>
      <p className="souscrire-note">
        Paiement par carte, sur la page sécurisée de Stripe. Nous ne voyons jamais votre
        numéro de carte. <Link href="/tarifs">Revoir les offres</Link>
      </p>

      <MentionCollecte finalite="traiter votre souscription, créer votre espace et vous adresser vos accès" />
    </form>
  )
}

export default function SouscrirePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="section souscrire-section">
          <div className="container">
            <Suspense fallback={<div className="card souscrire"><p>Chargement…</p></div>}>
              <Formulaire />
            </Suspense>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
