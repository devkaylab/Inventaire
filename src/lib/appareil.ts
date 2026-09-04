/**
 * L'identité de l'appareil, et sa place dans le forfait du magasin.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. La page de tarifs promet « deux appareils à la
 * fois » depuis le 30 août 2026, et la licence se facture là-dessus depuis le
 * 2 septembre. Rien ne le mesurait. Julien a tranché le 4 septembre : « on
 * n'accepte ni magasin, ni appareil supplémentaires sans paiement ». Le
 * plafond n'est donc pas indicatif — il ferme la porte.
 *
 * ── L'IDENTIFIANT ──────────────────────────────────────────────────────────
 *
 * ⚠️ **Il vit dans le trousseau, et il DOIT y vivre.** Deux raisons, et la
 * seconde est celle qui compte :
 *
 *   · il survit au redémarrage de l'application — sinon un téléphone qu'on
 *     relance prendrait une seconde place et remplirait le forfait tout seul ;
 *   · **il survit à la DÉCONNEXION.** `oublierCachesLocaux` balaie
 *     `AsyncStorage` à chaque `signOut` : un identifiant rangé là changerait à
 *     chaque relève d'équipe, et le téléphone partagé entre le matin et
 *     l'après-midi compterait pour deux appareils. Or c'est exactement
 *     l'argument de vente — « comptes illimités, deux appareils à la fois ».
 *
 * Il n'est **relié à aucun compte**. On compte des appareils, jamais des
 * personnes : c'est la règle depuis le retrait du suivi nominatif (constat E3,
 * 19 août 2026), et la table `appareils_actifs` n'a délibérément pas de
 * colonne d'utilisateur. Ce qui reste nominatif, et doit le rester, c'est
 * `counts.counted_by` — arbitrer un écart suppose de savoir qui a compté.
 *
 * Conséquence assumée : réinstaller l'application peut faire changer
 * l'identifiant (le Keystore d'Android est effacé à la désinstallation ; le
 * trousseau d'iOS, non). L'ancienne place se libère alors d'elle-même en
 * quatre-vingt-dix secondes.
 *
 * ── LES TROIS BORNES DU VERROU ─────────────────────────────────────────────
 *
 * Elles ne sont pas des adoucissements, ce sont les conditions pour qu'il ne
 * casse pas un inventaire. Deux vivent en base ; **la troisième vit ici**.
 *
 *   1. un appareil qui compte n'est jamais éjecté (base : le chemin « il est
 *      déjà là » passe avant tout comptage) ;
 *   2. sans plafond connu, aucun refus (base) ;
 *   3. **⚠️ ON N'ÉCHOUE JAMAIS DU CÔTÉ FERMÉ.** Réseau coupé, serveur muet,
 *      réponse inattendue : on accorde. Le seul refus qui ferme la porte est
 *      un `forfait_plein` explicitement prononcé par le serveur. Un magasin en
 *      réserve, sans wifi, doit pouvoir compter — et une coupure d'une seconde
 *      ne doit jamais renvoyer quelqu'un de son rayon.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

/** Le trousseau n'accepte que `[A-Za-z0-9._-]` dans une clé. */
const CLE = 'quantinvo.appareil'

/**
 * ⚠️ Même cadence que le battement de présence (`BEAT_MS`), et même fenêtre de
 * péremption côté serveur que `STALE_MS` — quatre-vingt-dix secondes. Ce n'est
 * pas une coïncidence : si le verrou retenait une place plus longtemps que le
 * tableau de bord ne montre l'appareil, l'écran du superviseur dirait « un
 * appareil » pendant que le verrou en compterait deux. Un seul silence, une
 * seule conclusion.
 */
const CADENCE_MS = 30_000

/** Refusé, on redemande plus souvent : une place se libère sans prévenir. */
const CADENCE_REFUS_MS = 10_000

const surLeWeb = Platform.OS === 'web'

// ── L'identifiant ──────────────────────────────────────────────────────────

function nouvelId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `a-${Math.floor(Math.random() * 1e9).toString(36)}${Date.now().toString(36)}`
}

/**
 * ⚠️ La promesse est mise en cache, pas seulement la valeur. Deux appels
 * concurrents — l'écran de comptage et un battement — tireraient sinon deux
 * identifiants, et le second écraserait le premier : un seul téléphone
 * consommerait deux places.
 */
let promesse: Promise<string> | null = null

