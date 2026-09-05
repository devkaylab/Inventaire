'use client'

/**
 * Payer en ligne — le libre-service (4 septembre 2026).
 *
 * Julien : « nous avons une offre claire aujourd'hui, plus besoin de passer par
 * un devis pour quoi que ce soit. » Deux écrans s'en servent, et ils achètent
 * la même chose de la même façon :
 *   · la fiche d'un magasin, pour élargir son forfait ;
 *   · la page Magasins, pour en ajouter un.
 *
 * ⚠️ UNE SEULE DÉFINITION, PARCE QUE C'EST UN SEUL GESTE. Deux panneaux de
 * paiement divergeraient au premier ajustement — et c'est le chemin de
 * l'argent : ce qui diverge là se paie en euros.
 *
 * ⚠️ AUCUN REPLI SUR UNE RPC DIRECTE, contrairement à la demande de magasin
 * d'avant. C'est la règle posée pour `/souscrire` le 30 août : sans la fonction
 * edge il n'y a pas de session Stripe, donc rien à payer — déposer la demande
 * quand même laisserait quelqu'un persuadé d'avoir souscrit.
 */

import { useId, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { euros } from '@/lib/offres'
import { compositionOffre, proposer } from '@/lib/appareils'
import { nombreOuNull } from '@/components/MagasinSaisie'
import { nb } from '@/lib/format'

export type OffreAPayer = {
  /** Le nom du palier — il vient d'`OFFRES`, jamais réinventé ici. */
  nom: string
  /** Le nombre d'appareils que ce palier couvre. */
  couvre: number
  /** Hors taxes, par magasin. */
  mois: number
  an: number
}

type Props = {
  offre: OffreAPayer
  /**
   * Le geste, tel que la fonction edge l'attend — sans le rythme, que ce
   * panneau ajoute. `{ action: 'offre', storeId, devices }` ou
   * `{ action: 'magasin', name, devices }`.
   */
  corps: Record<string, unknown>
  /**
   * ⚠️ LE BOUTON DIT L'ACTION, JAMAIS LE MONTANT (Julien, 4 septembre 2026).
   * « Passer à Advanced », « Créer le magasin » — jamais « Payer 310 € et… » :
   * le prix est écrit juste au-dessus, le répéter alourdit et fait douter de ce
   * que le bouton déclenche.
   */
  libelle: string
  disabled?: boolean
  /** Rejoué quand le changement a pris effet sans passer par une page de paiement. */
  onApplique?: () => void
}

/**
 * Le choix de l'échéance, avec ses deux prix.
 *
 * ⚠️ LES DEUX RYTHMES S'AFFICHENT, EN DEUX BOUTONS ET NON UN MENU DÉROULANT.
 * Un client qui ne lit qu'un montant annuel n'a aucun moyen de savoir que le
 * mensuel existe ; et un menu cacherait les deux prix jusqu'au clic, alors que
 * c'est justement la comparaison qu'on veut rendre facile. Même paire que la
 * page publique des tarifs.
 */
function ChoixRythme({
  offre, valeur, onChange,
}: {
  offre: OffreAPayer
  valeur: 'monthly' | 'yearly'
  onChange: (r: 'monthly' | 'yearly') => void
}) {
  return (
    <div className="payer-rythmes" role="radiogroup" aria-label="Rythme de paiement">
      {(['monthly', 'yearly'] as const).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={valeur === r}
          className={`payer-rythme${valeur === r ? ' est-choisi' : ''}`}
          onClick={() => onChange(r)}
        >
          <span className="payer-rythme-nom">{r === 'monthly' ? 'Au mois' : 'À l’année'}</span>
          <span className="prix">{euros(r === 'monthly' ? offre.mois : offre.an)}</span>
        </button>
      ))}
    </div>
  )
}

