// Navigation de l'espace connecté — ce que la refonte ne doit pas défaire.
//
// Avant, chaque page portait ses propres boutons de sortie et « Mon compte »
// servait de carrefour : dix blocs empilés, les inventaires en double, le
// tableau de bord derrière un bouton au milieu de la page, et aucun retour
// au site public. Ces tests figent le remède.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const shell = lire('../components/AppShell.tsx')
const compte = lire('../app/account/page.tsx')

// Toutes les pages de l'espace connecté. En ajouter une sans la coquille
// doit se voir : elle n'aurait ni navigation, ni retour, ni déconnexion.
const PAGES_CONNECTEES = [
  '../app/dashboard/page.tsx',
  '../app/dashboard/new/page.tsx',
  '../app/dashboard/[sessionId]/page.tsx',
  '../app/equipe/page.tsx',
  '../app/magasins/page.tsx',
  '../app/outils/page.tsx',
  '../app/account/page.tsx',
  '../app/admin/page.tsx',
  '../app/admin/entreprises/page.tsx',
  '../app/admin/console/page.tsx',
  '../app/admin/entreprise/[companyId]/page.tsx',
]

describe('la barre de navigation', () => {
  it('est posée sur chaque page de l’espace connecté', () => {
    for (const page of PAGES_CONNECTEES) {
      expect(lire(page), `${page} doit passer par AppShell`).toContain('<AppShell')
    }
  })

  it('ramène au site public', () => {
    // Le retour à l'accueil manquait partout : c'est le premier reproche.
    expect(shell).toContain('href="/"')
    expect(shell).toContain('retour au site')
  })

  it('porte le nom, l’entreprise ET le rôle, ensemble', () => {
    // « Entreprise C » seul ne dit pas ce qu'on y fait ; le rôle seul ne dit
    // pas où. Les deux se lisent sur la même ligne, sous le nom.
    expect(shell).toContain('who-name')
    expect(shell).toContain('who-co')
    expect(shell).toContain('companyName')
    expect(shell).toContain('roleCourt')
    expect(shell).toContain('appartenance')
    // L'administrateur Quantinvo n'a pas d'entreprise : c'est Quantinvo même.
    expect(shell).toContain("'Quantinvo'")
  })

  it('range le compte et la déconnexion sous l’avatar, pas dans les onglets', () => {
    expect(shell).toContain('who-menu')
    expect(shell).toContain('Se déconnecter')
    // « Mon compte » ne doit pas revenir dans la liste des onglets.
    const onglets = shell.split('export function ongletsPour')[1]?.split('\n}')[0] ?? ''
    expect(onglets).not.toContain("'/account'")
  })

  it('a la même largeur sur toutes les pages', () => {
    // Reproche de Julien, 21 août 2026 : la barre était plus large sur le
    // tableau de bord d'un inventaire que partout ailleurs — j'avais élargi
    // cette page seule. Une seule largeur, une seule règle : pas de
    // modificateur par page, sinon le bandeau change de dimension d'un
    // onglet à l'autre.
    const css = lire('../app/globals.css')
    expect(shell).toContain('className="appbar-inner"')
    expect(shell).toContain('className="app-main"')
    expect(css).not.toContain('.app-main-wide')
    expect(css).not.toContain('.appbar-inner-wide')
  })

  it('signale son menu par un vrai chevron, pas par un caractère', () => {
    // Reproche de Julien, 21 août 2026 : « la flèche proche de l'icône compte
    // est trop petite, ça ressemble à un point ». C'était « ▾ » à 11 px. Un
    // tracé SVG reste net à toute taille — et c'est la règle du projet :
    // icônes dessinées, jamais de caractère ni d'emoji.
    // Le commentaire du composant cite le caractère pour expliquer le
    // pourquoi : on ne regarde donc que le code.
    const codeSeul = shell
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(codeSeul).not.toContain('▾')
    expect(codeSeul).toContain('ChevronBas')
    // Il pivote à l'ouverture : il dit dans quel sens va le prochain clic.
    expect(lire('../app/globals.css')).toContain('.who-btn[aria-expanded="true"] .who-caret')
  })

  it('se referme au clic ailleurs et à Échap', () => {
    expect(shell).toContain("addEventListener('mousedown'")
    expect(shell).toContain("'Escape'")
  })

  it('s’allume sur les sous-pages d’un espace', () => {
    // Reproche de Julien, 21 août 2026 : le tableau de bord d'un inventaire
    // portait son propre bandeau — logo, « Mes inventaires », « Mon compte » —
    // au lieu de la barre. Elle y est ; l'onglet « Inventaires » doit rester
    // allumé pendant qu'on travaille dans un inventaire.
    expect(shell).not.toContain("o.href !== '/dashboard'")
    // /admin garde son exception : il ne s'allume pas sur /admin/entreprises.
    expect(shell).toContain("o.href !== '/admin'")
  })
})

