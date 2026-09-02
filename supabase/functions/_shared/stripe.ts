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
    tentative?: number
  },
): Promise<SessionCheckout> {
  const corps = formulaire({
    mode: 'subscription',
    customer_email: p.customerEmail,
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price: p.priceId,
      ...(p.taxRateId ? { tax_rates: [p.taxRateId] } : {}),
    }],
    subscription_data: {
      description: p.label,
      metadata: { request_id: p.requestId, plan: p.plan, billing_period: p.billingPeriod },
    },
    metadata: { request_id: p.requestId, kind: 'company', plan: p.plan, billing_period: p.billingPeriod },
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
      'Idempotency-Key': `abonnement-${p.requestId}-${p.tentative ?? 0}`,
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
