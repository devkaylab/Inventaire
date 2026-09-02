/**
 * Le signal qui dit si la porte de bienvenue est à l'écran.
 *
 * ⚠️ **Elle n'est pas une route**, elle est posée en surcouche du layout
 * racine. `BarreEtat` (`app/_layout.tsx`) choisit le style de la barre d'état
 * à partir du segment de route : elle ne pouvait donc pas la voir, et laissait
 * l'heure, le réseau et la batterie en **blanc sur le fond clair de la
 * porte** — le défaut corrigé le 24 août 2026 pour la connexion, resté ouvert
 * ici parce que la porte n'a pas de segment. Constaté sur la capture du
 * 2 septembre 2026.
 *
 * ⚠️ Un `<StatusBar>` posé par la porte elle-même ne convient pas :
 * `expo-status-bar` ne restaure rien au démontage, le style resterait
 * appliqué à l'écran suivant. C'est la raison déjà écrite dans `_layout.tsx`,
 * et elle vaut ici. D'où ce signal, qui ne sert qu'à ça.
 */
import { useSyncExternalStore } from 'react'

let visible = false
const abonnes = new Set<() => void>()

export function poserPorteVisible(v: boolean) {
  if (visible === v) return
  visible = v
  abonnes.forEach((prevenir) => prevenir())
}

export function usePorteVisible() {
  return useSyncExternalStore(
    (prevenir) => { abonnes.add(prevenir); return () => { abonnes.delete(prevenir) } },
    () => visible,
    () => false,
  )
}
