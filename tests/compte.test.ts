import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

/** Tous les fichiers de `src/`, pour les gardes qui balaient au lieu de citer. */
function fichiersSource(dossier = src('.')): string[] {
  const out: string[] = []
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, e.name)
    if (e.isDirectory()) out.push(...fichiersSource(chemin))
    else if (/\.tsx?$/.test(e.name)) out.push(chemin)
  }
  return out
}

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
    // Depuis le 24 août 2026 la question est une carte de l'app, pas une
    // alerte iOS : le bouton se déclare en `action`, et son libellé compte
    // autant qu'avant — c'est lui qui donne au compteur un moyen d'avancer.
    expect(scanner).toMatch(/action: 'Ajouter'/)
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
    // `ton: 'danger'` a remplacé `style: 'destructive'` le 24 août 2026 :
    // c'est lui qui peint le bouton en rouge dans la carte de confirmation.
    expect(liste).toContain("ton: 'danger'")
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
    // Côté superviseur, la demande reste à l'ouverture d'un inventaire : c'est
    // lui qui invite, être sollicité là ne le surprend pas.
    expect(lire('app/(supervisor)/[sessionId]/index.tsx')).toContain('useNotificationsSurInventaire()')
    // Côté compteur, elle a encore reculé d'un cran — voir le bloc suivant.
    expect(lire('app/(employee)/[sessionId]/index.tsx')).not.toContain('useNotificationsSurInventaire()')
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
  const bandeau = lire('components/BandeauDemarrage.tsx')
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
    // Sans ce garde, l'écran clignoterait à chaque lancement. `pret` veut dire
    // « lu, et pour CE compte » : l'état porte l'identifiant qu'il décrit.
    expect(reperes).toContain('const pret = !!userId && etat.uid === userId && etat.lu')
    expect(reperes).toContain('return { aVoir: pret && !etat.vu, pret, marquerVu }')
  })

  it('la bienvenue ne s’affiche pas à moitié authentifié', () => {
    expect(porte).toContain('mfaRequired')
  })

  it('la barre d’état passe en sombre pendant la porte de bienvenue', () => {
    // ⚠️ La porte n'est pas une route : `BarreEtat` décide à partir du segment,
    // elle ne pouvait donc pas la voir, et l'heure sortait en blanc sur son
    // fond clair (capture du 2 septembre 2026). Le signal de `lib/porte.ts`
    // est le seul lien entre les deux — et un `<StatusBar>` posé par la porte
    // ne le remplace pas : expo-status-bar ne restaure rien au démontage.
    const layout = lire('app/_layout.tsx')
    expect(existsSync(src('lib/porte.ts'))).toBe(true)
    expect(porte).toContain('poserPorteVisible(montrer)')
    expect(porte).toContain('poserPorteVisible(false)')
    expect(layout).toContain('const porte = usePorteVisible()')
    expect(layout).toContain('const surFond = porte ||')
    expect(porte).not.toContain('<StatusBar')
  })

  it('les étapes se cochent sur des faits, jamais à la main', () => {
    expect(bandeau).toContain('faite: faits.balisesImprimees')
    expect(bandeau).toContain('faite: faits.equipeConstituee')
    expect(bandeau).toContain('faite: faits.inventaireCree')
    // Aucune étape ne se coche au clic : le bandeau n'a qu'une action, elle
    // ouvre l'écran où le travail se fait.
    expect(bandeau).not.toMatch(/setFaite|marquerEtape/)
  })

  it('les balises viennent d’abord, l’inventaire en dernier', () => {
    const b = bandeau.indexOf("cle: 'balises'")
    const e = bandeau.indexOf("cle: 'equipe'")
    const i = bandeau.indexOf("cle: 'inventaire'")
    expect(b).toBeGreaterThan(-1)
    expect(b).toBeLessThan(e)
    expect(e).toBeLessThan(i)
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

  it('« Revoir les repères » se voit tout de suite', () => {
    // Le bouton vit dans « Mon compte » ; les écrans qui affichent les repères
    // sont ailleurs et n'ont lu le stockage qu'à leur montage. Sans cet
    // avertissement, ils gardaient leur état jusqu'au prochain lancement — on
    // appuyait, rien ne se passait.
    expect(reperes).toContain('const abonnes = new Set<() => void>()')
    expect(reperes).toContain('useEffect(() => sAbonner(relire), [relire])')
    // ⚠️ Prévenir APRÈS l'écriture : les écrans relisent le stockage.
    const oubli = reperes.slice(reperes.indexOf('export async function oublierReperes'))
    const efface = oubli.indexOf('multiRemove')
    const avertit = oubli.indexOf('prevenir()')
    expect(efface).toBeGreaterThan(-1)
    expect(avertit).toBeGreaterThan(efface)
  })
})

/**
 * Le bandeau de démarrage (23 août 2026) — une seule étape à la fois, 76 px,
 * et le démarrage du superviseur pour objet : générer ses balises, constituer
 * son équipe, créer son premier inventaire.
 */
/**
 * Inviter un compteur, et le voir (23 août 2026). Constat de Julien : après
 * l'envoi de l'invitation, « Mon équipe » restait vide — de quoi recommencer.
 */
describe('une personne invitée apparaît tout de suite', () => {
  const equipe = lire('app/(compte)/team.tsx')
  const ajout = lire('app/(compte)/new-member.tsx')

  it('l’ajout recharge la liste de « Mon équipe »', () => {
    // `['team-invitations']` était la clé d'une requête supprimée le 21 août
    // avec l'ancien écran de profil : plus rien ne l'écoutait.
    expect(ajout).toContain("queryKey: ['my-team']")
    expect(ajout).not.toContain("queryKey: ['team-invitations']")
  })

  it('« pas encore connecté » ne se dit pas « accès retiré »', () => {
    // `is_active` veut dire « s'est déjà connecté ». Une personne retirée n'a
    // plus de ligne du tout. Même libellé que le site.
    expect(equipe).toContain('Mot de passe à créer')
    // Il n'en reste que la trace dans le commentaire qui dit pourquoi.
    expect(equipe).not.toContain('>Accès retiré<')
    expect(equipe).not.toContain('offBadge')
    expect(lire('../web/app/equipe/page.tsx')).toContain('Mot de passe à créer')
  })

  it('la ligne montre l’adresse tant que la personne n’a pas ouvert l’app', () => {
    // C'est là qu'est parti le lien : c'est ce qu'on veut relire.
    expect(equipe).toContain("? counter.email ?? 'Invitation envoyée'")
  })
})

