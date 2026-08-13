// Edge function : valider (ou refuser) une demande d'inscription de superviseur.
//
// Réservée à l'administrateur Quantinvo. En cas de validation :
//   1. `admin_review_supervisor_request` passe la demande en 'approved' ;
//   2. l'utilisateur auth est créé par invitation Supabase — c'est lui qui
//      choisira son mot de passe via le lien reçu, jamais nous ;
//   3. à sa première connexion, `handle_new_user` lit la demande approuvée et
//      crée le profil superviseur, rattaché à l'entreprise et affecté au
//      magasin du code fourni dans la demande.
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

  // Invitation Supabase : envoie le lien de création de mot de passe et crée
  // l'utilisateur auth. Le prénom / nom voyagent en métadonnées pour que
  // `handle_new_user` les reprenne sans que la personne ait à les ressaisir.
  const { error: iErr } = await admin.auth.admin.inviteUserByEmail(review.email, {
    redirectTo: `${appUrl}/bienvenue`,
    data: {
      first_name: review.first_name,
      last_name: review.last_name,
      full_name: `${review.first_name} ${review.last_name}`.trim(),
      role: 'supervisor',
    },
  })
  if (iErr) {
    // La demande est déjà passée en 'approved' : on le signale pour que
    // l'administrateur puisse relancer l'envoi sans rejouer la validation.
    return json(
      { success: false, approved: true, error: `Demande validée, mais l'e-mail n'a pas pu partir : ${iErr.message}` },
      500,
    )
  }

  return json({ success: true, approved: true, email: review.email })
})
