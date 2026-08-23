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
import { useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Repere =
  | 'bienvenue'          // l'écran nominatif de première ouverture
  | 'guide-demarrage'    // le bandeau de démarrage du superviseur
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

/* ─── Les jalons : un fait que la base ne garde pas ────────────────────────
 *
 * ⚠️ **À ne pas confondre avec un repère.** Un repère est une aide qui ne se
 * montre qu'une fois ; un jalon est un **fait**, noté ici faute de trace
 * ailleurs. Le seul à ce jour : une planche de balises produite. Elle est
 * dessinée sur le téléphone depuis le 21 août 2026 et **n'écrit rien en
 * base** — sans ce jalon, l'étape « Générer mes balises » du bandeau de
 * démarrage ne pourrait jamais se cocher toute seule.
 *
 * Conséquence assumée : le jalon est **local**. Changer de téléphone remet
 * l'étape à faire. C'est le prix de l'absence de trace serveur, et c'est
 * moins grave que l'inverse — une étape à refaire coûte un appui, une étape
 * cochée à tort ferait mentir le bandeau.
 *
 * `oublierReperes` **ne les efface pas** : « Revoir les repères » rejoue les
 * aides, il ne défait pas ce qui a été fait.
 */
export type Jalon = 'balises-imprimees'

const cleJalon = (jalon: Jalon, userId: string) => `jalon.${jalon}.${userId}`

export async function jalonPose(jalon: Jalon, userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(cleJalon(jalon, userId))) === '1'
  } catch {
    // Stockage indisponible : on ne prétend pas que c'est fait.
    return false
  }
}

export async function poserJalon(jalon: Jalon, userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(cleJalon(jalon, userId), '1')
  } catch {
    // Sans effet : au pire l'étape reste à faire.
  }
}

/**
 * Le jalon d'un écran, **relu à chaque retour dessus**.
 *
 * C'est tout l'intérêt du `useFocusEffect` : on revient précisément de
 * l'écran qui vient de poser le jalon (la boîte à outils, pour les balises).
 * Une lecture au seul montage laisserait le bandeau afficher l'étape 1 après
 * qu'elle a été faite.
 */
export function useJalon(jalon: Jalon, userId: string | null | undefined) {
  const [pret, setPret] = useState(false)
  const [pose, setPose] = useState(false)

  const relire = useCallback(() => {
    let vivant = true
    if (!userId) { setPret(false); setPose(false); return }
    void jalonPose(jalon, userId).then(v => {
      if (!vivant) return
      setPose(v)
      setPret(true)
    })
    return () => { vivant = false }
  }, [jalon, userId])

  useFocusEffect(relire)

  return { pose, pret }
}
