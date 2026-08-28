// Edge function : le tour de garde. Prévient quand un paiement reste sans
// suite, ou quand le ménage quotidien cesse de se faire (28 août 2026).
//
// Dernier manque relevé par la revue de sécurité : les journaux existaient,
// **personne n'était prévenu de rien**. Le cas qui coûte de l'argent est
// toujours le même — un client paie par carte, le webhook Stripe ne passe pas,
// l'entreprise n'est jamais créée. Le client a payé, il n'a rien, et nous
// l'apprenons quand il écrit.
//
// ⚠️ ON SURVEILLE LE RÉSULTAT, PAS LA MACHINE. Pas les erreurs techniques des
// fonctions — elles sont bruyantes, et la plupart se règlent seules. Deux
// questions seulement, posées toutes les heures : *y a-t-il un paiement
// encaissé dont rien n'a été créé ?* et *le ménage quotidien a-t-il eu lieu ?*
// La détection vit en base (`anomalies_a_signaler`), qui porte aussi les délais
// de grâce — quinze minutes pour les nouvelles tentatives de Stripe,
// quarante-huit heures pour la purge, qui ne passe qu'une fois par jour.
//
// La seconde question remplace une vérification que Julien aurait dû faire à
// la main chaque matin. Une vérification dont un humain est responsable
// s'arrête au bout de trois jours.
//
// ⚠️ ELLE N'EST PAS APPELÉE PAR UN NAVIGATEUR mais par la tâche planifiée de
// la base (`declencher_alerte`, toutes les heures à la minute 7). D'où
// `verify_jwt: false` — une tâche `pg_cron` n'a pas de session — et d'où la
// clé partagée, vérifiée **en temps constant**, sur le modèle du webhook
// Stripe. Sans elle, n'importe qui pourrait faire sonner la boîte de Julien.
//
// ⚠️ ET L'ORDRE COMPTE : on marque l'alerte **après** l'envoi. Un e-mail qui
// ne part pas laisse donc l'anomalie ouverte, et l'heure suivante réessaie —
// l'inverse la ferait taire pour de bon sur un incident réseau d'une seconde.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { adresseDeContact, emailQuantinvo, envoyerEmail } from '../_shared/email.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Comparaison à temps constant : une comparaison naïve fuit la clé, caractère par caractère. */
function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type Anomalie = {
  cle: string
  nature: string
  objet: string | null
  montant_centimes: number | null
  depuis: string | null
  parcours: string
}

const euros = (centimes: number | null) =>
  centimes == null ? 'montant inconnu' : `${(centimes / 100).toLocaleString('fr-FR')} €`

