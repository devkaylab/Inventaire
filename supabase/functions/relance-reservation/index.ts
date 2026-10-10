// Edge function : la réservation sans carte se relance (10 octobre 2026)
//
// Julien : « Si la réservation n'est pas finalisée, on envoie un lien au bout
// d'un moment pour inviter le client à finaliser sa réservation. »
//
// ⚠️ **CE N'EST PLUS LE COMPTE QUI PEUT RESTER EN PLAN.** Depuis ce matin le
// compte et la réservation partent dans le même geste : un refus ne laisse
// rien derrière lui. Le seul abandon encore possible est **la carte**, et il
// est silencieux — la réservation existe, le prix est figé, mais la fenêtre
// d'accès n'est PAS ouverte. Le client croit avoir réservé ; le jour venu, il
// n'aurait rien.
//
// ⚠️ ELLE N'EST PAS APPELÉE PAR UN NAVIGATEUR mais par la tâche planifiée de
// la base (`declencher_relance_reservation`, toutes les heures à la minute
// 23). D'où `verify_jwt: false` — une tâche `pg_cron` n'a pas de session — et
// d'où la clé partagée, vérifiée **en temps constant**, sur le modèle du
// webhook Stripe et du tour de garde.
//
// ⚠️ ET L'ORDRE COMPTE : on marque **après** l'envoi. Un e-mail qui ne part
// pas laisse la relance ouverte, et l'heure suivante réessaie — l'inverse la
// ferait taire pour de bon sur un incident réseau d'une seconde.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailQuantinvo, envoyerEmail } from '../_shared/email.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Comparaison à temps constant : une comparaison naïve fuit la clé, caractère par caractère. */
function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Une réservation restée sans carte. Sa mémoire vit sur la ligne, pas ici. */
type Relance = {
  id: string
  email: string
  reference: string
  magasin: string | null
  prix_cents: number
  debut_prevu: string
  rang: number
}

const euros = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100)

const enDateLongue = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso))

/**
 * Ce que chaque rang dit, et ce qu'il ne dit pas.
 *
 * ⚠️ **AUCUN DES TROIS NE DIT « VOTRE RÉSERVATION EST CONFIRMÉE »**, parce
 * qu'elle ne l'est pas : c'est la carte qui ouvre la fenêtre, et rien d'autre
 * (`docs/notes/122`). Écrire le contraire ici ferait de ce rappel le mensonge
 * qu'il est censé corriger.
 */
function message(rang: number): { titre: string; phrase: string } {
  if (rang === 1) {
    return {
      titre: 'Il reste une chose à faire pour votre inventaire',
      phrase: 'Votre réservation est prise et votre prix est bloqué. Il manque'
        + ' seulement votre carte : c’est elle qui ouvre vos accès le jour venu.',
    }
  }
  if (rang === 2) {
    return {
      titre: 'Votre inventaire attend votre carte',
      phrase: 'Votre réservation vous attend toujours, au même prix. Tant que'
        + ' votre carte n’est pas enregistrée, vos accès ne s’ouvriront pas.',
    }
  }
  return {
    titre: 'Dernier rappel : votre inventaire',
    phrase: 'C’est notre dernier message à ce sujet. Sans votre carte, vos'
      + ' accès ne s’ouvriront pas au jour choisi.',
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non permise' }, 405)

  const attendue = Deno.env.get('ALERTE_CLE')
  if (!attendue) return json({ success: false, error: 'ALERTE_CLE absente' }, 500)
  const fournie = req.headers.get('x-alerte-cle') ?? ''
  if (!egalConstant(fournie, attendue)) return json({ success: false, error: 'Non autorisé' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'

  const { data, error } = await admin.rpc('missions_a_relancer')
  if (error) return json({ success: false, error: error.message }, 500)
  const aFaire = (data ?? []) as Relance[]

  let envoyees = 0
  const manquees: string[] = []

  for (const r of aFaire) {
    if (!r.email) continue
    const { titre, phrase } = message(r.rang)
    // ⚠️ **LE LIEN MÈNE À LA CARTE, PAS AU DÉBUT DU TUNNEL.** `?carte=…&mission=…`
    // est la porte que le retour de Stripe emprunte déjà : elle ouvre l'écran
    // de la carte sur CETTE réservation. Renvoyer vers `/reserver` nu lui
    // ferait recommencer un parcours qu'il a terminé.
    const lien = `${appUrl}/reserver?carte=reprendre&mission=${r.id}`
    const { html, text } = emailQuantinvo({
      titre,
      apercu: 'Il manque votre carte pour ouvrir vos accès.',
      salutation: 'Bonjour,',
      paragraphes: [phrase],
      details: [
        { libelle: 'Référence', valeur: r.reference },
        ...(r.magasin ? [{ libelle: 'Magasin', valeur: r.magasin }] : []),
        { libelle: 'À partir du', valeur: enDateLongue(r.debut_prevu) },
        { libelle: 'Montant', valeur: euros(r.prix_cents) },
      ],
      bouton: { libelle: 'Enregistrer ma carte', lien },
      note: 'Rien n’est débité aujourd’hui : nous vérifions seulement que la'
        + ' carte est valide. Le prélèvement a lieu à la fin de vos sept jours.',
      raison: 'Vous recevez ce message parce que vous avez réservé un inventaire sur Quantinvo.',
      siteUrl: appUrl,
    })
    try {
      await envoyerEmail({ to: [r.email], subject: titre, html, text })
      await admin.rpc('marquer_relance_mission', { p_mission: r.id })
      envoyees++
    } catch (e) {
      // On ne marque pas : l'heure suivante réessaiera.
      console.error('relance-reservation', r.reference, e instanceof Error ? e.message : e)
      manquees.push(r.reference)
    }
  }

  return json({ success: true, a_faire: aFaire.length, envoyees, manquees })
})
