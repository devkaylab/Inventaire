// Edge function : la souscription en ligne (30 août 2026).
//
// Un prospect choisit une offre sur /tarifs, remplit quatre champs, paie par
// carte, et son entreprise est créée. Il n'y a **pas de devis** : le prix est
// public et il l'a choisi.
//
// Déployée en `verify_jwt: false` — celui qui souscrit n'a pas encore de
// compte, c'est tout l'objet du parcours. La contrepartie est la limitation de
// débit, appliquée dans `deposer_souscription` avant toute écriture.
//
// ⚠️ Le parcours RÉUTILISE `company_requests` et `fulfil_paid_request` : la
// demande naît en `accepted`, le webhook existant la mène à `created`. Ne pas
// écrire un second chemin de création — c'est la règle qui a évité, jusqu'ici,
// que deux façons de créer une entreprise divergent.
//
// ⚠️ Les Price Stripe sont posés en SECRETS, jamais créés ici. Six secrets,
// un par couple offre × rythme :
//   STRIPE_PRICE_ESSENTIAL_MONTHLY / _YEARLY
//   STRIPE_PRICE_ADVANCED_MONTHLY  / _YEARLY
//   STRIPE_PRICE_ENTERPRISE_MONTHLY / _YEARLY
// Tant qu'un secret manque, l'offre correspondante répond « indisponible » —
// et le client n'est jamais envoyé sur une page de paiement vide.
//
// ⚠️ COROLLAIRE DE LA REVALORISATION DU 31 AOÛT 2026 : la grille ci-dessous ne
// décide de RIEN au moment de payer. Elle sert à l'affichage et à
// `annual_price_cents` ; le montant prélevé est celui du Price Stripe. Les six
// Price doivent donc être recréés aux nouveaux montants et les six secrets
// remplacés — sans quoi le site annonce 310 € et Stripe encaisse 225 €, et
// l'écart ne se voit qu'au relevé.
//
// ⚠️ Un septième secret porte la TVA : `STRIPE_TAX_RATE` (un `txr_…` créé dans
// Stripe, en mode EXCLUSIF). Facultatif en test, **exigé en live** — voir le
// garde-fou plus bas.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { creerAbonnementCheckout } from '../_shared/stripe.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * La grille, en centimes. Doublon volontaire de `web/lib/offres.ts` : le site
 * et les fonctions edge ne compilent pas ensemble (npm d'un côté, esm.sh de
 * l'autre), comme `web/lib/devis.ts` et `_shared/devis.ts`. Un test compare
 * les deux — s'ils divergent, la suite échoue.
 */
/**
 * ⚠️ JUMEAU DE `TVA_APPLICABLE` DANS `web/lib/offres.ts` — l'éditeur est en
 * franchise en base de TVA (4 septembre 2026). Doublon volontaire, pour la
 * même raison que la grille : le site et les fonctions edge ne compilent pas
 * ensemble. Un test compare les deux.
 *
 * Tant qu'il vaut `false` : aucun taux n'est envoyé à Stripe, et le refus de
 * vendre en live sans `STRIPE_TAX_RATE` ne se déclenche pas — ce garde-fou a
 * été écrit en supposant que la TVA s'applique toujours, ce qui n'est vrai que
 * hors franchise.
 */
const TVA_APPLICABLE = false

const GRILLE = {
  essential: { monthly: 8900, yearly: 95000, nom: 'Essential' },
  advanced: { monthly: 31000, yearly: 330000, nom: 'Advanced' },
  enterprise: { monthly: 89000, yearly: 945000, nom: 'Enterprise' },
} as const

type Plan = keyof typeof GRILLE
type Rythme = 'monthly' | 'yearly'

const PLANS = Object.keys(GRILLE) as Plan[]

/** Le secret qui porte le Price de ce couple offre × rythme. */
function clePrice(plan: Plan, rythme: Rythme): string {
  return `STRIPE_PRICE_${plan.toUpperCase()}_${rythme === 'monthly' ? 'MONTHLY' : 'YEARLY'}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  let corps: Record<string, unknown>
  try {
    corps = await req.json()
  } catch {
    return json({ success: false, error: 'Requête illisible.' }, 400)
  }

  const texte = (k: string) => String(corps[k] ?? '').trim()
  const plan = texte('plan') as Plan
  const rythme = texte('billingPeriod') as Rythme

  if (!PLANS.includes(plan)) return json({ success: false, error: 'Offre inconnue.' }, 400)
  if (rythme !== 'monthly' && rythme !== 'yearly') {
    return json({ success: false, error: 'Rythme de paiement inconnu.' }, 400)
  }

  // ⚠️ Le Price est vérifié AVANT d'écrire quoi que ce soit : une demande
  // enregistrée sans page de paiement derrière laisserait une ligne morte, et
  // un client persuadé d'avoir souscrit.
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const priceId = Deno.env.get(clePrice(plan, rythme))
  if (!stripeKey || !priceId) {
    return json({
      success: false,
      code: 'indisponible',
      error: 'La souscription en ligne n’est pas encore ouverte pour cette offre. Écrivez-nous et nous ouvrons vos accès.',
    }, 503)
  }

  // ⚠️ LA TVA, ET LE GARDE-FOU QUI EMPÊCHE DE L'OUBLIER EN PRODUCTION.
  //
  // Nos prix sont hors taxes : sans taux de TVA, Stripe encaisserait 310 € là
  // où 372 € sont dus, et la différence sortirait de la poche de l'éditeur à
  // chaque échéance — une erreur qui ne se voit qu'à la déclaration.
  //
  // En mode TEST on tolère son absence : on valide le parcours avant d'avoir
  // tout configuré. En mode LIVE on REFUSE — c'est le seul endroit où l'oubli
  // coûte de l'argent, et la clé dit dans quel mode on est.
  //
  // ⚠️ EN FRANCHISE, IL N'Y A RIEN À AJOUTER — et rien à refuser. Le taux est
  // ignoré même s'il traîne dans les secrets : un taux posé par erreur
  // facturerait une taxe que l'éditeur ne collecte pas.
  const taxRateId = TVA_APPLICABLE ? (Deno.env.get('STRIPE_TAX_RATE') ?? null) : null
  if (TVA_APPLICABLE && !taxRateId && stripeKey.startsWith('sk_live_')) {
    return json({
      success: false,
      code: 'tva_absente',
      error: 'La souscription en ligne est momentanément indisponible. Écrivez-nous, nous ouvrons vos accès.',
    }, 503)
  }

  const tarif = GRILLE[plan]
  const montant = rythme === 'monthly' ? tarif.monthly : tarif.yearly
  // Ce que le magasin vaut à l'année : c'est `stores.annual_price_cents`, que
  // le tableau de bord somme pour afficher le revenu. Un abonnement mensuel
  // vaut douze mensualités.
  const annuel = rythme === 'monthly' ? tarif.monthly * 12 : tarif.yearly

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: depot, error } = await client.rpc('deposer_souscription', {
    p_company_name: texte('companyName'),
    p_first_name: texte('firstName'),
    p_last_name: texte('lastName'),
    p_email: texte('email'),
    p_store_name: texte('storeName'),
    p_plan: plan,
    p_billing_period: rythme,
    p_amount_cents: montant,
    p_annual_cents: annuel,
  })
  if (error) return json({ success: false, error: error.message }, 500)
  if (!depot?.success) return json({ success: false, error: depot?.error ?? 'Refus.' }, 400)

  const site = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  let session
  try {
    session = await creerAbonnementCheckout(stripeKey, {
      requestId: depot.request_id,
      priceId,
      label: `Quantinvo ${tarif.nom} — ${texte('storeName')}`,
      customerEmail: texte('email').toLowerCase(),
      successUrl: `${site}/souscrire?paiement=ok`,
      cancelUrl: `${site}/tarifs`,
      plan,
      billingPeriod: rythme,
      taxRateId,
    })
  } catch (e) {
    // La demande est écrite, la page de paiement n'a pas pu s'ouvrir. On le
    // dit franchement plutôt que de laisser croire à une souscription faite ;
    // la ligne reste en `accepted` et remonte dans « Ventes en cours ».
    return json({
      success: false,
      error: 'Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.',
      detail: e instanceof Error ? e.message : String(e),
    }, 502)
  }

  // La session est rattachée à la demande : c'est par elle que le webhook
  // retrouvera quoi créer.
  await client
    .from('company_requests')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', depot.request_id)

  return json({ success: true, paymentUrl: session.url })
})
