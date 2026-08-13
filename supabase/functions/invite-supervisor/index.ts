// Edge function : valider (ou refuser) une demande d'inscription de superviseur.
//
// Réservée à l'administrateur Quantinvo. En cas de validation :
//   1. `admin_review_supervisor_request` passe la demande en 'approved' ;
//   2. l'utilisateur auth est créé et le lien de finalisation envoyé — c'est
//      la personne qui choisira son mot de passe, jamais nous ;
//   3. `handle_new_user`, déclenché par cet INSERT dans auth.users, crée le
//      profil superviseur, rattaché à l'entreprise et affecté au magasin du
//      code fourni dans la demande.
//
// Le mot de passe n'est donc défini nulle part côté serveur, et le magasin
// n'est jamais choisi par la personne : il vient du code magasin remis par
// l'administrateur de l'entreprise.
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

  let payload: { requestId?: string; approve?: boolean; note?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const requestId = payload.requestId?.trim()
  const approve = payload.approve !== false
  const note = (payload.note ?? '').trim()
  if (!requestId) return json({ success: false, error: 'Demande manquante.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  // `admin_review_supervisor_request` revérifie `is_admin()` côté base : cette
  // fonction ne fait donc pas autorité sur les droits, elle les délègue.
  const { data: review, error: rErr } = await caller.rpc('admin_review_supervisor_request', {
    p_id: requestId,
    p_approve: approve,
    p_note: note,
  })
  if (rErr) return json({ success: false, error: rErr.message }, 500)
  if (!review?.success) return json({ success: false, error: review?.error ?? 'Refus' }, 403)

  if (!approve) return json({ success: true, approved: false })

  const admin = createClient(url, serviceKey)
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  const redirectTo = `${appUrl}/bienvenue`
  const fullName = `${review.first_name} ${review.last_name}`.trim()
  const metadata = {
    first_name: review.first_name,
    last_name: review.last_name,
    full_name: fullName,
    role: 'supervisor',
  }
  const resendKey = Deno.env.get('RESEND_API_KEY')

  // La demande est déjà passée en 'approved' : tout échec d'envoi est signalé
  // comme tel, pour que l'administrateur relance l'e-mail sans rejouer la
  // validation (que `admin_review_supervisor_request` refuserait).
  const sendFailed = (message: string) =>
    json({ success: false, approved: true, error: `Demande validée, mais l'e-mail n'a pas pu partir : ${message}` }, 500)

  // Sans Resend, on s'en remet au SMTP intégré de Supabase — fortement limité
  // en débit, mais suffisant pour des validations à l'unité.
  if (!resendKey) {
    const { error: iErr } = await admin.auth.admin.inviteUserByEmail(review.email, {
      redirectTo,
      data: metadata,
    })
    if (iErr) return sendFailed(iErr.message)
    return json({ success: true, approved: true, email: review.email, via: 'supabase' })
  }

  // `generateLink` crée l'utilisateur auth et renvoie le lien sans envoyer :
  // l'e-mail part par Resend, avec notre gabarit et notre domaine.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: review.email,
    options: { redirectTo, data: metadata },
  })
  if (linkErr) return sendFailed(linkErr.message)

  const actionLink = link?.properties?.action_link
  if (!actionLink) return sendFailed('lien absent de la réponse Supabase')

  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#111"><h2 style="font-weight:800">Quantinvo</h2><p>Bonjour ${review.first_name},</p><p>Votre demande d'accès superviseur a été validée. Il ne reste qu'à vérifier vos informations et à choisir votre mot de passe.</p><p style="margin-top:24px"><a href="${actionLink}" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Finaliser mon compte</a></p><p style="color:#666;font-size:13px;margin-top:24px">Ce lien est personnel et à usage unique.</p></div>`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, to: [review.email], subject: 'Votre accès Quantinvo est validé', html }),
    })
    if (!resp.ok) return sendFailed(`${resp.status} ${await resp.text()}`)
    return json({ success: true, approved: true, email: review.email, via: 'resend' })
  } catch (e) {
    return sendFailed(e instanceof Error ? e.message : String(e))
  }
})
