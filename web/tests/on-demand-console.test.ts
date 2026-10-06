// La console On-Demand, et la coquille du tunnel — les gardes.
//
// Deux règles qui n'ont rien à voir l'une avec l'autre, et qui échouent toutes
// les deux en silence :
//
//   · le tunnel doit porter LA barre du site, pas une copie approchante —
//     constat de Julien, 20 septembre 2026 : « l'entête n'est déjà pas de la
//     même largeur ». Une barre à soi dérive au premier ajustement ;
//   · le matching ne doit écarter personne automatiquement — c'est l'article 22
//     du RGPD, et ça ne se voit pas à l'écran tant qu'un profil n'a pas été
//     injustement retiré d'une mission.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(--|\/\/).*$/gm, '')

describe('le tunnel porte la coquille du site', () => {
  const page = lire('components/vitrine/PageReserver.tsx')
  const css = lire('app/globals.css')

  /**
   * ⚠️ **LA BARRE EST `.site-header`, PAS UNE BARRE À ELLE.** Elle l'a été, et
   * ça s'est vu tout de suite : 1200 px centrés au lieu des deux bords de
   * l'écran, 24 px de marge au lieu de 40, un fond plat au lieu du fond flouté
   * et de son filet. La règle vient de Julien le 11 septembre 2026 — « l'en-tête
   * et le pied ne sont pas bridés à la largeur de lecture » — et la seule façon
   * de ne pas la reperdre est de REPRENDRE les classes, pas de les recopier.
   */
  it('la barre du tunnel est celle du site, aux classes près', () => {
    const code = sansCommentaires(page)
    expect(code).toContain('className="site-header"')
    expect(code).toContain('className="container inner"')
    // L'espaceur va avec : sous 780 px la barre passe en `fixed` et ne prend
    // plus sa place dans le flux.
    expect(code).toContain('className="site-header-espace"')
    // Et le comportement au défilement, qui vit dans un composant à part.
    expect(code).toContain('<EnTeteAuDefilement />')
  })

  it('le logo de la barre est à la taille du site', () => {
    const taille = lire('components/SiteChrome.tsx').match(/<Logo size=\{(\d+)\} \/>/)
    expect(taille, 'la coquille doit poser une taille de logo').toBeTruthy()
    expect(sansCommentaires(page)).toContain(`<Logo size={${taille![1]}} />`)
  })

  it('aucune géométrie de barre n’est redéfinie pour le tunnel', () => {
    // Ces trois propriétés sont celles qui avaient dérivé. Qu'elles
    // réapparaissent sur un sélecteur `.res-barre*`, et la barre redevient une
    // barre à part.
    const bloc = css.slice(css.indexOf('Réserver un inventaire — le tunnel On-Demand'))
    const geometrie = sansCommentaires(bloc)
      .split('\n')
      .filter((l) => /^\.res-barre/.test(l.trim()))
      .filter((l) => /max-width|height|backdrop-filter|position:\s*sticky/.test(l))
    expect(geometrie, geometrie.join('\n')).toEqual([])
  })

  it('le corps du tunnel garde la largeur de lecture du site', () => {
    expect(sansCommentaires(page)).toContain('className="container res-page"')
  })
})

describe('le matching propose, il n’écarte pas', () => {
  const { corps } = derniereDefinition('admin_candidats_mission')
  const sql = sansCommentaires(corps)

  /**
   * ⚠️ **ARTICLE 22 DU RGPD.** Un profil retiré d'une mission par un calcul
   * seul est une décision automatisée : il faut pouvoir l'expliquer et
   * permettre une intervention humaine. La fonction classe donc, et chaque
   * ligne porte sa raison.
   */
  it('chaque profil sort avec sa raison, et rien ne filtre sur le niveau', () => {
    expect(sql).toContain('as retenu')
    expect(sql).toContain('as pourquoi')
    // ⚠️ ON LIT LE `WHERE` ENTIER, PAS SA PREMIÈRE LIGNE. Première version de
    // cette garde : elle n'inspectait que la ligne commençant par `where`, et
    // un `and pp.niveau <> 'nouveau'` ajouté juste en dessous passait sans
    // bruit — vérifié en le sabotant. Le filtre d'une requête, c'est tout ce
    // qui va du `where` à la fin de la sous-requête.
    const debut = sql.lastIndexOf('\n    where ')
    const fin = sql.indexOf('\n  ) c;')
    expect(debut, 'la requête des candidats a changé de forme').toBeGreaterThan(0)
    expect(fin).toBeGreaterThan(debut)
    const filtre = sql.slice(debut, fin)
    // Le seul filtre autorisé écarte les gens DÉJÀ sur cette mission — jamais
    // des gens jugés moins bons.
    expect(filtre, `un filtre de qualité s'est glissé :${filtre}`)
      .not.toMatch(/niveau|score|\brang\b|paiements_ouverts|pp\.etat/)
    expect(filtre).toContain('public.mission_assignments')
  })

  it('un profil non retenu sort quand même de la fonction', () => {
    // ⚠️ `retenu` N'APPARAÎT QU'UNE FOIS, et c'est la garde : une seconde
    // occurrence, c'est forcément une condition — un `where retenu`, un
    // `having`, un `and retenu`. La compter vaut mieux que d'essayer de
    // reconnaître la forme d'un filtre : une expression qui cherche « where …
    // retenu » se trompe dans les deux sens, elle l'a fait ici même.
    const occurrences = (sql.match(/\bretenu\b/g) ?? []).length
    expect(occurrences, 'un filtre sur `retenu` s’est glissé dans la requête').toBe(1)
    const page = lire('app/admin/reservations/[id]/page.tsx')
    expect(page).toContain('Voir tout le monde')
  })

  it('aucune distance en kilomètres n’est inventée', () => {
    // Ni `stores` ni `provider_profiles` ne portent de coordonnées. Une colonne
    // « distance » ici serait forcément fabriquée.
    expect(sql).not.toMatch(/distance|km_/)
  })
})

