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
  it('les deux fonctions de lecture lisent le FAIT ENREGISTRÉ', () => {
    for (const fn of ['my_team_by_store', 'ca_list_team']) {
      const { corps } = derniereDefinition(fn)
      expect(corps, `${fn} n’expose plus l’état du compte`)
        .toContain('compte_finalise')
      expect(corps, `${fn} ne lit plus le marqueur posé à la création du mot de passe`)
        .toContain('mot_de_passe_cree')
      // ⚠️⚠️ ET SURTOUT PAS `encrypted_password`. Supabase le remplit DÈS
      // L'INVITATION, avec un mot de passe aléatoire : il vaut `true` pour
      // tout le monde. S'y fier a fait disparaître le badge « Mot de passe à
      // créer » et le bouton « Renvoyer le lien » pendant quelques heures, le
      // 10 octobre 2026 — pour tout le monde, d'un coup.
      expect(corps, `${fn} est revenue au signal qui ment (encrypted_password)`)
        .not.toContain('encrypted_password')
    }
  })

  it('⚠️ et le fait s’enregistre là où il se produit', () => {
    // Un fait consigné quand il arrive ne se devine plus après coup. Les deux
    // écrans qui posent un mot de passe posent le marqueur.
    for (const f of ['app/bienvenue/page.tsx', 'app/reinitialisation/page.tsx']) {
      expect(lire(f), `${f} pose un mot de passe sans le dire`)
        .toContain('mot_de_passe_cree: true')
    }
  })

  it('⚠️ et `is_active` survit à côté, parce qu’il dit autre chose', () => {
    // « S'est déjà connecté » reste une information utile. Ce qui était faux,
    // c'est de lui faire dire « a fini son inscription ».
    const { corps } = derniereDefinition('my_team_by_store')
    expect(corps).toContain('last_sign_in_at')
  })
})

describe('⚠️⚠️ un compte déjà dans l’entreprise se RATTACHE, il ne se refuse pas', () => {
  const edge = sansCommentaires(
    readFileSync(path.resolve(racine, '../supabase/functions/invite-teammate/index.ts'), 'utf8'),
  )

  it('le refus sec a disparu', () => {
    // ⚠️ LE CUL-DE-SAC, relevé par Julien le 10 octobre 2026. « Retirer du
    // magasin » GARDE le compte : la personne reste dans l'entreprise,
    // disparaît de l'écran du superviseur — qui ne liste que `store_team` — et
    // son réajout butait sur « fait déjà partie de votre équipe ». Invisible
    // ET inajoutable, sans aucun geste pour s'en sortir.
    const bloc = edge.split('found.company_id === prof.company_id')[1]?.split('other_company')[0] ?? ''
    expect(bloc, 'la branche « même entreprise » ne se lit plus').not.toBe('')
    expect(bloc, 'le réajout ne rattache plus à un magasin')
      .toContain("from('store_team')")
  })

  it('⚠️ et il pose `ajoute_par` lui-même', () => {
    // Le déclencheur qui le remplit d'ordinaire lit l'invitation en attente ou
    // `auth.uid()`. Ici il n'y a pas d'invitation, et l'écriture passe par la
    // clé de service : `auth.uid()` est nul. Sans cette ligne la personne
    // reviendrait « sous l'administrateur », et le superviseur qui vient de
    // l'ajouter ne pourrait pas la retirer.
    const bloc = edge.split('found.company_id === prof.company_id')[1]?.split('other_company')[0] ?? ''
    expect(bloc, 'le rattachement ne dit plus qui a fait entrer la personne')
      .toMatch(/ajoute_par:\s*inviter\.id/)
  })

  it('⚠️ les magasins visés restent les siens', () => {
    // Sans cette borne, un appel direct rattacherait quelqu'un à n'importe
    // quel magasin de n'importe quelle entreprise.
    const bloc = edge.split('found.company_id === prof.company_id')[1]?.split('other_company')[0] ?? ''
    expect(bloc, 'le rattachement ne vérifie plus que le magasin est le sien')
      .toContain("from('store_supervisors')")
  })
})

describe('⚠️⚠️ la notification attend le mot de passe, pas la connexion', () => {
  const sql = sqlDuDepot()

  it('elle se déclenche sur le marqueur', () => {
    // ⚠️ TROISIÈME VISAGE DU MÊME DÉFAUT EN UNE JOURNÉE : le badge, le bouton
    // « Renvoyer le lien », puis la notification. Tous suivaient « s'est
    // connecté », parce que c'était le seul fait que la base savait dire. Or
    // cliquer sur le lien d'invitation EST une connexion.
    //
    // Mesuré : la notification pour « Julien Compteur » est partie à
    // 05:44:42, l'instant du premier clic sur « Continuer ». Trois
    // superviseurs ont appris qu'un compte était prêt alors que la personne
    // était bloquée.
    expect(sql, 'le déclencheur de notification a disparu')
      .toMatch(/create trigger auth_users_notifier_compte_finalise/)
    const bloc = sql.split('create trigger auth_users_notifier_compte_finalise').pop() ?? ''
    expect(bloc.slice(0, 500), 'la notification ne suit plus le marqueur')
      .toContain('mot_de_passe_cree')
    expect(bloc.slice(0, 500), 'la notification est revenue à « s’est connecté »')
      .not.toContain('last_sign_in_at')
  })

  it('⚠️ et elle ne part qu’au PASSAGE du marqueur', () => {
    // Sans le `old`, chaque modification ultérieure du compte renverrait la
    // même notification.
    const bloc = sql.split('create trigger auth_users_notifier_compte_finalise').pop() ?? ''
    expect(bloc.slice(0, 500), 'la notification repartira à chaque modification du compte')
      .toMatch(/old\.raw_user_meta_data/)
  })

  it('⚠️ et le texte dit ce qui s’est passé', () => {
    const src = readFileSync(path.resolve(racine, 'components/Notifications.tsx'), 'utf8')
    const bloc = src.split("case 'compteur_actif':")[1]?.split('case ')[0] ?? ''
    expect(bloc, 'le bloc de la notification ne se lit plus').not.toBe('')
    expect(bloc, 'la notification annonce encore une simple connexion')
      .not.toContain('s’est connecté pour la première fois')
  })
})
