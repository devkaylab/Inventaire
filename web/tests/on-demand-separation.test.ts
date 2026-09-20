// On-Demand vit À CÔTÉ de Quantinvo OS, pas dedans.
//
// ⚠️ **LA RÈGLE, POSÉE PAR JULIEN LE 20 SEPTEMBRE 2026** : « on ne doit pas
// toucher à Quantinvo OS, fais bien la distinction ». L'application est en
// cours de publication ; un défaut d'On-Demand ne doit pas pouvoir casser un
// comptage, un encaissement ou une connexion.
//
// La première version des migrations ne respectait pas ça : elle RÉÉCRIVAIT
// huit policies d'OS pour leur ajouter une branche. Ça marchait — le rejeu sur
// réplique le montrait — mais ça mettait On-Demand dans le produit qui tourne,
// et le retirer aurait demandé de restaurer huit définitions à la main.
//
// Les policies permissives de PostgreSQL se combinant en `OU`, il suffit d'en
// AJOUTER à côté. Cette garde tient la règle : une migration On-Demand ne
// redéfinit aucun objet de Quantinvo OS, sauf UNE, qui le dit dans son nom et
// dans son en-tête.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { dossierMigrations } from './migrations'

const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(--|\/\/).*$/gm, '')

const fichiers = readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort()
const lire = (f: string) => readFileSync(path.join(dossierMigrations, f), 'utf8')

/** Les migrations du chantier On-Demand : celles du 20 septembre 2026. */
const ONDEMAND = fichiers.filter((f) => /^20260920\d+_on_demand_/.test(f))

/**
 * ⚠️ **LA SEULE EXCEPTION, ET ELLE EST NOMMÉE.** Sans `prendre_place_appareil`,
 * un inventoriste de mission ne peut pas ouvrir l'écran de comptage — et le
 * défaut du plafond `null` reste ouvert. C'est une décision à prendre à part,
 * d'où un fichier à part, en dernier.
 */
const EXCEPTION = '20260920200001_on_demand_le_plafond_d_appareils.sql'

/** Ce que Quantinvo OS avait posé AVANT ce chantier — déduit, pas cité. */
function objetsDeQuantinvoOS(): { fonctions: Set<string>; policies: Set<string> } {
  const fonctions = new Set<string>()
  const policies = new Set<string>()
  for (const f of fichiers) {
    if (ONDEMAND.includes(f)) continue
    const sql = sansCommentaires(lire(f))
    for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(/gi)) {
      fonctions.add(m[1])
    }
    for (const m of sql.matchAll(/create policy (\w+) on public\.(\w+)/gi)) {
      policies.add(`${m[2]}.${m[1]}`)
    }
  }
  return { fonctions, policies }
}

