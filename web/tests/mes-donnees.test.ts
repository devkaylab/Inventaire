// Droits d'accès et de portabilité, et procédure de violation (constat M6).
//
// L'export est produit par la base (export_my_data) et téléchargé depuis la
// page Mon compte. Ces tests empêchent d'y faire fuiter un secret d'accès,
// de l'ouvrir au rôle anonyme, ou de perdre la fiche réflexe des 72 heures.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260818000004_export_mes_donnees.sql')
const compte = lire('../app/account/page.tsx')
const politique = lire('../../docs/privacy.html')
const procedure = lire('../../docs/conformite/procedure-violation-donnees.md')
const registre = lire('../../docs/conformite/registre-des-violations.md')

describe('export de mes données (base)', () => {
  it('ne fait fuiter aucun secret d’accès', () => {
    // Les codes entreprise/magasin et codes de sécurité sont des clés
    // d'entrée, pas des données de la personne.
    expect(migration).not.toContain('join_code')
    expect(migration).not.toContain('security_code')
  })

  it('est réservé à la personne authentifiée', () => {
    expect(migration).toMatch(/revoke execute on function public\.export_my_data\(\) from public, anon/)
    expect(migration).toMatch(/grant execute on function public\.export_my_data\(\) to authenticated/)
    expect(migration).toContain("raise exception 'authentification requise'")
  })

  it('renvoie le détail des inventaires vers l’employeur, responsable du traitement', () => {
    expect(migration).toContain('note_inventaires')
    expect(migration).toContain('employeur')
  })
})

describe('export de mes données (écran)', () => {
  it('est proposé sur la page Mon compte, pour tous les rôles', () => {
    expect(compte).toContain("rpc('export_my_data')")
    expect(compte).toContain('Télécharger mes données')
    expect(compte).toContain('quantinvo-mes-donnees.json')
  })

  it('est annoncé dans la politique de confidentialité', () => {
    expect(politique).toContain('Télécharger mes données')
  })
})

describe('procédure de violation de données', () => {
  it('rappelle le délai de 72 heures et le téléservice CNIL', () => {
    expect(procedure).toContain('72 h')
    expect(procedure).toContain('notifications.cnil.fr')
  })

  it('distingue les deux rôles : responsable et sous-traitant', () => {
    // Le piège central : pour les données d'inventaire, c'est l'entreprise
    // cliente qui notifie — Devkaylab la prévient sans délai.
    expect(procedure).toContain('Responsable de traitement')
    expect(procedure).toContain('Sous-traitant')
    expect(procedure).toContain('article 33-2')
  })

  it('impose le registre des violations, notification ou pas', () => {
    expect(procedure).toContain('registre-des-violations.md')
    expect(registre).toContain('article 33-5')
  })
})
