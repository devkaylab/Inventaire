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
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'
import { offrePour } from '@/lib/offres'
import { venteOuverte } from '@/lib/legal'
import { APPAREILS_TRANCHES } from '@/lib/inscription'

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

describe('les trois relances', () => {
  const relancer = code(derniereDefinition('inscriptions_a_relancer').corps)
  const purge = code(derniereDefinition('purge_expired_data').corps)
  const declencher = code(derniereDefinition('declencher_alerte').corps)
  const alerte = readFileSync(
    path.join(__dirname, '../../supabase/functions/alerte-anomalies/index.ts'), 'utf8')

  it('part à J+1, J+8 et J+21 — trois fois, jamais quatre', () => {
    // Julien, 5 septembre 2026 : « une relance dès le lendemain puis une
    // semaine plus tard. Puis une dernière fois à 20 jours de la première. On
    // ne relance que trois fois. »
    expect(relancer).toContain('array[1, 8, 21]')
    expect(relancer).toContain('i.relances < array_length(v_jalons, 1)')
  })

  it('⚠️ le calendrier et la rétention vivent au même endroit', () => {
    // J+21 contre une purge à 30 jours ne laisse que NEUF jours de marge. Si
    // la rétention redescendait sans que le calendrier suive, la troisième
    // relance partirait sur des réponses déjà effacées.
    const jalons = relancer.match(/array\[(\d+), (\d+), (\d+)\]/)
    const retention = relancer.match(/v_retention constant integer := (\d+)/)
    expect(jalons, 'le calendrier doit être lisible').not.toBeNull()
    expect(retention, 'la rétention doit vivre ici aussi').not.toBeNull()
    const dernier = Number(jalons![3])
    const garde = Number(retention![1])
    expect(garde, 'la purge doit laisser passer la dernière relance').toBeGreaterThan(dernier)
    // Et la purge elle-même porte la même valeur.
    expect(purge).toContain(`inscriptions_ttl constant interval := interval '${garde} days'`)
  })

  it('ne relance ni un brouillon déposé, ni deux fois le même jour', () => {
    expect(relancer).toContain('i.demande_id is null')
    expect(relancer).toContain("interval '20 hours'")
    expect(purge).toContain('where demande_id is null and created_at < now() - inscriptions_ttl')
  })

  it('⚠️ marque APRÈS l’envoi, jamais avant', () => {
    // Un e-mail qui ne part pas laisse la relance ouverte, et l'heure suivante
    // réessaie. L'ordre inverse la ferait taire pour de bon sur un incident
    // réseau d'une seconde — règle des alertes du 28 août 2026.
    const i = alerte.indexOf('await envoyerEmail({ to: [a], subject: titre')
    const j = alerte.indexOf("rpc('marquer_relance_inscription'")
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(j)
  })

  it('⚠️ des relances seules sont un succès', () => {
    // `clesEnvoyees` ne porte que les alertes : un tour de garde qui n'avait
    // rien à signaler mais a relancé trois prospects répondait 500, donc
    // `pg_cron` l'aurait rejoué toutes les heures.
    expect(alerte).toContain('if (relancees > 0) {')
    expect(declencher).toContain('not exists (select 1 from public.inscriptions_a_relancer())')
  })
})

