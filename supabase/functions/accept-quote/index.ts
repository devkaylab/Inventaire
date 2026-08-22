// Edge function : le client accepte son devis (22 août 2026).
//
// Publique (`verify_jwt: false`) : à ce stade du parcours d'inscription, le
// prospect **n'a pas de compte** — c'est justement ce que le devis va lui
// ouvrir. Le jeton du lien tient lieu de clé, et la RPC `accept_quote_by_token`
// porte la limitation de débit et toutes les gardes d'état (devis expiré, déjà
// traité, statut incompatible).
//
// ⚠️ Elle **ne crée rien** : l'acceptation pose une date et un statut. La
// création de l'entreprise reste derrière l'encaissement — c'est ce point qui
// rendra la bascule Stripe indolore, le webhook n'ayant qu'à jouer la
// transition `accepted → paid`.
//
// Deux messages partent : l'accusé au client, et l'avis aux administrateurs
// Quantinvo — lus en base par `admin_notify_emails`, donc sans variable à
// poser ; `QUOTE_NOTIFY_EMAIL` s'y ajoute si elle existe.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo } from '../_shared/email.ts'
import { euros } from '../_shared/devis.ts'
import { creerSessionCheckout, lireSessionCheckout } from '../_shared/stripe.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function envoyer(cle: string, from: string, to: string | string[], subject: string, html: string, text: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html, text }),
  })
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  let payload: { token?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const jeton = (payload.token ?? '').trim()
  if (!/^[0-9a-f-]{36}$/i.test(jeton)) return json({ success: false, error: 'Lien invalide.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const client = createClient(url, serviceKey)

  const { data: result, error } = await client.rpc('accept_quote_by_token', { p_token: jeton })
  if (error) return json({ success: false, error: error.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Acceptation impossible.' }, 400)

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'

  // ── Le paiement, par Stripe Checkout ─────────────────────────────────────
  // Dès l'accord, on ouvre la session et on rend son adresse : la page y
  // envoie le client. Un second clic (`already`) rend la même session, grâce à
  // la clé d'idempotence — un devis accepté deux fois ne se paie pas deux fois.
  // Sans clé Stripe (pas encore posée), l'accord est enregistré et la page le
  // dit : « votre facture arrive », comme avant.
  let paymentUrl: string | null = null
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const kind: 'company' | 'store' = result.kind === 'store' ? 'store' : 'company'
  const requestId = result.request_id as string | undefined
  if (stripeKey && requestId && typeof result.amount_cents === 'number' && result.amount_cents > 0
      && result.status !== 'paid' && result.status !== 'created') {
    try {
      // Une session déjà ouverte pour cette demande se réutilise telle quelle :
      // un second clic ramène au même Checkout. Expirée ou réglée, on en
      // ouvre une autre — `creerSessionCheckout` change alors de clé
      // d'idempotence par son compteur.
      const existante = typeof result.checkout_session_id === 'string'
        ? await lireSessionCheckout(stripeKey, result.checkout_session_id)
        : null
      const objet = kind === 'store'
        ? `Licence annuelle — ${result.store_name}`
        : `Licence annuelle — ${result.company_name}`
      const session = existante ?? await creerSessionCheckout(stripeKey, {
        requestId,
        kind,
        tentative: typeof result.checkout_session_id === 'string' ? Date.now() : 0,
        amountCents: result.amount_cents,
        label: objet,
        description: `Devis ${result.reference} · Quantinvo, l’outil d’inventaire pour le commerce`,
        customerEmail: result.contact_email,
        reference: result.reference ?? '',
        successUrl: `${appUrl}/devis/${jeton}?paiement=ok`,
        cancelUrl: `${appUrl}/devis/${jeton}`,
      })
      if (!existante) {
        await client.rpc('attach_checkout_session', {
          p_kind: kind, p_id: requestId, p_session_id: session.id, p_customer_id: session.customer,
        })
      }
      paymentUrl = session.url
    } catch (e) {
      // L'accord tient ; le paiement se retentera depuis la page (même session,
      // même clé d'idempotence). On le dit dans la réponse.
      paymentUrl = null
      console.error('Stripe', e instanceof Error ? e.message : e)
    }
  }

  // Un second clic ne renvoie pas les messages : l'accord est déjà enregistré.
  if (result.already) return json({ success: true, already: true, emailed: false, paymentUrl })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ success: true, already: false, emailed: false, paymentUrl })
  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const prenom = (result.contact_first_name ?? '').trim()
  const entreprise = result.company_name ?? ''
  const magasin = (result.store_name ?? '').trim()
  const objet = magasin ? `l’ajout du magasin « ${magasin} »` : 'son inscription'
  const reference = result.reference || '—'
  const montant = typeof result.amount_cents === 'number' ? euros(result.amount_cents) : '—'

  let emailed = false
  try {
    const accuse = emailQuantinvo({
      titre: 'Votre accord est enregistré',
      apercu: `Devis ${reference} accepté.`,
      salutation: prenom ? `Bonjour ${prenom},` : 'Bonjour,',
      paragraphes: [
        'Merci : nous avons bien enregistré votre accord sur le devis ci-dessous.',
        paymentUrl
          ? 'Il ne reste qu’à régler la licence, par carte ou par prélèvement SEPA. Vos accès sont créés dans la minute qui suit le paiement, et la facture vous est envoyée automatiquement.'
          : 'Votre facture vous parvient sous 48 heures. Vos accès sont créés dès son règlement, et nous vous écrivons à ce moment-là.',
      ],
      details: [
        { intitule: 'Référence', valeur: reference },
        { intitule: 'Entreprise', valeur: entreprise },
        { intitule: 'Montant annuel HT', valeur: montant },
      ],
      ...(paymentUrl ? { bouton: { libelle: 'Régler la licence', lien: paymentUrl } } : {}),
      raison: 'Vous recevez ce message parce que vous venez d’accepter un devis Quantinvo.',
      siteUrl: appUrl,
    })
    await envoyer(resendKey, fromAddr, result.contact_email, `Devis ${reference} accepté`, accuse.html, accuse.text)
    emailed = true
  } catch {
    // L'accord est enregistré : un accusé qui ne part pas ne le remet pas en
    // cause, et la page affiche déjà la confirmation.
  }

  // L'avis part aux administrateurs Quantinvo — lus en base, pour qu'aucune
  // variable ne soit à poser. `QUOTE_NOTIFY_EMAIL`, si elle existe, s'ajoute.
  // C'est le moment le plus important du parcours : un accord qu'on découvre
  // trois jours plus tard en rouvrant la console, c'est une facture en retard.
  const destinatairesInternes = new Set<string>()
  try {
    const { data: admins } = await client.rpc('admin_notify_emails')
    for (const a of (admins ?? []) as string[]) if (a) destinatairesInternes.add(a)
  } catch {
    // Sans conséquence pour le client ; la console montre le statut.
  }
  const force = Deno.env.get('QUOTE_NOTIFY_EMAIL')?.trim()
  if (force) destinatairesInternes.add(force.toLowerCase())
  const interne = [...destinatairesInternes]
  if (interne.length > 0) {
    try {
      const avis = emailQuantinvo({
        titre: 'Un devis vient d’être accepté',
        apercu: `${entreprise} a accepté le devis ${reference}.`,
        paragraphes: [
          `${entreprise} vient d’accepter le devis ${reference} pour ${objet} — ${montant} par an.`,
          paymentUrl
            ? 'Le paiement Stripe lui est proposé dans la foulée ; la création se fera toute seule à réception.'
            : `Il reste à facturer, encaisser, puis ${magasin ? 'créer le magasin' : 'créer l’entreprise'} depuis le tableau de bord.`,
        ],
        details: [
          { intitule: 'Entreprise', valeur: entreprise },
          ...(magasin ? [{ intitule: 'Magasin', valeur: magasin }] : []),
          { intitule: 'Référence', valeur: reference },
          { intitule: 'Montant annuel HT', valeur: montant },
        ],
        bouton: { libelle: 'Ouvrir le tableau de bord', lien: `${appUrl}/admin` },
        raison: 'Vous recevez ce message parce que vous suivez les devis Quantinvo.',
        siteUrl: appUrl,
      })
      await envoyer(resendKey, fromAddr, interne, `Devis accepté — ${entreprise}`, avis.html, avis.text)
    } catch {
      // Sans conséquence pour le client : la console montre le statut.
    }
  }

  return json({ success: true, already: false, emailed, paymentUrl })
})
