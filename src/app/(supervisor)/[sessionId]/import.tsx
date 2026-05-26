import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { parseCatalogFile, parseStockFile, pickFile } from '@/lib/import'
import { upsertArticles, upsertTheoreticalStock } from '@/lib/queries'
import { Colors } from '@/constants/colors'

type ImportStep = 'catalog' | 'stock'

interface ImportState {
  fileName: string | null
  rowCount: number
  errors: string[]
  loading: boolean
  done: boolean
}

const initialState: ImportState = { fileName: null, rowCount: 0, errors: [], loading: false, done: false }

export default function ImportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const [catalog, setCatalog] = useState<ImportState>(initialState)
  const [stock, setStock] = useState<ImportState>(initialState)

  async function handleImport(step: ImportStep) {
    const file = await pickFile()
    if (!file) return

    if (step === 'catalog') {
      setCatalog(s => ({ ...s, fileName: file.name, loading: true, done: false, errors: [] }))
      try {
        const result = await parseCatalogFile(file.uri, file.name)
        if (result.rows.length === 0 && result.errors.length > 0) {
          setCatalog(s => ({ ...s, loading: false, errors: result.errors }))
          return
        }
        await upsertArticles(result.rows.map(r => ({
          sku: r.sku,
          ean: r.ean ?? null,
          brand: r.brand ?? '',
          label: r.label ?? '',
          unit_purchase_price: r.unit_purchase_price ?? 0,
        })))
        setCatalog(s => ({ ...s, loading: false, done: true, rowCount: result.rows.length, errors: result.errors }))
      } catch (e: unknown) {
        setCatalog(s => ({ ...s, loading: false, errors: [e instanceof Error ? e.message : 'Erreur inconnue'] }))
      }
    } else {
      setStock(s => ({ ...s, fileName: file.name, loading: true, done: false, errors: [] }))
      try {
        const result = await parseStockFile(file.uri, file.name)
        if (result.rows.length === 0 && result.errors.length > 0) {
          setStock(s => ({ ...s, loading: false, errors: result.errors }))
          return
        }
        await upsertTheoreticalStock(sessionId, result.rows)
        setStock(s => ({ ...s, loading: false, done: true, rowCount: result.rows.length, errors: result.errors }))
      } catch (e: unknown) {
        setStock(s => ({ ...s, loading: false, errors: [e instanceof Error ? e.message : 'Erreur inconnue'] }))
      }
    }
  }

  function renderBlock(step: ImportStep, state: ImportState, title: string, description: string) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{description}</Text>
        {state.fileName && (
          <Text style={styles.fileName}>Fichier : {state.fileName}</Text>
        )}
        {state.done && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{state.rowCount} lignes importées avec succès</Text>
          </View>
        )}
        {state.errors.length > 0 && (
          <View style={styles.errorBox}>
            {state.errors.slice(0, 5).map((e, i) => (
              <Text key={i} style={styles.errorText}>{e}</Text>
            ))}
            {state.errors.length > 5 && (
              <Text style={styles.errorText}>... et {state.errors.length - 5} autre(s) avertissement(s)</Text>
            )}
          </View>
        )}
        <Pressable
          style={[styles.button, state.loading && styles.buttonDisabled]}
          onPress={() => handleImport(step)}
          disabled={state.loading}
        >
          {state.loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{state.done ? 'Réimporter' : 'Choisir un fichier'}</Text>
          }
        </Pressable>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.info}>
          Importez les deux fichiers avant de lancer le comptage. Les formats CSV et Excel (.xlsx) sont acceptés.
        </Text>

        {renderBlock(
          'catalog',
          catalog,
          '1. Référentiel articles',
          'Colonnes attendues : sku, ean (optionnel), brand, label, unit_purchase_price'
        )}

        {renderBlock(
          'stock',
          stock,
          '2. Stock théorique',
          'Colonnes attendues : sku, theoretical_qty (ou quantite / stock)'
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, gap: 16 },
  info: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  cardDesc: { fontSize: 13, color: Colors.textSecondary },
  fileName: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  successBanner: { backgroundColor: Colors.secondary + '15', borderRadius: 8, padding: 10 },
  successText: { color: Colors.secondary, fontWeight: '600', fontSize: 13 },
  errorBox: { backgroundColor: Colors.danger + '10', borderRadius: 8, padding: 10, gap: 4 },
  errorText: { color: Colors.danger, fontSize: 12 },
  button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
