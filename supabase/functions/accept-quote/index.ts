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
// Deux messages partent : l'accusé au client, et l'avis à Quantinvo (adresse
// `QUOTE_NOTIFY_EMAIL`, sinon rien — on ne devine pas une adresse interne).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo } from '../_shared/email.ts'
import { euros } from '../_shared/devis.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function envoyer(cle: string, from: string, to: string, subject: string, html: string, text: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
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

  // Un second clic ne renvoie pas les messages : l'accord est déjà enregistré.
  if (result.already) return json({ success: true, already: true, emailed: false })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ success: true, already: false, emailed: false })

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const prenom = (result.contact_first_name ?? '').trim()
  const entreprise = result.company_name ?? ''
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
        'Votre facture vous parvient sous 48 heures. Vos accès — l’entreprise, ses magasins et leurs codes — sont créés dès son règlement, et nous vous écrivons à ce moment-là.',
      ],
      details: [
        { intitule: 'Référence', valeur: reference },
        { intitule: 'Entreprise', valeur: entreprise },
        { intitule: 'Montant annuel HT', valeur: montant },
      ],
      raison: 'Vous recevez ce message parce que vous venez d’accepter un devis Quantinvo.',
      siteUrl: appUrl,
    })
    await envoyer(resendKey, fromAddr, result.contact_email, `Devis ${reference} accepté`, accuse.html, accuse.text)
    emailed = true
  } catch {
    // L'accord est enregistré : un accusé qui ne part pas ne le remet pas en
    // cause, et la page affiche déjà la confirmation.
  }

  const interne = Deno.env.get('QUOTE_NOTIFY_EMAIL')?.trim()
  if (interne) {
    try {
      const avis = emailQuantinvo({
        titre: 'Un devis vient d’être accepté',
        apercu: `${entreprise} a accepté le devis ${reference}.`,
        paragraphes: [
          `${entreprise} vient d’accepter le devis ${reference} pour ${montant} par an.`,
          'Il reste à facturer, encaisser, puis créer l’entreprise depuis la console.',
        ],
        details: [
          { intitule: 'Entreprise', valeur: entreprise },
          { intitule: 'Référence', valeur: reference },
          { intitule: 'Montant annuel HT', valeur: montant },
        ],
        bouton: { libelle: 'Ouvrir la console', lien: `${appUrl}/admin` },
        raison: 'Vous recevez ce message parce que vous suivez les devis Quantinvo.',
        siteUrl: appUrl,
      })
      await envoyer(resendKey, fromAddr, interne, `Devis accepté — ${entreprise}`, avis.html, avis.text)
    } catch {
      // Sans conséquence pour le client : la console montre le statut.
    }
  }

  return json({ success: true, already: false, emailed })
})
