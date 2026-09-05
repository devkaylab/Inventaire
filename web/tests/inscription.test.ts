/**
 * Le socle du parcours d'inscription : un compte de prospect (5 septembre 2026)
 *
 * ⚠️ CES GARDES PROTÈGENT LA RÉOUVERTURE DE L'AUTO-INSCRIPTION. Depuis le
 * 13 août 2026, `handle_new_user` refusait tout e-mail sans invitation — c'était
 * LE verrou qui protégeait le reste. Ce qui le remplace est un e-mail vérifié
 * par un code à six chiffres, et un profil qui ne voit rien. Chacune a été mise
 * en défaut par sabotage.
 *
 * Maquette : https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a
 */
import { describe, expect, it } from 'vitest'
import { derniereDefinition, fichierDe } from './migrations'

/** Toute assertion d'ABSENCE lit le SQL sans ses commentaires : ils citent
 *  forcément les mots qu'ils décrivent. Le piège s'est présenté cinq fois. */
/**
 * ⚠️ LES COMMENTAIRES D'ABORD, L'APLATISSEMENT ENSUITE. Aplatir en premier
 * efface les débuts de ligne, et le retrait des commentaires ne retire alors
 * plus rien — négations comme positives se liraient sur la documentation du
 * fichier, qui cite forcément les mots qu'elle décrit. Sixième variante de ce
 * piège sur ce dépôt.
 */
const code = (s: string) => s.replace(/^\s*--.*$/gm, ' ').replace(/\s+/g, ' ')

describe('le code à six chiffres est une barrière', () => {
  const demander = code(derniereDefinition('demander_code_email').corps)
  const verifier = code(derniereDefinition('verifier_code_email').corps)
  const tirage = code(derniereDefinition('tirer_code_a_six_chiffres').corps)

  it('sort d’un générateur cryptographique, qualifié par son schéma', () => {
    // ⚠️ Supabase installe pgcrypto dans `extensions`, et ces fonctions figent
    // `search_path` à 'public' : l'appel nu échoue à l'EXÉCUTION, pas à la
    // création — la migration passerait et la génération casserait au premier
    // essai. Leçon du 28 août 2026, payée une fois.
    expect(tirage).toContain('extensions.gen_random_bytes')
    expect(tirage).not.toMatch(/\brandom\(\)/)
  })

  it('ne subit pas le biais du modulo', () => {
    // 2^32 n'est pas un multiple de 10^6 : un `% 1000000` nu favoriserait les
    // codes les plus bas. Le reliquat est rejeté.
    expect(tirage).toContain('4294000000')
    expect(tirage).toContain('exit when')
  })

  it('n’est jamais stocké en clair', () => {
    expect(demander).toContain('extensions.crypt(v_code, extensions.gen_salt')
    expect(demander).not.toContain('code_hash = v_code')
    expect(demander).not.toContain('values (v_email, v_code')
  })

  it('vaut dix minutes, une seule fois, cinq essais', () => {
    expect(demander).toContain("interval '10 minutes'")
    // ⚠️ Avec la borne seule, `essais >= 5000` contient encore « essais >= 5 »
    // et le sabotage passait : on ancre sur la fin de la clause.
    expect(verifier).toContain('v_ligne.essais >= 5 then')
    expect(verifier).toContain('consomme_le is not null')
    expect(verifier).toContain('set consomme_le = now()')
  })

  it('compte l’essai AVANT de comparer', () => {
    // Un appel qui échouerait après la comparaison ne doit pas rendre l'essai
    // gratuit : cinq essais doivent coûter cinq essais.
    const i = verifier.indexOf('set essais = essais + 1')
    const j = verifier.indexOf('extensions.crypt(v_code')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(j)
  })

  it('compare par bcrypt, jamais par égalité de chaînes', () => {
    expect(verifier).toContain('extensions.crypt(v_code, v_ligne.code_hash) <> v_ligne.code_hash')
  })
})