describe('le tableau de bord d’un inventaire', () => {
  const page = lire('../app/dashboard/[sessionId]/page.tsx')
  const burger = lire('../components/dashboard/MobileNav.tsx')

  it('ne rejoue plus son propre bandeau', () => {
    // Un logo « Quantinvo » posé dans la page, sous celui de la barre, ferait
    // deux fois la même chose à deux hauteurs différentes.
    expect(page).not.toContain('<Logo')
    expect(page).not.toContain('dash-head-links')
  })

  it('laisse la barre porter les liens, le burger ne garde que les sections', () => {
    expect(burger).not.toContain("href=\"/dashboard\"")
    expect(burger).not.toContain("href=\"/account\"")
    // Les sections de l'inventaire, elles, restent atteignables sur mobile.
    expect(page).toContain('<MobileNav')
  })
})

describe('les onglets suivent le rôle', () => {
  const onglets = shell.split('export function ongletsPour')[1]?.split('\n}\n')[0] ?? ''

  it('l’administrateur Quantinvo a ses trois écrans', () => {
    expect(onglets).toContain("'/admin'")
    expect(onglets).toContain("'/admin/entreprises'")
    expect(onglets).toContain("'/admin/console'")
  })

  it('le superviseur ouvre sur ses inventaires', () => {
    // Le premier onglet dit ce pour quoi on ouvre le site. La comparaison porte
    // sur la branche du superviseur seule : celle de l'administrateur la
    // précède dans le fichier et porte un autre ordre, voulu.
    // [2] et non [1] : le premier `return [` est celui de l'administrateur.
    const superviseur = onglets.split('profile.is_company_admin')[1]?.split('return [')[2] ?? ''
    const i = superviseur.indexOf("'/dashboard'")
    const j = superviseur.indexOf("'/equipe'")
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeLessThan(j)
  })

  it('l’administrateur d’entreprise ouvre sur son entreprise', () => {
    // Sa barre est celle d'une console : l'état de l'entreprise d'abord, les
    // inventaires en quatrième — ils sont le travail de ses superviseurs.
    const admin = onglets.split('profile.is_company_admin')[1]?.split('return [')[0] ?? ''
    expect(onglets).toContain('is_company_admin')
    expect(admin + onglets).toContain("'/entreprise'")
    expect(admin + onglets).toContain("'/journal'")
    const branche = onglets.split("if (profile.is_company_admin)")[1]?.split(']')[0] ?? ''
    expect(branche.indexOf("'/entreprise'")).toBeLessThan(branche.indexOf("'/dashboard'"))
  })

  it('la boîte à outils quitte sa barre sans disparaître', () => {
    // Imprimer des balises est un geste de terrain, occasionnel pour lui : le
    // lien descend sous son avatar plutôt que d'occuper un sixième onglet.
    const branche = onglets.split("if (profile.is_company_admin)")[1]?.split(']')[0] ?? ''
    expect(branche).not.toContain("'/outils'")
    expect(shell).toContain('profile.is_company_admin && (')
    expect(shell).toContain('href="/outils"')
  })
})

