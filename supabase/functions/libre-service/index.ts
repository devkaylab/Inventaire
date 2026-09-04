// Edge function : le libre-service (4 septembre 2026).
//
// Julien : « nous avons une offre claire aujourd'hui, plus besoin de passer par
// un devis pour quoi que ce soit. Donc il faut créer les produits pour les
// magasins supplémentaires, appareils supplémentaires. »
//
// Deux gestes, une seule fonction, parce qu'ils partagent tout ce qui compte —
// la grille, les Price, la TVA, la façon d'ouvrir un paiement :
//   · `magasin` : ajouter un magasin à son entreprise ;
//   · `offre`   : élargir le forfait d'un magasin qu'on a déjà.
//
// ⚠️ DÉPLOYÉE **AVEC** VÉRIFICATION DE JETON (pas de `--no-verify-jwt`).
// Contrairement à `subscribe-online`, celui qui appelle a un compte : c'est
// l'administrateur de son entreprise. Et, règle du 22 août 2026, cette
// fonction N'AJOUTE AUCUN DROIT — les RPC gardées sont appelées avec LE JETON
// DE L'APPELANT ; la clé de service ne sert qu'à ce que le navigateur ne doit
// pas voir (les identifiants Stripe).
//
// ⚠️ LES PRICE SONT POSÉS EN SECRETS, JAMAIS CRÉÉS ICI. Les six de la grille
// existent déjà (STRIPE_PRICE_<OFFRE>_<RYTHME>) ; deux s'y ajoutent pour les
// appareils supplémentaires, par tranche de dix :
//   STRIPE_PRICE_APPAREILS_MONTHLY   (64 €)
//   STRIPE_PRICE_APPAREILS_YEARLY    (690 €)
// Tant qu'un secret manque, la fonction répond « indisponible » — et **rien
// n'est écrit** : le Price est vérifié AVANT le dépôt, sinon on laisserait une
// ligne morte et un client persuadé d'avoir payé. C'est la règle du 30 août.
//
// ⚠️ AUCUNE GRILLE N'EST RECOPIÉE ICI, et c'est délibéré. Le plan, le plafond,
// les tranches et les deux montants viennent de `prix_offre`, en base — la
// seule copie que les deux dépôts puissent utiliser sans qu'un client puisse
// se déposer une demande à un centime. L'edge ne sait pas combien coûte
// Advanced ; elle sait seulement quel Price porter.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  changerPrixArticle,
  creerAbonnementCheckout,
  lireAbonnement,
  poserArticleAppareils,
} from '../_shared/stripe.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

type Rythme = 'monthly' | 'yearly'

/** Le secret qui porte le Price de ce couple offre × rythme. */
const clePrice = (plan: string, rythme: Rythme) =>
  `STRIPE_PRICE_${plan.toUpperCase()}_${rythme === 'monthly' ? 'MONTHLY' : 'YEARLY'}`

/** Le secret qui porte la tranche de dix appareils supplémentaires. */
const cleSupplement = (rythme: Rythme) =>
  `STRIPE_PRICE_APPAREILS_${rythme === 'monthly' ? 'MONTHLY' : 'YEARLY'}`

/**
 * ⚠️ JUMEAU DE `TVA_APPLICABLE` DANS `web/lib/offres.ts` ET DANS
 * `subscribe-online` — l'éditeur est en franchise en base de TVA (4 septembre
 * 2026). Un test compare les trois.
 */
const TVA_APPLICABLE = false

