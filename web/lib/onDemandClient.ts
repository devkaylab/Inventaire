/**
 * Ce que le client lit de ses inventaires à la demande.
 *
 * ⚠️ **PAS DE RPC ICI, ET C'EST VOULU.** La RLS de `missions` ouvre déjà les
 * lignes de l'entreprise, et le `grant select` colonne par colonne retient ce
 * qu'un client ne doit pas lire (`cout_cents`, `calcul`). Une fonction
 * `SECURITY DEFINER` de plus serait une porte de plus à garder, pour lire ce
 * qui est déjà lisible.
 *
 * ⚠️ **ET LE PRIX DE RÉSERVATION AFFICHÉ EST UNE ESTIMATION**, calculée par la
 * copie d'affichage à partir du dernier inventaire du magasin. Le montant qui
 * engage sort de `reserver_ma_mission`, en base. La maquette écrit
 * « Réserver — 1 309 € » sur la fiche d'un établissement : c'est ce chiffre-là,
 * et il retombe juste tant que le volume n'a pas changé.
 */
import { supabase } from '@/lib/supabaseClient'
import { chaine, TRANCHES_ARTICLES } from '@/lib/prixOnDemand'
import { VERSION_CONDITIONS } from '@/lib/conditions'

export type Mission = {
  id: string
  reference: string
  magasin_nom: string
  adresse: string
  ville: string | null
  store_id: string | null
  inventory_session_id: string | null
  etat: string
  secteur: string
  debut_prevu: string
  arrivee_prevue: string
  duree_prevue_minutes: number
  /** Les appareils ouverts au client. `inventoristes` compte les gens envoyés — 0 en location. */
  appareils: number | null
  inventoristes: number
  responsable: boolean
  articles_retenus: number
  prix_cents: number
  annulation_gratuite_jusqu_au: string | null
  terminee_le: string | null
  created_at: string
}

/** Les colonnes que le client a le droit de lire — la base les retient déjà. */
const COLONNES =
  'id,reference,magasin_nom,adresse,ville,store_id,inventory_session_id,etat,'
  + 'secteur,debut_prevu,arrivee_prevue,duree_prevue_minutes,appareils,inventoristes,'
  + 'responsable,articles_retenus,prix_cents,annulation_gratuite_jusqu_au,'
  + 'terminee_le,created_at'

/** Ce qui est derrière nous : plus rien à décider. */
export const ETATS_PASSES = [
  'terminee', 'payee', 'paiement_prestataires', 'annulee', 'remboursee', 'echouee',
]

/** Ce que le client a réservé et qui n'a pas encore eu lieu. */
export function estAVenir(m: Mission): boolean {
  return !ETATS_PASSES.includes(m.etat)
}

export async function mesMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select(COLONNES)
    .order('debut_prevu', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Mission[]
}

export async function maMission(id: string): Promise<Mission | null> {
  const { data, error } = await supabase
    .from('missions').select(COLONNES).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as Mission) ?? null
}

export type Etablissement = {
  id: string
  name: string
  address: string | null
  sqm: number | null
  derniere: Mission | null
}

/**
 * Les établissements de l'entreprise, avec leur dernier inventaire à la
 * demande. La maquette en fait la liste de départ d'une nouvelle réservation.
 */
export async function mesEtablissements(): Promise<Etablissement[]> {
  // ⚠️ PAR LA FONCTION, PAS PAR LA TABLE. `authenticated` n'a pas le droit de
  // lire `stores` (ses droits sont `dDtm`, jamais `select`) : la lecture
  // directe d'avant rendait « permission denied for table stores », et cet
  // écran n'a donc jamais fonctionné. Tout le produit passe par une fonction
  // `security definer` ; celui-ci ne le faisait pas.
  const [stores, missions] = await Promise.all([
    supabase.rpc('mes_etablissements'),
    mesMissions(),
  ])
  if (stores.error) throw stores.error
  const parMagasin = new Map<string, Mission>()
  for (const m of missions) {
    if (!m.store_id || !ETATS_PASSES.includes(m.etat)) continue
    const connue = parMagasin.get(m.store_id)
    if (!connue || m.debut_prevu > connue.debut_prevu) parMagasin.set(m.store_id, m)
  }
  return ((stores.data ?? []) as Etablissement[]).map((s) => ({
    ...s, derniere: parMagasin.get(s.id) ?? null,
  }))
}

