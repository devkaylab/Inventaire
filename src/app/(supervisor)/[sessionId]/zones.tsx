import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defineZoneRange, deleteZone, getSession, getZoneDashboard } from '@/lib/queries'
import type { ZoneDashboardRow } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { BaliseCreator } from '@/components/BaliseCreator'
import { CorbeilleIcon } from '@/components/ui/Icones'
import { useTheme } from '@/lib/theme'
import { Astuce, Fort } from '@/components/Astuce'
import { useRepere } from '@/lib/reperes'
import { useAuth } from '@/lib/auth'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { demander, signaler } from '@/lib/dialogue'
import { nb } from '@/lib/nombres'
import { ClavierEvite } from '@/components/ui/ClavierEvite'
import { PlusTard } from '@/components/ui/PlusTard'

type ZoneGroup = { name: string; total: number; counted: number; audited: number; codes: string[] }

function groupByName(rows: ZoneDashboardRow[]): ZoneGroup[] {
  const map = new Map<string, ZoneGroup>()
  for (const r of rows) {
    const name = r.name ?? '(Sans nom)'
    const g = map.get(name) ?? { name, total: 0, counted: 0, audited: 0, codes: [] }
    g.total += 1
    if (r.count_status === 'done') g.counted += 1
    if (r.audit_status === 'done') g.audited += 1
    g.codes.push(r.code)
    map.set(name, g)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function codeRange(codes: string[]): string {
  const nums = codes.map((c) => parseInt(c, 10)).filter((n) => !isNaN(n)).sort((a, b) => a - b)
  if (nums.length === 0) return codes.join(', ')
  return nums[0] === nums[nums.length - 1] ? String(nums[0]) : `${nums[0]} → ${nums[nums.length - 1]}`
}

export default function ZonesScreen() {
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>()
  const fromNew = from === 'new'
  const queryClient = useQueryClient()
  const theme = useTheme()
  const { profile } = useAuth()
  // Les trois mots du produit — et le seul concept qui demande vraiment
  // une explication. Une fois, sur l'écran où on affecte les plages.
  const repereBalises = useRepere('balises-vocabulaire', profile?.id)
  const styles = makeStyles(theme)

  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  /**
   * ⚠️ Une seule balise plutôt qu'une plage. Sans cette bascule, rattacher la
   * balise 42 demande de l'écrire deux fois — un même numéro recopié est une
   * faute qu'on invite à commettre, le champ « fin » ne contrôlant rien. Côté
   * serveur rien ne change : `define_zone` ne connaît que les plages, et une
   * balise seule est une plage de un.
   */
  const [unique, setUnique] = useState(false)
  /**
   * La réponse à « Avez-vous vos balises ? ». `null` = pas encore répondu, et
   * c'est alors l'état de l'inventaire qui décide de ce qu'on montre.
   *
   * ⚠️ LA QUESTION NE SE POSE QUE TANT QUE RIEN N'EST AFFECTÉ. Dès qu'un
   * emplacement existe, la réponse est connue — c'est la leçon du bandeau de
   * démarrage : une aide qui se rejoue des semaines plus tard, à quelqu'un qui
   * connaît le produit, cesse d'en être une. Et rien n'est stocké : quelqu'un
   * qui répond « Non », imprime sa planche et revient le lendemain retrouve la
   * question, ce qui est juste — il peut maintenant répondre « Oui ».
   */
  const [choix, setChoix] = useState<'creer' | 'affecter' | null>(null)

  const { data: session } = useQuery({ queryKey: ['session', sessionId], queryFn: () => getSession(sessionId) })
  const closed = session?.status === 'closed'

  const { data: rows, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
  })

  const groups = useMemo(() => groupByName(rows ?? []), [rows])
  const totals = useMemo(() => {
    const list = rows ?? []
    return {
      total: list.length,
      counted: list.filter((r) => r.count_status === 'done').length,
      audited: list.filter((r) => r.audit_status === 'done').length,
    }
  }, [rows])

  const assign = useMutation({
    mutationFn: () => {
      const s = parseInt(start, 10)
      return defineZoneRange(sessionId, name.trim(), s, unique ? s : parseInt(end, 10))
    },
    onSuccess: async (result) => {
      if (!result.success) {
        signaler.erreur('Erreur', result.error ?? 'Affectation impossible.')
        return
      }
      setName('')
      setStart('')
      setEnd('')
      await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
    },
    onError: (e) => signaler.erreur('Erreur', errorMessage(e)),
  })

  const del = useMutation({
    mutationFn: (zoneName: string) => deleteZone(sessionId, zoneName),
    onSuccess: async (result) => {
      if (!result.success) {
        signaler.erreur('Erreur', result.error ?? 'Suppression impossible.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
    },
    onError: (e) => signaler.erreur('Erreur', errorMessage(e)),
  })

  function onAssign() {
    const s = parseInt(start, 10)
    const e = unique ? s : parseInt(end, 10)
    // Saisie incomplète : on dit ce qu'il manque, on ne titre pas « Erreur ».
    if (!name.trim()) { signaler.erreur('Nom manquant', 'Donnez un nom à l’emplacement.'); return }
    if (isNaN(s) || isNaN(e)) {
      // ⚠️ Le message suit le champ qu'on a sous les yeux : « saisissez une
      // balise de début et de fin » devant un seul champ ferait chercher le
      // second.
      if (unique) signaler.erreur('Balise manquante', 'Saisissez le numéro de la balise.')
      else signaler.erreur('Plage incomplète', 'Saisissez une balise de début et de fin.')
      return
    }
    if (s > e) { signaler.erreur('Plage à revoir', 'La balise de début doit être inférieure ou égale à celle de fin.'); return }
    assign.mutate()
  }

  function confirmDelete(zoneName: string) {
    void demander({
      titre: 'Retirer l’emplacement ?',
      texte: `L’affectation « ${zoneName} » sera supprimée.`,
      action: 'Retirer',
      ton: 'danger',
    }).then((ok) => { if (ok) del.mutate(zoneName) })
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const countPct = totals.total > 0 ? Math.round((totals.counted / totals.total) * 100) : 0
  const auditPct = totals.total > 0 ? Math.round((totals.audited / totals.total) * 100) : 0
  const busy = assign.isPending || del.isPending
  const dejaAffecte = groups.length > 0
  const etape = choix ?? (dejaAffecte ? 'affecter' : 'question')

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ClavierEvite style={{ flex: 1 }}>
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.textMuted} />}
        >
          {repereBalises.aVoir && (
            <View style={styles.astuceEncart}>
              <Astuce titre="Balise, emplacement, plage" onCompris={repereBalises.marquerVu}>
                Une <Fort>balise</Fort> est l&apos;étiquette collée sur un rayon. Un{' '}
                <Fort>emplacement</Fort> est le nom que vous lui donnez — Surface de vente,
                Réserve. Une <Fort>plage</Fort> relie les deux&nbsp;: les balises 1000 à 1049
                sont la Surface de vente. Imprimez d&apos;abord, collez, puis affectez ici.
              </Astuce>
            </View>
          )}

          {totals.total > 0 && (
            <View style={styles.summary}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.passColors[1] }]}>{nb(totals.counted)}/{nb(totals.total)}</Text>
                <Text style={styles.statLabel}>Comptées · {countPct}%</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.passColors[2] }]}>{nb(totals.audited)}/{nb(totals.total)}</Text>
                <Text style={styles.statLabel}>Auditées · {auditPct}%</Text>
              </View>
            </View>
          )}

          {!closed && etape === 'question' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Avez-vous vos balises&nbsp;?</Text>
              <Text style={styles.hint}>
                Les balises sont les étiquettes QR numérotées, collées dans le magasin,
                que les compteurs scannent pour dire où ils sont.
              </Text>
              <Pressable style={styles.choix} onPress={() => setChoix('affecter')}>
                <Text style={styles.choixTitre}>Oui, elles sont collées</Text>
                <Text style={styles.choixSous}>Indiquer quelles balises sont à quel endroit</Text>
              </Pressable>
              <Pressable style={styles.choix} onPress={() => setChoix('creer')}>
                <Text style={styles.choixTitre}>Non, pas encore</Text>
                <Text style={styles.choixSous}>Créer et imprimer une planche de balises</Text>
              </Pressable>
            </View>
          )}

          {!closed && etape === 'creer' && (
            <BaliseCreator
              context="zones"
              onRetour={dejaAffecte ? undefined : () => setChoix(null)}
              onAffecter={() => setChoix('affecter')}
            />
          )}

          {!closed && etape === 'affecter' && (
            <View style={styles.card}>
              {!dejaAffecte && (
                <Pressable onPress={() => setChoix(null)} hitSlop={8}>
                  <Text style={styles.retour}>← Revenir à la question</Text>
                </Pressable>
              )}
              {/* ⚠️ Le texte suit le CHAMP qu'on a sous les yeux. Avec la
                  bascule active il n'y a plus qu'un champ : parler de plage et
                  donner un exemple « 1 à 10 » fait chercher un second champ qui
                  n'existe pas. Même règle que le message de saisie, dont
                  `validateRange` change déjà le libellé selon le mode. */}
              <Text style={styles.sectionTitle}>
                {unique ? 'Affecter une balise à un emplacement' : 'Affecter une plage à un emplacement'}
              </Text>
              <Text style={styles.hint}>
                {unique
                  ? 'Indiquez à quel endroit se trouve cette balise (imprimée et collée). Ex. la balise 42 est en « Réserve ».'
                  : 'Indiquez quelles balises (imprimées et collées) sont à quel endroit. Ex. « Réserve » = balises 1 à 10, « Surface de vente » = 11 à 30.'}
              </Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Une seule balise</Text>
                  <Text style={styles.hint}>Pour rattacher une balise isolée à un emplacement</Text>
                </View>
                <Switch
                  value={unique}
                  onValueChange={setUnique}
                  trackColor={{ false: theme.borderStrong, true: theme.accent }}
                  thumbColor={theme.onAccent}
                />
              </View>

              <Text style={styles.label}>Emplacement</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex : Réserve"
                placeholderTextColor={theme.textMuted}
              />
              {unique ? (
                <View>
                  <Text style={styles.label}>Balise</Text>
                  <TextInput style={[styles.input, tabular]} value={start} onChangeText={setStart} keyboardType="number-pad" placeholder="42" placeholderTextColor={theme.textMuted} />
                </View>
              ) : (
                <View style={styles.rangeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Balise début</Text>
                    <TextInput style={[styles.input, tabular]} value={start} onChangeText={setStart} keyboardType="number-pad" placeholder="1" placeholderTextColor={theme.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Balise fin</Text>
                    <TextInput style={[styles.input, tabular]} value={end} onChangeText={setEnd} keyboardType="number-pad" placeholder="10" placeholderTextColor={theme.textMuted} />
                  </View>
                </View>
              )}
              <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={onAssign} disabled={busy}>
                {assign.isPending ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.buttonText}>Affecter</Text>}
              </Pressable>
              <Pressable onPress={() => setChoix('creer')} hitSlop={8}>
                <Text style={styles.autres}>Créer d&apos;autres balises</Text>
              </Pressable>
            </View>
          )}

          {groups.length > 0 && <Text style={styles.sectionTitle}>Emplacements ({groups.length})</Text>}
          {groups.map((g) => (
            <View key={g.name} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneName}>{g.name}</Text>
                  <Text style={styles.zoneMeta}>Balises {codeRange(g.codes)} · {g.total}</Text>
                </View>
                {!closed && (
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(g.name)} disabled={busy} hitSlop={6}>
                    <CorbeilleIcon color={theme.danger} />
                  </Pressable>
                )}
              </View>
              <View style={styles.zoneProgress}>
                <View style={[styles.progressChip, { borderColor: theme.passColors[1] }]}>
                  <View style={[styles.progressDot, { backgroundColor: theme.passColors[1] }]} />
                  <Text style={styles.progressText}>Compte {g.counted}/{g.total}</Text>
                </View>
                <View style={[styles.progressChip, { borderColor: theme.passColors[2] }]}>
                  <View style={[styles.progressDot, { backgroundColor: theme.passColors[2] }]} />
                  <Text style={styles.progressText}>Audit {g.audited}/{g.total}</Text>
                </View>
              </View>
            </View>
          ))}

          {/* ⚠️ La question ne s'accompagne d'AUCUN état vide : elle est déjà
              ce qu'on a à répondre, et « indiquez une première plage ci-dessus »
              désignerait deux boutons qui ne demandent aucune plage. */}
          {groups.length === 0 && (closed || etape === 'affecter') && (
            <Text style={styles.empty}>
              {unique
                ? 'Aucun emplacement affecté. Indiquez une première balise ci-dessus.'
                : 'Aucun emplacement affecté. Indiquez une première plage de balises ci-dessus.'}
            </Text>
          )}

          {fromNew && (
            <>
              <Pressable
                style={styles.nextBtn}
                onPress={() => router.push(`/(supervisor)/${sessionId}/import?from=new`)}
              >
                <Text style={styles.nextBtnText}>Suivant : importer les fichiers</Text>
              </Pressable>
              <PlusTard sessionId={sessionId} />
            </>
          )}
        </ScrollView>
      </ClavierEvite>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    // Une seule gouttière : l'encart s'aligne sur les cartes de l'écran.
    astuceEncart: { marginBottom: Spacing.md },
    container: { padding: Spacing.lg, gap: Spacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },
    summary: { flexDirection: 'row', gap: Spacing.md },
    stat: { flex: 1, backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    statValue: { fontSize: 24, fontFamily: Font.extrabold, letterSpacing: -0.5, ...tabular },
    statLabel: { fontSize: 12, color: t.textSecondary, marginTop: 2, fontFamily: Font.medium },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    sectionTitle: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, marginTop: Spacing.xs, letterSpacing: -0.2 },
    hint: { fontSize: 12, color: t.textMuted, lineHeight: 17, fontFamily: Font.regular },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary, marginTop: Spacing.xs },
    input: { borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, fontSize: 16, backgroundColor: t.background, color: t.textPrimary, fontFamily: Font.regular },
    rangeRow: { flexDirection: 'row', gap: Spacing.md },
    // ⚠️ `choix` porte `Radius.bouton` : ces cartes se TOUCHENT. La garde le
    // déduit du nom du style, et elle a raison de mordre ici.
    choix: {
      backgroundColor: t.background, borderWidth: 1, borderColor: t.borderStrong,
      borderRadius: Radius.bouton, padding: Spacing.lg, gap: 3,
    },
    choixTitre: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    choixSous: { fontSize: 12.5, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 17 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
    switchLabel: { fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary, marginBottom: 2 },
    retour: { fontSize: 13, color: t.textMuted, fontFamily: Font.medium },
    autres: { fontSize: 13, color: t.accent, fontFamily: Font.semibold, textAlign: 'center', marginTop: Spacing.xs },
    button: { backgroundColor: t.accent, borderRadius: Radius.bouton, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, ...t.shadowButton },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    zoneCard: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    zoneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    zoneName: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    zoneMeta: { fontSize: 12, color: t.textSecondary, marginTop: 2, ...tabular },
    zoneProgress: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    progressChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.background, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
    progressDot: { width: 8, height: 8, borderRadius: 4 },
    progressText: { fontSize: 13, color: t.textPrimary, fontFamily: Font.semibold, ...tabular },
    deleteBtn: { width: 40, height: 40, borderRadius: Radius.bouton, backgroundColor: t.dangerSoft, alignItems: 'center', justifyContent: 'center' },
    empty: { fontSize: 14, color: t.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontFamily: Font.regular },
    // ⚠️ **Le bouton qui fait avancer ne se confond pas avec les actions de
    // l'écran.** Il était violet plein comme « Créer et imprimer des balises »
    // et « Affecter » : trois boutons identiques, dont un seul mène ailleurs.
    // L'écran d'import distingue déjà le sien en vert — on suit la même règle.
    nextBtn: { backgroundColor: t.success, borderRadius: Radius.bouton, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, ...t.shadowButton },
    nextBtnText: { color: '#fff', fontFamily: Font.bold, fontSize: 16 },
  })
}
