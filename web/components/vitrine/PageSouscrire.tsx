'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { MentionCollecte } from '@/components/MentionCollecte'
import { supabase } from '@/lib/supabaseClient'
import { MENTION_TVA, OFFRES, TVA_APPLICABLE, economie, euros, ttc, type CleOffre } from '@/lib/offres'
import { CONTACT_EMAIL, ecrivezNous } from '@/lib/contact'
import { venteOuverte } from '@/lib/legal'
import { useTraduction } from '@/lib/i18n'

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
  const { t, lien } = useTraduction()
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
        <h1>{t('Merci, c’est enregistré.')}</h1>
        <p>
          {t('Votre paiement est accepté. Nous créons votre espace et vous recevez, dans les minutes qui viennent, un e-mail contenant votre lien de connexion et le code de votre magasin.')}
        </p>
        <p className="muted">
          {/* ⚠️ Sans adresse, on ne dit rien : « contactez-nous » sans dire OÙ
              est précisément ce que la règle du 22 août 2026 interdit — un
              texte qui invite à écrire donne l'adresse, ou se tait. */}
          {t('Rien ne vous est demandé d’ici là.')}
          {CONTACT_EMAIL && <> {t('Si l’e-mail n’arrive pas sous une heure, écrivez-nous à')}{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>}
        </p>
        <Link href={lien('/')} className="btn btn-ghost">{t('Revenir à l’accueil')}</Link>
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
      setErreur(data?.error ?? t('La souscription n’a pas pu s’ouvrir. Réessayez dans un instant.'))
      return
    }
    window.location.href = data.paymentUrl
  }

  return (
    <form className="card souscrire" onSubmit={souscrire}>
      <h1>{t('Souscrire à Quantinvo')}</h1>
      <p className="souscrire-intro">
        {t('Quatre informations, puis le paiement. Votre espace est créé dès l’encaissement.')}
      </p>

      <div className="souscrire-choix">
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
              <span>{t(o.plage)}</span>
            </button>
          ))}
        </div>

        <div className="tarifs-bascule souscrire-rythme" role="group" aria-label={t('Rythme de paiement')}>
          <button type="button" className={annuel ? '' : 'actif'} aria-pressed={!annuel} onClick={() => setAnnuel(false)}>
            {t('Par mois')}
          </button>
          <button type="button" className={annuel ? 'actif' : ''} aria-pressed={annuel} onClick={() => setAnnuel(true)}>
            {t('À l’année')}
          </button>
        </div>

        <div className="souscrire-total">
          <strong>{euros(annuel ? offre.an : offre.mois)}</strong>
          <span>
            {TVA_APPLICABLE
              ? (annuel ? t('HT par an, pour un magasin') : t('HT par mois, pour un magasin'))
              : (annuel ? t('par an, pour un magasin') : t('par mois, pour un magasin'))}
          </span>
          {/* ⚠️ CE QUI S'AFFICHE ICI EST LE MONTANT RÉELLEMENT PRÉLEVÉ, et
              c'est le seul endroit du site où on le dit. Annoncer un hors
              taxes jusqu'au bout ferait découvrir l'écart sur le relevé
              bancaire.
              En franchise de TVA il n'y a pas d'écart à annoncer : le prix
              affiché est le prix payé, et c'est la mention réglementaire qui
              prend la place du « soit … TTC ». */}
          <span className="souscrire-ttc">
            {TVA_APPLICABLE
              ? t('soit %{prix} TTC, TVA 20 % incluse', { prix: euros(ttc(annuel ? offre.an : offre.mois)) })
              : t(MENTION_TVA)}
          </span>
          <em>
            {annuel
              ? t('Vous économisez %{prix} par rapport au paiement mensuel. L’année est due jusqu’à son terme.', { prix: euros(economie(offre)) })
              : t('Sans engagement : vous arrêtez quand vous voulez. À l’année, vous économiseriez %{prix}.', { prix: euros(economie(offre)) })}
          </em>
        </div>
      </div>

      <div className="souscrire-champs">
        <div className="field">
          <label htmlFor="companyName">{t('Nom de votre entreprise')}</label>
          <input id="companyName" required maxLength={80} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="storeName">{t('Nom du magasin à équiper')}</label>
          <input id="storeName" required maxLength={80} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="firstName">{t('Votre prénom')}</label>
          <input id="firstName" required maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lastName">{t('Votre nom')}</label>
          <input id="lastName" required maxLength={80} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field souscrire-large">
          <label htmlFor="email">{t('Votre adresse e-mail professionnelle')}</label>
          <input id="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="souscrire-aide">
            {t('C’est votre identifiant, et l’adresse qui recevra vos accès.')}
          </span>
        </div>
      </div>

      {erreur && (
        <p className={saitQuoiFaire ? 'souscrire-erreur douce' : 'souscrire-erreur'} role="alert">
          {erreur}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={envoi}>
        {envoi
          ? t('Ouverture du paiement…')
          : t('Payer %{prix} et créer mon espace', { prix: `${euros(ttc(annuel ? offre.an : offre.mois))}${TVA_APPLICABLE ? ' TTC' : ''}` })}
      </button>
      <p className="souscrire-note">
        {t('Paiement par carte, sur la page sécurisée de Stripe. Nous ne voyons jamais votre numéro de carte.')} <Link href={lien('/tarifs')}>{t('Revoir les offres')}</Link>
      </p>

      <MentionCollecte finalite={t('traiter votre souscription, créer votre espace et vous adresser vos accès')} />
    </form>
  )
}

export function PageSouscrire() {
  const { t, langue, lien } = useTraduction()
  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="section souscrire-section">
          <div className="container">
            {/* ⚠️ FERMÉE TANT QUE LA SOCIÉTÉ N'EST PAS IMMATRICULÉE (Julien,
                5 septembre 2026). `venteOuverte()` suit `mentionsCompletes()` :
                remplir `web/lib/legal.ts` rouvre la boutique tout seul. Et la
                fonction edge refuse aussi — une porte fermée à l'écran
                seulement s'ouvre avec une adresse. */}
            {venteOuverte() ? (
              <Suspense fallback={<div className="card souscrire"><p>{t('Chargement…')}</p></div>}>
                <Formulaire />
              </Suspense>
            ) : (
              <div className="card souscrire">
                <h1>{t('La souscription en ligne ouvre bientôt')}</h1>
                {/* ⚠️ La promesse et l'adresse voyagent ensemble : sans
                    `NEXT_PUBLIC_CONTACT_EMAIL`, la page inviterait à écrire
                    sans dire où. Règle du 22 août 2026. */}
                <p className="muted">
                  {t('Nos tarifs sont publics et le produit fonctionne — mais le règlement en ligne n’est pas encore ouvert.')}
                  {ecrivezNous()
                    ? <> {t('Écrivez-nous : nous ouvrons vos accès à la main, avec la même offre.')}</>
                    : <> {t('Il ouvre très bientôt.')}</>}
                </p>
                {ecrivezNous() && <p className="ins-adresse">{CONTACT_EMAIL}</p>}
                <Link href={lien('/tarifs')} className="btn btn-ghost btn-block">{t('Voir les offres')}</Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter langue={langue} />
    </>
  )
}
