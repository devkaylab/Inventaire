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

  it('dit ce qui s’est passé, et où agir', () => {
    expect(edge).toContain('Ouvrir le tableau de bord')
    expect(edge).toContain('/admin')
    // Le montant et l'ancienneté : c'est ce qui donne l'urgence.
    expect(edge).toContain('euros(')
    expect(edge).toContain('depuisQuand(')
  })
})
