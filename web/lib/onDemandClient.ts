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
  + 'secteur,debut_prevu,arrivee_prevue,duree_prevue_minutes,inventoristes,'
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
  const [stores, missions] = await Promise.all([
    supabase.from('stores').select('id,name,address,sqm').order('name'),
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
