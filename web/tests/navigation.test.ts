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
  '../app/inventaires/page.tsx',
  '../app/dashboard/new/page.tsx',
  '../app/dashboard/[sessionId]/page.tsx',
  '../app/equipe/page.tsx',
  '../app/messages/page.tsx',
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
    // Le rail n'a pas la place du libellé « ← retour au site » : le logo
    // porte la destination en title, comme les onglets portent la leur.
    expect(shell).toContain('title="Retour au site Quantinvo"')
  })

  it('porte le nom, l’entreprise ET le rôle, ensemble', () => {
    // « Entreprise C » seul ne dit pas ce qu'on y fait ; le rôle seul ne dit
    // pas où. Le rail n'affiche que l'avatar : les deux se lisent ensemble en
    // tête de son menu.
    expect(shell).toContain('who-menu-nom')
    expect(shell).toContain('who-menu-role')
    expect(shell).toContain('companyName')
    expect(shell).toContain('roleLisible')
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
    expect(shell).toContain('className="app-rail"')
    expect(shell).toContain('className="app-main"')
    expect(css).not.toContain('.app-main-wide')
    expect(css).not.toContain('.app-rail-wide')
  })

  it('les onglets du rail sont des tracés nommés, jamais des caractères', () => {
    // Règle du projet : icônes dessinées, jamais de caractère ni d'emoji.
    // Et un rail d'icônes muettes serait illisible : chaque onglet porte son
    // nom en `title` et `aria-label`.
    const codeSeul = shell
      .split('\n')
      .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(codeSeul).not.toContain('▾')
    expect(codeSeul).toContain('IconeOnglet')
    expect(codeSeul).toContain('title={o.label}')
    expect(codeSeul).toContain('aria-label={o.label}')
  })

  it('se referme au clic ailleurs et à Échap', () => {
    expect(shell).toContain("addEventListener('mousedown'")
    expect(shell).toContain("'Escape'")
  })

  it('s’allume sur les sous-pages d’un espace', () => {
    // L'onglet « Inventaires » reste allumé pendant qu'on travaille dans un
    // inventaire — or ses sous-pages vivent sous /dashboard/<id> alors que la
    // liste vit sur /inventaires : la correspondance est écrite en clair.
    expect(shell).toContain("o.href === '/inventaires' && pathname.startsWith('/dashboard/')")
    // /admin garde son exception : il ne s'allume pas sur /admin/entreprises.
    expect(shell).toContain("o.href !== '/admin'")
    // Et « Tableau de bord » ne s'allume que sur le tableau de bord lui-même.
    expect(shell).toContain("o.href !== '/dashboard'")
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

  it('porte le retour vers la liste au-dessus du titre', () => {
    // Piste A validée sur maquette (25 août 2026) : le lien nomme sa
    // destination, au-dessus du titre — et depuis le 30 août 2026 la liste
    // vit sur /inventaires, plus sur /dashboard.
    expect(page).toContain('<Link href="/inventaires" className="retour-liste">')
    expect(page.indexOf('retour-liste')).toBeLessThan(page.indexOf('className="page-title"'))
  })
})

