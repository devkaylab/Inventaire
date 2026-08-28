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
import { derniereDefinition, dossierMigrations } from './migrations'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const superviseur = lire('../app/superviseur/page.tsx')

// `derniereDefinition` vit dans ./migrations : stripe.test.ts s'en sert aussi.

/** Le code seul : les commentaires parlent de `outcome`, le code ne doit pas le rendre. */
const sansCommentaires = (sql: string) =>
  sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')

/** Le texte de toutes les migrations, pour ce qui n'est pas un corps de fonction. */
const toutesLesMigrations = readdirSync(dossierMigrations)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(path.join(dossierMigrations, f), 'utf8'))
  .join('\n')

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
  //
  // ⚠️ Le travail vit désormais dans `…_detailed` (20260828140001) : la surface
  // publique n'en est plus que l'enrobage. C'est là qu'il faut regarder.
  const { fichier, corps } = derniereDefinition('submit_company_request_detailed')

  it('garde les deux verrous, par adresse et par point de connexion', () => {
    expect(corps).toContain("rate_limit_ok('company_request', v_email, 5, interval '1 hour')")
    expect(corps).toContain("rate_limit_ok('company_request_ip', public.client_ip(), 20, interval '1 hour')")
  })

  it('compte AVANT de chercher l’adresse en base', () => {
    // La recherche par adresse ne renseigne plus personne depuis que la réponse
    // est uniforme, mais l'ordre reste le bon : on ne laisse pas interroger la
    // base autant qu'on veut avant de freiner.
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
  const { corps } = derniereDefinition('submit_company_request_detailed')
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
    expect(toutesLesMigrations).toContain('company_requests_longueurs')
    expect(toutesLesMigrations).toContain('length(company_name)        <= 80')
    expect(toutesLesMigrations).toContain('length(message)             <= 2000')
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

describe('le formulaire d’inscription répond la même chose', () => {
  // Troisième volet (28 août 2026, migration 20260828140001). La fonction
  // publique disait `{success:false, error:'Une demande est déjà en cours…'}`
  // pour une adresse connue et `{success:true, request_id}` sinon : on pouvait
  // lui demander si une adresse avait déjà parlé à Quantinvo.
  const publique = sansCommentaires(derniereDefinition('submit_company_request').corps)
  const detaillee = derniereDefinition('submit_company_request_detailed')
  const edge = lire('../../supabase/functions/submit-company-request/index.ts')

  it('ne laisse rien filtrer de l’issue', () => {
    expect(publique).toContain("'received', true")
    // Ni le motif, ni l'identifiant : un identifiant rendu à la création et pas
    // autrement serait une réponse aussi bavarde qu'une phrase.
    expect(publique).not.toContain('déjà en cours')
    expect(publique).not.toContain('request_id')
    expect(publique).not.toContain('outcome')
  })

  it('n’est qu’un enrobage — une seule implémentation', () => {
    // La duplication est ce qui a fait perdre la limitation de débit le
    // 21 août : l'enrobage APPELLE, il ne recopie pas.
    expect(publique).toContain('public.submit_company_request_detailed(')
    expect(publique).not.toContain('insert into public.company_requests')
  })

  it('garde les erreurs de saisie explicites', () => {
    // Elles ne parlent que de ce que la personne vient de taper, jamais du
    // contenu de la base.
    expect(publique).toContain("'success', false")
    expect(publique).toContain("v ->> 'error'")
  })

  it('réserve le détail au rôle serveur', () => {
    const migration = readFileSync(path.join(dossierMigrations, detaillee.fichier), 'utf8')
    expect(migration).toMatch(
      /revoke all on function public\.submit_company_request_detailed[\s\S]*?from public, anon, authenticated/,
    )
    expect(migration).not.toMatch(/grant execute on function public\.submit_company_request_detailed/)
  })

  it('la fonction edge lit le détail, et ne le rend pas', () => {
    // C'est elle qui écrit à l'adresse : le canal n'atteint que son
    // propriétaire. Mais elle ne doit pas rouvrir l'oracle un cran plus haut.
    expect(edge).toContain("rpc('submit_company_request_detailed'")
    expect(edge).toContain("result.outcome === 'request_pending'")
    expect(edge).not.toMatch(/json\(\{[^}]*outcome/)
  })
})
