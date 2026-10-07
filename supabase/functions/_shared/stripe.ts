// Stripe, sans SDK : deux appels et une signature.
//
// Le SDK officiel pèse lourd dans une fonction edge et n'apporte rien ici —
// on crée une session Checkout, et on vérifie la signature d'un webhook. Deux
// fonctions, écrites sur l'API HTTP, qui se lisent en entier.
//
// ⚠️ La vérification de signature est **ce qui protège toute la chaîne** :
// le webhook est déployé sans JWT (Stripe n'en envoie pas), donc n'importe qui
// peut poster sur son adresse. Sans signature valide, rien n'est lu — et le
// corps est comparé **brut**, tel que reçu, parce que c'est sur ces octets que
// Stripe a signé.

const API = 'https://api.stripe.com/v1'

/** Encode un objet en `application/x-www-form-urlencoded`, clés imbriquées comprises. */
export function formulaire(obj: Record<string, unknown>, prefixe = ''): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const cle = prefixe ? `${prefixe}[${k}]` : k
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) parts.push(formulaire(item as Record<string, unknown>, `${cle}[${i}]`))
        else parts.push(`${encodeURIComponent(`${cle}[${i}]`)}=${encodeURIComponent(String(item))}`)
      })
    } else if (typeof v === 'object') {
      parts.push(formulaire(v as Record<string, unknown>, cle))
    } else {
      parts.push(`${encodeURIComponent(cle)}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.filter(Boolean).join('&')
}

export type SessionCheckout = { id: string; url: string; customer?: string | null }

/**
 * Une session Checkout pour un devis ANNUEL.
 *
 * `mode: payment` : la licence est annuelle, facturée en une fois. Les moyens
 * de paiement proposés sont la carte et le prélèvement SEPA — le second
 * convient aux montants d'une enseigne. `invoice_creation` fait produire et
 * envoyer la facture par Stripe : c'est ce qui remplace le RIB.
 *
 * ⚠️ Un devis MENSUEL ne passe pas par ici : un mois ne se facture pas en une
 * fois, il se reconduit. Voir `creerAbonnementSurMesure`.
 *
 * ⚠️ `taxRateId` porte la TVA, et son absence coûte de l'argent : nos montants
 * sont hors taxes, donc sans lui Stripe encaisse 9 450 € là où 11 340 € sont
 * dus, et la différence sort de la poche de l'éditeur. Le devis lui-même le dit
 * (« TVA non applicable sur ce document — le montant hors taxes fait foi ») :
 * c'est la facture qui l'ajoute. Ce paramètre a été ajouté le 2 septembre
 * 2026 ; il manquait depuis la mise en place de Stripe, et seule la
 * souscription en ligne l'avait.
 *
 * La clé d'idempotence est l'identifiant de la demande : un second appel
 * pour la même demande rend la même session, jamais deux.
 */
export async function creerSessionCheckout(
  cle: string,
  p: {
    requestId: string
    kind: 'company' | 'store'
    amountCents: number
    label: string
    description: string
    customerEmail: string
    reference: string
    successUrl: string
    cancelUrl: string
    /** Le taux de TVA à appliquer (`txr_…`). Sans lui, rien n'est facturé en sus. */
    taxRateId?: string | null
    /** Change quand la session précédente est expirée : sinon la clé
        d'idempotence rendrait la session morte. */
    tentative?: number
  },
): Promise<SessionCheckout> {
  const corps = formulaire({
    mode: 'payment',
    customer_email: p.customerEmail,
    customer_creation: 'always',
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: p.amountCents,
        product_data: { name: p.label, description: p.description },
      },
      ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
    }],
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: `Devis ${p.reference} — licence annuelle Quantinvo`,
        metadata: { request_id: p.requestId, kind: p.kind, reference: p.reference },
      },
    },
    metadata: { request_id: p.requestId, kind: p.kind, reference: p.reference },
    client_reference_id: p.requestId,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    locale: 'fr',
    billing_address_collection: 'required',
    // Pas d'`expires_at` calculé ici : il changerait à chaque seconde, et
    // Stripe refuse une clé d'idempotence rejouée avec d'autres paramètres.
    // Le défaut de Stripe (24 h) convient ; la session se relit par son
    // identifiant tant qu'elle est ouverte (`lireSessionCheckout`).
  })
  const resp = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `checkout-${p.kind}-${p.requestId}-${p.tentative ?? 0}`,
    },
    body: corps,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
  return { id: data.id, url: data.url, customer: data.customer ?? null }
}

/**
 * Une session Checkout pour un ABONNEMENT (souscription en ligne, 30 août 2026).
 *
 * Trois différences avec la précédente, et chacune compte :
 *
 * - `mode: subscription`, et le montant n'est PAS envoyé : il vient du Price
 *   posé dans le tableau de bord Stripe. ⚠️ Les Prices ne sont jamais créés à
 *   la volée — un prix créé par du code est un prix que personne n'a relu, et
 *   il se retrouverait facturé à un vrai client.
 * - **carte seule.** Le prélèvement SEPA convient à une facture annuelle
 *   d'enseigne, pas à un abonnement en libre-service : son délai de règlement
 *   ferait attendre l'ouverture des accès de plusieurs jours, après que la
 *   personne a cliqué « Souscrire ».
 * - pas d'`invoice_creation` : en mode abonnement Stripe produit la facture de
 *   chaque échéance sans qu'on le demande.
 *
 * ⚠️ `taxRateId` porte la TVA. Nos prix sont HORS TAXES : sans lui, Stripe
 * encaisserait 310 € au lieu de 372 €, et la TVA due sortirait de la poche de
 * l'éditeur. Le taux doit être créé dans le tableau de bord Stripe en mode
 * **exclusif** (la taxe s'ajoute au prix) — un taux inclusif ferait l'inverse,
 * il découperait 310 € en 258,33 € + TVA.
 *
 * La clé d'idempotence reste l'identifiant de la demande : un second clic
 * rouvre la même session, jamais une seconde.
 */
export async function creerAbonnementCheckout(
  cle: string,
  p: {
    requestId: string
    priceId: string
    label: string
    customerEmail: string
    successUrl: string
    cancelUrl: string
    plan: string
    billingPeriod: string
    /** Le taux de TVA à appliquer (`txr_…`). Sans lui, rien n'est facturé en sus. */
    taxRateId?: string | null
    /**
     * Le genre de demande, recopié dans les métadonnées Stripe. Il ne DÉCIDE
     * de rien — le webhook retrouve la demande par l'identifiant de session —
     * mais une facture qui dit « company » pour un changement d'offre se lit
     * mal le jour où on la rouvre.
     */
    kind?: string
    /**
     * Une seconde ligne, facultative : les appareils supplémentaires, par
     * tranche de dix au-delà du plafond d'Enterprise. Sa QUANTITÉ est le
     * nombre de tranches — c'est ce qui permet à un seul Price de porter
     * n'importe quel dépassement, sans qu'aucun montant soit fabriqué ici.
     */
    supplement?: { priceId: string; quantity: number } | null
    /**
     * Plusieurs lignes, quand l'abonnement en porte plus d'une sorte : une
     * inscription à trois magasins peut valoir deux Advanced et un Enterprise.
     *
     * ⚠️ Quand elle est fournie, elle REMPLACE `priceId` et `supplement` — on
     * ne mélange pas les deux façons de décrire la même facture. Chaque ligne
     * porte le taux de TVA comme les autres : un oubli sur une seule ligne
     * facturerait la taxe à moitié.
     */
    lignes?: { priceId: string; quantity: number }[] | null
    tentative?: number
  },
): Promise<SessionCheckout> {
  const lignes = (p.lignes && p.lignes.length > 0)
    ? p.lignes.filter((l) => l.quantity > 0).map((l) => ({
      quantity: l.quantity,
      price: l.priceId,
      ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
    }))
    : null
  const corps = formulaire({
    mode: 'subscription',
    customer_email: p.customerEmail,
    payment_method_types: ['card'],
    line_items: lignes ?? [
      {
        quantity: 1,
        price: p.priceId,
        ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
      },
      ...(p.supplement && p.supplement.quantity > 0
        ? [{
          quantity: p.supplement.quantity,
          price: p.supplement.priceId,
          ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
        }]
        : []),
    ],
    subscription_data: {
      description: p.label,
      metadata: { request_id: p.requestId, plan: p.plan, billing_period: p.billingPeriod },
    },
    metadata: {
      request_id: p.requestId,
      kind: p.kind ?? 'company',
      plan: p.plan,
      billing_period: p.billingPeriod,
    },
    client_reference_id: p.requestId,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    locale: 'fr',
    billing_address_collection: 'required',
  })
  const resp = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // ⚠️ LA CLÉ PORTE LE PRIX, ET C'EST OBLIGATOIRE DEPUIS QUE LE RYTHME SE
      // CHANGE (4 septembre 2026). Sans lui, passer du mensuel à l'annuel
      // rejouerait la clé de la session précédente : Stripe rendrait
      // l'ANCIENNE session, et le client paierait le mensuel qu'il vient de
      // quitter. Deux rythmes, deux Price, donc deux clés.
      'Idempotency-Key': `abonnement-${p.requestId}-${p.priceId}-${p.tentative ?? 0}`,
    },
    body: corps,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
  return { id: data.id, url: data.url, customer: data.customer ?? null }
}

/**
 * Une session Checkout pour un devis MENSUEL (2 septembre 2026).
 *
 * ⚠️ **C'est le seul endroit du produit où un prix Stripe est créé par du
 * code, et il faut savoir pourquoi cette exception tient.** La règle du projet
 * — « les Prices ne sont JAMAIS créés à la volée » — protège les trois offres
 * publiques : leurs montants sont fixes, relus, et posés en secrets. Un devis
 * est l'inverse : son montant est **négocié**, saisi et relu par un
 * administrateur dans la console. Aucun Price posé d'avance ne peut le porter.
 * Ce que la règle interdit vraiment, c'est un prix que personne n'a relu ; ici
 * quelqu'un l'a relu, c'est même tout l'objet du devis.
 *
 * Trois différences avec un devis annuel, et chacune compte :
 *
 * - `mode: subscription` avec un `recurring` **mensuel** : un mois ne se
 *   facture pas en une fois, il se reconduit. C'est aussi ce qui fait vivre le
 *   cycle `invoice.paid` / `payment_failed` / `subscription.deleted` déjà
 *   branché sur le webhook.
 * - **carte seule**, comme la souscription en ligne. Le prélèvement SEPA
 *   convient à une facture annuelle d'enseigne ; son délai de règlement ferait
 *   attendre l'ouverture des accès à chaque échéance.
 * - pas d'`invoice_creation` : en mode abonnement Stripe produit la facture de
 *   chaque échéance sans qu'on le demande.
 *
 * La clé d'idempotence reste l'identifiant de la demande — un second clic
 * rouvre la même session, jamais une seconde — et elle est **distincte** de
 * celle du mode paiement : les deux ne portent pas les mêmes paramètres, et
 * Stripe refuse une clé rejouée avec d'autres.
 */
export async function creerAbonnementSurMesure(
  cle: string,
  p: {
    requestId: string
    kind: 'company' | 'store'
    amountCents: number
    label: string
    description: string
    customerEmail: string
    reference: string
    successUrl: string
    cancelUrl: string
    taxRateId?: string | null
    tentative?: number
  },
): Promise<SessionCheckout> {
  const corps = formulaire({
    mode: 'subscription',
    customer_email: p.customerEmail,
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: p.amountCents,
        recurring: { interval: 'month' },
        product_data: { name: p.label },
      },
      ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
    }],
    subscription_data: {
      description: p.description,
      metadata: { request_id: p.requestId, kind: p.kind, reference: p.reference,
                  billing_period: 'monthly' },
    },
    metadata: { request_id: p.requestId, kind: p.kind, reference: p.reference,
                billing_period: 'monthly' },
    client_reference_id: p.requestId,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    locale: 'fr',
    billing_address_collection: 'required',
  })
  const resp = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `devis-mensuel-${p.kind}-${p.requestId}-${p.tentative ?? 0}`,
    },
    body: corps,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
  return { id: data.id, url: data.url, customer: data.customer ?? null }
}

/**
 * Relit une session Checkout. Rend son adresse si elle est encore ouverte,
 * `null` si elle est expirée ou déjà réglée — il faudra en ouvrir une autre.
 */
export async function lireSessionCheckout(cle: string, id: string): Promise<SessionCheckout | null> {
  const resp = await fetch(`${API}/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cle}` },
  })
  if (!resp.ok) return null
  const data = await resp.json()
  if (data.status !== 'open' || !data.url) return null
  return { id: data.id, url: data.url, customer: data.customer ?? null }
}

/**
 * La facture hébergée par Stripe : sa page (avec le PDF) et son numéro.
 *
 * Pourquoi aller la chercher : en mode test, Stripe n'envoie ses e-mails de
 * facture qu'aux membres du compte, et en live c'est un réglage du tableau de
 * bord qu'on ne peut pas vérifier depuis le code. Mettre le lien dans notre
 * propre message, c'est ne dépendre de rien.
 */
export async function lireFacture(cle: string, id: string): Promise<{ url: string; numero: string } | null> {
  const resp = await fetch(`${API}/invoices/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cle}` },
  })
  if (!resp.ok) return null
  const data = await resp.json()
  if (!data.hosted_invoice_url) return null
  return { url: data.hosted_invoice_url, numero: data.number ?? '' }
}

/**
 * Vérifie la signature `Stripe-Signature` d'un webhook et rend l'événement.
 *
 * Schéma Stripe : `t=<horodatage>,v1=<hmac-sha256(secret, "<t>.<corps>")>`.
 * Tolérance de cinq minutes sur l'horodatage, contre le rejeu d'un ancien
 * événement capturé. Comparaison en temps constant.
 */
export async function verifierWebhook(
  secret: string,
  corpsBrut: string,
  enTete: string | null,
  toleranceS = 300,
): Promise<Record<string, unknown>> {
  if (!enTete) throw new Error('signature absente')
  const parts = Object.fromEntries(
    enTete.split(',').map((p) => p.trim().split('=') as [string, string]),
  )
  const t = parts.t
  const v1 = enTete.split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3))
  if (!t || v1.length === 0) throw new Error('signature mal formée')

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t))
  if (!Number.isFinite(age) || age > toleranceS) throw new Error('signature trop ancienne')

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${corpsBrut}`)))
  const attendu = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('')

  const ok = v1.some((s) => egalConstant(s, attendu))
  if (!ok) throw new Error('signature invalide')
  return JSON.parse(corpsBrut)
}

