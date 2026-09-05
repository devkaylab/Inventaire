// Edge function : le parcours d'inscription (5 septembre 2026).
//
// Maquette : https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a
// « On paie, on est inscrit » — plus de demande, plus de devis, plus d'attente.
//
// ⚠️ DÉPLOYÉE EN `verify_jwt: false`, et c'est obligatoire : les deux premières
// actions se jouent AVANT qu'un compte existe. La garde ne vient donc pas du
// jeton mais des RPC elles-mêmes — `finaliser_inscription` désigne sa ligne par
// `auth.uid()`, et refuse sans session. Le jeton de l'appelant est transmis tel
// quel pour cette action : une fonction edge n'ajoute JAMAIS de droits (règle
// du 22 août 2026).
//
// Les quatre actions :
//   code     — envoie un code à six chiffres. AUCUNE session.
//   creer    — vérifie le code et crée le compte. AUCUNE session.
//   payer    — dépose la demande et ouvre le paiement. SESSION EXIGÉE.
//   reprendre— rouvre le paiement d'une demande déjà déposée. SESSION EXIGÉE.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { creerAbonnementCheckout, lireSessionCheckout } from '../_shared/stripe.ts'
import { emailQuantinvo, envoyerEmail } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

const site = () => Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'

/** Le Price d'une offre, pour un rythme. Jamais créé ici — posé en secret. */
const clePrice = (plan: string, rythme: string) =>
  `STRIPE_PRICE_${plan.toUpperCase()}_${rythme === 'monthly' ? 'MONTHLY' : 'YEARLY'}`
const clePriceAppareils = (rythme: string) =>
  `STRIPE_PRICE_APPAREILS_${rythme === 'monthly' ? 'MONTHLY' : 'YEARLY'}`

/**
 * ⚠️ JUMEAU DE `TVA_APPLICABLE` DANS `web/lib/offres.ts` — l'éditeur est en
 * franchise en base de TVA. Doublon volontaire : le site et les fonctions edge
 * ne compilent pas ensemble. Un test compare les deux.
 */
const TVA_APPLICABLE = false

/**
 * ⚠️ JUMEAU DE `venteOuverte()` DANS `web/lib/legal.ts` — la vente en ligne est
 * fermée tant que la société n'est pas immatriculée (Julien, 5 septembre 2026 :
 * « on ferme en attendant l'immatriculation »).
 *
 * Doublon volontaire, pour la raison habituelle : le site et les fonctions edge
 * ne compilent pas ensemble. Un test compare les deux — une porte fermée à
 * l'écran seulement s'ouvre avec une adresse.
 *
 * Côté site c'est `mentionsCompletes()` qui décide, parce que la LCEN interdit
 * de vendre sans identification complète de l'éditeur : les deux ouvrent
 * ensemble par nature. Ici il n'y a pas de `legal.ts` à lire, donc la valeur
 * est écrite — **et elle se rouvre dans le même commit que les mentions**.
 */
const VENTE_OUVERTE = false

/** Ce qu'on répond tant que la boutique est fermée. */
const boutiqueFermee = () =>
  json({
    success: false,
    code: 'vente_fermee',
    error:
      'La souscription en ligne n’est pas encore ouverte. Écrivez-nous et nous ouvrons vos accès.',
  }, 503)

function serveur() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

