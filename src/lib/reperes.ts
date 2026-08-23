/**
 * Les repères d'onboarding : ce qui ne se montre qu'une fois.
 *
 * ⚠️ **Pas de drapeau global.** L'ancien tutoriel avait un `firstRun` unique
 * qui commandait tout ; la règle du projet interdit de le recréer. Ici chaque
 * repère a sa propre clé, nommée, et aucun n'en réveille un autre.
 *
 * **Une fois par appareil ET par compte** (décision de Julien, 23 août 2026,
 * modèle YOOBIC). Le stockage est local, donc l'appareil est implicite ; le
 * compte entre dans la clé parce qu'un téléphone de magasin passe de main en
 * main — la personne suivante doit être accueillie à son tour. Et quelqu'un
 * qui change de téléphone retrouve ses repères.
 */
import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Repere =
  | 'bienvenue'          // l'écran nominatif de première ouverture
  | 'guide-demarrage'    // « Pour démarrer », le guide du superviseur
  | 'compter-auditer'    // les deux lignes sous les boutons de l'inventaire
  | 'premiere-balise'    // le volet « balise ouverte, scannez les articles »
  | 'balise-terminee'    // la première clôture
  | 'balayage'           // le geste caché de la liste d'inventaires

const cle = (repere: Repere, userId: string) => `repere.${repere}.${userId}`

export async function repereVu(repere: Repere, userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(cle(repere, userId))) === '1'
  } catch {
    // Un stockage indisponible ne doit pas bloquer le travail : on considère
    // le repère comme déjà vu plutôt que de le montrer en boucle.
    return true
  }
}

export async function marquerRepereVu(repere: Repere, userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(cle(repere, userId), '1')
  } catch {
    // Sans effet : au pire le repère se remontrera une fois.
  }
}

/** Oublie tous les repères d'un compte — « Revoir les repères », Mon compte. */
export async function oublierReperes(userId: string): Promise<void> {
  const cles: Repere[] = ['bienvenue', 'guide-demarrage', 'compter-auditer', 'premiere-balise', 'balise-terminee', 'balayage']
  try {
    await AsyncStorage.multiRemove(cles.map(r => cle(r, userId)))
  } catch {
    // Idem : sans conséquence.
  }
}

/**
 * État d'un repère pour un écran.
 *
 * `pret` distingue « pas encore lu le stockage » de « déjà vu » : sans lui,
 * l'écran afficherait le repère un instant à chaque montage, puis le
 * retirerait — un clignotement à chaque ouverture.
 */
export function useRepere(repere: Repere, userId: string | null | undefined) {
  const [pret, setPret] = useState(false)
  const [aVoir, setAVoir] = useState(false)

  useEffect(() => {
    let vivant = true
    if (!userId) { setPret(false); setAVoir(false); return }
    void repereVu(repere, userId).then(vu => {
      if (!vivant) return
      setAVoir(!vu)
      setPret(true)
    })
    return () => { vivant = false }
  }, [repere, userId])

  const marquerVu = useCallback(() => {
    setAVoir(false)
    if (userId) void marquerRepereVu(repere, userId)
  }, [repere, userId])

  return { aVoir: pret && aVoir, pret, marquerVu }
}
