// Le tour de garde : un paiement resté sans suite se dit tout seul.
//
// Dernier manque de la revue de sécurité du 28 août 2026 : les journaux
// existaient, personne n'était prévenu. Ces tests figent les quatre choses qui
// font qu'une alerte reste crédible — elle est authentifiée, elle laisse un
// délai de grâce, elle ne se répète pas, et elle ne se tait qu'une fois le
// message parti.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GRACE_PAIEMENT_MIN, lireVente } from '../lib/pipeline'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const edge = lire('../../supabase/functions/alerte-anomalies/index.ts')

const dossierMigrations = path.resolve(__dirname, '../../supabase/migrations')
const migrations = readdirSync(dossierMigrations)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(path.join(dossierMigrations, f), 'utf8'))
  .join('\n')

/** La dernière migration qui définit `anomalies_a_signaler`, et son corps. */
function derniereDefinitionAnomalies(): { corps: string } {
  const fichiers = readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort().reverse()
  for (const f of fichiers) {
    const t = readFileSync(path.join(dossierMigrations, f), 'utf8')
    const i = t.lastIndexOf('create or replace function public.anomalies_a_signaler()')
    if (i === -1) continue
    return { corps: t.slice(i, t.indexOf('$function$;', i)) }
  }
  throw new Error('anomalies_a_signaler introuvable')
}

