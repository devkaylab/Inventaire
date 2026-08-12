import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { router } from 'expo-router'

import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { baliseSummary } from '@/components/OfflineBanner'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useTheme } from '@/lib/theme'

/**
 * Ligne « balises en attente d'envoi », à poser sous les balises manquantes.
 *
 * Même forme que celle des manquantes, et pour la même raison : les deux
 * répondent à « qu'est-ce qui n'est pas fini », et un superviseur ne devrait pas
 * avoir à apprendre deux vocabulaires pour deux problèmes voisins.
 *
 * La distinction reste nette dans le libellé : une balise **manquante** n'a
 * jamais été comptée, une balise **en attente** l'a été mais dort encore sur ce
 * téléphone. Confondre les deux ferait renvoyer quelqu'un compter un rayon déjà
 * fait.
 *
 * Ne s'affiche que si ce téléphone retient quelque chose.
 */
export function PendingBalisesRow({ sessionId, target }: { sessionId: string; target: string }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queue = useOfflineQueue(sessionId)

  if (queue.pending === 0) return null

  return (
    <Pressable style={styles.row} onPress={() => router.push(target as never)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.count}>
          {queue.pending} balise{queue.pending > 1 ? 's' : ''} en attente d&apos;envoi
        </Text>
        <Text style={styles.codes}>{baliseSummary(queue.balises)}</Text>
        <Text style={styles.hint}>
          {queue.syncing
            ? 'Envoi en cours…'
            : 'Comptée sur ce téléphone, pas encore sur le serveur'}
        </Text>
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d="M9 6l6 6-6 6" stroke={theme.warning} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Pressable>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: t.warningSoft,
      borderColor: t.warning,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.lg,
      marginTop: Spacing.md,
    },
    count: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    codes: { fontSize: 13, fontFamily: Font.bold, color: t.textPrimary, marginTop: 2, ...tabular },
    hint: { fontSize: 12, fontFamily: Font.medium, color: t.textSecondary, marginTop: 2 },
  })
