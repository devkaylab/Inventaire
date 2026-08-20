// Edge function : un administrateur d'entreprise invite un superviseur.
//
// Même squelette qu'invite-supervisor (côté Quantinvo), mais la garde est
// is_company_admin(), revérifiée par la RPC ca_invite_supervisor côté base —
// double authentification conditionnelle comprise. Les magasins affectés
// sont contrôlés par la RPC : impossible d'y glisser le magasin d'une autre
// entreprise.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: { email?: string; firstName?: string; lastName?: string; storeIds?: string[] }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const email = (payload.email ?? '').trim()
  const firstName = (payload.firstName ?? '').trim()
  const lastName = (payload.lastName ?? '').trim()
  const storeIds = Array.isArray(payload.storeIds) ? payload.storeIds : []
  if (!email || !firstName || !lastName) {
    return json({ success: false, error: 'Prénom, nom et e-mail sont requis.' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: result, error: rErr } = await caller.rpc('ca_invite_supervisor', {
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
    p_store_ids: storeIds,
  })
  if (rErr) return json({ success: false, error: rErr.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Refus' }, 403)

  const admin = createClient(url, serviceKey)
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  const redirectTo = `${appUrl}/bienvenue`
  const fullName = `${result.first_name} ${result.last_name}`.trim()
  const metadata = {
    first_name: result.first_name,
    last_name: result.last_name,
    full_name: fullName,
    role: 'supervisor',
  }
  const resendKey = Deno.env.get('RESEND_API_KEY')

  // L'invitation est déjà écrite : si l'e-mail ne part pas, on le dit tel
  // quel — annuler l'invitation depuis « Mon équipe » puis réinviter suffit.
  const sendFailed = (message: string) =>
    json({ success: false, invited: true, error: `Invitation enregistrée, mais l'e-mail n'a pas pu partir : ${message}` }, 500)

  if (!resendKey) {
    const { error: iErr } = await admin.auth.admin.inviteUserByEmail(result.email, {
      redirectTo,
      data: metadata,
    })
    if (iErr) return sendFailed(iErr.message)
    return json({ success: true, email: result.email, via: 'supabase' })
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: result.email,
    options: { redirectTo, data: metadata },
  })
  if (linkErr) return sendFailed(linkErr.message)

  const actionLink = link?.properties?.action_link
  if (!actionLink) return sendFailed('lien absent de la réponse Supabase')

  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="font-weight:800">Quantinvo</h2><p>Bonjour ${result.first_name},</p><p>Votre entreprise vous invite comme superviseur sur Quantinvo. Il ne reste qu'à vérifier vos informations et à choisir votre mot de passe.</p><p style="margin-top:24px"><a href="${actionLink}" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Finaliser mon compte</a></p><p style="color:#666;font-size:13px;margin-top:24px">Ce lien est personnel et à usage unique.</p></div>`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, to: [result.email], subject: 'Votre accès superviseur Quantinvo', html }),
    })
    if (!resp.ok) return sendFailed(`${resp.status} ${await resp.text()}`)
    return json({ success: true, email: result.email, via: 'resend' })
  } catch (e) {
    return sendFailed(e instanceof Error ? e.message : String(e))
  }
})