describe('l’espace connecté ne s’ouvre pas sur un petit écran', () => {
  // Décision de Julien, 21 août 2026 : « il y a une app, investir du temps
  // dans la version mobile du site n'a pas de sens ». Le site est l'outil du
  // superviseur — tableaux, imports, rapports ; compter se fait dans
  // l'application. Plutôt qu'une mise en page qui fait semblant, on le dit.
  const css = lire('../app/globals.css')

  it('la coquille porte l’écran « ordinateur requis »', () => {
    expect(shell).toContain('ordinateur-requis')
    expect(shell).toContain('EcranOrdinateur')
  })

  it('la porte est en CSS, sur la seule coquille', () => {
    // En CSS et non en mesure JavaScript : pas de bascule visible au
    // chargement, et le rendu serveur reste le même.
    const bloc = css.split('@media (max-width: 719px)')[1]?.split('\n}')[0] ?? ''
    expect(bloc, 'la barre et le contenu sont masqués sous 720 px').toContain('.appbar, .app-main, .dash { display: none; }')
    expect(css).toContain('.ordinateur-requis { display: none; }')
  })

  it('ne laisse personne enfermé', () => {
    // Deux sorties : revenir au site public, ou se déconnecter.
    expect(shell).toContain('Retour au site')
    expect(shell).toContain('ordinateur-requis-actions')
  })

  it('ne ferme aucune page publique', () => {
    // Les liens d'invitation arrivent par e-mail, donc sur un téléphone :
    // /bienvenue, /reinitialisation, /login, /inventaire et /open doivent
    // rester utilisables. Ils ne passent pas par AppShell — le vérifier ici
    // empêche de « ranger » un jour ces pages dans la coquille.
    for (const page of [
      '../app/bienvenue/page.tsx',
      '../app/reinitialisation/page.tsx',
      '../app/login/page.tsx',
      '../app/inventaire/page.tsx',
      '../app/open/page.tsx',
    ]) {
      expect(lire(page), `${page} doit rester hors de la coquille`).not.toContain('<AppShell')
    }
  })

  it('les onglets passent vraiment à la ligne sur écran étroit', () => {
    // `flex: 1` (base 0) l'emportait sur `width: 100%` : les onglets ne
    // passaient jamais à la ligne, ils s'écrasaient à droite de l'avatar et
    // il n'en restait qu'un, coupé. Le `flex: none` est le correctif.
    const bloc = css.split('@media (max-width: 900px)').pop() ?? ''
    expect(bloc).toContain('.appbar-tabs { order: 3; flex: none; width: 100%')
  })
})

describe('l’onglet Set up tient en deux volets', () => {
  // Demande de Julien, 21 août 2026 : « deux sections qui collapsent, une
  // Zone de comptage pour la partie balise et une Données d'inventaire pour
  // la partie fichiers. L'idée est d'épurer cette page trop chargée. »
  const setup = lire('../components/dashboard/tabs/SetupTab.tsx')
  const volet = lire('../components/ui/Volet.tsx')

  it('porte les deux sections, aux mots de Julien', () => {
    expect(setup).toContain('titre="Zone de comptage"')
    expect(setup).toContain('titre="Données d’inventaire"')
  })

  it('ne s’ouvre jamais tout seul', () => {
    // Décision explicite : « Pas d'ouverture auto, reste collapsés. Même en
    // mode sans balise. » Un `open` conditionnel réintroduirait exactement ce
    // qui a été écarté.
    expect(volet).toContain('<details className="volet">')
    expect(volet).not.toMatch(/<details[^>]*\bopen\b/)
    expect(setup).not.toMatch(/<Volet[^>]*\bopen\b/)
  })

  it('dit ce qu’il y a dedans sans qu’on ouvre', () => {
    // C'est ce qui sépare « replié » de « caché » : sans le résumé ni la
    // pastille, il faudrait ouvrir chaque volet pour savoir où on en est.
    expect(setup).toContain('resumeZones')
    expect(setup).toContain('resumeFichiers')
    expect(setup).toContain("libelle: 'Prêt'")
    expect(setup).toContain("libelle: 'À faire'")
    expect(volet).toContain('volet-resume')
    expect(volet).toContain('volet-pastille')
  })

  it('utilise `details`, pas un état React', () => {
    // Le clavier, le lecteur d'écran et la recherche dans la page marchent
    // sans qu'on ait à les rebrancher.
    expect(volet).toContain('<details')
    expect(volet).toContain('<summary>')
  })

  it('ne laisse plus de chevron en caractère', () => {
    const css = lire('../app/globals.css')
    expect(css).not.toContain("content: '▸'")
    expect(volet).toContain('ChevronBas')
  })
})

