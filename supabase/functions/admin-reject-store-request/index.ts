// Edge function : Quantinvo refuse une demande de magasin, et le demandeur est
// prévenu avec le motif (22 août 2026).
//
// Même squelette qu'`admin-fulfil-store-request` : le refus reste dans
// `admin_reject_store_request`, appelée **avec le jeton de l'administrateur
// Quantinvo** — donc gardée par is_admin(), double authentification comprise.
// L'edge n'écrit que l'e-mail, à partir de l'objet `notify` rendu par la RPC.
//
// Le motif part tel quel : c'est déjà la règle de l'écran client, « Refusée »
// tout court ne dit pas quoi faire. Le gabarit l'échappe.
//
// La console retombe sur la RPC directe si cette fonction est injoignable : la
// demande est refusée sans e-mail, et le motif reste lisible sur /magasins.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo, envoyerEmail } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Notify = {
  email?: string
  first_name?: string
  store_name?: string
  company_name?: string
  kind?: string
  note?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: { requestId?: string; note?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const requestId = (payload.requestId ?? '').trim()
  const note = (payload.note ?? '').trim()
  if (!requestId) return json({ success: false, error: 'Demande absente.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: result, error: rErr } = await caller.rpc('admin_reject_store_request', {
    p_id: requestId,
    p_note: note,
  })
  if (rErr) return json({ success: false, error: rErr.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Refus impossible.' }, 403)

  // Le refus est enregistré. Un échec d'e-mail se dit, il ne le défait pas.
  const sansAvis = (raison: string) => json({ ...result, emailed: false, error: raison })

  const notify = (result.notify ?? null) as Notify | null
  if (!notify?.email) return sansAvis('demandeur sans compte ou sans adresse')

  if (!Deno.env.get('RESEND_API_KEY')) return sansAvis('Resend non configuré')

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  // Le refus invite à discuter : il faut une adresse où le faire. La
  // personne qui refuse est l'administrateur connecté — c'est elle qu'on met
  // en réponse, à défaut de CONTACT_EMAIL.
  const contact = adresseDeContact(userData.user.email ?? null)
  const magasin = (notify.store_name ?? '').trim()
  const prenom = (notify.first_name ?? '').trim()
  const motif = (notify.note ?? '').trim()
  const suppression = notify.kind === 'remove'

  // Un refus s'annonce sans détour, et laisse une porte ouverte : la plupart se
  // règlent en deux phrases au téléphone.
  const paragraphes = [
    suppression
      ? `Votre demande de suppression du magasin « ${magasin} » n’a pas été retenue. Le magasin reste actif et vos inventaires ne changent pas.`
      : `Votre demande d’ajout du magasin « ${magasin} » n’a pas été retenue pour le moment.`,
  ]
  paragraphes.push(
    motif
      ? (contact
          ? `Vous trouverez ci-dessous le motif transmis par notre équipe. Pour en discuter ou refaire une demande, écrivez-nous à ${contact}.`
          : 'Vous trouverez ci-dessous le motif transmis par notre équipe. Vous pouvez refaire une demande depuis vos magasins.')
      : (contact
          ? `Pour en connaître la raison, ou refaire une demande, écrivez-nous à ${contact}.`
          : 'Vous pouvez refaire une demande depuis vos magasins.'),
  )

  const details = [
    { intitule: suppression ? 'Suppression demandée' : 'Magasin demandé', valeur: magasin },
    ...(notify.company_name ? [{ intitule: 'Entreprise', valeur: notify.company_name }] : []),
    ...(motif ? [{ intitule: 'Motif', valeur: motif }] : []),
  ]

  const { html, text } = emailQuantinvo({
    titre: suppression ? 'Votre demande de suppression n’a pas été retenue' : 'Votre demande de magasin n’a pas été retenue',
    apercu: `Demande refusée pour ${magasin}.`,
    salutation: prenom ? `Bonjour ${prenom},` : 'Bonjour,',
    paragraphes,
    details,
    bouton: { libelle: 'Voir mes magasins', lien: `${appUrl}/magasins` },
    raison: 'Vous recevez ce message parce que vous aviez déposé cette demande sur Quantinvo.',
    siteUrl: appUrl,
  })

  try {
    await envoyerEmail({ to: notify.email, subject: `Votre demande — ${magasin}`, html, text, replyTo: contact })
    return json({ ...result, emailed: true })
  } catch (e) {
    return sansAvis(e instanceof Error ? e.message : String(e))
  }
})
