import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { Font, Radius, Spacing, tabular } from '@/constants/ink'
import { useTheme } from '@/lib/theme'

/**
 * Bandeau « scans en attente d'envoi ».
 *
 * Ce que le compteur doit savoir tient en une phrase : **son travail n'est pas
 * perdu**. Sans ce repère, quelqu'un qui voit le réseau tomber en réserve
 * rescanne par précaution, et fausse l'inventaire par des doublons — la panne
 * réseau se transforme alors en erreur de comptage.
 *
 * D'où le parti pris : ton neutre plutôt qu'alarmant, chiffre précis, et un
 * appui pour forcer l'envoi. Rien ne s'affiche quand la file est vide.
 */
export function OfflineBanner({
  pending,
  syncing,
  onPress,
}: {
  pending: number
  syncing: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  if (pending === 0) return null

  return (
    <Pressable
      onPress={onPress}
      disabled={syncing}
      accessibilityRole="button"
      accessibilityLabel={`${pending} scan${pending > 1 ? 's' : ''} en attente d'envoi. Toucher pour envoyer maintenant.`}
      style={[styles.wrap, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}
    >
      <View style={styles.left}>
        <Text style={[styles.count, tabular, { color: theme.textPrimary }]}>{pending}</Text>
        <View style={styles.labels}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {pending > 1 ? 'enregistrements en attente' : 'enregistrement en attente'}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {syncing ? 'Envoi en cours…' : 'Conservés sur le téléphone. Envoi dès le retour du réseau.'}
          </Text>
        </View>
      </View>
      {syncing ? (
        <ActivityIndicator color={theme.textSecondary} />
      ) : (
        <Text style={[styles.action, { color: theme.textSecondary }]}>Envoyer</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 1 },
  labels: { flexShrink: 1 },
  count: { fontFamily: Font.extrabold, fontSize: 22 },
  title: { fontFamily: Font.semibold, fontSize: 14 },
  sub: { fontFamily: Font.regular, fontSize: 12, marginTop: 2 },
  action: { fontFamily: Font.semibold, fontSize: 13 },
})
