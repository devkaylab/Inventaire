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

describe('le brouillon vit à part', () => {
  const f = fichierDe('enregistrer_inscription')
  const enregistrer = code(derniereDefinition('enregistrer_inscription').corps)

  it('⚠️ dans sa propre table, pas dans company_requests', () => {
    // `admin_pipeline` rend « tout ce qui n'est pas terminé » de cette table :
    // un brouillon abandonné à l'étape 4 s'y afficherait comme une vente en
    // cours, avec un nom vide et un revenu de zéro. La console se remplirait de
    // gens qui n'ont rien demandé.
    expect(f).toContain('create table if not exists public.inscriptions')
    expect(enregistrer).not.toContain('company_requests')
  })

  it('n’est joignable par personne — tout passe par les RPC', () => {
    expect(f).toContain('alter table public.inscriptions enable row level security')
    expect(f).toContain('revoke all on table public.inscriptions from public, anon, authenticated')
    expect(f.replace(/^\s*--.*$/gm, ' ')).not.toContain('create policy')
  })

  it('⚠️ désigne la ligne par auth.uid(), jamais par un paramètre', () => {
    // Sinon on écrirait le brouillon d'un autre. La garde porte sur la ligne
    // visée, pas sur un argument de l'appelant — motif de `ca_store_detail`.
    expect(enregistrer).toContain('v_uid uuid := auth.uid()')
    expect(enregistrer).toContain('user_id = v_uid')
  })

  it('borne les réponses, et REFUSE plutôt que tronquer', () => {
    expect(enregistrer).toContain("length(p_reponses::text) > 4000")
    expect(enregistrer).not.toContain('left(p_reponses')
    expect(f).toContain('inscriptions_reponses_taille')
  })
})

describe('finaliser : le prix vient du serveur', () => {
  const finaliser = code(derniereDefinition('finaliser_inscription').corps)

  it('⚠️ appelle prix_offre, et ne reçoit AUCUN montant', () => {
    // Elle est appelée avec le jeton du prospect : lui laisser porter un
    // montant le laisserait s'inscrire à un centime. Même règle que les deux
    // dépôts du libre-service (4 septembre 2026).
    expect(finaliser).toContain('public.prix_offre(v_dev, p_billing_period)')
    expect(finaliser).not.toMatch(/p_(montant|prix|amount)/)
  })

  it('la borne des 200 appareils reste chez prix_offre', () => {
    // Elle rend `null` au-delà : on n'en fait pas une copie de plus ici.
    expect(finaliser).toContain('if v_tarif is null then')
    expect(finaliser).toContain("'hors_grille'")
    expect(finaliser).not.toContain('> 200')
  })

  it('distingue l’échéance de ce que le magasin vaut à l’année', () => {
    // La règle des lignes de devis du 2 septembre : les confondre facture douze
    // fois trop cher, ou douze fois trop peu.
    expect(finaliser).toContain("'prixCents', (v_tarif ->> 'prix_cents')::bigint")
    expect(finaliser).toContain("'annuelCents', (v_tarif ->> 'annuel_cents')::bigint")
  })

  it('refuse plutôt que tronquer, sur chaque texte', () => {
    // ⚠️ La borne s'ancre sur son CHIFFRE ENTIER : `toContain('> 80')` accepte
    // « > 800 », et le sabotage passait. Troisième fois sur ce dépôt.
    for (const [champ, max] of [['v_nom', 80], ['v_first', 80], ['v_last', 80],
                                ['v_phone', 30], ['v_sname', 80]] as const) {
      expect(finaliser, `${champ} doit refuser au-delà de ${max}`)
        .toMatch(new RegExp(`length\\(${champ}\\) > ${max}(?!\\d)`))
    }
    expect(finaliser).toContain('public.siren_valide(v_siren)')
  })

  it('⚠️ note le COMPTE sur la demande, et naît en accepted', () => {
    // `user_id` est le point de sécurité : le webhook promeut ce compte-là.
    expect(finaliser).toContain("'accepted'")
    expect(finaliser).toContain("v_uid, 'inscription')")
  })

  it('une seule demande par compte', () => {
    expect(finaliser).toContain("'deja_finalise'")
    expect(finaliser).toContain("'deja_dans_une_entreprise'")
  })
})

describe('le paiement promeut le compte, il n’invite pas', () => {
  const fulfil = code(derniereDefinition('fulfil_paid_request').corps)
  const promouvoir = code(derniereDefinition('promouvoir_admin_apres_paiement').corps)

  it('⚠️ promeut user_id, jamais l’adresse relue', () => {
    // Quelqu'un qui change d'adresse entre le dépôt et l'encaissement se
    // verrait sinon attribuer l'entreprise d'un autre : famille de VR-003.
    expect(fulfil).toContain('public.promouvoir_admin_apres_paiement(v_company_id, v_req.user_id)')
    expect(fulfil).not.toContain('promouvoir_admin_apres_paiement(v_company_id, v_email')
  })

  it('et n’envoie alors AUCUNE invitation', () => {
    // `invite_company_admin_after_payment` refuse une adresse qui a déjà un
    // compte (`account_exists`) : le prospect paierait et n'obtiendrait rien.
    expect(fulfil).toContain("'invite', case when v_req.user_id is not null then null else")
  })

  it('⚠️ ne déplace pas un compte déjà rattaché à une entreprise', () => {
    expect(promouvoir).toContain('where id = p_user and company_id is null')
    expect(promouvoir).toContain("'compte_indisponible'")
  })

  it('et reste fermée à authenticated', () => {
    const f = fichierDe('promouvoir_admin_apres_paiement')
    expect(f).toContain('revoke all on function public.promouvoir_admin_apres_paiement(uuid, uuid) from public, anon, authenticated')
    expect(f).not.toContain('promouvoir_admin_apres_paiement(uuid, uuid) to authenticated')
  })
})
