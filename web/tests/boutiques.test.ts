// Les textes des deux fiches de boutique.
//
// ⚠️ Un champ trop long n'est pas refusé à la soumission : la console **coupe
// le texte**, souvent au milieu d'un mot, et personne ne s'en aperçoit avant de
// voir la fiche en ligne. Ces tests comptent les caractères à notre place.
//
// La source est `docs/entreprise/boutiques/fiches.md` : c'est de là qu'on
// copie vers App Store Connect et vers la Play Console.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const fiches = readFileSync(
  path.resolve(__dirname, '../../docs/entreprise/boutiques/fiches.md'), 'utf8',
)
const blocs = [...fiches.matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1])
const [nomIOS, sousTitre, motsCles, promo, description, titrePlay, courtePlay] = blocs

describe('les fiches tiennent dans les limites des boutiques', () => {
  it.each([
    ['nom App Store', () => nomIOS, 30],
    ['sous-titre App Store', () => sousTitre, 30],
    ['mots-clés App Store', () => motsCles, 100],
    ['texte promotionnel App Store', () => promo, 170],
    ['description', () => description, 4000],
    ['titre Google Play', () => titrePlay, 50],
    ['description courte Google Play', () => courtePlay, 80],
  ])('%s', (_, texte, max) => {
    const t = texte()
    expect(t, 'bloc absent de fiches.md').toBeTruthy()
    expect(t.length, `${t.length} caractères pour ${max} permis`).toBeLessThanOrEqual(max)
  })
})

describe('le champ de mots-clés d’Apple suit ses règles', () => {
  it('aucune espace après les virgules', () => {
    // Chaque espace est un caractère perdu sur cent.
    expect(motsCles).not.toContain(', ')
  })

  it('aucun mot déjà porté par le nom ou le sous-titre', () => {
    // Apple les indexe déjà : les répéter gaspille le champ.
    const deja = (nomIOS + ' ' + sousTitre).toLowerCase()
    const repetes = motsCles.split(',').filter(m => deja.includes(m.toLowerCase()))
    expect(repetes, `déjà indexés : ${repetes.join(', ')}`).toEqual([])
  })
})

describe('la fiche dit que l’accès vient de l’entreprise', () => {
  it('la description l’annonce, et tôt', () => {
    // ⚠️ Sans cette mention, deux choses arrivent : des gens installent
    // l'application, se heurtent à l'écran de connexion et notent une étoile ;
    // et Apple refuse au titre de la règle 2.1 — une application dont la
    // fonction principale exige un compte doit dire comment on l'obtient.
    expect(description).toContain('ACCÈS SUR INVITATION')
    expect(description.indexOf('invitation')).toBeLessThan(600)
  })

  it('la description courte de Play la porte aussi', () => {
    // C'est le seul texte visible avant « Plus d'infos ».
    expect(courtePlay.toLowerCase()).toContain('invitation')
  })
})

describe('rien qui fasse refuser la fiche', () => {
  it('aucune mention promotionnelle ni fausse récompense', () => {
    const interdits = ['gratuit', 'meilleur', 'n°1', 'étoiles', 'choix de la rédaction']
    for (const mot of interdits) {
      expect(description.toLowerCase(), `« ${mot} » n’a rien à faire dans une fiche`)
        .not.toContain(mot)
    }
  })

  it('aucun prix : la licence se vend hors boutique', () => {
    // Un prix annoncé ici ferait croire à un achat intégré — qu'Apple
    // exigerait alors de faire passer par son propre système de paiement.
    expect(description).not.toMatch(/\d+\s*€/)
  })
})
