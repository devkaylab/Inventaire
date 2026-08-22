// Edge function : inviter une personne à un inventaire précis.
// - Vérifie que l'appelant est participant de l'inventaire (RLS).
// - Même entreprise uniquement.
// - La personne doit déjà avoir un compte : un inventaire ne se peuple pas
//   d'inconnus.
// - Envoie un e-mail (Resend, si configuré) + une notification push (Expo).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Role = 'supervisor' | 'counter'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ success: false, error: 'Non authentifié' }, 401)

  let payload: { sessionId?: string; email?: string; fullName?: string; role?: Role }
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'Requête invalide' }, 400)
  }

  const sessionId = payload.sessionId?.trim()
  const email = payload.email?.trim().toLowerCase()
  const fullName = (payload.fullName ?? '').trim()
  const role: Role = payload.role === 'supervisor' ? 'supervisor' : 'counter'

  if (!sessionId || !email || !email.includes('@')) {
    return json({ success: false, error: 'Nom ou e-mail manquant.' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Client « appelant » (RLS) pour identifier l'utilisateur et vérifier l'accès.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await caller.auth.getUser()
  const inviter = userData?.user
  if (userErr || !inviter) return json({ success: false, error: 'Session expirée.' }, 401)

  const { data: canAccess, error: accessErr } = await caller.rpc('is_session_participant', {
    p_session_id: sessionId,
  })
  if (accessErr || !canAccess) {
    return json({ success: false, error: "Vous n'avez pas accès à cet inventaire." }, 403)
  }

  // Client service-role pour les écritures privilégiées.
  const admin = createClient(url, serviceKey)

  const { data: session, error: sErr } = await admin
    .from('inventory_sessions')
    .select('id, name, inventory_number, store_name, company_id')
    .eq('id', sessionId)
    .single()
  if (sErr || !session) return json({ success: false, error: 'Inventaire introuvable.' }, 404)

  // Empêcher de s'inviter soi-même par e-mail (bruit inutile).
  const inviterEmail = inviter.email?.toLowerCase()

  const { data: existing } = await admin.rpc('find_user_by_email', { p_email: email })
  const found = Array.isArray(existing) && existing.length > 0 ? existing[0] : null

  // Un inventaire ne se peuple que de profils existants. L'écran d'invitation
  // ne propose déjà que l'annuaire du magasin, mais la règle doit tenir ici
  // aussi : sans cette garde, un appel direct à l'API créait une invitation en
  // attente pour un inconnu, qui devenait un profil à sa première inscription.
  if (!found) {
    return json(
      {
        success: false,
        error:
          "Cette personne n'a pas encore de compte Quantinvo. Ajoutez-la d'abord à votre équipe, puis invitez-la à l'inventaire une fois son compte créé.",
      },
      404,
    )
  }
  if (found.company_id !== session.company_id) {
    // Même situation que dans `invite-teammate`, même formulation : le compte
    // existe, mais dans une autre entreprise. On ne dit pas laquelle.
    return json({
      success: false,
      code: 'other_company',
      error:
        'Cette personne appartient déjà à une autre entreprise, et un compte ne peut être ' +
        "rattaché qu'à une seule. Demandez à l'administrateur de votre entreprise de s'en " +
        'occuper, ou ajoutez cette personne avec une autre adresse e-mail.',
    }, 409)
  }

  // Ajout direct comme membre de l'inventaire.
  const { error: mErr } = await admin
    .from('session_members')
    .upsert({ session_id: sessionId, user_id: found.user_id, role }, { onConflict: 'session_id,user_id' })
  if (mErr) return json({ success: false, error: mErr.message }, 500)
  const outcome: 'added' = 'added'

  const sessionLabel = session.name || session.inventory_number
  const roleLabel = role === 'supervisor' ? 'co-superviseur' : 'compteur'

  // ── Notification push (si la personne a déjà l'app) ────────────────────────
  let pushSent = false
  if (email !== inviterEmail) {
    try {
      const { data: tokens } = await admin
        .from('push_tokens')
        .select('token')
        .eq('user_id', found.user_id)
      const messages = (tokens ?? []).map((t: { token: string }) => ({
        to: t.token,
        sound: 'default',
        title: 'Nouvel inventaire',
        body: `Vous avez été ajouté à « ${sessionLabel} » (${session.store_name}) en tant que ${roleLabel}.`,
        data: { sessionId },
      }))
      if (messages.length > 0) {
        const resp = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(messages),
        })
        pushSent = resp.ok
      }
    } catch (_e) {
      // le push est best-effort : on n'échoue pas l'invitation pour autant
    }
  }

  // ── E-mail (Resend, si configuré) ──────────────────────────────────────────
  let emailSent = false
  let emailError: string | null = null
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromAddr = Deno.env.get('INVITE_FROM_EMAIL') ?? 'Quantinvo <onboarding@resend.dev>'
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://quantinvo.vercel.app'
  if (resendKey) {
    const greeting = fullName ? `Bonjour ${fullName},` : 'Bonjour,'
    const { html, text } = emailQuantinvo({
      titre: 'Vous participez à un inventaire',
      salutation: greeting,
      paragraphes: [
        "Vous avez été ajouté à un inventaire. Ouvrez l'application Quantinvo sur votre téléphone pour y accéder.",
      ],
      details: [
        { intitule: 'Inventaire', valeur: sessionLabel },
        { intitule: 'Magasin', valeur: session.store_name },
        { intitule: 'Votre rôle', valeur: roleLabel },
      ],
      bouton: { libelle: 'Ouvrir Quantinvo', lien: `${appUrl}/open` },
      raison: 'Vous recevez ce message parce que votre superviseur vous a ajouté à cet inventaire.',
      siteUrl: appUrl,
    })
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromAddr,
          to: [email],
          subject: `Invitation à un inventaire — ${sessionLabel}`,
          html,
          text,
        }),
      })
      emailSent = resp.ok
      const bodyText = await resp.text()
      if (!resp.ok) {
        console.error('[invite] Resend error', resp.status, bodyText)
        emailError = `${resp.status} ${bodyText}`
      } else {
        console.log('[invite] Resend ok', bodyText)
      }
    } catch (e) {
      console.error('[invite] Resend fetch failed', e)
      emailError = e instanceof Error ? e.message : String(e)
    }
  } else {
    console.log('[invite] RESEND_API_KEY absent — e-mail non envoyé')
    emailError = 'RESEND_API_KEY absent'
  }

  return json({ success: true, outcome, emailSent, pushSent, emailError })
})