/** Le client de l'APPELANT : ses droits, pas les nôtres. */
function appelant(req: Request) {
  const jeton = req.headers.get('Authorization') ?? ''
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: jeton } } },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non permise' }, 405)

  let corps: Record<string, unknown>
  try {
    corps = await req.json()
  } catch {
    return json({ success: false, error: 'Corps illisible' }, 400)
  }
  const texte = (c: string) => String(corps[c] ?? '').trim()
  const action = texte('action') || 'code'

  // ⚠️ AVANT TOUTE ACTION, y compris l'envoi du code : ouvrir un compte de
  // prospect qui ne pourra pas payer ne laisserait que des comptes orphelins.
  if (!VENTE_OUVERTE) return boutiqueFermee()

  // ─── 1. Le code ──────────────────────────────────────────────────────────
  if (action === 'code') {
    const email = texte('email').toLowerCase()
    const { data, error } = await serveur().rpc('demander_code_email', { p_email: email })
    if (error) return json({ success: false, error: error.message }, 500)

    // ⚠️ LA RÉPONSE EST LA MÊME DANS TOUS LES CAS, et c'est ici que ça se joue.
    // « Cette adresse a déjà un compte » rouvrirait l'oracle d'énumération
    // fermé le 28 août 2026. C'est l'e-mail — qui n'atteint que le
    // propriétaire de la boîte — qui dit la vérité.
    const uniforme = json({ success: true, envoye: true })
    if (data?.outcome === 'email_invalide') {
      // Seule exception : ce que la personne vient de taper. Une erreur de
      // saisie ne parle que d'elle-même, elle ne dit rien de la base.
      return json({ success: false, error: 'Cette adresse e-mail ne semble pas valide.' }, 400)
    }
    if (data?.outcome === 'trop_de_tentatives') return uniforme

    try {
      if (data?.outcome === 'compte_existant') {
        const m = emailQuantinvo({
          titre: 'Vous avez déjà un compte Quantinvo',
          paragraphes: [
            'Quelqu’un vient de demander un code d’inscription avec cette adresse. Vous avez déjà un compte : il n’y a rien à créer.',
            'Connectez-vous avec votre mot de passe habituel. Si vous l’avez oublié, la page de connexion sait le réinitialiser.',
          ],
          bouton: { libelle: 'Me connecter', lien: `${site()}/login` },
          note: 'Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message : rien n’a été créé.',
          raison: 'Vous recevez ce message parce que cette adresse a été saisie sur la page d’inscription de Quantinvo.',
          siteUrl: site(),
        })
        await envoyerEmail({ to: email, subject: 'Vous avez déjà un compte Quantinvo', html: m.html, text: m.text })
      } else if (data?.outcome === 'code') {
        const m = emailQuantinvo({
          titre: 'Votre code de vérification',
          paragraphes: [
            'Voici le code à saisir pour confirmer votre adresse et poursuivre votre inscription.',
          ],
          details: [{ libelle: 'Code', valeur: String(data.code) }],
          note: 'Ce code est valable dix minutes et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message : rien n’a été créé.',
          raison: 'Vous recevez ce message parce que cette adresse a été saisie sur la page d’inscription de Quantinvo.',
          siteUrl: site(),
        })
        await envoyerEmail({ to: email, subject: `${data.code} — votre code Quantinvo`, html: m.html, text: m.text })
      }
    } catch (e) {
      // L'e-mail n'est pas parti : on le dit, mais sans jamais révéler dans
      // QUEL cas on était.
      console.error('inscription/code', e instanceof Error ? e.message : e)
      return json({ success: true, envoye: false })
    }
    return uniforme
  }

  // ─── 2. Le compte ────────────────────────────────────────────────────────
  if (action === 'creer') {
    const email = texte('email').toLowerCase()
    const code = texte('code')
    const motDePasse = String(corps.password ?? '')
    const prenom = texte('firstName')
    const nom = texte('lastName')

    if (motDePasse.length < 12) {
      return json({ success: false, error: 'Le mot de passe doit faire au moins douze caractères.' }, 400)
    }
    const client = serveur()
    const { data: v, error } = await client.rpc('verifier_code_email', { p_email: email, p_code: code })
    if (error) return json({ success: false, error: error.message }, 500)
    if (!v?.ok) {
      const dit: Record<string, string> = {
        code_expire: 'Ce code a expiré. Demandez-en un nouveau.',
        trop_d_essais: 'Trop d’essais sur ce code. Demandez-en un nouveau.',
      }
      return json({ success: false, code: v?.raison, error: dit[v?.raison] ?? 'Ce code n’est pas le bon.' }, 400)
    }

    // ⚠️ `handle_new_user` accepte cette création parce que le code vient
    // d'être consommé, et pour AUCUNE autre raison. Le profil qui en sort n'a
    // pas d'entreprise et ne voit rien.
    const { error: err2 } = await client.auth.admin.createUser({
      email,
      password: motDePasse,
      email_confirm: true,
      user_metadata: { first_name: prenom, last_name: nom },
    })
    if (err2) {
      return json({ success: false, error: 'La création du compte a échoué.', detail: err2.message }, 400)
    }
    return json({ success: true })
  }

  // ─── 3. Le paiement ──────────────────────────────────────────────────────
  if (action === 'payer' || action === 'reprendre') {
    const rythme = texte('billingPeriod') || 'monthly'
    if (rythme !== 'monthly' && rythme !== 'yearly') {
      return json({ success: false, error: 'Rythme de paiement inconnu.' }, 400)
    }
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return json({
        success: false, code: 'indisponible',
        error: 'L’inscription en ligne n’est pas encore ouverte. Écrivez-nous et nous ouvrons vos accès.',
      }, 503)
    }
    // ⚠️ La TVA : facultative en test, EXIGÉE en live — le seul endroit où un
    // oubli de configuration coûte de l'argent en silence. En franchise, le
    // taux est ignoré même s'il traîne dans les secrets.
    const taxRateId = TVA_APPLICABLE ? (Deno.env.get('STRIPE_TAX_RATE') ?? null) : null
    if (TVA_APPLICABLE && !taxRateId && stripeKey.startsWith('sk_live_')) {
      return json({ success: false, code: 'tva_absente',
        error: 'L’inscription est momentanément indisponible. Écrivez-nous.' }, 503)
    }

    const moi = appelant(req)
    // ⚠️ La session se contrôle ICI, pas seulement dans la RPC. Sans elle,
    // `anon` n'a pas le droit d'exécuter `finaliser_inscription` et la réponse
    // était un 500 portant « permission denied for function … » : un message
    // de Postgres qui décrit notre schéma, là où il fallait dire « reconnectez-
    // vous ».
    const { data: qui } = await moi.auth.getUser()
    if (!qui?.user) {
      return json({ success: false, code: 'session_absente',
        error: 'Votre session a expiré. Reconnectez-vous pour reprendre.' }, 401)
    }
    let demandeId: string | null = null
    let lignes: { plan: string; tranches: number }[] = []
    let email = ''

    if (action === 'payer') {
      // ⚠️ Appelée AVEC LE JETON DE L'APPELANT : le prix vient du serveur, et
      // la demande se rattache à `auth.uid()`. Une fonction edge n'ajoute
      // aucun droit.
      const { data, error } = await moi.rpc('finaliser_inscription', {
        p_company_name: texte('companyName'),
        p_siren: texte('siren') || null,
        p_ape: texte('ape') || null,
        p_first: texte('firstName'),
        p_last: texte('lastName'),
        p_phone: texte('phone'),
        p_stores: corps.stores ?? [],
        p_billing_period: rythme,
      })
      if (error) return json({ success: false, error: error.message }, 500)
      if (!data?.success) {
        return json({ success: false, code: data?.code, error: data?.error ?? 'Refus.' }, 400)
      }
      demandeId = data.demande_id
      lignes = (data.lignes ?? []) as { plan: string; tranches: number }[]
    } else {
      const { data, error } = await moi.rpc('mon_inscription')
      if (error) return json({ success: false, error: error.message }, 500)
      if (!data?.success || !data?.demande_id) {
        return json({ success: false, error: 'Aucune inscription à reprendre.' }, 400)
      }
      demandeId = data.demande_id
    }

    const client = serveur()
    const { data: dem } = await client
      .from('company_requests')
      .select('quote_lines, billing_period, contact_email, company_name, stripe_checkout_session_id, status')
      .eq('id', demandeId)
      .maybeSingle()
    if (!dem) return json({ success: false, error: 'Demande introuvable.' }, 400)
    if (dem.status !== 'accepted') {
      return json({ success: false, error: 'Cette inscription est déjà réglée.' }, 400)
    }
    if (lignes.length === 0) lignes = (dem.quote_lines ?? []) as { plan: string; tranches: number }[]
    email = String(dem.contact_email ?? '')
    const rythmeReel = String(dem.billing_period ?? rythme)

    // ⚠️ UNE SESSION ENCORE OUVERTE SE RELIT, elle ne se recrée pas : c'est le
    // même paiement, pas un second. Motif du 22 août 2026.
    if (dem.stripe_checkout_session_id) {
      const dejaLa = await lireSessionCheckout(stripeKey, dem.stripe_checkout_session_id)
      if (dejaLa?.url) return json({ success: true, paymentUrl: dejaLa.url })
    }

    // Les lignes Stripe : une par OFFRE, avec sa quantité, plus les tranches
    // d'appareils supplémentaires. Deux magasins Advanced font une ligne de
    // quantité deux — c'est exactement ce que la facture doit montrer.
    const parPlan = new Map<string, number>()
    let tranches = 0
    for (const l of lignes) {
      parPlan.set(l.plan, (parPlan.get(l.plan) ?? 0) + 1)
      tranches += Number(l.tranches ?? 0)
    }
    const items: { priceId: string; quantity: number }[] = []
    for (const [plan, n] of parPlan) {
      const price = Deno.env.get(clePrice(plan, rythmeReel))
      if (!price) {
        return json({ success: false, code: 'indisponible',
          error: 'Cette offre n’est pas encore ouverte à la souscription en ligne. Écrivez-nous.' }, 503)
      }
      items.push({ priceId: price, quantity: n })
    }
    if (tranches > 0) {
      const price = Deno.env.get(clePriceAppareils(rythmeReel))
      if (!price) {
        return json({ success: false, code: 'indisponible',
          error: 'Les appareils supplémentaires ne sont pas encore ouverts à la souscription en ligne. Écrivez-nous.' }, 503)
      }
      items.push({ priceId: price, quantity: tranches })
    }

    let session
    try {
      session = await creerAbonnementCheckout(stripeKey, {
        requestId: demandeId!,
        priceId: items[0].priceId,
        lignes: items,
        label: `Quantinvo — ${dem.company_name}`,
        customerEmail: email,
        successUrl: `${site()}/inscription?paiement=ok`,
        cancelUrl: `${site()}/inscription`,
        plan: 'inscription',
        billingPeriod: rythmeReel,
        taxRateId,
      })
    } catch (e) {
      // La demande est écrite, la page de paiement n'a pas pu s'ouvrir. On le
      // dit franchement plutôt que de laisser croire à une inscription faite :
      // la ligne reste en `accepted` et se reprend.
      return json({ success: false,
        error: 'Le paiement n’a pas pu s’ouvrir. Reprenez dans un instant.',
        detail: e instanceof Error ? e.message : String(e) }, 502)
    }

    await client.from('company_requests')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', demandeId)

    return json({ success: true, paymentUrl: session.url })
  }

  return json({ success: false, error: 'Action inconnue' }, 400)
})