describe('la console ne fait rien d’anonyme', () => {
  /**
   * ⚠️ Règle d'AGENTS.md : toute fonction `admin_*` journalise dans la même
   * transaction que son action, avec son test de garde. Une console qui affecte
   * des gens à des missions de nuit ne peut pas avoir de geste sans trace.
   */
  const ecrivent = [
    'admin_proposer_mission',
    'admin_retirer_de_la_mission',
    'admin_avancer_mission',
  ]

  for (const fn of ecrivent) {
    it(`${fn} garde et journalise`, () => {
      const { corps } = derniereDefinition(fn)
      const sql = sansCommentaires(corps)
      expect(sql, 'garde absente').toContain('if not public.is_admin() then')
      expect(sql, 'journal absent').toContain('public.log_admin_action(')
      // Le journal vient APRÈS l'action, dans la même transaction.
      expect(sql.indexOf('log_admin_action')).toBeGreaterThan(sql.indexOf('is_admin()'))
    })

    it(`${fn} a ses droits reposés`, () => {
      // ⚠️ `create or replace` rend EXECUTE à PUBLIC.
      const fichier = fichierDe(fn)
      expect(fichier).toMatch(
        new RegExp(`^revoke all on function public\\.${fn}\\([^)]*\\) from public, anon;`, 'm'))
    })
  }

  it('les lectures de la console n’ouvrent le coût qu’à un administrateur', () => {
    for (const fn of ['admin_missions', 'admin_mission']) {
      const { corps } = derniereDefinition(fn)
      const sql = sansCommentaires(corps)
      expect(sql, `${fn} rend le coût`).toMatch(/cout_cents/)
      expect(sql, `${fn} sans garde`).toContain('if not public.is_admin() then')
    }
  })

  /**
   * ⚠️ Une place de trop, c'est une personne payée que le client n'a pas
   * achetée. Et deux responsables sur place, c'est deux personnes qui
   * attribuent les mêmes zones.
   */
  it('on ne peut pas proposer plus de places que le prix n’en a vendues', () => {
    const sql = sansCommentaires(derniereDefinition('admin_proposer_mission').corps)
    expect(sql).toContain("'complete'")
    expect(sql).toContain("'deja_un_responsable'")
    expect(sql).toMatch(/v_pris >= v_places/)
  })

  /**
   * ⚠️ La machine d'état vit dans le déclencheur `missions_transition`. La
   * recopier dans la console donnerait deux vérités qui divergeraient.
   */
  it('la console ne recopie pas la machine d’état', () => {
    const sql = sansCommentaires(derniereDefinition('admin_avancer_mission').corps)
    expect(sql).not.toContain('transition_mission_permise')
    expect(sql).toContain('exception when check_violation')
  })

  it('retirer quelqu’un ferme son accès à l’inventaire du client', () => {
    const sql = sansCommentaires(derniereDefinition('admin_retirer_de_la_mission').corps)
    expect(sql).toContain('public.mission_access')
    expect(sql).toMatch(/expire_le = least\(expire_le, now\(\)\)/)
    // Et la ligne d'affectation reste, en `retiree` : un désistement est un
    // fait, et c'est lui qui explique une équipe redevenue incomplète.
    expect(sql).toContain("etat = 'retiree'")
    expect(sql).not.toMatch(/delete from public\.mission_assignments/)
  })
})

