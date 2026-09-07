import { router } from 'expo-router'

/**
 * Sortir du tunnel de préparation, vers la fiche de l'inventaire.
 *
 * ⚠️ **ON VIDE LA PILE AVANT D'OUVRIR LA FICHE, ET C'EST OBLIGATOIRE.**
 *
 * Depuis que les étapes s'EMPILENT (pour qu'on puisse revenir sur ses pas —
 * demande de Julien, 7 septembre 2026), la pile vaut au dernier écran
 * `[liste, zones, fichiers, compteurs]`. Un simple `replace` ne changerait que
 * le dernier : la flèche de la fiche renverrait alors DANS le tunnel qu'on
 * vient de quitter, étape par étape.
 *
 * `dismissAll` revient au premier écran de la pile (la liste), et le `push`
 * pose la fiche par-dessus : la flèche y ramène à la liste, comme partout
 * ailleurs. Ne pas « simplifier » en un `replace`.
 *
 * ⚠️ **Une seule définition, appelée par les deux sorties** — « Commencer
 * l'inventaire » au bout du tunnel, et « Plus tard » à chacune des trois
 * étapes. Deux copies divergeraient au premier ajustement, et c'est justement
 * l'endroit où une divergence ne se voit pas : les deux mèneraient au bon
 * écran, l'une laisserait le tunnel derrière elle.
 */
export function quitterLeTunnel(sessionId: string) {
  router.dismissAll()
  router.push(`/(supervisor)/${sessionId}`)
}
