import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { exportMyData } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

/**
 * Droit d'accès et de portabilité (articles 15 et 20 du RGPD).
 *
 * La base assemble l'export (`export_my_data`), le téléphone en fait un
 * fichier et le remet par la fenêtre de partage — rien ne transite par un
 * serveur tiers. Aucun code d'accès n'y figure, et le détail ligne à ligne des
 * inventaires n'y est que résumé : l'employeur en est responsable de
 * traitement, l'export le dit lui-même et renvoie vers lui.
 */
export default function MyDataScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [busy, setBusy] = useState(false)

  async function telecharger() {
    setBusy(true)
    try {
      const data = await exportMyData()
      const filename = `quantinvo-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
      const file = new File(Paths.cache, filename)
      if (file.exists) file.delete()
      file.create()
      file.write(JSON.stringify(data, null, 2))

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Mes données Quantinvo',
          UTI: 'public.json',
        })
      } else {
        Alert.alert('Fichier créé', `Vos données ont été enregistrées dans ${filename}.`)
      }
    } catch (e) {
      Alert.alert('Export impossible', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Une copie de vos données</Text>
          <Text style={styles.text}>
            Votre profil, vos inventaires, vos invitations et vos demandes, dans un fichier
            lisible et réutilisable.
          </Text>

          <Pressable style={[styles.btn, busy && styles.btnOff]} onPress={telecharger} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.btnText}>Télécharger mes données</Text>
            )}
          </Pressable>

          <Text style={styles.note}>
            Le fichier s&apos;ouvre dans la fenêtre de partage : enregistrez-le dans Fichiers, ou
            envoyez-le où vous voulez. Aucun code d&apos;accès n&apos;y figure, et le détail de
            chaque comptage appartient à votre employeur — adressez-vous à lui pour en obtenir le
            détail.
          </Text>
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
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    title: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary },
    text: {
      fontSize: 13, color: t.textSecondary, fontFamily: Font.regular,
      lineHeight: 19, marginTop: Spacing.sm,
    },
    btn: {
      marginTop: Spacing.lg, backgroundColor: t.accent, borderRadius: Radius.md,
      paddingVertical: 14, alignItems: 'center', ...t.shadowButton,
    },
    btnOff: { opacity: 0.45 },
    btnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
    note: {
      fontSize: 12, color: t.textMuted, fontFamily: Font.regular, lineHeight: 17,
      marginTop: Spacing.lg, paddingTop: Spacing.lg,
      borderTopWidth: 1, borderTopColor: t.hairline,
    },
  })
}
