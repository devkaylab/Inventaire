import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// « Mon profil » était le carrefour de l'app : identité, entreprise, magasins,
// balises, inventaires, équipe, déconnexion et suppression dans un seul écran.
// Le site avait démonté le même carrefour ; l'app suit. Ces gardes figent le
// découpage et, surtout, la conséquence de sécurité qu'il entraîne.

const here = path.dirname(fileURLToPath(import.meta.url))
const src = (p: string) => path.join(here, '..', 'src', p)
const lire = (p: string) => readFileSync(src(p), 'utf8')

describe('découpage de Mon compte', () => {
  it('l’ancien écran carrefour n’existe plus', () => {
    expect(existsSync(src('app/(supervisor)/profile.tsx'))).toBe(false)
    expect(existsSync(src('app/(supervisor)/account.tsx'))).toBe(true)
  })

  it('chaque bloc sorti du profil a son écran', () => {
    for (const ecran of ['stores', 'team', 'tools', 'password', 'mfa', 'my-data', 'name']) {
      expect(existsSync(src(`app/(supervisor)/${ecran}.tsx`))).toBe(true)
    }
  })

  it('le bouton profil du bandeau ouvre Mon compte', () => {
    const layout = lire('app/(supervisor)/_layout.tsx')
    expect(layout).toContain("router.push('/(supervisor)/account')")
    expect(layout).not.toContain("/(supervisor)/profile")
  })

  it('Mon compte ne liste plus les inventaires — l’écran Sessions le fait déjà', () => {
    const compte = lire('app/(supervisor)/account.tsx')
    expect(compte).not.toContain('getMySessions')
  })

  it('le nom du magasin n’est plus aligné à droite comme dans un tableau clé/valeur', () => {
    // Le style partagé portait `textAlign: 'right'`, ce qui envoyait le nom
    // du magasin d'un côté et son code de l'autre.
    const magasins = lire('app/(supervisor)/stores.tsx')
    expect(magasins).not.toContain("textAlign: 'right'")
  })
})

describe('double authentification — la connexion doit demander le code', () => {
  // Sans cette étape, activer la double authentification depuis le téléphone
  // ne protégerait que le site : l'app continuerait à laisser entrer au mot de
  // passe seul. Les deux gardes ci-dessous tiennent ensemble ou pas du tout.

  it('la connexion affiche l’étape du code quand la session est restée en aal1', () => {
    const login = lire('app/login.tsx')
    expect(login).toContain('mfaRequired')
    expect(login).toContain('challengeAndVerify')
  })

  it('l’entrée de l’app renvoie vers la connexion tant que le code manque', () => {
    const index = lire('app/index.tsx')
    expect(index).toContain('mfaRequired')
    expect(index).toMatch(/if \(mfaRequired\) return <Redirect href="\/login" \/>/)
  })

  it('le contrat aal1/aal2 est celui du site', () => {
    const mfa = lire('lib/mfa.ts')
    expect(mfa).toContain("data.nextLevel === 'aal2'")
    expect(mfa).toContain("data.currentLevel !== 'aal2'")
    // En cas de doute, on n'enferme personne dehors.
    expect(mfa).toContain('return false')
  })
})
