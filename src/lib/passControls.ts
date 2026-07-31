import { Alert } from 'react-native'
import { passLabel } from '@/constants/colors'

// Shared confirmation flow for stepping the session back one pass.
// First the user chooses what happens to the counts of the pass being left
// (keep or delete); deleting asks for a second, explicit confirmation because
// it is irreversible. `onConfirm` receives whether to delete those counts.
export function promptRevertPass(currentPass: number, onConfirm: (deleteCounts: boolean) => void) {
  const prev = currentPass - 1
  Alert.alert(
    `Revenir en ${passLabel(prev)}`,
    `La session repassera en ${passLabel(prev)} et toute l'équipe pourra de nouveau compter.\n\nQue faire des comptages déjà saisis dans la passe « ${passLabel(currentPass)} » ?`,
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Conserver les comptages', onPress: () => onConfirm(false) },
      {
        text: 'Supprimer ces comptages',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Supprimer les comptages ?',
            `Tous les scans de la passe « ${passLabel(currentPass)} » seront définitivement supprimés. Cette action est irréversible.`,
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: () => onConfirm(true) },
            ]
          ),
      },
    ]
  )
}