describe('l’écran du parcours', () => {
  const page = readFileSync(path.join(__dirname, '../app/inscription/page.tsx'), 'utf8')
  const edge = readFileSync(
    path.join(__dirname, '../../supabase/functions/inscription/index.ts'), 'utf8')
  const sansJsx = (s: string) =>
    s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')

  it('⚠️ la réponse à la demande de code est la MÊME dans tous les cas', () => {
    // « Cette adresse a déjà un compte » rouvrirait l'oracle d'énumération
    // fermé le 28 août 2026. C'est l'e-mail — qui n'atteint que le
    // propriétaire de la boîte — qui dit la vérité.
    const c = sansJsx(edge)
    expect(c).toContain("const uniforme = json({ success: true, envoye: true })")
    // Le détail ne sort jamais vers le navigateur.
    expect(c).not.toMatch(/json\(\{[^}]*compte_existant/)
  })

  it('⚠️ n’a AUCUN repli sur une RPC directe', () => {
    // Sans la fonction edge il n'y a pas de session Stripe : déposer quand
    // même laisserait quelqu'un persuadé d'avoir payé. Règle de `/souscrire`.
    const c = sansJsx(page)
    expect(c).toContain("functions.invoke('inscription'")
    expect(c).not.toContain("rpc('finaliser_inscription'")
  })

  it('ne décide d’aucun prix — il affiche', () => {
    const c = sansJsx(page)
    expect(c).toContain("prixCents(n, 'monthly')")
    // Le montant ne part jamais dans la charge : le serveur le recalcule.
    expect(c).not.toMatch(/amount|montant|prixCents:/)
  })

  it('écrit avant d’avancer, et relit au retour', () => {
    // C'est ce qui rend l'abandon rattrapable : le brouillon existe dès la
    // première réponse, et les trois relances ramènent ici.
    const c = sansJsx(page)
    expect(c).toContain("rpc('enregistrer_inscription'")
    expect(c).toContain("rpc('mon_inscription')")
  })

  it('dit la borne des 200 appareils AVANT le clic', () => {
    expect(sansJsx(page)).toContain('refusMagasin')
    const lib = readFileSync(path.join(__dirname, '../lib/inscription.ts'), 'utf8')
    expect(lib).toContain('PLAFOND_LIBRE_SERVICE')
  })

  it('⚠️ aucune tranche ne chevauche une frontière d’offre', () => {
    // Les paliers sont 2, 20 et 100 : une tranche « 15 à 25 » rendrait l'offre
    // indécidable, à cheval sur Advanced et Enterprise.
    for (const t of APPAREILS_TRANCHES) {
      if (t.plafond == null) continue
      expect(offrePour(t.plafond), `la tranche ${t.libelle} doit tomber dans une seule offre`)
        .not.toBeNull()
    }
  })
})

describe('la vente est fermée jusqu’à l’immatriculation', () => {
  // Tranché par Julien le 5 septembre 2026 : « on ferme en attendant
  // l'immatriculation ». Le site était en ligne, « Inscrire mon entreprise »
  // dans la barre, et un visiteur pouvait dérouler tout le parcours pour
  // atterrir sur une page de paiement en mode TEST.
  //
  // ⚠️ CES GARDES PORTENT SUR LE MÉCANISME, JAMAIS SUR LA VALEUR. Le jour où
  // Julien remplit `legal.ts`, la boutique s'ouvre et la suite doit rester
  // verte : un test qui figerait « c'est fermé » deviendrait un obstacle.
  const lireSrc = (p: string) => readFileSync(path.join(__dirname, p), 'utf8')
  const edgeIns = lireSrc('../../supabase/functions/inscription/index.ts')
  const edgeSou = lireSrc('../../supabase/functions/subscribe-online/index.ts')
  const drapeau = (src: string) => /const VENTE_OUVERTE = (true|false)/.exec(src)?.[1] === 'true'

  it('⚠️ le serveur porte le même verdict que le site', () => {
    // Une porte fermée à l'écran seulement s'ouvre avec une adresse.
    expect(drapeau(edgeIns), 'la fonction edge d’inscription a divergé du site')
      .toBe(venteOuverte())
    expect(drapeau(edgeSou), 'la fonction edge de souscription a divergé du site')
      .toBe(venteOuverte())
  })

  it('⚠️ et il refuse AVANT toute écriture', () => {
    // Ouvrir un compte de prospect qui ne pourra pas payer ne laisserait que
    // des comptes orphelins ; déposer une demande, une ligne morte.
    const garde = edgeIns.indexOf('if (!VENTE_OUVERTE) return boutiqueFermee()')
    expect(garde).toBeGreaterThan(0)
    for (const ecriture of ["rpc('demander_code_email'", 'auth.admin.createUser',
                            "rpc('finaliser_inscription'"]) {
      expect(edgeIns.indexOf(ecriture), `${ecriture} doit venir après la garde`)
        .toBeGreaterThan(garde)
    }
    const g2 = edgeSou.indexOf('if (!VENTE_OUVERTE) return boutiqueFermee()')
    expect(edgeSou.indexOf("rpc('deposer_souscription'")).toBeGreaterThan(g2)
  })

  it('⚠️ un seul interrupteur, et c’est l’immatriculation', () => {
    // Pas de second drapeau : ce serait un endroit de plus où se tromper, et
    // surtout un endroit qu'on oublierait de rouvrir le jour venu. La LCEN
    // interdit de vendre sans identification complète de l'éditeur : les deux
    // ouvrent ensemble par nature.
    const legal = lireSrc('../lib/legal.ts')
    expect(legal).toContain('export function venteOuverte(): boolean {\n  return mentionsCompletes()\n}')
  })

  it('les trois écrans lisent ce verdict', () => {
    for (const [nom, p] of [
      ['la page d’inscription', '../app/inscription/page.tsx'],
      ['la page de souscription', '../app/souscrire/page.tsx'],
      ['la barre publique', '../components/HeaderActions.tsx'],
      ['la grille de tarifs', '../components/TarifsGrille.tsx'],
    ] as const) {
      expect(lireSrc(p), `${nom} doit lire venteOuverte()`).toContain('venteOuverte()')
    }
  })

  it('⚠️ mais les PRIX restent visibles', () => {
    // Ils sont publics et vrais depuis le 30 août : les cacher ne protégerait
    // rien et priverait un prospect de ce qu'il est venu chercher. C'est le
    // bouton qui change, pas la grille.
    const grille = lireSrc('../components/TarifsGrille.tsx')
    expect(grille).toContain('euros(')
    expect(grille).not.toMatch(/venteOuverte\(\)\s*&&[\s\S]{0,80}OFFRES\.map/)
  })

  it('et le bouton ne promet pas une inscription qui ne peut pas aboutir', () => {
    const barre = lireSrc('../components/HeaderActions.tsx')
    expect(barre).toContain("ouverte ? 'Inscrire mon entreprise' : 'Nous écrire'")
  })

  it('⚠️ AUCUN écran ne promet l’inscription sans lire le verdict', () => {
    // ⚠️ LA GARDE DÉDUIT LA LISTE, ELLE NE LA CITE PAS. Une garde qui nomme les
    // écrans à protéger ne protège que ceux qu'on connaissait le jour où on
    // l'a écrite — et il y en avait SEPT, pas un. Doctrine du 4 septembre 2026.
    const racine = path.join(__dirname, '..')
    const fichiers: string[] = []
    const balayer = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') balayer(p) }
        else if (e.name.endsWith('.tsx')) fichiers.push(p)
      }
    }
    for (const d of ['app', 'components']) balayer(path.join(racine, d))

    const fautifs = fichiers.filter((f) => {
      const src = readFileSync(f, 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      if (!src.includes('Inscrire mon entreprise')) return false
      // Le libellé est acceptable s'il passe par `InscriptionLink` (qui sait),
      // ou si l'écran lit lui-même `venteOuverte()`.
      return !src.includes('InscriptionLink') && !src.includes('venteOuverte()')
    }).map((f) => path.relative(racine, f))

    expect(fautifs, `ces écrans promettent l’inscription sans savoir si elle est ouverte : ${fautifs.join(', ')}`)
      .toEqual([])
    expect(fichiers.length, 'le balayage doit trouver des écrans').toBeGreaterThan(20)
  })
})
