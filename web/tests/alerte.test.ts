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
