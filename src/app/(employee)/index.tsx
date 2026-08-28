import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
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
import Svg, { Path, Rect } from 'react-native-svg'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { joinSession } from '@/lib/queries'
import { getSessions } from '@/lib/offlineSync'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'
import { activerNotifications, etatNotifications, registerForPushNotifications } from '@/lib/push'
import { useRepere } from '@/lib/reperes'

const STATUS_LABELS: Record<string, string> = { open: 'Ouverte', counting: 'En cours', closed: 'Clôturée' }

export default function EmployeeHomeScreen() {
  const { profile } = useAuth()
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

  /* ── Les notifications se demandent quand elles ont un objet ──────────────
   *
   * La boîte iOS partait toute seule à l'ouverture d'un inventaire, sans un
   * mot sur ce qu'on recevrait. Or un refus est **définitif** : il ne se
   * défait qu'en passant par les Réglages. On l'amorce donc ici, sur la liste,
   * au moment où le premier inventaire arrive — la carte dit exactement ce qui
   * sera envoyé, et rien de plus.
   *
   * ⚠️ **Déjà accordées : on ne montre rien, mais on réenregistre le jeton.**
   * Un jeton Expo peut changer ; sans ce rafraîchissement silencieux, les
   * personnes déjà installées cesseraient d'être prévenues le jour où le leur
   * tourne.
   */
  const { aVoir: notifsAVoir, marquerVu: notifsRepondu } = useRepere('notifications', profile?.id)
  const [notifsADemander, setNotifsADemander] = useState(false)
  const nbSessions = mySessions.length
  useEffect(() => {
    if (nbSessions === 0) return
    let vivant = true
    void etatNotifications().then(etat => {
      if (!vivant) return
      if (etat === 'accordees') { void registerForPushNotifications(); return }
      setNotifsADemander(etat === 'a-demander')
    })
    return () => { vivant = false }
  }, [nbSessions])
  const montrerNotifs = notifsAVoir && notifsADemander && nbSessions > 0

  async function activerLesNotifications() {
    // Marqué avant la boîte système : qu'on accepte ou qu'on refuse, la
    // question a été posée et ne se repose pas.
    notifsRepondu()
    setNotifsADemander(false)
    const ok = await activerNotifications()
    if (ok) signaler.succes('Notifications activées', 'Vous serez prévenu dès qu’un inventaire vous est confié.')
  }

  async function handleJoin() {
    if (!inventoryNumber.trim() || !securityCode.trim()) {
      signaler.erreur('Erreur', 'Veuillez remplir le numéro d\'inventaire et le code de sécurité.')
      return
    }
    setLoading(true)
    try {
      const result = await joinSession(inventoryNumber.trim(), securityCode.trim())
      if (!result.success) {
        signaler.erreur('Erreur', result.error ?? 'Impossible de rejoindre la session.')
        return
      }
      setInventoryNumber('')
      setSecurityCode('')
      await refetch()
      router.push(`/(employee)/${result.session_id}`)
    } catch (e: unknown) {
      console.error('[employee] joinSession', e)
      signaler.erreur('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.welcome}>Bonjour, <Text style={styles.welcomeName}>{profile?.full_name}</Text></Text>
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
          ) : (
            // ⚠️ Avant : ce bloc était rendu `null` et le compteur tombait
            // directement sur un formulaire « N° + code » qu'il n'a pas.
            // L'état vide dit le fait, nomme qui débloque, et donne le mode
            // d'emploi — qui disparaît dès qu'un inventaire arrive.
            <>
              <View style={styles.videCard}>
                <View style={styles.videIcone}>
                  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={1.8}>
                    <Rect x="4" y="3" width="16" height="18" rx="2" />
                    <Path d="M8 8h8M8 12h8M8 16h5" />
                  </Svg>
                </View>
                <Text style={styles.videTitre}>Aucun inventaire pour l&apos;instant</Text>
                <Text style={styles.videTexte}>
                  Votre superviseur vous ajoutera à un inventaire. Il apparaîtra ici,
                  et vous serez prévenu.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>En attendant, comment ça se passe</Text>
                {[
                  'Scannez la balise du rayon',
                  'Scannez les articles',
                  'Terminez la balise, passez à la suivante',
                ].map((texte, i) => (
                  <View key={texte} style={[styles.pasRang, i > 0 && styles.pasRangSep]}>
                    <View style={styles.pasNum}><Text style={styles.pasNumText}>{i + 1}</Text></View>
                    <Text style={styles.pasTexte}>{texte}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {montrerNotifs && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Être prévenu des prochains inventaires</Text>
              <Text style={styles.cardDesc}>
                Une notification quand votre superviseur vous ajoute à un inventaire. Rien d&apos;autre.
              </Text>
              <View style={styles.notifsRangee}>
                {/* « Plus tard » d'abord, en retrait : le bouton plein est
                    celui qui ouvre la boîte système, il doit être le plus
                    loin d'un pouce qui balaie la liste. */}
                <Pressable style={styles.notifsPlusTard} onPress={() => { notifsRepondu(); setNotifsADemander(false) }}>
                  <Text style={styles.notifsPlusTardText}>Plus tard</Text>
                </Pressable>
                <Pressable style={styles.notifsActiver} onPress={() => { void activerLesNotifications() }}>
                  <Text style={styles.notifsActiverText}>Activer</Text>
                </Pressable>
              </View>
            </View>
          )}

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
    videCard: { alignItems: 'center', paddingTop: Spacing.xxxl, paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    videIcone: { width: 64, height: 64, borderRadius: Radius.xl, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
    videTitre: { color: t.textPrimary, fontSize: 18, fontFamily: Font.semibold, textAlign: 'center' },
    videTexte: { color: t.textSecondary, fontSize: 14, fontFamily: Font.regular, lineHeight: 20, textAlign: 'center' },
    pasRang: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    pasRangSep: { borderTopWidth: 1, borderTopColor: t.border },
    pasNum: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' },
    pasNumText: { color: t.textMuted, fontSize: 13, fontFamily: Font.semibold },
    pasTexte: { color: t.textPrimary, fontSize: 14, fontFamily: Font.medium, flex: 1 },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, ...t.shadowCard },
    cardTitle: { fontSize: 18, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    notifsRangee: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    notifsPlusTard: {
      flex: 1, minHeight: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: t.borderStrong,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    notifsPlusTardText: { color: t.textSecondary, fontSize: 15, fontFamily: Font.semibold },
    notifsActiver: {
      flex: 1, minHeight: 44, borderRadius: Radius.md, backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    notifsActiverText: { color: t.onAccent, fontSize: 15, fontFamily: Font.semibold },
    cardDesc: { fontSize: 14, color: t.textSecondary, lineHeight: 20, fontFamily: Font.regular },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    input: { borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16, backgroundColor: t.background, color: t.textPrimary, fontFamily: Font.regular, ...tabular },
    button: { backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.xs, ...t.shadowButton },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
