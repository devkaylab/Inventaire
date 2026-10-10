import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, dossierMigrations } from './migrations'

/**
 * Demander la suppression d'un compte — la garde (10 octobre 2026).
 *
 * Julien : « Julien a déjà finalisé son compte et je ne peux pas le supprimer
 * car je ne suis pas admin. […] Un bouton demande de suppression de profil qui
 * sera envoyé à l'admin de l'entreprise, avec une section commentaire. Tous les
 * admins, notification et e-mail, et je veux recevoir une notification comme ça
 * a été fait. Motif obligatoire. »
 *
 * ⚠️ Ce qui NE change pas : **supprimer reste à l'administrateur**. Un
 * superviseur demande. La suppression est irréversible, et un compteur peut
 * travailler pour plusieurs superviseurs.
 */

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const sql = () =>
  readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(path.join(dossierMigrations, f), 'utf8')).join('\n')
    .replace(/^\s*--.*$/gm, '')

describe('⚠️⚠️ un superviseur demande, il ne supprime pas', () => {
  it('l’écran du superviseur n’appelle jamais la suppression', () => {
    // ⚠️ La borne est en base (`ca_delete_user` exige `is_company_admin`), mais
    // un écran qui proposerait le geste mentirait sur ce qu'il peut faire.
    const page = sansCommentaires(lire('app/equipe/page.tsx'))
    const bloc = page.split('(sup?.stores ?? []).map(')[1]?.split('Invitations en cours')[0] ?? ''
    expect(bloc, 'le bloc du superviseur ne se lit plus').not.toBe('')
    expect(bloc, 'l’écran du superviseur appelle la suppression en direct')
      .not.toContain('ca_delete_user')
    expect(bloc, 'le superviseur ne peut plus demander la suppression')
      .toContain('setASupprimer')
  })

  it('⚠️ et le motif est exigé EN BASE, pas seulement à l’écran', () => {
    // Un champ obligatoire côté écran se contourne avec une adresse.
    const { corps } = derniereDefinition('demander_suppression_compte')
    expect(corps, 'le motif n’est plus exigé').toMatch(/v_motif = ''/)
  })

  it('⚠️ et la demande ne vise que quelqu’un de SES magasins', () => {
    // Sans cette borne, un superviseur demanderait la suppression de n'importe
    // qui dans l'entreprise.
    const { corps } = derniereDefinition('demander_suppression_compte')
    expect(corps, 'la demande ne vérifie plus le magasin')
      .toContain('store_supervisors')
  })
})

describe('⚠️ tous les administrateurs, et le demandeur au bout', () => {
  it('la notification part à TOUS les administrateurs', () => {
    // Un seul destinataire, et la demande dort pendant ses congés.
    const { corps } = derniereDefinition('demander_suppression_compte')
    expect(corps).toMatch(/is_company_admin/)
    expect(corps, 'la notification ne part plus à l’administrateur')
      .toContain("'demande_suppression'")
  })

  it('⚠️ la suppression clôt la demande ET prévient son auteur', () => {
    const { corps } = derniereDefinition('ca_delete_user')
    expect(corps, 'la suppression ne prévient plus le demandeur')
      .toContain("'demande_suppression_traitee'")
    // ⚠️ L'ORDRE EST TOUT : après `delete from auth.users`, la cible est nulle
    // et le profil n'existe plus — il ne resterait rien pour retrouver l'auteur.
    const iNotif = corps.indexOf("'demande_suppression_traitee'")
    const iDelete = corps.indexOf('delete from auth.users')
    expect(iNotif, 'la notification est passée APRÈS la suppression').toBeLessThan(iDelete)
  })

  it('⚠️ et le nom survit à la suppression', () => {
    // `cible` devient nul (`on delete set null`) : sans le nom figé, la
    // notification annoncerait la suppression de personne.
    expect(sql()).toMatch(/cible_nom\s+text not null/)
    expect(sql(), 'la demande disparaîtrait avec la personne qu’elle vise')
      .toMatch(/cible\s+uuid references public\.profiles\(id\) on delete set null/)
  })
})

describe('⚠️ les motifs ne se lisent pas depuis un navigateur', () => {
  it('la table n’est ouverte qu’aux fonctions', () => {
    // Un client qui la lirait verrait les motifs écrits sur ses collègues.
    expect(sql()).toMatch(/revoke all on public\.demandes_suppression_compte from anon, authenticated/)
  })
})
