'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'
import { formaterSiren, messageSiren, normaliserSiren, sirenValide } from '@/lib/siren'
import { MagasinSaisie, nombreOuNull, type SaisieMagasin } from '@/components/MagasinSaisie'
import { TVA_APPLICABLE, euros, prixCents } from '@/lib/offres'
import { type ResultatRegistre, chercherParSiren, lieuCourt } from '@/lib/registre'

/**
 * Demande d'inscription d'une entreprise — première étape du parcours.
 *
 * Rien n'est créé ici : le formulaire dépose une demande que l'administrateur
 * Quantinvo devise, facture, puis transforme en entreprise et magasins. Les
 * codes ne sont générés qu'après encaissement, dans la console admin.
 *
 * ⚠️ **Ce qui se déclare a changé le 2 septembre 2026 : le nombre d'appareils
 * qui comptent en même temps, magasin par magasin.** Le stock théorique et la
 * surface ont quitté la page — ils ne tarifent plus rien depuis que la grille
 * est passée aux trois offres (30 août, hypothèse 4), et un chiffre qui ne
 * pèse plus sur le prix n'a rien à faire dans un formulaire public.
 *
 * Cela se déclare magasin par magasin, jamais globalement : un entrepôt qui
 * compte à trente et une boutique qui compte à deux ne prennent pas la même
 * offre, donc un total serait inexploitable.
 *
 * ⚠️ **Et le tarif s'affiche de nouveau**, ce qui renverse la décision du
 * 22 août. Elle valait contre un chiffre déclaré et invérifiable ; le nombre
 * d'appareils se mesure, et les trois prix sont publics sur /tarifs. Le
 * raisonnement complet est en tête de `components/MagasinSaisie`.
 */

// La carte de saisie vit dans `components/MagasinSaisie` : la demande d'ajout
// de magasin (espace connecté) présente exactement le même formulaire.
type MagasinSaisi = SaisieMagasin & { cle: number }

/** Au-delà, saisir ligne à ligne n'a plus de sens : on propose un tableau. */
const SEUIL_RESEAU = 6

/**
 * Exemple de format affiché dans le champ SIREN.
 *
 * **Il ne passe volontairement pas la clé de Luhn.** Un exemple valide
 * désignerait une vraie entreprise : le registre en renverrait la raison
 * sociale, qui est un nom de personne physique dans le cas d'un entrepreneur
 * individuel. Un placeholder est un exemple de format, il ne doit désigner
 * personne. C'est aussi celui qu'utilisent les modèles de devis et de facture.
 */
const SIREN_EXEMPLE = '123 456 789'

/**
 * Première ligne, identique côté serveur et côté client.
 *
 * Un compteur au niveau du module ne conviendrait pas : il est partagé entre
 * le rendu serveur et le rendu client, les identifiants de champ sortaient
 * donc différents des deux côtés et React refusait d'hydrater la page. Les
 * clés suivantes viennent d'un `useRef`, et les identifiants se dérivent de
 * `useId()` et de l'index — stables par construction.
 */
const PREMIER_MAGASIN: MagasinSaisi = { cle: 0, nom: '', appareils: '' }


/**
 * Ce que le registre public répond, sous le champ SIREN.
 *
 * Trois états à distinguer, et le troisième compte autant que les deux autres :
 * une société trouvée, une société introuvable, et un registre injoignable.
 * Confondre les deux derniers ferait dire « cette société n'existe pas » à une
 * simple coupure réseau, ce qui découragerait une demande légitime.
 *
 * Le champ `dirigeants` de la réponse — les noms des personnes physiques — n'est
 * jamais lu (voir `web/lib/registre.ts`). Rien de ce qui s'affiche ici n'est une
 * donnée personnelle.
 */