describe('les onglets suivent le rôle', () => {
  const onglets = shell.split('export function ongletsPour')[1]?.split('\n}\n')[0] ?? ''

  it('l’administrateur Quantinvo a ses trois écrans', () => {
    expect(onglets).toContain("'/admin'")
    expect(onglets).toContain("'/admin/entreprises'")
    expect(onglets).toContain("'/admin/console'")
  })

  it('le superviseur ouvre sur son tableau de bord, la liste juste derrière', () => {
    // Décision de Julien, 30 août 2026 : /dashboard est l'atterrissage, la
    // liste complète vit sur /inventaires. Le premier onglet dit ce pour quoi
    // on ouvre le site. La comparaison porte sur la branche du superviseur
    // seule : celle de l'administrateur la précède et porte un autre ordre.
    // [2] et non [1] : le premier `return [` est celui de l'administrateur.
    const superviseur = onglets.split('profile.is_company_admin')[1]?.split('return [')[2] ?? ''
    const i = superviseur.indexOf("'/dashboard'")
    const j = superviseur.indexOf("'/inventaires'")
    const k = superviseur.indexOf("'/equipe'")
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeLessThan(j)
    expect(j).toBeLessThan(k)
  })

  it('l’administrateur d’entreprise ouvre sur son entreprise', () => {
    // Sa barre est celle d'une console : l'état de l'entreprise d'abord, les
    // inventaires en quatrième — ils sont le travail de ses superviseurs.
    const admin = onglets.split('profile.is_company_admin')[1]?.split('return [')[0] ?? ''
    expect(onglets).toContain('is_company_admin')
    expect(admin + onglets).toContain("'/entreprise'")
    expect(admin + onglets).toContain("'/journal'")
    const branche = onglets.split("if (profile.is_company_admin)")[1]?.split(']')[0] ?? ''
    // Ses « Inventaires » mènent à la liste : le tableau de bord de
    // /dashboard est celui d'un superviseur, lui a le sien sur /entreprise.
    expect(branche.indexOf("'/entreprise'")).toBeLessThan(branche.indexOf("'/inventaires'"))
    expect(branche).not.toContain("'/dashboard'")
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
    expect(bloc, 'le rail et le contenu sont masqués sous 720 px').toContain('.app-rail, .app-main, .dash { display: none; }')
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

  it('le contenu prend la page, du rail au bord', () => {
    // Deux constats de Julien sur les premiers rendus : la colonne de
    // 1120 px de l'ancienne barre laissait des marges mortes, puis le
    // plafond de 1400 px les recrÃ©ait sur un grand Ã©cran. Pas de plafond ;
    // le rail est fixe, le contenu commence aprÃ¨s lui, jamais dessous.
    expect(css).toContain('.app-rail {')
    expect(css).toContain('position: fixed; top: 0; bottom: 0; left: 0;')
    expect(css).toContain('margin: 0 0 0 var(--rail-l);')
    expect(css).not.toContain('--main-l')
  })

  it('le tableau de bord tient dans l’écran, comme la maquette', () => {
    // Une colonne pleine hauteur ; la rangée des graphiques absorbe le
    // surplus (les barres sont en pourcentages). min-height, pas height :
    // une petite fenêtre rend la main au défilement.
    expect(css).toContain('.tb-plein { min-height: calc(100vh - 40px); display: flex; flex-direction: column; }')
    expect(css).toContain('.tb-graphes { flex: 1;')
    expect(lire('../app/dashboard/page.tsx')).toContain('className="tb-plein"')
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

  it('emmène sur Suivi une fois l’inventaire lancé', () => {
    // « Cliquer sur commencer l'inventaire doit ramener sur la page suivi »
    // (Julien, 25 août 2026). La préparation est finie : on n'a plus rien à
    // faire sur Set up. Après `onChanged`, pour que Suivi s'ouvre à jour.
    const corps = setup.slice(setup.indexOf('async function start()'), setup.indexOf('async function run('))
    expect(corps).toContain('onOpenSuivi()')
    expect(corps.indexOf('await onChanged()')).toBeLessThan(corps.indexOf('onOpenSuivi()'))
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

  it('figurent aussi à la fin de /bienvenue', () => {
    // C'est le seul moment du parcours où la personne est sur son téléphone
    // sans l'application : elle vient de choisir son mot de passe. Les badges
    // étaient à un clic de plus, sur /open, derrière un lien qui ne mène
    // quelque part que si l'application est DÉJÀ installée.
    const bienvenue = lire('../app/bienvenue/page.tsx')
    expect(bienvenue).toContain('<StoreBadges />')
    // « Ouvrir l'application » reste l'action première : tant que l'app n'est
    // pas publiée, un badge mène à une recherche qui ne trouve rien.
    expect(bienvenue).toMatch(/btn btn-primary btn-block">Ouvrir l&apos;application/)
    // Et rien ne renvoie vers le web : un compteur y trouverait « Mon compte »,
    // que l'espace connecté referme sous 720 px.
    expect(bienvenue).not.toContain('Continuer sur le web')
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
    // Depuis le 30 août 2026, le trio d'usage vit sur /admin/usage (décision
    // de Julien) : /admin ne garde le champ que dans son type, et c'est la
    // page Usage qui le rend — une seule fois.
    const occurrences = (tdb.match(/sessions_month/g) ?? []).length
    expect(occurrences, 'sessions_month ne se rend plus sur /admin').toBe(1)
    expect(lire('../app/admin/usage/page.tsx')).toContain('Inventaires lancés ce mois-ci')
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


describe('les deux passes ont la même couleur dans l’app et sur le site', () => {
  // Compter est en accent, auditer en or. L'or n'est pas un jeton de palette
  // mais une couleur de MODE : la même valeur dans les deux thèmes, et la même
  // des deux côtés du produit. Les faire diverger, c'est apprendre deux fois
  // la même chose à la même personne.
  const css = lire('../app/globals.css')
  const app = lire('../../src/constants/colors.ts')

  it('l’or du bouton Auditeur est celui de l’app', () => {
    expect(app).toContain("AUDIT_COLOR = '#FFC349'")
    expect(app).toContain("AUDIT_ON = '#1A1A1A'")
    expect(css).toContain('.btn-auditeur { background: #FFC349; color: #1A1A1A; }')
  })

  it('le bouton Compteur suit l’accent du thème, comme dans l’app', () => {
    expect(css).toContain('.btn-compteur { background: var(--accent); color: var(--on-accent); }')
  })

  it('⚠️ et « Retenir » n’est plus un aplat d’accent', () => {
    // Sinon deux boutons identiques dans la même rangée pour deux gestes
    // différents : « Compteur » et « Retenir ».
    const ecran = lire('../components/dashboard/tabs/EcartsTab.tsx')
    expect(ecran).not.toContain('btn btn-primary btn-sm')
  })
})

describe('le héros plein écran et la parallaxe des pages vitrines', () => {
  const css = lire('../app/globals.css')
  const accueil = lire('../app/page.tsx')
  const chrome = lire('../components/SiteChrome.tsx')
  const parallaxe = lire('../components/Parallaxe.tsx')

  it('le héros de l’accueil occupe le premier écran, et lui seul', () => {
    expect(accueil).toContain('className="hero hero-plein"')
    expect(css).toContain('min-height: calc(100vh - 64px)')
    // Les pages intérieures gardent leur bande d'introduction : on vient y lire.
    expect(lire('../app/pourquoi-nous-choisir/page.tsx')).not.toContain('hero-plein')
    expect(lire('../app/inventaire/page.tsx')).not.toContain('hero-plein')
  })

  it('l’indice de défilement mène à la première section', () => {
    // Un héros plein écran sans indice laisse croire que la page s'arrête là.
    expect(accueil).toContain('className="scroll-cue" href="#rythmes"')
    expect(accueil).toContain('id="rythmes"')
  })

  it('la parallaxe est montée par l’en-tête commun, comme les apparitions', () => {
    expect(chrome).toContain('<Parallaxe />')
    expect(chrome).toContain('<RevealObserver />')
  })

  it('elle respecte la préférence de réduction des animations', () => {
    expect(parallaxe).toContain('prefers-reduced-motion')
    // Et les animations CSS du décor s'éteignent avec elle.
    expect(css).toContain('.flotte, .flotte-lent, .scroll-cue svg { animation: none; }')
  })

  it('⚠️ la racine se rogne en clip, jamais en hidden', () => {
    // `overflow-x: hidden` ferait de la racine un conteneur de défilement :
    // l'en-tête sticky s'ancrerait dessus et cesserait de coller. Vu sur la
    // maquette du 30 août 2026 — ne pas « corriger » le clip.
    expect(css).toContain('overflow-x: clip')
    expect(css).not.toContain('html { scroll-behavior: smooth; overflow-x: hidden; }')
  })

  it('les couches de décor sont inertes au doigt et invisibles aux lecteurs d’écran', () => {
    expect(css).toContain('.plx { position: absolute; pointer-events: none;')
    for (const page of ['../app/page.tsx', '../app/pourquoi-nous-choisir/page.tsx', '../app/inventaire/page.tsx']) {
      const src = lire(page)
      for (const m of src.matchAll(/className="plx [^"]*"[^>]*/g)) {
        expect(m[0], `${page} : chaque couche porte aria-hidden`).toContain('aria-hidden="true"')
      }
    }
  })
})

describe('le tableau de bord d’atterrissage du superviseur', () => {
  const page = lire('../app/dashboard/page.tsx')
  const liste = lire('../app/inventaires/page.tsx')
  const migration = lire('../../supabase/migrations/20260830090001_tableau_de_bord_superviseur.sql')

  it('agrège sur le serveur, jamais au navigateur', () => {
    // La règle de tenue en charge : pas de `select` sur counts côté client.
    expect(page).toContain("rpc('tableau_de_bord_superviseur'")
    expect(page).not.toContain("from('counts')")
  })

  it('⚠️ l’écart suit la même règle que le rapport', () => {
    // Deux écrans qui montrent le même chiffre doivent le calculer pareil —
    // leçon du 22 août 2026. La fonction reprend mot pour mot la préférence
    // du rapport : arbitrage > audit > comptage.
    expect(migration).toContain('coalesce(a.final_qty, a.qty_pass2, a.qty_pass1, 0)')
    // Et l'univers du rapport : théorique ∪ compté.
    expect(migration).toContain('from public.theoretical_stock t')
  })

  it('la liste complète vit derrière « Tout voir »', () => {
    expect(page).toContain('href="/inventaires"')
    expect(liste).toContain('function InventairesPage')
    // Le bouton « + Nouvel inventaire » ne se masque JAMAIS — il est sur les
    // deux écrans.
    expect(page).toContain('Nouvel inventaire')
    expect(liste).toContain('Nouvel inventaire')
  })

  it('les contrôles des graphiques sont de vrais boutons', () => {
    // Une maquette peut dessiner des div ; l'écran, non.
    expect(page).toContain('type="button"')
    expect(page).not.toContain('className="tb-segmente"><span')
  })

  it('un mois précédent à zéro n’invente pas de pourcentage', () => {
    // La règle vit dans la pièce commune des tableaux de bord.
    expect(lire('../components/dashboard/TableauDeBord.tsx')).toContain('precedent > 0')
  })

  it('la fonction repose ses droits dans la même migration', () => {
    // `create or replace` rend EXECUTE à PUBLIC — leçon de
    // `get_session_activity`.
    expect(migration).toContain('revoke execute on function public.tableau_de_bord_superviseur(date) from public, anon;')
  })
})

/**
 * Les montants du tableau de bord tiennent dans leur tuile (3 septembre 2026).
 *
 * Demande de Julien : « affiche les valeurs en k€ quand supérieur ou égal à
 * 1000, avec détail réel dans une bulle quand la souris passe au-dessus, pas
 * pour le nombre de pièces ».
 */
describe('les montants du tableau de bord s’abrègent', () => {
  const page = lire('../app/dashboard/page.tsx')
  const pieces = lire('../components/dashboard/TableauDeBord.tsx')

  it('les euros s’abrègent aux quatre endroits où ils s’affichent', () => {
    // Tuile de valeur, axe du diagramme, anneau, derniers inventaires.
    expect(page).toContain('valeur={moneyCourt(tb.valeur_mois)}')
    // Le zéro de l'axe s'écrit « 0 € », pas « 0,00 € » : une graduation de
    // base n'a pas besoin de centimes.
    expect(page).toContain("axe={(v, m) => (m !== 'valeur' ? nb(v) : v === 0 ? '0 €' : moneyCourt(v))}")
    expect(page).toContain("format={(v) => (mesureEcarts === 'valeur' ? moneyCourt(v) : nb(v))}")
    expect(page).toContain('{moneyCourt(d.valeur)}')
  })

  it('⚠️ LE CHIFFRE EXACT RESTE ATTEIGNABLE AU SURVOL', () => {
    // Une valeur arrondie qu'on ne peut pas déplier est une valeur fausse.
    expect(page).toContain('valeurExacte={`${money(tb.valeur_mois)} €`}')
    expect(page).toContain('refExact=')
    expect(page).toContain('formatExact=')
    expect(page).toContain('title={`${money(d.valeur)} €`}')
    // Et les composants partagés portent bien ces titres jusqu'au DOM.
    expect(pieces).toContain('title={valeurExacte}')
    expect(pieces).toContain('title={formatExact?.(a.brut)}')
    expect(pieces).toContain('<title>{formatExact(total)}</title>')
  })

  it('⚠️ les PIÈCES ne s’abrègent pas', () => {
    // Elles se comptent : « 12,8 k » n'est pas un nombre de pièces, c'est une
    // approximation d'inventaire — exactement ce qu'on ne fait pas ici.
    expect(page).toContain('valeur={nb(tb.pieces_mois)}')
    expect(page).not.toContain('moneyCourt(tb.pieces')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// UNE SECTION EST UNE SURFACE, PAS UNE MARGE (5 septembre 2026)
// ---------------------------------------------------------------------------
// Constat de Julien : « les sections se ressemblent toutes, je ne sais pas où
// regarder, on dirait une page brouillon ». La cause tenait en une ligne —
// `.admin-section` n'était que `margin-top: 44px`. Mesuré chez Qonto le même
// jour : chaque section y est une bande qui change de fond, avec 80 px de
// respiration, et un titre à 56 px sur un texte à 16 (rapport 3,5) quand le
// nôtre faisait 20 sur 15 (rapport 1,3).
// ═══════════════════════════════════════════════════════════════════════════
describe('une section est une surface, pas une marge', () => {
  const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')
  const bloc = (sel: string) => {
    const i = css.indexOf(sel + ' {')
    expect(i, `règle absente : ${sel}`).toBeGreaterThan(0)
    return css.slice(i, css.indexOf('}', i))
  }

  it('elle porte un fond, un cadre et sa respiration', () => {
    const s = bloc('.admin-section')
    expect(s).toContain('background: var(--surface)')
    expect(s).toContain('border: 1px solid var(--hairline)')
    expect(s).toMatch(/padding: \d+px \d+px/)
    // ⚠️ Et surtout : plus de `margin-top` nu. C'était TOUT ce que la règle
    // faisait, et c'est ce qui rendait cinq blocs indistinguables.
    expect(s).not.toMatch(/margin-top: 44px/)
  })

  it('chaque titre de section peut porter sa phrase', () => {
    expect(css).toContain('.section-note')
    // Elle est bornée : une explication qui court sur 1 400 px ne se lit pas.
    expect(bloc('.section-note')).toContain('max-width: 62ch')
  })

  it('l’échelle s’écarte assez pour se lire sans être lue', () => {
    const titre = bloc('.app-main .page-title')
    const m = titre.match(/font-size: (\d+)px/)
    expect(m).toBeTruthy()
    // 34 sur des titres de section à 19 : un rapport de 1,8 là où il valait 1,5.
    expect(Number(m![1])).toBeGreaterThanOrEqual(34)
    expect(bloc('.admin-section > h2')).toContain('font-size: 19px')
  })

  it('la page se met en deux colonnes plutôt que de s’étirer', () => {
    // ⚠️ ON NE REMET PAS DE max-width SUR .app-main : deux constats de Julien
    // l'ont fait retirer le 30 août, c'est une décision. La largeur se REMPLIT.
    expect(css).toContain('.fiche-colonnes')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 340px')
    // `max-width: none` est la TRACE de cette décision, pas une omission :
    // c'est ce que le 30 août a explicitement posé. Ce qu'on refuse, c'est
    // qu'une largeur contraignante y revienne.
    expect(bloc('.app-main')).toContain('max-width: none')
  })

  it('ce qui détruit sort des cartes', () => {
    const z = bloc('.zone-sensible')
    expect(z).toContain('border-top')
    expect(z).not.toContain('background: var(--surface)')
    // Elle n'est plus une `admin-section` sur la fiche magasin.
    const fiche = readFileSync(path.resolve(__dirname, '../app/magasins/[storeId]/page.tsx'), 'utf8')
    expect(fiche).toContain('<section className="zone-sensible">')
  })
})

describe('la barre publique : parcourir à gauche, agir à droite', () => {
  const chrome = readFileSync(path.resolve(__dirname, '../components/SiteChrome.tsx'), 'utf8')
  const actions = readFileSync(path.resolve(__dirname, '../components/HeaderActions.tsx'), 'utf8')
  const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

  it('les actions sont poussées à droite, la navigation reste au logo', () => {
    expect(chrome).toContain('<HeaderActions />')
    const i = css.indexOf('.header-actions {')
    expect(i).toBeGreaterThan(0)
    expect(css.slice(i, css.indexOf('}', i))).toContain('margin-left: auto')
  })

  it('elle porte DEUX rangs d’action, pas un seul', () => {
    // ⚠️ C'est le manque que la comparaison a rendu évident : la barre ne
    // portait que « Se connecter ». L'action commerciale principale — la
    // raison d'être des pages publiques — n'y était pas.
    expect(actions).toContain('Se connecter')
    expect(actions).toContain('Inscrire mon entreprise')
    expect(actions).toContain('btn btn-primary')
    // Et les deux ne coexistent pas une fois connecté.
    expect(actions).toContain('Mon espace')
  })

  it('« Accueil » ne double plus le logo', () => {
    expect(chrome).not.toContain('<Link href="/">Accueil</Link>')
  })
})
