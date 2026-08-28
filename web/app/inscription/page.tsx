'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'
import { formaterSiren, messageSiren, normaliserSiren, sirenValide } from '@/lib/siren'
import { MagasinSaisie, nombreOuNull, type SaisieMagasin } from '@/components/MagasinSaisie'
import { type ResultatRegistre, chercherParSiren, lieuCourt } from '@/lib/registre'

/**
 * Demande d'inscription d'une entreprise — première étape du parcours.
 *
 * Rien n'est créé ici : le formulaire dépose une demande que l'administrateur
 * Quantinvo devise, facture, puis transforme en entreprise et magasins. Les
 * codes ne sont générés qu'après encaissement, dans la console admin.
 *
 * Deux choses se déclarent magasin par magasin, et pas globalement :
 *
 * - le **stock théorique en unités**, parce que la tranche tarifaire s'applique
 *   à chaque magasin. Trois magasins de 60 000 unités ne se tarifent pas comme
 *   un de 180 000, donc un total serait inexploitable ;
 * - la **surface de vente**, qui ne tarife rien. Elle sert à recouper une
 *   déclaration que le Service ne sait pas vérifier lui-même (article 6.4 des
 *   CGV). Le recoupement **ne s'affiche jamais ici** : sur un formulaire public
 *   il reviendrait à soupçonner le prospect avant le devis, et surtout à lui
 *   indiquer quel chiffre ajuster. Il vit dans la console d'administration.
 *
 * ⚠️ **Le tarif ne s'affiche plus** (décision de Julien, 22 août 2026, qui
 * renverse celle du 21). La page montrait la tranche de chaque magasin à la
 * frappe et une estimation annuelle en pied de formulaire. C'était indiquer au
 * prospect, pendant qu'il déclarait un chiffre invérifiable, exactement de
 * combien le baisser pour changer de tranche — le même raisonnement qui tient
 * le recoupement stock / surface hors de cette page, appliqué au prix lui-même.
 * Le montant se lit sur le devis, établi par Quantinvo.
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
const PREMIER_MAGASIN: MagasinSaisi = { cle: 0, nom: '', stock: '', surface: '' }


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
    setMagasins((liste) => [...liste, { cle, nom: '', stock: '', surface: '' }])
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
      units: m.stock === '' ? null : nombreOuNull(m.stock),
      sqm: m.surface === '' ? null : nombreOuNull(m.surface),
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

          {/* Pas d'estimation chiffrée : voir l'en-tête de `MagasinSaisie`. Le
              montant se lit sur le devis, pas en face du champ qui le
              détermine. */}
          <p className="devis-note">
            Votre devis est établi à partir de ces informations. La licence est annuelle,
            par magasin, comptages et compteurs illimités.
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