/** « il y a 3 h », « il y a 2 j » — le retard est ce qui donne l'urgence. */
function depuisQuand(iso: string | null): string {
  if (!iso) return 'depuis peu'
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 90) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 48) return `il y a ${heures} h`
  return `il y a ${Math.floor(heures / 24)} j`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405)

  const attendue = Deno.env.get('ALERTE_CLE')
  if (!attendue) return json({ success: false, error: 'ALERTE_CLE absente' }, 500)

  const fournie = req.headers.get('x-alerte-cle') ?? ''
  if (!egalConstant(fournie, attendue)) return json({ success: false, error: 'Accès refusé' }, 403)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  const { data: brut, error } = await admin.rpc('anomalies_a_signaler')
  if (error) return json({ success: false, error: error.message }, 500)

  const anomalies = (brut ?? []) as Anomalie[]
  // Le silence est le cas normal, et c'est ce qui rend l'alerte crédible.
  if (anomalies.length === 0) return json({ success: true, anomalies: 0, emailed: false })

  const { data: destinataires } = await admin.rpc('admin_notify_emails')
  const dest = ((destinataires ?? []) as string[]).filter(Boolean)
  if (dest.length === 0) {
    return json({ success: false, anomalies: anomalies.length, error: 'aucun destinataire' }, 500)
  }

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  const n = anomalies.length

  // ⚠️ Le message se compose par NATURE. Un seul texte, écrit pour les
  // paiements, ferait dire « un paiement sans suite » à propos du ménage
  // quotidien — et une alerte qui décrit mal ce qu'elle a vu ne se lit plus.
  const paiements = anomalies.filter((a) => a.nature === 'paiement')
  const purges = anomalies.filter((a) => a.nature === 'purge')
  const total = paiements.reduce((s, a) => s + (a.montant_centimes ?? 0), 0)

  const titre = paiements.length && purges.length
    ? `${n} anomalies`
    : purges.length
      ? 'La purge des données ne tourne plus'
      : paiements.length > 1
        ? `${paiements.length} paiements sans suite`
        : 'Un paiement sans suite'

  const paragraphes: string[] = []
  if (paiements.length) {
    paragraphes.push(
      paiements.length > 1
        ? `${paiements.length} paiements ont été encaissés sans que l’entreprise ou le magasin correspondant n’ait été créé. Au total, ${euros(total)}.`
        : 'Un paiement a été encaissé sans que l’entreprise ou le magasin correspondant n’ait été créé.',
      'C’est le signe que la confirmation de Stripe n’est pas arrivée jusqu’au serveur. Le client, lui, a payé et n’a rien reçu : ni ses codes, ni son accès.',
      'La création se termine à la main depuis le tableau de bord.',
    )
  }
  if (purges.length) {
    paragraphes.push(
      `Le ménage quotidien des données n’a pas abouti depuis plus de deux jours — dernier passage réussi ${depuisQuand(purges[0].depuis)}.`,
      'Les durées de conservation annoncées dans la politique de confidentialité ne sont donc plus tenues : rien n’est effacé ni anonymisé en attendant.',
    )
  }

  const { html, text } = emailQuantinvo({
    titre,
    apercu: paiements.length
      ? `${euros(total)} encaissés, rien n’a été créé.`
      : 'Le ménage quotidien des données ne se fait plus.',
    paragraphes,
    details: anomalies.slice(0, 10).map((a) => ({
      intitule: a.objet || 'Sans nom',
      valeur: a.nature === 'purge'
        ? `${a.parcours} · dernier passage ${depuisQuand(a.depuis)}`
        : `${euros(a.montant_centimes)} · ${a.parcours} · payé ${depuisQuand(a.depuis)}`,
    })),
    bouton: { libelle: 'Ouvrir le tableau de bord', lien: `${appUrl}/admin` },
    note: n > 10 ? `Et ${n - 10} autres, visibles sur le tableau de bord.` : undefined,
    raison:
      'Vous recevez ce message parce que vous suivez Quantinvo. Tant que la situation dure, il est rappelé une fois par jour, pas davantage.',
    siteUrl: appUrl,
  })

  try {
    await envoyerEmail({
      to: dest,
      subject: `⚠ ${titre}`,
      html,
      text,
      replyTo: adresseDeContact(dest),
    })
  } catch (e) {
    // Rien n'est marqué : l'anomalie reste ouverte, et l'heure suivante
    // réessaie. C'est ce que doit faire une alerte qui n'a pas pu partir.
    return json(
      { success: false, anomalies: n, emailed: false, error: e instanceof Error ? e.message : String(e) },
      500,
    )
  }

  // Le message est parti : on note, pour se taire jusqu'à demain.
  const { error: mErr } = await admin.rpc('marquer_alertes', { p_cles: anomalies.map((a) => a.cle) })
  if (mErr) {
    // L'alerte a bien été donnée — mais sans mémoire, elle repartira dans une
    // heure. Ça se dit, plutôt que de passer pour un succès complet.
    return json({ success: true, anomalies: n, emailed: true, memorise: false, error: mErr.message })
  }

  return json({ success: true, anomalies: n, emailed: true, memorise: true })
})
