import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyScanEntries, getZoneDashboard, insertArticle, resolveArticle, setBalise } from '@/lib/queries'
import type { Article, BaliseMode, ScanEntrySeed } from '@/lib/queries'
import { parseBalise } from '@/lib/balises'
import { passLabel, AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { errorMessage } from '@/lib/errors'
import { loadScanSound, playScanSound, playErrorSound, unloadScanSound } from '@/lib/scanSound'

interface ScannerProps {
  sessionId: string
  passNumber: number
  onArticleResolved: (article: Article, qty: number, zoneCode?: string | null) => Promise<void>
  /** Scans already persisted for this counter/pass — seeds the list on mount
   *  so it survives navigation (undefined while still loading). */
  initialScans?: ScanEntrySeed[]
  /** Zone mode : on scanne une balise pour ouvrir une zone, on compte/audite,
   *  puis on rescanne (ou « Clôturer ») pour la fermer. */
  zoneMode?: boolean
  mode?: BaliseMode
  onModeChange?: (mode: BaliseMode) => void
  /** Masque le sélecteur Comptage/Audit : le mode est alors imposé par l'écran
   *  précédent (entrées « Compter »/« Auditer »). Le mode reste visible dans les
   *  bandeaux de zone. */
  lockMode?: boolean
  /** Identité du compteur (mode classique) — sert au réamorçage de la liste. */
  countedBy?: string
}

type Mode = 'camera' | 'manual' | 'hardware'

// Symbologies lues par la caméra. Les balises de l'app sont des QR ('qr') ;
// le reste couvre les codes-barres articles (EAN/UPC/Code128, etc.).
const BARCODE_TYPES = [
  'qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93',
  'itf14', 'codabar', 'datamatrix', 'pdf417', 'aztec',
] as const

interface ScanEntry {
  id: string
  article: Article
  qty: number
  timestamp: number
}

// ─── Illisible modal ──────────────────────────────────────────────────────────
interface IllisibleModalProps {
  scannedCode: string
  sessionId: string
  onConfirm: (article: Article) => void
  onCancel: () => void
}

function IllisibleModal({ scannedCode, sessionId, onConfirm, onCancel }: IllisibleModalProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  // The triggering code is usually a scanned barcode → pre-fill EAN.
  const [ean, setEan] = useState(scannedCode)
  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmedEan = ean.trim()
    // Internal fallback: counts.sku must point to a non-empty SKU, so when the
    // user only provides an EAN we reuse it as the linkage key. The export
    // (report.ts) blanks the SKU column when sku === ean, so it stays invisible.
    const trimmedSku = sku.trim() || trimmedEan
    if (!trimmedSku) {
      Alert.alert('Erreur', 'Saisissez au moins un code (SKU ou EAN).')
      return
    }
    setSaving(true)
    try {
      const article = await insertArticle({
        session_id: sessionId,
        sku: trimmedSku,
        ean: trimmedEan || null,
        brand: brand.trim(),
        label: label.trim() || 'INCONNU',
        unit_purchase_price: 0,
      })
      onConfirm(article)
    } catch (e) {
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.illBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.illSheet}>
          {/* Header */}
          <View style={styles.illHeader}>
            <View style={styles.illIconWrap}>
              <Text style={styles.illIcon}>?</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.illTitle}>Article inconnu</Text>
              <Text style={styles.illSub}>Saisissez les informations disponibles</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* EAN / barcode — pre-filled with the scanned code */}
            <Text style={styles.fieldLabel}>EAN / code-barres</Text>
            <TextInput
              style={styles.fieldInput}
              value={ean}
              onChangeText={setEan}
              placeholder="Ex: 3701234567890"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* SKU / code article — optional */}
            <Text style={styles.fieldLabel}>Code article (SKU)</Text>
            <TextInput
              style={styles.fieldInput}
              value={sku}
              onChangeText={setSku}
              placeholder="Ex: REF-001 (optionnel)"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
            />
            <Text style={styles.fieldHint}>Renseignez au moins un des deux codes.</Text>

            {/* Brand */}
            <Text style={styles.fieldLabel}>Marque</Text>
            <TextInput
              style={styles.fieldInput}
              value={brand}
              onChangeText={setBrand}
              placeholder="Ex: Nike, Adidas…"
              placeholderTextColor={theme.textMuted}
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* Label / details */}
            <Text style={styles.fieldLabel}>Désignation / Détails</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMulti]}
              value={label}
              onChangeText={setLabel}
              placeholder="Ex: T-shirt rouge taille M, Pantalon bleu L…"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              returnKeyType="done"
            />

            <Text style={styles.illNote}>
              {"💡 Cet article sera ajouté au référentiel de la session avec un prix d'achat à 0 €."}
            </Text>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.illBtnRow}>
            <Pressable style={styles.illBtnCancel} onPress={onCancel}>
              <Text style={styles.illBtnCancelText}>Ignorer</Text>
            </Pressable>
            <Pressable
              style={[styles.illBtnConfirm, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.illBtnConfirmText}>Ajouter au comptage</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Scanner ──────────────────────────────────────────────────────────────────
export function Scanner({
  sessionId, passNumber, onArticleResolved, initialScans,
  zoneMode = false, mode: baliseMode = 'count', onModeChange, lockMode = false, countedBy,
}: ScannerProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()
  // Couleur du mode : Compter = accent, Auditer = or.
  const modeColor = baliseMode === 'audit' ? AUDIT_COLOR : theme.accent
  const modeOn = baliseMode === 'audit' ? AUDIT_ON : theme.onAccent
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<Mode>('camera')
  const [manualInput, setManualInput] = useState('')
  // Douchette (Zebra/Honeywell/BT HID) — capture keyboard-wedge en mode dédié.
  const [hwInput, setHwInput] = useState('')
  const hwInputRef = useRef<TextInput>(null)
  const [baliseInput, setBaliseInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([])
  const [barcodeReady, setBarcodeReady] = useState(false)
  const [illisibleCode, setIllisibleCode] = useState<string | null>(null)
  const [autoScan, setAutoScan] = useState(true)
  const [torch, setTorch] = useState(false)
  const seededRef = useRef(false)

  // ── Zone mode : balise actuellement ouverte ────────────────────────────────
  const [activeBalise, setActiveBaliseState] = useState<{ code: string; name: string | null } | null>(null)
  // Refs miroir : resolveAndRecord est capturé par un callback mémoïsé et doit
  // lire les valeurs courantes (mode, balise active) sans closure périmée.
  const activeBaliseRef = useRef<{ code: string; name: string | null } | null>(null)
  const zoneModeRef = useRef(zoneMode)
  const baliseModeRef = useRef<BaliseMode>(baliseMode)
  // Code de la balise venant d'être ouverte/fermée : ignoré tant qu'il reste
  // dans le champ (évite de re-fermer/ré-ouvrir aussitôt le même sticker).
  const ignoreBaliseRef = useRef<string | null>(null)
  useEffect(() => { zoneModeRef.current = zoneMode }, [zoneMode])
  useEffect(() => { baliseModeRef.current = baliseMode }, [baliseMode])

  function setActiveBalise(v: { code: string; name: string | null } | null) {
    activeBaliseRef.current = v
    setActiveBaliseState(v)
  }

  // Mode classique : amorce la liste une fois depuis les comptages persistés.
  // En mode zones, la liste est amorcée par balise (voir plus bas).
  useEffect(() => {
    if (zoneMode || seededRef.current || !initialScans) return
    seededRef.current = true
    if (initialScans.length === 0) return
    setRecentScans(prev => {
      if (prev.length > 0) return prev // user already started scanning — don't clobber
      return initialScans.map(e => ({
        id: `${e.article.sku}-${e.timestamp}`,
        article: e.article,
        qty: e.qty,
        timestamp: e.timestamp,
      }))
    })
  }, [initialScans, zoneMode])

  // ── Deux phases (mode zones) ────────────────────────────────────────────────
  // Phase « balise » = aucune zone ouverte → on ouvre une balise (délibérément).
  // Phase « articles » = une zone est ouverte → on scanne les articles.
  const balisePhase = zoneMode && !activeBalise
  const autoScanEnabledRef = useRef(true)
  useEffect(() => { autoScanEnabledRef.current = !balisePhase && autoScan }, [balisePhase, autoScan])

  // Balises déjà terminées (mode courant) — pour revenir corriger une erreur.
  const { data: zoneRows } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
    enabled: zoneMode,
  })
  const doneBalises = (zoneRows ?? []).filter(
    (z) => (baliseMode === 'count' ? z.count_status : z.audit_status) === 'done',
  )

  // Réamorce la liste avec le contenu de la balise ouverte (tous compteurs),
  // pour voir et corriger ce qui a déjà été compté/audité dans cette zone.
  useEffect(() => {
    if (!zoneMode) return
    const code = activeBalise?.code
    if (!code) { setRecentScans([]); return }
    let cancelled = false
    getMyScanEntries(sessionId, passNumber, countedBy ?? '', code)
      .then((entries) => {
        if (cancelled) return
        setRecentScans(entries.map((e) => ({ id: `${e.article.sku}-${e.timestamp}`, article: e.article, qty: e.qty, timestamp: e.timestamp })))
      })
      .catch(() => { /* liste vide si erreur */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBalise?.code, zoneMode, passNumber])

  const lastDetectedRef = useRef<string | null>(null)
  const detectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processingRef = useRef(false)          // sync lock — no React render cycle
  const cooldownRef = useRef(false)            // blocks auto-scan between triggers
  const manualInputRef = useRef<TextInput>(null)
  const cooldownAnim = useRef(new Animated.Value(0)).current
  const COOLDOWN_MS = 1500

  useEffect(() => {
    if (permission && !permission.granted) requestPermission()
  }, [permission])

  useEffect(() => {
    loadScanSound()
    return () => {
      if (detectionTimer.current) clearTimeout(detectionTimer.current)
      unloadScanSound()
    }
  }, [])

  // ── Mode douchette : maintient le focus sur le champ de capture pour recevoir
  // les frappes de la douchette, sauf pendant la saisie « article inconnu ». ──
  useEffect(() => {
    if (mode !== 'hardware' || balisePhase || illisibleCode !== null) return
    const id = setTimeout(() => hwInputRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [mode, balisePhase, illisibleCode])

  // ── Cooldown: animated bar drains over COOLDOWN_MS after each auto-scan ────
  function startCooldown() {
    cooldownRef.current = true
    cooldownAnim.setValue(1)
    Animated.timing(cooldownAnim, {
      toValue: 0,
      duration: COOLDOWN_MS,
      useNativeDriver: false,
    }).start(() => {
      cooldownRef.current = false
    })
  }

  // ── Barcode detection — auto-scan as soon as a code enters the frame ───────
  const handleBarcodeDetected = useCallback((result: BarcodeScanningResult) => {
    lastDetectedRef.current = result.data
    if (!barcodeReady) setBarcodeReady(true)

    // Reset the "code left frame" timer
    if (detectionTimer.current) clearTimeout(detectionTimer.current)
    detectionTimer.current = setTimeout(() => {
      lastDetectedRef.current = null
      ignoreBaliseRef.current = null // le sticker a quitté le champ
      setBarcodeReady(false)
    }, 600)

    // Auto-scan : jamais en phase balise (ouverture délibérée uniquement).
    if (autoScanEnabledRef.current && !cooldownRef.current && !processingRef.current) {
      startCooldown()
      resolveAndRecord(result.data)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeReady])

  // ── Resolve & record ───────────────────────────────────────────────────────
  async function resolveAndRecord(raw: string) {
    const value = raw.trim()
    if (!value) return
    // Synchronous gate — instant check, no React render cycle needed
    if (processingRef.current) return
    processingRef.current = true

    // Clear detection state immediately for snappy visual feedback
    lastDetectedRef.current = null
    setBarcodeReady(false)
    if (detectionTimer.current) clearTimeout(detectionTimer.current)
    setResolving(true)

    try {
      // ── Zone mode : une balise est un QR préfixé (généré par l'app) ───────
      if (zoneModeRef.current) {
        const parsed = parseBalise(value)
        if (parsed) {
          const code = parsed.code
          if (code === ignoreBaliseRef.current) return // encore dans le champ
          const active = activeBaliseRef.current
          if (active && code === active.code) {
            await closeBalise()               // rescan → clôture
          } else if (active) {
            await openBaliseCode(code, true)  // autre balise → clôture puis ouvre
          } else {
            await openBaliseCode(code, false) // ouvre la zone
          }
          return
        }
        // Pas une balise → article : il faut d'abord une zone ouverte.
        if (!activeBaliseRef.current) {
          playErrorSound()
          Alert.alert('Zone fermée', 'Scannez d’abord une balise pour ouvrir une zone.')
          return
        }
      }

      const article = await resolveArticle(sessionId, value)
      if (!article) {
        playErrorSound()
        setIllisibleCode(value)
        return
      }
      await recordArticle(article, activeBaliseRef.current?.code ?? null)
    } finally {
      processingRef.current = false
      setResolving(false)
    }
  }

  // ── Ouvre une balise (par son code). closePrev clôture la zone en cours. ──
  async function openBaliseCode(code: string, closePrev: boolean) {
    try {
      if (closePrev && activeBaliseRef.current) {
        await setBalise(sessionId, activeBaliseRef.current.code, baliseModeRef.current, false)
      }
      const result = await setBalise(sessionId, code, baliseModeRef.current, true)
      if (!result.success) {
        playErrorSound()
        Alert.alert('Balise', result.error ?? 'Balise inconnue.')
        return
      }
      ignoreBaliseRef.current = result.code ?? code
      setActiveBalise({ code: result.code ?? code, name: result.name ?? null })
      queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
      playScanSound()
    } catch (e) {
      playErrorSound()
      Alert.alert('Erreur', errorMessage(e))
    }
  }

  // ── Clôture la zone ouverte ──────────────────────────────────────────────
  async function closeBalise() {
    const active = activeBaliseRef.current
    if (!active) return
    try {
      const result = await setBalise(sessionId, active.code, baliseModeRef.current, false)
      if (!result.success) {
        Alert.alert('Balise', result.error ?? 'Clôture impossible.')
        return
      }
      ignoreBaliseRef.current = active.code
      setActiveBalise(null)
      queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
      playScanSound()
    } catch (e) {
      Alert.alert('Erreur', errorMessage(e))
    }
  }

  // ── Ouverture délibérée d'une balise par saisie de son numéro ─────────────
  async function openBaliseManual() {
    const code = baliseInput.trim()
    if (!code) return
    Keyboard.dismiss()
    setResolving(true)
    try {
      await openBaliseCode(code, false)
    } finally {
      setResolving(false)
    }
    setBaliseInput('')
  }

  async function recordArticle(article: Article, zoneCode: string | null = null) {
    await onArticleResolved(article, 1, zoneCode)
    playScanSound()
    setRecentScans(prev => {
      const idx = prev.findIndex(e => e.article.sku === article.sku)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1, timestamp: Date.now() }
        updated.sort((a, b) => b.timestamp - a.timestamp)
        return updated
      }
      // No cap — the full list must persist until the inventory is closed.
      return [
        { id: `${article.sku}-${Date.now()}`, article, qty: 1, timestamp: Date.now() },
        ...prev,
      ]
    })
  }

  async function handleManualSubmit() {
    Keyboard.dismiss()
    if (!manualInput.trim()) return
    await resolveAndRecord(manualInput)
    setManualInput('')
  }

  // ── Douchette : une frappe-clavier terminée par Entrée (suffixe DataWedge) ──
  async function handleHardwareSubmit() {
    const value = hwInput
    setHwInput('')
    if (!value.trim()) return
    await resolveAndRecord(value)
    // Garde le champ à l'écoute pour le scan suivant (scan continu).
    hwInputRef.current?.focus()
  }

  // ── Illisible confirmed ────────────────────────────────────────────────────
  async function handleIllisibleConfirm(article: Article) {
    setIllisibleCode(null)
    setResolving(true)
    try {
      await recordArticle(article, activeBaliseRef.current?.code ?? null)
    } finally {
      setResolving(false)
    }
  }

  // ── List actions ───────────────────────────────────────────────────────────
  async function handleIncrement(entry: ScanEntry) {
    try {
      await onArticleResolved(entry.article, 1, activeBaliseRef.current?.code ?? null)
      setRecentScans(prev =>
        prev.map(e => e.id === entry.id ? { ...e, qty: e.qty + 1, timestamp: Date.now() } : e)
      )
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la modification.")
    }
  }

  async function handleDecrement(entry: ScanEntry) {
    if (entry.qty <= 1) { handleDelete(entry); return }
    try {
      await onArticleResolved(entry.article, -1, activeBaliseRef.current?.code ?? null)
      setRecentScans(prev =>
        prev.map(e => e.id === entry.id ? { ...e, qty: e.qty - 1 } : e)
      )
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la modification.")
    }
  }

  function handleDelete(entry: ScanEntry) {
    Alert.alert(
      'Supprimer la ligne ?',
      `Retirer "${entry.article.label || entry.article.sku}" (×${entry.qty}) de ce comptage ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await onArticleResolved(entry.article, -entry.qty, activeBaliseRef.current?.code ?? null)
              setRecentScans(prev => prev.filter(e => e.id !== entry.id))
            } catch {
              Alert.alert('Erreur', "Impossible de supprimer la ligne.")
            }
          },
        },
      ]
    )
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const totalScanned = recentScans.reduce((s, e) => s + e.qty, 0)
  const triggerLabel = balisePhase
    ? (barcodeReady ? '📷  Scanner la balise' : 'Visez une balise…')
    : (barcodeReady ? '📷  Scanner maintenant' : 'En attente d\'un code…')
  const camHint = resolving
    ? 'Enregistrement…'
    : barcodeReady
      ? (balisePhase ? 'Balise détectée — appuyez pour ouvrir' : 'Scan automatique — Vol − ou bouton pour forcer')
      : (balisePhase ? 'Visez la balise de la zone' : 'Pointez la caméra vers un code-barres')

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Bandeau : passe (mode classique) ou zone/balise (mode zones) */}
      {zoneMode ? (
        <View>
          {/* Sélecteur Comptage / Audit — verrouillé tant qu'une zone est ouverte.
              Masqué (lockMode) quand le mode est imposé par l'écran précédent. */}
          {!lockMode && (
            <View style={styles.zoneModeToggle}>
              {(['count', 'audit'] as const).map((m) => {
                const active = baliseMode === m
                const color = m === 'count' ? theme.accent : AUDIT_COLOR
                return (
                  <Pressable
                    key={m}
                    style={[styles.zoneModeBtn, active && { backgroundColor: color }]}
                    onPress={() => { if (!activeBalise) onModeChange?.(m) }}
                    disabled={!!activeBalise}
                  >
                    <Text style={[styles.zoneModeText, active && { color: m === 'audit' ? AUDIT_ON : '#fff', fontFamily: Font.bold }, !!activeBalise && !active && { opacity: 0.4 }]}>
                      {m === 'count' ? '🔢 Comptage' : '🔍 Audit'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
          {/* Bandeau de la zone ouverte */}
          {activeBalise ? (
            <View style={[styles.zoneBanner, { borderColor: modeColor }]}>
              <View style={[styles.passDot, { backgroundColor: modeColor }]} />
              <Text style={styles.zoneBannerText} numberOfLines={1}>
                Zone ouverte · {activeBalise.name ?? 'Sans nom'} · balise {activeBalise.code}
              </Text>
              <Pressable style={styles.zoneCloseBtn} onPress={closeBalise} disabled={resolving}>
                <Text style={styles.zoneCloseText}>Clôturer</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.zoneBannerIdle}>
              <Text style={styles.zoneBannerIdleText}>
                Scannez une balise pour ouvrir une zone ({baliseMode === 'count' ? 'Comptage' : 'Audit'})
              </Text>
              {resolving && <ActivityIndicator size="small" color={theme.accent} />}
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.passBanner, { borderLeftWidth: 4, borderLeftColor: modeColor }]}>
          <View style={[styles.passDot, { backgroundColor: modeColor }]} />
          <Text style={styles.passLabel}>{passLabel(passNumber)} en cours</Text>
          {resolving && <ActivityIndicator size="small" color={modeColor} style={{ marginLeft: 'auto' }} />}
        </View>
      )}

      {/* Phase balise : ouverture délibérée par saisie du numéro (ou scan manuel) */}
      {balisePhase && (
        <View style={styles.baliseField}>
          <Text style={styles.baliseFieldLabel}>Ouvrir une balise — saisissez son numéro ou scannez-la</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.manualInput, { flex: 1 }, tabular]}
              value={baliseInput}
              onChangeText={setBaliseInput}
              keyboardType="number-pad"
              placeholder="N° de balise"
              placeholderTextColor={theme.textMuted}
              returnKeyType="go"
              onSubmitEditing={openBaliseManual}
            />
            <Pressable style={[styles.manualBtn, { backgroundColor: modeColor }, resolving && { opacity: 0.6 }]} onPress={openBaliseManual} disabled={resolving}>
              {resolving ? <ActivityIndicator color={modeOn} /> : <Text style={[styles.manualBtnText, { color: modeOn }]}>Ouvrir</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {/* Bascule Caméra / Manuel — articles uniquement */}
      {!balisePhase && (
        <View style={styles.modeToggle}>
          {(['camera', 'manual', 'hardware'] as const).map(m => (
            <Pressable key={m} style={[styles.modeBtn, mode === m && styles.modeBtnActive]} onPress={() => setMode(m)}>
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'camera' ? '📷 Caméra' : m === 'manual' ? '⌨️ Manuel' : '🔫 Douchette'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Auto-scan toggle — articles, caméra */}
      {!balisePhase && mode === 'camera' && (
        <Pressable style={styles.autoScanRow} onPress={() => setAutoScan(v => !v)}>
          <Text style={styles.autoScanLabel}>⚡ Scan automatique</Text>
          <View style={[styles.autoScanPill, autoScan && styles.autoScanPillOn]}>
            <Text style={[styles.autoScanPillText, autoScan && styles.autoScanPillTextOn]}>
              {autoScan ? 'ON' : 'OFF'}
            </Text>
          </View>
        </Pressable>
      )}

      {/* Camera or manual input (en phase balise : toujours la caméra) */}
      {(balisePhase || mode === 'camera') ? (
        permission.granted ? (
          <>
            <View style={styles.cameraWrapper}>
              <CameraView
                style={styles.camera}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] as never }}
                onBarcodeScanned={resolving ? undefined : handleBarcodeDetected}
              />
              {/* Torch toggle — helps scanning in low light */}
              <Pressable
                style={[styles.torchBtn, torch && styles.torchBtnOn]}
                onPress={() => setTorch(v => !v)}
                hitSlop={8}
              >
                <Text style={styles.torchIcon}>🔦</Text>
              </Pressable>
              {resolving && (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.overlayText}>Enregistrement…</Text>
                </View>
              )}
              <View style={[styles.scanFrame, barcodeReady && styles.scanFrameReady]} pointerEvents="none" />
              {/* Cooldown bar */}
              <Animated.View
                style={[styles.cooldownBar, { width: cooldownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
                pointerEvents="none"
              />
              <View style={styles.hintBar} pointerEvents="none">
                <Text style={[styles.hintText, barcodeReady && styles.hintTextReady]}>
                  {camHint}
                </Text>
              </View>
            </View>
            {/* Virtual scan button — manual override even during cooldown */}
            <Pressable
              style={[
                styles.triggerBtn,
                barcodeReady && !resolving && styles.triggerBtnReady,
                resolving && styles.triggerBtnResolving,
              ]}
              onPress={() => {
                if (lastDetectedRef.current && !processingRef.current) {
                  startCooldown()
                  resolveAndRecord(lastDetectedRef.current)
                }
              }}
              disabled={resolving}
            >
              {resolving ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={[styles.triggerBtnText, { color: '#fff' }]}>Enregistrement…</Text>
                </>
              ) : (
                <Text style={[styles.triggerBtnText, barcodeReady && { color: '#fff' }]}>
                  {triggerLabel}
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <View style={styles.permBox}>
            <Text style={styles.permText}>Accès à la caméra refusé.</Text>
            <Pressable onPress={requestPermission} style={styles.permBtn}>
              <Text style={styles.permBtnText}>Autoriser la caméra</Text>
            </Pressable>
          </View>
        )
      ) : mode === 'hardware' ? (
        <View style={styles.manualContainer}>
          <View style={styles.hwHeader}>
            <View style={styles.hwDot} />
            <Text style={styles.hwTitle}>Douchette prête</Text>
            {resolving && <ActivityIndicator size="small" color={theme.accent} style={{ marginLeft: 'auto' }} />}
          </View>
          <Text style={styles.manualLabel}>
            Scannez avec la douchette (Zebra, Honeywell ou Bluetooth). La saisie au clavier fonctionne aussi.
          </Text>
          <TextInput
            ref={hwInputRef}
            style={[styles.manualInput, tabular]}
            value={hwInput}
            onChangeText={setHwInput}
            onSubmitEditing={handleHardwareSubmit}
            blurOnSubmit={false}
            showSoftInputOnFocus={false}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="En attente d'un scan…"
            placeholderTextColor={theme.textMuted}
            onBlur={() => {
              if (mode === 'hardware' && illisibleCode === null) {
                setTimeout(() => hwInputRef.current?.focus(), 60)
              }
            }}
          />
        </View>
      ) : (
        <View style={styles.manualContainer}>
          <Text style={styles.manualLabel}>SKU ou EAN — appuyez sur OK pour valider</Text>
          <View style={styles.manualRow}>
            <TextInput
              ref={manualInputRef}
              style={[styles.manualInput, { flex: 1 }]}
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Ex: 3701234567890 ou SKU-123"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleManualSubmit}
            />
            <Pressable style={[styles.manualBtn, { backgroundColor: modeColor }, resolving && { opacity: 0.6 }]} onPress={handleManualSubmit} disabled={resolving}>
              {resolving ? <ActivityIndicator color={modeOn} /> : <Text style={[styles.manualBtnText, { color: modeOn }]}>OK</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {balisePhase ? (
        /* Phase balise : revenir sur une balise déjà terminée pour corriger */
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {doneBalises.length === 0 ? 'Aucune balise terminée' : `Revenir sur une balise — ${doneBalises.length}`}
            </Text>
          </View>
          <FlatList
            data={doneBalises}
            keyExtractor={(z) => z.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={styles.reopenRow} onPress={() => openBaliseCode(item.code, false)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reopenName} numberOfLines={1}>{item.name ?? 'Sans zone'}</Text>
                  <Text style={styles.reopenMeta}>
                    Balise {item.code} · {baliseMode === 'count' ? item.count_units : item.audit_units} u.
                  </Text>
                </View>
                <Text style={styles.reopenAction}>Rouvrir</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyHint}>Terminez une balise pour pouvoir y revenir.</Text>}
          />
        </>
      ) : (
        /* Phase articles : liste des scans + bouton clôturer la balise */
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {recentScans.length === 0
                ? 'En attente de scan…'
                : `Scans récents — ${totalScanned} unité${totalScanned > 1 ? 's' : ''}`}
            </Text>
          </View>
          <FlatList
            data={recentScans}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <ScanRow
                entry={item}
                onIncrement={() => handleIncrement(item)}
                onDecrement={() => handleDecrement(item)}
                onDelete={() => handleDelete(item)}
              />
            )}
            ListEmptyComponent={<Text style={styles.emptyHint}>Scannez un article pour commencer</Text>}
          />
          {activeBalise && (
            <Pressable style={styles.closeFooterBtn} onPress={closeBalise} disabled={resolving}>
              <Text style={styles.closeFooterText}>Clôturer la balise {activeBalise.code}</Text>
            </Pressable>
          )}
        </>
      )}

      {/* Illisible modal */}
      {illisibleCode !== null && (
        <IllisibleModal
          scannedCode={illisibleCode}
          sessionId={sessionId}
          onConfirm={handleIllisibleConfirm}
          onCancel={() => setIllisibleCode(null)}
        />
      )}
    </KeyboardAvoidingView>
  )
}

// ─── Scan row ─────────────────────────────────────────────────────────────────
interface ScanRowProps {
  entry: ScanEntry
  onIncrement: () => void
  onDecrement: () => void
  onDelete: () => void
}

function ScanRow({ entry, onIncrement, onDecrement, onDelete }: ScanRowProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { article, qty } = entry
  const isIllisible = article.label === 'INCONNU' || !article.label
  const name = article.label || article.sku
  return (
    <View style={[styles.scanRow, isIllisible && styles.scanRowIllisible]}>
      <View style={styles.scanRowLeft}>
        {article.brand ? <Text style={styles.scanBrand}>{article.brand}</Text> : null}
        <Text style={styles.scanLabel} numberOfLines={1}>{name}</Text>
        <Text style={styles.scanMeta}>{article.sku}{article.ean ? ` · ${article.ean}` : ''}</Text>
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={onDecrement} hitSlop={6}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepQty}>{qty}</Text>
        <Pressable style={styles.stepBtn} onPress={onIncrement} hitSlop={6}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
      <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={6}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </Pressable>
    </View>
  )
}

const FRAME_COLOR_IDLE = 'rgba(255,255,255,0.75)'
const FRAME_COLOR_READY = '#34C759'

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },

    passBanner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      backgroundColor: t.surface, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: t.hairline,
    },
    passDot: { width: 10, height: 10, borderRadius: 5 },
    passLabel: { fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary },

    // ── Zone / balise ──────────────────────────────────────────────────────────
    zoneModeToggle: {
      flexDirection: 'row', marginHorizontal: Spacing.md, marginTop: Spacing.md,
      borderRadius: Radius.md, borderWidth: 1, borderColor: t.hairline,
      overflow: 'hidden', backgroundColor: t.surface, ...t.shadowCard,
    },
    zoneModeBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
    zoneModeText: { fontSize: 14, color: t.textSecondary, fontFamily: Font.semibold },
    zoneModeTextActive: { color: '#fff', fontFamily: Font.bold },
    zoneBanner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      marginHorizontal: Spacing.md, marginTop: Spacing.sm,
      backgroundColor: t.surface, borderRadius: Radius.md, borderWidth: 1.5,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, ...t.shadowCard,
    },
    zoneBannerText: { flex: 1, fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary },
    zoneCloseBtn: { backgroundColor: t.danger, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 7 },
    zoneCloseText: { color: '#fff', fontSize: 13, fontFamily: Font.bold },
    zoneBannerIdle: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
      marginHorizontal: Spacing.md, marginTop: Spacing.sm,
      backgroundColor: t.warningSoft, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    },
    zoneBannerIdleText: { flex: 1, fontSize: 13, fontFamily: Font.semibold, color: t.warning },
    baliseField: { marginHorizontal: Spacing.md, marginTop: Spacing.md, gap: 6 },
    baliseFieldLabel: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular },
    reopenRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: Radius.md, paddingVertical: Spacing.md - 2, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, ...t.shadowCard },
    reopenName: { fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary },
    reopenMeta: { fontSize: 12, color: t.textMuted, ...tabular },
    reopenAction: { fontSize: 13, fontFamily: Font.bold, color: t.accent },
    closeFooterBtn: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: t.danger, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...t.shadowButton },
    closeFooterText: { color: '#fff', fontSize: 15, fontFamily: Font.bold },

    modeToggle: {
      flexDirection: 'row', marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 6,
      borderRadius: Radius.md, borderWidth: 1, borderColor: t.hairline,
      overflow: 'hidden', backgroundColor: t.surface, ...t.shadowCard,
    },
    modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    modeBtnActive: { backgroundColor: t.accent },
    modeBtnText: { fontSize: 13, color: t.textSecondary, fontFamily: Font.semibold },
    modeBtnTextActive: { color: t.onAccent, fontFamily: Font.bold },

    autoScanRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginHorizontal: Spacing.md, marginBottom: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md - 1,
      backgroundColor: t.surface, borderRadius: Radius.md,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    autoScanLabel: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    autoScanPill: {
      paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.pill,
      backgroundColor: t.borderStrong,
    },
    autoScanPillOn: { backgroundColor: t.accent },
    autoScanPillText: { fontSize: 12, fontFamily: Font.bold, color: t.textMuted },
    autoScanPillTextOn: { color: t.onAccent },

    cameraWrapper: { height: 200, marginHorizontal: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden', position: 'relative', backgroundColor: t.cameraBg },
    camera: { flex: 1 },
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm,
    },
    overlayText: { color: '#fff', fontSize: 13, fontFamily: Font.semibold },
    scanFrame: {
      position: 'absolute', top: '15%', left: '12%', right: '12%', height: '50%',
      borderWidth: 2, borderColor: FRAME_COLOR_IDLE, borderRadius: Radius.sm,
    },
    scanFrameReady: { borderColor: FRAME_COLOR_READY, borderWidth: 3 },
    torchBtn: {
      position: 'absolute', top: Spacing.sm, right: Spacing.sm,
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    },
    torchBtnOn: { backgroundColor: '#F5C518', borderColor: '#F5C518' },
    torchIcon: { fontSize: 18 },
    cooldownBar: {
      position: 'absolute', bottom: 28, left: 0, height: 3,
      backgroundColor: FRAME_COLOR_READY, borderRadius: 2,
    },
    hintBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 6, alignItems: 'center',
    },
    hintText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: Font.medium },
    hintTextReady: { color: FRAME_COLOR_READY, fontFamily: Font.bold },

    triggerBtn: {
      marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderRadius: Radius.md,
      paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
      backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, ...t.shadowCard,
    },
    triggerBtnReady: { backgroundColor: '#34C759', borderColor: '#34C759' },
    triggerBtnResolving: { backgroundColor: t.accent, borderColor: t.accent, opacity: 0.85 },
    triggerBtnText: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary },

    permBox: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md },
    permText: { color: t.textSecondary, fontSize: 15, textAlign: 'center', fontFamily: Font.regular },
    permBtn: { backgroundColor: t.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...t.shadowButton },
    permBtnText: { color: t.onAccent, fontFamily: Font.semibold },

    manualContainer: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },
    manualLabel: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular },
    hwHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
    hwDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759' },
    hwTitle: { fontSize: 14, fontFamily: Font.bold, color: t.textPrimary },
    manualRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    manualInput: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 11, fontSize: 16,
      backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular, ...tabular,
    },
    manualBtn: { backgroundColor: t.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: 11, ...t.shadowButton },
    manualBtnText: { color: t.onAccent, fontFamily: Font.bold, fontSize: 16 },

    listHeader: {
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 6,
      borderTopWidth: 1, borderTopColor: t.hairline, marginTop: Spacing.sm,
    },
    listHeaderText: { fontSize: 11, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
    listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.sm },
    emptyHint: { fontSize: 13, color: t.textMuted, textAlign: 'center', marginTop: Spacing.lg, fontFamily: Font.regular },

    scanRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface,
      borderRadius: Radius.md, paddingVertical: Spacing.md - 2, paddingHorizontal: Spacing.md,
      borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, ...t.shadowCard,
    },
    scanRowIllisible: { borderColor: t.warning, borderStyle: 'dashed' },
    scanRowLeft: { flex: 1, gap: 1 },
    scanBrand: { fontSize: 10, fontFamily: Font.bold, color: t.accent, textTransform: 'uppercase', letterSpacing: 0.4 },
    scanLabel: { fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary },
    scanMeta: { fontSize: 11, color: t.textMuted, ...tabular },

    stepper: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.background,
      borderRadius: Radius.sm, borderWidth: 1, borderColor: t.hairline, overflow: 'hidden',
    },
    stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface },
    stepBtnText: { fontSize: 20, fontFamily: Font.semibold, color: t.textPrimary, lineHeight: 24 },
    stepQty: { minWidth: 32, textAlign: 'center', fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, paddingHorizontal: 4, ...tabular },

    deleteBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.dangerSoft, alignItems: 'center', justifyContent: 'center' },
    deleteBtnText: { fontSize: 13, color: t.danger, fontFamily: Font.bold },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // ── Illisible modal ──────────────────────────────────────────────────────────
    illBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    illSheet: {
      backgroundColor: t.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.lg, maxHeight: '85%',
    },
    illHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    illIconWrap: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: t.warningSoft, alignItems: 'center', justifyContent: 'center',
    },
    illIcon: { fontSize: 22, fontFamily: Font.bold, color: t.warning },
    illTitle: { fontSize: 17, fontFamily: Font.bold, color: t.textPrimary },
    illSub: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular },
    fieldLabel: { fontSize: 13, fontFamily: Font.semibold, color: t.textPrimary, marginBottom: 4 },
    fieldHint: { fontSize: 12, color: t.textMuted, marginTop: -Spacing.sm + 2, marginBottom: Spacing.sm, fontFamily: Font.regular },
    fieldInput: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 11, fontSize: 15,
      backgroundColor: t.background, color: t.textPrimary, marginBottom: Spacing.md, fontFamily: Font.regular,
    },
    fieldInputMulti: { height: 80, textAlignVertical: 'top' },
    illNote: { fontSize: 12, color: t.textMuted, lineHeight: 18, marginTop: 4, marginBottom: Spacing.sm, fontFamily: Font.regular },
    illBtnRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
    illBtnCancel: {
      flex: 1, borderWidth: 1, borderColor: t.borderStrong,
      borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center',
    },
    illBtnCancelText: { fontSize: 15, color: t.textSecondary, fontFamily: Font.semibold },
    illBtnConfirm: { flex: 2, backgroundColor: t.warning, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center' },
    illBtnConfirmText: { fontSize: 15, color: '#fff', fontFamily: Font.bold },
  })
}