describe('⚠️ la console dit « réservations », la base dit `missions`', () => {
  /**
   * ⚠️⚠️ 6 octobre 2026. « Pourquoi tu me parles de mission ? » — relevé par
   * Julien dès le 5 : le client ne lit jamais ce mot, il voit « vos
   * inventaires ». La console parlait une autre langue que le produit, héritée
   * du modèle où l'on envoyait une équipe EN MISSION — modèle rangé à part le
   * 4 octobre.
   *
   * ⚠️ **LA TABLE NE BOUGE PAS.** La renommer ferait trente migrations, une
   * réécriture de chaque fonction `admin_*` et un risque pour un mot. La
   * frontière est donc : « réservation » dans ce qui s'affiche et dans
   * l'adresse, `missions` dans le SQL et les identifiants.
   */
  const ecrans = ['app/admin/reservations/page.tsx', 'app/admin/reservations/[id]/page.tsx']

  /** Ce que l'écran AFFICHE : hors commentaires, hors code. */
  const texteAffiche = (f: string) => {
    const brut = lire(f)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    // Les titres, les phrases et les libellés de boutons — pas les appels.
    return [
      ...brut.matchAll(/>([^<>{}]*[a-zà-ÿ]{3,}[^<>{}]*)</g),
      ...brut.matchAll(/'([^']*[a-zà-ÿ]{3,}[^']*)'/g),
    ]
      .map((m) => m[1])
      // ⚠️ Un chemin d'import n'est pas une phrase : `@/lib/missions` doit
      // rester tel quel, c'est le nom du module qui parle à la base.
      .filter((v) => !v.startsWith('@/') && !v.startsWith('./') && !v.startsWith('../'))
      .join(' | ')
  }

  it('⚠️ aucun écran de la console n’affiche encore « mission »', () => {
    const fautes: string[] = []
    for (const f of ecrans) {
      for (const m of texteAffiche(f).matchAll(/[^|]*\bmissions?\b[^|]*/gi)) {
        // `admin_avancer_mission` et consorts sont des noms de fonction, pas
        // des phrases : ils passent par `rpc('…')` et n'ont pas d'accent.
        if (/^[a-z_]+$/.test(m[0].trim())) continue
        fautes.push(`${f} → « ${m[0].trim().slice(0, 70)} »`)
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([])
  })

  it('l’adresse aussi, et l’ancienne redirige', () => {
    const nav = lire('components/AppShell.tsx')
    expect(nav).toContain("{ href: '/admin/reservations', label: 'Réservations' }")
    expect(nav, 'la navigation pointe encore sur l’ancienne adresse')
      .not.toContain("'/admin/missions'")
    // ⚠️ Ces adresses sont dans les signets de qui ouvre la console chaque
    // jour : les casser sans rien dire est gratuit et désagréable.
    const config = readFileSync(path.resolve(racine, 'next.config.mjs'), 'utf8')
    expect(config).toContain("source: '/admin/missions', destination: '/admin/reservations'")
    expect(config).toContain("source: '/admin/missions/:chemin*'")
  })

  it('⚠️ mais la base garde `missions` — on n’a pas renommé une table pour un mot', () => {
    // La console continue d'appeler les fonctions telles qu'elles s'appellent.
    const detail = lire('app/admin/reservations/[id]/page.tsx')
    expect(detail).toContain("rpc('admin_mission'")
    expect(detail).toContain("rpc('admin_avancer_mission'")

    // ⚠️ **ET SURTOUT : AUCUNE MIGRATION NE RENOMME LA TABLE.** C'est le vrai
    // risque — quelqu'un « finit le travail » six mois plus tard, et trente
    // fonctions, autant de policies et les réservations figées suivent.
    const dossier = path.resolve(racine, '..', 'supabase', 'migrations')
    const fautes: string[] = []
    for (const f of readdirSync(dossier).filter((n) => n.endsWith('.sql'))) {
      const sql = readFileSync(path.join(dossier, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
      if (/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?missions\s+rename/i.test(sql)) {
        fautes.push(f)
      }
    }
    expect(fautes, `une migration renomme la table : ${fautes.join(', ')}`).toEqual([])
  })

  it('⚠️ et l’icône n’est plus deux personnes', () => {
    // Elle disait « une équipe qui vient chez vous ». On n'envoie plus
    // personne depuis le 4 octobre : ce qui distingue On-Demand est une
    // fenêtre de sept jours.
    const nav = lire('components/AppShell.tsx')
    const bloc = nav.slice(nav.indexOf("case '/admin/reservations':"))
    const icone = bloc.slice(0, bloc.indexOf('</>)'))
    expect(icone, 'l’icône dessine encore des personnes').not.toContain('cx="9" cy="8"')
    expect(icone, 'l’icône n’est pas un calendrier').toContain('<rect')
  })
})
