// Renvoyer le lien de création de mot de passe à un membre de SON entreprise.
//
// ⚠️⚠️ **POURQUOI UNE SECONDE FONCTION, ET PAS UN DRAPEAU SUR L'AUTRE.**
// `mot-de-passe-oublie` est PUBLIQUE et répond toujours la même chose, qu'un
// compte existe ou non : sans ça, le formulaire devient un oracle
// d'énumération d'adresses. Lui ajouter un « dis-moi la vérité si je suis
// administrateur » mettrait les deux publics dans le même code, et un jour le
// mauvais passerait par le bon chemin. Deux publics, deux fonctions.
//
// Ici l'appelant est authentifié et la personne visée est **déjà visible** par
// lui : il n'a aucune adresse à découvrir. Le détail peut donc sortir — et il
// DOIT sortir, parce que le silence a coûté une heure à Julien le 10 octobre
// 2026, l'écran annonçant deux fois « un lien vient de partir » quand rien ne
// partait.
//
// ⚠️ **LA DÉCISION RESTE À LA BASE** : on appelle `renvoyer_le_lien_au_membre`
// AVEC LE JETON DE L'APPELANT, donc sous `auth.uid()`. La RPC tient les bornes
// (même entreprise, droit calculé sur la ligne visée, compte non fini, quota
// partagé avec le formulaire public). L'edge ne fait que ce que la base ne sait
// pas faire : demander le lien à Supabase, et envoyer le courriel.
//
// ⚠️ **AUCUN `redirectTo` NE VIENT DU CLIENT.** L'autre fonction en accepte un
// et le borne ; celle-ci n'en accepte pas du tout — il n'y a qu'une destination
// possible, donc pas de surface de redirection ouverte à défendre.
//
// Déployée en `verify_jwt: true` : il faut une session pour renvoyer un lien.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DUREE_LIEN, emailQuantinvo, envoyerEmail, SITE_PAR_DEFAUT } from '../_shared/email.ts'
import { lienDuCourriel } from '../_shared/lienDuCourriel.ts'

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

  let payload: { userId?: string }
  try { payload = await req.json() } catch { return json({ success: false, error: 'Requête invalide' }, 400) }
  const userId = (payload.userId ?? '').trim()
  if (!userId) return json({ success: false, error: 'Personne requise.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: rpc, error: rpcErr } = await caller.rpc('renvoyer_le_lien_au_membre', { p_user: userId })
  if (rpcErr) return json({ success: false, code: 'base', error: rpcErr.message }, 500)

  const res = rpc as {
    success?: boolean; code?: string; error?: string
    email?: string; nom?: string | null; prenom?: string | null
  } | null
  if (!res?.success || !res.email) {
    return json({ success: false, code: res?.code ?? 'refus', error: res?.error ?? 'Envoi impossible.' })
  }

  const email = res.email
  const site = Deno.env.get('APP_PUBLIC_URL') ?? SITE_PAR_DEFAUT
  const redirectTo = `${site}/reinitialisation`

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
    type: 'recovery', email, options: { redirectTo },
  })
  // ⚠️ PAS `action_link` : l'analyse des liens de Microsoft 365 l'ouvrirait
  // avant la personne et grillerait le jeton (fiche 120).
  const lienDuBouton = erreurLien ? null : lienDuCourriel(lien?.properties, redirectTo)
  if (!lienDuBouton) {
    const detail = erreurLien?.message ?? 'lien absent'
    console.error('[renvoi] generateLink', detail)
    // ⚠️ C'EST L'ÉCHEC QUI ÉTAIT MUET, et c'est celui qui est arrivé. On rend
    // le motif brut en plus de la phrase : c'est ce qui aurait fait gagner
    // l'heure perdue.
    return json({
      success: false, code: 'lien_impossible', detail,
      error: 'Le serveur d’authentification n’a pas pu produire de lien pour cette adresse. Rien n’a été envoyé.',
    })
  }

  const { html, text } = emailQuantinvo({
    titre: 'Choisir votre mot de passe',
    apercu: `Le lien est valable ${DUREE_LIEN} et ne sert qu’une fois.`,
    salutation: res.prenom ? `Bonjour ${res.prenom},` : 'Bonjour,',
    paragraphes: [
      'Votre compte Quantinvo vous attend : le bouton ci-dessous ouvre la page où choisir votre mot de passe.',
      'Si vous n’attendiez pas ce message, ignorez-le : sans mot de passe, le compte reste inutilisable.',
    ],
    bouton: { libelle: 'Choisir mon mot de passe', lien: lienDuBouton },
    note: `Ce lien est valable ${DUREE_LIEN} et ne fonctionne qu’une seule fois.`,
    raison: 'Vous recevez ce message parce qu’un responsable de votre entreprise vous a renvoyé votre lien d’accès.',
    siteUrl: site,
  })

  try {
    await envoyerEmail({ to: email, subject: 'Votre lien pour choisir votre mot de passe', html, text })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error('[renvoi] envoi', detail)
    return json({
      success: false, code: 'envoi_impossible', detail,
      error: 'Le lien a bien été produit, mais l’e-mail n’a pas pu partir.',
    })
  }

  return json({ success: true, email, nom: res.nom ?? null })
})