describe('On-Demand ne touche pas à Quantinvo OS', () => {
  const os = objetsDeQuantinvoOS()

  it('le chantier existe, et Quantinvo OS aussi', () => {
    // Sans ces deux bornes, la garde passerait sur des ensembles vides.
    expect(ONDEMAND.length).toBeGreaterThanOrEqual(8)
    expect(os.fonctions.size).toBeGreaterThan(100)
    expect(os.policies.size).toBeGreaterThan(20)
  })

  it('aucune migration On-Demand ne redéfinit une fonction de Quantinvo OS', () => {
    const fautes: string[] = []
    for (const f of ONDEMAND) {
      if (f === EXCEPTION) continue
      const sql = sansCommentaires(lire(f))
      for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(/gi)) {
        if (os.fonctions.has(m[1])) fautes.push(`${f} → ${m[1]}()`)
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([])
  })

  it('aucune migration On-Demand ne réécrit une policy de Quantinvo OS', () => {
    const fautes: string[] = []
    for (const f of ONDEMAND) {
      if (f === EXCEPTION) continue
      const sql = sansCommentaires(lire(f))
      for (const m of sql.matchAll(/create policy (\w+) on public\.(\w+)/gi)) {
        if (os.policies.has(`${m[2]}.${m[1]}`)) fautes.push(`${f} → ${m[2]}.${m[1]}`)
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([])
  })

  /**
   * ⚠️ Un déclencheur sur une table d'OS met du code de ce chantier sur le
   * chemin d'OS — y compris sur la création d'entreprise, qu'emprunte un
   * client qui vient de payer. Un défaut là-dedans casse un encaissement.
   */
  it('aucun déclencheur n’est posé sur une table de Quantinvo OS', () => {
    const tablesOS = ['companies', 'stores', 'profiles', 'inventory_sessions',
      'session_members', 'zones', 'counts']
    const fautes: string[] = []
    for (const f of ONDEMAND) {
      const sql = sansCommentaires(lire(f))
      for (const m of sql.matchAll(/create trigger \w+\s+[\s\S]{0,60}?on public\.(\w+)/gi)) {
        if (tablesOS.includes(m[1])) fautes.push(`${f} → sur ${m[1]}`)
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([])
  })

  /**
   * ⚠️ L'exception doit RESTER une exception, et se voir. Si elle cesse de le
   * dire, la prochaine personne l'appliquera sans savoir ce qu'elle change.
   */
  it('la seule migration qui touche Quantinvo OS le dit en tête', () => {
    const entete = lire(EXCEPTION).slice(0, 2000)
    expect(entete).toContain('CETTE MIGRATION TOUCHE QUANTINVO OS')
    expect(entete).toContain('Oberlin Lyon')
    // Elle vient en dernier : rien du chantier ne s'applique après elle.
    expect(ONDEMAND[ONDEMAND.length - 1]).toBe(EXCEPTION)
  })

  /**
   * ⚠️ **LA MIGRATION QUI TOUCHE OS DOIT VENIR AVEC SON ANNULATION.** Elle
   * remplace `prendre_place_appareil` : la retirer en supprimant
   * `a_un_acces_mission` sans remettre la fonction d'origine laisse celle-ci
   * appeler quelque chose qui n'existe plus — **le comptage s'arrête pour
   * tout le monde**. Trouvé le 20 septembre 2026 par le contrôle de retrait
   * de la réplique : un retrait qui marchait sur le papier laissait Quantinvo
   * OS cassé.
   */
  it('la migration qui touche Quantinvo OS sait se défaire', () => {
    const annulation = readFileSync(
      path.resolve(__dirname, '../../scripts/replique/91-restaurer-quantinvo-os.sql'), 'utf8')
    // Elle remet la fonction d'OS, elle ne se contente pas de la supprimer.
    expect(annulation).toMatch(/create or replace function public\.prendre_place_appareil/i)
    // ⚠️ SANS SES COMMENTAIRES : l'en-tête EXPLIQUE pourquoi il ne faut pas
    // laisser `a_un_acces_mission` dedans, donc il la cite. Sixième fois que
    // ce piège se présente sur ce dépôt.
    expect(sansCommentaires(annulation)).not.toContain('a_un_acces_mission')
    // Et le retrait général la joue.
    const retrait = readFileSync(
      path.resolve(__dirname, '../../scripts/replique/90-retirer.sql'), 'utf8')
    expect(retrait).toContain('91-restaurer-quantinvo-os.sql')
    // La migration renvoie à son annulation : sans ça, on l'oublie.
    expect(lire(EXCEPTION)).toContain('91-restaurer-quantinvo-os.sql')
  })

  /**
   * ⚠️ Tout doit pouvoir se retirer. Si un objet posé par le chantier n'est pas
   * dans `90-retirer.sql`, le contrôle de retrait de la réplique passerait en
   * laissant quelque chose derrière lui.
   */
  it('tout ce que le chantier pose sait se retirer', () => {
    const retrait = readFileSync(
      path.resolve(__dirname, '../../scripts/replique/90-retirer.sql'), 'utf8')
    const manquants: string[] = []
    for (const f of ONDEMAND) {
      const sql = sansCommentaires(lire(f))
      for (const m of sql.matchAll(/create table if not exists public\.(\w+)/gi)) {
        if (!retrait.includes(`drop table if exists public.${m[1]}`)) manquants.push(`table ${m[1]}`)
      }
      // Les policies posées sur une table d'OS : elles survivraient à un
      // `drop table` des tables du chantier, puisque leur table reste.
      for (const m of sql.matchAll(/create policy (\w+) on public\.(\w+)/gi)) {
        const surOS = ['inventory_sessions', 'zones', 'counts'].includes(m[2])
        if (surOS && !retrait.includes(`drop policy if exists ${m[1]} on public.${m[2]}`)) {
          manquants.push(`policy ${m[2]}.${m[1]}`)
        }
      }
    }
    expect([...new Set(manquants)], manquants.join('\n')).toEqual([])
  })
})
