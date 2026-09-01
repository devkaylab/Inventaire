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
  | 'guide-demarrage'    // le bandeau de démarrage du superviseur
  | 'compter-auditer'    // les deux lignes sous les boutons de l'inventaire
  | 'premiere-balise'    // le volet « balise ouverte, scannez les articles »
  | 'balise-terminee'    // la première clôture
  | 'menu-inventaire'    // où se lisent les écarts, le rapport et l'export
  | 'notifications'      // l'amorce avant la boîte système des notifications
  | 'balayage'           // le geste caché de la liste d'inventaires
  | 'file-attente'       // « comptées » vient du serveur, « en attente » non
  | 'modes-de-scan'      // caméra, saisie, douchette — la douchette est invisible
  | 'corriger-scan'      // le « − » de la liste, au deuxième scan d'un article
  | 'balises-vocabulaire' // balise, emplacement, plage — les trois mots du produit
  | 'fichiers-roles'      // référencement vs stock théorique : lequel fait foi

const cle = (repere: Repere, userId: string) => `repere.${repere}.${userId}`

/* ─── Ce qui change le stockage prévient les écrans ────────────────────────
 *
 * Un écran lit le stockage à son montage. Sans cet avertissement, il garde
 * cet état tant qu'il vit : « Revoir les repères », déclenché depuis « Mon
 * compte », effaçait bien les clés mais l'accueil ne les relisait qu'au
 * prochain lancement de l'application — on appuyait, rien ne se passait, et
 * le bouton semblait cassé (constat du 23 août 2026).
 *
 * ⚠️ **On prévient APRÈS l'écriture, jamais avant** : les écrans vont relire
 * le stockage, il doit déjà être à jour. C'est aussi ce qui évite qu'un
 * repère tout juste fermé réapparaisse.
 *
 * Cela remplace une relecture au retour sur l'écran (`useFocusEffect`), qui
 * aurait laissé de côté le seul appelant qui n'est pas un écran : la porte de
 * bienvenue, posée en surcouche du layout racine — donc précisément l'écran
 * que « Revoir les repères » nomme en premier.
 */
const abonnes = new Set<() => void>()

function prevenir() {
  for (const relire of [...abonnes]) relire()
}

function sAbonner(relire: () => void) {
  abonnes.add(relire)
  return () => { abonnes.delete(relire) }
}

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
  prevenir()
}

/** Oublie tous les repères d'un compte — « Revoir les repères », Mon compte. */
export async function oublierReperes(userId: string): Promise<void> {
  const cles: Repere[] = ['bienvenue', 'guide-demarrage', 'compter-auditer', 'premiere-balise', 'balise-terminee', 'balayage', 'menu-inventaire', 'notifications', 'file-attente', 'modes-de-scan', 'corriger-scan', 'balises-vocabulaire', 'fichiers-roles']
  try {
    await AsyncStorage.multiRemove(cles.map(r => cle(r, userId)))
  } catch {
    // Idem : sans conséquence.
  }
  prevenir()
}

/**
 * État d'un repère pour un écran.
 *
 * `pret` distingue « pas encore lu le stockage » de « déjà vu » : sans lui,
 * l'écran afficherait le repère un instant à chaque montage, puis le
 * retirerait — un clignotement à chaque ouverture.
 *
 * Lecture au montage, **et à chaque fois que le stockage change** : c'est ce
 * qui rend « Revoir les repères » visible tout de suite.
 */
export function useRepere(repere: Repere, userId: string | null | undefined) {
  // ⚠️ **L'état porte le compte qu'il décrit** (`uid`). Sans cela il faudrait
  // le remettre à zéro dans l'effet, à chaque changement de compte — c'est
  // exactement le `setState` synchrone que React déconseille, et l'état d'une
  // personne s'afficherait un instant à la suivante.
  const [etat, setEtat] = useState<{ uid: string | null; lu: boolean; vu: boolean }>(
    { uid: null, lu: false, vu: false },
  )

  const relire = useCallback(() => {
    if (!userId) return
    let vivant = true
    void repereVu(repere, userId).then(vu => {
      if (vivant) setEtat({ uid: userId, lu: true, vu })
    })
    return () => { vivant = false }
  }, [repere, userId])

  useEffect(relire, [relire])
  useEffect(() => sAbonner(relire), [relire])

  const marquerVu = useCallback(() => {
    if (!userId) return
    setEtat({ uid: userId, lu: true, vu: true })
    void marquerRepereVu(repere, userId)
  }, [repere, userId])

  const pret = !!userId && etat.uid === userId && etat.lu
  return { aVoir: pret && !etat.vu, pret, marquerVu }
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
  prevenir()
}

/**
 * Le jalon d'un écran, **relu dès qu'il est posé**.
 *
 * L'accueil du superviseur reste monté pendant qu'on imprime ses balises
 * depuis la boîte à outils : une lecture au seul montage lui laisserait
 * afficher l'étape 1 après qu'elle a été faite. Il s'abonne donc, comme les
 * repères — un seul mécanisme pour les deux, et aucune dépendance à la
 * navigation.
 */
export function useJalon(jalon: Jalon, userId: string | null | undefined) {
  // Même forme que `useRepere`, et pour la même raison : l'état porte le
  // compte qu'il décrit.
  const [etat, setEtat] = useState<{ uid: string | null; lu: boolean; pose: boolean }>(
    { uid: null, lu: false, pose: false },
  )

  const relire = useCallback(() => {
    if (!userId) return
    let vivant = true
    void jalonPose(jalon, userId).then(pose => {
      if (vivant) setEtat({ uid: userId, lu: true, pose })
    })
    return () => { vivant = false }
  }, [jalon, userId])

  useEffect(relire, [relire])
  useEffect(() => sAbonner(relire), [relire])

  const pret = !!userId && etat.uid === userId && etat.lu
  return { pose: pret && etat.pose, pret }
}
