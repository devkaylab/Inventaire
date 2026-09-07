import { useCallback, useRef } from 'react'
import { useFocusEffect } from 'expo-router'

/**
 * Rejoue `faire` chaque fois qu'on REVIENT sur l'écran — jamais à son premier
 * affichage.
 *
 * Le cas qui l'a fait écrire (7 septembre 2026, constaté sur le Pixel) : on
 * compte deux pièces, on revient sur la fiche de l'inventaire, et elle annonce
 * « 0 pièce comptée ». Les pièces étaient bien en base ; c'est le cache de la
 * requête, chargée au montage et jamais relue. L'écran porte de quoi le
 * rafraîchir à la main, mais on vient de compter — lire zéro à cet instant
 * précis fait douter d'un travail qui a bel et bien été enregistré.
 *
 * ⚠️ **Le premier passage est sauté, et ce n'est pas un raffinement.**
 * `useFocusEffect` se déclenche aussi au montage : sans ce garde-fou, chaque
 * ouverture d'écran ferait deux allers-retours au serveur pour la même
 * réponse — sur un téléphone au fond d'une réserve, c'est un chargement de
 * plus à attendre pour rien.
 *
 * ⚠️ **`faire` doit être stable** (`useCallback`) : c'est la dépendance de
 * l'abonnement. Un callback recréé à chaque rendu réabonnerait l'effet en
 * boucle — le premier passage, lui, resterait consommé, donc le défaut ne se
 * verrait pas tout de suite.
 *
 * ⚠️ **Ce n'est pas `refetchOnWindowFocus` de react-query** : celui-là suit
 * l'état de l'APPLICATION (premier plan / arrière-plan), pas la navigation.
 * Revenir de l'écran de comptage ne le déclenche jamais — l'application n'a
 * pas quitté le premier plan.
 */
export function useRetourSurEcran(faire: () => void) {
  const premierPassage = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (premierPassage.current) {
        premierPassage.current = false
        return
      }
      faire()
    }, [faire]),
  )
}
