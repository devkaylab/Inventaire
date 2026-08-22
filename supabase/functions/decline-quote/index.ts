// Edge function : le client décline son devis (22 août 2026).
//
// Publique (`verify_jwt: false`), même surface que `accept-quote` : le jeton
// tient lieu de clé, la RPC `decline_quote_by_token` porte la limitation de
// débit et les gardes d'état. Deux messages : l'accusé au client, et l'avis à
// Quantinvo avec le motif — un refus est une information aussi utile qu'un
// accord, et c'est la seule façon de ne pas relancer pour rien.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo, envoyerEmail } from '../_shared/email.ts'
import { euros } from '../_shared/devis.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  let payload: { token?: string; reason?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const jeton = (payload.token ?? '').trim()
  const motif = (payload.reason ?? '').trim().slice(0, 500)
  if (!/^[0-9a-f-]{36}$/i.test(jeton)) return json({ success: false, error: 'Lien invalide.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const client = createClient(url, serviceKey)

  const { data: result, error } = await client.rpc('decline_quote_by_token', { p_token: jeton, p_reason: motif })
  if (error) return json({ success: false, error: error.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Refus impossible.' }, 400)
  if (result.already) return json({ success: true, already: true })

  if (!Deno.env.get('RESEND_API_KEY')) return json({ success: true, already: false, emailed: false })

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  // L'adresse de contact : celle qui reçoit les réponses. Lue avant d'écrire,
  // pour que le texte ne promette une réponse que si elle est possible.
  const { data: admins } = await client.rpc('admin_notify_emails')
  const dest = ((admins ?? []) as string[]).filter(Boolean)
  const contact = adresseDeContact(dest)
  const prenom = (result.contact_first_name ?? '').trim()
  const entreprise = result.company_name ?? ''
  const magasin = (result.store_name ?? '').trim()
  const reference = result.reference || '—'
  const montant = typeof result.amount_cents === 'number' ? euros(result.amount_cents) : '—'
  const objet = magasin ? `l’ajout du magasin « ${magasin} »` : 'votre inscription'

  let emailed = false
  try {
    const accuse = emailQuantinvo({
      titre: 'Nous avons bien noté votre réponse',
      apercu: `Devis ${reference} décliné.`,
      salutation: prenom ? `Bonjour ${prenom},` : 'Bonjour,',
      paragraphes: [
        `Vous avez décliné le devis ${reference} pour ${objet}. C’est noté, et vous ne recevrez pas de relance.`,
        contact
          ? `Si le montant ou le périmètre ne convenait pas, écrivez-nous à ${contact} : une nouvelle proposition est toujours possible.`
          : 'Si le montant ou le périmètre ne convenait pas, une nouvelle proposition est toujours possible.',
      ],
      details: [
        { intitule: 'Référence', valeur: reference },
        { intitule: 'Entreprise', valeur: entreprise },
      ],
      raison: 'Vous recevez ce message parce que vous venez de répondre à un devis Quantinvo.',
      siteUrl: appUrl,
    })
    if (result.contact_email) {
      await envoyerEmail({ to: result.contact_email, subject: `Devis ${reference} — réponse enregistrée`, html: accuse.html, text: accuse.text, replyTo: contact })
      emailed = true
    }
  } catch {
    // Le refus est enregistré : un accusé qui ne part pas ne le remet pas en cause.
  }

  try {
    if (dest.length > 0) {
      const avis = emailQuantinvo({
        titre: 'Un devis vient d’être décliné',
        apercu: `${entreprise} a décliné le devis ${reference}.`,
        paragraphes: [
          `${entreprise} vient de décliner le devis ${reference} pour ${objet} — ${montant} par an.`,
          motif ? `Motif donné : « ${motif} »` : 'Aucun motif donné.',
          'La vente sort des ventes en cours. Un nouveau devis peut être envoyé depuis la console, si la conversation reprend.',
        ],
        details: [
          { intitule: 'Entreprise', valeur: entreprise },
          ...(magasin ? [{ intitule: 'Magasin', valeur: magasin }] : []),
          { intitule: 'Référence', valeur: reference },
          { intitule: 'Montant annuel HT', valeur: montant },
          ...(motif ? [{ intitule: 'Motif', valeur: motif }] : []),
        ],
        bouton: { libelle: 'Ouvrir le tableau de bord', lien: `${appUrl}/admin` },
        raison: 'Vous recevez ce message parce que vous suivez les devis Quantinvo.',
        siteUrl: appUrl,
      })
      await envoyerEmail({ to: dest, subject: `Devis décliné — ${entreprise}`, html: avis.html, text: avis.text, replyTo: result.contact_email ?? null })
    }
  } catch {
    // Sans conséquence pour le client.
  }

  return json({ success: true, already: false, emailed })
})
