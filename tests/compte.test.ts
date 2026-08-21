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

  it('tout ce que Mon compte ouvre est dans sa pile de navigation', () => {
    // Anomalie du 21 août 2026 : Magasins, Mon équipe et Boîte à outils
    // vivaient dans le groupe `(supervisor)` alors qu'on les ouvre depuis
    // `(compte)`. Traverser deux groupes fait repartir la pile de zéro, et
    // **la flèche de retour disparaît**. Ce qu'un écran ouvre doit être dans
    // sa pile.
    for (const ecran of ['stores', 'team', 'tools', 'new-member']) {
      expect(existsSync(src(`app/(compte)/${ecran}.tsx`))).toBe(true)
      expect(existsSync(src(`app/(supervisor)/${ecran}.tsx`))).toBe(false)
    }
    // Et aucun lien ne doit ressortir du groupe.
    for (const ecran of ['account', 'stores', 'team', 'tools', 'new-member']) {
      expect(lire(`app/(compte)/${ecran}.tsx`)).not.toContain('/(supervisor)/')
    }
  })

  it('les écrans de travail portent la garde de rôle que le groupe portait', () => {
    for (const ecran of ['stores', 'team', 'tools', 'new-member']) {
      expect(lire(`app/(compte)/${ecran}.tsx`)).toContain("profile?.role !== 'supervisor'")
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

  it('le bouton retour dit « Retour », pas le titre de l’écran précédent', () => {
    // iOS reprend par défaut le titre précédent — « Mon compte », « Session »…
    // Un seul mot, toujours le même, se lit plus vite et ne se fait pas
    // tronquer par iOS quand la place manque.
    for (const groupe of ['(compte)', '(supervisor)', '(employee)']) {
      expect(lire(`app/${groupe}/_layout.tsx`)).toContain("headerBackTitle: 'Retour'")
    }
  })

  it('Mon compte porte son propre retour, la pile racine n’en fournissant pas', () => {
    // « Mon compte » est le premier écran de sa pile : la flèche native ne
    // s'affiche pas, alors qu'on arrive bien de Sessions ou de l'accueil.
    const layout = lire('app/(compte)/_layout.tsx')
    expect(layout).toContain('headerLeft')
    expect(layout).toContain('router.canGoBack()')
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
    const magasins = lire('app/(compte)/stores.tsx')
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

describe('administrateur d’entreprise — ne pas le renvoyer à lui-même', () => {
  // Julien, 21 août 2026 : « qu'en est-il de l'admin d'une entreprise ? tu te
  // contredis ». L'administrateur d'entreprise est lui-même un superviseur
  // (`role = 'supervisor'` + le drapeau), et `ca_set_supervisor_stores`
  // accepte n'importe quel superviseur de l'entreprise : il peut donc
  // s'affecter un magasin. Lui dire de s'adresser à « l'administrateur de
  // votre entreprise » le renvoyait à lui-même.
  it('les écrans vides distinguent l’administrateur du superviseur ordinaire', () => {
    for (const ecran of ['stores', 'team']) {
      expect(lire(`app/(compte)/${ecran}.tsx`)).toContain('profile?.is_company_admin')
    }
  })

  it('un échec de chargement ne s’affiche pas comme une liste vide', () => {
    // Sinon une coupure de réseau annonce « Aucun magasin » à quelqu'un qui en
    // a, et l'envoie réclamer un accès pour rien.
    for (const ecran of ['stores', 'team']) {
      expect(lire(`app/(compte)/${ecran}.tsx`)).toContain('isError')
    }
  })
})

describe('balise hors plage — proposer l’ajout plutôt qu’un « OK » sec', () => {
  // Relevé par Julien en test, 21 août 2026 : scanner une balise absente des
  // plages affichait « Balise / Balise non définie » avec un seul bouton. Le
  // compteur restait devant une étiquette bien réelle, sans moyen d'avancer.
  const scanner = readFileSync(path.join(here, '..', 'src', 'components', 'scanner.tsx'), 'utf8')

  it('l’alerte propose d’ajouter la balise', () => {
    expect(scanner).toContain('Balise hors plage')
    expect(scanner).toMatch(/text: 'Ajouter'/)
  })

  it('l’ajout repasse par la base avec la création autorisée', () => {
    // `set_balise(..., p_allow_create := true)` crée la zone et l'ouvre ;
    // sans ce second passage, le bouton ne ferait rien.
    expect(scanner).toMatch(/openBaliseCode\(code, false, true\)/)
  })

  it('la création n’est jamais tentée au premier passage', () => {
    // Sinon toute balise mal saisie créerait une zone en silence.
    expect(scanner).toMatch(/allowCreate = false/)
    expect(scanner).toMatch(/!allowCreate && \/non/)
  })
})

describe('accueil superviseur — mes inventaires et les invités', () => {
  // Même découpage que le site (21 août 2026) : un inventaire auquel on est
  // invité ne se rouvre pas et ne se supprime pas, la mise en page le dit.
  // L'écran affichait en plus les inventaires en cours deux fois — une fois
  // dans un bloc « En cours », une fois dans la liste — alors que le statut
  // est déjà sur chaque tuile.
  const accueil = lire('app/(supervisor)/index.tsx')

  it('sépare ce qu’on a créé de ce à quoi on est invité', () => {
    expect(accueil).toContain('Mes inventaires')
    expect(accueil).toContain('Inventaires invités')
    expect(accueil).toContain('s.created_by === profile?.id')
  })

  it('les clôturés passent après les inventaires en cours', () => {
    expect(accueil).toMatch(/rang = \(s: Session\) => \(s\.status === 'closed' \? 1 : 0\)/)
  })

  it('le bloc « En cours » en double a disparu', () => {
    expect(accueil).not.toContain('liveCard')
    expect(accueil).not.toContain('Inventaire en cours')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Fiche d'un inventaire — harmonisation du 21 août 2026
//
// Julien, capture à l'appui : « est-ce qu'on peut harmoniser la taille des
// différents textes ? Et bouger set up au-dessus de membres ». En lisant
// l'écran, deux défauts plus lourds sont apparus : quatre géométries de
// boutons pour le même genre de travail, et surtout « Créateur » (une
// étiquette) dessiné comme « Retirer » (une suppression).

describe('fiche d’un inventaire', () => {
  const ecran = lire('app/(supervisor)/[sessionId]/index.tsx')

  it('reprend le motif de menu de la bibliothèque', () => {
    // Il était redessiné à la main ici — carte, lignes, filet, chevron, titre
    // de section — alors que MenuList existe et sert « Mon compte » et
    // « Mon équipe ». Deux définitions, c'est deux choses à faire évoluer
    // ensemble ; personne ne s'en souvient.
    expect(ecran).toContain("from '@/components/ui/MenuList'")
    expect(ecran).toContain('<MenuCard>')
    expect(ecran).toContain('<MenuRow')
    expect(ecran).toContain('<SectionLabel>')
    expect(ecran).not.toContain('function ActionRow')
    expect(ecran).not.toContain('menuCard:')
    expect(ecran).not.toContain('function ChevronIcon')
  })

  it('n’emploie que les cinq tailles de son échelle', () => {
    // Sept tailles avant — 10, 11, 13, 14, 15, 17, 18 — dont plusieurs une
    // seule fois, et un titre de feuille (17) plus petit que le code qu'elle
    // affiche (18). Les tailles passent par `Texte`, jamais en clair.
    expect(ecran).toContain('const Texte = {')
    const styles = ecran.split('function makeStyles(')[1] ?? ''
    const enClair = [...styles.matchAll(/fontSize: (\d+)/g)].map(m => Number(m[1]))
    // 56 est le grand nombre de la progression : un chiffre d'affichage.
    expect(enClair.filter(n => n !== 56)).toEqual([])
  })

  it('distingue l’étiquette de l’action', () => {
    // « Créateur » dit un état, « Retirer » supprime quelqu'un. Les deux
    // étaient des pastilles colorées de même taille.
    const tag = ecran.split('memberTag: {')[1]?.split('},')[0] ?? ''
    expect(tag, 'l’étiquette ne doit plus porter la couleur d’accent').not.toContain('t.accent')
    const retirer = ecran.split('removeBtn: {')[1]?.split('},')[0] ?? ''
    expect(retirer, 'l’action ne doit plus être une pastille pleine').not.toContain('backgroundColor')
  })

  it('n’a plus qu’une hauteur de bouton pleine largeur', () => {
    expect(ecran).toContain('const BTN_H = 48')
    for (const bouton of ['countBtn', 'auditBtn', 'shareBtn', 'inviteBtn']) {
      const corps = ecran.split(`${bouton}: {`)[1]?.split('},')[0] ?? ''
      expect(corps, `${bouton} doit suivre la hauteur commune`).toContain('height: BTN_H')
    }
  })

  it('range la configuration avant les membres', () => {
    // On prépare un inventaire avant d'y mettre des gens — et c'est l'ordre
    // du site, où Set up précède Équipe.
    const feuille = ecran.split('function InfoPanel(')[1] ?? ''
    expect(feuille.indexOf('SectionLabel>Configuration'))
      .toBeLessThan(feuille.indexOf('SectionLabel>Membres'))
  })
})