describe('« Commencer l’inventaire » conclut la page, il ne l’ouvre pas', () => {
  // Julien, 25 août 2026, test réel sur « Fwee » — fichier importé, balises
  // renseignées : « placer bouton commencer l'inventaire en bas. Le mettre en
  // haut est perturbant et on ne sait pas quoi faire après. »
  const setup = lire('../components/dashboard/tabs/SetupTab.tsx')

  it('vient après les deux volets, pas avant', () => {
    const demarrage = setup.indexOf('<Demarrage')
    const fichiers = setup.indexOf('titre="Données d’inventaire"')
    const zones = setup.indexOf('titre="Zone de comptage"')
    expect(demarrage).toBeGreaterThan(fichiers)
    expect(demarrage).toBeGreaterThan(zones)
  })

  it('reste hors des volets', () => {
    // L'autre moitié de la règle du 21 août : une action ne doit jamais se
    // retrouver derrière une section fermée. En dessous n'est pas dedans.
    const corps = setup.slice(setup.indexOf('<Volet'), setup.indexOf('<Demarrage'))
    expect(corps).not.toContain('<Demarrage')
  })

  it('dit ce qui vient après le démarrage', () => {
    // La seconde moitié du constat : un bouton qui disparaît une fois pressé
    // laisse sans réponse la question « et maintenant ? ».
    expect(setup).toContain('L’inventaire est en cours')
    expect(setup).toContain('Suivre l’avancement')
    expect(setup).toContain('onOpenSuivi')
    expect(lire('../app/dashboard/[sessionId]/page.tsx')).toContain("onOpenSuivi={() => selectTab('suivi')}")
  })

  it('dit aussi ce qui manque encore', () => {
    // Sans référentiel, le bouton ne part pas : l'écran nomme le fichier à
    // charger plutôt que de laisser deviner pourquoi il refuse.
    expect(setup).toContain('Il reste une chose à faire')
    expect(setup).toContain('disabled={!pret || starting}')
  })
})

describe('les boutons des boutiques d’applications', () => {
  // Demande de Julien, 21 août 2026 : « ajoute les logos liés vers les
  // plateformes de téléchargement de l'app même si ce n'est pas encore en
  // ligne […] note-toi qu'il faudra le faire, très important ».
  const stores = lire('../lib/appStores.ts')
  const badges = lire('../components/StoreBadges.tsx')

  it('figurent sur l’écran « ordinateur requis »', () => {
    expect(shell).toContain('<StoreBadges />')
    expect(badges).toContain('l’App Store')
    expect(badges).toContain('Google Play')
  })

  it('les adresses ne vivent qu’à un seul endroit', () => {
    // Le jour de la publication, un seul fichier change. Un lien écrit en
    // dur dans le composant se retrouverait oublié.
    expect(badges).toContain("from '@/lib/appStores'")
    expect(badges).not.toMatch(/https:\/\/(apps\.apple|play\.google)/)
  })

  it('disent la vérité tant que l’application n’est pas publiée', () => {
    // Tant que PUBLIEE vaut faux, les liens ouvrent la recherche de chaque
    // boutique — jamais une fiche qui n'existe pas — et l'écran l'annonce.
    expect(stores).toContain('export const PUBLIEE')
    if (/export const PUBLIEE = false/.test(stores)) {
      expect(stores).toContain('search?term=')
      expect(stores).toContain('store/search?q=')
      expect(badges).toContain('arrive bientôt')
    }
  })

  it('ne reprennent pas les images de marque d’Apple et de Google', () => {
    // Leurs badges officiels sont soumis à leurs chartes : les nôtres sont
    // dessinés, en SVG. Et jamais d'emoji.
    expect(badges).toContain('<svg')
    expect(badges).not.toContain('<img')
  })

  it('ouvrent la boutique dans un nouvel onglet, sans fuite de référent', () => {
    expect(badges).toContain('rel="noopener noreferrer"')
  })
})