/**
 * Ce que coûterait un nouvel inventaire de ce magasin, d'après le dernier.
 *
 * ⚠️ Rend `null` quand il n'y en a jamais eu : la maquette affiche alors
 * « Obtenir un prix », pas un montant. Un prix bâti sur une surface seule
 * serait une invention — la productivité se compte en articles, pas en m².
 */
export function prixIndicatif(e: Etablissement): number | null {
  if (!e.derniere) return null
  // On repart de la tranche déclarée, pas du compté : c'est elle que le client
  // rechoisira, et c'est elle qui fait le prix.
  const tranche = TRANCHES_ARTICLES.find((t) => t.max >= e.derniere!.articles_retenus)
  if (!tranche) return null
  return chaine(tranche.max).prixCents
}

/**
 * ⚠️⚠️ **RÉSERVER POUR DE VRAI** (5 octobre 2026).
 *
 * Julien : « Un pro qui revient avec une adresse connue en tant que client doit
 * pouvoir louer Quantinvo s'il le souhaite. »
 *
 * En cherchant où brancher ce cas, un trou plus large : **le tunnel `/reserver`
 * ne créait AUCUNE réservation.** Son seul appel serveur était l'envoi d'un
 * code d'inscription ; `reserver_ma_mission` n'était appelée de nulle part dans
 * le site. L'écran d'arrivée affirmait pourtant « Votre réservation est
 * enregistrée avec ce prix ». Elle ne l'était pas — ni pour un visiteur, ni
 * pour un client déjà connecté.
 *
 * Le pro à l'adresse connue se connecte (le tunnel a « J'ai déjà un compte »
 * depuis le début) : c'est donc ce chemin-là qui doit aboutir, et c'est celui
 * que cette fonction ferme.
 *
 * ⚠️ AUCUN MONTANT NE PART D'ICI. `reserver_ma_mission` recalcule le prix en
 * base — « laisser le client porter un montant, c'est le laisser réserver à un
 * centime » (docs/notes/074). On envoie des réponses, pas un total.
 */
export type Reponses = {
  entreprise: string
  magasin: string
  adresse: string
  codePostal: string
  ville: string
  secteur: string
  surfaceVente: string
  surfaceReserve: string
  articlesMin: number
  articlesMax: number
  referencesMin: number | null
  referencesMax: number | null
  codeBarres: string
  formule: string
  appareils: number
  debut: Date
  moment: string
  siren: string
}

/**
 * Ce que chaque refus veut dire, en français. ⚠️ Les clés sont les `code` que
 * rendent `reserver_ma_mission` et `prix_mission` — un code inconnu s'affiche
 * tel quel plutôt que de laisser un écran muet.
 */
export const REFUS_RESERVATION: Record<string, string> = {
  adresse: 'Cette adresse n’a pas pu être lue. Reprenez-la à l’étape 1.',
  articles: 'Le volume de pièces manque. Reprenez l’étape 3.',
  code_postal: 'Le code postal doit comporter cinq chiffres.',
  conditions: 'Les conditions générales ont changé pendant votre visite. Rechargez la page, votre parcours est conservé.',
  date: 'La date n’a pas pu être lue. Reprenez l’étape 2.',
  engagement: 'Il manque votre accord de l’étape 3.',
  entreprise: 'Il manque la raison sociale de votre entreprise.',
  format: 'Ces réponses n’ont pas pu être lues. Rechargez la page.',
  formule: 'Cette formule n’existe pas.',
  hors_grille: 'Ce volume sort de notre grille. Écrivez-nous depuis votre messagerie Quantinvo.',
  hors_zone: 'Nous ne desservons pas encore cette adresse avec une équipe.',
  magasin: 'Le nom du magasin est trop long (80 caractères au maximum).',
  marge_insuffisante: 'Nous ne pouvons pas tenir ce prix. Écrivez-nous.',
  non_connecte: 'Votre session a expiré. Reconnectez-vous, votre parcours est conservé.',
  pas_de_reglages: 'Notre grille tarifaire est momentanément indisponible. Réessayez dans un instant.',
  siren: 'Ce SIREN n’est pas valide.',
  trop_tot: 'Cette date est trop proche. Choisissez un créneau plus tard.',
}

