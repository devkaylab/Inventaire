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

describe('⚠️ la demande de suppression est la DERNIÈRE action de la ligne', () => {
  const bloc = (() => {
    const page = sansCommentaires(lire('app/equipe/page.tsx'))
    const sup = page.split('(sup?.stores ?? []).map(')[1]?.split('Invitations en cours')[0] ?? ''
    const i = sup.indexOf('<div className="req-actions">')
    return i === -1 ? '' : sup.slice(i)
  })()

  it('elle vient après le retrait, pas avant', () => {
    // Demande de Julien, 10 octobre 2026 : « mets la suppression tout à
    // droite ». Dans une rangée, l'ordre du code EST l'ordre à l'écran.
    expect(bloc, 'la rangée d’actions ne se lit plus').not.toBe('')
    const iRetrait = bloc.indexOf("t('Retirer du magasin')}</button>")
    const iSuppr = bloc.indexOf("t('Demander la suppression du compte')}</button>")
    expect(iRetrait, 'le retrait a disparu de la rangée').toBeGreaterThan(-1)
    expect(iSuppr, 'la demande de suppression a disparu de la rangée').toBeGreaterThan(-1)
    expect(iSuppr, 'la demande de suppression est repassée avant le retrait')
      .toBeGreaterThan(iRetrait)
  })

  it('⚠️ et un filet la sépare du retrait', () => {
    // « Retirer » laisse le compte en vie, la demande vise à l'effacer. Sans
    // séparation ils se lisent comme une paire de boutons interchangeables —
    // c'est le commentaire que `.action-sep` portait déjà, orphelin.
    expect(bloc, 'les deux gestes se lisent de nouveau comme une paire')
      .toContain('action-sep')
  })

  it('ce sont des boutons, pas des liens', () => {
    // Demande de Julien : « mets-moi des boutons ». Trois actions côte à côte
    // en texte nu se lisent comme une phrase, pas comme des gestes.
    expect(bloc.split('<button').length - 1, 'la rangée ne porte plus trois boutons')
      .toBeGreaterThanOrEqual(3)
    expect(bloc, 'les actions sont redevenues de simples liens')
      .not.toMatch(/className="link-btn/)
  })
})

describe('⚠️ deux rangées voisines partagent leur bord droit', () => {
  it('les rangées de compteurs portent la variante alignée', () => {
    // Relevé par Julien, capture à l'appui : un compteur avec badge et trois
    // boutons, un autre sans badge et deux — leurs rangées d'actions ne
    // finissaient pas au même bord.
    const page = sansCommentaires(lire('app/equipe/page.tsx'))
    const sup = page.split('(sup?.stores ?? []).map(')[1]?.split('Invitations en cours')[0] ?? ''
    expect(sup, 'la rangée d’un compteur n’est plus alignée')
      .toContain('req-row req-row-alignee')
  })

  it('⚠️ et la variante pousse les actions sans défaire la règle générale', () => {
    // `.admin-section .req-row` est en `flex-start` EXPRÈS : un
    // `space-between` laissait 868 px de vide sur les autres écrans. La
    // variante ne touche qu'à ces rangées-ci.
    const css = lire('app/globals.css')
    expect(css, 'la variante alignée a disparu')
      .toMatch(/\.req-row-alignee > \.req-actions\s*\{[^}]*margin-left:\s*auto/)
    expect(css, 'la règle générale a été changée au lieu d’être bornée')
      .toContain('.admin-section .req-row { justify-content: flex-start;')
  })
})

describe('⚠️⚠️ une demande écrite doit se VOIR', () => {
  it('⚠️⚠️ la cloche ne jette aucun type que le composant sait afficher', () => {
    // LE DÉFAUT DU 10 OCTOBRE 2026, EN UNE ASSERTION. La demande était en
    // base, la notification posée, l'e-mail parti — et rien à l'écran :
    // `mes_notifications` porte une LISTE BLANCHE de types, et les deux
    // derniers n'y avaient pas été ajoutés. Son propre commentaire prévenait :
    // « un type déposé sans être ajouté ICI n'apparaît jamais dans la cloche,
    // sans que rien ne le signale ». Eh bien maintenant, si.
    const { corps } = derniereDefinition('mes_notifications')
    const composant = sansCommentaires(lire('components/Notifications.tsx'))
    const affiches = [...composant.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1])
    expect(affiches.length, 'le composant n’affiche plus aucun type').toBeGreaterThan(4)
    // ⚠️ `message` est le seul à ne pas venir de la table : il est fabriqué par
    // la branche `fils` de la fonction, depuis les fils de discussion.
    const attendus = affiches.filter((type) => type !== 'message')
    const jetes = attendus.filter((type) => !corps.includes(`'${type}'`))
    expect(jetes, `la cloche jette ${jetes.join(', ')} : le composant sait les afficher, la liste blanche les écarte`)
      .toEqual([])
  })

  it('⚠️ l’administrateur a une section, et l’e-mail y mène', () => {
    // Il recevait une notification et un e-mail pour un geste qu'aucun écran
    // ne proposait : retenir le nom, le retrouver dans la liste des membres,
    // et deviner que « Supprimer le compte » répondait à la demande.
    const page = sansCommentaires(lire('app/equipe/page.tsx'))
    expect(page, 'la section des demandes a disparu de l’écran')
      .toContain('id="demandes-suppression"')
    expect(page, 'l’écran ne lit plus les demandes rendues par la base')
      .toContain('demandes_suppression')
    const { corps } = derniereDefinition('ca_list_team')
    expect(corps, 'la base ne rend plus les demandes à l’administrateur')
      .toContain("'demandes_suppression'")
    expect(corps, 'la liste ne se limite plus aux demandes en attente')
      .toMatch(/etat\s*=\s*'en_attente'/)
  })

  it('⚠️ et l’ancre est la MÊME dans l’e-mail, la notification et la page', () => {
    // Trois endroits pour un seul nom : renommer l'ancre d'un côté casse les
    // deux autres, en silence — le lien ouvre le haut de la page.
    const ancre = '/equipe#demandes-suppression'
    const edge = readFileSync(
      path.join(racine, '..', 'supabase', 'functions', 'demander-suppression', 'index.ts'), 'utf8')
    expect(edge.replace(/^\s*\/\/.*$/gm, ''), 'le bouton de l’e-mail ne mène plus à la demande')
      .toContain('/equipe#demandes-suppression')
    expect(sansCommentaires(lire('components/Notifications.tsx')), 'la notification ne mène plus à la demande')
      .toContain(ancre)
    expect(sansCommentaires(lire('app/equipe/page.tsx')), 'la page n’amène plus à l’ancre')
      .toContain('demandes-suppression')
  })

  it('⚠️⚠️ une demande peut être REFUSÉE, sinon elle ne sort jamais de la liste', () => {
    // Le seul chemin ouvert était la suppression : un administrateur qui ne
    // veut pas supprimer laissait la demande « en attente » pour toujours, et
    // le superviseur n'apprenait jamais la décision. C'est le cul-de-sac du
    // 9 octobre, à l'autre bout du même parcours.
    const { corps } = derniereDefinition('ca_refuser_suppression')
    expect(corps, 'le refus n’existe plus').not.toBe('')
    expect(corps, 'le refus n’est plus réservé à l’administrateur')
      .toContain('is_company_admin()')
    // ⚠️ La borne est sur la LIGNE VISÉE : l'entreprise de la demande.
    expect(corps, 'le refus ne vérifie plus l’entreprise de la demande')
      .toMatch(/company_id\s*=\s*v_company/)
    expect(corps, 'une demande déjà traitée peut être refusée une seconde fois')
      .toMatch(/etat\s*<>\s*'en_attente'/)
    expect(corps, 'le demandeur n’est plus prévenu du refus')
      .toContain("'demande_suppression_traitee'")
    expect(corps, 'la notification de refus ne se distingue plus d’une suppression')
      .toContain("'refusee'")
    const page = sansCommentaires(lire('app/equipe/page.tsx'))
    expect(page, 'l’écran n’offre plus le refus').toContain('setARefuser')
  })
})
