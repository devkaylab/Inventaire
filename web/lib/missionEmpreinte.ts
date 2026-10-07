/**
 * L'empreinte de la carte d'une location (7 octobre 2026).
 *
 * Julien : « je suis facturé au bout de 7 jours automatiquement sur mon mode de
 * paiement déjà renseigné avant l'inventaire. Paiement que Quantinvo a vérifié
 * comme valide. »
 *
 * Ce module est le côté navigateur de ce « avant ». Deux gestes, et aucun des
 * deux ne décide de quoi que ce soit :
 *
 *   · `ouvrirLEmpreinte`    — demander l'adresse de la page de Stripe ;
 *   · `confirmerLEmpreinte` — au retour, dire au serveur de relire la session.
 *
 * ⚠️ **AUCUN MONTANT NE PART D'ICI, ET AUCUN N'ARRIVE.** Ce qui sera prélevé
 * est lu en base, où il a été figé à la réservation. Le navigateur ne porte
 * qu'un identifiant de mission — même règle que `reserverMaMission` :
 * « laisser le client porter un montant, c'est le laisser réserver à un
 * centime » (docs/notes/074).
 *
 * ⚠️ **ET CE N'EST PAS LE RETOUR DE STRIPE QUI FAIT FOI.** L'adresse de succès
 * s'ouvre à la main : n'importe qui pourrait taper `?carte=ok`. C'est le
 * serveur qui relit la session chez Stripe, et lui seul qui enregistre la
 * carte — `confirmerLEmpreinte` ne fait que lui demander de regarder.
 */
import { supabase } from '@/lib/supabaseClient'

export type Empreinte =
  | { ok: true; url: string }
  | { ok: false; code: string; message: string }

export type Confirmation =
  | { ok: true; enregistre: boolean; etat: string | null; expireLe: string | null }
  | { ok: false; code: string; message: string }

/** Ce que chaque refus veut dire, en français. */
export const REFUS_EMPREINTE: Record<string, string> = {
  vente_fermee: 'Le paiement en ligne n’est pas encore ouvert. Nous vous écrivons dès qu’il l’est.',
  indisponible: 'Le paiement en ligne est momentanément indisponible. Réessayez dans un instant.',
  non_connecte: 'Votre session a expiré. Reconnectez-vous, votre réservation est conservée.',
  introuvable: 'Cette réservation n’existe pas.',
  interdit: 'Cette réservation n’est pas la vôtre.',
  etat: 'Cette réservation n’attend plus de carte.',
  montant: 'Cette réservation n’a pas de montant.',
  aucune_session: 'Aucune carte n’a encore été demandée pour cette réservation.',
}

/**
 * ⚠️ `invoke` JETTE LE CORPS SUR UN REFUS, et c'est là que vit le message
 * utile (« pas encore ouvert », « cette réservation n'est pas la vôtre »). On
 * le relit sur la réponse portée par l'erreur — même correctif que
 * `PayerEnLigne`.
 */
async function appeler(corps: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.functions.invoke('mission-empreinte', { body: corps })
  let reponse: Record<string, unknown> | null = (data ?? null) as Record<string, unknown> | null
  const ctx = (error as { context?: unknown } | null)?.context
  if (ctx instanceof Response) {
    try {
      reponse = await ctx.json()
    } catch {
      /* corps illisible : le message générique de l'appelant fera l'affaire */
    }
  }
  return reponse
}

function refus(r: Record<string, unknown> | null, defaut: string) {
  const code = String(r?.code ?? '')
  return { ok: false as const, code, message: REFUS_EMPREINTE[code] ?? defaut }
}

/** L'adresse de la page où le client donnera sa carte. Rien n'est débité là-bas. */
export async function ouvrirLEmpreinte(missionId: string, tentative = 0): Promise<Empreinte> {
  const r = await appeler({ action: 'ouvrir', missionId, tentative })
  if (r?.success && typeof r.url === 'string') return { ok: true, url: r.url }
  return refus(r, 'Nous n’avons pas pu ouvrir la page de paiement. Réessayez dans un instant.')
}

/**
 * Au retour de Stripe : demander au serveur de relire la session.
 *
 * `enregistre: false` n'est pas un échec — c'est « la carte n'est pas encore
 * validée » (session abandonnée, ou authentification bancaire en suspens). Rien
 * ne s'ouvre, et le client peut recommencer.
 */
export async function confirmerLEmpreinte(missionId: string): Promise<Confirmation> {
  const r = await appeler({ action: 'confirmer', missionId })
  if (r?.success) {
    return {
      ok: true,
      // ⚠️ `deja` COMPTE COMME ENREGISTRÉE : le client qui recharge la page de
      // succès a bien sa carte prise, et lui dire le contraire le ferait
      // recommencer un paiement déjà fait.
      enregistre: r.enregistre === true || r.deja === true,
      etat: typeof r.etat === 'string' ? r.etat : null,
      expireLe: typeof r.acces_expirent_le === 'string' ? r.acces_expirent_le : null,
    }
  }
  return refus(r, 'Nous n’avons pas pu vérifier votre carte. Écrivez-nous.')
}
