// Effacer une conversation, et ses notifications (4 octobre 2026).
//
// La règle est de Julien, et elle vaut mieux que les trois options que je lui
// proposais : « Efface pour celui qui supprime uniquement. Un nouveau message
// donne une nouvelle conversation pour celui qui a supprimé les messages,
// sans afficher ce qui a été supprimé. »
//
// Ce que ces gardes empêchent de défaire : qu'un effacement devienne une
// suppression chez l'autre, qu'une des trois lectures oublie le point de
// coupe, et qu'une corbeille apparaisse.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition, fichierDe } from './migrations'

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const sansCommentaires = (s: string) => s.replace(/--.*$/gm, ' ')
const codeSeul = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('effacer un fil, c’est une coupe — pas une suppression', () => {
  const effacer = sansCommentaires(derniereDefinition('effacer_mon_fil').corps)

  it('⚠️ elle ne supprime AUCUNE ligne', () => {
    // Retirer sa ligne de `message_participants` aurait paru plus direct, et
    // aurait créé un fil fantôme : `repondre_fil` ne réinscrit pas un
    // participant parti, donc l'autre aurait continué d'écrire dans une
    // conversation que l'effaceur ne reverrait jamais.
    expect(effacer.toLowerCase()).not.toContain('delete from')
    expect(effacer).toContain('set efface_avant = now()')
  })

  it('elle refuse qui n’est pas dans le fil', () => {
    expect(effacer).toContain('message_participants')
    expect(effacer).toContain("raise exception 'forbidden'")
  })

  it('elle repose la lecture, pour que la cloche resonne au retour', () => {
    // Sans ça, un fil effacé puis rouvert par une réponse serait compté comme
    // déjà lu, et rien ne préviendrait.
    expect(effacer).toContain('lu_le = now()')
  })

  it('rien n’est effacé chez l’autre', () => {
    // La coupe est posée sur MA ligne de participation, jamais sur les
    // messages ni sur la participation d'autrui.
    expect(effacer).toMatch(/where fil_id = p_fil and user_id = v_uid/)
    expect(effacer.toLowerCase()).not.toContain('public.messages')
  })
})

