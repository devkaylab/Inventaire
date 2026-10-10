import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, dossierMigrations } from './migrations'

/**
 * L'équipe d'un superviseur — la garde (10 octobre 2026).
 *
 * Julien : « Le superviseur doit voir son équipe à lui en premier, et ensuite
 * celle de ses collègues. Et il n'a pas le droit de retirer un membre d'une
 * autre équipe que la sienne. »
 *
 * ⚠️ Ça RENVERSE la décision du 23 août 2026 (« option A » : le superviseur
 * d'un compteur n'existe pas en base, c'est le magasin qui relie les deux).
 * D'où `store_team.ajoute_par`. Ce qui ne change pas : le magasin reste
 * l'unité d'accès — on met qui on veut du magasin sur ses inventaires.
 */

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/** Toutes les migrations concaténées, commentaires SQL retirés. */
function sqlDuDepot(): string {
  const d = dossierMigrations
  return readdirSync(d).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(path.join(d, f), 'utf8'))
    .join('\n')
    .replace(/^\s*--.*$/gm, '')
}

describe('⚠️⚠️ un superviseur ne retire que ceux qu’il a fait entrer', () => {
  it('le refus est écrit en SQL, pas à l’écran', () => {
    // ⚠️ Cacher le bouton ne ferme rien : une porte fermée à l'écran seulement
    // s'ouvre avec une adresse. Leçon payée sur `invite-to-session` (fiche 123).
    const { corps } = derniereDefinition('remove_counter_from_store')
    expect(corps, 'la fonction ne regarde plus qui a fait entrer la personne')
      .toContain('ajoute_par')
    // L'administrateur, lui, passe : sinon une équipe orpheline serait figée.
    expect(corps, 'l’administrateur d’entreprise ne peut plus retirer')
      .toContain('is_company_admin')
  })

  it('l’écran ne propose le retrait que sur les siens', () => {
    const src = sansCommentaires(lire('app/equipe/page.tsx'))
    const bloc = src.split('(sup?.stores ?? []).map(')[1]?.split('Invitations en cours')[0] ?? ''
    expect(bloc, 'le bloc du superviseur ne se lit plus').not.toBe('')
    const iRetrait = bloc.indexOf("remove_counter_from_store")
    const iGarde = bloc.lastIndexOf('c.a_moi &&', iRetrait)
    expect(iGarde, 'le retrait n’est plus conditionné à « je l’ai fait entrer »')
      .toBeGreaterThan(-1)
  })
})

describe('⚠️ la base retient qui a fait entrer qui, et ce qui se passe au départ', () => {
  const sql = sqlDuDepot()

  it('la colonne existe et rend son équipe quand le compte disparaît', () => {
    expect(sql).toMatch(/add column if not exists ajoute_par uuid references public\.profiles\(id\) on delete set null/)
  })

  it('⚠️ et aussi quand le superviseur perd seulement le magasin', () => {
    // `on delete set null` ne couvre que la SUPPRESSION du compte. « Retirer
    // les accès », un passage en compteur, une réaffectation : le superviseur
    // garderait son équipe dans un magasin qu'il ne supervise plus.
    expect(sql).toMatch(/after delete on public\.store_supervisors/)
  })

  it('la colonne se remplit toute seule, pour TOUS les appelants', () => {
    // Onze endroits insèrent dans `store_team`. Demander à chacun de porter
    // `ajoute_par`, c'est garantir qu'un oublié subsistera.
    expect(sql).toMatch(/before insert on public\.store_team/)
  })

  it('⚠️ et jamais la personne elle-même', () => {
    // À l'inscription, `auth.uid()` EST le nouveau venu : sans cette borne, il
    // se ferait entrer tout seul et deviendrait son propre superviseur.
    const { corps } = derniereDefinition('store_team_ajoute_par')
    expect(corps).toMatch(/auth\.uid\(\)\s*<>\s*new\.user_id/)
  })
})

describe('⚠️⚠️ le mot de passe, et pas « s’est déjà connecté »', () => {
  it('les deux fonctions de lecture l’exposent', () => {
    for (const fn of ['my_team_by_store', 'ca_list_team']) {
      const { corps } = derniereDefinition(fn)
      expect(corps, `${fn} n’expose plus l’état du mot de passe`)
        .toContain('a_un_mot_de_passe')
      expect(corps, `${fn} ne lit plus le mot de passe mais autre chose`)
        .toContain('encrypted_password')
    }
  })

  it('⚠️ et `is_active` survit à côté, parce qu’il dit autre chose', () => {
    // « S'est déjà connecté » reste une information utile. Ce qui était faux,
    // c'est de lui faire dire « a fini son inscription ».
    const { corps } = derniereDefinition('my_team_by_store')
    expect(corps).toContain('last_sign_in_at')
  })
})
