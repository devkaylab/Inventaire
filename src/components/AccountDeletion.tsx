import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyDeletionRequest, requestAccountDeletion } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { demander, signaler } from '@/lib/dialogue'

/**
 * Demande de suppression de compte.
 *
 * La logique est dans le hook, l'apparence dans qui l'appelle : « Mon compte »
 * l'affiche comme une ligne de menu au milieu des autres, en rouge et en
 * dernier. Le lien souligné qui traînait en pied de l'écran compteur a
 * disparu avec le reste — le compte se gère au même endroit pour tout le
 * monde.
 */
export function useAccountDeletion() {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const { data: pending } = useQuery({
    queryKey: ['my-deletion-request'],
    queryFn: getMyDeletionRequest,
  })

  async function submit() {
    // Deux appuis rapprochés sur la ligne de menu enverraient deux demandes.
    if (loading) return
    setLoading(true)
    try {
      const res = await requestAccountDeletion()
      if (!res.success) {
        signaler.erreur('Erreur', res.error ?? "Impossible d'envoyer la demande.")
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['my-deletion-request'] })
      signaler.succes(
        'Demande envoyée',
        "Votre demande de suppression a été transmise à l'administrateur. Il la traitera prochainement ; votre compte et vos données personnelles seront alors supprimés.",
      )
    } catch (e) {
      signaler.erreur('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  function confirm() {
    void demander({
      titre: 'Supprimer mon compte ?',
      texte: "Une demande de suppression sera envoyée à l'administrateur. Une fois traitée, votre compte et vos données personnelles seront supprimés définitivement.",
      action: 'Envoyer la demande',
      ton: 'danger',
    }).then((ok) => { if (ok) submit() })
  }

  return { pending: !!pending, loading, confirm }
}

/** Bandeau « demande en cours », à poser sous une ligne de menu. */
export function DeletionPendingNote() {
  const styles = makeStyles(useTheme())
  return (
    <View style={styles.pendingBox}>
      <Text style={styles.pendingText}>
        Suppression de compte demandée — en attente de traitement par l&apos;administrateur.
      </Text>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    pendingBox: { backgroundColor: t.warningSoft, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
    pendingText: { color: t.warning, fontSize: 13, fontFamily: Font.medium, lineHeight: 18, textAlign: 'center' },
  })
}