describe('les trois lectures honorent la coupe', () => {
  /**
   * ⚠️ LA LISTE SE DÉDUIT : toute fonction qui lit `public.messages` pour la
   * personne connectée doit passer par la coupe. Trois le font aujourd'hui —
   * la boîte, le fil ouvert, la cloche —, et c'est la cloche qu'on aurait
   * oubliée, celle qu'on regarde le moins en écrivant du SQL.
   */
  const LECTURES = ['mes_fils', 'ouvrir_message_fil', 'mes_notifications']

  it('chacune appelle la règle, aucune ne la recopie', () => {
    for (const fn of LECTURES) {
      const corps = sansCommentaires(derniereDefinition(fn).corps)
      expect(corps, `${fn} lit les messages sans la coupe`).toContain('coupe_du_fil')
      // La règle vit dans `coupe_du_fil` : la réécrire ici la ferait diverger.
      expect(corps, `${fn} recopie la règle au lieu de l’appeler`)
        .not.toMatch(/coalesce\(\s*mp?\.?efface_avant/)
    }
  })

  /**
   * ⚠️ **AMENDÉE AVANT D'AVOIR SERVI**, et c'est le sabotage qui l'a dit. La
   * garde au-dessus demande que la fonction MENTIONNE la coupe quelque part.
   * En retirant la borne d'UNE seule sous-requête de la cloche — celle qui
   * nomme l'expéditeur — elle est restée verte : les quatre autres mentions
   * suffisaient. Or c'est exactement le défaut à craindre, une lecture
   * ajoutée plus tard sans sa borne.
   *
   * Celle-ci exige la borne sur CHAQUE lecture de `public.messages`. La
   * coupe s'y écrit soit par l'appel, soit par la variable qui la porte
   * (`ouvrir_message_fil` l'évalue une fois).
   */
  it('et aucune lecture des messages n’y échappe', () => {
    for (const fn of LECTURES) {
      const corps = sansCommentaires(derniereDefinition(fn).corps)
      const morceaux = corps.split(/from public\.messages/).slice(1)
      expect(morceaux.length, `${fn} ne lit plus les messages`).toBeGreaterThan(0)
      morceaux.forEach((bout, i) => {
        expect(
          /cree_le > (public\.coupe_du_fil\(|v_coupe)/.test(bout),
          `${fn} : la lecture n°${i + 1} de public.messages n’est pas bornée par la coupe`,
        ).toBe(true)
      })
    }
  })

  it('un fil sans rien de neuf sort de la boîte ET de la cloche', () => {
    // C'est ce qui fait qu'un effacement se voit comme un effacement.
    for (const fn of ['mes_fils', 'mes_notifications']) {
      const corps = sansCommentaires(derniereDefinition(fn).corps)
      expect(corps, `${fn} doit écarter un fil entièrement effacé`)
        .toMatch(/exists \(select 1 from public\.messages m[\s\S]*?coupe_du_fil/)
    }
  })

  it('la date de tête est celle du dernier message VISIBLE', () => {
    // Sinon un fil rouvert se rangerait à la date d'un échange effacé, et
    // remonterait ou descendrait au mauvais endroit dans la liste.
    const corps = sansCommentaires(derniereDefinition('mes_fils').corps)
    expect(corps).toMatch(/max\(m\.cree_le\)[\s\S]{0,160}coupe_du_fil/)
    expect(corps, 'la date du fil ne fait plus foi').not.toMatch(/fi\.dernier_le as dernier_le/)
  })

  it('la règle elle-même rend « rien d’effacé » quand rien ne l’est', () => {
    const corps = sansCommentaires(derniereDefinition('coupe_du_fil').corps)
    expect(corps).toContain("'-infinity'")
    expect(corps).toContain('auth.uid()')
  })
})

describe('effacer une notification', () => {
  const une = sansCommentaires(derniereDefinition('effacer_ma_notification').corps)
  const toutes = sansCommentaires(derniereDefinition('effacer_mes_notifications').corps)

  it('une notification n’appartient qu’à une personne : là, on supprime', () => {
    expect(une).toContain('delete from public.notifications')
    expect(toutes).toContain('delete from public.notifications')
  })

  it('⚠️ la garde porte sur la ligne visée, jamais sur un paramètre', () => {
    // `user_id = auth.uid()` dans le WHERE : passer l'identifiant d'autrui ne
    // supprime rien. C'est la règle de sécurité du projet, et elle se vérifie
    // sur la clause, pas sur l'intention.
    expect(une).toMatch(/where id = p_id and user_id = auth\.uid\(\)/)
    expect(toutes).toMatch(/where user_id = auth\.uid\(\)/)
  })

  it('effacer la cloche n’emporte aucune conversation', () => {
    // La cloche mêle de vraies notifications et un reflet des fils. Vider la
    // cloche en supprimant au passage un échange avec un client serait une
    // perte que personne n'a demandée.
    for (const corps of [une, toutes]) {
      expect(corps).not.toContain('message_participants')
      expect(corps).not.toContain('efface_avant')
    }
  })

  it('aucune des fonctions neuves n’est ouverte à un visiteur', () => {
    for (const fn of ['effacer_mon_fil', 'effacer_ma_notification',
                      'effacer_mes_notifications', 'coupe_du_fil']) {
      const fichier = fichierDe(fn)
      expect(
        new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`).test(fichier),
        `${fn} ne referme pas sa porte à anon`,
      ).toBe(true)
    }
  })
})

describe('les écrans', () => {
  const messages = codeSeul(lire('app/messages/page.tsx'))
  const cloche = codeSeul(lire('components/Notifications.tsx'))

  it('la conversation s’efface depuis la conversation ouverte', () => {
    expect(messages).toContain("rpc('effacer_mon_fil'")
    // Une ligne de la liste EST un bouton : y glisser une croix ferait un
    // bouton dans un bouton.
    expect(messages).toContain('fil-tete-haut')
  })

  it('⚠️ la confirmation dit qu’il n’y a pas de corbeille', () => {
    // Demande de Julien, mot pour mot. Un effacement sans retour s'annonce
    // avant, pas après.
    // ⚠️ Le MOT ne suffit pas : « elle part à la corbeille » contient
    // « corbeille » et dit l'inverse. C'est l'ABSENCE de corbeille qui doit
    // être annoncée, parce que l'effacement est sans retour.
    expect(messages).toMatch(/pas de corbeille/)
    expect(messages, 'elle doit dire que l’autre garde tout')
      .toMatch(/garde la conversation entière/)
  })

  it('la cloche efface une notification, et toutes', () => {
    expect(cloche).toContain("rpc('effacer_ma_notification'")
    expect(cloche).toContain("rpc('effacer_mes_notifications'")
  })

  it('⚠️ la croix n’apparaît pas sur une ligne de conversation', () => {
    // Elle effacerait un échange depuis un écran qui n'en montre qu'un
    // reflet. Les conversations s'effacent depuis Messages.
    expect(cloche).toMatch(/const effacable = \(n: Notif\) => n\.type !== 'message'/)
    expect(cloche).toContain('effacable(n) && (')
  })

  it('la croix est posée À CÔTÉ de la ligne, pas dedans', () => {
    // Une ligne qui mène quelque part est un `<button>` ; un bouton dans un
    // bouton n'est ni valide ni atteignable au clavier.
    const bloc = cloche.slice(cloche.indexOf('notif-ligne'))
    expect(bloc).toContain('notif-ligne')
    expect(bloc).not.toMatch(/notif-rang-lien[\s\S]{0,400}notif-x[\s\S]{0,80}<\/button>\s*<\/button>/)
  })

  it('le trait de séparation a suivi les lignes', () => {
    // ⚠️ Il vivait sur `.notif-rang + .notif-rang`. En enveloppant chaque
    // rangée, ce sélecteur ne correspond plus à rien : sans ce déplacement il
    // aurait disparu, et rien ne l'aurait signalé.
    const css = lire('app/globals.css')
    expect(css).toContain('.notif-ligne + .notif-ligne { border-top:')
    expect(css).not.toContain('.notif-rang + .notif-rang { border-top:')
  })
})