export function PayerEnLigne({ offre, corps, libelle, disabled, onApplique }: Props) {
  const [rythme, setRythme] = useState<'monthly' | 'yearly'>('monthly')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fait, setFait] = useState(false)

  async function payer() {
    setBusy(true)
    setErreur(null)
    const { data, error } = await supabase.functions.invoke('libre-service', {
      body: { ...corps, billingPeriod: rythme },
    })

    // ⚠️ Sur un refus, `invoke` rend une erreur et JETTE le corps — or c'est
    // là que vit le message utile (« votre forfait couvre déjà 20 appareils »,
    // « pas encore ouvert »). On le relit sur la réponse portée par l'erreur.
    let reponse: Record<string, unknown> | null = (data ?? null) as Record<string, unknown> | null
    const ctx = (error as { context?: unknown } | null)?.context
    if (ctx instanceof Response) {
      try {
        reponse = await ctx.json()
      } catch {
        /* corps illisible : on garde le message générique ci-dessous */
      }
    }
    setBusy(false)

    if (reponse?.success !== true) {
      setErreur(
        (reponse?.error as string | undefined) ??
          error?.message ??
          'Le changement n’a pas pu se faire. Réessayez dans un instant.',
      )
      return
    }

    if (typeof reponse.paymentUrl === 'string') {
      window.location.href = reponse.paymentUrl
      return
    }
    // Chemin d'API : l'abonnement a été modifié, Stripe a facturé le prorata.
    setFait(true)
    onApplique?.()
  }

  if (fait) {
    return (
      <p className="signal-txt small" role="status">
        C’est fait. Votre abonnement couvre maintenant {offre.couvre} appareils.
      </p>
    )
  }

  return (
    <div className="payer-ligne">
      <ChoixRythme offre={offre} valeur={rythme} onChange={setRythme} />

      <button type="button" className="btn btn-primary btn-sm" disabled={busy || disabled} onClick={payer}>
        {busy ? 'Un instant…' : libelle}
      </button>

      {erreur && (
        // ⚠️ Le refus reste SOUS le bouton, il ne part pas en notification qui
        // s'efface : il dit souvent quoi faire, et on le relit.
        <p className="field-hint" role="alert" style={{ marginTop: 8 }}>{erreur}</p>
      )}
    </div>
  )
}

/**
 * Reprendre un paiement abandonné.
 *
 * ⚠️ Une demande en `accepted` sans paiement est NORMALE : une session Checkout
 * dure vingt-quatre heures, et fermer l'onglet est le geste le plus banal du
 * monde. Sans ce bouton, le client ne peut ni payer, ni recommencer (le doublon
 * de nom refuse sa seconde demande) — trois portes fermées d'un coup, constat
 * de Julien le 4 septembre 2026.
 *
 * Il ne redépose rien : ce qu'on achète est relu sur la demande, côté serveur.
 */
