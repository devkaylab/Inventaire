import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { importCatalogFile, importStockFile, pickFile, type ImportProgress } from '@/lib/import'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

type Step = 'catalog' | 'stock'
type Phase = 'idle' | 'parsing' | 'uploading' | 'done' | 'error'

interface StepState {
  fileName: string | null
  phase: Phase
  progress: ImportProgress | null
  uploaded: number
  errors: string[]
}

const initialState: StepState = {
  fileName: null,
  phase: 'idle',
  progress: null,
  uploaded: 0,
  errors: [],
}

function ProgressBar({ progress, styles }: { progress: ImportProgress; styles: ReturnType<typeof makeStyles> }) {
  const pct = progress.total > 0 ? Math.round((progress.uploaded / progress.total) * 100) : 0
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {pct}% — {progress.uploaded.toLocaleString()} / {progress.total.toLocaleString()} lignes
      </Text>
    </View>
  )
}

export default function ImportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [catalog, setCatalog] = useState<StepState>(initialState)
  const [stock, setStock] = useState<StepState>(initialState)

  const set = (step: Step) => (step === 'catalog' ? setCatalog : setStock)

  async function handleImport(step: Step) {
    const file = await pickFile()
    if (!file) return

    set(step)(s => ({ ...s, fileName: file.name, phase: 'parsing', errors: [], progress: null, uploaded: 0 }))

    try {
      const onProgress = (p: ImportProgress) => {
        set(step)(s => ({
          ...s,
          phase: p.uploaded === 0 ? 'parsing' : 'uploading',
          progress: p,
        }))
      }

      const result = step === 'catalog'
        ? await importCatalogFile(file.uri, file.name, sessionId, onProgress)
        : await importStockFile(file.uri, file.name, sessionId, onProgress)

      set(step)(s => ({
        ...s,
        phase: 'done',
        uploaded: result.uploaded,
        errors: result.errors,
      }))
    } catch (e: unknown) {
      console.error('[import screen]', step, e)
      set(step)(s => ({
        ...s,
        phase: 'error',
        errors: [errorMessage(e)],
      }))
    }
  }

  function renderStep(step: Step, state: StepState, title: string, description: string) {
    const busy = state.phase === 'parsing' || state.phase === 'uploading'

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>

        {state.fileName && (
          <Text style={styles.fileName}>📄 {state.fileName}</Text>
        )}

        {state.phase === 'parsing' && (
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>⏳ Lecture du fichier…</Text>
          </View>
        )}

        {state.phase === 'uploading' && state.progress && (
          <ProgressBar progress={state.progress} styles={styles} />
        )}

        {state.phase === 'done' && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>
              ✓ {state.uploaded.toLocaleString()} lignes importées
            </Text>
          </View>
        )}

        {state.errors.length > 0 && (
          <View style={styles.errorBox}>
            {state.errors.map((e, i) => (
              <Text key={i} style={styles.errorText}>{e}</Text>
            ))}
          </View>
        )}

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={() => handleImport(step)}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? '…' : state.phase === 'done' ? 'Réimporter' : 'Choisir un fichier'}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.info}>
          CSV ou Excel (.xlsx) acceptés. Les fichiers volumineux peuvent prendre quelques secondes.
        </Text>

        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️  Chaque SKU doit être unique dans chaque fichier.
          </Text>
        </View>

        {renderStep(
          'catalog',
          catalog,
          '1. Référentiel articles',
          'Colonnes obligatoires : SKU (code article), EAN (code-barres), Marque, Libellé article',
        )}

        {renderStep(
          'stock',
          stock,
          '2. Stock théorique',
          'Fichier optionnel — uniquement si comparaison avec le stock théorique nécessaire.\nColonnes : SKU (code article), EAN (code-barres), Quantité théorique',
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.lg },
    info: { fontSize: 14, color: t.textSecondary, lineHeight: 20, fontFamily: Font.regular },
    warningBanner: { backgroundColor: t.warningSoft, borderRadius: Radius.md, padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: t.warning },
    warningText: { fontSize: 13, color: t.warning, fontFamily: Font.semibold, lineHeight: 19 },

    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    cardTitle: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    cardDesc: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular },
    fileName: { fontSize: 13, color: t.textMuted, fontStyle: 'italic' },

    statusRow: { paddingVertical: Spacing.xs },
    statusText: { fontSize: 13, color: t.textSecondary },

    progressWrap: { gap: 6 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: t.hairline, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: t.accent },
    progressText: { fontSize: 12, color: t.textSecondary, ...tabular },

    successBanner: { backgroundColor: t.successSoft, borderRadius: Radius.sm, padding: 10 },
    successText: { color: t.success, fontFamily: Font.semibold, fontSize: 13, ...tabular },

    errorBox: { backgroundColor: t.dangerSoft, borderRadius: Radius.sm, padding: 10, gap: 4 },
    errorText: { color: t.danger, fontSize: 12 },

    button: { backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', ...t.shadowButton },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: t.onAccent, fontFamily: Font.semibold, fontSize: 15 },
  })
}