describe('le formulaire ne devient pas un relais d’envoi', () => {
  const demander = code(derniereDefinition('demander_code_email').corps)

  it('borne à cinq envois par heure et par adresse', () => {
    expect(demander).toContain("rate_limit_ok('code_email', v_email, 5, interval '1 hour')")
  })

  it('⚠️ pose le quota APRÈS la saisie et AVANT la recherche par adresse', () => {
    // L'ordre EST le contrôle : une faute de frappe ne consomme pas le quota de
    // quelqu'un d'autre, et un script ne peut pas interroger la base à volonté
    // avant d'être freiné. Leçon du 28 août 2026 sur `submit_company_request`.
    const saisie = demander.indexOf('email_invalide')
    const quota = demander.indexOf('rate_limit_ok')
    const recherche = demander.indexOf('from auth.users')
    expect(saisie).toBeLessThan(quota)
    expect(quota).toBeLessThan(recherche)
  })

  it('rend le détail au seul rôle serveur — la réponse uniforme est à l’edge', () => {
    // Elle rend `compte_existant` : c'est un oracle, et c'est pour ça qu'elle
    // n'est PAS publique. C'est l'e-mail, qui n'atteint que le propriétaire de
    // la boîte, qui dit la vérité. Motif de `submit_company_request_detailed`.
    const f = fichierDe('demander_code_email')
    for (const fn of ['demander_code_email(text)', 'verifier_code_email(text, text)',
                      'email_verifie_recemment(text)', 'tirer_code_a_six_chiffres()']) {
      expect(f, `${fn} doit être fermée`)
        .toContain(`revoke all on function public.${fn} from public, anon, authenticated`)
      expect(f, `${fn} ne doit être ouverte qu’au rôle serveur`)
        .toContain(`grant execute on function public.${fn} to service_role`)
    }
  })

  it('la table des codes n’est joignable par personne', () => {
    const f = fichierDe('demander_code_email')
    expect(f).toContain('alter table public.codes_email enable row level security')
    expect(f).toContain('revoke all on table public.codes_email from public, anon, authenticated')
    // Aucune policy : le motif de `stripe_events_traites`.
    expect(f.replace(/^\s*--.*$/gm, ' ')).not.toContain('create policy')
  })
})

describe('la quatrième branche de handle_new_user', () => {
  const { corps } = derniereDefinition('handle_new_user')
  const plat = code(corps)

  it('n’accepte qu’un FAIT : une adresse vérifiée il y a moins de quinze minutes', () => {
    expect(plat).toContain('elsif public.email_verifie_recemment(v_email) then')
    const verif = code(derniereDefinition('email_verifie_recemment').corps)
    expect(verif).toContain('consomme_le is not null')
    expect(verif).toContain("interval '15 minutes'")
  })

  it('⚠️ ne donne NI entreprise NI rôle privilégié', () => {
    // Le prospect a un compte et ne voit rien : toutes les policies se
    // cloisonnent par l'entreprise, le magasin ou la session.
    const i = plat.indexOf('elsif public.email_verifie_recemment')
    const branche = plat.slice(i, plat.indexOf('else if not exists', i))
    expect(branche).toContain("'employee', null)")
    expect(branche).not.toContain('supervisor')
    expect(branche).not.toContain('is_company_admin')
    expect(branche).not.toContain('store_supervisors')
  })

  it('⚠️ vient APRÈS les invitations et AVANT le refus', () => {
    // Quelqu'un qui a une invitation en attente ET une adresse vérifiée doit
    // recevoir son invitation, pas un compte vide.
    const equipe = plat.indexOf('elsif v_team.id is not null then')
    const prospect = plat.indexOf('elsif public.email_verifie_recemment')
    const refus = plat.indexOf('raise exception')
    expect(equipe).toBeGreaterThan(0)
    expect(equipe).toBeLessThan(prospect)
    expect(prospect).toBeLessThan(refus)
  })

  it('et le refus final est intact', () => {
    // C'est le comportement par défaut, et il doit le rester : une adresse sans
    // invitation ni code vérifié n'ouvre aucun compte.
    expect(plat).toContain('Aucune invitation ni demande validée pour cet e-mail')
  })
})
