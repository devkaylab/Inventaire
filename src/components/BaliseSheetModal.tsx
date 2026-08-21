import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import {
  BALISE_FORMATS,
  baliseFormat,
  planBaliseSeries,
  type BaliseFormat,
  type BaliseSeries,
} from '@/lib/baliseSeries'

interface Props {
  visible: boolean
  onClose: () => void
  /** Appelé avec la série validée ; la modale se ferme juste avant. */
  onSubmit: (series: BaliseSeries) => void
}

/**
 * Création d'une planche de balises : format de numérotation (simples,
 * 4 chiffres, 5 chiffres), premier numéro, nombre. Aucun stock n'est tenu :
 * la planche part directement à l'impression.
 */
export function BaliseSheetModal({ visible, onClose, onSubmit }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [format, setFormat] = useState<BaliseFormat>('simple')
  const [start, setStart] = useState(String(baliseFormat('simple').defaultStart))
  const [count, setCount] = useState('')
  const [error, setError] = useState<string | null>(null)

  function pickFormat(id: BaliseFormat) {
    setFormat(id)
    setStart(String(baliseFormat(id).defaultStart))
    setError(null)
  }

  function submit() {
    const r = planBaliseSeries(format, start, count)
    if (!r.ok) { setError(r.error); return }
    setError(null)
    onClose()
    onSubmit(r.series)
  }

  const preview = planBaliseSeries(format, start, count)
  const previewText = preview.ok
    ? `Balises ${preview.series.from} à ${preview.series.to}`
    : null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Créer des balises</Text>
          <Text style={styles.intro}>
            Choisissez la numérotation, puis imprimez la planche. Vous pourrez en créer d&apos;autres plus tard
            en reprenant la série où elle s&apos;est arrêtée.
          </Text>

          <Text style={styles.label}>Numérotation</Text>
          <View style={styles.chips}>
            {BALISE_FORMATS.map((f) => {
              const on = f.id === format
              return (
                <Pressable key={f.id} style={[styles.chip, on && styles.chipOn]} onPress={() => pickFormat(f.id)}>
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{f.label}</Text>
                  <Text style={[styles.chipExample, on && styles.chipExampleOn, tabular]}>{f.example}</Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Premier numéro</Text>
              <TextInput
                style={[styles.input, tabular]}
                value={start}
                onChangeText={(v) => { setStart(v); setError(null) }}
                keyboardType="number-pad"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Nombre de balises</Text>
              <TextInput
                style={[styles.input, tabular]}
                value={count}
                onChangeText={(v) => { setCount(v); setError(null) }}
                keyboardType="number-pad"
                placeholder="Ex: 50"
                placeholderTextColor={theme.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submit}
              />
            </View>
          </View>

          {error
            ? <Text style={styles.error}>{error}</Text>
            : <Text style={[styles.preview, tabular]}>{previewText ?? ' '}</Text>}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
              <Text style={styles.btnSecondaryText}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={submit}>
              <Text style={styles.btnPrimaryText}>Imprimer</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1, backgroundColor: 'rgba(11,15,25,0.55)',
      justifyContent: 'center', padding: Spacing.lg,
    },
    card: {
      backgroundColor: t.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.xl,
      gap: Spacing.xs, borderWidth: 1, borderColor: t.hairline, ...t.shadowElevated,
    },
    title: { fontSize: 20, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    intro: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 18, marginBottom: Spacing.sm },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary, marginTop: Spacing.sm, marginBottom: 6 },
    chips: { flexDirection: 'row', gap: Spacing.sm },
    chip: {
      flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, backgroundColor: t.surface, gap: 2,
    },
    chipOn: { borderColor: t.accent, backgroundColor: t.accent },
    chipLabel: { fontSize: 13, fontFamily: Font.semibold, color: t.textPrimary },
    chipLabelOn: { color: t.onAccent },
    chipExample: { fontSize: 11, fontFamily: Font.regular, color: t.textMuted },
    chipExampleOn: { color: t.onAccent, opacity: 0.85 },
    row: { flexDirection: 'row', gap: Spacing.sm },
    input: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16,
      backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular,
    },
    preview: { fontSize: 13, color: t.accent, fontFamily: Font.semibold, marginTop: Spacing.sm, minHeight: 18 },
    error: { fontSize: 13, color: t.danger, fontFamily: Font.regular, marginTop: Spacing.sm, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    btn: { flex: 1, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    btnPrimary: { backgroundColor: t.accent, ...t.shadowButton },
    btnPrimaryText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
    btnSecondary: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong },
    btnSecondaryText: { color: t.textPrimary, fontSize: 15, fontFamily: Font.semibold },
  })
}
