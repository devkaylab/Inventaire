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
 * Une session Checkout pour un devis.
 *
 * `mode: payment` : la licence est annuelle, facturée en une fois. Les moyens
 * de paiement proposés sont la carte et le prélèvement SEPA — le second
 * convient aux montants d'une enseigne. `invoice_creation` fait produire et
 * envoyer la facture par Stripe : c'est ce qui remplace le RIB.
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
