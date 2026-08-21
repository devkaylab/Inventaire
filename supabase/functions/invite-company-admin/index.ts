// Edge function : nommer un administrateur d'entreprise.
//
// Réservée à l'administrateur Quantinvo (la RPC revérifie is_admin() côté
// base — cette fonction ne fait pas autorité sur les droits, elle les
// délègue). Deux issues :
//   - le compte existe déjà dans l'entreprise → promotion immédiate, pas
//     d'e-mail à envoyer ;
//   - le compte n'existe pas → l'invitation 'company_admin' est écrite par
//     la RPC, l'utilisateur auth est créé ici et le lien de finalisation
//     envoyé. handle_new_user créera le profil (role supervisor + drapeau).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo } from '../_shared/email.ts'

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

  let payload: { companyId?: string; email?: string; firstName?: string; lastName?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }
  const companyId = payload.companyId?.trim()
  const email = (payload.email ?? '').trim()
  const firstName = (payload.firstName ?? '').trim()
  const lastName = (payload.lastName ?? '').trim()
  if (!companyId || !email) return json({ success: false, error: 'Entreprise et e-mail requis.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  if (userErr || !userData?.user) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: result, error: rErr } = await caller.rpc('admin_invite_company_admin', {
    p_company: companyId,
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
  })
  if (rErr) return json({ success: false, error: rErr.message }, 500)
  if (!result?.success) return json({ success: false, error: result?.error ?? 'Refus' }, 403)

  // Compte déjà présent dans l'entreprise : promu, rien à envoyer.
  if (result.mode === 'promoted') {
    return json({ success: true, mode: 'promoted', full_name: result.full_name ?? '' })
  }

  const admin = createClient(url, serviceKey)
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  const redirectTo = `${appUrl}/bienvenue`
  const fullName = `${result.first_name} ${result.last_name}`.trim()
  const metadata = {
    first_name: result.first_name,
    last_name: result.last_name,
    full_name: fullName,
    role: 'company_admin',
  }
  const resendKey = Deno.env.get('RESEND_API_KEY')

  // L'invitation est déjà écrite : tout échec d'envoi est signalé comme tel,
  // pour relancer l'e-mail sans réécrire l'invitation.
  const sendFailed = (message: string) =>
    json({ success: false, invited: true, error: `Invitation enregistrée, mais l'e-mail n'a pas pu partir : ${message}` }, 500)

  if (!resendKey) {
    const { error: iErr } = await admin.auth.admin.inviteUserByEmail(result.email, {
      redirectTo,
      data: metadata,
    })
    if (iErr) return sendFailed(iErr.message)
    return json({ success: true, mode: 'invited', email: result.email, via: 'supabase' })
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
  const { html, text } = emailQuantinvo({
    titre: 'Votre accès administrateur',
    salutation: `Bonjour ${result.first_name},`,
    paragraphes: [
      'Vous êtes invité comme administrateur de votre entreprise sur Quantinvo : vous pourrez gérer vos superviseurs et leurs magasins.',
      "Il ne reste qu'à vérifier vos informations et à choisir votre mot de passe.",
    ],
    bouton: { libelle: 'Finaliser mon compte', lien: actionLink },
    note: 'Ce lien est personnel et à usage unique.',
    raison: 'Vous recevez ce message parce que Quantinvo vous a désigné administrateur de votre entreprise.',
    siteUrl: appUrl,
  })

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, to: [result.email], subject: 'Votre accès administrateur Quantinvo', html, text }),
    })
    if (!resp.ok) return sendFailed(`${resp.status} ${await resp.text()}`)
    return json({ success: true, mode: 'invited', email: result.email, via: 'resend' })
  } catch (e) {
    return sendFailed(e instanceof Error ? e.message : String(e))
  }
})
