/**
 * L'espace de l'inventoriste — ce que l'application demande à la base.
 *
 * ⚠️ **UN SEUL APPEL POUR TOUT L'ÉCRAN D'ACCUEIL.** `mon_espace_inventoriste`
 * rend le profil, la vérification, les disponibilités, les missions acceptées
 * et les revenus d'un coup. Cinq appels, ce serait cinq allers-retours sur un
 * téléphone en 4G, dans le parking d'un magasin à six heures du matin.
 *
 * ⚠️ **ET CE QU'ON VOIT D'UNE MISSION DÉPEND DE SI ON L'A ACCEPTÉE.** Une
 * proposition dit le secteur, la ville, l'heure et ce qu'on touche ; l'adresse
 * exacte vient après. C'est la base qui le tient (`mes_propositions` ne rend
 * pas d'adresse), pas cet écran.
 */
import { supabase } from './supabase'

/**
 * ⚠️ **LE CLIENT TYPÉ NE CONNAÎT PAS ENCORE CES FONCTIONS**, et c'est normal :
 * `src/types/database.types.ts` est GÉNÉRÉ depuis la base, et les migrations
 * On-Demand ne sont pas appliquées. Les écrire à la main dans le fichier généré
 * créerait une dérive que `scripts/mesurer-migrations.mjs` ne verrait pas.
 *
 * Cette porte disparaît le jour où les types sont régénérés — et elle est
 * NOMMÉE pour qu'on la retrouve : un `as any` disséminé sur cinq appels ne se
 * retrouve pas.
 */
const rpc = (nom: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (
    n: string, a?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(nom, args)

export type Proposition = {
  mission_id: string
  role: 'inventoriste' | 'responsable'
  secteur: string
  ville: string
  code_postal: string | null
  debut_prevu: string
  arrivee_prevue: string
  duree_minutes: number
  remuneration_cents: number
  propose_le: string
}

export type MissionAcceptee = {
  mission_id: string
  role: 'inventoriste' | 'responsable'
  secteur: string
  magasin: string
  adresse: string
  code_postal: string | null
  ville: string | null
  acces_sur_place: string | null
  debut_prevu: string
  arrivee_prevue: string
  duree_minutes: number
  remuneration_cents: number
  pointe_le: string | null
  etat_mission: string
  inventory_session_id: string | null
}

export type ProfilInventoriste = {
  prenom: string
  nom: string
  etat: 'incomplet' | 'en_revue' | 'verifie' | 'actif' | 'suspendu' | 'refuse'
  niveau: 'nouveau' | 'confirme' | 'expert' | 'responsable'
  forme_juridique: string | null
  siret: string | null
  experience_annees: number | null
  secteurs: string[]
  langues: string[]
  mobilite: string | null
  rayon_km: number
  verifie_le: string | null
  paiements_ouverts: boolean
  compte_paiement_ouvert: boolean
}

export type Disponibilite = { jour: number; debut: string; fin: string }

export type EspaceInventoriste = {
  success: boolean
  code?: string
  profil: ProfilInventoriste | null
  missions_faites?: number
  disponibilites?: Disponibilite[]
  missions?: MissionAcceptee[]
  revenus?: { a_venir_cents: number; verse_cents: number }
}

export async function monEspace(): Promise<EspaceInventoriste> {
  const { data, error } = await rpc('mon_espace_inventoriste')
  if (error) throw error
  return data as EspaceInventoriste
}

export async function mesPropositions(): Promise<Proposition[]> {
  const { data, error } = await rpc('mes_propositions')
  if (error) throw error
  const r = data as { success: boolean; propositions?: Proposition[] }
  return r?.propositions ?? []
}

export async function repondre(
  missionId: string, accepte: boolean, motif?: string,
): Promise<{ success: boolean; code?: string; etat?: string }> {
  const { data, error } = await rpc('repondre_a_une_mission', {
    p_mission: missionId, p_accepte: accepte, p_motif: motif ?? null,
  })
  if (error) throw error
  return data as { success: boolean; code?: string; etat?: string }
}

export async function pointerArrivee(missionId: string): Promise<{ success: boolean; code?: string }> {
  const { data, error } = await rpc('pointer_mon_arrivee', { p_mission: missionId })
  if (error) throw error
  return data as { success: boolean; code?: string }
}

export async function enregistrerDisponibilites(
  creneaux: Disponibilite[],
): Promise<{ success: boolean; code?: string }> {
  const { data, error } = await rpc('enregistrer_mes_disponibilites', {
    p_creneaux: creneaux,
  })
  if (error) throw error
  return data as { success: boolean; code?: string }
}

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const NIVEAUX: Record<string, string> = {
  nouveau: 'Nouveau', confirme: 'Confirmé', expert: 'Expert', responsable: 'Responsable',
}

/**
 * Ce qu'il reste à faire avant de pouvoir recevoir une mission — et par qui.
 *
 * ⚠️ **LA SÉPARATION EST LE MESSAGE.** Quantinvo relit le téléphone, l'e-mail
 * et l'expérience ; Stripe contrôle l'identité, le SIRET et le compte
 * bancaire, parce que c'est lui l'établissement de paiement. Quantinvo ne voit
 * ni les papiers ni l'IBAN, et cet écran doit le dire — sinon on nous les
 * envoie par e-mail.
 */
export function ceQuiManque(p: ProfilInventoriste): string[] {
  const manques: string[] = []
  if (!p.siret) manques.push('Votre SIRET')
  if (!p.experience_annees && p.experience_annees !== 0) manques.push('Votre expérience')
  if (p.secteurs.length === 0) manques.push('Les secteurs que vous connaissez')
  if (!p.compte_paiement_ouvert) manques.push('Votre compte de paiement chez Stripe')
  else if (!p.paiements_ouverts) manques.push('La validation de votre dossier par Stripe')
  return manques
}

/** « 4 h 30 », « 3 h », « 45 min ». Copie de `web/lib/prixOnDemand.ts`. */
export function duree(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

export function euros(cents: number): string {
  return `${Math.round(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`
}

const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function quand(iso: string): string {
  const d = new Date(iso)
  const h = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const aujourdhui = new Date()
  if (d.toDateString() === aujourdhui.toDateString()) return `Aujourd’hui, ${h}`
  return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}, ${h}`
}

export function heure(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
