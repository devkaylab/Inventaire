import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router, useLocalSearchParams } from 'expo-router'
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
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>()
  // When we arrive straight from session creation the session page isn't in the
  // back stack (new-session did a `replace`), so a back arrow would land on the
  // sessions list. Hide it and offer a "Commencer l'inventaire" CTA instead.
  const fromNew = from === 'new'
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
      {fromNew && (
        <Stack.Screen options={{ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.info}>
          CSV ou Excel (.xlsx) acceptés. Les fichiers volumineux peuvent prendre quelques secondes.
        </Text>

        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️  Chaque SKU doit être unique dans chaque fichier.
          </Text>
        </View>

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            💡 Le scan reconnaît vos articles dans tous les cas, même si un code commence par un zéro.
          </Text>
          <Text style={styles.infoBannerSub}>
            {"Astuce : pour que ces codes apparaissent à l'identique dans le rapport, gardez le format « Texte » sur les colonnes des codes."}
          </Text>
        </View>

        {renderStep(
          'catalog',
          catalog,
          '1. Référentiel articles',
          'Colonnes obligatoires (variantes acceptées) :\n• SKU — ou Code article, Référence, Réf\n• EAN — ou Code-barres, GTIN, Gencod\n• Marque — ou Fournisseur\n• Libellé — ou Désignation, Description, Nom\nColonne optionnelle : Prix d’achat — ou PA, Coût, Cost, COGS. Sans elle, l’écart en valeur sera de 0.',
        )}

        {renderStep(
          'stock',
          stock,
          '2. Stock théorique',
          'Fichier optionnel — uniquement si comparaison avec le stock théorique nécessaire.\nColonnes obligatoires (variantes acceptées) :\n• SKU — ou Code article, Référence, Réf\n• Quantité théorique — ou Quantité, Qté, Stock, Qty\nLe rapprochement se fait par SKU ; les EAN proviennent du référentiel (étape 1).',
        )}

        {fromNew && (
          <Pressable
            style={styles.startBtn}
            onPress={() => router.replace(`/(supervisor)/${sessionId}`)}
          >
            <Text style={styles.startBtnText}>{"Commencer l'inventaire"}</Text>
          </Pressable>
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

    infoBanner: { backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline, gap: 4 },
    infoBannerText: { fontSize: 13, color: t.textPrimary, fontFamily: Font.semibold, lineHeight: 19 },
    infoBannerSub: { fontSize: 12, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 17 },

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

    startBtn: { backgroundColor: t.success, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, ...t.shadowButton },
    startBtnText: { color: '#fff', fontFamily: Font.bold, fontSize: 16 },
  })
}
