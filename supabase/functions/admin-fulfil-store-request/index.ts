// Edge function : Quantinvo crée le magasin demandé, et le demandeur est
// prévenu (22 août 2026).
//
// La création reste entièrement dans `admin_fulfil_store_request`, appelée
// **avec le jeton de l'administrateur Quantinvo** — donc gardée par is_admin(),
// exigence de double authentification comprise. L'edge ne fait qu'écrire
// l'e-mail par-dessus, à partir de l'objet `notify` que la RPC renvoie.
//
// Le **code d'accès du magasin n'est pas envoyé** : il ouvre l'entrée dans le
// magasin. L'e-mail renvoie vers la fiche, où il se lit derrière une session.
//
// La console retombe sur la RPC directe si cette fonction est injoignable : le
// magasin est créé sans e-mail, plutôt que pas créé du tout.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo } from '../_shared/email.ts'

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
  store_id?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: { requestId?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const requestId = (payload.requestId ?? '').trim()
  if (!requestId) return json({ success: false, error: 'Demande absente.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: result, error: rErr } = await caller.rpc('admin_fulfil_store_request', { p_id: requestId })
  if (rErr) return json({ success: false, error: rErr.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Création impossible.' }, 403)

  // Le magasin existe. Un échec d'e-mail se dit, il n'annule rien.
  const sansAvis = (raison: string) => json({ ...result, emailed: false, error: raison })

  const notify = (result.notify ?? null) as Notify | null
  if (!notify?.email) return sansAvis('demandeur sans compte ou sans adresse')

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return sansAvis('Resend non configuré')

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  const magasin = (notify.store_name ?? '').trim()
  const prenom = (notify.first_name ?? '').trim()
  const lien = notify.store_id ? `${appUrl}/magasins/${notify.store_id}` : `${appUrl}/magasins`

  const { html, text } = emailQuantinvo({
    titre: 'Votre magasin est créé',
    apercu: `${magasin} est prêt à recevoir ses inventaires.`,
    salutation: prenom ? `Bonjour ${prenom},` : 'Bonjour,',
    paragraphes: [
      `Le magasin « ${magasin} » a été créé sur Quantinvo. Il est prêt à recevoir ses inventaires.`,
      'Sa fiche vous donne son code d’accès, à communiquer à vos équipes, et vous pouvez dès maintenant y affecter un superviseur.',
    ],
    details: [
      { intitule: 'Magasin', valeur: magasin },
      ...(notify.company_name ? [{ intitule: 'Entreprise', valeur: notify.company_name }] : []),
    ],
    bouton: { libelle: 'Ouvrir la fiche du magasin', lien },
    note: 'Le code d’accès ne circule pas par e-mail : il se lit sur la fiche, une fois connecté.',
    raison: 'Vous recevez ce message parce que vous aviez demandé l’ajout de ce magasin.',
    siteUrl: appUrl,
  })

  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddr,
        to: [notify.email],
        subject: `Votre magasin ${magasin} est créé`,
        html,
        text,
      }),
    })
    if (!resp.ok) return sansAvis(`${resp.status} ${await resp.text()}`)
    return json({ ...result, emailed: true })
  } catch (e) {
    return sansAvis(e instanceof Error ? e.message : String(e))
  }
})