function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * L'abonnement d'une entreprise, et ses articles.
 *
 * ⚠️ Sert au CHANGEMENT D'OFFRE d'un client qui a déjà un abonnement. On ne lui
 * ouvre pas un second Checkout : ce serait un second abonnement, et il paierait
 * les deux. On modifie celui qu'il a.
 */
export async function lireAbonnement(
  cle: string,
  id: string,
): Promise<{ id: string; statut: string; articles: { id: string; price: string; quantity: number }[] } | null> {
  const resp = await fetch(`${API}/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cle}` },
  })
  // ⚠️ ON DIT POURQUOI, ON NE REND PAS « INTROUVABLE ». Un refus de Stripe a
  // trois causes qui ne se corrigent pas du tout pareil — l'abonnement
  // n'existe pas (404), la clé n'a pas le droit de lire les abonnements (403),
  // la clé est du mauvais mode (401). Les confondre coûte une journée sur le
  // chemin de l'argent : c'est arrivé le 11 septembre 2026.
  if (!resp.ok) {
    const corps = await resp.text().catch(() => '')
    throw new Error(`GET /subscriptions ${resp.status} — ${corps.slice(0, 300)}`)
  }
  const data = await resp.json()
  return {
    id: data.id,
    statut: data.status,
    // ⚠️ La QUANTITÉ compte : une inscription à plusieurs magasins porte une
    // ligne par offre, de quantité égale au nombre de magasins (16/09/2026).
    articles: (data.items?.data ?? []).map((a: { id: string; price?: { id: string }; quantity?: number }) => ({
      id: a.id,
      price: a.price?.id ?? '',
      quantity: Number(a.quantity ?? 1),
    })),
  }
}