describe('la question posée toutes les heures', () => {
  it('cherche un paiement encaissé dont rien n’a été créé', () => {
    // Les deux parcours : inscription d'entreprise et ajout de magasin.
    expect(migrations).toContain("where r.status = 'paid'")
    expect(migrations).toContain('and r.company_id is null')
    expect(migrations).toContain("where s.status = 'paid'")
    expect(migrations).toContain('and s.store_id is null')
  })

  it('⚠️ laisse quinze minutes de grâce', () => {
    // Stripe réessaie quand une réponse tarde. Alerter à la seconde ferait
    // sonner pour des paiements qui se règlent seuls deux minutes plus tard —
    // et une alerte qui se trompe est une alerte qu'on cesse de lire.
    expect(migrations).toContain("r.paid_at < now() - interval '15 minutes'")
    expect(migrations).toContain("s.paid_at < now() - interval '15 minutes'")
  })

  it('⚠️ ne répète pas la même alerte toutes les heures', () => {
    // Sans mémoire, un paiement bloqué produirait vingt-quatre e-mails par
    // jour. Une anomalie qui dure est rappelée une fois par jour, pas plus.
    expect(migrations).toContain('public.alertes_envoyees')
    expect(migrations).toContain("a.derniere_le < now() - interval '24 hours'")
  })

  it('⚠️ surveille aussi que le ménage quotidien a bien eu lieu', () => {
    // Julien : « elle ne peut pas se run seule la commande ? » — à propos de
    // la vérification quotidienne de la purge. Elle peut, et surtout elle ne
    // devrait pas exister : une vérification dont un humain est responsable
    // s'arrête au bout de trois jours.
    expect(migrations).toContain("'purge:silencieuse'")
    expect(migrations).toContain("j.jobname = 'purge-donnees-expirees'")
    // 48 h, pas 24 : la purge passe une fois par jour, alerter à 24 h ferait
    // sonner pour un passage décalé de quelques minutes.
    expect(migrations).toContain("p.dernier < now() - interval '48 hours'")
  })

  it('⚠️ ne crie pas avant que la purge ait eu sa chance', () => {
    // Au moment de la pose, la purge n'avait jamais tourné : une condition
    // naïve serait vraie tout de suite et l'alerte partirait avant le premier
    // ménage. D'où le repli sur la date d'installation — et si la tâche ne
    // démarrait jamais, l'alerte finirait par partir quand même.
    expect(migrations).toMatch(/greatest\(\s*coalesce\(max\(d\.end_time\)/)
    expect(migrations).toContain("timestamptz '2026-08-28 13:30:00+00'")
  })

  it('tourne toutes les heures, et le tour de garde est planifié', () => {
    expect(migrations).toMatch(/cron\.schedule\(\s*'alerte-paiement-sans-suite',\s*'7 \* \* \* \*'/)
  })

  it('ne s’ouvre qu’au rôle serveur', () => {
    // La première dit combien un client a payé, la seconde éteint une alerte.
    for (const fn of ['anomalies_a_signaler()', 'marquer_alertes(text[])', 'declencher_alerte()']) {
      expect(migrations).toContain(`revoke all on function public.${fn} from public, anon, authenticated`)
    }
  })

  it('⚠️ lit sa clé dans le coffre, jamais en clair dans une fonction', () => {
    // `pg_get_functiondef` est lisible par qui peut lire le catalogue.
    expect(migrations).toContain('vault.decrypted_secrets')
    expect(migrations).toContain("name = 'alerte_cle'")
    // Et sans secret posé, la tâche planifiée ne fait rien : elle est donc
    // inoffensive avant sa configuration.
    expect(migrations).toContain("if v_cle is null or btrim(v_cle) = '' then")
  })
})

describe('la fonction qui écrit le message', () => {
  it('⚠️ vérifie la clé partagée, en temps constant, avant tout', () => {
    // Déployée sans jeton (une tâche `pg_cron` n'a pas de session) : la clé est
    // la seule porte, comme la signature du webhook Stripe. Une comparaison
    // naïve fuirait la clé caractère par caractère.
    expect(edge).toContain('egalConstant')
    expect(edge).toContain("req.headers.get('x-alerte-cle')")
    expect(edge).toContain('diff |= a.charCodeAt(i) ^ b.charCodeAt(i)')
    // Et avant d'aller chercher quoi que ce soit en base.
    expect(edge.indexOf('egalConstant(fournie')).toBeLessThan(edge.indexOf('createClient('))
  })

  it('⚠️ ne marque l’alerte qu’APRÈS l’envoi', () => {
    // Un e-mail qui ne part pas doit laisser l'anomalie ouverte : l'heure
    // suivante réessaie. L'inverse la ferait taire pour de bon sur un incident
    // réseau d'une seconde.
    expect(edge.indexOf('envoyerEmail(')).toBeLessThan(edge.indexOf("rpc('marquer_alertes'"))
  })

  it('se tait quand tout va bien', () => {
    // C'est le silence qui rend l'alerte crédible.
    expect(edge).toContain('if (anomalies.length === 0)')
    expect(edge).toContain('emailed: false')
  })

  it('passe par le gabarit d’e-mail commun', () => {
    // Règle du projet : tout ce que le produit envoie passe par `emailQuantinvo`.
    expect(edge).toContain('emailQuantinvo')
    expect(edge).toContain('envoyerEmail')
    expect(edge).not.toContain('<table')
  })

  it('⚠️ compose son message par NATURE', () => {
    // Un seul texte, écrit pour les paiements, ferait dire « un paiement sans
    // suite » à propos du ménage quotidien — et une alerte qui décrit mal ce
    // qu'elle a vu ne se lit plus.
    expect(edge).toContain("a.nature === 'paiement'")
    expect(edge).toContain("a.nature === 'purge'")
    expect(edge).toContain('La purge des données ne tourne plus')
    // Et la ligne de détail d'une purge ne parle pas d'euros.
    expect(edge).toContain('dernier passage')
  })

  it('dit ce qui s’est passé, et où agir', () => {
    expect(edge).toContain('Ouvrir le tableau de bord')
    expect(edge).toContain('/admin')
    // Le montant et l'ancienneté : c'est ce qui donne l'urgence.
    expect(edge).toContain('euros(')
    expect(edge).toContain('depuisQuand(')
  })
})

describe('l’écran et la boîte de réception racontent la même chose', () => {
  // Avant le 28 août 2026, l'e-mail partait au bout de quinze minutes et
  // /admin ne parlait de retard qu'au bout d'un jour : deux versions du même
  // incident. Julien : « il serait intéressant de le voir sur le dashboard
  // admin également ». Il y était déjà — mal réglé.
  it('⚠️ le seuil du tableau est celui de l’alerte', () => {
    expect(GRACE_PAIEMENT_MIN).toBe(15)
    expect(migrations).toContain(`interval '${GRACE_PAIEMENT_MIN} minutes'`)
  })

  const vente = (paidIlYA: number) => ({
    kind: 'company' as const,
    id: 'x',
    label: 'ACME',
    status: 'paid' as const,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    paid_at: new Date(Date.now() - paidIlYA * 60_000).toISOString(),
  })

  it('pendant la grâce, l’écran n’affole pas', () => {
    const e = lireVente(vente(5) as never, new Date())
    expect(e.retard).toBe(false)
    expect(e.etat).toContain('création en cours')
  })

  it('passé la grâce, il dit que le client attend', () => {
    const e = lireVente(vente(30) as never, new Date())
    expect(e.retard).toBe(true)
    expect(e.etat).toContain('rien n’a été créé')
  })
})

/**
 * La troisième question : un inventaire s'approche-t-il de ce que le produit
 * tient ? (3 septembre 2026)
 *
 * Elle existe parce que Quantinvo est en LIBRE-SERVICE — le client lance ses
 * inventaires quand il veut, sans prévenir. Rien ne s'anticipe : être averti
 * automatiquement est la seule chose possible.
 *
 * Les seuils viennent des mesures du jour, sur la vraie base : à 400 000
 * références et 900 000 comptages, la liste des écarts demande 12,9 s et le
 * premier recalcul 27,6 s, pour un plafond de 8 s.
 */
describe('un inventaire trop gros se signale avant la panne', () => {
  it('les deux repères sont ceux qui ont été mesurés', () => {
    // Volontairement BAS : ils préviennent, ils ne constatent pas la panne.
    expect(migrations).toContain("('references', t.refs, 150000::bigint")
    expect(migrations).toContain("('comptages',  t.cpts, 400000::bigint")
  })

  it('⚠️ ne regarde que les inventaires EN COURS', () => {
    // Un inventaire clôturé ne se compte plus : aucun risque, et le signaler
    // chaque jour ferait du bruit pour rien.
    expect(migrations).toContain("where s.status in ('open', 'counting')")
  })

  it('⚠️ ne se rappelle PAS tous les jours, contrairement aux autres', () => {
    // Un gros inventaire le reste jusqu'à sa clôture. Le redire chaque matin
    // est le meilleur moyen qu'on cesse de lire ces messages — alors qu'un
    // paiement sans suite, lui, est une anomalie à retraiter.
    expect(migrations).toContain("or (o.nature <> 'volume' and a.derniere_le < now() - interval '24 hours')")
  })

  it('⚠️ deux repères, donc deux clés : ce sont deux moments différents', () => {
    // Les références se connaissent à l'import, souvent des jours avant le
    // comptage ; les comptages, pendant. Le second mérite d'être signalé même
    // si le premier l'a déjà été.
    expect(migrations).toContain("'volume:' || v.repere || ':' || s.id::text")
  })

  it('l’e-mail dit quoi faire, pas seulement ce qui se passe', () => {
    expect(edge).toContain('Compute')
    expect(edge).toContain('prévenir le client')
    expect(edge).toMatch(/inventaires? approche/)
  })

  it('⚠️ la cloche part en plus de l’e-mail, et seulement après lui', () => {
    // Les deux disent la même chose : ils partent ensemble ou pas du tout.
    const iEnvoi = edge.indexOf('envoyerEmail')
    const iCloche = edge.indexOf('deposer_notification_admins')
    expect(iCloche).toBeGreaterThan(iEnvoi)
    // Et une cloche muette ne doit pas faire échouer un e-mail déjà parti.
    expect(edge).toMatch(/if \(nErr\) console\.error/)
  })

  it('⚠️ la cloche n’est ouverte qu’au rôle serveur', () => {
    // `notifications` n'a aucune policy d'écriture : c'est ce qui garantit
    // qu'aucun client ne peut faire sonner la cloche de quelqu'un d'autre.
    expect(migrations).toContain(
      'revoke all on function public.deposer_notification_admins(text, jsonb) from public, anon, authenticated',
    )
    expect(migrations).toContain(
      'grant execute on function public.deposer_notification_admins(text, jsonb) to service_role',
    )
  })

  it('le site sait afficher ce type de notification', () => {
    // Un type déposé sans libellé s'afficherait vide dans la cloche.
    const cloche = lire('../components/Notifications.tsx')
    expect(cloche).toContain("case 'inventaire_volumineux':")
    expect(cloche).toContain("'inventaire_volumineux'")
  })
})

/**
 * ⚠️ La cloche a DEUX filtres, et il faut les deux (3 septembre 2026).
 *
 * Trouvé en l'essayant pour de vrai : l'e-mail est parti (`emailed: true`) et
 * la cloche est restée muette. La contrainte de la table refusait le type, et
 * `mes_notifications` ne le rendait pas. Aucune des deux ne se voit à la
 * lecture du code de la fonction edge.
 */
describe('un nouveau type de notification passe les deux filtres', () => {
  it('la contrainte de la table l’accepte', () => {
    expect(migrations).toContain("'inventaire_volumineux'::text")
  })

  it('⚠️ et la liste blanche de LECTURE le rend', () => {
    // Un type déposé sans être ajouté ici n'apparaît jamais dans la cloche,
    // sans le moindre message d'erreur.
    expect(migrations).toContain(
      "n.type in ('invitation_inventaire', 'compteur_actif', 'inventaire_volumineux')",
    )
  })
})

describe('le forfait trop juste part aussi par e-mail', () => {
  // Julien, 4 septembre 2026 : « pas besoin de proposer d'offre sur l'app je
  // pense, site uniquement et côté admin qui doit recevoir la même alerte de
  // son côté (avec mail) ». Il voyait la cloche et la bannière — encore
  // fallait-il qu'il ouvre le site.
  const { corps } = derniereDefinitionAnomalies()
  const sansCom = (s: string) => s.replace(/^\s*(--|\/\/).*$/gm, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

  it('ne redétecte rien : elle part des notifications déjà déposées', () => {
    // ⚠️ Une seconde règle de détection aurait divergé de la première au
    // premier ajustement — et la cloche et l'e-mail se seraient contredits.
    expect(corps).toContain("n.type = 'forfait_trop_juste'")
    expect(corps).toContain('from public.notifications n')
  })

  it('ne se rappelle pas, comme le volume', () => {
    // La notification est DÉJÀ au repos trente jours : la redire chaque matin
    // est le meilleur moyen qu'on cesse de lire ces messages.
    expect(sansCom(corps)).toContain("o.nature not in ('volume', 'forfait')")
  })

  it('sépare les deux publics', () => {
    // ⚠️ Les trois autres natures vont aux administrateurs Quantinvo. Un seul
    // message qui les mêlerait dirait à un client ce qui ne le regarde pas.
    const s = sansCom(edge)
    expect(s).toContain("const internes = anomalies.filter((a) => a.nature !== 'forfait')")
    expect(s).toContain("const forfaits = anomalies.filter((a) => a.nature === 'forfait')")
    // Le message du client ne part qu'au destinataire de SA notification.
    expect(s).toContain('to: [a],')
  })

  it('ne marque que ce qui est parti', () => {
    const s = sansCom(edge)
    expect(s).toContain("rpc('marquer_alertes', { p_cles: clesEnvoyees })")
    expect(s).not.toContain('p_cles: anomalies.map')
  })

  it('un message interne en échec ne retient pas celui du client', () => {
    // ⚠️ Avant, le `catch` sortait en 500 : le client n'aurait rien reçu parce
    // que NOTRE message n'était pas parti.
    const s = sansCom(edge)
    const i = s.indexOf("console.error('alerte interne'")
    const j = s.indexOf('for (const f of forfaits)')
    expect(i).toBeGreaterThan(0)
    expect(j).toBeGreaterThan(i)
  })

  it('ne recopie pas une cinquième grille pour nommer l’offre', () => {
    expect(edge).toContain("import { nomOffre } from '../_shared/devis.ts'")
  })
})

describe('l’application ne vend rien', () => {
  it('ne nomme aucune offre, ni aucun prix', () => {
    // ⚠️ « Pas besoin de proposer d'offre sur l'app » (Julien). L'écran de refus
    // s'ouvre devant un compteur debout dans un rayon, qui n'a pas la main :
    // une proposition commerciale n'a rien à y faire.
    const src = path.resolve(__dirname, '../../src')
    const fichiers: string[] = []
    const parcourir = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) parcourir(p)
        else if (/\.(ts|tsx)$/.test(e.name)) fichiers.push(p)
      }
    }
    parcourir(src)
    for (const f of fichiers) {
      const code = readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, ' ')
      expect(code, f).not.toMatch(/\bEssential\b|\bAdvanced\b|\bEnterprise\b/)
    }
  })
})
