// Le lien qu'on met dans un courriel d'invitation ou de réinitialisation
// (5 octobre 2026).
//
// ⚠️ **CONSTAT DU 5 OCTOBRE 2026, EN PRODUCTION** : Julia (samaritaine.com,
// messagerie Microsoft 365) reçoit son invitation, clique, lit « Lien
// expiré ». Puis pareil pour deux « mot de passe oublié » de suite. Les
// journaux d'authentification disent pourquoi : 16 secondes après chaque
// `generate_link`, une adresse Microsoft (4.251.x.x, après un HEAD depuis
// 104.47.x.x, Exchange Online) ouvre `/verify` et CONSOMME le jeton. Le clic
// de Julia arrive ensuite : « One-time token not found ».
//
// C'est l'analyse des liens de la messagerie (Safe Links), pas un défaut de
// Supabase : elle ouvre chaque lien avant le destinataire. Un jeton à usage
// unique placé directement dans l'e-mail est donc grillé avant d'être lu, chez
// tous les clients d'entreprise sous Microsoft 365.
//
// ⚠️ **D'OÙ CE LIEN : IL POINTE VERS NOTRE PAGE, PAS VERS `/verify`.** Il
// porte l'empreinte du jeton (`token_hash`), que la page ne présente à
// Supabase (`verifyOtp`) qu'au clic sur « Continuer ». Le robot ouvre la page,
// ne clique pas, le jeton reste valable. Le lien vient toujours de
// `generateLink` : on n'en fabrique aucun, on le présente autrement.
//
// `action_link` n'est plus mis dans un e-mail. Il reste ce que Supabase rend.

type Proprietes = { hashed_token?: string; verification_type?: string } | null | undefined

/** `null` si Supabase n'a pas rendu de quoi construire le lien. */
export function lienDuCourriel(proprietes: Proprietes, pageDArrivee: string): string | null {
  const jeton = proprietes?.hashed_token
  const type = proprietes?.verification_type
  if (!jeton || !type) return null
  const u = new URL(pageDArrivee)
  u.searchParams.set('token_hash', jeton)
  u.searchParams.set('type', type)
  return u.toString()
}
