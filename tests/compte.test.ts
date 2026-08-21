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
    expect(existsSync(src('app/(compte)/account.tsx'))).toBe(true)
  })

  it('le travail du superviseur a ses écrans, à lui', () => {
    for (const ecran of ['stores', 'team', 'tools']) {
      expect(existsSync(src(`app/(supervisor)/${ecran}.tsx`))).toBe(true)
    }
  })

  it('les écrans du compte sont communs à tous les rôles', () => {
    // Sous `(supervisor)`, la garde du groupe renvoyait un compteur vers la
    // connexion : il ne pouvait ni changer son mot de passe, ni récupérer ses
    // données. Ils vivent dans `(compte)`, dont la seule condition est d'avoir
    // un profil.
    for (const ecran of ['account', 'password', 'mfa', 'my-data', 'name']) {
      expect(existsSync(src(`app/(compte)/${ecran}.tsx`))).toBe(true)
      expect(existsSync(src(`app/(supervisor)/${ecran}.tsx`))).toBe(false)
    }
    const layout = lire('app/(compte)/_layout.tsx')
    expect(layout).not.toContain("role !== 'supervisor'")
    expect(layout).toContain('mfaRequired')
  })

  it('les deux rôles ouvrent Mon compte par le bouton du bandeau', () => {
    for (const groupe of ['(supervisor)', '(employee)']) {
      expect(lire(`app/${groupe}/_layout.tsx`)).toContain("router.push('/(compte)/account')")
    }
  })

  it('le compteur ne garde ni déconnexion ni suppression sur son accueil', () => {
    const accueil = lire('app/(employee)/index.tsx')
    expect(accueil).not.toContain('Déconnexion')
    expect(accueil).not.toContain('DeleteAccountButton')
  })

  it('le bloc « Mon travail » ne s’affiche que pour un superviseur', () => {
    const compte = lire('app/(compte)/account.tsx')
    expect(compte).toContain("profile?.role === 'supervisor'")
    expect(compte).toMatch(/\{superviseur && \(/)
  })

  it('Mon compte ne liste plus les inventaires — l’écran Sessions le fait déjà', () => {
    const compte = lire('app/(compte)/account.tsx')
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

describe('connexion — le sablier ne doit pas rester allumé', () => {
  // Anomalie du 21 août 2026, relevée par Julien en test : après « Se
  // connecter », l'écran basculait sur la saisie du code **en gardant le
  // sablier du mot de passe**, qui n'était jamais éteint (on le laissait
  // tourner jusqu'à la navigation, laquelle n'arrive jamais quand un second
  // facteur est attendu). Le bouton « Vérifier » étant désactivé tant que le
  // sablier tourne, la connexion devenait impossible.
  const login = lire('app/login.tsx')

  it('le mot de passe accepté éteint le sablier quand le code est attendu', () => {
    expect(login).toMatch(/if \(await mfaPending\(\)\) \{\s*\n\s*setLoading\(false\)/)
  })

  it('un échec de connexion sort de la fonction au lieu de poursuivre', () => {
    expect(login).toMatch(/Alert\.alert\('Connexion échouée', error\)\s*\n\s*return/)
  })

  it('l’écran du code dit de quel compte il s’agit', () => {
    expect(login).toContain('session?.user.email')
  })
})

describe('connexion — les deux étapes sont deux écrans', () => {
  // Anomalie du 21 août 2026, vue par Julien : de retour de la saisie du code,
  // le champ e-mail affichait « v o t r e @ e m a i l . c o m ». Les deux
  // étapes ont la même forme d'arbre, React réutilisait donc la vue native du
  // champ, et l'espacement des chiffres (letterSpacing: 8) restait collé —
  // sur iOS il passe par le texte attribué et n'est pas remis à zéro quand le
  // style suivant ne le mentionne plus.
  const login = lire('app/login.tsx')

  it('chaque étape porte sa propre identité, pour forcer un remontage', () => {
    expect(login).toContain('key="etape-code"')
    expect(login).toContain('key="etape-mot-de-passe"')
  })

  it('le champ ordinaire énonce son espacement au lieu de le laisser vacant', () => {
    expect(login).toMatch(/input: \{[^}]*letterSpacing: 0/s)
  })
})
