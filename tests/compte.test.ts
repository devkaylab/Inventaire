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

  it('un échec de connexion éteint le sablier et sort de la fonction', () => {
    // L'alerte modale a laissé place à un message sous le formulaire
    // (23 août 2026) ; l'invariant gardé reste le même, et gagne le
    // `setLoading(false)` que l'ancienne version ne vérifiait pas.
    expect(login).toMatch(/setLoading\(false\)\s*\n\s*setErreur\(error\)\s*\n\s*return/)
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

// ─────────────────────────────────────────────────────────────────────────────
// Supprimer un inventaire, retirer un membre — depuis l'app (22 août 2026)
//
// « Dans la même logique que le site, rends possible la suppression
// d'inventaire ou de membres d'équipe sur l'app. » L'app savait déjà supprimer
// un inventaire depuis l'inventaire lui-même, et annuler une invitation ; elle
// ne savait ni supprimer depuis la liste, ni retirer un compteur.

describe('supprimer et retirer depuis l’app', () => {
  const liste = lire('app/(supervisor)/index.tsx')
  const equipe = lire('app/(compte)/team.tsx')
  const requetes = lire('lib/queries.ts')

  it('la corbeille n’apparaît que sur ce qu’on peut supprimer', () => {
    // Même règle que la base (`delete_session`) et que le site : le créateur,
    // et l'administrateur d'entreprise pour tous les siens. Afficher partout
    // ferait découvrir le refus après coup.
    expect(liste).toContain('peutSupprimer')
    expect(liste).toContain('is_company_admin')
    expect(liste).toContain('onDelete={peutSupprimer(item.session)')
  })

  it('la confirmation nomme l’inventaire et signale s’il est en cours', () => {
    // Sur un téléphone, une corbeille se touche vite.
    expect(liste).toContain('Supprimer « ${nom} » ?')
    expect(liste).toContain('n’est pas clôturé')
    expect(liste).toContain("style: 'destructive'")
  })

  it('retirer un compteur vise UN magasin, pas tous', () => {
    // Une même personne peut compter dans plusieurs magasins, supervisés par
    // des personnes différentes.
    expect(requetes).toContain("rpc('remove_counter_from_store'")
    expect(requetes).toContain('p_store_id: storeId')
    expect(equipe).toContain('removeCounterFromStore(counter.id, store.id)')
    expect(equipe).toContain('store.name')
  })

  it('n’utilise aucun caractère en guise d’icône', () => {
    // Règle du projet : des tracés, jamais un caractère ni un emoji. Le
    // commentaire du composant cite le caractère pour expliquer le pourquoi :
    // on ne regarde donc que le code.
    const codeSeul = equipe
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
      .join('\n')
    expect(codeSeul).not.toContain('\u2715')
    expect(liste).toContain('CorbeilleIcon')
    expect(equipe).toContain('CroixIcon')
  })
})

describe('sélection multiple sur l’app', () => {
  const liste = lire('app/(supervisor)/index.tsx')

  it('ne coche que ce qu’on peut supprimer', () => {
    // Sur le site, la case n'apparaît que là où la suppression est permise.
    expect(liste).toContain('selectionnables')
    expect(liste).toContain('onToggle={peutSupprimer(item.session)')
  })

  it('« Tout sélectionner » ne porte que sur ce qui est sélectionnable', () => {
    expect(liste).toContain('setCoches(toutCoche ? [] : selectionnables)')
  })

  it('la confirmation nomme les inventaires, huit au plus', () => {
    // Au-delà, la boîte de dialogue devient illisible sur un téléphone.
    expect(liste).toContain('noms.slice(0, 8)')
    expect(liste).toContain('et ${noms.length - 8} autre')
    expect(liste).toContain('clôturé')
  })

  it('supprime un par un et rapporte les échecs', () => {
    // Il n'existe pas de RPC de suppression groupée : sur dix inventaires, un
    // refus ne doit pas passer inaperçu derrière un succès global.
    expect(liste).toContain('const echecs: string[] = []')
    expect(liste).toContain('Suppression partielle')
    expect(liste).not.toContain('delete_sessions')
  })

  it('reste atteignable sans deviner l’appui long', () => {
    expect(liste).toContain('Sélectionner')
    expect(liste).toContain('onLongPress')
  })

  it('un appui long ne bascule qu’une fois', () => {
    // Anomalie de Julien, 22 août 2026 : « la tuile est sélectionnée puis elle
    // se désélectionne ». L'appui long cochait et faisait passer en mode
    // sélection ; au relâchement `onPress` partait et, l'écran étant désormais
    // en sélection, décochait. Deux bascules pour un geste.
    expect(liste).toContain('const appuiLong = useRef(false)')
    expect(liste).toContain('if (appuiLong.current) { appuiLong.current = false; return }')
    // Remis à faux à chaque appui : si la plateforme n'envoie pas `onPress`
    // après un appui long, le drapeau ne mange pas le geste suivant.
    expect(liste).toContain('onPressIn={() => { appuiLong.current = false }}')
  })
})

describe('les totaux de l’app viennent du serveur', () => {
  // Vérification demandée le 22 août 2026. Les deux écrans additionnaient des
  // lignes téléchargées sur le téléphone.
  const superviseur = lire('app/(supervisor)/[sessionId]/index.tsx')
  const compteur = lire('app/(employee)/[sessionId]/index.tsx')
  const requetes = lire('lib/queries.ts')

  it('ne rapatrie plus tous les comptages pour additionner deux nombres', () => {
    // Même règle que le site : ne jamais remettre un `select` sur `counts`
    // pour en tirer un total. Le volume est celui de l'inventaire entier, et
    // un plafond de lignes côté API raboterait le total en silence.
    expect(requetes).not.toContain('getSessionCounts')
    expect(superviseur).toContain('getSessionCountTotals')
    expect(superviseur).not.toMatch(/for \(const c of counts/)
  })

  it('l’écran du compteur ne compte que ses propres pièces', () => {
    // `getMyCounts` ne filtrait pas sur l'utilisateur : c'est la policy qui
    // limitait un compteur à ses lignes, mais un superviseur aurait vu toute
    // l'équipe, présentée comme son travail à lui.
    expect(compteur).toContain('getMyCountTotals')
    expect(compteur).not.toContain('getMyCounts(sessionId, 1)')
  })

  it('la fonction ne compte que l’appelant, et refuse anon', () => {
    const migration = lire('../supabase/migrations/20260822110001_totaux_du_compteur.sql')
    expect(migration).toContain('c.counted_by = auth.uid()')
    expect(migration).toContain('if auth.uid() is null then')
    expect(migration).toMatch(/revoke all on function public\.get_my_count_totals\(uuid\) from public, anon/)
  })
})

describe('le balayage pour supprimer', () => {
  const liste = lire('app/(supervisor)/index.tsx')
  const racine = lire('app/_layout.tsx')

  it('a sa racine de gestes, sinon rien ne se passerait', () => {
    // Elle doit envelopper toute l'application, pas seulement l'écran.
    expect(racine).toContain('GestureHandlerRootView')
  })

  it('n’apparaît que s’il y a quelque chose à y faire, et pas pendant une sélection', () => {
    // Le geste entrerait en concurrence avec le défilement d'une liste qu'on
    // est en train de cocher.
    expect(liste).toContain('if ((!onDelete && !onClose) || selection) return carte')
  })

  it('n’agit pas tout seul', () => {
    // Chaque volet ouvre la même confirmation nommée que son équivalent au
    // clavier : un inventaire emporte comptages, audits et référentiel.
    expect(liste).toContain('balayage.current?.close(); onDelete()')
    expect(liste).toContain('balayage.current?.close(); onClose()')
    expect(liste).toContain('renderRightActions')
  })

  it('propose la clôture, à qui participe et sur ce qui n’est pas clôturé', () => {
    // Clôturer n'est pas réservé au créateur — c'est un geste de terrain que
    // tout superviseur participant peut faire, et que le créateur peut
    // défaire. La suppression, elle, reste au créateur.
    expect(liste).toContain("onClose={item.session.status !== 'closed'")
    expect(liste).toContain('confirmerCloture')
    expect(liste).toContain('closeSession(s.id)')
    // Le geste destructeur est le plus loin du doigt.
    expect(liste.indexOf('balayageCloturer')).toBeLessThan(liste.indexOf('balayageSupprimer'))
  })

  it('se referme dès qu’on touche ailleurs', () => {
    // Demande de Julien, 22 août 2026. Un rang laissé ouvert dans le dos de la
    // personne fait tomber son prochain appui sur un bouton rouge qu'elle ne
    // regardait plus.
    expect(liste).toContain('onStartShouldSetResponderCapture={auContact}')
    // Sans prendre le geste : on renvoie `false`, l'élément touché reçoit
    // quand même l'appui.
    expect(liste).toMatch(/const auContact[\s\S]*?return false/)
    // Mais pas sous le doigt de quelqu'un qui vise « Supprimer » : on compare
    // le point touché au rectangle du volet ouvert.
    expect(liste).toContain('measureInWindow')
    expect(liste).toContain('const dedans =')
    // Faire défiler referme aussi.
    expect(liste).toContain('onScrollBeginDrag={fermerVolet}')
  })

  it('n’oublie pas le volet qui vient de s’ouvrir', () => {
    // Ouvrir un rang referme le précédent ; si la fermeture effaçait
    // l'enregistrement sans vérifier de qui il s'agit, le nouveau restait
    // ouvert sans que personne ne le sache.
    expect(liste).toContain('voletOuvert.current.methods === methods')
  })

  it('n’ajoute aucune dépendance native', () => {
    // `react-native-gesture-handler` est déjà installé — une nouvelle
    // dépendance native imposerait un `pod install`, qui écrase le correctif
    // du chemin avec espace.
    const pkg = lire('../package.json')
    expect(pkg).toContain('react-native-gesture-handler')
    expect(liste).toContain("from 'react-native-gesture-handler/ReanimatedSwipeable'")
  })
})

describe('connexion — le message est en français, et la sortie existe', () => {
  // Impasse relevée le 23 août 2026 : l'app affichait `error.message` de
  // Supabase tel quel — « Invalid login credentials » — à un compteur
  // saisonnier, et n'offrait aucun « mot de passe oublié ».
  const login = lire('app/login.tsx')
  const auth = lire('lib/auth.tsx')
  const errors = lire('lib/errors.ts')

  it('signIn traduit avant de rendre l’erreur', () => {
    // On borne à signIn : signUp voisine dans le fichier et rend encore le
    // message brut (il n'est plus appelé — plus d'auto-inscription).
    const debut = auth.indexOf('async function signIn')
    const corps = auth.slice(debut, auth.indexOf('async function signUp', debut))
    expect(debut).toBeGreaterThan(-1)
    expect(corps).toContain('friendlySignInError(error)')
    expect(corps).not.toContain('error?.message')
  })

  it('le réseau se distingue des identifiants', () => {
    expect(errors).toContain('AuthRetryableFetchError')
    expect(errors).toContain('Impossible de joindre le serveur')
  })

  it('un compte inconnu ne se distingue pas d’un mot de passe faux', () => {
    // Constat M3 : deux textes distincts rouvriraient l'oracle
    // d'énumération d'adresses. Le repli couvre les deux cas.
    // On ne regarde que le code : le commentaire, lui, a le droit d'énoncer
    // la règle qu'il explique.
    const code = errors.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/n.existe pas|compte inconnu|utilisateur introuvable/i)
    expect(code).toContain('Adresse e-mail ou mot de passe incorrect.')
  })

  it('l’écran offre une sortie à qui a oublié son mot de passe', () => {
    expect(login).toContain('PASSWORD_FORGOT_URL')
    expect(login).toContain('Mot de passe oublié ?')
  })

  it('l’erreur se lit sous le formulaire, pas dans une alerte', () => {
    expect(login).not.toContain("Alert.alert('Connexion échouée'")
    expect(login).toContain('styles.erreurBox')
  })
})

describe('les six impasses du premier lancement (23 août 2026)', () => {
  const auth = lire('lib/auth.tsx')
  const push = lire('lib/push.ts')
  const scanner = lire('components/scanner.tsx')
  const son = lire('lib/scanSound.ts')
  const accueilSup = lire('app/(supervisor)/index.tsx')

  it('les notifications ne se demandent plus à la connexion', () => {
    // Elles s'ouvraient juste après le mot de passe, avant le moindre écran.
    expect(auth).not.toContain('registerForPushNotifications')
    expect(lire('app/(employee)/[sessionId]/index.tsx')).toContain('useNotificationsSurInventaire()')
    expect(lire('app/(supervisor)/[sessionId]/index.tsx')).toContain('useNotificationsSurInventaire()')
  })

  it('toucher la notification ouvre l’inventaire', () => {
    expect(push).toContain('useLastNotificationResponse')
    expect(lire('app/_layout.tsx')).toContain('useNotificationRouting')
  })

  it('une permission refusée définitivement n’est pas redemandée', () => {
    // Sur iOS la boîte ne revient jamais : redemander est inerte et laisse
    // la personne devant un bouton mort.
    expect(push).toContain('canAskAgain')
    expect(scanner).toMatch(/status === 'undetermined' && permission\.canAskAgain/)
  })

  it('un refus de caméra mène aux Réglages et garde un repli clavier', () => {
    expect(scanner).toContain('Linking.openSettings()')
    expect(scanner).toContain('AppState.addEventListener')
    expect(scanner).toContain('Passer en saisie manuelle')
  })

  it('le bip s’entend même en silencieux, sans couper la musique', () => {
    expect(son).toContain('playsInSilentMode: true')
    expect(son).toContain("interruptionMode: 'mixWithOthers'")
  })

  it('le superviseur sans magasin l’apprend sur son accueil', () => {
    expect(accueilSup).toContain('getMyAssignedStores')
    expect(accueilSup).toContain('sansMagasin')
    // Un échec de chargement n'est pas une liste vide.
    expect(accueilSup).toContain('magasinsEnErreur')
  })

  it('le texte iOS de la caméra parle des balises, en app.json ET en natif', () => {
    const appJson = readFileSync(path.join(here, '..', 'app.json'), 'utf8')
    const plist = readFileSync(path.join(here, '..', 'ios', 'Inventaire', 'Info.plist'), 'utf8')
    // C'est le plist qui part dans un build Xcode : l'oublier ne changerait
    // rien à ce que voit la personne.
    expect(appJson).toContain('balises de zone')
    expect(plist).toContain('balises de zone')
  })
})

describe('un superviseur a une entreprise et au moins un magasin (23 août 2026)', () => {
  // Règle posée par Julien. Elle n'était pas garantie : trois chemins
  // laissaient un superviseur sans magasin — donc quelqu'un qui se connecte,
  // ne voit rien et ne peut rien créer.
  const migration = readFileSync(
    path.join(here, '..', 'supabase', 'migrations', '20260823100001_superviseur_au_moins_un_magasin.sql'),
    'utf8',
  )

  it('les trois portes refusent un superviseur sans magasin', () => {
    expect(migration).toContain('ca_invite_supervisor')
    expect(migration).toContain('ca_set_supervisor_stores')
    expect(migration).toContain('admin_unassign_supervisor')
    // Deux gardes sur liste vide, une sur le dernier magasin.
    expect(migration.match(/array_length\(v_ids, 1\), 0\) = 0/g)?.length).toBe(2)
    expect(migration).toContain('v_restants = 0')
  })

  it('l’administrateur d’entreprise reste hors de la règle', () => {
    // Il supervise tous les magasins par construction : le lui refuser
    // n'aurait pas de sens, et les deux fonctions le disaient déjà.
    expect(migration).toContain('est affecté à tous les magasins')
  })

  it('le mode balises est le défaut, et reste un choix', () => {
    const nouvelInventaire = lire('app/(supervisor)/new-session.tsx')
    expect(nouvelInventaire).toContain('useState(true)')
    // L'interrupteur existe toujours : c'est le choix du superviseur.
    expect(nouvelInventaire).toContain('setUsesZones')
    // Plus de défaut trompeur dans la signature — le site l'exige déjà.
    expect(lire('lib/queries.ts')).toContain('usesZones: boolean)')
  })
})

describe('onboarding (23 août 2026)', () => {
  const reperes = lire('lib/reperes.ts')
  const porte = lire('components/PorteBienvenue.tsx')
  const demarrer = lire('components/PourDemarrer.tsx')
  const scanner = lire('components/scanner.tsx')

  it('aucun drapeau global : une clé par repère, portant le compte', () => {
    // La règle du projet interdit de recréer firstRun.ts. Chaque repère a sa
    // clé ; aucun n'en réveille un autre.
    expect(existsSync(src('lib/firstRun.ts'))).toBe(false)
    expect(reperes).toMatch(/repere\.\$\{repere\}\.\$\{userId\}/)
    expect(reperes).toContain("'bienvenue'")
    expect(reperes).toContain("'premiere-balise'")
  })

  it('la bienvenue attend d’avoir lu le stockage avant de s’afficher', () => {
    // Sans ce garde, l'écran clignoterait à chaque lancement.
    expect(reperes).toContain('return { aVoir: pret && aVoir, pret, marquerVu }')
  })

  it('la bienvenue ne s’affiche pas à moitié authentifié', () => {
    expect(porte).toContain('mfaRequired')
  })

  it('la checklist se coche sur des faits, jamais à la main', () => {
    expect(demarrer).toContain('faite: opts.inventaireExiste')
    expect(demarrer).toContain('faite: p.zones > 0')
    expect(demarrer).toContain('faite: p.articles > 0')
    expect(demarrer).toContain('faite: p.membres > 0')
    // Imprimer une planche ne laisse rien en base : pas d'étape à part.
    expect(demarrer).not.toMatch(/titre: 'Imprimer vos balises'/)
  })

  it('créer un inventaire vient avant les zones et l’import', () => {
    // Les plages s'affectent DANS un inventaire, et le référentiel y est
    // rattaché (theoretical_stock.session_id).
    const i = demarrer.indexOf("cle: 'inventaire'")
    const z = demarrer.indexOf("cle: 'zones'")
    const f = demarrer.indexOf("cle: 'fichiers'")
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeLessThan(z)
    expect(z).toBeLessThan(f)
  })

  it('l’étape « membres » dit que l’équipe du magasin ne suffit pas', () => {
    expect(demarrer).toContain('Être dans l’équipe du magasin ne suffit pas')
  })

  it('la caméra est amorcée avant la boîte système', () => {
    expect(scanner).toContain('amorceNecessaire')
    expect(scanner).toContain('La caméra lit les balises et les codes-barres')
    // Le bouton n'est pas « Autoriser » : il précède la demande.
    expect(scanner).toContain('Continuer</Text>')
  })

  it('les repères restent retrouvables', () => {
    expect(lire('app/(compte)/account.tsx')).toContain('Revoir les repères')
    expect(reperes).toContain('oublierReperes')
  })
})

describe('le guide « Pour démarrer » ne s’adresse qu’à qui démarre', () => {
  // Constaté sur l'iPhone de Julien, 23 août 2026 : le guide s'affichait à un
  // administrateur qui n'avait créé aucun inventaire, en analysant celui d'un
  // AUTRE — d'où un « 1 membre » coché venu de nulle part.
  const accueil = lire('app/(supervisor)/index.tsx')
  const bienvenue = lire('components/Bienvenue.tsx')

  it('il ne regarde que les inventaires qu’on a créés', () => {
    expect(accueil).toContain('s.created_by === profile?.id')
    expect(accueil).toContain('mesInventaires.find')
    // Le motif fautif : le premier non clôturé de TOUTE la liste.
    expect(accueil).not.toMatch(/\(sessions \?\? \[\]\)\.find\(s => s\.status !== 'closed'\)/)
  })

  it('il ne s’affiche pas à quelqu’un qui connaît déjà le produit', () => {
    expect(accueil).toContain('mesInventaires.length <= 1')
  })

  it('« Masquer » est définitif, pas le temps d’une session', () => {
    expect(accueil).toContain("useRepere('guide-demarrage'")
    expect(accueil).toContain('onMasquer={masquerGuide}')
  })

  it('la bienvenue couvre l’écran au lieu de le partager', () => {
    // Avec flex: 1 elle devenait un frère du Stack : les deux se partageaient
    // la hauteur et elle s'affichait SOUS l'accueil.
    expect(bienvenue).toContain("position: 'absolute'")
    expect(bienvenue).toContain('zIndex: 50')
    expect(bienvenue).not.toMatch(/safe: \{ flex: 1,/)
  })
})

describe('audit du 23 août : ce que le typage et les tests ne voyaient pas', () => {
  const porte = lire('components/PorteBienvenue.tsx')
  const bienvenue = lire('components/Bienvenue.tsx')
  const inventaireCompteur = lire('app/(employee)/[sessionId]/index.tsx')
  const scanner = lire('components/scanner.tsx')

  it('le bouton de la bienvenue mène quelque part', () => {
    // Il se contentait de refermer la porte : « Préparer mon premier
    // inventaire » retombait sur la liste, sans rien préparer.
    expect(porte).toContain("router.push('/(supervisor)/new-session')")
    expect(porte).toContain('onCommencer={() => { marquerVu(); aller() }}')
  })

  it('le libellé ne promet pas un premier inventaire à qui en a déjà', () => {
    expect(porte).toContain('miennes.length === 0')
    expect(porte).toContain('Voir mes inventaires')
    // Le libellé vient de l'appelant, pas d'une constante par rôle.
    expect(bienvenue).toContain('<Text style={styles.btnText}>{action}</Text>')
  })

  it('la bienvenue attend ses données avant de s’afficher', () => {
    // Sinon : « Vous supervisez un magasin. » puis le vrai nom, et un bouton
    // qui change de libellé sous le doigt.
    expect(porte).toContain('isPending')
  })

  it('les explications Compter / Auditer finissent par disparaître', () => {
    // `marquerVu` était laissé de côté : elles restaient pour toujours.
    expect(inventaireCompteur).toContain('marquerVu: expliqueVu')
    expect(inventaireCompteur).toContain('expliqueVu();')
  })

  it('la célébration compte les vraies pièces, pas celles d’un ancien rendu', () => {
    // closeBalise est atteint depuis un callback mémoïsé sur [barcodeReady] :
    // lire recentScans directement y donnerait 0.
    expect(scanner).toContain('recentScansRef')
    expect(scanner).toContain('const scans = recentScansRef.current')
  })
})

describe('création d’inventaire : le magasin ne bloque plus (23 août 2026)', () => {
  // Trouvé en pilotant le simulateur : « Créer l'inventaire » répondait
  // « Choisissez un magasin » alors que le magasin s'affichait à l'écran. La
  // liste ne présélectionnait rien, et un superviseur a désormais toujours au
  // moins un magasin — le cas était donc la règle, sur la PREMIÈRE étape de
  // son onboarding.
  const ecran = lire('app/(supervisor)/new-session.tsx')

  it('un magasin unique est choisi tout seul', () => {
    expect(ecran).toContain('stores?.length === 1) setStoreId(stores[0].id)')
  })

  it('l’alerte a disparu au profit du libellé', () => {
    expect(ecran).not.toContain("Alert.alert('Erreur', 'Choisissez un magasin.')")
    expect(ecran).toContain("choixAttendu ? 'Choisissez un magasin' : 'Magasin'")
  })

  it('le bouton reste inactif tant que le choix n’est pas fait', () => {
    expect(ecran).toContain('choixAttendu = !storeId && (stores?.length ?? 0) > 1')
    expect(ecran).toContain('disabled={loading || noStores || choixAttendu}')
  })
})
