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
// fonctions — elles sont bruyantes, et la plupart se règlent seules. Trois
// questions seulement, posées toutes les heures : *y a-t-il un paiement
// encaissé dont rien n'a été créé ?*, *le ménage quotidien a-t-il eu lieu ?*,
// et — depuis le 3 septembre 2026 — *un inventaire s'approche-t-il de ce que
// le produit tient ?* La détection vit en base (`anomalies_a_signaler`), qui
// porte aussi les délais de grâce — quinze minutes pour les nouvelles
// tentatives de Stripe, quarante-huit heures pour la purge, qui ne passe
// qu'une fois par jour.
//
// ⚠️ La troisième question existe parce que Quantinvo est en LIBRE-SERVICE :
// le client lance ses inventaires quand il veut, sans nous prévenir. On ne
// peut donc rien anticiper, ni monter la machine la veille. Être prévenu
// automatiquement est la seule chose possible — et il vaut mieux l'apprendre
// par une alerte que par le client.
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
// ⚠️ On RÉUTILISE le nom d'offre du module de devis plutôt que d'en recopier la
// grille : c'est déjà la quatrième copie, une cinquième pour un e-mail ne se
// justifierait pas.
import { nomOffre } from '../_shared/devis.ts'

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
  /** Renseignés pour la seule nature « forfait » : à qui écrire, et quoi nommer. */
  destinataire?: string | null
  prenom?: string | null
  besoin?: number | null
  /** Renseigné pour la nature « volume » seulement : mène à l'inventaire. */
  session_id?: string | null
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

  // ⚠️ DEUX PUBLICS, DONC DEUX MESSAGES. Les trois natures d'origine —
  // paiement sans suite, purge muette, inventaire volumineux — sont des
  // anomalies de NOTRE côté et vont aux administrateurs Quantinvo. Le forfait
  // trop juste, lui, s'adresse au client : un seul message qui mêlerait les
  // deux dirait à quelqu'un ce qui ne le regarde pas.
  const internes = anomalies.filter((a) => a.nature !== 'forfait')
  const forfaits = anomalies.filter((a) => a.nature === 'forfait')

  const appUrl = Deno.env.get('APP_PUBLIC_URL') ?? 'https://www.quantinvo.com'
  // ⚠️ On ne marque QUE ce qui est parti. Une alerte qui n'a pas pu être
  // envoyée reste ouverte, et l'heure suivante réessaie.
  const clesEnvoyees: string[] = []

  const n = internes.length

  // ⚠️ Le message se compose par NATURE. Un seul texte, écrit pour les
  // paiements, ferait dire « un paiement sans suite » à propos du ménage
  // quotidien — et une alerte qui décrit mal ce qu'elle a vu ne se lit plus.
  const paiements = internes.filter((a) => a.nature === 'paiement')
  const purges = internes.filter((a) => a.nature === 'purge')
  // Quantinvo est en LIBRE-SERVICE : le client lance ses inventaires quand il
  // veut, sans nous prévenir. Rien ne s'anticipe — d'où cette troisième
  // question, posée au même tour de garde : *un inventaire s'approche-t-il de
  // ce que le produit tient ?*
  const volumes = internes.filter((a) => a.nature === 'volume')
  const total = paiements.reduce((s, a) => s + (a.montant_centimes ?? 0), 0)

  const natures = [paiements, purges, volumes].filter((g) => g.length).length
  const titre = natures > 1
    ? `${n} points à regarder`
    : volumes.length
      ? volumes.length > 1
        ? `${volumes.length} inventaires approchent de la limite`
        : 'Un inventaire approche de la limite'
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
  if (volumes.length) {
    paragraphes.push(
      volumes.length > 1
        ? `${volumes.length} inventaires en cours ont dépassé les repères de volume.`
        : 'Un inventaire en cours a dépassé les repères de volume.',
      'Ce n’est pas une panne : c’est le moment d’agir avant qu’il n’y en ait une. Au-delà de ces tailles, l’onglet Écarts et le premier recalcul des écarts deviennent trop lents pour le délai que le serveur accorde.',
      'Deux gestes : monter la taille du serveur (Supabase → Settings → Compute, facturé à l’heure, moins de deux minutes de coupure), et prévenir le client que son inventaire est hors des tailles vérifiées.',
    )
  }

  const { html, text } = emailQuantinvo({
    titre,
    apercu: paiements.length
      ? `${euros(total)} encaissés, rien n’a été créé.`
      : volumes.length
        ? 'Un inventaire dépasse les tailles vérifiées.'
        : 'Le ménage quotidien des données ne se fait plus.',
    paragraphes,
    details: internes.slice(0, 10).map((a) => ({
      intitule: a.objet || 'Sans nom',
      valeur: a.nature === 'purge'
        ? `${a.parcours} · dernier passage ${depuisQuand(a.depuis)}`
        : a.nature === 'volume'
          ? `${a.parcours} · ouvert ${depuisQuand(a.depuis)}`
          : `${euros(a.montant_centimes)} · ${a.parcours} · payé ${depuisQuand(a.depuis)}`,
    })),
    // Un seul inventaire en cause : le bouton mène droit dessus. Sinon, la
    // console, d'où tout se voit.
    bouton: volumes.length === 1 && n === 1 && volumes[0].session_id
      ? { libelle: 'Ouvrir l’inventaire', lien: `${appUrl}/dashboard/${volumes[0].session_id}` }
      : { libelle: 'Ouvrir le tableau de bord', lien: `${appUrl}/admin` },
    note: n > 10 ? `Et ${n - 10} autres, visibles sur le tableau de bord.` : undefined,
    raison:
      'Vous recevez ce message parce que vous suivez Quantinvo. Tant que la situation dure, il est rappelé une fois par jour, pas davantage.',
    siteUrl: appUrl,
  })

  const { data: destinataires } = await admin.rpc('admin_notify_emails')
  const dest = ((destinataires ?? []) as string[]).filter(Boolean)
  if (n > 0 && dest.length === 0) {
    return json({ success: false, anomalies: anomalies.length, error: 'aucun destinataire' }, 500)
  }

  let interneEnvoye = false
  if (n > 0) {
    try {
      await envoyerEmail({
        to: dest,
        subject: `⚠ ${titre}`,
        html,
        text,
        replyTo: adresseDeContact(dest),
      })
      interneEnvoye = true
      clesEnvoyees.push(...internes.map((a) => a.cle))
    } catch (e) {
      // Rien n'est marqué pour ces anomalies-là : elles restent ouvertes, et
      // l'heure suivante réessaie. ⚠️ Mais on ne SORT PLUS ici : un message au
      // client n'a pas à rester bloqué parce que le nôtre n'est pas parti.
      console.error('alerte interne', e instanceof Error ? e.message : String(e))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LE FORFAIT TROP JUSTE, CÔTÉ CLIENT
  //
  // Julien : « côté admin qui doit recevoir la même alerte de son côté (avec
  // mail) ». Il voyait déjà la cloche et la bannière — encore fallait-il qu'il
  // ouvre le site.
  //
  // ⚠️ UN MESSAGE PAR MAGASIN, ET RIEN DE NOTRE CÔTÉ DEDANS. Ce message part
  // chez un client : il ne dit ni les autres magasins, ni les autres clients,
  // ni ce que le tour de garde a vu par ailleurs.
  // ─────────────────────────────────────────────────────────────────────────
  for (const f of forfaits) {
    const a = String(f.destinataire ?? '').trim()
    if (!a) continue
    const offre = f.besoin ? nomOffre(f.besoin) : ''
    const magasin = f.objet || 'votre magasin'
    const { html: h, text: t } = emailQuantinvo({
      titre: 'Votre offre d’appareils est trop juste',
      apercu: `${magasin} — des appareils n’ont pas pu compter.`,
      salutation: f.prenom ? `Bonjour ${f.prenom},` : 'Bonjour,',
      paragraphes: [
        `Sur ${magasin}, des appareils n’ont pas pu compter faute de place : ${f.parcours}.`,
        // ⚠️ On rassure d'abord : personne n'a perdu son travail. Un message
        // qui commence par une vente se lit comme une vente.
        'Personne n’a rien perdu — l’écran se débloque dès qu’une place se libère — mais l’équipe attend.',
        offre
          ? `${offre} couvrirait ce besoin. Le changement se fait en ligne, depuis la fiche du magasin.`
          : 'L’offre s’élargit en ligne, depuis la fiche du magasin.',
      ],
      details: [
        { intitule: 'Magasin', valeur: magasin },
        ...(f.besoin ? [{ intitule: 'Appareils nécessaires', valeur: String(f.besoin) }] : []),
      ],
      bouton: {
        libelle: 'Ouvrir la fiche du magasin',
        // ⚠️ L'ANCRE, ET PAS SEULEMENT LA PAGE. Le message dit « depuis la
        // fiche du magasin » : le lien doit poser le lecteur sur la section
        // « Appareils », pas en haut d'une fiche où il faut ensuite chercher.
        lien: f.session_id
          ? `${appUrl}/magasins/${f.session_id}#appareils`
          : `${appUrl}/magasins`,
      },
      raison:
        'Vous recevez ce message parce que vous administrez cette entreprise sur Quantinvo.',
      siteUrl: appUrl,
    })
    try {
      await envoyerEmail({ to: [a], subject: `L’offre de ${magasin} est trop juste`, html: h, text: t })
      clesEnvoyees.push(f.cle)
    } catch (e) {
      console.error('alerte forfait', e instanceof Error ? e.message : String(e))
    }
  }

  // ⚠️ La cloche EN PLUS de l'e-mail, et seulement une fois l'e-mail parti :
  // les deux disent la même chose, ils doivent donc partir ensemble ou pas du
  // tout. Un e-mail se lit dans une boîte qu'on n'ouvre pas toujours ; la
  // cloche attend sur le site.
  //
  // ⚠️ Seul le volume la déclenche. Un paiement sans suite et une purge en
  // panne remontent déjà sur /admin, dans « Ventes en cours » et « À traiter ».
  for (const v of (interneEnvoye ? volumes : [])) {
    const { error: nErr } = await admin.rpc('deposer_notification_admins', {
      p_type: 'inventaire_volumineux',
      p_donnees: { nom: v.objet ?? '', mesure: v.parcours, session_id: v.session_id ?? '' },
    })
    // Une cloche muette ne doit pas faire échouer un e-mail déjà parti.
    if (nErr) console.error('notification volume', nErr.message)
  }

  // Les messages sont partis : on note, pour se taire jusqu'à demain.
  if (clesEnvoyees.length === 0) {
    return json({ success: false, anomalies: anomalies.length, emailed: false }, 500)
  }
  const { error: mErr } = await admin.rpc('marquer_alertes', { p_cles: clesEnvoyees })
  if (mErr) {
    // L'alerte a bien été donnée — mais sans mémoire, elle repartira dans une
    // heure. Ça se dit, plutôt que de passer pour un succès complet.
    return json({
      success: true, anomalies: anomalies.length, internes: n, forfaits: forfaits.length,
      emailed: true, memorise: false, error: mErr.message,
    })
  }

  return json({
    success: true, anomalies: anomalies.length, internes: n, forfaits: forfaits.length,
    emailed: true, memorise: true,
  })
})
