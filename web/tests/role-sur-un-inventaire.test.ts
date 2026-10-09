// Le rôle sur un inventaire — la garde (9 octobre 2026).
//
// Julien : « ajouter une personne à son inventaire, je vois que l'on peut
// choisir si c'est un compteur ou un co-superviseur. Sauf que normalement un
// compteur ne peut pas être superviseur. […] Ajouter un compteur = compteur,
// ajouter un superviseur = co-superviseur. Ajouter l'admin = co-superviseur. »
//
// ⚠️⚠️ **CE QUI REND CETTE GARDE NÉCESSAIRE : « enlever le sélecteur » NE
// SUFFISAIT PAS.** La fonction edge lisait le rôle dans le corps de la requête
// et l'écrivait avec la clé de service, hors RLS. Cacher le choix à l'écran
// aurait laissé la porte ouverte à un appel direct. La règle vit donc en base,
// et ce fichier tient les quatre endroits où elle pourrait repousser : la base,
// la fonction edge, l'app, le site.
//
// ⚠️ Et il NE CITE PAS les rôles qu'il surveille : il lit la règle dans la
// migration qui tourne et vérifie que les trois autres endroits n'en portent
// aucune copie.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'

const racine = path.resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/** ⚠️ Le code sans ses commentaires : ici ils RACONTENT le défaut, donc ils citent ce qu'on interdit. */
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/^\s*(--|\/\/).*$/gm, '')

const ECRANS = [
  'src/app/(supervisor)/[sessionId]/invite.tsx',
  'web/components/dashboard/AddSessionMember.tsx',
] as const

const PASSERELLES = ['src/lib/queries.ts', 'web/lib/inventory.ts'] as const

describe('⚠️ la base décide du rôle, et personne d’autre', () => {
  it('la règle se lit en base, et elle rend les deux rôles', () => {
    const corps = sansCommentaires(derniereDefinition('role_de_session').corps)
    // Déduit : les deux issues de la règle, telles qu'elle les écrit.
    const issues = [...corps.matchAll(/'(\w+)'/g)].map((m) => m[1])
    expect(issues, 'le rôle de co-superviseur ne sort plus de la règle').toContain('supervisor')
    expect(issues, 'le rôle de compteur ne sort plus de la règle').toContain('counter')
    // Et ce sur quoi elle se fonde : le rôle d'entreprise, et l'administrateur.
    expect(corps, 'la règle ne lit plus le rôle d’entreprise').toMatch(/p\.role/)
    expect(corps, 'l’administrateur d’entreprise est sorti de la règle')
      .toMatch(/is_company_admin/)
  })

  it('⚠️ un déclencheur l’impose, et sur la mise à jour aussi', () => {
    // ⚠️ `before insert` SEUL NE SUFFIRAIT PAS : `invite-to-session` fait un
    // `upsert`, donc une ligne existante passe par UPDATE. C'est la porte que
    // le banc de la réplique ouvre exprès (« et par un upsert, comme la
    // fonction edge »).
    const fichier = sansCommentaires(fichierDe('session_members_role_suit_le_profil'))
    const decl = /create trigger (\w+)\s+([\s\S]{0,120}?)on public\.session_members/i.exec(fichier)
    expect(decl, 'le déclencheur sur session_members ne se lit plus').toBeTruthy()
    expect(decl![2]).toMatch(/before/i)
    expect(decl![2], 'le déclencheur ne couvre plus la mise à jour').toMatch(/update/i)

    const corps = sansCommentaires(derniereDefinition('session_members_role_suit_le_profil').corps)
    expect(corps, 'le déclencheur ne calcule plus le rôle').toContain('role_de_session')
    expect(corps, 'le déclencheur n’écrase plus ce qu’on lui donne').toMatch(/new\.role\s*:?=/)
  })

  it('⚠️ et changer le rôle d’entreprise entraîne les inventaires', () => {
    // Sans ça la règle serait vraie à l'ajout et fausse ensuite : un compteur
    // promu resterait « compteur » dans ses inventaires.
    const corps = sansCommentaires(derniereDefinition('ca_set_user_role').corps)
    expect(corps, 'une promotion ne met plus les inventaires d’accord')
      .toMatch(/update public\.session_members[\s\S]{0,120}role_de_session/)
  })

  it('⚠️ le retrait d’On-Demand ne casse pas la fonction d’OS', () => {
    // ⚠️ LE PIÈGE DE `prendre_place_appareil`, QU'ON NE REFAIT PAS : une
    // fonction de Quantinvo OS qui appelle une fonction disparue, et un
    // changement de rôle qui échoue pour tout le monde. `ca_set_user_role`
    // appelle `role_de_session` : le script de retrait ne doit donc PAS la
    // supprimer.
    const retrait = lire('scripts/replique/90-retirer.sql')
    expect(retrait, 'le déclencheur du rôle n’est plus retiré')
      .toContain('drop trigger if exists session_members_role_calcule')
    expect(retrait, 'le retrait supprime role_de_session, dont ca_set_user_role dépend')
      .not.toMatch(/drop function if exists public\.role_de_session/)
  })
})