/**
 * Applique plusieurs changements de lignes à un abonnement, EN UN SEUL APPEL
 * (16 septembre 2026) — donc une seule facture de prorata. Les changements
 * sont calculés par `ecartAbonnement` (`_shared/cumul.ts`).
 */
export async function modifierAbonnement(
  cle: string,
  p: {
    subscriptionId: string
    items: Record<string, unknown>[]
    idempotence: string
  },
): Promise<void> {
  const corps = formulaire({
    items: p.items,
    proration_behavior: 'always_invoice',
  })
  const resp = await fetch(`${API}/subscriptions/${encodeURIComponent(p.subscriptionId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': p.idempotence,
    },
    body: corps,
  })
  if (!resp.ok) {
    const data = await resp.json().catch(() => null)
    throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
  }
}

/**
 * Échange le Price d'un article d'abonnement.
 *
 * ⚠️ `proration_behavior: 'always_invoice'` est le cœur du parcours : Stripe
 * calcule le prorata du temps déjà payé sur l'ancienne offre, l'impute sur la
 * nouvelle, et FACTURE TOUT DE SUITE la différence. Sans lui, le client
 * changerait d'offre et ne paierait rien avant sa prochaine échéance.
 *
 * ⚠️ La clé d'idempotence porte l'article ET le prix visé : un second clic sur
 * « Passer à Enterprise » rejoue exactement la même modification, jamais deux
 * prorata. Elle ne doit PAS porter d'horodatage — Stripe refuse une clé
 * rejouée avec d'autres paramètres, et le second clic n'aurait alors plus de
 * réponse.
 */
export async function changerPrixArticle(
  cle: string,
  p: { itemId: string; priceId: string; taxRateId?: string | null },
): Promise<{ id: string; price: string }> {
  const corps = formulaire({
    price: p.priceId,
    quantity: 1,
    proration_behavior: 'always_invoice',
    ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
  })
  const resp = await fetch(`${API}/subscription_items/${encodeURIComponent(p.itemId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `offre-${p.itemId}-${p.priceId}`,
    },
    body: corps,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
  return { id: data.id, price: data.price?.id ?? p.priceId }
}

/**
 * Pose, met à jour ou retire la ligne « appareils supplémentaires » d'un
 * abonnement.
 *
 * ⚠️ Trois gestes derrière une seule fonction, parce que c'est UNE décision :
 * combien de tranches de dix ce magasin doit-il porter, aujourd'hui ?
 *   · aucune tranche et pas d'article  → rien à faire ;
 *   · aucune tranche et un article     → on le SUPPRIME (le client est
 *     redescendu sous cent appareils, il ne doit plus rien payer pour eux) ;
 *   · des tranches et pas d'article    → on le crée ;
 *   · des tranches et un article       → on change sa quantité.
 *
 * Rend l'identifiant de l'article, ou la chaîne vide quand il n'y en a plus —
 * c'est ce que `appliquer_changement_offre` attend pour effacer la colonne.
 */
export async function poserArticleAppareils(
  cle: string,
  p: {
    subscriptionId: string
    itemId: string | null
    priceId: string
    quantity: number
    taxRateId?: string | null
  },
): Promise<string> {
  const n = Math.max(0, Math.trunc(p.quantity))

  if (n === 0) {
    if (!p.itemId) return ''
    const resp = await fetch(`${API}/subscription_items/${encodeURIComponent(p.itemId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `appareils-off-${p.itemId}`,
      },
      body: formulaire({ proration_behavior: 'always_invoice' }),
    })
    if (!resp.ok) {
      const data = await resp.json()
      throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
    }
    return ''
  }

  const corps = formulaire({
    ...(p.itemId ? {} : { subscription: p.subscriptionId, price: p.priceId }),
    ...(p.itemId ? { price: p.priceId } : {}),
    quantity: n,
    proration_behavior: 'always_invoice',
    ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
  })
  const url = p.itemId
    ? `${API}/subscription_items/${encodeURIComponent(p.itemId)}`
    : `${API}/subscription_items`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // La clé porte l'abonnement, le prix et la quantité visée : un second
      // clic rejoue la même modification, jamais deux prorata.
      'Idempotency-Key': `appareils-${p.itemId ?? p.subscriptionId}-${p.priceId}-${n}`,
    },
    body: corps,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
  return data.id as string
}

// ─────────────────────────────────────────────────────────────────────────────
// LA LOCATION ON-DEMAND : prendre l'empreinte, puis facturer la semaine
// (7 octobre 2026).
//
// Trois fonctions, et un modèle différent de tout ce qui précède : on ne vend
// pas un abonnement et on n'encaisse pas tout de suite. On vérifie une carte
// AVANT, et on débite APRÈS, hors présence du client.
//
// ⚠️ **AUCUN PRICE N'EST CRÉÉ, ET AUCUN MONTANT N'EST FABRIQUÉ ICI.** Le
// montant arrive en paramètre, recopié de `missions.prix_cents` — figé en base
// à la réservation par `prix_mission`, à partir des réglages validés. Même
// exception que le devis mensuel, et pour la même raison : quelqu'un a relu ce
// prix, c'est l'objet de la grille.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'empreinte d'une carte : un Checkout en `mode: setup`.
 *
 * ⚠️ **RIEN N'EST DÉBITÉ.** Stripe ouvre un SetupIntent : il vérifie la carte
 * auprès de la banque (autorisation à zéro, parfois 3-D Secure) et l'attache à
 * un Customer pour plus tard. C'est ce que Julien appelle « un moyen de
 * paiement que Quantinvo a vérifié comme valide ».
 *
 * ⚠️ `customer_creation: 'always'` SEULEMENT QUAND ON N'A PAS DE CUSTOMER.
 * Stripe refuse les deux ensemble, et sans Customer il n'y a personne à
 * facturer au septième jour — la facture a besoin d'un destinataire qui dure.
 *
 * ⚠️ **ET LE MONTANT EST ANNONCÉ, PAS PRÉLEVÉ.** Il entre dans la description
 * du SetupIntent, qui s'affiche sur la page de Stripe : le client doit lire
 * « 341 € le 19 octobre » avant de donner sa carte, pas découvrir la somme au
 * relevé. Checkout en mode `setup` n'a pas de ligne de prix — cette phrase est
 * le seul endroit où le montant se voit.
 *
 * `billing_address_collection: 'required'` : l'adresse de facturation sert à la
 * facture du septième jour, et la redemander alors serait trop tard.
 */
export async function creerEmpreinteCheckout(
  cle: string,
  p: {
    missionId: string
    reference: string
    customerEmail: string
    /** Un Customer déjà connu de cette mission ; sinon Checkout en crée un. */
    customer?: string | null
    annonce: string
    successUrl: string
    cancelUrl: string
    /** Change quand la session précédente est expirée (24 h chez Stripe). */
    tentative?: number
  },
): Promise<SessionCheckout> {
  const corps = formulaire({
    mode: 'setup',
    currency: 'eur',
    payment_method_types: ['card'],
    ...(p.customer ? { customer: p.customer } : {
      customer_email: p.customerEmail,
      customer_creation: 'always',
    }),
    setup_intent_data: {
      description: p.annonce,
      metadata: { mission_id: p.missionId, reference: p.reference },
    },
    metadata: { mission_id: p.missionId, reference: p.reference, kind: 'location' },
    client_reference_id: p.missionId,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    locale: 'fr',
    billing_address_collection: 'required',
  })
  const resp = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cle}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `empreinte-${p.missionId}-${p.tentative ?? 0}`,
    },
    body: corps,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
  return { id: data.id, url: data.url, customer: data.customer ?? null }
}

export type EmpreintePrise = {
  /** `open`, `complete` ou `expired` — l'état de la session Checkout. */
  statut: string
  customer: string | null
  setupIntent: string | null
  /** La carte réutilisable. `null` tant que le SetupIntent n'a pas réussi. */
  paymentMethod: string | null
  url: string | null
}

/**
 * Relit une session d'empreinte, carte comprise.
 *
 * ⚠️ `expand[]=setup_intent` : sans ça, `setup_intent` n'est qu'un identifiant
 * et il faudrait un second appel pour savoir quelle carte a été donnée. Le
 * moyen de paiement ne vit que là — la session Checkout ne le porte pas.
 *
 * ⚠️ ET ELLE EXIGE `status === 'succeeded'` SUR LE SETUPINTENT, pas seulement
 * `complete` sur la session. Une session peut se terminer sur un SetupIntent
 * qui demande encore une authentification : enregistrer cette carte-là
 * ouvrirait la semaine sur un moyen de paiement que la banque n'a pas validé,
 * et c'est exactement ce que la promesse interdit.
 */
export async function lireEmpreinteCheckout(
  cle: string,
  id: string,
): Promise<EmpreintePrise | null> {
  const resp = await fetch(
    `${API}/checkout/sessions/${encodeURIComponent(id)}?expand[0]=setup_intent`,
    { headers: { Authorization: `Bearer ${cle}` } },
  )
  if (!resp.ok) return null
  const data = await resp.json()
  const si = data.setup_intent && typeof data.setup_intent === 'object' ? data.setup_intent : null
  const reussi = si?.status === 'succeeded'
  return {
    statut: String(data.status ?? ''),
    customer: data.customer ?? si?.customer ?? null,
    setupIntent: si?.id ?? (typeof data.setup_intent === 'string' ? data.setup_intent : null),
    paymentMethod: reussi ? (si?.payment_method ?? null) : null,
    url: data.status === 'open' ? (data.url ?? null) : null,
  }
}

export type FactureLocation = {
  invoiceId: string
  statut: string
  paymentIntent: string | null
  url: string | null
  numero: string
}

/**
 * Lit sur une facture l'identifiant du PaymentIntent qui l'a réglée.
 *
 * ⚠️ TROIS FORMES, PARCE QUE STRIPE A DÉPLACÉ LE CHAMP. Les anciennes versions
 * d'API portent `invoice.payment_intent` ; les récentes rangent les règlements
 * dans `invoice.payments`. Le compte n'épingle aucune version ici (comme le
 * reste de ce fichier), donc on lit les deux et on rend `null` si aucune ne
 * répond — cet identifiant sert à la traçabilité, pas à la décision. Ce qui
 * fait foi, c'est `invoiceId`, et lui ne bouge pas.
 */
function intentionDeLaFacture(data: Record<string, unknown>): string | null {
  const direct = data.payment_intent
  if (typeof direct === 'string') return direct
  if (direct && typeof direct === 'object') {
    const id = (direct as { id?: unknown }).id
    if (typeof id === 'string') return id
  }
  const paiements = (data.payments as { data?: unknown[] } | undefined)?.data
  if (Array.isArray(paiements)) {
    for (const p of paiements) {
      const pi = (p as { payment?: { payment_intent?: unknown } })?.payment?.payment_intent
      if (typeof pi === 'string') return pi
      if (pi && typeof pi === 'object') {
        const id = (pi as { id?: unknown }).id
        if (typeof id === 'string') return id
      }
    }
  }
  return null
}

/**
 * La facture du septième jour, créée puis réglée sur la carte enregistrée.
 *
 * Quatre appels, et chacun est **repris là où il s'est arrêté** :
 *
 *   1. créer la facture (brouillon) ;
 *   2. y poser LA ligne, si elle n'y est pas déjà ;
 *   3. la finaliser, si elle est encore brouillon ;
 *   4. la régler hors présence du client.
 *
 * ⚠️ **POURQUOI UNE FACTURE ET PAS UN SIMPLE PAIEMENT.** Un PaymentIntent
 * débiterait aussi bien, et plus simplement — mais il ne produit ni numéro, ni
 * PDF, ni page hébergée. Le client est un professionnel : il lui faut une
 * pièce comptable, et c'est Stripe qui la numérote sans trou (la règle
 * française l'exige). `facture_url` et `facture_numero` vont droit dans son
 * écran.
 *
 * ⚠️ **ET CHAQUE ÉTAPE SE RELIT AVANT D'AGIR, parce que la troisième tentative
 * retombe sur la facture des deux premières.** Les clés d'idempotence portent
 * l'identifiant de la mission, donc Stripe rend la MÊME facture pendant
 * vingt-quatre heures ; au-delà il en créerait une seconde. Comme on s'arrête
 * à trois refus espacés de six heures, les trois tiennent dans la fenêtre. Un
 * `finalize` rejoué sur une facture déjà finalisée échouerait : on regarde son
 * état plutôt que d'espérer.
 *
 * ⚠️ `off_session: true` est le DÉFAUT de Stripe, et il est écrit quand même :
 * c'est ce qui dit à la banque que personne n'est devant l'écran pour
 * s'authentifier. Un refus pour authentification requise (`authentication_
 * required`) est alors un refus normal, pas une anomalie — il remonte tel quel
 * dans `prelevement_echec`.
 */
export async function facturerLaLocation(
  cle: string,
  p: {
    missionId: string
    reference: string
    customer: string
    paymentMethod: string
    montantCents: number
    /** Le mémo de la facture : « Location Quantinvo — QI-2610-0004 ». */
    description: string
    /** La ligne : « Quantinvo, 7 jours, 6 appareils, 20 000 pièces ». */
    ligne: string
    /** La mention légale en pied de facture (franchise en base de TVA). */
    pied: string
    /** La semaine louée, affichée sur la facture. */
    periode?: { debut: Date; fin: Date } | null
    /** Le taux de TVA (`txr_…`). Absent tant que la franchise en base tient. */
    taxRateId?: string | null
    /**
     * Le numéro de la tentative (le nombre de refus déjà essuyés).
     *
     * ⚠️ **IL N'ENTRE QUE DANS LA CLÉ DU RÈGLEMENT, ET C'EST TOUT L'ENJEU.**
     * Stripe mémorise la réponse d'une clé d'idempotence pendant vingt-quatre
     * heures — **y compris une réponse d'échec**. Rejouer `payer-<mission>`
     * après un refus rendrait donc le MÊME refus, sans jamais rien retenter :
     * les trois tentatives n'en feraient qu'une, et une carte réapprovisionnée
     * entre-temps ne serait jamais débitée. Les clés de la facture, de la ligne
     * et de la finalisation restent FIXES — c'est elles qui interdisent la
     * facture en double.
     */
    tentative?: number
  },
): Promise<FactureLocation> {
  if (!Number.isInteger(p.montantCents) || p.montantCents <= 0) {
    throw new Error('montant de location invalide')
  }

  const poster = async (chemin: string, corps: string, idem: string) => {
    const resp = await fetch(`${API}${chemin}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idem,
      },
      body: corps,
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error?.message ?? `Stripe ${resp.status}`)
    return data as Record<string, unknown>
  }

  // 1. La facture, en brouillon.
  let facture = await poster('/invoices', formulaire({
    customer: p.customer,
    currency: 'eur',
    collection_method: 'charge_automatically',
    default_payment_method: p.paymentMethod,
    description: p.description,
    footer: p.pied,
    auto_advance: false,
    // ⚠️ `exclude` est le défaut, et il est écrit : `include` ramasserait
    // n'importe quelle ligne en attente sur ce client — une autre location
    // facturée la même heure, par exemple.
    pending_invoice_items_behavior: 'exclude',
    metadata: { mission_id: p.missionId, reference: p.reference, kind: 'location' },
  }), `facture-${p.missionId}`)

  const factureId = String(facture.id ?? '')
  if (!factureId) throw new Error('Stripe n’a pas rendu de facture')

  // 2. La ligne, si elle n'y est pas déjà.
  const lignes = (facture.lines as { data?: unknown[] } | undefined)?.data
  if (!Array.isArray(lignes) || lignes.length === 0) {
    await poster('/invoiceitems', formulaire({
      invoice: factureId,
      customer: p.customer,
      amount: p.montantCents,
      currency: 'eur',
      description: p.ligne,
      ...(p.periode
        ? {
          period: {
            start: Math.floor(p.periode.debut.getTime() / 1000),
            end: Math.floor(p.periode.fin.getTime() / 1000),
          },
        }
        : {}),
      ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
      metadata: { mission_id: p.missionId, reference: p.reference },
    }), `ligne-${p.missionId}`)
  }

  // 3. La finaliser — seulement si elle est encore brouillon.
  if (facture.status === 'draft') {
    facture = await poster(
      `/invoices/${encodeURIComponent(factureId)}/finalize`,
      formulaire({ auto_advance: false }),
      `finaliser-${p.missionId}`,
    )
  }

  // 4. La régler, hors présence du client.
  if (facture.status !== 'paid') {
    facture = await poster(
      `/invoices/${encodeURIComponent(factureId)}/pay`,
      formulaire({ off_session: true, payment_method: p.paymentMethod }),
      `payer-${p.missionId}-${p.tentative ?? 0}`,
    )
  }

  return {
    invoiceId: factureId,
    statut: String(facture.status ?? ''),
    paymentIntent: intentionDeLaFacture(facture),
    url: (facture.hosted_invoice_url as string | null) ?? null,
    numero: (facture.number as string | null) ?? '',
  }
}
