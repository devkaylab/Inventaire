// Edge function : « mot de passe oublié », envoyé par Quantinvo (20 septembre 2026).
//
// ⚠️ **CONSTAT DE JULIEN, EN RECEVANT LE MESSAGE** : « c'est un mail supabase
// qu'on reçoit, pas de quantinvo, il faut changer ça ». C'était le SEUL
// courriel du produit hors du gabarit maison : les douze autres passent par
// `_shared/email.ts` (fiche 012, « un seul gabarit »), celui-ci partait du
// serveur d'authentification avec son propre modèle et son propre expéditeur.
//
// ⚠️ ET CE N'EST PAS QU'UNE QUESTION DE CHARTE. Un message d'un expéditeur
// inconnu, sans logo, avec un lien à cliquer et une urgence implicite, a
// exactement la forme d'un hameçonnage. On apprend à nos clients à s'en
// méfier ; il ne faut pas être celui qui leur en envoie.
//
// ⚠️ **LE LIEN VIENT DE `auth.admin.generateLink`, PAS D'ICI.** Fabriquer un
// jeton de récupération à la main serait fabriquer une seconde porte d'entrée
// dans les comptes. Supabase reste l'autorité : on lui demande le lien qu'il
// aurait mis dans son propre e-mail, et on le met dans le nôtre.
//
// ⚠️ **LA RÉPONSE EST TOUJOURS LA MÊME**, que l'adresse ait un compte ou non :
// `{success: true, received: true}`. Rendre `compte_inconnu` ferait de ce
// formulaire un oracle d'énumération d'adresses — le défaut fermé le 28 août
// 2026 sur les formulaires publics, à ne pas rouvrir un cran plus haut.
//
// ⚠️ **LE QUOTA EST EN BASE, PAS ICI** (`demander_reinitialisation`, cinq par
// heure et par adresse). Supabase appliquait le sien ; en passant par l'API
// d'administration on le perd, et une fonction publique sans quota est un
// envoi de courriel gratuit vers n'importe quelle adresse, signé Quantinvo.
//
// Déployée en `verify_jwt: false` : quelqu'un qui a oublié son mot de passe
// n'a pas de session.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo, envoyerEmail, SITE_PAR_DEFAUT } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/**
 * ⚠️ **LA REDIRECTION N'EST PAS CELLE QUE L'APPELANT DEMANDE.** Un
 * `redirectTo` libre ferait de cette fonction un envoyeur de liens de
 * récupération vers le domaine de son choix : il suffirait de demander une
 * réinitialisation pour une adresse qu'on ne possède pas et d'espérer un clic
 * depuis un site qu'on contrôle. Seuls les hôtes du produit sont acceptés ; le
 * reste retombe sur le site public.
 */
function redirectionSure(demande: unknown): string {
  const defaut = `${SITE_PAR_DEFAUT}/reinitialisation`
  if (typeof demande !== 'string' || !demande) return defaut
  let u: URL
  try { u = new URL(demande) } catch { return defaut }
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') return defaut
  const hotes = [
    'www.quantinvo.com', 'quantinvo.com', 'localhost',
  ]
  const previsualisation = u.hostname.endsWith('.vercel.app')
  if (!hotes.includes(u.hostname) && !previsualisation) return defaut
  if (u.pathname !== '/reinitialisation') return defaut
  return u.toString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  // ⚠️ MÊME RÉPONSE DANS TOUS LES CAS, jusqu'aux échecs d'envoi : une erreur
  // qui ne sort que pour les adresses connues est un oracle plus discret, pas
  // moins efficace.
  const recu = () => json({ success: true, received: true })

  let corps: { email?: string; redirectTo?: string }
  try { corps = await req.json() } catch { return recu() }

  const email = (corps.email ?? '').trim()
  const redirectTo = redirectionSure(corps.redirectTo)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await admin.rpc('demander_reinitialisation', { p_email: email })
  if (error) {
    console.error('demander_reinitialisation', error.message)
    return recu()
  }
  const issue = (data as { outcome?: string; prenom?: string } | null)?.outcome
  if (issue !== 'a_envoyer') return recu()
  const prenom = (data as { prenom?: string | null }).prenom ?? null

  const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })
  if (erreurLien || !lien?.properties?.action_link) {
    console.error('generateLink', erreurLien?.message ?? 'lien absent')
    return recu()
  }

  const { html, text } = emailQuantinvo({
    titre: 'Choisir un nouveau mot de passe',
    apercu: 'Le lien est valable une heure et ne sert qu’une fois.',
    salutation: prenom ? `Bonjour ${prenom},` : undefined,
    paragraphes: [
      'Vous avez demandé à changer le mot de passe de votre compte Quantinvo. Le bouton ci-dessous ouvre la page où le choisir.',
      // ⚠️ La phrase qui compte est celle-ci, et elle est en clair : c'est la
      // seule protection de quelqu'un dont l'adresse sert à autre chose.
      'Si vous n’avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable, et personne n’a eu accès à votre compte.',
    ],
    bouton: { libelle: 'Choisir un nouveau mot de passe', lien: lien.properties.action_link },
    note: 'Ce lien est valable une heure et ne fonctionne qu’une seule fois.',
    raison: 'Vous recevez ce message parce qu’une réinitialisation a été demandée pour cette adresse.',
  })

  try {
    await envoyerEmail({
      to: email,
      subject: 'Votre lien pour choisir un nouveau mot de passe',
      html,
      text,
    })
  } catch (e) {
    console.error('envoi', e instanceof Error ? e.message : String(e))
  }
  return recu()
})
