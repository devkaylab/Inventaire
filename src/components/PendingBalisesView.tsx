import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { baliseLabel } from '@/components/OfflineBanner'
import type { PendingBalise } from '@/lib/offlineSync'
import { depuis } from '@/lib/temps'
import { useTheme } from '@/lib/theme'

/**
 * Détail des balises qui n'ont pas encore rejoint le serveur.
 *
 * Écran partagé par le superviseur et le compteur : la question qu'ils se posent
 * est la même — « qu'est-ce qui n'est pas encore remonté, et depuis quand ». Le
 * numéro de balise est mis en avant, c'est lui qui permet d'aller vérifier sur
 * le terrain.
 */
export function PendingBalisesView({
  balises,
  syncing,
  offline,
  onSync,
}: {
  balises: PendingBalise[]
  syncing: boolean
  offline: boolean
  onSync: () => void
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)

  if (balises.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Tout est remonté</Text>
        <Text style={styles.emptyBody}>
          Aucune balise en attente sur ce téléphone. Les comptages sont enregistrés sur le serveur.
        </Text>
      </View>
    )
  }

  const totalScans = balises.reduce((n, b) => n + b.scans, 0)

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>
          {balises.length} balise{balises.length > 1 ? 's' : ''} en attente
        </Text>
        <Text style={styles.headSub}>
          {totalScans} article{totalScans > 1 ? 's' : ''} compté{totalScans > 1 ? 's' : ''} conservé
          {totalScans > 1 ? 's' : ''} sur ce téléphone.{' '}
          {offline
            ? "L'envoi repartira seul dès que le réseau sera capté."
            : 'Envoi en cours dès que possible.'}
        </Text>
      </View>

      {balises.map((b) => (
        <View key={b.code} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.code, tabular]}>{baliseLabel(b)}</Text>
            <Text style={styles.meta}>
              {b.scans} article{b.scans > 1 ? 's' : ''}
              {b.units !== b.scans ? ` · ${b.units} pièce${Math.abs(b.units) > 1 ? 's' : ''}` : ''}
              {' · '}
              {depuis(b.since, { minutes: true })}
            </Text>
            {b.hasBaliseOp && (
              <Text style={styles.flag}>Ouverture ou clôture de balise également en attente</Text>
            )}
          </View>
          <View style={styles.dot} />
        </View>
      ))}

      <Pressable style={styles.button} onPress={onSync} disabled={syncing}>
        {syncing ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={styles.buttonText}>Réessayer maintenant</Text>
        )}
      </Pressable>
      <Text style={styles.footnote}>
        Ce bouton n&apos;est qu&apos;un raccourci : l&apos;envoi se fait tout seul dès que le
        téléphone retrouve du réseau, sans que personne ait à y penser.
      </Text>
    </ScrollView>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    content: { padding: Spacing.lg, gap: Spacing.md },
    center: {
      flex: 1,
      backgroundColor: t.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xxl,
      gap: Spacing.sm,
    },
    emptyTitle: { fontFamily: Font.bold, fontSize: 17, color: t.textPrimary },
    emptyBody: { fontFamily: Font.regular, fontSize: 14, color: t.textSecondary, textAlign: 'center' },
    head: { gap: 4, marginBottom: Spacing.xs },
    headTitle: { fontFamily: Font.extrabold, fontSize: 20, color: t.textPrimary, letterSpacing: -0.3 },
    headSub: { fontFamily: Font.regular, fontSize: 13, color: t.textSecondary, lineHeight: 19 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: t.hairline,
      ...t.shadowCard,
    },
    code: { fontFamily: Font.bold, fontSize: 16, color: t.textPrimary, letterSpacing: -0.2 },
    meta: { fontFamily: Font.medium, fontSize: 13, color: t.textSecondary, marginTop: 2, ...tabular },
    flag: { fontFamily: Font.medium, fontSize: 12, color: t.warning, marginTop: 4 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.warning },
    button: {
      backgroundColor: t.accent,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.sm,
      ...t.shadowButton,
    },
    buttonText: { fontFamily: Font.bold, fontSize: 15, color: t.onAccent },
    footnote: {
      fontFamily: Font.regular,
      fontSize: 12,
      color: t.textMuted,
      textAlign: 'center',
      lineHeight: 17,
    },
  })
