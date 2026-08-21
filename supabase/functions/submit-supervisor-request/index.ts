// Parcours public de demande d'accès superviseur — ÉTEINT le 21 août 2026.
//
// Les accès superviseur sont désormais ouverts par l'administrateur de
// l'entreprise (espace /equipe). Les fonctions de base qu'appelait cette
// edge function ont été supprimées (migration 20260821140001).
//
// Le point d'entrée est conservé le temps que d'éventuels appels résiduels
// s'éteignent — il répond 410 Gone, sans rien collecter ni écrire. Il peut
// être supprimé de la console Supabase quand plus rien ne l'appelle.
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
      error: "Les accès superviseur sont désormais ouverts par l'administrateur de votre entreprise.",
    }),
    { status: 410, headers: { ...cors, 'Content-Type': 'application/json' } },
  )
})
