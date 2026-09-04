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

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { euros } from '@/lib/offres'

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
      {/* ⚠️ LES DEUX RYTHMES S'AFFICHENT. Un client qui ne lit qu'un montant
          annuel n'a aucun moyen de savoir que le mensuel existe. Même paire que
          la page publique des tarifs. */}
      <div className="payer-rythmes" role="radiogroup" aria-label="Rythme de paiement">
        {(['monthly', 'yearly'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={rythme === r}
            className={`payer-rythme${rythme === r ? ' est-choisi' : ''}`}
            onClick={() => setRythme(r)}
          >
            <span className="payer-rythme-nom">{r === 'monthly' ? 'Au mois' : 'À l’année'}</span>
            <span className="prix">{euros(r === 'monthly' ? offre.mois : offre.an)}</span>
          </button>
        ))}
      </div>

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
export function ReprendrePaiement({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function reprendre() {
    setBusy(true)
    setErreur(null)
    const { data, error } = await supabase.functions.invoke('libre-service', {
      body: { action: 'reprendre', requestId },
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
    <>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={reprendre}>
        {busy ? 'Un instant…' : 'Reprendre le paiement'}
      </button>
      {erreur && <p className="field-hint" role="alert" style={{ marginTop: 8 }}>{erreur}</p>}
    </>
  )
}
