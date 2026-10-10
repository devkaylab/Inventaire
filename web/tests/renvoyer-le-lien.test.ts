import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Un lien d'invitation ne mène jamais à un cul-de-sac — la garde (9 oct. 2026).
 *
 * ⚠️⚠️ **CE QUE CE DÉFAUT A COÛTÉ : UN COMPTE SUPPRIMÉ.** Un superviseur ouvre
 * son lien sur son téléphone, clique « Continuer », et se fait interrompre
 * avant de choisir son mot de passe. Le navigateur recharge la page tout seul.
 * Le jeton, lui, a déjà servi — il ne sert qu'une fois — et il a été retiré de
 * l'adresse. La page annonce « Lien expiré » à quelqu'un qui est **encore
 * connecté**, à un clic de finir. Côté administrateur, la seule action visible
 * sur cette personne était « Supprimer le compte ». Il l'a supprimée.
 *
 * Trois faits tenus ici, et chacun suffisait à éviter ça :
 *   1. on ne conclut jamais « expiré » sans avoir relu la session ;
 *   2. l'écran « expiré » mène à un nouveau lien, au lieu d'envoyer chercher
 *      quelqu'un ;
 *   3. l'administrateur ET le superviseur peuvent renvoyer le lien.
 */

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
/** ⚠️ Les commentaires RACONTENT le défaut : les lire ferait passer la garde. */
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/** Le corps d'une fonction, de sa signature à l'accolade de même niveau. */
function corps(source: string, signature: RegExp): string {
  const m = signature.exec(source)
  if (!m) return ''
  const debut = m.index
  const indentation = (source.slice(0, debut).split('\n').pop() ?? '').length
  const fin = source.indexOf(`\n${' '.repeat(indentation)}}`, debut)
  return source.slice(debut, fin === -1 ? source.length : fin)
}