describe('le logo', () => {
  const logo = lire('../components/Logo.tsx')

  it('porte un dégradé identifiable par instance', () => {
    // Un identifiant SVG est unique dans la page. La barre et l'écran
    // « ordinateur requis » posent deux logos : avec le même identifiant, le
    // second perd son fond dès que le premier disparaît.
    expect(logo).toContain('gradientId')
    expect(shell).toContain('gradientId="qbg-ordinateur"')
  })
})

describe('« Mon compte » ne parle plus que de la personne', () => {
  it('ne porte plus les inventaires, les magasins ni l’équipe', () => {
    // C'étaient les doublons et le fourre-tout dénoncés : chacun a son écran.
    expect(compte).not.toContain('getMySessions')
    expect(compte).not.toContain('getMyStores')
    expect(compte).not.toContain('getTeamMembers')
    expect(compte).not.toContain('AddCounter')
    expect(compte).not.toContain('BaliseSheetPanel')
  })

  it('garde l’identité, la sécurité et les données', () => {
    expect(compte).toContain('Mes informations')
    expect(compte).toContain('MfaPanel')
    expect(compte).toContain('export_my_data')
  })

  it('permet de corriger son nom et de changer son mot de passe', () => {
    // Deux capacités que la maquette promettait et que le premier jet avait
    // laissées de côté : sans elles, changer de mot de passe imposait de se
    // déconnecter et de passer par « mot de passe oublié ».
    expect(compte).toContain('Modifier mon nom')
    expect(compte).toContain('Changer mon mot de passe')
    expect(compte).toContain('auth.updateUser')
    // Les règles de mot de passe viennent du module partagé, pas d'une
    // vérification réécrite ici.
    expect(compte).toContain('passwordError')
    expect(compte).toContain('PasswordRules')
    expect(compte).toContain('friendlyPasswordError')
  })
})

describe('le tarif des magasins', () => {
  const fiche = lire('../app/admin/entreprise/[companyId]/page.tsx')
  const migration = lire('../../supabase/migrations/20260821190001_tarif_par_magasin_et_revenu.sql')

  it('se pose par magasin, pas par entreprise', () => {
    // La licence est par magasin, au volume de stock : le tarif appartient
    // au magasin.
    expect(migration).toContain('alter table public.stores')
    expect(migration).toContain('annual_price_cents')
  })

  it('se modifie depuis la fiche de l’entreprise, par une RPC gardée', () => {
    expect(fiche).toContain("rpc('admin_set_store_price'")
    expect(migration).toMatch(/revoke all on function public\.admin_set_store_price\(uuid, integer\) from public, anon/)
  })

  it('journalise chaque changement de tarif', () => {
    // C'est de l'argent : la trace suit la même règle que les autres
    // actions d'administration.
    const corps = migration.split('function public.admin_set_store_price(')[1]?.split('$$;')[0] ?? ''
    expect(corps).toContain('log_admin_action')
    expect(corps).toContain('is_admin()')
  })
})

describe('les écrans déplacés', () => {
  it('les magasins et leurs codes ont leur page', () => {
    const magasins = lire('../app/magasins/page.tsx')
    expect(magasins).toContain('getMyStores')
    expect(magasins).toContain('join_code')
  })

  it('les balises rejoignent la boîte à outils, sans dupliquer leur logique', () => {
    const outils = lire('../app/outils/page.tsx')
    expect(outils).toContain('BaliseSheetPanel')
    // La série se calcule dans un seul module, partagé avec l'onglet Set up.
    expect(outils).not.toContain('BALISE_FORMATS')
  })

  it('l’équipe range les compteurs par magasin', () => {
    const equipe = lire('../app/equipe/page.tsx')
    expect(equipe).toContain("rpc('my_team_by_store')")
    expect(equipe).toContain('Compteurs · ')
  })
})