export function ReprendrePaiement({
  requestId, devices, billingPeriod,
}: {
  requestId: string
  /** Les appareils déjà déposés — ils donnent l'offre, donc les deux prix. */
  devices?: number | null
  billingPeriod?: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [rythme, setRythme] = useState<'monthly' | 'yearly'>(
    billingPeriod === 'yearly' ? 'yearly' : 'monthly',
  )
  // ⚠️ Le même calcul que partout ailleurs — deux lectures du même palier
  // divergeraient au premier ajustement de la grille.
  const offre = devices && devices > 0 ? proposer(0, Math.round(devices)) : null

  async function reprendre() {
    setBusy(true)
    setErreur(null)
    const { data, error } = await supabase.functions.invoke('libre-service', {
      // ⚠️ Le rythme voyage, et LUI SEUL : le serveur recalcule le montant
      // depuis les appareils déjà déposés. Le client choisit une échéance, pas
      // un prix.
      body: { action: 'reprendre', requestId, billingPeriod: rythme },
    })
    let reponse: Record<string, unknown> | null = (data ?? null) as Record<string, unknown> | null
    const ctx = (error as { context?: unknown } | null)?.context
    if (ctx instanceof Response) {
      try {
        reponse = await ctx.json()
      } catch {
        /* corps illisible */
      }
    }
    setBusy(false)
    if (reponse?.success === true && typeof reponse.paymentUrl === 'string') {
      window.location.href = reponse.paymentUrl
      return
    }
    setErreur(
      (reponse?.error as string | undefined) ??
        error?.message ??
        'Le paiement n’a pas pu se rouvrir. Réessayez dans un instant.',
    )
  }

  return (
    <div className="payer-ligne">
      {/* Changer d'échéance ici évite d'annuler la demande et de tout refaire
          (Julien, 4 septembre 2026) : ce qu'on achète ne change pas. */}
      {offre && <ChoixRythme offre={offre} valeur={rythme} onChange={setRythme} />}
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={reprendre}>
        {busy ? 'Un instant…' : 'Reprendre le paiement'}
      </button>
      {erreur && <p className="field-hint" role="alert" style={{ marginTop: 8 }}>{erreur}</p>}
    </div>
  )
}

/**
 * Choisir une autre offre — À TOUT MOMENT, pas seulement après un refus.
 *
 * ⚠️ CE PANNEAU FERME LE SEUL CUL-DE-SAC QUI RESTAIT AU LIBRE-SERVICE.
 * Constat de Julien, 5 septembre 2026 : *« sur le site je ne vois nulle part
 * où je peux upgrade mon abonnement »*. Il avait raison, et ce n'était pas un
 * défaut d'affichage : le panneau de paiement n'apparaissait que sous la
 * condition `verdict.etat === 'depasse'`, c'est-à-dire **une fois qu'un
 * appareil avait été éconduit**.
 *
 * Autrement dit, on n'avait construit que le chemin de la RÉACTION — être
 * bloqué, puis payer — et jamais celui de l'ANTICIPATION, qui est pourtant le
 * cas normal : « mon inventaire de la semaine prochaine demande douze
 * appareils, je passe à Advanced aujourd'hui ». Un client qui doit d'abord se
 * heurter au verrou pour avoir le droit d'acheter, c'est le produit qui décide
 * quand il a le droit de dépenser.
 *
 * ⚠️ IL N'AJOUTE AUCUN CHEMIN D'ACHAT. Il compose ce qui existe déjà :
 * `proposer()` pour lire la grille — jamais un montant écrit ici —, et
 * `PayerEnLigne` pour le paiement. Deux panneaux de paiement divergeraient au
 * premier ajustement, et c'est le chemin de l'argent.
 *
 * ⚠️ ET « OFFRE », JAMAIS « FORFAIT » (Julien, 5 septembre 2026, sur la
 * maquette). C'est le mot de la page Tarifs, celui des trois paliers, et celui
 * que le code emploie déjà pour ce geste (`kind = 'offre'`). Deux mots pour la
 * même chose dans la même carte font douter qu'il s'agisse de la même chose.
 */
export function ChangerOffre({
  storeId, plafond, invite, libelle, onApplique,
}: {
  storeId: string
  /** Ce que l'offre payée couvre aujourd'hui. Nul quand aucune n'est connue. */
  plafond: number | null
  /** La phrase qui précède le bouton — elle diffère selon qu'on est à l'aise
      dans son offre ou qu'on vient de s'y heurter. */
  invite: string
  libelle: string
  onApplique?: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [saisie, setSaisie] = useState('')
  const uid = useId()

  const brut = nombreOuNull(saisie)
  const devices = brut != null && brut > 0 ? Math.round(brut) : null
  // ⚠️ Le serveur refuse déjà ce cas (`deja_couvert`), et l'écran le dit AVANT :
  // découvrir après avoir cliqué qu'il n'y avait rien à acheter est le genre de
  // refus qui fait douter du bouton. La borne haute, elle, reste au serveur —
  // c'est une règle de grille, on n'en fait pas une copie de plus.
  const dejaCouvert = devices != null && plafond != null && devices <= plafond
  const offre = devices != null && !dejaCouvert ? proposer(0, devices) : null
  const composition = offre ? compositionOffre(offre) : null

  if (!ouvert) {
    return (
      <div className="offre-pied">
        <span className="muted small">{invite}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOuvert(true)}>
          {libelle}
        </button>
      </div>
    )
  }

  return (
    <div className="offre-pied-ouvert">
      <div className="field offre-champ">
        <label htmlFor={`${uid}-appareils`}>Appareils qui comptent en même temps</label>
        <input
          id={`${uid}-appareils`}
          type="number"
          min={1}
          step={1}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={String((plafond ?? 2) + 1)}
        />
        <p className="field-hint">
          {plafond == null
            ? 'Ce magasin n’a pas encore d’offre en appareils.'
            : `Votre offre en couvre ${nb(plafond)} aujourd’hui.`}
        </p>
      </div>

      {dejaCouvert && (
        <p className="field-hint" role="status">
          Votre offre couvre déjà {nb(plafond ?? 0)} appareils&nbsp;: il n’y a rien à changer.
        </p>
      )}

      {offre && (
        <>
          <p className="muted small offre-resume">
            <strong>{offre.nom}</strong> couvre {nb(offre.couvre)} appareils à la fois
            {/* La page Stripe décompose en deux lignes dès qu'on sort d'un
                palier : si notre écran ne le dit pas, le « Qté 4 » s'y
                découvre sans prévenir. Et une tranche entamée se paie
                entière — 137 demandés, 140 couverts. */}
            {composition ? ` — ${composition}` : ''}.
          </p>
          <PayerEnLigne
            offre={offre}
            corps={{ action: 'offre', storeId, devices }}
            libelle={offre.action}
            onApplique={onApplique}
          />
        </>
      )}

      <div className="inline-form" style={{ marginTop: 10 }}>
        <button type="button" className="link-btn" onClick={() => { setOuvert(false); setSaisie('') }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
