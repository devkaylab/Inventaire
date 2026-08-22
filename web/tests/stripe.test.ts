// Le paiement passe par Stripe, et la création suit le paiement (22 août 2026).
//
// Ce que ces tests empêchent de défaire :
//   · la signature du webhook est vérifiée sur le corps brut, avec un vrai
//     HMAC — c'est la seule porte d'une fonction déployée sans JWT ;
//   · la création ne se déclenche que depuis le webhook, en service_role,
//     jamais depuis le client ni depuis l'acceptation ;
//   · un webhook rejoué répond 200 sans rien refaire (Stripe rejoue tant
//     qu'il n'a pas son 200) ;
//   · la session Checkout est idempotente par demande : un devis accepté deux
//     fois ne se paie pas deux fois.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { formulaire, verifierWebhook } from '../../supabase/functions/_shared/stripe'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260822250001_stripe_paiement.sql')
const webhook = lire('../../supabase/functions/stripe-webhook/index.ts')
const accept = lire('../../supabase/functions/accept-quote/index.ts')
const stripe = lire('../../supabase/functions/_shared/stripe.ts')
const pageDevis = lire('../app/devis/[token]/page.tsx')

const corps = (fn: string) => migration.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''

/** Signe comme Stripe : `t=<ts>,v1=hmac(secret, "<ts>.<corps>")`. */
function signer(secret: string, corps: string, ts = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac('sha256', secret).update(`${ts}.${corps}`).digest('hex')
  return `t=${ts},v1=${v1}`
}

describe('la signature du webhook', () => {
  const secret = 'whsec_test_secret'
  const corpsBrut = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } })

  it('accepte une signature valide et rend l’événement', async () => {
    const ev = await verifierWebhook(secret, corpsBrut, signer(secret, corpsBrut))
    expect(ev.type).toBe('checkout.session.completed')
  })

  it('refuse un corps modifié après signature', async () => {
    const sig = signer(secret, corpsBrut)
    const trafique = corpsBrut.replace('cs_1', 'cs_2')
    await expect(verifierWebhook(secret, trafique, sig)).rejects.toThrow('signature invalide')
  })

  it('refuse un mauvais secret, une signature absente, un horodatage trop vieux', async () => {
    await expect(verifierWebhook('autre', corpsBrut, signer(secret, corpsBrut))).rejects.toThrow()
    await expect(verifierWebhook(secret, corpsBrut, null)).rejects.toThrow('absente')
    const vieux = Math.floor(Date.now() / 1000) - 3600
    await expect(verifierWebhook(secret, corpsBrut, signer(secret, corpsBrut, vieux))).rejects.toThrow('ancienne')
  })

  it('est vérifiée avant toute lecture, dans la fonction déployée', () => {
    // Le webhook n'a pas de JWT : sans cette vérification, n'importe qui
    // créerait une entreprise en postant un faux événement.
    const avant = webhook.indexOf('verifierWebhook(')
    const lecture = webhook.indexOf("event.type")
    expect(avant).toBeGreaterThan(0)
    expect(lecture).toBeGreaterThan(avant)
    expect(webhook).toContain("Deno.env.get('STRIPE_WEBHOOK_SECRET')")
  })
})

describe('la session Checkout', () => {
  it('encode les champs imbriqués comme Stripe les attend', () => {
    const q = formulaire({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: 660000 } }],
      metadata: { request_id: 'abc' },
    })
    expect(q).toContain('mode=payment')
    expect(q).toContain('line_items%5B0%5D%5Bquantity%5D=1')
    expect(q).toContain('line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=660000')
    expect(q).toContain('metadata%5Brequest_id%5D=abc')
  })

  it('est idempotente par demande, et fait produire la facture par Stripe', () => {
    // Un devis accepté deux fois ne se paie pas deux fois ; et c'est Stripe
    // qui facture — il n'y a pas de RIB.
    expect(stripe).toContain("'Idempotency-Key': `checkout-${p.kind}-${p.requestId}`")
    expect(stripe).toContain('invoice_creation')
    expect(stripe).toContain("payment_method_types: ['card', 'sepa_debit']")
  })

  it('s’ouvre à l’acceptation, et se rattache à la demande', () => {
    expect(accept).toContain('creerSessionCheckout(')
    expect(accept).toContain("rpc('attach_checkout_session'")
    expect(accept).toContain('paymentUrl')
    // La page suit l'adresse rendue.
    expect(pageDevis).toContain('window.location.assign(data.paymentUrl)')
  })
})

describe('payé, donc créé', () => {
  it('seul le serveur peut déclencher la création', () => {
    for (const fn of ['fulfil_paid_request(text, text, text, text)', 'attach_checkout_session(text, uuid, text, text)',
      'invite_company_admin_after_payment(uuid, text, text, text)', 'log_system_action(text, text, text, text, text, jsonb)']) {
      expect(migration, fn).toContain(`revoke all on function public.${fn} from public, anon, authenticated`)
      expect(migration, fn).toContain(`grant execute on function public.${fn} to service_role`)
    }
    // Et l'acceptation, elle, ne crée toujours rien.
    expect(corps('accept_quote_by_token')).not.toMatch(/insert into public\.(companies|stores)\b/)
  })

  it('un webhook rejoué répond déjà-fait, une session inconnue échoue', () => {
    const c = corps('fulfil_paid_request')
    expect(c).toContain("v_req.status in ('paid', 'created')")
    expect(c).toContain("'already', true")
    expect(c).toContain("'Session inconnue'")
    // Côté fonction : déjà-fait → 200 (Stripe s'arrête), inconnue → 500 (Stripe réessaie).
    expect(webhook).toContain('if (result.already) return json({ received: true, already: true })')
    expect(webhook).toContain("if (!result?.success) return json({ error: result?.error ?? 'refus' }, 500)")
  })

  it('crée les magasins avec les noms du devis, et invite le contact comme administrateur', () => {
    const c = corps('fulfil_paid_request')
    expect(c).toContain("v_req.quote_lines -> (v_i - 1) ->> 'libelle'")
    expect(corps('invite_company_admin_after_payment')).toContain("'company_admin'")
    expect(webhook).toContain("rpc('invite_company_admin_after_payment'")
    expect(webhook).toContain("type: 'invite'")
  })

  it('journalise sous l’auteur Stripe, sans auth.uid()', () => {
    expect(corps('log_system_action')).not.toContain('auth.uid()')
    expect(corps('fulfil_paid_request')).toContain("log_system_action('Stripe'")
  })

  it('ignore ce qui n’est pas un paiement réglé, sans faire relancer Stripe', () => {
    expect(webhook).toContain("if (event.type !== 'checkout.session.completed') return json({ received: true")
    expect(webhook).toContain("session.payment_status !== 'paid'")
  })
})