describe('⚠️⚠️ on ne conclut pas « expiré » sans avoir regardé la session', () => {
  const bienvenue = sansCommentaires(lire('app/bienvenue/page.tsx'))

  it('l’échange du jeton raté est rattrapé par la session en cours', () => {
    const c = corps(bienvenue, /async function continuer\(\)/)
    expect(c, 'continuer() ne se lit plus').not.toBe('')
    const echange = c.indexOf('ouvrirLeLien')
    const relecture = c.indexOf('getSession')
    expect(echange, 'le jeton ne s’échange plus ici').toBeGreaterThan(-1)
    expect(
      relecture,
      'le jeton a déjà servi et personne ne relit la session : la page dira ' +
        '« expiré » à quelqu’un d’encore connecté',
    ).toBeGreaterThan(echange)
  })

  it('et la session prime sur le jeton au chargement', () => {
    // Le rechargement automatique d'un téléphone arrive SANS jeton dans
    // l'adresse : si la page ne regarde pas d'abord la session, elle n'a plus
    // rien à quoi se raccrocher.
    const e = corps(bienvenue, /useEffect\(\(\) => \{/)
    const session = e.indexOf('getSession')
    const jeton = e.indexOf('lireJetonDuLien')
    expect(session, 'le chargement ne regarde plus la session').toBeGreaterThan(-1)
    expect(jeton, 'le chargement ne lit plus le jeton').toBeGreaterThan(-1)
    expect(session, 'le jeton est consulté avant la session').toBeLessThan(jeton)
  })

  it('⚠️⚠️ l’écran « expiré » ENVOIE, il ne renvoie pas vers un formulaire', () => {
    // Deux détours successifs, et le second est le mien. D'abord l'écran
    // disait « demandez une nouvelle invitation à la personne qui vous a
    // ajouté ». Puis (9 octobre) il a porté un bouton « Recevoir un nouveau
    // lien » — qui NE FAISAIT QUE NAVIGUER vers « Mot de passe oublié ».
    // Julien a cliqué et n'a rien reçu : mesuré dans les journaux, ZÉRO appel
    // à la fonction d'envoi. Un bouton qui annonce un envoi doit envoyer.
    const bloc = corps(bienvenue, /if \(!hasSession\) \{/)
    expect(bloc, 'l’écran « expiré » ne se lit plus').not.toBe('')
    expect(bloc, 'l’écran « expiré » ne demande plus l’adresse').toContain('<form')
    expect(bienvenue, 'l’écran « expiré » n’envoie plus rien lui-même')
      .toContain('envoyerLienDeConnexion(')
    // ⚠️ Et il ne retombe pas dans le détour : un lien vers la page du
    // formulaire remplacerait l'envoi par un clic de plus.
    expect(bloc, 'le bouton est redevenu un lien vers un autre écran')
      .not.toContain('/mot-de-passe-oublie')
  })

  it('⚠️ et les deux écrans passent par le MÊME envoi', () => {
    // Recopier l'envoi, c'est recopier le repli — et la prochaine correction
    // n'en toucherait qu'une des deux copies.
    for (const f of ['app/bienvenue/page.tsx', 'app/mot-de-passe-oublie/page.tsx']) {
      const src = sansCommentaires(lire(f))
      expect(src, `${f} appelle la fonction edge en direct`)
        .not.toContain("invoke('mot-de-passe-oublie'")
      expect(src, `${f} ne passe plus par l’envoi partagé`)
        .toContain('envoyerLienDeConnexion')
    }
  })
})

describe('⚠️ renvoyer le lien est possible pour les deux rôles', () => {
  const equipe = sansCommentaires(lire('app/equipe/page.tsx'))

  it('le renvoi passe par la fonction déjà déployée', () => {
    // En écrire une seconde, c'est refaire la borne sur l'hôte de retour et la
    // réponse qui ne dit jamais si un compte existe.
    const f = corps(equipe, /async function renvoyerLeLien\(/)
    expect(f, 'renvoyerLeLien ne se lit plus').not.toBe('')
    expect(f, 'le renvoi n’appelle plus la fonction du produit')
      .toContain("invoke('mot-de-passe-oublie'")
  })

  it('⚠️ et il est proposé des DEUX côtés, pas seulement à l’administrateur', () => {
    // Le superviseur est le premier à voir qu'un compteur n'a pas fini : c'est
    // lui qui l'a ajouté.
    const appels = equipe.match(/renvoyerLeLien\(/g) ?? []
    expect(
      appels.length,
      'un seul rôle peut renvoyer le lien : l’autre n’aura que « supprimer »',
    ).toBeGreaterThanOrEqual(3) // la définition + un appel par rôle
  })

  it('⚠️⚠️ et côté administrateur il est VISIBLE, pas rangé dans le menu « ⋯ »', () => {
    // Il y était, et personne ne l'a trouvé : « tu n'as pas ajouté de bouton
    // renvoyer le lien sur admin » (Julien, 10 octobre 2026). Le menu existe
    // pour ÉLOIGNER le geste définitif ; y ranger le seul geste attendu face à
    // une ligne ambre revient à le mettre au même endroit que lui.
    const debutMenu = equipe.indexOf('ActionRangee[] =')
    const debutRangee = equipe.indexOf('<Fragment key={m.id}>')
    expect(debutMenu, 'la liste d’actions de la rangée ne se lit plus').toBeGreaterThan(-1)
    expect(debutRangee, 'la rangée d’un membre ne se lit plus').toBeGreaterThan(debutMenu)
    expect(
      equipe.slice(debutMenu, debutRangee),
      'le renvoi du lien est reparti se cacher derrière les trois points',
    ).not.toContain('renvoyerLeLien')
    // Et il est bien rendu quelque part dans la rangée, sinon il a simplement
    // disparu de l'écran de l'administrateur.
    const rangee = equipe.slice(debutRangee, equipe.indexOf('</Fragment>', debutRangee))
    expect(rangee, 'l’administrateur n’a plus aucun moyen de renvoyer le lien')
      .toContain('renvoyerLeLien(')
    expect(rangee, 'le renvoi n’est plus un bouton').toContain('<button')
    // ⚠️ Et il est gouverné par le MÊME fait que l'ambre. Un garde posé sur
    // autre chose (ou neutralisé) ferait disparaître le bouton de la seule
    // ligne qui en a besoin, sans que rien ne le signale.
    const avantLeBouton = rangee.slice(
      Math.max(0, rangee.indexOf('renvoyerLeLien(') - 300),
      rangee.indexOf('renvoyerLeLien('),
    )
    expect(avantLeBouton, 'le bouton de renvoi ne suit plus « a créé son mot de passe »')
      .toContain('!m.compte_finalise')
  })

  it('⚠️ et la bande de résumé compte le MÊME fait que les lignes', () => {
    // « 0 mot de passe à créer » au-dessus de lignes ambre : le compteur lisait
    // `is_active`, qui tombe au clic sur le lien, bien avant le mot de passe.
    const bande = equipe.slice(
      equipe.indexOf('resume-bande'),
      equipe.indexOf('Mot de passe à créer', equipe.indexOf('resume-bande')),
    )
    expect(bande, 'la bande de résumé ne se lit plus').not.toBe('')
    expect(bande, 'la bande recompte « s’est connecté » au lieu de « a un mot de passe »')
      .not.toContain('is_active')
  })
})