describe('le tableau de bord Quantinvo', () => {
  const tdb = lire('../app/admin/page.tsx')

  it('n’affiche pas deux fois le même chiffre', () => {
    // « Inventaires ce mois-ci » en tête et « Inventaires lancés » plus bas
    // donnaient le même nombre : c'est le doublon que la refonte combat.
    // Une occurrence pour le type, une pour le rendu — pas davantage.
    const occurrences = (tdb.match(/sessions_month/g) ?? []).length
    expect(occurrences, 'sessions_month ne doit être rendu qu’une fois').toBe(2)
    // Les magasins actifs restent visibles, en note de « Magasins sous
    // licence » plutôt qu'en tuile séparée : c'est la même famille d'idée.
    expect(tdb).toContain('active_stores_month')
    expect(tdb).toContain('compté ce mois')
  })

  it('ne calcule aucun montant dans la page : il vient de la base', () => {
    // Le revenu est affiché (décision du 21 août 2026), mais il doit sortir
    // de stores.annual_price_cents via admin_business_overview — jamais d'un
    // tarif écrit en dur ici, qui mentirait dès le premier client réel.
    const codeSeul = tdb
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(tdb).toContain('arr_cents')
    // Le panier moyen (3 700 € depuis le regonflement fiscal du 21 août 2026)
    // vit dans admin_business_overview, jamais ici.
    expect(codeSeul).not.toMatch(/3\s?700/)
    expect(codeSeul).not.toMatch(/370000/)
    expect(codeSeul).not.toMatch(/14\s?800/)
  })

  it('annonce ce qui n’est qu’estimé', () => {
    // Un magasin sans tarif négocié compte pour le panier moyen : la carte
    // doit le dire, sinon le chiffre passe pour exact.
    expect(tdb).toContain('priced_stores')
    expect(tdb).toContain('estimé')
  })
})

describe('un superviseur gère vraiment son équipe', () => {
  // Reproche de Julien, 21 août 2026 : « comment un superviseur est-il
  // supposé gérer son équipe s'il ne peut pas retirer un membre ! » La
  // maquette montrait un « Retirer » sur chaque ligne ; le premier jet le
  // réservait à l'administrateur d'entreprise.
  const equipe = lire('../app/equipe/page.tsx')
  const migration = lire('../../supabase/migrations/20260821200001_superviseur_gere_son_equipe.sql')

  it('le bouton Retirer n’est réservé à personne', () => {
    const bloc = equipe.split('Compteurs · ')[1]?.split('Invitations en cours')[0] ?? ''
    expect(bloc).toContain('>Retirer du magasin</button>')
    // Amendé le 22 août 2026 : la ligne porte désormais une seconde action,
    // « Supprimer le compte », qui elle est réservée à l'administrateur
    // d'entreprise. La garde porte donc sur ce qui précède : le retrait d'un
    // magasin, lui, ne doit être conditionné à aucun rôle.
    const avantLaSuppression = bloc.split('{estAdmin && (')[0]
    expect(avantLaSuppression).toContain('remove_counter_from_store')
    expect(avantLaSuppression, 'le retrait ne doit pas être conditionné au rôle').not.toContain('estAdmin')
  })

  it('le retrait vise UN magasin, pas tous', () => {
    // Un compteur présent dans deux magasins supervisés par deux personnes
    // ne doit pas disparaître des deux d'un seul clic.
    // La page passe par l'assistant appliquer(), qui enveloppe supabase.rpc.
    expect(equipe).toContain("'remove_counter_from_store'")
    expect(equipe).toContain('p_store_id: s.id')
  })

  it('un superviseur annule l’invitation qu’il a envoyée', () => {
    expect(equipe).toContain('cancel_my_invitation')
  })

  it('la base vérifie que le magasin est bien le sien', () => {
    const corps = migration.split('function public.remove_counter_from_store(')[1]?.split('$$;')[0] ?? ''
    expect(corps).toContain('store_supervisors')
    expect(corps).toContain('is_company_admin')
    expect(corps).toContain('Vous ne pouvez pas vous retirer vous-même')
    expect(corps).toContain('log_company_action')
  })

  it('l’annulation ne porte que sur ses propres invitations', () => {
    const corps = migration.split('function public.cancel_my_invitation(')[1]?.split('$$;')[0] ?? ''
    expect(corps).toContain('created_by = v_uid')
  })

  it('anon n’atteint ni l’un ni l’autre', () => {
    expect(migration).toMatch(/revoke all on function public\.remove_counter_from_store\(uuid, uuid\) from public, anon/)
    expect(migration).toMatch(/revoke all on function public\.cancel_my_invitation\(uuid\) from public, anon/)
  })
})
