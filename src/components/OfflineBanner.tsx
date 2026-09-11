import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { Font, Radius, Spacing, tabular } from '@/constants/ink'
import { NO_BALISE, type PendingBalise } from '@/lib/offlineSync'
import { useTheme } from '@/lib/theme'
import { t, tn } from '@/lib/i18n'

/**
 * Libellé d'une balise en attente. Le **numéro est obligatoire** : c'est la
 * seule information sur laquelle une équipe peut agir. « 412 scans en attente »
 * ne dit pas quoi faire ; « balise 5375 pas encore remontée » envoie quelqu'un
 * au bon endroit.
 */
export function baliseLabel(b: PendingBalise): string {
  if (b.code === NO_BALISE) return t('Sans balise')
  return b.name ? `${b.code} · ${b.name}` : b.code
}

/** Résumé court : « 5375, 5376 et 2 autres ». */
export function baliseSummary(balises: PendingBalise[], max = 3): string {
  const codes = balises.map((b) => (b.code === NO_BALISE ? t('sans balise') : b.code))
  if (codes.length <= max) return codes.join(', ')
  return tn('%{liste} et %{count} autre', '%{liste} et %{count} autres', codes.length - max, { liste: codes.slice(0, max).join(', ') })
}

/**
 * Bandeau « balises en attente d'envoi », sur l'écran de scan.
 *
 * Ce que le compteur doit savoir tient en une phrase : **son travail n'est pas
 * perdu**. Sans ce repère, quelqu'un qui voit le réseau tomber rescanne par
 * précaution et fausse l'inventaire par des doublons — la panne réseau se
 * transforme alors en erreur de comptage.
 *
 * L'appui force l'envoi, mais ce n'est qu'un raccourci : la remontée est
 * automatique, et le texte le dit pour que personne ne croie devoir y penser.
 */
export function OfflineBanner({
  balises,
  syncing,
  onPress,
}: {
  balises: PendingBalise[]
  syncing: boolean
  onPress: () => void
}) {
  const theme = useTheme()
  if (balises.length === 0) return null

  const n = balises.length
  return (
    <Pressable
      onPress={onPress}
      disabled={syncing}
      accessibilityRole="button"
      accessibilityLabel={tn("%{count} balise en attente d'envoi : %{liste}. Envoi automatique au retour du réseau.", "%{count} balises en attente d'envoi : %{liste}. Envoi automatique au retour du réseau.", n, { liste: baliseSummary(balises, 10) })}
      style={[styles.wrap, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}
    >
      <View style={styles.left}>
        <Text style={[styles.count, tabular, { color: theme.textPrimary }]}>{n}</Text>
        <View style={styles.labels}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {n > 1 ? t('balises en attente') : t('balise en attente')}
          </Text>
          <Text style={[styles.codes, tabular, { color: theme.textPrimary }]} numberOfLines={2}>
            {baliseSummary(balises)}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {syncing ? t('Envoi en cours…') : t('Envoi automatique dès le retour du réseau')}
          </Text>
        </View>
      </View>
      {syncing && <ActivityIndicator color={theme.textSecondary} />}
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
  codes: { fontFamily: Font.bold, fontSize: 13, marginTop: 1 },
  sub: { fontFamily: Font.regular, fontSize: 12, marginTop: 2 },
})