const indisponible = () =>
  json({
    success: false,
    code: 'indisponible',
    error:
      'Le changement en ligne n’est pas encore ouvert pour cette offre. Écrivez-nous et nous nous en occupons.',
  }, 503)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const jeton = req.headers.get('Authorization') ?? ''
  if (!jeton) return json({ success: false, error: 'Session expirée.' }, 401)

  let corps: Record<string, unknown>
  try {
    corps = await req.json()
  } catch {
    return json({ success: false, error: 'Requête illisible.' }, 400)
  }

  const texte = (k: string) => String(corps[k] ?? '').trim()
  const action = texte('action')
  const rythme = texte('billingPeriod') as Rythme
  const appareils = Number(corps.devices)

  if (action !== 'magasin' && action !== 'offre') {
    return json({ success: false, error: 'Geste inconnu.' }, 400)
  }
  if (rythme !== 'monthly' && rythme !== 'yearly') {
    return json({ success: false, error: 'Rythme de paiement inconnu.' }, 400)
  }
  if (!Number.isInteger(appareils) || appareils < 1) {
    return json({
      success: false,
      error: 'Indiquez le nombre d’appareils qui comptent en même temps.',
    }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  // Le client de l'APPELANT : c'est lui qui porte les gardes (`is_company_admin`,
  // exigence aal2 comprise). Toutes les RPC de décision passent par là.
  const appelant = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: jeton } },
  })
  // Le client de service : uniquement pour ce que le navigateur ne doit pas
  // voir — les identifiants Stripe — et pour écrire après paiement.
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: utilisateur } = await appelant.auth.getUser()
  const email = utilisateur?.user?.email?.toLowerCase() ?? ''
  if (!email) return json({ success: false, error: 'Session expirée.' }, 401)

  // ── Le tarif vient de la base, jamais d'une grille recopiée ici ──────────
  const { data: tarif, error: eTarif } = await appelant.rpc('prix_offre', {
    p_devices: appareils,
    p_billing_period: rythme,
  })
  if (eTarif) return json({ success: false, error: eTarif.message }, 500)
  if (!tarif) return json({ success: false, error: 'Nombre d’appareils hors grille.' }, 400)

  const plan = String(tarif.plan)
  const tranches = Number(tarif.tranches ?? 0)
  const annuelCents = Number(tarif.annuel_cents)

  // ⚠️ LES PRICE SE VÉRIFIENT AVANT TOUTE ÉCRITURE. Une demande enregistrée
  // sans page de paiement derrière laisse une ligne morte et un client
  // persuadé d'avoir souscrit.
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const priceOffre = Deno.env.get(clePrice(plan, rythme))
  const priceAppareils = Deno.env.get(cleSupplement(rythme))
  if (!stripeKey || !priceOffre) return indisponible()
  if (tranches > 0 && !priceAppareils) return indisponible()

  // ⚠️ La TVA : même garde-fou que la souscription en ligne. En franchise il
  // n'y a rien à ajouter, et le taux est ignoré même s'il traîne dans les
  // secrets — un taux posé par erreur facturerait une taxe non collectée.
  const taxRateId = TVA_APPLICABLE ? (Deno.env.get('STRIPE_TAX_RATE') ?? null) : null
  if (TVA_APPLICABLE && !taxRateId && stripeKey.startsWith('sk_live_')) {
    return json({ success: false, code: 'tva_absente', error: 'Momentanément indisponible.' }, 503)
  }

  const site = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  const supplement = tranches > 0 && priceAppareils
    ? { priceId: priceAppareils, quantity: tranches }
    : null

  // ─────────────────────────────────────────────────────────────────────────
  // AJOUTER UN MAGASIN
  // ─────────────────────────────────────────────────────────────────────────
  if (action === 'magasin') {
    const nom = texte('name')
    const { data: depot, error } = await appelant.rpc('deposer_ajout_magasin', {
      p_name: nom,
      p_devices: appareils,
      p_billing_period: rythme,
    })
    if (error) return json({ success: false, error: error.message }, 500)
    if (!depot?.success) return json({ success: false, error: depot?.error ?? 'Refus.' }, 400)

    let session
    try {
      session = await creerAbonnementCheckout(stripeKey, {
        requestId: depot.id,
        priceId: priceOffre,
        label: `Quantinvo — ${nom}`,
        customerEmail: email,
        successUrl: `${site}/magasins?magasin=ok`,
        cancelUrl: `${site}/magasins`,
        plan,
        billingPeriod: rythme,
        kind: 'store',
        taxRateId,
        supplement,
      })
    } catch (e) {
      // La demande est écrite, la page de paiement n'a pas pu s'ouvrir. On le
      // dit franchement : la ligne reste en `accepted` et remonte dans
      // « Ventes en cours », elle ne se perd pas.
      return json({
        success: false,
        error: 'Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.',
        detail: e instanceof Error ? e.message : String(e),
      }, 502)
    }

    await service.rpc('attach_checkout_session', {
      p_kind: 'store',
      p_id: depot.id,
      p_session_id: session.id,
      p_customer_id: session.customer ?? null,
    })
    return json({ success: true, paymentUrl: session.url, plan: depot.plan })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGER D'OFFRE
  // ─────────────────────────────────────────────────────────────────────────
  const storeId = texte('storeId')
  if (!storeId) return json({ success: false, error: 'Magasin absent.' }, 400)

  // ⚠️ LA GARDE SE DEMANDE, ELLE NE SE DÉDUIT PAS. Le refus
  // `abonnement_en_cours` du dépôt n'arrive qu'après sa propre garde, donc le
  // recevoir prouverait l'autorisation — mais une autorisation qui tient à
  // l'ordre des `if` d'une autre fonction se perd au premier réagencement.
  const { data: autorise, error: eGarde } = await appelant.rpc('peut_changer_offre', {
    p_store_id: storeId,
  })
  if (eGarde) return json({ success: false, error: eGarde.message }, 500)
  if (autorise !== true) {
    return json({
      success: false,
      error: 'Accès réservé à l’administrateur de l’entreprise.',
    }, 403)
  }

  const { data: etat, error: eEtat } = await service.rpc('etat_abonnement_magasin', {
    p_store_id: storeId,
  })
  if (eEtat) return json({ success: false, error: eEtat.message }, 500)
  if (!etat) return json({ success: false, error: 'Magasin introuvable.' }, 404)

  const abonnement = String(etat.abonnement ?? '').trim()

  // ── Chemin A : l'entreprise a un abonnement — on le MODIFIE ──────────────
  //
  // ⚠️ Surtout pas un second Checkout : ce serait un second abonnement, et le
  // client paierait les deux offres en même temps. C'est Stripe qui calcule le
  // prorata (`always_invoice`), pas nous.
  if (abonnement) {
    if (etat.plafond != null && appareils <= Number(etat.plafond)) {
      return json({
        success: false,
        code: 'deja_couvert',
        error: `Votre forfait couvre déjà ${etat.plafond} appareils.`,
      }, 400)
    }

    let itemOffre = String(etat.item_offre ?? '').trim()
    if (!itemOffre) {
      // Première modification depuis la souscription : on retrouve l'article
      // dans l'abonnement plutôt que de le supposer.
      const abo = await lireAbonnement(stripeKey, abonnement)
      if (!abo || abo.articles.length === 0) {
        return json({ success: false, error: 'Abonnement introuvable chez Stripe.' }, 502)
      }
      const suppl = priceAppareils ?? ''
      itemOffre = (abo.articles.find((a) => a.price !== suppl) ?? abo.articles[0]).id
    }

    let itemAppareils: string
    try {
      await changerPrixArticle(stripeKey, {
        itemId: itemOffre,
        priceId: priceOffre,
        taxRateId,
      })
      itemAppareils = await poserArticleAppareils(stripeKey, {
        subscriptionId: abonnement,
        itemId: String(etat.item_appareils ?? '').trim() || null,
        priceId: priceAppareils ?? '',
        quantity: tranches,
        taxRateId,
      })
    } catch (e) {
      return json({
        success: false,
        error: 'Le changement n’a pas pu être enregistré chez Stripe. Réessayez dans un instant.',
        detail: e instanceof Error ? e.message : String(e),
      }, 502)
    }

    const { data: applique, error: eApp } = await service.rpc('appliquer_changement_offre', {
      p_store_id: storeId,
      p_devices: appareils,
      p_annuel_cents: annuelCents,
      p_item: itemOffre,
      p_item_appareils: itemAppareils,
    })
    if (eApp) return json({ success: false, error: eApp.message }, 500)
    if (!applique?.success) {
      return json({ success: false, error: applique?.error ?? 'Refus.' }, 400)
    }
    // Rien à payer sur une page : Stripe a facturé le prorata sur le moyen de
    // paiement déjà enregistré.
    return json({ success: true, applique: true, plan, devices: appareils })
  }

  // ── Chemin B : pas d'abonnement — une session Checkout ordinaire ─────────
  const { data: depot, error } = await appelant.rpc('deposer_changement_offre', {
    p_store_id: storeId,
    p_devices: appareils,
    p_billing_period: rythme,
  })
  if (error) return json({ success: false, error: error.message }, 500)
  if (!depot?.success) {
    return json({ success: false, code: depot?.code, error: depot?.error ?? 'Refus.' }, 400)
  }

  let session
  try {
    session = await creerAbonnementCheckout(stripeKey, {
      requestId: depot.id,
      priceId: priceOffre,
      label: `Quantinvo — ${depot.store_name}`,
      customerEmail: email,
      successUrl: `${site}/magasins/${storeId}?offre=ok`,
      cancelUrl: `${site}/magasins/${storeId}`,
      plan,
      billingPeriod: rythme,
      kind: 'store_offer',
      taxRateId,
      supplement,
    })
  } catch (e) {
    return json({
      success: false,
      error: 'Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.',
      detail: e instanceof Error ? e.message : String(e),
    }, 502)
  }

  await service.rpc('attach_checkout_session', {
    p_kind: 'store',
    p_id: depot.id,
    p_session_id: session.id,
    p_customer_id: session.customer ?? null,
  })
  return json({ success: true, paymentUrl: session.url, plan: depot.plan })
})