describe('le bandeau de démarrage', () => {
  const bandeau = lire('components/BandeauDemarrage.tsx')
  const accueil = lire('app/(supervisor)/index.tsx')
  const reperes = lire('lib/reperes.ts')
  const createur = lire('components/BaliseCreator.tsx')

  it('l’ancien bloc « Pour démarrer » n’existe plus', () => {
    expect(existsSync(src('components/PourDemarrer.tsx'))).toBe(false)
  })

  it('une seule étape s’affiche : la première non faite', () => {
    expect(bandeau).toContain('return etapes.find(e => !e.faite) ?? null')
    // Pas de liste déroulée : le bandeau ne rend que `courante`.
    expect(bandeau).not.toMatch(/etapes\.map\(/)
  })

  it('il tient sur une rangée d’environ 76 px', () => {
    expect(bandeau).toContain('minHeight: 76')
  })

  it('la carte entière est cliquable, et le chevron le dit', () => {
    expect(bandeau).toContain('onPress={() => onAction(courante.cle)}')
    expect(bandeau).toContain('<ChevronIcon color={theme.accent} />')
  })

  it('la croix masque, et elle est un tracé', () => {
    expect(bandeau).toContain('onPress={onMasquer}')
    expect(bandeau).toContain('<CroixIcon')
    expect(bandeau).not.toContain('✕')
  })

  it('le compteur dit l’étape en cours sur le total', () => {
    expect(bandeau).toContain('{rang} SUR {etapes.length}')
    expect(bandeau).toContain('const rang = etapes.indexOf(courante) + 1')
  })

  it('tout fait, le bandeau s’efface de lui-même', () => {
    expect(bandeau).toContain('if (!courante) return null')
  })

  // ── LE piège de ce chantier ────────────────────────────────────────────
  //
  // Une planche de balises est dessinée sur le téléphone et n'écrit RIEN en
  // base : aucun fait serveur ne dira jamais qu'elle a été produite. Sans le
  // jalon local, l'étape 1 resterait à faire pour toujours — et le bandeau
  // ne dépasserait jamais « 1 sur 3 ».
  it('l’étape des balises se coche sur un jalon local, posé à l’impression', () => {
    expect(reperes).toContain("export type Jalon = 'balises-imprimees'")
    expect(reperes).toMatch(/jalon\.\$\{jalon\}\.\$\{userId\}/)
    expect(createur).toContain("void poserJalon('balises-imprimees', profile.id)")
    // Posé dans onSuccess, jamais à l'ouverture du formulaire.
    const succes = createur.indexOf('onSuccess:')
    const pose = createur.indexOf("poserJalon('balises-imprimees'")
    expect(succes).toBeGreaterThan(-1)
    expect(pose).toBeGreaterThan(succes)
    expect(accueil).toContain("useJalon('balises-imprimees', profile?.id)")
  })

  it('le jalon se relit dès qu’il est posé, pas au seul montage', () => {
    // L'accueil reste monté pendant qu'on imprime depuis la boîte à outils :
    // il s'abonne, comme les repères.
    expect(reperes).toContain('useEffect(() => sAbonner(relire), [relire])')
    expect(createur).toContain('void poserJalon')  // posé depuis BaliseCreator
    // Plus de dépendance à la navigation dans ce module : il n'en reste que
    // la trace dans le commentaire qui explique pourquoi.
    expect(reperes).not.toMatch(/^import .*useFocusEffect/m)
    expect(reperes).not.toContain('useFocusEffect(')
  })

  it('« Revoir les repères » ne défait pas ce qui a été fait', () => {
    // oublierReperes ne touche qu'aux repères : un jalon est un fait.
    const oubli = reperes.slice(reperes.indexOf('export async function oublierReperes'))
    expect(oubli.slice(0, 400)).not.toContain('balises-imprimees')
  })

  it('les trois étapes mènent là où le travail se fait', () => {
    expect(accueil).toContain("router.push('/(compte)/tools')")
    expect(accueil).toContain("router.push('/(compte)/team')")
    expect(accueil).toContain("router.push('/(supervisor)/new-session')")
  })

  it('une invitation en attente suffit à constituer l’équipe', () => {
    // Sinon l'étape resterait à faire juste après avoir invité quelqu'un.
    expect(accueil).toContain("(equipe?.invitations.length ?? 0) > 0")
    // Même RPC que « Mon équipe », pas un décompte à part.
    expect(accueil).toContain('queryFn: getMyTeamByStore')
  })

  it('le bandeau attend d’avoir lu le jalon avant de s’afficher', () => {
    // Sans ce garde, l'étape 1 clignoterait à chaque ouverture chez quelqu'un
    // qui a déjà imprimé ses balises.
    expect(accueil).toContain('guideAVoir && jalonPret')
  })
})

describe('le bandeau de démarrage ne s’adresse qu’à qui démarre', () => {
  // Constaté sur l'iPhone de Julien, 23 août 2026 : le guide s'affichait à un
  // administrateur qui n'avait créé aucun inventaire, en analysant celui d'un
  // AUTRE — d'où un « 1 membre » coché venu de nulle part.
  const accueil = lire('app/(supervisor)/index.tsx')
  const bienvenue = lire('components/Bienvenue.tsx')

  it('il ne regarde que les inventaires qu’on a créés', () => {
    expect(accueil).toContain('s.created_by === profile?.id')
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

  /**
   * Constat de Julien, 28 août 2026 : « il s'affiche à chaque fois qu'il n'y
   * a plus d'inventaire en cours ». Les étapes se cochent sur des faits relus
   * à chaque ouverture — supprimer ses inventaires décochait la troisième et
   * ramenait le bandeau des semaines après le démarrage.
   */
  it('la fin du démarrage se note, sinon le bandeau revient', () => {
    expect(accueil).toContain('const demarrageFini =')
    // Les deux façons d'en avoir fini, et il faut les deux.
    expect(accueil).toContain('!debutant || etapeCourante(etapes) === null')
    // ⚠️ Et depuis le 29 août, les faits qui vivent EN BASE suffisent : le
    // jalon des balises est local au téléphone, il ne doit jamais retenir à
    // lui seul un bandeau d'accueil chez quelqu'un qui a une équipe et un
    // inventaire. « J'en ai assez de voir ce bandeau » — Julien, sur un compte
    // vieux de plusieurs semaines.
    expect(accueil).toContain('demarrageAcquis({')
    const bandeau = lire('components/BandeauDemarrage.tsx')
    expect(bandeau).toContain('return faits.equipeConstituee && faits.inventaireCree')
    expect(accueil).toContain('if (guideAVoir && demarrageFini) masquerGuide()')
  })

  it('elle se note comme un repère, pas comme un jalon', () => {
    // Un jalon ne s'efface pas : « Revoir les repères » ne ramènerait plus
    // jamais le bandeau. La fin du démarrage passe donc par le repère que la
    // croix marque déjà.
    expect(accueil).not.toContain("poserJalon('demarrage")
    expect(lire('lib/reperes.ts')).toContain("export type Jalon = 'balises-imprimees'")
  })

  it('elle ne se note pas à qui n’a rien vu du bandeau', () => {
    // Données non chargées, jalon non lu, aucun magasin : ce sont les gardes
    // de `montrerGuide`, et elles valent aussi pour le marquage.
    expect(accueil).toContain('sessions !== undefined && jalonPret && !sansMagasin')
  })

  it('la bienvenue couvre l’écran au lieu de le partager', () => {
    // Avec flex: 1 elle devenait un frère du Stack : les deux se partageaient
    // la hauteur et elle s'affichait SOUS l'accueil.
    expect(bienvenue).toContain("position: 'absolute'")
    expect(bienvenue).toContain('zIndex: 50')
    expect(bienvenue).not.toMatch(/safe: \{ flex: 1,/)
  })
})

/**
 * L'indice de balayage (28 août 2026).
 *
 * Le geste découvre « Clôturer » et « Supprimer » depuis le 22 août, et rien ne
 * le disait. Le repère `balayage` était même déclaré dans `lib/reperes.ts`
 * depuis le 23 août — et branché sur aucun écran : la seule pièce de
 * l'onboarding qui existait sans interface.
 */
describe('le geste caché, montré une fois', () => {
  const accueil = lire('app/(supervisor)/index.tsx')
  const reperes = lire('lib/reperes.ts')

  it('le repère existe, et il est enfin branché', () => {
    expect(reperes).toContain("| 'balayage'")
    expect(accueil).toContain("useRepere('balayage', profile?.id)")
    // « Revoir les repères » le rejoue : c'est une aide, pas un fait.
    const oubli = reperes.slice(reperes.indexOf('export async function oublierReperes'))
    expect(oubli.slice(0, 400)).toContain("'balayage'")
  })

  it('il ne se joue que sur le premier rang qui porte un volet', () => {
    // Un inventaire invité n'en a aucun : une démonstration sur une carte qui
    // ne bouge pas apprendrait le contraire de ce qu'on veut.
    expect(accueil).toContain("sessionsAffichees.find(s => peutSupprimer(s) || s.status !== 'closed')")
    expect(accueil).toContain('indice={montrerIndice && item.session.id === premierBalayable?.id}')
  })

  it('il attend le deuxième inventaire, et se tait quand une autre aide parle', () => {
    // Avec un seul inventaire, le bandeau de démarrage occupe encore le haut
    // de l'écran — on ne sert pas deux aides à la fois. Et jamais pendant une
    // sélection, où le balayage entre déjà en concurrence avec le défilement.
    expect(accueil).toContain('balayageAVoir && !montrerGuide && !selection')
    expect(accueil).toContain('sessionsAffichees.length >= 2')
  })

  it('la carte s’entrouvre puis se referme d’elle-même', () => {
    expect(accueil).toContain('balayage.current?.openRight()')
    expect(accueil).toContain('balayage.current?.close(); setCoupDoeil(false)')
    // Les minuteries sont nettoyées : un rang démonté n'ouvre rien plus tard.
    expect(accueil).toContain('clearTimeout(ouvrir); clearTimeout(fermer)')
  })

  it('⚠️ les volets sont inertes pendant le coup d’œil', () => {
    // Ils s'ouvrent sans que personne ne les ait demandés : un doigt déjà posé
    // sur l'écran ne doit pas tomber sur « Supprimer ».
    expect(accueil).toContain("pointerEvents={coupDoeil ? 'none' : 'auto'}")
  })

  it('« Compris » marque le repère, et lui seul', () => {
    expect(accueil).toContain('onPress={onIndiceCompris}')
    expect(accueil).toContain('onIndiceCompris={balayageVu}')
    // Pas de fermeture automatique : une aide qu'on n'a pas lue n'a pas été
    // donnée.
    expect(accueil).not.toMatch(/setTimeout\([^)]*balayageVu/)
  })
})

/**
 * Les points restants de la maquette d'onboarding du 23 août, faits le
 * 28 août 2026 : le viseur qui enseigne, l'amorce des notifications, la sortie
 * « je n'ai pas reçu mon invitation », le repère du menu d'un inventaire, et
 * les trois étapes de l'administrateur d'entreprise.
 */
describe('un seul inventaire ne s’ouvre pas tout seul', () => {
  // Tranché par Julien le 28 août 2026, question laissée ouverte par la
  // maquette du 23. La liste reste, même à une ligne : elle nomme l'inventaire
  // et son magasin, et le comportement ne change pas le jour où un deuxième
  // s'ouvre — un matin d'inventaire, sous les doigts de quelqu'un qui avait
  // pris l'habitude de l'autre.
  const accueil = lire('app/(employee)/index.tsx')

  it('l’accueil du compteur ne redirige jamais vers un inventaire', () => {
    expect(accueil).not.toMatch(/<Redirect/)
    // Une navigation qui part d'un effet est une navigation que personne n'a
    // demandée. Celles de cet écran suivent toutes un appui — rejoindre par
    // code, ouvrir une carte.
    for (const m of accueil.matchAll(/useEffect\(/g)) {
      const corps = accueil.slice(m.index!, m.index! + 700)
      expect(corps, 'une navigation depuis un effet').not.toMatch(/router\.(push|replace)/)
    }
  })
})

describe('le viseur enseigne, une consigne à la fois', () => {
  const scanner = lire('components/scanner.tsx')

  it('deux conseils, l’un après l’autre, quand rien n’est lu', () => {
    expect(scanner).toContain("'Rapprochez-vous, le code doit remplir le cadre'")
    expect(scanner).toContain("'Trop sombre ? Allumez la lampe'")
    // Jamais les deux ensemble : un rang, pas une liste.
    expect(scanner).toContain('const [rangConseil, setRangConseil]')
  })

  it('⚠️ ils s’arrêtent à la première lecture et ne reviennent pas', () => {
    // Sans cela, « Rapprochez-vous » repart trois secondes après chaque scan,
    // pendant qu'on marche vers l'article suivant. Relevé au simulateur.
    expect(scanner).toContain('const [dejaLu, setDejaLu]')
    expect(scanner).toContain('resolving || dejaLu) return')
    // `torch` n'est pas dans les dépendances : allumer la lampe ne doit pas
    // relancer « Rapprochez-vous ».
    expect(scanner).not.toMatch(/resolving, torch\]\)/)
  })

  it('⚠️ ses hooks précèdent les deux retours anticipés', () => {
    // Posés après « permission inconnue » ou l'écran d'amorce, ils seraient
    // sautés d'un rendu à l'autre — et l'écran de comptage tomberait.
    const hook = scanner.indexOf('const [rangConseil')
    const retour = scanner.indexOf('if (!permission) {')
    expect(hook).toBeGreaterThan(-1)
    expect(retour).toBeGreaterThan(hook)
  })

  it('la forme du cadre annonce ce qu’on attend', () => {
    // Depuis le 29 août la géométrie est CALCULÉE, plus figée dans deux
    // styles : `rectCadre` rend un carré en phase balise et un rectangle
    // large en phase article. Le carré se mesure dans les deux sens.
    expect(scanner).toContain('rectCadre(tailleVue.l, tailleVue.h, balisePhase)')
    expect(scanner).toContain('Math.min(l * 0.58, h * 0.62)')
  })

  /**
   * ⚠️ Le dessin et le filtre lisent LA MÊME géométrie. Deux définitions
   * dériveraient au premier ajustement, et le cadre cesserait de dire la
   * vérité — ce qui est exactement le défaut que le filtre ferme.
   */
  it('le cadre fait loi : ce qui est lu ailleurs est écarté', () => {
    expect(scanner).toContain('viseDansLeCadre(result.bounds, tailleVueRef.current, balisePhaseRef.current)')
    // Une seule définition de la géométrie.
    expect(scanner.match(/export function rectCadre/g)?.length).toBe(1)
  })

  /**
   * ⚠️ On laisse passer quand la position est inconnue. expo-camera prévient
   * que `bounds` peut représenter un rectangle vide : refuser dans ce cas
   * rendrait certains codes illisibles sans que rien ne l'explique.
   */
  it('mais il laisse passer quand la position est inconnue', () => {
    const corps = scanner.split('export function viseDansLeCadre')[1]?.slice(0, 900) ?? ''
    expect(corps).toContain('if (!vue || vue.l <= 0 || vue.h <= 0) return true')
    expect(corps).toContain('if (!o || !s || s.width <= 0 || s.height <= 0) return true')
    // Le centre du code, pas son débordement : un code-barres qui dépasse un
    // peu du cadre a bel et bien été visé.
    expect(corps).toContain('s.width / 2')
  })

  it('la trace du dernier scan lève le doute, sans voler la place d’un conseil', () => {
    expect(scanner).toContain("`Dernier scan · ")
    // Le CODE, pas le libellé : ce qu'on vérifie d'un coup d'œil, c'est que le
    // bon code-barres est passé (demande de Julien, 29 août 2026).
    expect(scanner).toContain('recentScans[0].article.ean || recentScans[0].article.sku')
    expect(scanner).toContain('conseil ?? dernierScan ?? camHint')
  })
})

describe('les notifications s’annoncent avant de se demander', () => {
  const accueil = lire('app/(employee)/index.tsx')
  const push = lire('lib/push.ts')

  it('l’état se lit sans ouvrir la boîte système', () => {
    expect(push).toContain('export async function etatNotifications')
    expect(push).toContain('getPermissionsAsync')
    // Un refus définitif ne se propose plus : seuls les Réglages débloquent.
    expect(push).toContain("return perm.canAskAgain ? 'a-demander' : 'refusees'")
  })

  it('la carte dit ce qu’on recevra, et laisse le choix', () => {
    expect(accueil).toContain('Être prévenu des prochains inventaires')
    expect(accueil).toContain('Plus tard')
    expect(accueil).toContain('Activer')
  })

  it('elle ne s’affiche qu’à qui a déjà un inventaire et peut encore répondre', () => {
    expect(accueil).toContain('notifsAVoir && notifsADemander && nbSessions > 0')
  })

  it('⚠️ déjà accordées : rien à l’écran, mais le jeton se réenregistre', () => {
    // Un jeton Expo peut tourner ; sans cela les personnes déjà installées
    // cesseraient d'être prévenues sans que rien ne le dise.
    expect(accueil).toContain("if (etat === 'accordees') { void registerForPushNotifications(); return }")
  })

  it('la question a été posée, elle ne se repose pas', () => {
    expect(accueil).toContain("useRepere('notifications'")
    expect(lire('lib/reperes.ts')).toContain("| 'notifications'")
  })
})

describe('les sorties qui manquaient', () => {
  const login = lire('app/login.tsx')
  const inventaire = lire('app/(supervisor)/[sessionId]/index.tsx')

  it('« Je n’ai pas reçu mon invitation » renvoie au responsable, jamais au support', () => {
    expect(login).toContain('Je n&apos;ai pas reçu mon invitation')
    expect(login).toContain('Votre invitation vient de votre responsable')
    // ⚠️ Sur le code seul : le commentaire de l'écran cite « contactez le
    // support » pour dire qu'on ne l'écrit pas. Le lire ferait échouer une
    // garde qui porte sur ce que l'écran affiche.
    const sansCommentaires = login.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(sansCommentaires).not.toMatch(/support|assistance/i)
  })

  it('le repère du menu attend qu’il y ait quelque chose à lire', () => {
    expect(inventaire).toContain("useRepere('menu-inventaire'")
    expect(inventaire).toContain('repereMenuAVoir && countedPieces > 0')
    // Il dit ce qui ne se voit pas : l'export vit dans le rapport.
    expect(inventaire).toContain('export Excel')
  })

  it('un membre qui n’est jamais entré se voit', () => {
    // `is_active` veut dire « s'est déjà connecté » — libellé du site.
    expect(inventaire).toContain('Mot de passe à créer')
    expect(inventaire).toContain("mm.profiles?.is_active === false")
  })
})

describe('l’administrateur d’entreprise a ses propres étapes', () => {
  const bandeau = lire('components/BandeauDemarrage.tsx')
  const accueil = lire('app/(supervisor)/index.tsx')
  const magasins = lire('app/(compte)/stores.tsx')

  it('trois étapes, et ce ne sont pas celles d’un superviseur', () => {
    expect(bandeau).toContain('export function etapesAdmin')
    expect(bandeau).toContain('Vos magasins sont créés')
    expect(bandeau).toContain('Un superviseur par magasin')
    expect(bandeau).toContain('Un premier inventaire lancé')
  })

  it('⚠️ « un superviseur par magasin » ne le compte pas lui-même', () => {
    // Il a tous les magasins par construction : se compter cocherait l'étape
    // d'office. La RPC l'exclut, et le commentaire dit pourquoi.
    expect(lire('lib/queries.ts')).toContain("supervisors` **n'y compte pas les administrateurs**")
  })

  it('l’étape « un inventaire » ne se décoche pas à la clôture', () => {
    expect(accueil).toContain("m.last_session_at !== null")
  })

  it('un seul bandeau à l’écran : le sien', () => {
    expect(accueil).toContain('estAdmin')
    expect(accueil).toContain('debutant = estAdmin || mesInventaires.length <= 1')
  })

  it('ses magasins disent qui les tient, et lesquels sont à pourvoir', () => {
    expect(magasins).toContain('Aucun superviseur · à pourvoir')
    // Deux noms, puis « et N autres » — la règle du 23 août.
    expect(magasins).toContain('function nommer')
    // Et l'écran dit où cela se règle : l'app n'a pas d'administration.
    expect(magasins).toContain('page Mon équipe du site')
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

/**
 * Le parcours d'onboarding, exercé écran par écran dans le simulateur le
 * 23 août 2026 — et non plus seulement typé et testé. Six défauts que ni le
 * typage, ni le lint, ni les 129 tests précédents ne voyaient.
 */
describe('le parcours du superviseur, vu à l’écran (23 août 2026)', () => {
  const accueil = lire('app/(supervisor)/index.tsx')
  const zones = lire('app/(supervisor)/[sessionId]/zones.tsx')
  const importEcran = lire('app/(supervisor)/[sessionId]/import.tsx')
  const fiche = lire('app/(supervisor)/[sessionId]/index.tsx')
  const nouveau = lire('app/(supervisor)/new-session.tsx')

  // ── Le guide pleine page masquait l'inventaire qu'on venait de créer ────
  //
  // Il occupait l'écran entier tant qu'il durait. Bloqué à « 2 sur 4 », le
  // superviseur n'avait plus aucun chemin vers son inventaire : le seul lien
  // restant, « Masquer ce guide », se lit « je ne veux pas d'aide ». Le
  // bandeau de 76 px a réglé la question par sa taille — il ne doit jamais
  // reprendre l'écran.
  it('le bandeau ne remplace jamais la liste', () => {
    expect(accueil).not.toContain('guidePleinEcran')
    expect(accueil).not.toContain('guidePlein')
  })

  it('le bandeau se pose au-dessus de la liste', () => {
    expect(accueil).toContain('{carteGuide}')
  })

  it('tirer pour rafraîchir recharge aussi le bandeau', () => {
    expect(accueil).toContain("queryClient.invalidateQueries({ queryKey: ['my-team'] })")
  })

  // ── « 10 balises manquantes » sur un inventaire à 0 % ───────────────────
  //
  // « Manquante » veut dire « pas encore comptée » : sur un inventaire qui
  // vient d'être préparé, cela vaut pour toutes. Le bandeau ambre annonçait
  // une perte à la minute où les balises venaient d'être définies.
  it('le bandeau d’alerte attend que le comptage ait commencé', () => {
    expect(fiche).toContain('const comptageCommence = zoneCounted > 0')
    expect(fiche).toContain('const montrerManquantes = comptageCommence && zoneMissing.length > 0')
  })

  it('les balises non comptées ne sont plus dites « manquantes »', () => {
    expect(fiche).toContain('pas encore comptée')
    expect(fiche).not.toContain('} manquante{')
  })

  // ── Le ton des alertes de saisie ────────────────────────────────────────
  //
  // Une saisie incomplète n'est pas une erreur — surtout au premier
  // inventaire de quelqu'un qui découvre l'app.
  it('une saisie incomplète ne se titre pas « Erreur »', () => {
    expect(nouveau).not.toContain("signaler.erreur('Erreur', \"Donnez un nom à l'inventaire.\")")
    expect(nouveau).toContain("signaler.erreur('Nom manquant'")
    expect(zones).toContain("signaler.erreur('Plage incomplète'")
  })

  // Amendé le 23 août : le pop-up « Inventaire créé » a été retiré avec le
  // reste du tunnel. La règle de vocabulaire, elle, ne bouge pas — c'est ce
  // que ce test garde désormais, sur tout l'écran.
  it('le vocabulaire reste « inventaire », jamais « session »', () => {
    expect(nouveau).not.toContain("'Session créée'")
    expect(nouveau).not.toMatch(/Alert\.alert\(\s*'Session/)
    // Le mot s'était aussi glissé dans deux textes lus par les compteurs : la
    // confirmation de suppression et le refus d'enregistrement. « Session »
    // reste réservé à l'authentification (Supabase), où c'est le bon mot.
    expect(nouveau).not.toContain('rejoignent cette session')
    expect(lire('app/(supervisor)/[sessionId]/index.tsx')).not.toContain('membres de la session')
    expect(lire('lib/errors.ts')).not.toContain('plus inscrit à cette session')
  })

  // ── Le bouton qui fait avancer ne se confond plus avec les autres ───────
  it('le bouton de suite des zones se distingue comme celui de l’import', () => {
    expect(zones).toContain('nextBtn: { backgroundColor: t.success')
    expect(importEcran).toContain('startBtn: { backgroundColor: t.success')
  })
})

/**
 * Les emoji : un tracé, jamais un caractère dessiné par le système. La règle
 * valait déjà pour la croix d'annulation d'une invitation ; l'étude du
 * 23 août l'avait relevée sur le scanner (« impasse 6 ») sans la traiter.
 */
describe('aucun emoji dans les écrans du parcours', () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u

  // Seules les lignes de code comptent : les commentaires en emploient pour
  // signaler un piège (« ⚠️ »), et c'est une convention du dépôt.
  //
  // ⚠️ Les blocs sont retirés d'un coup, PAS ligne à ligne. Le filtre d'origine
  // testait le début de chaque ligne, donc il ratait un commentaire JSX —
  // `{/* … */}` ne commence ni par `//` ni par `*`, et ses lignes du milieu ne
  // commencent par rien de reconnaissable. Cinquième variante du même piège sur
  // ce dépôt : une garde qui vérifie une ABSENCE doit lire le code sans ses
  // commentaires, quelle que soit leur forme.
  const codeSeul = (source: string) =>
    source
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
      .split('\n')
      .filter(l => !l.trim().startsWith('//'))
      .join('\n')

  for (const fichier of [
    'components/scanner.tsx',
    'app/(supervisor)/[sessionId]/zones.tsx',
    'app/(supervisor)/[sessionId]/import.tsx',
  ]) {
    it(`${fichier} n’en affiche aucun`, () => {
      expect(EMOJI.test(codeSeul(lire(fichier)))).toBe(false)
    })
  }

  it('les icônes partagées vivent en un seul endroit', () => {
    const icones = lire('components/ui/Icones.tsx')
    for (const nom of ['CorbeilleIcon', 'AlerteIcon', 'AstuceIcon', 'FichierIcon', 'TorcheIcon', 'CocheIcon']) {
      expect(icones).toContain(`export function ${nom}`)
    }
  })
})

/**
 * Le tunnel de préparation, revu le 23 août 2026 à la demande de Julien :
 * plus de pop-up après la création, et une quatrième étape — les compteurs,
 * avec de quoi créer son équipe sur place.
 *
 * Maquette validée avant codage :
 * https://claude.ai/code/artifact/1bded047-76d5-4a80-a00e-9d25d8a74a65
 */
describe('le tunnel de préparation (23 août 2026)', () => {
  const nouveau = lire('app/(supervisor)/new-session.tsx')
  const importEcran = lire('app/(supervisor)/[sessionId]/import.tsx')
  const compteurs = lire('app/(supervisor)/[sessionId]/invite.tsx')

  // ── Le pop-up de création ───────────────────────────────────────────────
  //
  // Il annonçait le numéro, le code et l'étape suivante — pour ensuite faire
  // exactement ce qu'il annonçait.
  it('la création n’ouvre plus de confirmation', () => {
    expect(nouveau).not.toContain("'Inventaire créé'")
    expect(nouveau).not.toContain("text: 'Continuer'")
  })

  it('la création mène droit à la première étape', () => {
    expect(nouveau).toContain('if (usesZones) router.replace(`/(supervisor)/${sid}/zones?from=new`)')
    expect(nouveau).toContain('else router.replace(`/(supervisor)/${sid}/import?from=new`)')
  })

  // ── L'étape qui manquait ────────────────────────────────────────────────
  it('les fichiers mènent aux compteurs, pas à la sortie', () => {
    expect(importEcran).toContain('/invite?from=new')
    expect(importEcran).toContain('Suivant : ajouter des compteurs')
  })

  it('la sortie du tunnel est sur l’écran des compteurs', () => {
    expect(compteurs).toContain("router.replace(`/(supervisor)/${sessionId}`)")
    expect(compteurs).toContain("Commencer l'inventaire")
  })

  it('l’écran des compteurs ferme le retour comme les deux précédents', () => {
    expect(compteurs).toContain('headerBackVisible: false')
    expect(compteurs).toContain('gestureEnabled: false')
  })

  it('le bouton de sortie garde le vert du bout du tunnel', () => {
    expect(compteurs).toContain('startBtn: {\n      backgroundColor: t.success')
  })

  // ── Demande de Julien : le dire sur la page ─────────────────────────────
  it('la page dit qu’on peut commencer sans personne', () => {
    expect(compteurs).toContain('Vous pouvez commencer sans personne')
  })

  it('rien ne bloque la sortie', () => {
    // Le bouton de sortie n'a ni `disabled` ni condition sur les membres.
    const bloc = compteurs.slice(compteurs.indexOf('finBloc'), compteurs.indexOf('finNote'))
    expect(bloc).not.toContain('disabled')
  })

  // ── Créer son équipe sur place ──────────────────────────────────────────
  //
  // Avant : « Un nouveau compteur doit d'abord être ajouté via Ajouter un
  // membre » — un renvoi sans lien, donc un cul-de-sac.
  it('le renvoi sans lien a disparu', () => {
    expect(compteurs).not.toContain('utilisez « Ajouter un membre » depuis votre profil')
    expect(compteurs).not.toContain("doit d'abord être ajouté via")
  })

  it('l’écran crée le compte puis l’ajoute à l’inventaire', () => {
    expect(compteurs).toContain('inviteTeammate(')
    expect(compteurs).toContain('inviteToSession({ sessionId, fullName: who, email: mail, role: \'counter\' })')
  })

  // ⚠️ Le compteur créé appartient au magasin de CET inventaire. Une liste
  // vide le rattacherait à tous les magasins du superviseur.
  it('le compteur créé est rattaché au magasin de l’inventaire', () => {
    expect(compteurs).toContain('storeIds: storeId ? [storeId] : []')
  })

  // Un compte créé dont l'ajout échoue existe quand même : le taire ferait
  // recommencer, pour un « déjà invité ».
  it('un ajout raté après création se dit', () => {
    expect(compteurs).toContain('Compte créé, ajout à faire')
  })

  it('« pas d’équipe » se juge sur l’annuaire, pas sur la recherche', () => {
    expect(compteurs).toContain('const equipeVide = directory !== undefined')
    expect(compteurs).toContain("d.role !== 'supervisor'")
  })

  // ⚠️ **« Nouvel inventaire » ne se masque jamais.** Il l'a été deux fois, et
  // deux fois cela a laissé quelqu'un sans rien à toucher : d'abord tant que le
  // guide durait, puis quand le bandeau en était à l'étape de création et que
  // la liste était vide (constat de Julien, 23 août 2026 : un bandeau, une
  // salutation, « Aucun inventaire pour l'instant », et c'est tout). Le chevron
  // d'un bandeau ne se lit pas comme un bouton.
  it('« Nouvel inventaire » est toujours là', () => {
    const accueil = lire('app/(supervisor)/index.tsx')
    expect(accueil).not.toContain('fabDoublon')
    expect(accueil).not.toContain('guideOffreCreation')
    expect(accueil).not.toContain('montrerGuide ? null : (')
    // Le seul cas où la barre remplace le bouton reste la sélection multiple.
    expect(accueil).toContain('{selection ? (')
  })

  it('l’autre voie — numéro et code — est sur la page', () => {
    expect(compteurs).toContain('Ou partagez les identifiants')
    expect(compteurs).toContain('Share.share(')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// « Ma progression » affichait des chiffres d'avant le comptage
// (constat au simulateur, 24 août 2026)
// ─────────────────────────────────────────────────────────────────────────
//
// L'écran d'un compteur lit `['my-count-totals', sessionId]` — le « 131 pièces
// comptées · 50 auditées » de son en-tête. **Rien n'invalidait cette clé.**
// L'écran de scan invalidait `['my-counts']` (la liste des balises) et
// oubliait les totaux, alors que son miroir superviseur invalide bien
// `['session-counts']`, ce que son écran lit. Vu en vrai : la base disait 50
// pièces auditées, l'écran en affichait encore 34 — sur l'écran même où l'on
// vient vérifier ce qu'on a remonté, et qui n'a ni bouton de rafraîchissement
// ni tirer-pour-rafraîchir.
//
// Même famille que « Inviter un compteur, et le voir » du 23 août : une clé de
// cache qui ne correspond à rien ne fait échouer aucun test et ne lève aucune
// erreur. D'où ces gardes, qui portent sur la clé et non sur la présence d'un
// `invalidateQueries`.
describe('les totaux du compteur se rafraîchissent (24 août 2026)', () => {
  const scanCompteur = lire('app/(employee)/[sessionId]/scan.tsx')
  const ecranCompteur = lire('app/(employee)/[sessionId]/index.tsx')
  const fileHorsLigne = readFileSync(src('hooks/useOfflineQueue.ts'), 'utf8')

  it('l’écran du compteur lit bien les totaux du serveur', () => {
    expect(ecranCompteur).toContain("queryKey: ['my-count-totals', sessionId]")
    expect(ecranCompteur).toContain('getMyCountTotals')
  })

  it('un scan invalide la clé que cet écran lit, pas seulement la liste', () => {
    expect(scanCompteur).toContain("queryKey: ['my-count-totals', sessionId]")
    // La liste des balises comptées reste invalidée elle aussi : les deux
    // écrans ne lisent pas la même chose.
    expect(scanCompteur).toContain("queryKey: ['my-counts', sessionId]")
  })

  it('une file hors ligne qui remonte les rend vrais', () => {
    // Hors ligne, rien n'est parti : les totaux du serveur ont raison de ne
    // pas bouger. C'est la remontée qui les périme.
    expect(fileHorsLigne).toContain("queryKey: ['my-count-totals', sessionId]")
  })

  it('le miroir superviseur reste correct', () => {
    // La garde vaut dans les deux sens : c'est en comparant les deux écrans
    // que le défaut s'est vu.
    const scanSuperviseur = lire('app/(supervisor)/[sessionId]/scan.tsx')
    expect(scanSuperviseur).toContain("queryKey: ['session-counts', sessionId]")
    expect(lire('app/(supervisor)/[sessionId]/index.tsx'))
      .toContain("queryKey: ['session-counts', sessionId]")
  })
})

// ─────────────────────────────────────────────────────────────────────────
// « Revoir les repères » rejoue la porte AILLEURS que sur l'accueil
// (constat de Julien, 24 août 2026)
// ─────────────────────────────────────────────────────────────────────────
//
// « Voir mes inventaires » et « Commencer » avaient une action vide. Au
// premier lancement ça ne se voyait pas : `index.tsx` avait déjà déposé la
// personne sur son accueil, et refermer la porte suffisait à l'y laisser.
// Mais « Revoir les repères » vit dans Mon compte et rejoue la porte de là :
// le bouton refermait alors la porte sur l'écran du profil.
//
// C'est la deuxième fois que ce bouton ne mène nulle part — la première, le
// 23 août, « Préparer mon premier inventaire » retombait sur la liste. D'où
// une garde qui porte sur *toutes* les branches, et pas sur l'une d'elles.
describe('la porte de bienvenue mène toujours quelque part (24 août 2026)', () => {
  const porte = lire('components/PorteBienvenue.tsx')

  it('aucune branche ne rend une action vide', () => {
    // Le motif exact du défaut : `aller: () => {}`.
    expect(porte).not.toMatch(/aller:\s*\(\)\s*=>\s*\{\s*\}/)
  })

  it('chaque libellé proposé a sa destination', () => {
    // Quatre libellés, quatre `router.*`. Si l'un s'ajoute sans destination,
    // le compte ne tombe plus juste.
    const libelles = porte.match(/libelle: '/g) ?? []
    const routages = porte.match(/aller: \(\) => router\.(push|replace)\(/g) ?? []
    expect(libelles.length).toBeGreaterThanOrEqual(4)
    expect(routages.length).toBe(libelles.length)
  })

  it('le retour à l’accueil remplace au lieu d’empiler', () => {
    // `push` depuis Mon compte poserait un second accueil au-dessus, avec une
    // flèche de retour qui y ramène. Ces deux-là ramènent chez soi : ils
    // remplacent.
    expect(porte).toContain("aller: () => router.replace('/(supervisor)/')")
    expect(porte).toContain("aller: () => router.replace('/(employee)/')")
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Les pop-ups sont à nous (24 août 2026)
// ─────────────────────────────────────────────────────────────────────────
//
// `Alert.alert` n'avait rien du produit : police système, bleu d'iOS, et
// surtout **deux réponses du même poids** — sur une suppression, « Annuler »
// et « Supprimer » se ressemblaient trait pour trait. Direction B retenue
// avec Julien sur trois canevas : la question s'ouvre au même moment et au
// même endroit, dans une carte de l'app, et la réponse voulue est un bouton
// plein tandis qu'« Annuler » n'est qu'un contour.
//
// Trois formes, et le partage entre elles est la décision que ces gardes
// tiennent : `demander` pour ce qui se refuse, `avertir` pour ce qui doit
// être lu, `signaler` pour ce qui passe tout seul.
describe('les pop-ups sont à nous', () => {
  const dialogue = readFileSync(src('lib/dialogue.ts'), 'utf8')
  const carte = readFileSync(src('components/ui/Dialogue.tsx'), 'utf8')
  const layout = lire('app/_layout.tsx')

  it('plus une seule alerte iOS dans les écrans', () => {
    // `passControls.ts` est du code mort — plus personne ne l'importe depuis
    // le retrait d'`advance_pass` — et il est le seul à en garder.
    const restants: string[] = []
    for (const f of fichiersSource()) {
      if (f.endsWith('passControls.ts')) continue
      if (/\bAlert\.alert\(/.test(readFileSync(f, 'utf8'))) restants.push(f)
    }
    expect(restants).toEqual([])
  })

  it('l’hôte est monté à la racine, au-dessus de la pile', () => {
    // Une question peut être posée depuis n'importe quel écran ; si l'hôte
    // vivait dans un écran, elle disparaîtrait avec lui.
    expect(layout).toContain('<Dialogues />')
  })

  it('la carte est un Modal, le bandeau non', () => {
    // Sur iOS rien ne passe au-dessus d'un Modal sans en être un, et l'app en
    // a quatre. Le bandeau, lui, ne bloque rien : il reste une surcouche.
    expect(carte).toMatch(/<Modal\b/)
    expect(carte).toContain("pointerEvents=\"box-none\"")
  })

  it('la réponse part au démontage, jamais au toucher', () => {
    // ⚠️ iOS refuse d'ouvrir une feuille de partage tant qu'une présentation
    // est en cours : c'est ce qui avait rendu l'impression des balises
    // inutilisable. Une action qui partage juste après un « oui » doit donc
    // partir quand plus rien n'est présenté.
    expect(carte).toContain('onDismiss={vider}')
    expect(carte).toContain('questionRefermee(')
    // Android n'a pas `onDismiss` : le repli minuté doit rester.
    expect(carte).toMatch(/Platform\.OS !== 'ios'/)
  })

  it('le voile ne referme rien', () => {
    // Toucher à côté n'est pas une réponse : sur une suppression ce serait
    // ambigu, sur un refus ce serait perdre l'explication.
    expect(carte).not.toMatch(/styles\.voile[\s\S]{0,200}onPress/)
  })

  it('un bandeau passe tout seul, une erreur reste plus longtemps', () => {
    // Décision de Julien : personne ne tape « OK » pour un PDF qui est sorti.
    // Un refus, lui, dit souvent quoi corriger — il lui faut le temps d'être lu.
    expect(dialogue).toMatch(/erreur: 6000/)
    expect(dialogue).toMatch(/succes: 3500/)
  })

  it('les résultats sont des bandeaux, pas des questions', () => {
    for (const [fichier, titre] of [
      ['components/BaliseCreator.tsx', 'PDF généré'],
      ['app/(compte)/my-data.tsx', 'Fichier créé'],
      ['app/(compte)/new-member.tsx', 'Compteur ajouté'],
    ] as const) {
      const texte = lire(fichier)
      expect(texte).toContain(`'${titre}'`)
      expect(texte).toMatch(new RegExp(`signaler\\.succes\\([\\s\\S]{0,20}'${titre}'`))
    }
  })

  it('ce qui indique une marche à suivre garde son bouton', () => {
    // « adressez-vous à l'administrateur de votre entreprise » ne peut pas
    // passer tout seul : c'est la seule chose à faire ensuite.
    expect(lire('app/(compte)/new-member.tsx')).toContain('avertir({')
    expect(lire('app/login.tsx')).toContain('avertir({')
  })
})

// Recompter une balise déjà faite n'efface rien : `counts` est en ajout pur,
// les quantités se cumulent. Le superviseur le voit — la liste se réamorce
// avec l'existant ; le compteur non, `counts_select_own` ne lui rend que ses
// propres lignes. D'où l'avertissement, posé sur la seule donnée que les deux
// partagent : le total de la balise, rendu par `get_zone_dashboard`.
describe('rouvrir une balise déjà comptée', () => {
  const scanner = lire('components/scanner.tsx')

  it('avertit avant d’ouvrir, jamais après', () => {
    // Après `set_balise`, la balise serait déjà rouverte : refuser
    // obligerait à la reclôturer, ce qui déplacerait sa date de clôture.
    const corps = scanner.slice(scanner.indexOf('async function openBaliseCode'))
    const question = corps.indexOf('baliseDejaFaite(code)')
    const ouverture = corps.indexOf('setBalise(sessionId, code')
    expect(question).toBeGreaterThan(-1)
    expect(ouverture).toBeGreaterThan(-1)
    expect(question).toBeLessThan(ouverture)
  })

  it('dit que les scans s’ajoutent, sans dire qui a compté', () => {
    expect(scanner).toContain('ajouter à ce total')
    // Le total est public entre membres ; le détail des lignes ne l'est pas.
    // L'avertissement ne doit nommer personne.
    const bloc = scanner.slice(scanner.indexOf('déjà ${compte'), scanner.indexOf('if (!ok) return'))
    expect(bloc).not.toMatch(/counted_by|counted_by|par \$\{/)
  })

  it('se tait sur le chemin délibéré et sur une balise neuve', () => {
    // ⚠️ Amendé le 25 août 2026 au soir, pas affaibli. « Revenir sur une
    // balise » ne rejoue toujours PAS cet avertissement-ci — il y apprendrait
    // à cliquer sans lire, le rang affichant déjà le total. Mais ce rang pose
    // désormais sa propre question, courte, à la demande de Julien (gestes
    // accidentels) : voir `rouvrirDepuisListe` et `tests/comptage.test.ts`.
    expect(scanner).toContain('await openBaliseCode(z.code, false, false, true)')
    expect(scanner).toContain('allowCreate || sansAvertir ? null : baliseDejaFaite(code)')
  })

  it('lit le mode en cours, pas l’autre passe', () => {
    // Une balise comptée mais pas auditée ne doit pas déclencher
    // l'avertissement quand on vient l'auditer. ⚠️ L'écriture a changé le
    // 2 septembre 2026 — la condition ne porte plus sur « clôturée » mais sur
    // « des pièces d'autrui » — l'intention, elle, est la même.
    expect(scanner).toContain('compte ? z.count_units_autres : z.audit_units_autres')
    expect(scanner).toContain("(compte ? z.count_status : z.audit_status) === 'done'")
  })

  it('normalise le code comme la base', () => {
    // `norm_balise` : sans espaces, en capitales. Sans cela, « 1000 » scanné
    // ne retrouverait pas la ligne du tableau de bord.
    expect(scanner).toContain("replace(/\\s/g, '').toUpperCase()")
  })
})

describe('« Supprimer mon compte » n’est plus voisine de « Se déconnecter »', () => {
  // Constat de Julien, 28 août 2026, en voulant se déconnecter : « c'est celui
  // qu'on a envie de cliquer, car il ressemble fortement à un bouton de
  // déconnexion ». Les deux lignes se suivaient dans la même carte, et la
  // rouge — la plus grave — était la seule à attirer l'œil.
  /**
   * Le code seul. Les commentaires de ces écrans **racontent** le défaut
   * corrigé — ils citent « Supprimer mon compte » et le mot `danger` — et
   * feraient échouer des gardes qui portent sur ce que l'écran affiche.
   */
  const codeSeul = (fichier: string) =>
    readFileSync(src(fichier), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')

  const compte = codeSeul('app/(compte)/account.tsx')
  const profil = codeSeul('app/(compte)/profile.tsx')
  const layout = codeSeul('app/(compte)/_layout.tsx')

  it('⚠️ la suppression a quitté l’écran « Mon compte »', () => {
    expect(compte).not.toContain('Supprimer mon compte')
    expect(compte).not.toContain('suppression.confirm')
    expect(profil).toContain('Supprimer mon compte')
    expect(profil).toContain('suppression.confirm')
  })

  it('⚠️ et elle est seule sous son propre titre, en bas', () => {
    // C'est la distance qui protège : une carte à elle, séparée du reste.
    expect(profil).toContain('Zone sensible')
    const zone = profil.split('Zone sensible')[1] ?? ''
    expect(zone).toContain('Supprimer mon compte')
    // Rien d'autre ne descend sous ce titre.
    expect(zone).not.toContain('Mot de passe')
    expect(zone).not.toContain('Prénom et nom')
  })

  it('« Se déconnecter » est la seule ligne rouge de « Mon compte »', () => {
    // Elle ne pouvait pas l'être tant que la suppression était en dessous :
    // deux rouges voisins n'auraient rien distingué.
    // Un seul rang porte l'attribut, et c'est celui de la sortie. (On compte
    // sur les rangs, pas sur le mot : `ton: 'danger'` sert aussi à teinter la
    // carte de confirmation, ce qui n'a rien à voir.)
    const rangsRouges = compte
      .split('<MenuRow')
      .slice(1)
      .filter((rang) => /^[\s\S]*?\/>/.exec(rang)?.[0].match(/\bdanger\b/))
    expect(rangsRouges.length).toBe(1)
    expect(rangsRouges[0]).toContain('Se déconnecter')
  })

  it('le profil rassemble ce qu’on modifie sur soi', () => {
    // Le nom et le mot de passe étaient dans deux sections différentes de
    // l'écran principal, sans raison.
    for (const attendu of ['Prénom et nom', 'Mot de passe', 'Double authentification']) {
      expect(profil).toContain(attendu)
      expect(compte).not.toContain(attendu)
    }
    expect(compte).toContain('Mon profil')
    expect(layout).toContain('name="profile"')
  })

  it('la confirmation n’a pas bougé', () => {
    // Le déplacement ajoute une distance ; il ne remplace pas la question.
    expect(profil).toContain('useAccountDeletion')
  })

  it('chaque ligne de menu porte son icône', () => {
    // Une ligne sans icône dépareille dans une colonne alignée.
    for (const ecran of [compte, profil]) {
      const lignes = ecran.match(/<MenuRow/g)?.length ?? 0
      const avecIcone = ecran.match(/icon="/g)?.length ?? 0
      expect(lignes).toBeGreaterThan(0)
      expect(avecIcone).toBe(lignes)
    }
  })

  it('les icônes sont au trait, jamais en aplat', () => {
    // À 21 px un aplat devient une tache : on voit une forme colorée, pas un
    // objet. Et le trait prend la couleur du rang, donc rougit avec lui.
    const icones = readFileSync(src('components/ui/MenuIcons.tsx'), 'utf8')
    expect(icones).toContain("fill: 'none'")
    expect(icones).toContain('strokeWidth: 1.7')
    const liste = readFileSync(src('components/ui/MenuList.tsx'), 'utf8')
    expect(liste).toContain('danger ? theme.danger : theme.textMuted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// L'écran des écarts d'audit, revu le 29 août 2026.
//
// Constat de Julien, capture à l'appui : « la section écarts arbitrés ne
// convient pas ». En mode sombre elle s'affichait dans un **bandeau blanc**,
// parce que le volet qui la portait venait du gabarit Expo et suivait un autre
// système de thème que l'app. Autour de ce défaut, cinq autres du même ordre.
describe('les écarts arbitrés se lisent comme une liste', () => {
  const ecran = lire('app/(supervisor)/[sessionId]/audits.tsx')

  it('⚠️ le volet du gabarit Expo a disparu, avec son fichier', () => {
    // `ui/collapsible.tsx` importait `@/constants/theme` et `@/hooks/use-theme`
    // — le thème du gabarit, pas celui de l'app. D'où le blanc sur fond sombre.
    // Il n'avait aucun autre appelant : on retire, on n'adapte pas.
    expect(existsSync(src('components/ui/collapsible.tsx'))).toBe(false)
    for (const f of fichiersSource()) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('ui/collapsible')
    }
  })

  it('la section se présente comme un groupe de balises, pas comme un volet', () => {
    // Deux sections d'une même page se présentent de la même façon : un titre
    // `baliseTitle` et une pastille de compte, comme « Balise 1 · Textile
    // femme » juste au-dessus.
    expect(ecran).toContain('<Text style={styles.baliseTitle}>Écarts arbitrés</Text>')
    expect(ecran).toContain('styles.arbCard')
    expect(ecran).toContain('styles.arbFilet')
  })

  it('⚠️ annuler un arbitrage se confirme, et le refus ne dit pas « Annuler »', () => {
    // Le site demande confirmation, l'app annulait au premier appui — sur une
    // liste qu'on fait défiler, et pour défaire une décision. Le bouton de
    // refus dit « Garder » : deux « Annuler » dans la même carte ne se
    // distingueraient pas l'un de l'autre.
    expect(ecran).toContain('function confirmAnnuler')
    expect(ecran).toContain("titre: 'Annuler cet arbitrage ?'")
    expect(ecran).toContain("annuler: 'Garder'")
    // Et la mutation ne part que par cette porte.
    expect(ecran.match(/annuler\.mutate/g)?.length).toBe(1)
  })

  it('⚠️ la cible de l’annulation atteint les 44 pt de la charte', () => {
    // Le libellé ne fait que 18 pt de haut. Vu au simulateur le 29 août 2026 :
    // un appui posé sur le mot ratait la cible sans que rien ne le signale.
    expect(ecran).toContain('hitSlop={{ top: 14, bottom: 14, left: 16, right: 10 }}')
  })

  it('le badge « Arbitré » ne répète plus le titre de la section', () => {
    expect(ecran).not.toContain('>Arbitré<')
  })

  it('⚠️ un zéro ne porte aucune couleur, des deux côtés', () => {
    // En rouge, « aucun écart » se lisait comme un problème ; en vert, un
    // « 0 arbitré » annonçait une réussite qui n'a pas eu lieu.
    expect(ecran).toContain('color={ecartsCount > 0 ? theme.danger : theme.textPrimary}')
    // Amendé le 3 septembre 2026 : le compte des arbitrages vient du serveur
    // depuis que la liste se lit par pages (`arbitres.length` n'en serait plus
    // que la première page). L'intention, elle, ne bouge pas.
    expect(ecran).toContain('color={arbitresTotal > 0 ? theme.success : theme.textPrimary}')
  })

  it('la consigne ne s’affiche que s’il y a quelque chose à corriger', () => {
    expect(ecran).toContain('{groups.length > 0 && (')
    expect(ecran).toContain('styles.okCard')
  })

  it('⚠️ chaque nombre ne s’affiche qu’une fois', () => {
    // Les deux boutons PORTENT le compte du compteur et celui de l'auditeur :
    // les répéter en chiffres au-dessus affichait les mêmes deux nombres à
    // quarante points d'écart. La rangée garde ce qui se lit sans se choisir.
    expect(ecran).not.toContain('label="Compteur" value={fmt(counted)}')
    expect(ecran).not.toContain('label="Auditeur" value={fmt(audited)}')
    expect(ecran).toContain('label="Écart valeur"')
    expect(ecran).not.toContain('minWidth: 72')
    expect(ecran).not.toContain("flexWrap: 'wrap'")
  })

  it('`Chiffre` ne fait plus doublon avec `Fig`', () => {
    expect(ecran).not.toContain('function Chiffre')
    expect(ecran).not.toContain('chiffreValeurAccent')
  })

  it('⚠️ le fichier ne contient plus d’octet nul', () => {
    // Trois séparateurs de clé étaient des octets nuls : git traitait le
    // fichier comme binaire et n'en montrait plus aucun diff.
    expect(readFileSync(src('app/(supervisor)/[sessionId]/audits.tsx')).includes(0)).toBe(false)
  })
})

describe('« il y a 3 h » a une seule définition', () => {
  it('les deux écrans qui datent un événement passent par `lib/temps`', () => {
    // `PendingBalisesView` avait sa propre copie. Deux formats, deux endroits
    // où corriger — le genre de doublon que ce projet paie cher.
    expect(lire('components/PendingBalisesView.tsx')).toContain("from '@/lib/temps'")
    expect(lire('app/(supervisor)/[sessionId]/audits.tsx')).toContain("from '@/lib/temps'")
    expect(lire('components/PendingBalisesView.tsx')).not.toContain('function since')
  })

  it('compte en minutes, en heures, puis en jours', async () => {
    const { depuis } = await import('../src/lib/temps')
    const ilYA = (ms: number) => Date.now() - ms
    expect(depuis(ilYA(10_000))).toBe("à l'instant")
    expect(depuis(ilYA(12 * 60_000))).toBe('il y a 12 min')
    expect(depuis(ilYA(3 * 3600_000))).toBe('il y a 3 h')
    expect(depuis(ilYA(3 * 3600_000), { minutes: true })).toBe('il y a 3 h 00')
    expect(depuis(ilYA(26 * 3600_000))).toBe('hier')
    expect(depuis(ilYA(4 * 24 * 3600_000))).toBe('il y a 4 j')
    // Une date illisible ne rend pas « NaN » : l'appelant la laisse tomber.
    expect(depuis('pas une date')).toBe('')
  })

  it('⚠️ la précision aux minutes reste là où elle sert', () => {
    // Les balises hors ligne surveillent un RETARD qui dure : « il y a 3 h 05 »
    // s'y lit. Un arbitrage se date en jours — « hier » suffit.
    expect(lire('components/PendingBalisesView.tsx')).toContain('{ minutes: true }')
  })
})

describe('un écart d’audit s’arbitre, il ne se supprime pas', () => {
  const ecran = lire('app/(supervisor)/[sessionId]/audits.tsx')

  it('⚠️ plus aucun bouton de suppression sur cet écran', () => {
    // Règle de Julien, 29 août 2026 : « on ne doit pas avoir de bouton
    // supprimer sur la page écarts d'audit, ni sur l'app ni sur le site ».
    // Le cas qu'il couvrait — une ligne scannée par erreur — s'arbitre à 0.
    expect(ecran).not.toContain('deleteAuditLine')
    expect(ecran).not.toContain('CorbeilleIcon')
    expect(ecran).not.toContain('deleteBtn')
    expect(ecran).not.toContain('confirmDelete')
    // Et le texte d'aide ne renvoie plus vers une corbeille disparue.
    expect(ecran).not.toContain('corbeille')
  })

  it('deux boutons tranchent en un appui', () => {
    // Le site les avait déjà ; l'app obligeait à retaper la quantité.
    expect(ecran).toContain('onPress={() => onRetenir(counted)}')
    expect(ecran).toContain('onPress={() => onRetenir(audited)}')
    expect(ecran).toContain('Compteur {unites(counted)}')
    expect(ecran).toContain('Auditeur {unites(audited)}')
  })

  it('⚠️ et ils se voient comme des boutons', () => {
    // Constat de Julien sur le premier jet : en contour, avec une étiquette en
    // capitales et un gros nombre, ils empruntaient le dessin des cellules de
    // chiffres — « je n'ai pas l'impression que ce soient des boutons ».
    // Les deux aplats reprennent les couleurs que l'app emploie déjà pour les
    // deux passes : accent pour compter, or pour auditer.
    expect(ecran).toContain('backgroundColor: theme.accent }')
    expect(ecran).toContain('backgroundColor: AUDIT_COLOR }')
    expect(ecran).toContain("from '@/constants/colors'")
    // Et « Retenir » cède le premier plan : il n'est plus un aplat.
    expect(ecran).not.toContain('resolveBtn: { backgroundColor: t.accent')
  })

  it('⚠️ un libellé tient sur une ligne, même à 100000 unités', () => {
    // « Auditeur 100000 unités » demande ~171 pt ; côte à côte il ne reste que
    // 136 pt de texte par bouton. D'où l'empilement — 300 pt disponibles — et
    // le repli `adjustsFontSizeToFit` pour les valeurs absurdes.
    expect(ecran).toContain('choixRow: { gap: Spacing.sm')
    expect(ecran).not.toContain("choixRow: { flexDirection: 'row'")
    expect(ecran.match(/numberOfLines=\{1\} adjustsFontSizeToFit/g)?.length).toBe(2)
  })

  it('le nombre dit ce qu’il compte, au singulier comme au pluriel', () => {
    expect(ecran).toContain('function unites')
    expect(ecran).toContain("unité${v >= 2 ? 's' : ''}")
  })

  it('⚠️ « Retenir » ne retient plus l’auditeur en douce', () => {
    // Un champ vide valait la quantité de l'auditeur. Avec un bouton
    // « Auditeur » à côté, cela ferait deux contrôles pour le même geste,
    // dont un invisible.
    expect(ecran).toContain("signaler.erreur('Quantité manquante'")
    expect(ecran).not.toContain('onResolve(a, audited)')
  })

  it('la virgule du clavier français est acceptée', () => {
    expect(ecran).toContain(".replace(',', '.')")
  })
})

/**
 * ⚠️ Deux réglages qui ne valent que l'un par l'autre (31 août 2026).
 *
 * `userInterfaceStyle` a valu « light » jusqu'à ce jour : expo-system-ui posait
 * alors MODE_NIGHT_NO sur l'activité Android, `useColorScheme()` rendait
 * toujours 'light', et la préférence « Système » du sélecteur de thème ne
 * pouvait JAMAIS donner le sombre — sur les deux plateformes. Le remettre à
 * « light » recasserait ce choix sans qu'aucun écran ne le signale.
 *
 * Et le plugin de force-dark est l'autre moitié : sans lui, « automatic »
 * laisse Android repeindre l'application lui-même dès que le système passe en
 * sombre. Constat de Julien, capture à l'appui : « l'app garde son bandeau
 * blanc au lieu de suivre le mode système » — c'était l'inversion d'Android
 * sur un bandeau volontairement sombre.
 */
describe('le thème suit le système, et Android ne le repeint pas', () => {
  const appJson = JSON.parse(readFileSync(path.join(here, '..', 'app.json'), 'utf8'))

  it('userInterfaceStyle vaut « automatic », sans quoi « Système » est mort', () => {
    expect(appJson.expo.userInterfaceStyle).toBe('automatic')
  })

  it('⚠️ et le Info.plist iOS ne fige plus l’apparence', () => {
    // `ios/` est VERSIONNÉ : contrairement à `android/`, il ne se régénère pas
    // au build. `UIUserInterfaceStyle = Light` y figeait `useColorScheme()`
    // sur 'light', donc la préférence « Système » était morte sur iPhone comme
    // sur Android. Retirer la clé — c'est ce que « automatic » veut dire.
    const plist = readFileSync(path.join(here, '..', 'ios', 'Inventaire', 'Info.plist'), 'utf8')
    expect(plist).not.toContain('UIUserInterfaceStyle')
  })

  it('et le plugin qui retire l’app du force-dark d’Android est branché', () => {
    expect(appJson.expo.plugins).toContain('./plugins/withAndroidForceDark')
    const plugin = readFileSync(path.join(here, '..', 'plugins', 'withAndroidForceDark.js'), 'utf8')
    expect(plugin).toContain('android:forceDarkAllowed')
    expect(plugin).toContain("'false'")
  })

  it('le bandeau est sombre dans les DEUX palettes — ce n’est pas un défaut', () => {
    // Le « bandeau encre » de la charte. Un correctif qui le rendrait clair en
    // thème clair défairait une décision de marque, pas un bug.
    const ink = readFileSync(src('constants/ink.ts'), 'utf8')
    const bandeaux = [...ink.matchAll(/headerBg:\s*'(#[0-9A-Fa-f]{6})'/g)].map(m => m[1])
    expect(bandeaux).toHaveLength(2)
    for (const c of bandeaux) {
      const l = parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16)
      expect(l).toBeLessThan(120) // les deux sont sombres
    }
  })
})

/**
 * Les cibles tactiles du parcours de comptage (31 août 2026).
 *
 * Relevées en mesurant l'arbre d'accessibilité d'un Pixel, écran par écran :
 * le bouton thème et le bouton profil à 32 dp, « Clôturer » du bandeau à 34,
 * les onglets de mode à 39, « Quitter l'inventaire » à 45. Le minimum Android
 * est 48, celui d'iOS 44.
 *
 * ⚠️ **Une cible se mesure zone tactile comprise, pas au rectangle de la vue.**
 * `hitSlop` n'apparaît pas dans l'arbre d'accessibilité : la mesure brute
 * sur-signale, et la première lecture a failli faire « corriger » des boutons
 * qui allaient très bien. Le nombre pointe, le code tranche.
 *
 * ⚠️ Et deux `hitSlop` voisins ne doivent pas se chevaucher : dans la zone
 * commune, c'est le dernier rendu qui prend l'appui. D'où 40 dp + 4 de slop
 * pour les deux boutons d'en-tête, séparés de 8 — ils se touchent sans
 * empiéter, au lieu de 32 + 8 qui mordait de 8 dp.
 */
describe('les cibles tactiles atteignent 48 dp', () => {
  it('les boutons d’en-tête gardent 32 dp et ne se chevauchent pas', () => {
    // ⚠️ La pastille NE DOIT PAS grandir : 32 + 2×8 fait déjà 48 de cible.
    // L'agrandir à 40 le 31 août n'a rien gagné et a fait remplir, sur iOS 26,
    // la capsule que le système dessine autour des boutons de barre.
    const src = readFileSync(path.join(here, '..', 'src', 'components', 'HeaderActions.tsx'), 'utf8')
    expect(src).toMatch(/width: 32, height: 32, borderRadius: 16/)
    expect(src.match(/hitSlop=\{8\}/g)).toHaveLength(2)
    // C'est l'écart de 16 qui sépare les deux zones de 48.
    expect(src).toMatch(/gap: 16/)
  })

  it('les cibles de l’écran de comptage ne descendent plus sous 48', () => {
    const src = readFileSync(path.join(here, '..', 'src', 'components', 'scanner.tsx'), 'utf8')
    for (const style of ['modeBtn', 'manualBtn', 'manualInput']) {
      const bloc = new RegExp(`${style}: \\{[^}]*minHeight: 48`)
      expect(bloc.test(src), `${style} doit porter minHeight: 48`).toBe(true)
    }
    // « Clôturer » du bandeau garde sa pastille compacte : c'est le hitSlop
    // qui l'amène à 48 (34 + 2×7).
    expect(src).toMatch(/hitSlop=\{\{ top: 7, bottom: 7, left: 8, right: 8 \}\}/)
  })

  it('« Quitter l’inventaire » aussi', () => {
    const src = readFileSync(path.join(here, '..', 'src', 'app', '(employee)', '[sessionId]', 'index.tsx'), 'utf8')
    expect(src).toMatch(/leaveBtn: \{[^}]*minHeight: 48/)
  })

  it('et les boutons en icône seule se nomment', () => {
    // Une icône sans libellé n'existe pas pour un lecteur d'écran. La lampe et
    // le bouton de compte étaient muets.
    const scanner = readFileSync(path.join(here, '..', 'src', 'components', 'scanner.tsx'), 'utf8')
    expect(scanner).toMatch(/accessibilityLabel=\{torch \? 'Éteindre la lampe' : 'Allumer la lampe'\}/)
    const header = readFileSync(path.join(here, '..', 'src', 'components', 'HeaderActions.tsx'), 'utf8')
    expect(header).toMatch(/accessibilityLabel="Mon compte"/)
  })
})

/**
 * Le tour de l'application — profil compteur (31 août 2026).
 *
 * Maquette validée avant codage :
 * https://claude.ai/code/artifact/ebdfe136-f726-4c5f-b55e-eb5e2e56a3f4
 *
 * Quatre pièces, et leur MOMENT est ce qui les rend lisibles : une explication
 * donnée avant que la question ne se pose n'est pas lue.
 */
describe('le tour de l’application, côté compteur', () => {
  const progression = lire('app/(employee)/[sessionId]/index.tsx')
  const scan = lire('components/scanner.tsx')

  it('les trois repères sont déclarés ET effaçables par « Revoir les repères »', () => {
    const src = lire('lib/reperes.ts')
    for (const r of ['file-attente', 'modes-de-scan', 'corriger-scan']) {
      expect(src).toContain(`'${r}'`)
      // ⚠️ Déclarer sans ajouter à `oublierReperes` rendrait le repère
      // définitif : « Revoir les repères » ne le ramènerait jamais.
      expect(new RegExp(`const cles: Repere\\[\\][^\\n]*'${r}'`).test(src), `${r} doit être dans oublierReperes`).toBe(true)
    }
  })

  it('⚠️ « comptées / en attente » attend qu’une balise soit vraiment en attente', () => {
    // Tant que tout remonte, il n'y a rien à expliquer.
    expect(progression).toMatch(/queue\.pending > 0 && expliquerFile/)
  })

  it('⚠️ « tout est remonté » est un ÉTAT, pas un repère', () => {
    // Il revient chaque fois que la file se vide — c'est lui qui rend
    // « en attente » remarquable. Donc pas de `useRepere`, pas de marquage.
    // ⚠️ Et il n'apparaît QU'APRÈS une attente : affiché en permanence, il
    // annonce un non-événement à quelqu'un qui n'a jamais rien vu attendre.
    // C'est la séquence — encart ambre, puis ligne verte — qui informe.
    expect(progression).toMatch(/queue\.pending === 0 && attenteVue/)
    expect(progression).toMatch(/if \(queue\.pending > 0\) setAttenteVue\(true\)/)
    expect(progression).not.toMatch(/useRepere\('tout-remonte'/)
    // ⚠️ Et il tient en UNE LIGNE : un état permanent se lit à chaque
    // ouverture. Un paragraphe qu'on relit chaque fois cesse d'être lu, et
    // vole la place de l'encart ambre d'en face.
    expect(progression).toMatch(/<Astuce titre="Aucune balise en attente" ton="succes" \/>/)
  })

  it('⚠️ « corriger un scan » se déclenche au DEUXIÈME scan du même article', () => {
    // Posé dans la branche où la ligne existe déjà, pas au montage de l'écran.
    const bloc = scan.slice(scan.indexOf('const idx = prev.findIndex'))
    expect(bloc.slice(0, 600)).toMatch(/setVolet\(\{ genre: 'corriger' \}\)/)
  })

  it('⚠️ et jamais deux aides à la fois', () => {
    // « Corriger » ne s'ouvre pas par-dessus un volet en cours, et « trois
    // façons de scanner » attend que celui de la balise soit refermé.
    expect(scan).toMatch(/!voletRef\.current\) setVolet\(\{ genre: 'corriger' \}\)/)
    expect(scan).toMatch(/if \(balisePhase \|\| volet !== null \|\| !repereModes\.aVoir\) return/)
  })

  it('⚠️ sur l’écran de comptage, un repère RECOUVRE — il ne pousse pas', () => {
    // La colonne est à hauteur fixe (bandeau, bascule, scan auto, caméra,
    // déclencheur, liste, clôture) et atteint déjà la hauteur utile d'un petit
    // iPhone. Une carte insérée y ferait sortir le bas de l'écran.
    expect(scan).not.toContain('astuceEncart')
    expect(scan).not.toMatch(/from '@\/components\/Astuce'/)
  })

  it('l’astuce en ligne ne sert que sur un écran qui défile', () => {
    // L'écran de progression est un `ScrollView` : là, une carte ne peut rien
    // faire déborder. C'est le seul endroit où elle est posée.
    expect(progression).toMatch(/<ScrollView/)
    expect(progression).toMatch(/from '@\/components\/Astuce'/)
    const astuce = lire('components/Astuce.tsx')
    expect(astuce).not.toContain('Modal')
    expect(astuce).toContain('flexShrink: 1')
  })

  it('et l’astuce n’invente pas un style à elle', () => {
    // Fond `surface`, filet `hairline`, rayon `lg` : la carte des autres
    // écrans. Un repère qui se dessine autrement se lit comme une publicité.
    const astuce = lire('components/Astuce.tsx')
    expect(astuce).toMatch(/backgroundColor: t\.surface/)
    expect(astuce).toMatch(/borderColor: t\.hairline/)
    expect(astuce).toMatch(/borderRadius: Radius\.lg/)
  })
})

/**
 * Le tour de l'application — profil superviseur (31 août 2026).
 *
 * ⚠️ **Quatre pièces, pas cinq.** La maquette en proposait une cinquième,
 * « la progression compte des balises » : l'écran le dit DÉJÀ, mot pour mot
 * (« % des balises comptées »). Un repère qui explique ce qui est écrit à
 * l'écran n'est pas un repère, c'est du bruit — il a été abandonné.
 *
 * ⚠️ Et deux des quatre ne sont pas des repères mais des **adaptations de
 * texte** : la règle posée par Julien était « tu ne changes rien, tu adaptes
 * uniquement le contenu ». Le choix du mode et la confirmation de clôture
 * gardent donc exactement leur forme.
 */
describe('le tour de l’application, côté superviseur', () => {
  const nouvelle = lire('app/(supervisor)/new-session.tsx')
  const zones = lire('app/(supervisor)/[sessionId]/zones.tsx')
  const imports = lire('app/(supervisor)/[sessionId]/import.tsx')
  const fiche = lire('app/(supervisor)/[sessionId]/index.tsx')

  it('les deux repères sont déclarés et effaçables', () => {
    const src = lire('lib/reperes.ts')
    for (const r of ['balises-vocabulaire', 'fichiers-roles']) {
      expect(src).toContain(`'${r}'`)
      expect(new RegExp(`const cles: Repere\\[\\][^\\n]*'${r}'`).test(src), `${r} doit être dans oublierReperes`).toBe(true)
    }
  })

  it('⚠️ le choix du mode dit qu’il est DÉFINITIF', () => {
    // C'est la seule chose qu'on ne peut pas deviner, et elle se vit pendant
    // tout l'inventaire. Le reste du texte décrit ce que le choix change.
    expect(nouvelle).toMatch(/ne se change plus après la création/)
    // ⚠️ Et la forme ne bouge pas : c'est toujours un `Switch`, pas deux
    // cartes comme la maquette le montrait.
    expect(nouvelle).toContain('<Switch')
  })

  it('⚠️ la clôture compte ce qui reste', () => {
    // Des balises jamais comptées partent dans le rapport comme des manques.
    // C'est le seul chiffre qui puisse faire changer d'avis : il passe devant.
    expect(fiche).toMatch(/zoneMissing\.length > 0/)
    expect(fiche).toMatch(/compteront pour zéro dans le rapport/)
    // La confirmation garde sa forme : même `demander`, mêmes champs.
    expect(fiche).toMatch(/titre: 'Clôturer l’inventaire \?'/)
  })

  it('les deux repères sont posés sur des écrans qui DÉFILENT', () => {
    // Même règle que côté compteur : une carte ne s'insère que là où elle ne
    // peut rien faire déborder.
    for (const src of [zones, imports]) {
      expect(src).toMatch(/<ScrollView/)
      expect(src).toMatch(/from '@\/components\/Astuce'/)
    }
  })

  it('⚠️ et « la progression compte des balises » n’a PAS été ajouté', () => {
    // L'écran le dit déjà. Un test le fige pour qu'on ne le « complète » pas
    // un jour en croyant qu'il manque.
    expect(fiche).toMatch(/% des balises comptées/)
    expect(lire('lib/reperes.ts')).not.toContain('progression-balises')
  })
})

/**
 * Deux superviseurs sur la même balise.
 *
 * Constat de Julien, 2 septembre 2026, sur l'inventaire « Seouliste 020926 » :
 * deux superviseurs ont compté la même balise et leurs relevés se sont
 * additionnés sans que rien ne les prévienne. L'addition est le modèle —
 * `counts` est un journal en ajout pur — mais l'avertissement ne se déclenchait
 * que sur une balise CLÔTURÉE, jamais sur une balise laissée ouverte.
 */
describe('quelqu’un d’autre a compté sur cette balise', () => {
  const scanner = lire('../src/components/scanner.tsx')
  const dialogue = lire('../src/lib/dialogue.ts')
  const carte = lire('../src/components/ui/Dialogue.tsx')
  const requetes = lire('../src/lib/queries.ts')

  it('l’avertissement ne demande plus que la balise soit clôturée', () => {
    const bloc = scanner.slice(scanner.indexOf('function baliseDejaFaite'))
    const corps = bloc.slice(0, bloc.indexOf('\n  }'))
    // Le seul refus est « personne d'autre n'a compté ici ».
    expect(corps).toContain('if (!(unites > 0)) return null')
    expect(corps).not.toMatch(/!==\s*'done'\s*\)?\s*return null/)
  })

  it('il se tait sur sa propre balise — les colonnes « autres » le portent', () => {
    // ⚠️ C'est ce qui remplace une colonne « propriétaire » sur `zones`, qui
    // aurait été fausse dès que deux personnes se relaient sur un rayon.
    expect(scanner).toContain('count_units_autres')
    expect(scanner).toContain('audit_units_autres')
  })

  it('et il ne nomme personne', () => {
    const bloc = scanner.slice(scanner.indexOf('const choix = await demanderChoix'))
    const carteTexte = bloc.slice(0, bloc.indexOf('})'))
    for (const mot of ['full_name', 'counted_by', 'par ' + '${']) {
      expect(carteTexte).not.toContain(mot)
    }
    expect(carteTexte).toContain('Quelqu’un')
  })

  it('« Reprendre à zéro » n’est jamais le défaut : il est le second bouton', () => {
    expect(scanner).toContain("alternative: 'Reprendre à zéro'")
    // Le bouton plein reste le geste qui ne détruit rien.
    expect(scanner).toMatch(/action: compte \? 'Continuer le comptage'/)
  })

  it('et il repasse par une confirmation qui nomme ce qu’on perd', () => {
    const bloc = scanner.slice(scanner.indexOf('async function reprendreAZero'))
    const corps = bloc.slice(0, bloc.indexOf('\n  async function openBaliseCode'))
    expect(corps).toContain("ton: 'danger'")
    expect(corps).toContain('Effacer les comptages de la balise')
    expect(corps).toContain('audits compris')
    // La confirmation vient AVANT l'effacement, jamais après.
    expect(corps.indexOf('await demander(')).toBeLessThan(corps.indexOf('viderBalise('))
  })

  it('vider une balise ne part jamais en file d’attente', () => {
    // ⚠️ La file sert à ne rien perdre ; y mettre un effacement ferait
    // l'inverse. `viderBalise` vient de `@/lib/queries`, pas d'`offlineSync`.
    expect(scanner).toMatch(/import \{[^}]*viderBalise[^}]*\} from '@\/lib\/queries'/)
    const sync = lire('../src/lib/offlineSync.ts')
    expect(sync).not.toContain('viderBalise')
    expect(requetes).toContain('export async function viderBalise')
  })

  it('trois choix s’empilent, deux restent côte à côte', () => {
    // À trois pastilles sur la largeur d'un téléphone, les libellés cassent.
    expect(carte).toContain('question.alternative ? styles.boutonsColonne : styles.boutons')
    // ⚠️ Le balisage écrit le plein en premier (ordre d'une colonne) : la
    // rangée doit donc s'inverser pour que le plein reste à droite.
    expect(carte).toContain("flexDirection: 'row-reverse'")
  })

  it('et `demander` rend toujours un booléen', () => {
    // Aucun des appels existants ne change : seul `demanderChoix` voit les
    // trois issues.
    expect(dialogue).toContain('export function demander(question: Question): Promise<boolean>')
    expect(dialogue).toContain("return demanderChoix(question).then((r) => r === 'action')")
  })
})

/**
 * Le clavier ne recouvre plus les champs.
 *
 * Constat de Julien, 2 septembre 2026 : « saisir le mot de passe ou le code
 * inventaire, le clavier sur des plus petits écrans cache les champs ».
 */
describe('le clavier ne cache plus les champs', () => {
  const composant = lire('../src/components/ui/ClavierEvite.tsx')
  // ⚠️ Une garde qui vérifie une ABSENCE lit le code sans ses commentaires :
  // le fichier explique justement pourquoi on n'utilise pas `useHeaderHeight`,
  // donc il le cite. Quatrième fois que ce piège se présente en une journée.
  const codeSeul = composant.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const ECRANS = [
    '../src/app/(compte)/mfa.tsx', '../src/app/(compte)/name.tsx',
    '../src/app/(compte)/new-member.tsx', '../src/app/(compte)/password.tsx',
    '../src/app/(employee)/index.tsx', '../src/app/(supervisor)/[sessionId]/invite.tsx',
    '../src/app/(supervisor)/[sessionId]/zones.tsx', '../src/app/(supervisor)/new-session.tsx',
    '../src/app/login.tsx',
  ]

  it('⚠️ le décalage vaut la hauteur de l’en-tête, sur iOS', () => {
    // Sans lui, le rembourrage est court de toute la hauteur de l'en-tête :
    // `_frame` est relative au parent, `keyboardFrame.screenY` est en
    // coordonnées écran. Lu dans la source de React Native.
    expect(composant).toContain('keyboardVerticalOffset')
    expect(composant).toContain('HeaderHeightContext')
    // ⚠️ Le CONTEXTE, pas `useHeaderHeight()` : ce hook lève une exception sur
    // un écran sans en-tête, et deux des nôtres n'en ont pas.
    expect(codeSeul).not.toContain('useHeaderHeight')
    // ⚠️ La MÊME règle sur Android : le thème est bord à bord et la cible est
    // l'API 36, donc le système n'y redimensionne plus la fenêtre. Le
    // garde-clavier n'y faisait rien du tout — vérifié sur le Pixel.
    expect(composant).toContain('behavior="padding"')
    expect(composant).toContain('keyboardVerticalOffset={entete ?? 0}')
  })

  it('le chemin interne d’expo-router existe encore', () => {
    // Même précaution que `usePreventRemove` : sans ce fichier, le décalage
    // retomberait à zéro EN SILENCE à la prochaine mise à jour d'Expo.
    expect(existsSync(path.resolve(
      __dirname, '../node_modules/expo-router/build/react-navigation/elements/index.js',
    ))).toBe(true)
  })

  it('⚠️ et chaque écran à champs porte LES DEUX mécanismes', () => {
    // Mesuré au simulateur : seul, aucun des deux ne dégage le champ.
    for (const f of ECRANS) {
      const code = lire(f)
      expect(code, f).toContain('<ClavierEvite')
      expect(code, f).toContain('automaticallyAdjustKeyboardInsets')
      expect(code, f).toContain('keyboardShouldPersistTaps')
    }
  })

  it('plus aucun garde-clavier nu dans l’application', () => {
    // Une seule définition de la règle : un `KeyboardAvoidingView` écrit à la
    // main repartirait sans décalage.
    for (const f of [...ECRANS, '../src/components/scanner.tsx',
                     '../src/components/BaliseSheetModal.tsx',
                     '../src/app/company-setup.tsx', '../src/app/signup.tsx']) {
      expect(lire(f), f).not.toContain('<KeyboardAvoidingView')
    }
  })

  it('la connexion défile — sinon le bouton devient inatteignable', () => {
    const login = lire('../src/app/login.tsx')
    // ⚠️ `flexGrow`, jamais `flex` : `flex: 1` contraint le contenu à la zone
    // visible et empêche tout défilement.
    expect(login).toContain('container: { flexGrow: 1')
    expect(login).not.toContain('container: { flex: 1')
  })
})

describe('l’application ne demande que ce qu’elle utilise', () => {
  const app = JSON.parse(readFileSync(path.join(here, '..', 'app.json'), 'utf8'))

  it('une seule permission Android demandée : la caméra', () => {
    // ⚠️ `expo-audio` ne sert qu'à jouer un bip au scan. Le micro, le service
    // au premier plan et sa variante « lecture de média » étaient déclarés
    // pour rien — et un inventaire qui demande le micro, c'est un refus chez
    // Google et une alerte chez la DSI du client. La fiche produit annonce la
    // caméra et rien d'autre : le manifeste doit dire la même chose.
    expect(app.expo.android.permissions).toEqual(['android.permission.CAMERA'])
  })

  it('les permissions du gabarit sont retirées, nommément', () => {
    const bloquees = app.expo.android.blockedPermissions
    expect(bloquees).toContain('android.permission.RECORD_AUDIO')
    expect(bloquees).toContain('android.permission.FOREGROUND_SERVICE')
    expect(bloquees).toContain('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK')
    // « Par-dessus les autres applications » vient du gabarit React Native et
    // ne sert qu'au menu de développement.
    expect(bloquees).toContain('android.permission.SYSTEM_ALERT_WINDOW')
  })

  it('la caméra dit à quoi elle sert, et que rien n’est enregistré', () => {
    const texte = app.expo.ios.infoPlist.NSCameraUsageDescription
    expect(texte).toContain('codes-barres')
    expect(texte).toContain('Aucune photo')
  })

  it('le manifeste de confidentialité iOS existe et ne déclare aucun pistage', () => {
    // Exigé par Apple dès qu'on touche une « required reason API ».
    const pv = readFileSync(path.join(here, '..', 'ios', 'Inventaire', 'PrivacyInfo.xcprivacy'), 'utf8')
    expect(pv).toContain('NSPrivacyAccessedAPICategoryUserDefaults')
    expect(pv).toContain('NSPrivacyAccessedAPICategoryFileTimestamp')
    expect(pv).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/)
  })
})

describe('l’iPad n’est pas un iPhone agrandi', () => {
  const layouts = [
    'app/_layout.tsx', 'app/(supervisor)/_layout.tsx',
    'app/(employee)/_layout.tsx', 'app/(compte)/_layout.tsx',
  ]

  it('chaque pile borne la largeur de son contenu', () => {
    // ⚠️ Sur un iPad 13" (1032 points), la mise en page du téléphone s'étalait
    // d'un bord à l'autre : champs de connexion sur toute la largeur, cartes
    // de 1000 points, un vide au milieu. C'est ce qu'Apple refuse en 2.4.1 —
    // une application iPhone agrandie. Constaté au simulateur le 2 septembre
    // 2026, avant la première soumission.
    for (const f of layouts) {
      expect(lire(f)).toContain('contentStyle: contenuColonne')
    }
  })

  it('la borne ne s’applique qu’au contenu, jamais à l’en-tête', () => {
    // Un bandeau rétréci au milieu de l'écran ferait « application de
    // téléphone dans une fenêtre » — le défaut qu'on corrige.
    const c = lire('constants/layout.ts')
    expect(c).toContain('maxWidth: COLONNE_MAX')
    expect(c).toContain("alignSelf: 'center'")
    for (const f of layouts) {
      expect(lire(f)).not.toContain('headerStyle: contenuColonne')
    }
  })

  it('aucun iPhone n’atteint la borne, donc rien ne bouge sur téléphone', () => {
    // Le plus large des iPhone fait 440 points. Descendre COLONNE_MAX sous
    // cette valeur rétrécirait tous les écrans de téléphone d'un coup.
    const { COLONNE_MAX } = { COLONNE_MAX: Number(lire('constants/layout.ts').match(/COLONNE_MAX = (\d+)/)![1]) }
    expect(COLONNE_MAX).toBeGreaterThan(440)
  })

  it('la porte de bienvenue suit la même colonne', () => {
    // Elle est en surcouche, hors de toute pile : la borne des piles ne
    // l'atteint pas.
    expect(lire('components/Bienvenue.tsx')).toContain('contenuColonne')
  })
})

describe('la publication Android ne part pas avec la clé de debug', () => {
  const app = JSON.parse(readFileSync(path.join(here, '..', 'app.json'), 'utf8'))
  const plugin = readFileSync(path.join(here, '..', 'plugins', 'withAndroidSigning.js'), 'utf8')
  const script = readFileSync(path.join(here, '..', 'scripts', 'play.sh'), 'utf8')

  it('un plugin pose la signature, parce qu’android/ est généré', () => {
    // ⚠️ Le gabarit Expo signe le release avec la clé de DEBUG — celle du SDK,
    // que tout le monde possède. Google Play la refuse. Et `android/` étant
    // regénéré à chaque prebuild, la correction ne peut pas y vivre.
    const plugins = app.expo.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p))
    expect(plugins).toContain('./plugins/withAndroidSigning')
  })

  it('la clé est lue sur la machine, jamais dans le dépôt', () => {
    // Un dépôt privé reste un dépôt : une clé de signature qui fuit permet de
    // publier une mise à jour à notre place.
    expect(plugin).toContain('QUANTINVO_UPLOAD_STORE_FILE')
    expect(plugin).not.toMatch(/storePassword\s+["']/)
    expect(plugin).not.toMatch(/keyPassword\s+["']/)
    expect(JSON.stringify(app)).not.toMatch(/keystore|storePassword/i)
  })

  it('sans la clé, le build de test continue mais la publication refuse', () => {
    // Deux exigences opposées, et c'est voulu : `pixel.sh` doit produire un APK
    // installable sans rien demander, `play.sh` doit refuser plutôt que de
    // sortir un bundle signé en debug.
    expect(plugin).toContain("project.hasProperty('QUANTINVO_UPLOAD_STORE_FILE')")
    expect(script).toContain('exit 1')
    expect(script).toContain('bundleRelease')
  })

  it('la signature du bundle est contrôlée après coup', () => {
    // ⚠️ Un build qui réussit ne prouve pas que la bonne clé a servi : sans les
    // propriétés, Gradle serait retombé sur la clé de debug SANS RIEN DIRE.
    expect(script).toContain('Android Debug')
  })

  it('les numéros de build sont explicites, pour pouvoir être incrémentés', () => {
    // Les deux boutiques exigent un numéro qui augmente à chaque dépôt. Une
    // valeur implicite ne se voit pas, donc ne se remonte pas.
    expect(app.expo.ios.buildNumber).toBeTruthy()
    expect(typeof app.expo.android.versionCode).toBe('number')
  })

  it('⚠️ le numéro iOS vit AUSSI dans un plist versionné, et les deux doivent coïncider', () => {
    // `android/` est régénéré à chaque build : `versionCode` n'a qu'une source,
    // app.json. `ios/` est VERSIONNÉ et ne se régénère pas — le numéro qui part
    // réellement chez Apple est celui d'Info.plist. Bumper app.json seul produit
    // donc un second « build 1 », et App Store Connect le refuse À L'ENVOI,
    // après tout le build. Même piège que `UIUserInterfaceStyle` le 31 août.
    const plist = readFileSync(path.join(here, '..', 'ios', 'Inventaire', 'Info.plist'), 'utf8')
    const valeur = (cle: string) =>
      plist.match(new RegExp(`<key>${cle}</key>\\s*<string>([^<]*)</string>`))?.[1]

    expect(valeur('CFBundleVersion')).toBe(app.expo.ios.buildNumber)
    expect(valeur('CFBundleShortVersionString')).toBe(app.expo.version)

    // Et une TROISIÈME copie dort dans le projet Xcode. Elle ne décide de rien
    // tant que le plist porte une valeur littérale — mais elle décide de tout
    // le jour où quelqu'un y met $(CURRENT_PROJECT_VERSION), et `agvtool` ne
    // lit qu'elle. Trouvée à 1 alors que le plist passait à 2 : on aligne.
    const pbx = readFileSync(
      path.join(here, '..', 'ios', 'Inventaire.xcodeproj', 'project.pbxproj'), 'utf8')
    const versions = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1])
    expect(versions.length).toBeGreaterThan(0)
    for (const v of versions) expect(v).toBe(app.expo.ios.buildNumber)
  })
})

/**
 * Les deux écrans lourds de l'application se lisent par pages
 * (3 septembre 2026).
 *
 * Le Rapport et les Écarts chargeaient TOUTES les lignes — 400 000 sur un gros
 * inventaire. Sur un téléphone c'est pire que sur un ordinateur : la réponse ne
 * tient pas en mémoire, et le serveur ne la rend pas dans les 8 s qu'il
 * s'accorde.
 */
describe('le rapport et les écarts de l’application se lisent par pages', () => {
  // ⚠️ Sans ses commentaires : ils EXPLIQUENT le défaut corrigé, donc ils
  // citent les fonctions qu'on interdit. Une garde d'absence qui les lirait
  // échouerait sur sa propre documentation.
  const codeSeul = (source: string) =>
    source
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
      .split('\n')
      .filter(l => !l.trim().startsWith('//'))
      .join('\n')

  const rapport = codeSeul(lire('app/(supervisor)/[sessionId]/results.tsx'))
  const ecarts = codeSeul(lire('app/(supervisor)/[sessionId]/audits.tsx'))
  const q = codeSeul(lire('lib/queries.ts'))

  it('⚠️ aucun des deux ne demande plus TOUTES les lignes', () => {
    expect(rapport).not.toContain('getSessionResults(')
    expect(rapport).toContain('getRapportPage(')
    expect(ecarts).not.toContain('getEcarts(sessionId)')
    expect(ecarts).toContain('getEcartsPage(')
  })

  it('⚠️ les totaux viennent de la base, jamais d’une addition de la page', () => {
    // Des chiffres qui changeraient en faisant défiler ne voudraient rien dire.
    expect(rapport).not.toMatch(/r\.reduce\(/)
    expect(rapport).toContain('resume?.ecart_valeur')
    expect(ecarts).toContain('resume?.total')
    expect(ecarts).toContain('resume?.arbitres')
  })

  it('⚠️ la règle des écarts ne se calcule plus sur le téléphone', () => {
    // Elle a besoin de TOUTES les lignes pour trancher : elle ne peut pas
    // paginer. Elle vit en base, reprise clause par clause.
    expect(ecarts).not.toContain('auditedZones.has(')
    expect(ecarts).not.toContain("a.status === 'resolved'")
  })

  it('⚠️ le téléphone demande l’ordre « à traiter », pas celui du site', () => {
    // Quelqu'un debout dans un rayon veut le travail qui reste, pas un
    // classement par balise.
    expect(q).toContain("p_ordre: 'a_traiter'")
  })

  it('⚠️ l’export contient toujours tout', () => {
    expect(rapport).toContain('getAllRapportRows(')
    expect(q).toContain('async function toutesLesPages')
    // Deux conditions d'arrêt : une page incomplète, et le total atteint.
    expect(q).toContain('r.rows.length < taille || tout.length >= total')
  })

  it('les deux boutons « voir plus » atteignent la cible tactile', () => {
    // 48 dp, le minimum d'Android — règle du 31 août 2026.
    for (const ecran of [rapport, ecarts]) {
      expect(ecran).toMatch(/plusBtn:\s*\{[\s\S]*?minHeight:\s*48/)
    }
  })
})

/**
 * Le séparateur de milliers, côté application (3 septembre 2026).
 *
 * Demande de Julien : « toujours avoir un séparateur de milliers, exemple
 * 1000 > 1 000, plus facile à lire ». Sur un inventaire, la colonne des
 * quantités porte des nombres à cinq ou six chiffres : sans groupement,
 * « 128400 » ressemble à « 12840 » au coup d'œil, à l'endroit précis où l'on
 * cherche un écart.
 */
describe('les nombres portent leur séparateur de milliers', () => {
  const nombres = lire('lib/nombres.ts')
  const results = lire('app/(supervisor)/[sessionId]/results.tsx')
  const audits = lire('app/(supervisor)/[sessionId]/audits.tsx')

  it('⚠️ une seule définition, plus une copie par écran', () => {
    // `fmt` vivait en double, recopié dans les deux écrans — le genre de
    // doublon qui diverge au premier ajustement.
    expect(nombres).toContain('export function qte(')
    expect(nombres).toContain('export function euros(')
    for (const ecran of [results, audits]) {
      expect(ecran).toContain("from '@/lib/nombres'")
      expect(ecran).not.toContain('function fmt(v: number')
      expect(ecran).not.toContain("v.toFixed(3).replace(")
    }
  })

  it('les trois fonctions groupent bien', () => {
    // Le groupement vient de `toLocaleString('fr-FR')`, la seule chose qui
    // sache où poser les espaces dans « 1 234 567 ».
    for (const fn of ['qte', 'euros', 'nb']) {
      const corps = nombres.slice(nombres.indexOf(`export function ${fn}(`))
      expect(corps.slice(0, 400), fn).toContain("toLocaleString('fr-FR'")
    }
  })

  it('⚠️ la locale est TOUJOURS nommée', () => {
    // `toLocaleString()` nu suit la langue du téléphone : « 1,000 » sur un
    // appareil anglais, au milieu d'une interface en français.
    for (const f of fichiersSource()) {
      const code = readFileSync(f, 'utf8')
      expect(code, f).not.toMatch(/toLocaleString\(\s*\)/)
    }
  })

  it('⚠️ mais rien ne se groupe à l’import ni à l’export', () => {
    // Une espace insécable dans un fichier n'est plus un nombre pour un
    // tableur, et une valeur envoyée en base ne se formate jamais.
    const importLib = lire('lib/import.ts')
    expect(importLib).not.toContain("from '@/lib/nombres'")
    expect(lire('lib/report.ts')).not.toContain("from '@/lib/nombres'")
  })
})

/**
 * Hors ligne, l'écran de progression s'ouvre quand même (4 septembre 2026).
 *
 * Constat de Julien : « lorsque nous sommes hors ligne la page progression sur
 * téléphone reste blanche […] y a-t-il une possibilité de faire en sorte que
 * l'on puisse ouvrir la page scan depuis la page progression même en hors
 * ligne ? ». Oui — et le défaut n'était pas la progression, c'était le geste
 * qu'elle bloquait.
 */
describe('l’écran de progression s’ouvre hors ligne', () => {
  const progression = lire('app/(employee)/[sessionId]/index.tsx')
  const liste = lire('components/CountedBalisesList.tsx')

  it('⚠️ SEULE LA FICHE DE L’INVENTAIRE RETIENT L’ÉCRAN', () => {
    // Les totaux du serveur attendaient là aussi : hors ligne leur requête
    // échoue, React Query la rejoue, et le bouton « Compter des articles »
    // restait derrière. Un chiffre d'affichage ne bloque pas un geste.
    expect(progression).toContain('const isLoading = sessionLoading')
    expect(progression).not.toContain('sessionLoading || countsLoading')
  })

  it('⚠️ les totaux passent par la bascule hors ligne', () => {
    // C'était la seule requête de l'écran à venir directement de `queries`.
    expect(progression).toMatch(/getMyCountTotals[^\n]*from '@\/lib\/offlineSync'/)
    expect(progression).not.toMatch(/getMyCountTotals[^\n]*from '@\/lib\/queries'/)
  })

  it('⚠️ un total inconnu s’écrit « — », jamais « 0 »', () => {
    // Annoncer zéro pièce à quelqu'un qui vient d'en compter cent est le
    // genre de chiffre qu'on croit — même règle que les tuiles du site.
    expect(progression).toContain("'— pièce comptée · — auditée'")
    expect(progression).toContain('{totaux')
  })

  it('⚠️ « Balises comptées » ne dit pas « rien » quand elle n’a pas pu demander', () => {
    // C'est l'écran qu'on ouvre pour se rassurer avant de quitter le magasin :
    // « Aucune pièce remontée » y serait le pire des mensonges.
    expect(liste).toContain('isError || isOffline()')
    expect(liste).toContain('Impossible de joindre le serveur')
    expect(liste).toContain("from '@/lib/offlineSync'")
  })

  it('le cache des totaux part avec l’inventaire et à la déconnexion', () => {
    const offline = lire('lib/offline.ts')
    // `clearSession` le nomme ; le ménage de déconnexion balaie tout `V:`
    // sauf la file, donc il le couvre sans qu'on l'y nomme.
    expect(offline).toContain('k === totauxKey(sessionId)')
    expect(offline).toContain('export const cacheCountTotals')
  })
})

/**
 * Le catalogue hors ligne, allégé et incrémental (4 septembre 2026).
 *
 * Julien, après la mesure de charge : « ne télécharger que ce dont chaque
 * compteur a besoin ». Mesuré sur la base réelle : 304 octets par référence,
 * soit 116 Mo pour 400 000 références — par appareil, à chaque ouverture de
 * l'écran de comptage.
 */
describe('le catalogue hors ligne ne pèse plus le même poids', () => {
  const requetes = lire('lib/queries.ts')
  const bascule = lire('lib/offlineSync.ts')
  const migrations = readdirSync(path.join(here, '..', 'supabase', 'migrations'))
    .filter((f) => f.includes('catalogue_hors_ligne'))
    .map((f) => readFileSync(path.join(here, '..', 'supabase', 'migrations', f), 'utf8'))
    .join('\n')

  it('⚠️ le serveur n’envoie que ce que le scanner lit', () => {
    // Vérifié champ par champ dans src/ : ni l'identifiant interne, ni celui
    // de l'inventaire, ni la date de modification ne sont lus d'un article
    // téléchargé. Et le code-barres partait EN DOUBLE (brut + normalisé).
    expect(migrations).toContain('returns table(sku text, ean text, label text, brand text, prix numeric)')
    for (const colonne of ['a.id', 'a.session_id', 'a.updated_at', 'a.ean_norm']) {
      expect(migrations.split('catalogue_hors_ligne')[2] ?? '', colonne).not.toContain(`${colonne},`)
    }
  })

  it('⚠️ `ean_norm` se recalcule sur le téléphone, à l’identique du serveur', () => {
    // La colonne est générée en base (`NULLIF(ltrim(ean,'0'),'')`). Les deux
    // copies clientes doivent la reproduire mot pour mot, sinon un code
    // scanné ne retrouve plus son article.
    const attendu = "const stripped = (ean ?? '').replace(/^0+/, '')"
    expect(requetes).toContain(attendu)
    expect(lire('lib/offline.ts')).toContain(attendu)
  })

  it('⚠️ le repère se prend AVANT de télécharger', () => {
    // Ce qui change pendant qu'on tourne les pages porte une date
    // postérieure : ce sera pour le passage suivant, et rien n'est perdu.
    const corps = bascule.slice(bascule.indexOf('async function catalogueAJour'))
    expect(corps.indexOf('catalogueRepere(sessionId)')).toBeLessThan(corps.indexOf('q.getCatalogue('))
  })

  it('⚠️ LE DÉCOMPTE RATTRAPE LES SUPPRESSIONS', () => {
    // Une date de modification ne dit rien d'une ligne effacée — et remplacer
    // un fichier d'import en efface. Sans ce contrôle, le cache garderait des
    // fantômes : un code scanné se résoudrait sur un article disparu.
    expect(migrations).toContain('count(*)::bigint')
    expect(bascule).toContain('fusion.length !== repere.total')
    expect(bascule).toContain('duServeur.length === repere.total')
  })

  it('⚠️ l’ancien chemin reste, pour les téléphones déjà sur le terrain', () => {
    // Règle du projet : le code se déploie d'abord, l'objet se retire ensuite.
    // `lister_articles` est encore appelée par le build de production.
    expect(requetes).toContain('export async function getSessionArticles')
    expect(migrations).not.toContain('drop function public.lister_articles')
    // Mais la bascule, elle, ne l'appelle plus.
    expect(bascule).not.toContain('q.getSessionArticles(')
  })

  it('les deux fonctions reposent leurs droits, anon nommément', () => {
    for (const fn of ['catalogue_repere', 'catalogue_hors_ligne']) {
      expect(migrations, fn).toContain(`revoke all on function public.${fn}(`)
    }
    expect(migrations).toMatch(/from public, anon/)
    expect(migrations).toContain('to authenticated, service_role')
  })

  it('la garde du serveur est celle de l’ancienne fonction, à l’identique', () => {
    // Un compteur doit pouvoir la lire : c'est lui qui compte.
    expect(migrations.match(/membre_ou_superviseur\(p_session_id\)/g)?.length).toBe(2)
  })
})