async function trousseauDispo(): Promise<boolean> {
  if (surLeWeb) return false
  try {
    return (await SecureStore.isAvailableAsync()) === true
  } catch {
    // Même piège que `sessionStore` : un module natif absent lève à l'appel.
    // On retombe sur le stockage ordinaire plutôt que de casser l'écran.
    return false
  }
}

async function lireOuCreer(): Promise<string> {
  const trousseau = await trousseauDispo()
  try {
    const existant = trousseau
      ? await SecureStore.getItemAsync(CLE)
      : await AsyncStorage.getItem(CLE)
    if (existant && /^[A-Za-z0-9._:-]{1,64}$/.test(existant)) return existant
  } catch { /* on en tire un neuf */ }

  const neuf = nouvelId()
  try {
    if (trousseau) await SecureStore.setItemAsync(CLE, neuf)
    else await AsyncStorage.setItem(CLE, neuf)
  } catch {
    // Écriture impossible : l'identifiant ne vaut que pour ce lancement. Le
    // décompte reste juste sur l'instant, il perd seulement sa stabilité.
  }
  return neuf
}

/** L'identifiant de cet appareil. Stable, opaque, sans lien avec un compte. */
export function idAppareil(): Promise<string> {
  if (!promesse) promesse = lireOuCreer()
  return promesse
}

// ── La place ───────────────────────────────────────────────────────────────

export type EtatPlace = 'attente' | 'accordee' | 'refusee'

type Reponse = { accorde?: boolean; code?: string; plafond?: number | null }

/** Rend la place tout de suite. Au mieux : un échec la laisse expirer seule. */
export async function rendrePlace(sessionId: string): Promise<void> {
  try {
    const appareil = await idAppareil()
    await supabase.rpc('rendre_place_appareil', {
      p_session_id: sessionId,
      p_appareil: appareil,
    })
  } catch { /* elle expirera d'elle-même en quatre-vingt-dix secondes */ }
}

/**
 * Tient la place de cet appareil tant que `actif` est vrai.
 *
 * ⚠️ À monter **uniquement sur un écran qui compte**. L'assiette est « les
 * appareils qui comptent en même temps » : un téléphone posé sur l'écran d'un
 * inventaire ne compte pas, et lui faire prendre une place priverait un
 * collègue de la sienne.
 *
 * ⚠️ La place est **rendue au démontage**, sans attendre l'expiration : sur un
 * forfait plein, un collègue qui prend le relais attendrait sinon une minute
 * et demie pour rien.
 */
export function usePlaceAppareil(sessionId: string | undefined, actif: boolean) {
  const [etat, setEtat] = useState<EtatPlace>('attente')
  const [plafond, setPlafond] = useState<number | null>(null)
  const [essai, setEssai] = useState(0)
  const vivantRef = useRef(true)

  useEffect(() => {
    if (!sessionId || !actif) return
    let vivant = true
    vivantRef.current = true
    let minuterie: ReturnType<typeof setTimeout> | null = null

    const battre = async () => {
      let refuse = false
      try {
        const appareil = await idAppareil()
        const { data, error } = await supabase.rpc('prendre_place_appareil', {
          p_session_id: sessionId,
          p_appareil: appareil,
        })
        if (!vivant) return
        const r = (data ?? null) as Reponse | null
        // Borne n° 3 : seul un `forfait_plein` explicite ferme la porte. Une
        // erreur réseau, un serveur muet, un code qu'on ne connaît pas —
        // tout le reste accorde.
        if (!error && r && r.accorde === false && r.code === 'forfait_plein') {
          refuse = true
          setPlafond(typeof r.plafond === 'number' ? r.plafond : null)
          setEtat('refusee')
        } else {
          if (!error && r && typeof r.plafond === 'number') setPlafond(r.plafond)
          setEtat('accordee')
        }
      } catch {
        if (!vivant) return
        setEtat('accordee')
      }
      if (!vivant) return
      minuterie = setTimeout(() => { void battre() }, refuse ? CADENCE_REFUS_MS : CADENCE_MS)
    }

    void battre()

    return () => {
      vivant = false
      vivantRef.current = false
      if (minuterie) clearTimeout(minuterie)
      void rendrePlace(sessionId)
    }
  }, [sessionId, actif, essai])

  const reessayer = useCallback(() => {
    setEtat('attente')
    setEssai((n) => n + 1)
  }, [])

  return { etat, plafond, reessayer }
}