/**
 * ⚠️ **LE `code` REMONTE AVEC LE MESSAGE, ET C'EST CE QUI ÉVITE DE RECOPIER LA
 * RÈGLE.** `reserver_ma_mission` crée une entreprise au client qui n'en a pas
 * d'utilisable — et depuis le 5 octobre, un compteur chez quelqu'un d'autre en
 * fait partie. L'écran pourrait deviner le cas en relisant `profiles.role`,
 * mais il recopierait alors une règle qui vit en base, et les deux
 * divergeraient le jour où elle change. Il tente, et si le serveur réclame la
 * raison sociale (`entreprise`), il la demande. Le serveur décide.
 */
/**
 * Ce que la base attend, à partir de ce que l'écran tient.
 *
 * ⚠️ **ÉCRIT UNE FOIS, ENVOYÉ PAR DEUX CHEMINS** (10 octobre 2026). La
 * réservation part soit d'ici, pour un client déjà connecté, soit de la
 * fonction edge qui ouvre le compte — où elle doit être faite DANS LE MÊME
 * GESTE que la création, sans quoi un refus laisse un compte mort derrière
 * lui. Deux copies de cet objet divergeraient au premier champ ajouté, et le
 * parcours le moins joué des deux porterait l'erreur.
 */
export function corpsReservation(r: Reponses): Record<string, unknown> {
  return {
    entreprise: r.entreprise,
    siren: r.siren,
    magasin: r.magasin,
    adresse: r.adresse,
    code_postal: r.codePostal,
    ville: r.ville,
    secteur: r.secteur,
    surface_vente: r.surfaceVente,
    surface_reserve: r.surfaceReserve,
    articles_min: r.articlesMin,
    articles_max: r.articlesMax,
    references_min: r.referencesMin,
    references_max: r.referencesMax,
    code_barres: r.codeBarres,
    formule: r.formule,
    appareils: r.appareils,
    debut: r.debut.toISOString(),
    moment: r.moment,
    engagement: true,
    cgv_version: VERSION_CONDITIONS,
  }
}

/** Ce qu'une réponse de `reserver_ma_mission` contient, refus compris. */
export type RetourReservation =
  | { ok: true; missionId: string; reference: string; prixCents: number }
  | { ok: false; code: string; message: string }

/**
 * Lire la réponse de la base, d'où qu'elle vienne.
 *
 * ⚠️ La fonction edge renvoie le MÊME objet quand elle réserve pour un compte
 * qu'elle vient d'ouvrir : le tunnel traite les deux refus de la même façon,
 * et renvoie sur le même écran.
 */
export function lireReservation(data: unknown): RetourReservation {
  const rep = data as {
    success?: boolean; code?: string; mission_id?: string
    reference?: string; prix_cents?: number
  } | null
  if (!rep?.success || !rep.reference || !rep.mission_id) {
    const code = rep?.code ?? ''
    return {
      ok: false, code,
      message: REFUS_RESERVATION[code] ?? (code || 'La réservation n’a pas pu être prise.'),
    }
  }
  return {
    ok: true,
    missionId: rep.mission_id,
    reference: rep.reference,
    prixCents: rep.prix_cents ?? 0,
  }
}

/**
 * Réserver pour un client DÉJÀ CONNECTÉ.
 *
 * ⚠️ Un visiteur sans compte ne passe PAS par ici : son compte et sa
 * réservation se font dans le même geste, côté serveur, sans quoi un refus
 * laisserait un compte sans entreprise derrière lui.
 */
export async function reserverMaMission(
  reponses: Record<string, unknown>,
): Promise<RetourReservation> {
  const { data, error } = await supabase.rpc('reserver_ma_mission', {
    p_reponses: reponses,
  })
  if (error) return { ok: false, code: '', message: error.message }
  // ⚠️ `mission_id` REMONTE DEPUIS LE 7 OCTOBRE, et il est nécessaire : c'est
  // lui qui sert à aller chercher la carte (`missionEmpreinte`). La référence
  // est faite pour l'œil du client, pas pour désigner une ligne.
  return lireReservation(data)
}
