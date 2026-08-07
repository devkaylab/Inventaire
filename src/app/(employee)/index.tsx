import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { getSessions, joinSession } from '@/lib/queries'
import { DeleteAccountButton } from '@/components/DeleteAccountButton'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

const STATUS_LABELS: Record<string, string> = { open: 'Ouverte', counting: 'En cours', closed: 'Clôturée' }

export default function EmployeeHomeScreen() {
  const { signOut, profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [inventoryNumber, setInventoryNumber] = useState('')
  const [securityCode, setSecurityCode] = useState('')
  const [loading, setLoading] = useState(false)

  // Inventaires auxquels le compteur est déjà rattaché (invitation ou code déjà saisi).
  // RLS employé : ne renvoie que les sessions dont il est membre.
  const { data: sessions, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  })
  const mySessions = (sessions ?? []).filter(s => s.status !== 'closed')

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  async function handleJoin() {
    if (!inventoryNumber.trim() || !securityCode.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le numéro d\'inventaire et le code de sécurité.')
      return
    }
    setLoading(true)
    try {
      const result = await joinSession(inventoryNumber.trim(), securityCode.trim())
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? 'Impossible de rejoindre la session.')
        return
      }
      setInventoryNumber('')
      setSecurityCode('')
      await refetch()
      router.push(`/(employee)/${result.session_id}`)
    } catch (e: unknown) {
      console.error('[employee] joinSession', e)
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.welcome}>Bonjour, <Text style={styles.welcomeName}>{profile?.full_name}</Text></Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Déconnexion</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxl }} />
          ) : mySessions.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Mes inventaires</Text>
              {mySessions.map(s => (
                <Pressable key={s.id} style={styles.sessionCard} onPress={() => router.push(`/(employee)/${s.id}`)}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionName} numberOfLines={1}>{s.name || s.store_name}</Text>
                    <View style={styles.badge}>
                      <View style={styles.badgeDot} />
                      <Text style={styles.badgeText}>{STATUS_LABELS[s.status] ?? s.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.sessionStore}>{s.store_name}</Text>
                  <Text style={styles.sessionMeta}>{s.inventory_number}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mySessions.length > 0 ? 'Rejoindre un autre inventaire' : 'Rejoindre un inventaire'}
            </Text>
            <Text style={styles.cardDesc}>
              {"Avec le numéro d'inventaire et le code fournis par votre superviseur."}
            </Text>

            <Text style={styles.label}>{"N° d'inventaire"}</Text>
            <TextInput
              style={styles.input}
              value={inventoryNumber}
              onChangeText={v => setInventoryNumber(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="INV-20260526-XXXX"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={styles.label}>Code inventaire</Text>
            <TextInput
              style={styles.input}
              value={securityCode}
              onChangeText={v => setSecurityCode(v.toUpperCase())}
              autoCapitalize="characters"
              placeholder="XXXXXX"
              placeholderTextColor={theme.textMuted}
            />

            <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleJoin} disabled={loading}>
              {loading ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.buttonText}>Rejoindre</Text>}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <DeleteAccountButton />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.hairline },
    welcome: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular },
    welcomeName: { color: t.textPrimary, fontFamily: Font.semibold },
    signOut: { fontSize: 14, color: t.danger, fontFamily: Font.medium },
    body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
    sectionLabel: { fontSize: 12, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.xs },
    sessionCard: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.xs, ...t.shadowCard },
    sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
    sessionName: { flex: 1, fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    sessionStore: { fontSize: 14, color: t.textPrimary, fontFamily: Font.medium },
    sessionMeta: { fontSize: 12, color: t.textMuted, ...tabular },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.successSoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.success },
    badgeText: { fontSize: 11, fontFamily: Font.semibold, color: t.success },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, ...t.shadowCard },
    cardTitle: { fontSize: 18, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    cardDesc: { fontSize: 14, color: t.textSecondary, lineHeight: 20, fontFamily: Font.regular },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    input: { borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16, backgroundColor: t.background, color: t.textPrimary, fontFamily: Font.regular, ...tabular },
    button: { backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.xs, ...t.shadowButton },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    footer: { paddingTop: Spacing.sm },
  })
}
