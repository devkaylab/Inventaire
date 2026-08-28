// Formulaires publics : ce que l'écran ne doit plus savoir (constat M3).
//
// La fonction publique répond désormais la même chose quel que soit le cas —
// code magasin inconnu, compte déjà existant, demande en cours, création. Le
// nom du magasin a disparu de la réponse, parce qu'il confirmait à lui seul la
// validité du code. Ces tests empêchent de le réintroduire côté écran, et
// figent la formulation conditionnelle qui rend la réponse uniforme tenable.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const superviseur = lire('../app/superviseur/page.tsx')

// ── Lire la définition QUI FAIT FOI, pas celle d'un fichier choisi ──────────
//
// ⚠️ C'est le point de ce garde-fou, et il vient d'un vrai défaut. Les autres
// tests du dépôt lisent une migration nommée en dur. Or une fonction se
// redéfinit : `submit_company_request` a perdu sa limitation de débit le
// 21 août 2026 parce que deux migrations l'ont réécrite en entier sans
// recopier le bloc, et rien ne lisait ces migrations-là. Un test qui pointe un
// fichier ne voit pas ce qu'une migration ultérieure a défait.
//
// On prend donc la DERNIÈRE migration qui définit la fonction — celle qui
// décrit ce qui tourne réellement en base.
const dossierMigrations = path.resolve(__dirname, '../../supabase/migrations')

function derniereDefinition(fn: string): { fichier: string; corps: string } {
  // `create or replace`, pas seulement `function` : un `drop function if
  // exists` porte le même nom et vient parfois après la création.
  const marqueur = `create or replace function public.${fn}(`
  const fichiers = readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort().reverse()

  for (const fichier of fichiers) {
    const texte = readFileSync(path.join(dossierMigrations, fichier), 'utf8')
    if (!texte.includes(marqueur)) continue
    const apres = texte.slice(texte.lastIndexOf(marqueur))
    // Fin du corps : le délimiteur de chaîne, quel qu'il soit dans ce fichier.
    const fin = Math.min(
      ...['$function$;', '$$;'].map((d) => {
        const i = apres.indexOf(d)
        return i === -1 ? Number.POSITIVE_INFINITY : i
      }),
    )
    return { fichier, corps: apres.slice(0, fin) }
  }
  throw new Error(`Aucune migration ne définit ${fn}`)
}

describe('parcours public superviseur — éteint le 21 août 2026', () => {
  // Les accès superviseur sont ouverts par l'administrateur de l'entreprise
  // (/equipe). La page subsiste en explication : l'application mobile
  // installée partage encore cette adresse, la supprimer ferait un 404.
  it('ne collecte plus rien', () => {
    expect(superviseur).not.toContain('<form')
    expect(superviseur).not.toContain('MentionCollecte')
  })

  it('n’appelle plus aucune fonction de dépôt', () => {
    // C'est l'extinction de la surface publique : ni edge, ni RPC. Les
    // objets de base sont supprimés dans un second temps, une fois ce code
    // déployé — règle du projet, jamais l'inverse.
    expect(superviseur).not.toContain("invoke('submit-supervisor-request'")
    expect(superviseur).not.toContain("rpc('submit_supervisor_request'")
    expect(superviseur).not.toContain('supabase')
  })

  it('oriente vers l’administrateur de l’entreprise', () => {
    expect(superviseur).toContain('administrateur')
    expect(superviseur).toContain('Mon équipe')
  })
})

describe('fonctions edge du parcours éteint', () => {
  const edgeDepot = lire('../../supabase/functions/submit-supervisor-request/index.ts')
  const edgeValidation = lire('../../supabase/functions/invite-supervisor/index.ts')

  it('ne collectent plus et ne touchent plus la base', () => {
    // Les RPC qu'elles appelaient sont supprimées (migration 20260821140001) :
    // le point d'entrée subsiste en 410 le temps que les appels résiduels
    // s'éteignent, sans client Supabase ni envoi d'e-mail.
    for (const edge of [edgeDepot, edgeValidation]) {
      expect(edge).toContain('410')
      expect(edge).not.toContain('createClient')
      expect(edge).not.toContain('resend')
      expect(edge).not.toContain('.rpc(')
      expect(edge).not.toContain('Deno.env.get')
    }
  })
})