function BlocRegistre({ resultat, enCours }: { resultat: ResultatRegistre | null; enCours: boolean }) {
  if (enCours) {
    return <p className="field-hint">Consultation du registre…</p>
  }
  if (!resultat) return null

  if (resultat.etat === 'indisponible') {
    return (
      <p className="field-hint">
        Le registre public ne répond pas pour le moment. Ce n’est pas bloquant : envoyez votre
        demande, nous vérifierons de notre côté.
      </p>
    )
  }

  if (resultat.etat === 'introuvable') {
    return (
      <p className="field-alert">
        Aucune entreprise trouvée à ce numéro au registre public. Vérifiez la saisie — ou
        envoyez quand même votre demande si vous êtes sûr de vous.
      </p>
    )
  }

  const { fiche } = resultat
  const lieu = lieuCourt(fiche)
  return (
    <div className={fiche.active ? 'registre' : 'registre registre-ko'}>
      <div className="registre-line">
        <span className="registre-raison">{fiche.raisonSociale}</span>
        <span className="registre-pill">{fiche.active ? 'Active' : 'Cessée'}</span>
      </div>
      {(lieu || fiche.ape) && (
        <p className="registre-detail">
          {[lieu, fiche.ape ? `APE ${fiche.ape}` : null].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}

export default function CompanyRequestPage() {
  const [companyName, setCompanyName] = useState('')
  const [siren, setSiren] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [magasins, setMagasins] = useState<MagasinSaisi[]>(() => [PREMIER_MAGASIN])
  const cleSuivante = useRef(1)
  const uid = useId()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  // Somme des offres, DANS LES DEUX RYTHMES, quand chaque magasin porte un
  // nombre d'appareils. Un seul magasin sans chiffre et il n'y a plus
  // d'estimation à donner : un total partiel se lirait comme un total.
  const total = (rythme: 'monthly' | 'yearly'): number | null => {
    const prix = magasins.map((m) => prixCents(nombreOuNull(m.appareils), rythme))
    return prix.some((p) => p === null) ? null : prix.reduce<number>((t, p) => t + (p ?? 0), 0)
  }
  const parMois = total('monthly')
  const parAn = total('yearly')

  const alerteSiren = messageSiren(siren)
  const sirenOk = siren.length > 0 && sirenValide(siren)
  const [registre, setRegistre] = useState<ResultatRegistre | null>(null)
  const ape = registre?.etat === 'trouve' ? (registre.fiche.ape ?? '') : ''
  const [consultation, setConsultation] = useState(false)
  const nomRempliDuRegistre = useRef(false)

  /**
   * Consultation du registre, dès que les neuf chiffres sont plausibles.
   *
   * La clé de Luhn passe d'abord, côté client : on n'interroge jamais le
   * registre sur un numéro dont on sait déjà qu'il est faux. La requête est
   * annulée si la saisie change entre-temps, et une panne du registre laisse le
   * formulaire parfaitement utilisable — vérifier l'existence d'une société est
   * un confort, pas une condition pour déposer une demande.
   */
  useEffect(() => {
    if (!sirenOk) {
      setRegistre(null)
      setConsultation(false)
      return
    }
    const controleur = new AbortController()
    setConsultation(true)
    chercherParSiren(siren, { signal: controleur.signal })
      .then((r) => {
        if (controleur.signal.aborted) return
        setRegistre(r)
        // Le nom est proposé, jamais imposé : une enseigne diffère souvent de
        // la raison sociale, et la personne doit pouvoir la corriger. On ne
        // remplit donc que si le champ est vide, ou si son contenu vient
        // lui-même d'une consultation précédente.
        if (r.etat === 'trouve' && (companyName.trim() === '' || nomRempliDuRegistre.current)) {
          setCompanyName(r.fiche.raisonSociale)
          nomRempliDuRegistre.current = true
        }
      })
      .finally(() => {
        if (!controleur.signal.aborted) setConsultation(false)
      })
    return () => controleur.abort()
    // `companyName` est volontairement absent : le relire ici relancerait la
    // consultation à chaque frappe dans le champ du nom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siren, sirenOk])

  function ajouter() {
    const cle = cleSuivante.current
    cleSuivante.current += 1
    setMagasins((liste) => [...liste, { cle, nom: '', appareils: '' }])
  }

  function modifier(cle: number, champ: keyof MagasinSaisi, valeur: string) {
    setMagasins((liste) => liste.map((m) => (m.cle === cle ? { ...m, [champ]: valeur } : m)))
  }

  function retirer(cle: number) {
    setMagasins((liste) => (liste.length > 1 ? liste.filter((m) => m.cle !== cle) : liste))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Le SIREN reste facultatif — quelqu'un peut ne pas l'avoir sous la main —
    // mais s'il est commencé, il doit être complet et juste.
    if (siren.length > 0 && !sirenValide(siren)) {
      setError('Vérifiez le SIREN, ou laissez le champ vide si vous ne l’avez pas sous la main.')
      return
    }
    if (magasins.length < 1 || magasins.length > 500) {
      setError('Indiquez entre 1 et 500 magasins.')
      return
    }

    setLoading(true)
    const stores = magasins.map((m) => ({
      name: m.nom,
      devices: m.appareils === '' ? null : nombreOuNull(m.appareils),
    }))
    // Par l'edge function, qui prévient le prospect et Quantinvo ; repli sur
    // la RPC directe si elle est injoignable — la demande passe alors sans
    // e-mail, plutôt que de ne pas passer.
    let { data, error: rpcError } = await supabase.functions.invoke('submit-company-request', {
      body: {
        companyName, firstName, lastName, email, phone,
        storeCount: magasins.length, message,
        siren: normaliserSiren(siren), ape, stores,
      },
    })
    if (rpcError) {
      ;({ data, error: rpcError } = await supabase.rpc('submit_company_request', {
        p_company_name: companyName,
        p_first_name: firstName,
        p_last_name: lastName,
        p_email: email,
        p_phone: phone,
        p_store_count: magasins.length,
        p_message: message,
        p_siren: normaliserSiren(siren),
        p_ape: ape,
        p_stores: stores,
      }))
    }
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
      <div className="auth-card auth-card-large">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Inscrire mon entreprise</h1>
          <p className="sub">Nous revenons vers vous avec un devis adapté à chacun de vos magasins.</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="siren">SIREN de l&apos;entreprise</label>
            <input
              id="siren"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              value={formaterSiren(siren)}
              onChange={(e) => setSiren(normaliserSiren(e.target.value))}
              placeholder={SIREN_EXEMPLE}
              aria-describedby="siren-aide"
              aria-invalid={alerteSiren ? true : undefined}
            />
            <p className="field-hint" id="siren-aide">
              Neuf chiffres, sur vos factures ou vos statuts. Nous vérifions le reste sur le
              registre public — aucun Kbis à fournir.
            </p>
            {alerteSiren && <p className="field-alert">{alerteSiren}</p>}
            <BlocRegistre resultat={registre} enCours={consultation} />
          </div>

          <div className="field">
            <label htmlFor="company">Nom de l&apos;entreprise</label>
            <input
              id="company"
              maxLength={80}
              value={companyName}
              onChange={(e) => {
                nomRempliDuRegistre.current = false
                setCompanyName(e.target.value)
              }}
              placeholder="ACME Retail"
            />
            {nomRempliDuRegistre.current && companyName !== '' && (
              <p className="field-hint">
                Repris du registre. Corrigez-le si votre enseigne diffère de la raison sociale.
              </p>
            )}
          </div>

          <div className="field-duo">
            <div className="field">
              <label htmlFor="firstName">Prénom du contact</label>
              <input id="firstName" maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marie" />
            </div>
            <div className="field">
              <label htmlFor="lastName">Nom du contact</label>
              <input id="lastName" maxLength={80} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Durand" />
            </div>
          </div>

          <div className="field-duo">
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marie.durand@acme.fr" />
            </div>
            <div className="field">
              <label htmlFor="phone">Téléphone</label>
              <input id="phone" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 23 45 67 89" />
            </div>
          </div>

          <div className="field">
            <div className="magasins-head">
              <span className="magasins-lab">Vos magasins</span>
              <span className="magasins-cnt">
                {magasins.length} magasin{magasins.length > 1 ? 's' : ''}
              </span>
            </div>

            {magasins.map((m, i) => (
              <MagasinSaisie
                key={m.cle}
                numero={i + 1}
                valeur={m}
                idPrefix={`${uid}-${i}`}
                onChange={(champ, valeur) => modifier(m.cle, champ, valeur)}
                onRetirer={magasins.length > 1 ? () => retirer(m.cle) : undefined}
              />
            ))}

            <button type="button" className="magasin-add" onClick={ajouter}>
              + Ajouter un magasin
            </button>

            {magasins.length >= SEUIL_RESEAU && (
              <p className="magasin-reseau">
                Beaucoup de magasins ? Renseignez-en deux ou trois, et dites-le nous en fin de
                formulaire : nous vous enverrons un tableau à remplir plutôt que de vous faire
                tout saisir ici.
              </p>
            )}

            <p className="field-hint">Un code d&apos;accès sera généré pour chaque magasin.</p>
          </div>

          {/* L'estimation, quand tous les magasins sont renseignés. Elle dit
              qu'elle est une estimation : le montant qui engage est celui du
              devis, et il se négocie — surtout sur un réseau. */}
          <p className="devis-note">
            {parMois === null || parAn === null ? (
              <>
                La licence est par magasin, calée sur le nombre d’appareils qui comptent en même
                temps. Inventaires et comptages illimités.
              </>
            ) : (
              <>
                Estimation pour {magasins.length} magasin{magasins.length > 1 ? 's' : ''} :{' '}
                <strong className="prix">{euros(parMois / 100)} par mois</strong> ou{' '}
                <strong className="prix">{euros(parAn / 100)} par an</strong>{TVA_APPLICABLE ? ', hors taxes' : ''}. Nous revenons vers vous
                avec un devis — sur un réseau, il se discute.
              </>
            )}
          </p>

          <div className="field">
            <label htmlFor="message">Votre besoin (facultatif)</label>
            <textarea
              id="message"
              rows={3}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Échéance, contraintes, nombre de magasins si le réseau est grand…"
            />
          </div>

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
          <MentionCollecte finalite="traiter votre demande d’inscription, vous adresser un devis et vous recontacter à son sujet" />
        </form>

        <div className="center-link">
          <Link href="/login">J&apos;ai déjà un compte</Link>
        </div>
        <div className="center-link">
          <Link href="/">← Retour à l&apos;accueil</Link>
        </div>
      </div>
    </div>
  )
}
