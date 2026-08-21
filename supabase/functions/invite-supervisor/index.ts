// Validation des demandes d'accès superviseur — ÉTEINTE le 21 août 2026.
//
// Cette fonction validait une demande déposée sur le formulaire public et
// envoyait l'invitation. Le formulaire est éteint, la section de la console
// supprimée, et admin_review_supervisor_request n'existe plus (migration
// 20260821140001).
//
// Les invitations de superviseur passent désormais par ca-invite-supervisor
// (administrateur d'entreprise) ou invite-company-admin (Quantinvo). Ce
// point d'entrée répond 410 Gone et peut être supprimé de la console
// Supabase quand plus rien ne l'appelle.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  return new Response(
    JSON.stringify({
      success: false,
      gone: true,
      error: "Parcours éteint : les superviseurs sont invités depuis l'espace « Mon équipe ».",
    }),
    { status: 410, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
})