describe('le formulaire d’inscription est limité en débit', () => {
  // Régression du 21 août 2026, relevée le 28 : la fonction publique
  // `submit_company_request` — appelable **sans compte** — avait perdu les deux
  // verrous posés par le constat M3. Rétablie par 20260828120001.
  const { fichier, corps } = derniereDefinition('submit_company_request')

  it('garde les deux verrous, par adresse et par point de connexion', () => {
    expect(corps).toContain("rate_limit_ok('company_request', v_email, 5, interval '1 hour')")
    expect(corps).toContain("rate_limit_ok('company_request_ip', public.client_ip(), 20, interval '1 hour')")
  })

  it('compte AVANT de chercher l’adresse en base', () => {
    // La fonction répond différemment selon qu'elle connaît l'adresse ou non.
    // Placer le verrou après cette recherche laisserait interroger la base
    // autant qu'on veut : on ne serait freiné qu'une fois la réponse obtenue.
    const verrou = corps.indexOf('rate_limit_ok')
    const recherche = corps.indexOf('contact_email')
    // Les deux repères doivent exister : sans cette ligne, un corps qui a perdu
    // son verrou passerait le test (indexOf rend -1, et -1 est bien « avant »).
    expect(verrou).toBeGreaterThan(-1)
    expect(recherche).toBeGreaterThan(-1)
    expect(verrou).toBeLessThan(recherche)
  })

  it('repose les droits dans la même migration', () => {
    // `create or replace` rend EXECUTE à PUBLIC. Sans ces deux lignes, la
    // fonction ressort exécutable par tout le monde (leçon de 20260819172706).
    const migration = readFileSync(path.join(dossierMigrations, fichier), 'utf8')
    expect(migration).toContain('revoke all on function public.submit_company_request')
    expect(migration).toContain('grant execute on function public.submit_company_request')
  })
})

describe('le formulaire d’inscription borne ce qu’il accepte', () => {
  // Second volet du même constat (28 août 2026) : la fonction est appelable
  // sans compte, et le texte n'avait aucune borne — seuls le stock, la surface
  // et le nombre de magasins en avaient. Migration 20260828130001.
  const { fichier, corps } = derniereDefinition('submit_company_request')
  const migration = readFileSync(path.join(dossierMigrations, fichier), 'utf8')
  const inscription = lire('../app/inscription/page.tsx')

  it('refuse les cinq champs trop longs', () => {
    expect(corps).toContain('length(btrim(p_company_name)) > 80')
    expect(corps).toContain('length(btrim(p_first_name)) > 80')
    expect(corps).toContain('length(btrim(p_last_name)) > 80')
    expect(corps).toContain('length(v_email) > 254')
    expect(corps).toContain("length(btrim(coalesce(p_phone, ''))) > 30")
    expect(corps).toContain("length(btrim(coalesce(p_message, ''))) > 2000")
  })

  it('refuse plutôt que de tronquer', () => {
    // Le nom de l'entreprise devient `companies.name`, puis figure sur le devis
    // et sur la facture Stripe — des pièces datées. Une troncature silencieuse
    // y produirait un document faux.
    expect(corps).toContain("'Le nom de l''entreprise ne peut pas dépasser 80 caractères.'")
  })

  it('mesure AVANT de compter le quota', () => {
    // Une saisie trop longue ne doit pas consommer le quota de quelqu'un, au
    // même titre qu'une faute de frappe.
    expect(corps.indexOf('> 2000')).toBeLessThan(corps.indexOf('rate_limit_ok'))
  })

  it('pose la contrainte de table comme ceinture', () => {
    // La fonction est aujourd'hui le seul chemin ouvert à `anon` ; la
    // contrainte vaudra aussi pour la fonction qu'on écrira demain.
    expect(migration).toContain('company_requests_longueurs')
    expect(migration).toContain('length(company_name)        <= 80')
    expect(migration).toContain('length(message)             <= 2000')
  })

  it('borne les mêmes champs à l’écran', () => {
    // L'écran empêche, le serveur refuse. Sans le premier, quelqu'un qui colle
    // un long texte ne l'apprend qu'après avoir cliqué.
    expect(inscription).toMatch(/id="company"\s+maxLength=\{80\}/)
    expect(inscription).toMatch(/id="firstName" maxLength=\{80\}/)
    expect(inscription).toMatch(/id="lastName" maxLength=\{80\}/)
    expect(inscription).toMatch(/id="email"[^>]*maxLength=\{254\}/)
    expect(inscription).toMatch(/id="phone" maxLength=\{30\}/)
    expect(inscription).toContain('maxLength={2000}')
  })
})
