import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { resolveArticle } from '@/lib/queries'
import type { Article } from '@/lib/queries'
import { Colors } from '@/constants/colors'

interface ScannerProps {
  passNumber: number
  onArticleResolved: (article: Article, qty: number) => Promise<void>
}

type Mode = 'camera' | 'manual'

export function Scanner({ passNumber, onArticleResolved }: ScannerProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<Mode>('camera')
  const [manualInput, setManualInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission()
    }
  }, [permission])

  const handleBarcode = useCallback(async (result: BarcodeScanningResult) => {
    if (cooldownRef.current || resolving) return
    cooldownRef.current = true
    setTimeout(() => { cooldownRef.current = false }, 1500)
    await resolveAndPrompt(result.data)
  }, [resolving])

  async function resolveAndPrompt(raw: string) {
    const value = raw.trim()
    if (!value) return
    setResolving(true)
    try {
      const article = await resolveArticle(value)
      if (!article) {
        Alert.alert('Article introuvable', `Aucun article trouvé pour : ${value}\n\nVérifiez le référentiel importé.`)
        return
      }
      setLastScanned(value)
      promptQuantity(article)
    } finally {
      setResolving(false)
    }
  }

  function promptQuantity(article: Article) {
    Alert.prompt(
      article.label || article.sku,
      `${article.brand ? `Marque: ${article.brand}\n` : ''}SKU: ${article.sku}${article.ean ? `\nEAN: ${article.ean}` : ''}\n\nQuantité comptée (passe ${passNumber}) :`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async (qtyStr: string | undefined) => {
            const qty = parseFloat(qtyStr ?? '1')
            if (isNaN(qty) || qty < 0) {
              Alert.alert('Quantité invalide', 'Veuillez entrer un nombre positif.')
              return
            }
            await onArticleResolved(article, qty)
          },
        },
      ],
      'plain-text',
      '1',
      'numeric'
    )
  }

  async function handleManualSubmit() {
    Keyboard.dismiss()
    if (!manualInput.trim()) return
    await resolveAndPrompt(manualInput)
    setManualInput('')
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
  }

  return (
    <View style={styles.container}>
      <View style={styles.passBanner}>
        <View style={[styles.passDot, { backgroundColor: Object.values(Colors.passColors)[passNumber - 1] ?? Colors.primary }]} />
        <Text style={styles.passLabel}>Passe {passNumber} en cours</Text>
      </View>

      <View style={styles.modeToggle}>
        {(['camera', 'manual'] as const).map(m => (
          <Pressable
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {m === 'camera' ? 'Caméra' : 'Saisie manuelle'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'camera' ? (
        permission.granted ? (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={resolving ? undefined : handleBarcode}
            />
            {resolving && (
              <View style={styles.overlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.overlayText}>Recherche en cours…</Text>
              </View>
            )}
            <View style={styles.scanFrame} pointerEvents="none" />
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.permText}>Accès à la caméra refusé.</Text>
            <Pressable onPress={requestPermission} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Autoriser la caméra</Text>
            </Pressable>
          </View>
        )
      ) : (
        <View style={styles.manualContainer}>
          <Text style={styles.manualLabel}>Saisir SKU ou EAN</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.manualInput, { flex: 1 }]}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Ex: 3701234567890 ou SKU-123"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleManualSubmit}
            />
            <Pressable
              style={[styles.manualBtn, resolving && { opacity: 0.6 }]}
              onPress={handleManualSubmit}
              disabled={resolving}
            >
              {resolving ? <ActivityIndicator color="#fff" /> : <Text style={styles.manualBtnText}>OK</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {lastScanned && (
        <View style={styles.lastScanned}>
          <Text style={styles.lastScannedText}>Dernier : {lastScanned}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  passBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  passDot: { width: 10, height: 10, borderRadius: 5 },
  passLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  modeToggle: {
    flexDirection: 'row',
    margin: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: Colors.primary },
  modeBtnText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  modeBtnTextActive: { color: '#fff', fontWeight: '700' },
  cameraWrapper: { flex: 1, marginHorizontal: 12, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', gap: 12 },
  overlayText: { color: '#fff', fontSize: 15 },
  scanFrame: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    height: '20%',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  permText: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center' },
  permBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontWeight: '600' },
  manualContainer: { padding: 16, gap: 10 },
  manualLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  manualInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  manualBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  manualBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  lastScanned: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  lastScannedText: { fontSize: 12, color: Colors.textMuted },
})
