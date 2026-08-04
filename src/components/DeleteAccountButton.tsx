import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyDeletionRequest, requestAccountDeletion } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

/**
 * Bouton « Supprimer mon compte » : envoie une demande de suppression à
 * l'administrateur (qui la traite). Affiche l'état « en attente » si une
 * demande est déjà en cours. Partagé par les écrans superviseur et employé.
 */
export function DeleteAccountButton() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const { data: pending } = useQuery({
    queryKey: ['my-deletion-request'],
    queryFn: getMyDeletionRequest,
  })

  async function submit() {
    setLoading(true)
    try {
      const res = await requestAccountDeletion()
      if (!res.success) {
        Alert.alert('Erreur', res.error ?? "Impossible d'envoyer la demande.")
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] })
      Alert.alert(
        'Demande envoyée',
        "Votre demande de suppression a été transmise à l'administrateur. Il la traitera prochainement ; votre compte et vos données personnelles seront alors supprimés.",
      )
    } catch (e) {
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  function confirm() {
    Alert.alert(
      'Supprimer mon compte',
      "Une demande de suppression sera envoyée à l'administrateur. Une fois traitée, votre compte et vos données personnelles seront supprimés définitivement. Continuer ?",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer la demande', style: 'destructive', onPress: submit },
      ],
    )
  }

  if (pending) {
    return (
      <View style={styles.pendingBox}>
        <Text style={styles.pendingText}>
          Suppression de compte demandée — en attente de traitement par l'administrateur.
        </Text>
      </View>
    )
  }

  return (
    <Pressable style={styles.btn} onPress={confirm} disabled={loading} hitSlop={8}>
      {loading ? (
        <ActivityIndicator color={theme.danger} />
      ) : (
        <Text style={styles.btnText}>Supprimer mon compte</Text>
      )}
    </Pressable>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    btn: { alignItems: 'center', paddingVertical: Spacing.md },
    btnText: { color: t.danger, fontSize: 14, fontFamily: Font.medium, textDecorationLine: 'underline' },
    pendingBox: { backgroundColor: t.warningSoft, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
    pendingText: { color: t.warning, fontSize: 13, fontFamily: Font.medium, lineHeight: 18, textAlign: 'center' },
  })
}