describe('⚠️ aucun client ne porte de rôle', () => {
  it('la fonction edge ne lit plus de rôle dans la requête', () => {
    const src = sansCommentaires(lire('supabase/functions/invite-to-session/index.ts'))

    // ⚠️ **ON LIT LE TYPE DU CORPS DE REQUÊTE, PAS UNE TOURNURE.** Première
    // version de cette garde : `not.toMatch(/payload\.role/)`. Sabotée avec
    // `(payload as { role?: string }).role`, elle restait verte — la même
    // lecture, écrite autrement. Ce qui ne se contourne pas, c'est le TYPE :
    // si `role` n'y est pas déclaré, il n'y a rien à lire.
    const type = /let payload:\s*\{([^}]*)\}/.exec(src)?.[1]
    expect(type, 'le type du corps de requête ne se lit plus').toBeTruthy()
    expect(type, 'le corps de requête déclare de nouveau un rôle')
      .not.toMatch(/\brole\b/)

    // ⚠️ ET TOUTE LIAISON DE `role` VIENT DE LA RÉPONSE DE LA BASE. C'est la
    // forme générale : peu importe comment on l'écrit, la valeur doit venir de
    // `pose`, jamais de la requête.
    const liaisons = [...src.matchAll(/(?:const|let)\s+role\b[^=]*=\s*([^\n]+)/g)]
      .map((m) => m[1])
    expect(liaisons.length, 'le rôle n’est plus nommé dans la fonction edge')
      .toBeGreaterThan(0)
    for (const droite of liaisons) {
      expect(droite, `le rôle vient de « ${droite.trim()} », pas de la base`)
        .toMatch(/\bpose\b/)
    }

    // Et son écriture n'en porte pas : le déclencheur décide.
    const upsert = /\.upsert\(\{[^}]*\}/.exec(src)?.[0] ?? ''
    expect(upsert, 'l’écriture de l’appartenance ne se lit plus').not.toBe('')
    expect(upsert, `l’écriture porte encore un rôle : ${upsert}`).not.toMatch(/\brole\b/)
  })

  it('⚠️ elle RELIT celui que la base a calculé, elle ne le redéduit pas', () => {
    // L'e-mail et la notification annoncent un rôle. Le recalculer en
    // TypeScript ferait une seconde règle, qui divergerait à la première
    // correction portée sur une seule des deux.
    const src = sansCommentaires(lire('supabase/functions/invite-to-session/index.ts'))
    expect(src, 'le rôle affiché ne vient plus de la base')
      .toMatch(/const role[^=]*=\s*pose\?\.role/)
    expect(src, 'le rôle constaté ne revient plus aux écrans')
      .toMatch(/return json\(\{[^}]*\brole\b/)
  })

  for (const f of PASSERELLES) {
    it(`${f} n’envoie pas de rôle`, () => {
      const src = sansCommentaires(lire(f))
      const corps = /functions\.invoke\('invite-to-session',\s*\{[\s\S]*?\n  \}\)/.exec(src)?.[0] ?? ''
      expect(corps, 'l’appel à invite-to-session ne se lit plus').not.toBe('')
      expect(corps, `${f} envoie encore un rôle`).not.toMatch(/\brole\b/)
    })
  }

  for (const f of ECRANS) {
    it(`${f} ne laisse pas CHOISIR le rôle`, () => {
      const src = sansCommentaires(lire(f))
      // ⚠️ La forme la plus générale : un état de rôle est le seul moyen
      // d'offrir un choix, et un `setRole` le seul moyen de le changer.
      expect(src, 'un état de rôle est revenu : le choix avec lui')
        .not.toMatch(/useState<SessionRole>|setRole\s*\(/)
      // Et aucun appel d'ajout ne porte de rôle, même constant.
      for (const appel of [...src.matchAll(/inviteToSession\(\{[^}]*\}/g)].map((m) => m[0])) {
        expect(appel, `cet appel porte un rôle : ${appel}`).not.toMatch(/\brole\b/)
      }
    })

    it(`${f} le CONSTATE depuis l’annuaire`, () => {
      // ⚠️ Depuis l'annuaire — la même source que la base — jamais une seconde
      // règle écrite dans l'écran.
      const src = sansCommentaires(lire(f))
      expect(src, 'l’écran n’annonce plus le rôle de la personne choisie')
        .toMatch(/(selected|choisi)\.role === 'supervisor'/)
    })
  }

  it('⚠️ et le site n’a plus de liste déroulante de rôle', () => {
    // Le `select`/`option` était la forme du choix sur le site. La garde
    // ci-dessus attrape l'état ; celle-ci attrape le gabarit, au cas où
    // quelqu'un le recâblerait autrement.
    const src = sansCommentaires(lire('web/components/dashboard/AddSessionMember.tsx'))
    expect(src, 'une option « co-superviseur » est revenue dans un menu')
      .not.toMatch(/<option[^>]*value="(counter|supervisor)"/)
  })
})
