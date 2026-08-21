import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Redirect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BaliseCreator } from '@/components/BaliseCreator'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

/**
 * Boîte à outils — ce dont un superviseur a besoin en dehors d'un inventaire.
 *
 * Même contenu que /outils sur le site : imprimer ses balises, et retrouver la
 * prise en main de l'application quand elle existera. La création de balises
 * reste aussi dans l'écran Zones d'un inventaire : c'est le même composant, on
 * ne duplique pas la logique de série.
 */
export default function ToolsScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { profile } = useAuth()


  // Ces trois écrans sont le travail du superviseur. Ils vivent dans la pile de
  // « Mon compte » pour que la flèche de retour y ramène ; la garde de rôle,
  // que portait le groupe `(supervisor)`, se pose donc ici. Les RPC refusent
  // déjà un compteur côté serveur — ceci lui évite un écran en erreur.
  if (profile?.role !== 'supervisor') return <Redirect href="/(compte)/account" />

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <BaliseCreator context="profile" />

        <View style={styles.card}>
          <Text style={styles.title}>Prise en main de l&apos;application</Text>
          <Text style={styles.text}>
            Le parcours de découverte, à retrouver ici quand il sera prêt, pour le refaire ou le
            montrer à une nouvelle recrue.
          </Text>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Bientôt</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
    card: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard,
    },
    title: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary },
    text: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 18 },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      backgroundColor: t.warningSoft, borderRadius: Radius.pill,
      paddingHorizontal: 10, paddingVertical: 4, marginTop: Spacing.xs,
    },
    badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.warning },
    badgeText: { fontSize: 11, fontFamily: Font.semibold, color: t.warning },
  })
}
