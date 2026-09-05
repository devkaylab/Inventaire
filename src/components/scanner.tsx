import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useNavigation } from 'expo-router'
// ⚠️ Chemin interne, faute de mieux : expo-router embarque react-navigation
// mais n'exporte pas `usePreventRemove`, alors que c'est le seul mécanisme qui
// retienne un retour natif (le runtime le nomme lui-même dans son alerte).
// `tests/comptage.test.ts` échoue si ce fichier disparaît d'une mise à jour —
// sans quoi la garde du retour sauterait en silence.
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove'
import type { NavigationAction as ActionNavigation } from 'expo-router/build/react-navigation/routers'
import { useKeepAwake } from 'expo-keep-awake'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getZoneDashboard, viderBalise } from '@/lib/queries'
import type { Article, BaliseMode, ScanEntrySeed } from '@/lib/queries'
// Résolution d'article, création d'un article inconnu et ouverture/clôture de
// balise passent par la couche hors ligne : mêmes signatures, avec repli sur le
// cache local et mise en attente quand le réseau tombe. Voir `@/lib/offlineSync`.
//
// ⚠️ `insertArticle` vient de là, PAS de `@/lib/queries`. Il en venait jusqu'au
// 1er septembre 2026, et c'est ce qui faisait échouer « Article inconnu » en
// réserve avec « fetch failed » — sur les deux plateformes.
import { getScanEntries, insertArticle, resolveArticle, setBalise } from '@/lib/offlineSync'
import { parseBalise } from '@/lib/balises'
import { passLabel, AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { useTheme } from '@/lib/theme'
import { CroixIcon, TorcheIcon } from '@/components/ui/Icones'
import { ChevronIcon } from '@/components/ui/MenuList'
import { useRepere } from '@/lib/reperes'
import { useAuth } from '@/lib/auth'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { errorMessage } from '@/lib/errors'
import { loadScanSound, playScanSound, playErrorSound, unloadScanSound } from '@/lib/scanSound'
import { pingSession, useSessionPresence, type PresenceActivity } from '@/lib/presence'
import { usePlaceAppareil } from '@/lib/appareil'
import { demander, demanderChoix, signaler } from '@/lib/dialogue'
import { redresserSaisie, redresserNumero, clavierDecale } from '@/lib/douchette'
import { ClavierEvite } from '@/components/ui/ClavierEvite'

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
  /** Balise ouverte, pour que l'article parte avec les comptages du même
   *  endroit quand il est mis en attente. `null` hors mode zones. */
  zone: string | null
  onConfirm: (article: Article) => void
  onCancel: () => void
}

function IllisibleModal({ scannedCode, sessionId, zone, onConfirm, onCancel }: IllisibleModalProps) {
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
      signaler.erreur('Erreur', 'Saisissez au moins un code (SKU ou EAN).')
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
      }, zone)
      onConfirm(article)
    } catch (e) {
      signaler.erreur('Erreur', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel}>
      <ClavierEvite style={styles.illBackdrop}>
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
              {"Cet article sera ajouté au référentiel de l'inventaire avec un prix d'achat à 0 €."}
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
      </ClavierEvite>
    </Modal>
  )
}

// ─── Scanner ──────────────────────────────────────────────────────────────────
/**
 * ⚠️ **Une seule définition de la géométrie du cadre**, lue par le dessin *et*
 * par le filtre. Deux définitions dériveraient au premier ajustement, et le
 * cadre cesserait de dire la vérité — ce qui est exactement le défaut qu'on
 * ferme ici.
 *
 * Le carré de la phase balise se mesure dans les deux sens : un carré demande
 * la même valeur en largeur et en hauteur, pas deux pourcentages.
 */
export function rectCadre(l: number, h: number, balise: boolean) {
  if (balise) {
    const cote = Math.min(l * 0.58, h * 0.62)
    return { x: (l - cote) / 2, y: (h - cote) / 2, l: cote, h: cote }
  }
  const cl = l * 0.84
  const ch = h * 0.46
  return { x: (l - cl) / 2, y: (h - ch) / 2, l: cl, h: ch }
}

/**
 * Le code visé est-il dans le cadre ? On teste **son centre**, pas son
 * débordement : un code-barres qui dépasse un peu du cadre a bel et bien été
 * visé, le refuser serait absurde.
 *
 * ⚠️ **On laisse passer quand la position est inconnue.** expo-camera prévient
 * que `bounds` « peut représenter un rectangle vide » et « ne borne pas
 * forcément tout le code-barres ». Refuser dans ce cas rendrait certains codes
 * illisibles sans que rien ne l'explique — mieux vaut un scan de trop.
 */
export function viseDansLeCadre(
  bounds: { origin?: { x: number; y: number }; size?: { width: number; height: number } } | undefined,
  vue: { l: number; h: number } | null,
  balise: boolean,
): boolean {
  if (!vue || vue.l <= 0 || vue.h <= 0) return true
  const o = bounds?.origin
  const s = bounds?.size
  if (!o || !s || s.width <= 0 || s.height <= 0) return true
  const cx = o.x + s.width / 2
  const cy = o.y + s.height / 2
  const c = rectCadre(vue.l, vue.h, balise)
  return cx >= c.x && cx <= c.x + c.l && cy >= c.y && cy <= c.y + c.h
}

export function Scanner({
  sessionId, passNumber, onArticleResolved, initialScans,
  zoneMode = false, mode: baliseMode = 'count', onModeChange, lockMode = false, countedBy,
}: ScannerProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()
  const navigation = useNavigation()
  /**
   * Une balise terminée ouverte pour être **consultée** : rien n'est écrit
   * côté serveur tant qu'on n'a rien compté. L'état sert au garde-fou du
   * retour (qui ne doit alors rien demander), le ref aux appels asynchrones.
   */
  // ⚠️ L'état n'a plus de lecteur depuis que la question du retour se pose
  // toujours : c'est le ref qui dit, au moment du clic, si la balise est
  // réellement ouverte — et un ref est frais, là où un état capturé dans le
  // hook serait celui d'un ancien rendu. Le setter reste, il garde les deux
  // en phase.
  const [, setOuvertureDifferee] = useState(false)
  const ouvertureDiffereeRef = useRef(false)
  // ── L'écran ne se verrouille pas pendant le comptage ──────────────────────
  //
  // Compter, c'est poser le téléphone sur une étagère, scanner, le reprendre.
  // Au verrouillage l'écran quitte la page : il faut déverrouiller, retrouver
  // l'inventaire, rouvrir le comptage — et une douchette, qui écrit dans un
  // champ, perd son champ. Le verrou est levé tant que ce composant est monté,
  // donc tant qu'on est sur la page de comptage, et repris en la quittant :
  // c'est ce qui évite de vider la batterie une fois le travail fini.
  useKeepAwake('comptage')
  // Couleur du mode : Compter = accent, Auditer = or.
  const modeColor = baliseMode === 'audit' ? AUDIT_COLOR : theme.accent
  const modeOn = baliseMode === 'audit' ? AUDIT_ON : theme.onAccent
  const [permission, requestPermission, relirePermission] = useCameraPermissions()
  const [mode, setMode] = useState<Mode>('camera')
  const [manualInput, setManualInput] = useState('')
  // Douchette (Zebra/Honeywell/Inateck/BT HID) — capture keyboard-wedge en
  // mode dédié.
  //
  // ⚠️ **Ces deux champs ne sont pas pilotés par un état React**, et c'est ce
  // qui rend la capture fiable : une douchette écrit treize touches en moins
  // d'un dixième de seconde, et un `value={état}` renvoie au natif un texte
  // déjà périmé — des caractères disparaissent au milieu du code, sans que
  // rien ne le signale. Constat de Julien le 25 août 2026 : sur un EAN de
  // treize chiffres, deux manquaient. Le tampon est donc une référence, mise à
  // jour à chaque frappe et lue au moment de valider.
  const hwBufRef = useRef('')
  const hwInputRef = useRef<TextInput>(null)
  // ⚠️ `clear()` ne suffit pas à vider le champ (voir `viderChampDouchette`) :
  // ce compteur le REMONTE, ce qui est la seule façon sûre.
  const [hwSeq, setHwSeq] = useState(0)
  // Le champ est non contrôlé : cet état ne dit QUE s'il est vide ou non, donc
  // il bascule une fois par scan et non à chaque frappe.
  const [hwPlein, setHwPlein] = useState(false)
  const baliseBufRef = useRef('')
  const baliseInputRef = useRef<TextInput>(null)
  // Une douchette QWERTY sur un iPhone AZERTY écrit &é"' au lieu de 1234.
  // Une fois le décalage constaté, il ne se corrige pas tout seul en cours de
  // comptage : on le retient pour redresser aussi les codes qui n'en portent
  // aucune preuve (une référence sans chiffre). Voir `@/lib/douchette`.
  const clavierDecaleRef = useRef(false)
  const [resolving, setResolving] = useState(false)
  const [recentScans, setRecentScans] = useState<ScanEntry[]>([])
  // La liste des scans passe derrière un bouton : pendant qu'on compte, on
  // regarde le rayon, pas le téléphone. Ce qui rend le geste sûr, c'est que la
  // question « est-ce que ça a pris ? » a déjà sa réponse dans la ligne
  // « Dernier scan », sous le viseur.
  const [feuilleScans, setFeuilleScans] = useState(false)
  // Lue par le détecteur, qui n'est mémoïsé que sur [barcodeReady].
  const feuilleScansRef = useRef(false)
  useEffect(() => { feuilleScansRef.current = feuilleScans }, [feuilleScans])
  const [barcodeReady, setBarcodeReady] = useState(false)
  const [illisibleCode, setIllisibleCode] = useState<string | null>(null)
  // Miroir : `handleHardwareSubmit` reprend la main APRÈS l'await, quand la
  // valeur capturée au rendu ne dit plus la vérité.
  const illisibleRef = useRef<string | null>(null)
  illisibleRef.current = illisibleCode
  const [autoScan, setAutoScan] = useState(true)
  const [torch, setTorch] = useState(false)
  const seededRef = useRef(false)

  // ── Objectif : viser la mise au point rapprochée ───────────────────────────
  //
  // `selectedLens` vaut par défaut `builtInWideAngleCamera` (expo-camera 56),
  // dont la distance minimale de mise au point est d'une dizaine de
  // centimètres. C'est ce qui rendait l'app moins capable que l'appareil photo
  // du téléphone : celui-ci utilise un périphérique **virtuel** qui bascule
  // tout seul sur l'ultra grand-angle quand on approche — c'est le mode macro.
  //
  // On demande donc le même périphérique virtuel quand il existe. iOS gère la
  // bascule ; sur les modèles sans ultra grand-angle, la liste ne les contient
  // pas et on garde l'objectif par défaut. La prop est ignorée sur Android.
  const cameraRef = useRef<CameraView>(null)
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined)

  /**
   * ⚠️ **`getAvailableLensesAsync` rend le nom LOCALISÉ de l'objectif, pas son
   * identifiant.** Côté natif : `availableLenses.map { $0.localizedName }`, et
   * `selectedLens` est comparé au même nom. Une liste écrite en identifiants
   * (`builtInTripleCamera`, `builtInDualWideCamera`) ne correspond donc jamais
   * — c'est ce que faisait ce code depuis le 13 août.
   *
   * Conséquence, et elle explique le constat de Julien du 29 août 2026 (« le
   * close-up ne marche plus ») : aucun objectif n'étant sélectionné, expo-camera
   * retombait sur `defaultBackCamera`, qui rend **`builtInWideAngleCamera`** —
   * l'objectif simple, qui ne fait pas le point sous une dizaine de
   * centimètres. La macro était donc hors d'atteinte.
   *
   * On cherche maintenant un périphérique **virtuel** par ce que son nom dit,
   * dans la langue du téléphone : « triple », « double » ou « dual ». Un
   * périphérique virtuel embarque l'ultra grand-angle et laisse iOS basculer
   * en macro quand on s'approche — c'est lui qui fait le rapproché, pas un
   * réglage.
   *
   * ⚠️ On ne prend toujours pas l'ultra grand-angle SEUL : son champ à 0,5×
   * rendrait les codes-barres minuscules à distance normale, pour ne gagner
   * que le très rapproché.
   */
  const pickCloseFocusLens = useCallback(async () => {
    try {
      const lenses = await cameraRef.current?.getAvailableLensesAsync()
      if (!lenses?.length) return
      const sansAccent = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const virtuel =
        lenses.find(l => sansAccent(l).includes('triple'))
        ?? lenses.find(l => /dual|double/.test(sansAccent(l)))
      if (virtuel) setSelectedLens(virtuel)
    } catch {
      // Pas de liste : on garde l'objectif par défaut plutôt que d'échouer.
    }
  }, [])

  // Recréer l'objet à chaque rendu ferait re-pousser les réglages au natif ;
  // la liste est constante, on la fige.
  const barcodeSettings = useMemo(
    () => ({ barcodeTypes: [...BARCODE_TYPES] as never }),
    [],
  )

  // ── Zone mode : balise actuellement ouverte ────────────────────────────────
  const [activeBalise, setActiveBaliseState] = useState<{ code: string; name: string | null } | null>(null)
  // Les deux repères du premier scan : ce qui vient de se passer, et ce qui
  // vient ensuite. Chacun sa clé, chacun vu une fois — jamais une chaîne.
  const { profile } = useAuth()
  const repereOuverture = useRepere('premiere-balise', profile?.id)
  /* ⚠️ CES DEUX REPÈRES PASSENT PAR LE VOLET, PAS PAR UNE CARTE EN LIGNE.
   *
   * Premier jet : deux cartes glissées dans la colonne, comme sur la maquette.
   * Compté avant de le construire, et ça ne tient pas : cet écran est une
   * colonne à HAUTEUR FIXE — bandeau de zone, bascule des modes, scan
   * automatique, caméra, déclencheur, liste, clôture. Sur un iPhone SE la
   * somme atteint déjà la hauteur utile ; une carte de plus, et le bas sort de
   * l'écran, même avec la caméra réduite à son minimum.
   *
   * Le volet recouvre au lieu de pousser : il ne peut rien faire déborder, et
   * c'est déjà le format des deux repères du premier scan sur cet écran.
   */
  const repereModes = useRepere('modes-de-scan', profile?.id)
  const repereCorriger = useRepere('corriger-scan', profile?.id)
  const repereCloture = useRepere('balise-terminee', profile?.id)
  const [volet, setVolet] = useState<null | { genre: 'ouverte'; code: string; nom: string | null }
    | { genre: 'terminee'; code: string; nom: string | null; pieces: number; refs: number }
    | { genre: 'modes' } | { genre: 'corriger' }>(null)
  // Miroirs : lus depuis `setRecentScans`, où l'état capturé au rendu ment.
  const voletRef = useRef(false)
  voletRef.current = volet !== null
  const repereCorrigerRef = useRef(false)
  repereCorrigerRef.current = repereCorriger.aVoir
  // Refs miroir : resolveAndRecord est capturé par un callback mémoïsé et doit
  // lire les valeurs courantes (mode, balise active) sans closure périmée.
  const activeBaliseRef = useRef<{ code: string; name: string | null } | null>(null)
  const zoneModeRef = useRef(zoneMode)
  const baliseModeRef = useRef<BaliseMode>(baliseMode)
  // Code de la balise venant d'être ouverte/fermée : ignoré tant qu'il reste
  // dans le champ (évite de re-fermer/ré-ouvrir aussitôt le même sticker).
  const ignoreBaliseRef = useRef<string | null>(null)
  // ⚠️ Miroir obligatoire : `closeBalise` est atteint depuis
  // `handleBarcodeDetected`, mémoïsé sur [barcodeReady] seul. Lire
  // `recentScans` directement y donnerait la valeur d'un ancien rendu —
  // donc « 0 pièce » dans le volet de première clôture.
  const recentScansRef = useRef<ScanEntry[]>([])
  useEffect(() => { recentScansRef.current = recentScans }, [recentScans])
  useEffect(() => { zoneModeRef.current = zoneMode }, [zoneMode])
  useEffect(() => { baliseModeRef.current = baliseMode }, [baliseMode])

  function setActiveBalise(v: { code: string; name: string | null } | null) {
    activeBaliseRef.current = v
    setActiveBaliseState(v)
  }

  // ── Présence temps réel ────────────────────────────────────────────────────
  // Le mode est dérivé de `passNumber` (1 = comptage, 2 = audit), la valeur
  // réellement écrite dans `counts.pass_number` : le compteur affiché au
  // superviseur et les comptages enregistrés désignent ainsi la même chose.
  // La balise ouverte n'est plus publiée (contrat v2) : l'avancement par zone
  // du site la donne, rattachée au travail et non à la personne.
  const presenceActivity = useMemo<PresenceActivity>(() => ({
    mode: passNumber === 2 ? 'audit' : 'count',
  }), [passNumber])
  useSessionPresence(sessionId, presenceActivity)

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

  // Le handler de détection n'est mémoïsé que sur [barcodeReady] : il lit donc
  // la phase et la taille du viseur par référence, jamais par état.
  const balisePhaseRef = useRef(balisePhase)
  useEffect(() => { balisePhaseRef.current = balisePhase }, [balisePhase])
  const [tailleVue, setTailleVue] = useState<{ l: number; h: number } | null>(null)
  const tailleVueRef = useRef<{ l: number; h: number } | null>(null)

  // Balises déjà terminées (mode courant) — pour revenir corriger une erreur.
  const { data: zoneRows } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
    enabled: zoneMode,
  })
  const doneBalises = (zoneRows ?? []).filter(
    (z) => (baliseMode === 'count' ? z.count_status : z.audit_status) === 'done',
  )

  // ── Rouvrir une balise terminée : le dire avant, pas après ────────────────
  //
  // `counts` est en **ajout pur** — rouvrir une balise n'efface rien, les
  // scans s'ajoutent au total déjà là. Le superviseur s'en aperçoit : la liste
  // se réamorce sous ses yeux avec l'existant. **Le compteur, non** : la
  // policy `counts_select_own` ne lui rend que ses propres lignes, donc la
  // liste s'affiche vide alors que la balise porte déjà des pièces, et il
  // double le comptage sans le voir.
  //
  // Le total, lui, lui est accessible — `get_zone_dashboard` est SECURITY
  // DEFINER et somme tous les compteurs. C'est donc une donnée qu'il a déjà
  // sur son téléphone, et qu'il suffit de lui mettre devant les yeux au bon
  // moment. Rien à ouvrir côté serveur : les droits sur les lignes restent ce
  // qu'ils sont, on ne dit ni qui a compté, ni quoi.
  //
  // ⚠️ Se pose **avant** d'appeler `set_balise` : après, la balise serait déjà
  // rouverte, et refuser obligerait à la reclôturer — ce qui déplacerait sa
  // date de clôture pour rien.

  /** La même normalisation que `norm_balise` en base : sans espaces, en capitales. */
  const normBalise = (v: string) => v.replace(/\s/g, '').toUpperCase()

  /**
   * La ligne de la balise si elle est **terminée** dans le mode courant.
   *
   * C'est ce qui déclenche l'ouverture différée : une balise finie qu'on vient
   * consulter ne doit rien changer côté serveur tant qu'on n'a rien compté.
   * Contrairement à `baliseDejaFaite`, elle ne demande pas que la balise porte
   * des pièces : un rayon vide clôturé est terminé lui aussi, et le décompter
   * pour l'avoir regardé serait le même défaut.
   */
  function rangeeTerminee(code: string) {
    const cible = normBalise(code)
    const z = (zoneRows ?? []).find((r) => normBalise(r.code) === cible)
    if (!z) return null
    const compte = baliseModeRef.current === 'count'
    return (compte ? z.count_status : z.audit_status) === 'done' ? z : null
  }

  /**
   * Ce que QUELQU'UN D'AUTRE a déjà compté sur cette balise.
   *
   * ⚠️ **Trois choses ont changé le 2 septembre 2026**, après le test de Julien
   * où deux superviseurs ont compté la même balise sans que rien ne les
   * prévienne :
   *
   * 1. **on ne demande plus que la balise soit CLÔTURÉE.** C'était le trou :
   *    un collègue qui laisse sa balise ouverte n'était signalé nulle part, et
   *    les deux relevés s'additionnaient en silence — `counts` est un journal
   *    en ajout pur ;
   * 2. **on ne compte que les pièces des AUTRES** (`*_autres`, servi par
   *    `get_zone_dashboard`). Rouvrir sa propre balise ne demande donc rien :
   *    une carte qui s'affiche à chaque retour devient une carte qu'on ferme
   *    sans lire ;
   * 3. la carte dit **si le comptage est clôturé ou en cours** — ce ne sont pas
   *    les mêmes gestes derrière, et pas la même phrase.
   *
   * ⚠️ Elle ne nomme personne, et ne le doit pas : un compteur ne voit que ses
   * propres lignes (`counts_select_own`), et le suivi a été dépersonnalisé le
   * 19 août. Le nombre de pièces suffit à comprendre qu'on n'est pas seul.
   */
  function baliseDejaFaite(
    code: string,
  ): { unites: number; refs: number; cloturee: boolean } | null {
    const cible = normBalise(code)
    const z = (zoneRows ?? []).find((r) => normBalise(r.code) === cible)
    if (!z) return null
    const compte = baliseModeRef.current === 'count'
    const unites = Math.round(Number(compte ? z.count_units_autres : z.audit_units_autres))
    const refs = Number(compte ? z.count_lines_autres : z.audit_lines_autres)
    if (!(unites > 0)) return null
    return { unites, refs, cloturee: (compte ? z.count_status : z.audit_status) === 'done' }
  }

  // Réamorce la liste avec le contenu de la balise ouverte (tous compteurs),
  // pour voir et corriger ce qui a déjà été compté/audité dans cette zone.
  useEffect(() => {
    if (!zoneMode) return
    const code = activeBalise?.code
    if (!code) { setRecentScans([]); return }
    let cancelled = false
    // ⚠️ `getScanEntries`, pas `getMyScanEntries` : hors ligne, la liste se
    // reconstruit depuis la file d'attente. Et l'échec **vide** la liste — le
    // `.catch` d'avant ne faisait rien, si bien que les scans de la balise
    // précédente restaient affichés sous la nouvelle, et un « − » posé là
    // écrivait une correction dans la mauvaise balise.
    getScanEntries(sessionId, passNumber, countedBy ?? '', code)
      .then((entries) => {
        if (cancelled) return
        setRecentScans(entries.map((e) => ({ id: `${e.article.sku}-${e.timestamp}`, article: e.article, qty: e.qty, timestamp: e.timestamp })))
      })
      .catch(() => { if (!cancelled) setRecentScans([]) })
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

  // ⚠️ Cet effet rappelait `requestPermission()` à **chaque** changement de
  // `permission`. Sur iOS, après un refus, la boîte système ne revient jamais :
  // l'appel était inerte, l'écran restait sans issue, et on tournait à vide.
  // On ne demande donc que tant que le système accepte encore la question.
  // ⚠️ On ne demande plus rien tout seul. La boîte système partait au montage,
  // sans un mot : un refus à cet instant est définitif sur iOS. Elle attend
  // désormais le bouton de l'écran d'amorce ci-dessous.
  const amorceNecessaire = permission?.status === 'undetermined' && permission.canAskAgain

  /**
   * La place de cet appareil dans le forfait du magasin.
   *
   * ⚠️ ELLE NE SE PREND QUE SUR CET ÉCRAN, et c'est ce qui la rend juste :
   * l'assiette facturée est « les appareils qui comptent EN MÊME TEMPS ». Un
   * téléphone posé sur l'écran d'un inventaire ne compte pas, et lui faire
   * prendre une place priverait un collègue de la sienne.
   *
   * Elle attend que la caméra soit autorisée : l'écran d'amorce est une
   * demande de permission, pas du comptage. Et elle est rendue au démontage —
   * voir `usePlaceAppareil`.
   */
  const place = usePlaceAppareil(sessionId, !amorceNecessaire)

  // Retour des Réglages : sans cette relecture, l'écran resterait sur
  // « refusé » alors que l'autorisation vient d'être accordée.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') void relirePermission()
    })
    return () => sub.remove()
  }, [relirePermission])

  useEffect(() => {
    loadScanSound()
    return () => {
      if (detectionTimer.current) clearTimeout(detectionTimer.current)
      unloadScanSound()
    }
  }, [])

  /**
   * « Trois façons de scanner », une fois, en phase article.
   *
   * ⚠️ Il attend que le volet « balise ouverte » soit refermé. Les deux se
   * déclenchent au même instant — on ouvre une balise, on passe en phase
   * article — et deux volets d'affilée, c'est une aide qu'on ferme sans lire.
   * Règle du projet : on ne sert jamais deux aides à la fois.
   */
  useEffect(() => {
    if (balisePhase || volet !== null || !repereModes.aVoir) return
    const id = setTimeout(() => setVolet(v => (v === null ? { genre: 'modes' } : v)), 700)
    return () => clearTimeout(id)
  }, [balisePhase, volet, repereModes.aVoir])

  /**
   * Fermer un volet, c'est avoir lu — donc marquer le repère correspondant.
   *
   * ⚠️ Les deux volets du premier scan étaient marqués ailleurs, à leur
   * ouverture ; les deux nouveaux le sont ICI, parce qu'ils expliquent au lieu
   * d'annoncer : tant que la personne n'a pas fermé, elle n'a rien lu.
   */
  const fermerVolet = useCallback(() => {
    setVolet(v => {
      if (v?.genre === 'modes') repereModes.marquerVu()
      if (v?.genre === 'corriger') repereCorriger.marquerVu()
      return null
    })
  }, [repereModes, repereCorriger])

  // ── Mode douchette : maintient le focus sur le champ de capture pour recevoir
  // les frappes de la douchette, sauf pendant la saisie « article inconnu ». ──
  useEffect(() => {
    // Le champ est démonté à chaque changement de mode : son tampon doit
    // l'être aussi, sinon un scan resté en cours ressortirait plus tard sous
    // les yeux de personne.
    hwBufRef.current = ''
    if (mode !== 'hardware' || balisePhase || illisibleCode !== null) return
    const id = setTimeout(() => hwInputRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [mode, balisePhase, illisibleCode])

  // Même raison pour le champ d'ouverture d'une balise.
  useEffect(() => { baliseBufRef.current = '' }, [balisePhase])

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
    // ⚠️ La liste ouverte arrête le scan. Elle recouvre le viseur : ce que la
    // caméra continuerait de lire derrière n'a été visé par personne, et
    // s'ajouterait au comptage pendant qu'on relit justement ce comptage.
    // Demande de Julien le 29 août 2026, « pour éviter les scans fantômes ».
    //
    // On ignore la détection plutôt que de débrancher `onBarcodeScanned` :
    // expo-camera calcule `barcodeScannerEnabled = !!onBarcodeScanned`, et
    // couper puis rebrancher reconfigure la session de capture — ce qui
    // éteint la torche au passage.
    if (feuilleScansRef.current) return

    // Le cadre fait loi : ce qui est lu ailleurs dans l'image n'a pas été visé.
    // Sans ce filtre, un code posé sur la table ou imprimé sur le carton d'à
    // côté est compté comme si on l'avait cadré.
    if (!viseDansLeCadre(result.bounds, tailleVueRef.current, balisePhaseRef.current)) return

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
          signaler.erreur('Zone fermée', 'Scannez d’abord une balise pour ouvrir une zone.')
          return
        }
      }

      const article = await resolveArticle(sessionId, value)
      if (!article) {
        playErrorSound()
        illisibleRef.current = value
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
  //
  // `allowCreate` n'est vrai qu'au second passage, quand la personne a confirmé
  // vouloir ajouter une balise absente des plages de l'inventaire.
  /**
   * @param sansAvertir  vrai quand la personne vient **exprès** rouvrir une
   *                     balise depuis « Revenir sur une balise » : ce rang
   *                     affiche déjà le total et son bouton dit « Rouvrir ».
   *                     L'avertissement long — celui qui sert au scan d'une
   *                     étiquette qu'on croit neuve — n'y aurait rien à
   *                     apprendre, et le répéter apprendrait à cliquer sans
   *                     lire. ⚠️ Ce rang pose en revanche **sa propre**
   *                     question, courte, depuis le 25 août 2026 : voir
   *                     `rouvrirDepuisListe`.
   */
  /**
   * « Reprendre à zéro » : vider la balise, puis l'ouvrir neuve.
   *
   * ⚠️ **Une seconde carte, et elle nomme ce qu'on perd.** Le premier bouton
   * ouvre une possibilité, celui-ci l'exécute — et il efface le travail de
   * toute l'équipe sur ce rayon, audits compris. Le site exige d'y retaper le
   * numéro de la balise ; ici la confirmation le NOMME et compte les pièces,
   * ce qui est la même exigence que pour supprimer un inventaire entier depuis
   * l'application. Demander une saisie au clavier serait plus strict sur une
   * balise que sur l'inventaire qui la contient — et ferait monter le clavier
   * par-dessus la carte sur l'écran même où il pose déjà problème.
   *
   * ⚠️ **Rien ne part en file d'attente.** Sans réseau on refuse et on n'ouvre
   * pas : mettre un effacement en attente reviendrait à détruire plus tard
   * quelque chose qu'on n'a pas regardé.
   */
  async function reprendreAZero(
    code: string, faite: { unites: number; refs: number },
  ): Promise<boolean> {
    const p = faite.unites > 1 ? 's' : ''
    const r = faite.refs > 1 ? 's' : ''
    const ok = await demander({
      titre: `Effacer les comptages de la balise ${code} ?`,
      texte: `${faite.unites} pièce${p} sur ${faite.refs} référence${r} comptée${p} par `
        + `l’équipe seront effacée${p}, audits compris. La balise redeviendra à faire, `
        + 'et vous la compterez comme neuve.',
      note: 'Rien n’est récupérable ensuite. Le rayon, lui, est toujours là : '
        + 'il se recompte.',
      action: 'Effacer et recompter',
      annuler: 'Annuler',
      ton: 'danger',
    })
    if (!ok) return false
    try {
      const res = await viderBalise(sessionId, code)
      if (!res.success) {
        playErrorSound()
        signaler.erreur('Balise', res.error ?? 'Impossible de vider cette balise.')
        return false
      }
      await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
      setRecentScans([])
      signaler.succes(`Balise ${code} remise à zéro`, 'Vous pouvez la compter comme neuve.')
      return true
    } catch (e) {
      playErrorSound()
      signaler.erreur('Balise', errorMessage(e))
      return false
    }
  }

  async function openBaliseCode(
    code: string, closePrev: boolean, allowCreate = false, sansAvertir = false,
  ) {
    const compte = baliseModeRef.current === 'count'
    const faite = allowCreate || sansAvertir ? null : baliseDejaFaite(code)
    if (faite) {
      const p = faite.unites > 1 ? 's' : ''
      const r = faite.refs > 1 ? 's' : ''
      const dejaLa = `${faite.unites} pièce${p} sur ${faite.refs} référence${r} y sont déjà `
        + `enregistrée${p}`
      const choix = await demanderChoix({
        // Clôturée : quelqu'un a fini. En cours : quelqu'un est peut-être
        // encore dessus — ce n'est pas la même chose à savoir.
        titre: faite.cloturee
          ? `Balise ${code} déjà ${compte ? 'comptée' : 'auditée'}`
          : `Quelqu’un ${compte ? 'compte' : 'audite'} sur la balise ${code}`,
        surtitre: faite.cloturee ? undefined : 'Attention',
        texte: faite.cloturee
          ? `${dejaLa}, et le ${compte ? 'comptage' : 'audit'} a été clôturé. `
            + 'Vos scans viendront s’ajouter à ce total.'
          : `${dejaLa}, et le ${compte ? 'comptage' : 'audit'} n’est pas clôturé. `
            + 'Vos scans viendront s’ajouter à ce total.',
        note: faite.cloturee
          ? 'Vous revenez corriger une erreur ? Continuez. Vous pensiez ouvrir une '
            + 'balise neuve ? Vérifiez le numéro sur l’étiquette.'
          : 'Vous vous partagez le rayon ? Continuez. Vous pensiez ouvrir une '
            + 'balise neuve ? Vérifiez le numéro sur l’étiquette.',
        action: compte ? 'Continuer le comptage' : 'Continuer l’audit',
        alternative: 'Reprendre à zéro',
        annuler: 'Ne pas ouvrir',
      })
      if (choix === 'annuler') return
      // ⚠️ Le remplacement n'est JAMAIS le défaut, il est le second bouton — et
      // il repasse par sa propre confirmation, qui nomme ce qu'on perd. Le
      // modèle en ajout pur reste : rien ne s'écrase en silence.
      if (choix === 'alternative' && !(await reprendreAZero(code, faite))) return
    }
    try {
      if (closePrev && activeBaliseRef.current && !ouvertureDiffereeRef.current) {
        await setBalise(sessionId, activeBaliseRef.current.code, baliseModeRef.current, false)
      }
      // ── Consulter n'ouvre rien ────────────────────────────────────────────
      // Une balise déjà terminée s'ouvre **en local seulement** : sa ligne ne
      // bouge pas, elle reste « comptée » avec sa date d'origine. L'ouverture
      // ne devient réelle qu'au premier geste qui touche au comptage (voir
      // `materialiserOuverture`). Sans cela, la seule consultation la
      // décomptait — et le garde-fou du retour ne rattrapait pas une
      // application tuée, un téléphone à plat ou une panne au mauvais moment.
      const terminee = allowCreate ? null : rangeeTerminee(code)
      if (terminee) {
        ignoreBaliseRef.current = terminee.code
        ouvertureDiffereeRef.current = true
        setOuvertureDifferee(true)
        setActiveBalise({ code: terminee.code, name: terminee.name ?? null })
        pingSession(sessionId, 'balise')
        playScanSound()
        return
      }
      const result = await setBalise(sessionId, code, baliseModeRef.current, true, allowCreate)
      if (!result.success) {
        playErrorSound()
        // Balise qui n'appartient à aucune plage : ce n'est pas une erreur de
        // manipulation, c'est une plage que le superviseur n'a pas couverte.
        // Un « OK » sec laissait le compteur devant une étiquette bien réelle,
        // sans moyen d'avancer. On lui propose donc de l'ajouter.
        //
        // Le libellé vient de `set_balise` (comparaison souple : il n'y a pas
        // de code d'erreur distinct côté base).
        if (!allowCreate && /non\s+d[ée]finie/i.test(result.error ?? '')) {
          void demander({
            titre: 'Balise hors plage',
            texte: `La balise ${code} n'appartient à aucune plage de cet inventaire. Vérifiez le numéro.`,
            note: 'Si l’étiquette est bien collée dans ce magasin, ajoutez-la pour compter tout de suite — le superviseur lui donnera son emplacement ensuite.',
            action: 'Ajouter',
          }).then((ok) => {
            // La zone précédente a déjà été clôturée au premier passage :
            // ne pas la reclôturer.
            if (ok) void openBaliseCode(code, false, true)
          })
          return
        }
        signaler.erreur('Balise', result.error ?? 'Balise inconnue.')
        return
      }
      ignoreBaliseRef.current = result.code ?? code
      setActiveBalise({ code: result.code ?? code, name: result.name ?? null })
      if (repereOuverture.aVoir) {
        setVolet({ genre: 'ouverte', code: result.code ?? code, nom: result.name ?? null })
        repereOuverture.marquerVu()
      }
      queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
      pingSession(sessionId, 'balise')
      playScanSound()
    } catch (e) {
      playErrorSound()
      signaler.erreur('Erreur', errorMessage(e))
    }
  }

  // ── Clôture la zone ouverte ──────────────────────────────────────────────
  /**
   * Clôturer est un geste **délibéré**, donc confirmé (demande de Julien le
   * 25 août 2026 : « prevent from closing by accident »). Les deux boutons de
   * clôture sont à portée du pouce pendant qu'on scanne, et une clôture de
   * travers annonce un rayon fini qui ne l'est pas — c'est une donnée fausse
   * dans le rapport, pas seulement une gêne.
   *
   * La question nomme ce qui a été compté : c'est le seul chiffre qui permet
   * de se rendre compte qu'on n'est pas sur la bonne balise.
   */
  async function closeBalise(): Promise<boolean> {
    const active = activeBaliseRef.current
    if (!active) return true
    const compte = baliseModeRef.current === 'count'
    const pieces = recentScansRef.current.reduce((n, e) => n + e.qty, 0)
    const p = pieces > 1 ? 's' : ''
    const ok = await demander({
      titre: `Clôturer la balise ${active.code} ?`,
      texte: `${pieces} pièce${p} ${compte ? 'comptée' : 'auditée'}${p}. Vous pourrez y revenir si besoin.`,
      action: 'Clôturer',
      annuler: 'Annuler',
      // Le rouge du bouton qui a ouvert la question. Un geste et sa
      // confirmation doivent porter la même couleur, sinon la carte a l'air
      // de proposer autre chose que ce qu'on vient de toucher.
      ton: 'danger',
      // ⚠️ Mais on garde « Confirmation » : le surtitre par défaut du ton
      // danger est « Action définitive », et clôturer ne l'est pas — la
      // phrase juste au-dessus dit qu'on pourra y revenir.
      surtitre: 'Confirmation',
    })
    if (!ok) return false
    // Ouverture différée jamais concrétisée : rien n'a été ouvert, il n'y a
    // rien à refermer. Rappeler `set_balise` déplacerait sa date de clôture
    // pour rien — c'est justement ce qu'on cherche à préserver.
    if (ouvertureDiffereeRef.current) {
      ouvertureDiffereeRef.current = false
      setOuvertureDifferee(false)
      ignoreBaliseRef.current = active.code
      setActiveBalise(null)
      playScanSound()
      return true
    }
    try {
      const result = await setBalise(sessionId, active.code, baliseModeRef.current, false)
      if (!result.success) {
        signaler.erreur('Balise', result.error ?? 'Clôture impossible.')
        return true
      }
      if (repereCloture.aVoir) {
        // La célébration est une ligne de fait, pas une fanfare : ce sont les
        // chiffres qui font plaisir, et ils viennent de la liste à l'écran.
        const scans = recentScansRef.current
        const pieces = scans.reduce((n, e) => n + e.qty, 0)
        setVolet({
          genre: 'terminee', code: active.code, nom: active.name,
          pieces, refs: scans.length,
        })
        repereCloture.marquerVu()
      }
      ignoreBaliseRef.current = active.code
      setActiveBalise(null)
      queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
      pingSession(sessionId, 'balise')
      playScanSound()
      return true
    } catch (e) {
      signaler.erreur('Erreur', errorMessage(e))
      // La clôture a échoué : on ne quitte pas l'écran dans son dos.
      return false
    }
  }

  /**
   * « Rouvrir » depuis la liste des balises terminées, précédé d'une question.
   *
   * Demandée par Julien le 25 août 2026 — « ça évite les manip accidentelles ».
   * Un rang de liste se touche du pouce en faisant défiler, et l'écran qui
   * s'ouvre a la caméra vive avec le scan automatique : le vrai risque n'est
   * plus de perdre l'état de la balise (la consultation n'écrit plus rien),
   * c'est de **compter dans un rayon déjà fini** sans l'avoir voulu.
   *
   * Elle est volontairement courte et distincte de l'avertissement du scan :
   * celle-ci demande une intention, celle-là apprend un fait.
   */
  async function rouvrirDepuisListe(z: (typeof doneBalises)[number]) {
    const compte = baliseModeRef.current === 'count'
    const unites = Math.round(Number(compte ? z.count_units : z.audit_units))
    const p = unites > 1 ? 's' : ''
    const ok = await demander({
      titre: `Rouvrir la balise ${z.code} ?`,
      texte: `Elle est terminée, avec ${unites} pièce${p} enregistrée${p}. `
        + 'Vous pourrez en ajouter ou les corriger ; rien n’est effacé.',
      action: 'Rouvrir',
      annuler: 'Annuler',
    })
    if (ok) await openBaliseCode(z.code, false, false, true)
  }

  // ── Quitter l'écran avec une balise encore ouverte ────────────────────────
  //
  // ⚠️ **Ouvrir une balise déjà clôturée la décompte.** `set_balise` la repasse
  // en « en cours » et efface sa date de clôture, et rien ne la refermait au
  // retour : il suffisait donc de **regarder** une balise finie pour que
  // l'inventaire la déclare non comptée. Constat de Julien le 25 août 2026 sur
  // « Fwee » — il ouvre la balise 1000, ne scanne rien, revient, et le tableau
  // de bord annonce « aucune balise comptée » alors que ses 23 pièces n'ont
  // jamais bougé (`counts` est en ajout pur, rien n'était perdu : c'est
  // l'étiquette « comptée » qui l'était). Sur le terrain, un compteur qui
  // scanne la mauvaise étiquette puis fait retour décompte une balise finie
  // sans s'en apercevoir.
  //
  // La sortie pose donc la question au lieu de décider dans son dos (choix de
  // Julien parmi trois). Elle ne se pose **que** si une balise est encore
  // ouverte : le trajet normal — clôturer, puis revenir — ne demande rien.
  // ⚠️ **`beforeRemove` ne retient pas cette pile.** Premier essai : l'écran
  // partait quand même, la question s'affichait par-dessus l'écran d'arrivée,
  // et le runtime le disait — « was removed natively but didn't get removed
  // from JS state […] Consider using a 'usePreventRemove' hook ». C'est donc
  // ce hook, et non `navigation.addListener`, qui tient le retour natif et le
  // geste de balayage.
  /**
   * ⚠️ **Retour clôture la balise, exactement comme les deux boutons
   * « Clôturer ».** Demande de Julien, répétée le 29 août 2026 : « Retour doit
   * clôturer au même titre que les deux boutons clôturer ».
   *
   * Ce que j'avais fait de travers, deux fois : une question « Quitter le
   * comptage ? » qui laissait la balise ouverte. Or une balise laissée ouverte
   * **disparaît de l'écran** — la liste « Revenir sur une balise » ne montre
   * que les clôturées —, et ses pièces sont introuvables sans rescanner
   * l'étiquette. Partir sans clôturer n'est donc pas une sortie, c'est une
   * impasse.
   *
   * ⚠️ **Et pas de question quand rien n'est ouvert** (phase balise) : il n'y a
   * rien à clôturer, donc rien à confirmer. Une carte qui s'ouvre pour ne rien
   * décider apprend à répondre sans lire.
   *
   * `closeBalise` porte déjà sa propre confirmation, nommant la balise et son
   * compte : on la réutilise telle quelle plutôt que d'en écrire une seconde
   * qui dériverait. Elle rend `false` si la personne annule ou si la clôture
   * échoue — on reste alors sur l'écran.
   */
  const [sortieAutorisee, setSortieAutorisee] = useState<ActionNavigation | null>(null)
  usePreventRemove(!!activeBalise && !sortieAutorisee, ({ data }) => {
    void closeBalise().then((cloturee) => {
      if (!cloturee) return
      // Retenir l'action et la rejouer au rendu suivant : c'est ce qui lève la
      // garde avant de repartir. La rejouer ici la ferait reprendre au vol.
      setSortieAutorisee(() => data.action)
    })
  })
  useEffect(() => {
    if (sortieAutorisee) navigation.dispatch(sortieAutorisee)
  }, [sortieAutorisee, navigation])

  // ── Ouverture délibérée d'une balise par saisie de son numéro ─────────────
  async function openBaliseManual() {
    const brut = baliseBufRef.current.trim()
    if (!brut) return
    // Ce champ reçoit la frappe de la douchette comme celle du clavier, et il
    // n'attend qu'un nombre : `redresserNumero` s'en sert pour lever
    // l'ambiguïté des touches 6 et 8 d'un AZERTY de PC (Android). Un numéro
    // tapé au pavé numérique traverse sans bouger.
    if (clavierDecale(brut)) clavierDecaleRef.current = true
    const code = redresserNumero(brut, clavierDecaleRef.current)
    Keyboard.dismiss()
    setResolving(true)
    try {
      await openBaliseCode(code, false)
    } finally {
      setResolving(false)
    }
    baliseBufRef.current = ''
    baliseInputRef.current?.clear()
  }

  /**
   * Rend réelle une ouverture différée, puis enregistre. **Tout ce qui écrit
   * un comptage passe par ici** : c'est le seul endroit où « on touche à la
   * balise », donc le seul où elle doit repasser en « en cours ».
   * Elle est appelée avant l'écriture : si l'ouverture échoue, rien n'est
   * compté dans une balise que le tableau de bord croit terminée.
   */
  async function materialiserOuverture() {
    if (!ouvertureDiffereeRef.current) return
    const active = activeBaliseRef.current
    if (!active) return
    const r = await setBalise(sessionId, active.code, baliseModeRef.current, true)
    if (!r.success) throw new Error(r.error ?? 'Ouverture impossible.')
    ouvertureDiffereeRef.current = false
    setOuvertureDifferee(false)
    queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
  }

  async function enregistrer(article: Article, qty: number, zoneCode: string | null) {
    await materialiserOuverture()
    await onArticleResolved(article, qty, zoneCode)
  }

  async function recordArticle(article: Article, zoneCode: string | null = null) {
    await enregistrer(article, 1, zoneCode)
    // Réveille le tableau de bord du superviseur sans attendre son sondage.
    pingSession(sessionId, 'count')
    playScanSound()
    setRecentScans(prev => {
      const idx = prev.findIndex(e => e.article.sku === article.sku)
      if (idx >= 0) {
        // Le deuxième scan d'un même article est le moment EXACT où la
        // question « comment j'enlève ? » se pose. Avant, elle ne se pose pas.
        // ⚠️ `voletRef` : on ne sert jamais deux aides à la fois, et ce code
        // tourne dans un `setState` — l'état capturé au rendu ment déjà.
        if (repereCorrigerRef.current && !voletRef.current) setVolet({ genre: 'corriger' })
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

  /**
   * Vide le champ de capture, pour de bon.
   *
   * ⚠️ **`clear()` seul ne tient pas.** Constat de Julien le 31 août 2026 :
   * après un scan pourtant ENREGISTRÉ (ABC1235 compté à 13:00:13, vérifié en
   * base), le code brut restait affiché — `à'('ç-'é('é(`. Deux conséquences,
   * et ce sont exactement les deux qu'il a rapportées : on croit que le scan
   * n'est pas passé, et le scan suivant **se colle** au précédent, fabriquant
   * un article inconnu à partir de deux codes valides.
   *
   * Le champ n'ayant pas de clavier logiciel (`showSoftInputOnFocus={false}`,
   * et un clavier physique appairé empêche de toute façon le clavier tactile
   * d'apparaître), **il n'existait aucun moyen de l'effacer à la main.**
   *
   * Le remontage par `key` est la seule remise à zéro qui ne dépende pas de la
   * synchronisation JS ↔ natif : une vue neuve part de `defaultValue=""`.
   * `clear()` reste, il ne coûte rien et suffit le plus souvent.
   */
  function viderChampDouchette() {
    hwBufRef.current = ''
    hwInputRef.current?.clear()
    setHwSeq(n => n + 1)
    setHwPlein(false)
  }

  /**
   * Chaque frappe du champ de capture.
   *
   * ⚠️ **On ne valide PAS sur une temporisation de fin de rafale.** Cela a été
   * écrit le 31 août 2026 sur un diagnostic faux — le champ gardait son texte,
   * j'en ai conclu que le scan n'avait pas été soumis, alors qu'il l'était (la
   * base le disait). Une minuterie de fin de rafale **couperait un code en
   * deux** dès qu'une douchette marque un temps au milieu de sa transmission,
   * et fabriquerait un article inconnu à partir d'un code valide. Le suffixe
   * « Entrée » arrive, sur les deux systèmes : c'est lui qui valide.
   */
  function frappeDouchette(t: string) {
    hwBufRef.current = t
    if (!!t !== hwPlein) setHwPlein(!!t)
    // Certaines douchettes envoient leur suffixe comme un caractère plutôt que
    // comme une touche : le champ le reçoit alors dans son texte.
    if (/[\r\n]/.test(t)) {
      hwBufRef.current = t.replace(/[\r\n]+/g, '')
      void handleHardwareSubmit()
    }
  }

  // ── Douchette : une frappe-clavier terminée par Entrée (suffixe DataWedge) ──
  async function handleHardwareSubmit() {
    const brut = hwBufRef.current
    viderChampDouchette()
    if (!brut.trim()) return
    // La douchette envoie des touches, pas des caractères : sur un iPhone
    // français, une douchette QWERTY sortie d'usine écrit &é"' pour 1234.
    if (clavierDecale(brut)) clavierDecaleRef.current = true
    const value = redresserSaisie(brut, clavierDecaleRef.current)
    await resolveAndRecord(value)
    // Garde le champ à l'écoute pour le scan suivant (scan continu).
    // ⚠️ Sauf si « Article inconnu » vient de s'ouvrir : reprendre le focus
    // derrière la feuille y renverrait le scan suivant, qui se collerait au
    // code déjà saisi. C'est la seconde moitié du défaut du 31 août 2026.
    if (illisibleRef.current === null) hwInputRef.current?.focus()
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
      await enregistrer(entry.article, 1, activeBaliseRef.current?.code ?? null)
      setRecentScans(prev =>
        prev.map(e => e.id === entry.id ? { ...e, qty: e.qty + 1, timestamp: Date.now() } : e)
      )
    } catch {
      signaler.erreur('Erreur', "Impossible d'enregistrer la modification.")
    }
  }

  async function handleDecrement(entry: ScanEntry) {
    if (entry.qty <= 1) { handleDelete(entry); return }
    try {
      await enregistrer(entry.article, -1, activeBaliseRef.current?.code ?? null)
      setRecentScans(prev =>
        prev.map(e => e.id === entry.id ? { ...e, qty: e.qty - 1 } : e)
      )
    } catch {
      signaler.erreur('Erreur', "Impossible d'enregistrer la modification.")
    }
  }

  function handleDelete(entry: ScanEntry) {
    void demander({
      titre: 'Supprimer la ligne ?',
      texte: `Retirer « ${entry.article.label || entry.article.sku} » (×${entry.qty}) de ce comptage ?`,
      action: 'Supprimer',
      ton: 'danger',
    }).then(async (ok) => {
      if (!ok) return
      try {
        await enregistrer(entry.article, -entry.qty, activeBaliseRef.current?.code ?? null)
        setRecentScans(prev => prev.filter(e => e.id !== entry.id))
      } catch {
        signaler.erreur('Erreur', 'Impossible de supprimer la ligne.')
      }
    })
  }

  /**
   * ⚠️ Ces deux hooks sont ici, et pas plus bas avec le texte qu'ils servent :
   * deux retours anticipés suivent (permission inconnue, écran d'amorce). Un
   * hook posé après serait sauté d'un rendu à l'autre — « rendered fewer hooks
   * than expected », et l'écran de comptage tombe.
   */
  const [rangConseil, setRangConseil] = useState<0 | 1 | 2>(0)
  const cameraVisible = (balisePhase || mode === 'camera') && !!permission?.granted
  /**
   * ⚠️ **Les conseils s'arrêtent à la première lecture, et ne reviennent
   * pas.** Vu au simulateur : sans cela, « Rapprochez-vous » repart trois
   * secondes après chaque scan — c'est-à-dire pendant qu'on marche vers
   * l'article suivant, à quelqu'un qui vient précisément de réussir. Ils
   * servent à apprendre à viser, pas à commenter un comptage.
   *
   * Remis à zéro au changement de phase : viser un QR de balise et viser un
   * code-barres ne se règlent pas pareil.
   */
  const [dejaLu, setDejaLu] = useState(false)
  useEffect(() => { if (barcodeReady) setDejaLu(true) }, [barcodeReady])
  useEffect(() => { setDejaLu(false) }, [balisePhase])
  useEffect(() => {
    setRangConseil(0)
    if (!cameraVisible || barcodeReady || resolving || dejaLu) return
    const t1 = setTimeout(() => setRangConseil(1), 3500)
    const t2 = setTimeout(() => setRangConseil(2), 8000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [cameraVisible, barcodeReady, resolving, dejaLu])

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  // L'amorce : une phrase dans notre charte, un bouton qui n'est pas
  // « Autoriser », puis seulement la boîte iOS. C'est ce qui fait passer
  // l'acceptation de ~35 % à ~89 % (étude Cluster), et surtout ce qui évite
  // un refus pris sans comprendre — irréversible sans passer par les Réglages.
  if (amorceNecessaire) {
    return (
      <View style={styles.amorce}>
        <View style={styles.amorceViseur}>
          <View style={[styles.coin, styles.coinHG]} />
          <View style={[styles.coin, styles.coinHD]} />
          <View style={[styles.coin, styles.coinBG]} />
          <View style={[styles.coin, styles.coinBD]} />
        </View>
        <Text style={styles.amorceTitre}>La caméra lit les balises et les codes-barres</Text>
        <Text style={styles.amorceTexte}>
          Pour compter, vous scannez d&apos;abord l&apos;étiquette collée sur le rayon,
          puis les articles. Aucune photo n&apos;est enregistrée.
        </Text>
        <Pressable style={styles.amorceBtn} onPress={() => { void requestPermission() }}>
          <Text style={styles.amorceBtnText}>Continuer</Text>
        </Pressable>
        <Text style={styles.amorceNote}>Votre téléphone vous demandera ensuite l&apos;autorisation.</Text>
      </View>
    )
  }

  /**
   * Le forfait du magasin est plein.
   *
   * ⚠️ IL NE CITE AUCUN PRIX, ET C'EST DÉLIBÉRÉ. Cet écran s'ouvre devant un
   * compteur, souvent un saisonnier, debout dans un rayon : une proposition
   * commerciale n'a rien à y faire, et il n'a de toute façon pas la main. Il
   * dit la seule chose vraie et utile — attendre suffit — et nomme qui décide.
   *
   * ⚠️ IL DIT « L'ADMINISTRATEUR », PAS « VOTRE RESPONSABLE ». Constat de
   * Julien le 4 septembre 2026, l'écran sous les yeux depuis un compte de
   * SUPERVISEUR : « votre responsable » sonne faux à qui est déjà le
   * responsable du magasin. Élargir un forfait n'est pas son geste — c'est
   * celui de l'administrateur de l'entreprise, et c'est lui qu'il faut nommer.
   *
   * ⚠️ ON N'ARRIVE ICI QUE SUR UN REFUS EXPLICITE DU SERVEUR. Réseau coupé,
   * serveur muet, réponse inconnue : `usePlaceAppareil` accorde. Un magasin en
   * réserve doit pouvoir compter, et une coupure d'une seconde ne doit jamais
   * renvoyer quelqu'un de son rayon.
   */
  if (place.etat === 'refusee') {
    return (
      <View style={styles.amorce}>
        <View style={styles.pleinPuce}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Path d="M6.5 2.75h11a1.75 1.75 0 0 1 1.75 1.75v15a1.75 1.75 0 0 1-1.75 1.75h-11A1.75 1.75 0 0 1 4.75 19.5v-15A1.75 1.75 0 0 1 6.5 2.75Z"
              stroke={AUDIT_COLOR} strokeWidth={1.7} />
            <Path d="M10 18.25h4" stroke={AUDIT_COLOR} strokeWidth={1.7} strokeLinecap="round" />
          </Svg>
        </View>
        <Text style={styles.amorceTitre}>
          {place.plafond === 1
            ? 'Un appareil compte déjà'
            : `${place.plafond ?? ''} appareils comptent déjà`}
        </Text>
        <Text style={styles.amorceTexte}>
          L&apos;offre de ce magasin couvre {place.plafond ?? ''} appareil{(place.plafond ?? 0) > 1 ? 's' : ''} à
          la fois. Vous pourrez compter dès que l&apos;un d&apos;eux aura terminé.
        </Text>
        <Text style={styles.amorceTexte}>
          L&apos;administrateur de l&apos;entreprise peut ajouter des appareils
          depuis le site.
        </Text>
        <Pressable style={styles.amorceBtn} onPress={place.reessayer}>
          <Text style={styles.amorceBtnText}>Réessayer</Text>
        </Pressable>
        <Text style={styles.amorceNote}>
          Cet écran se débloque tout seul dès qu&apos;une place se libère.
        </Text>
      </View>
    )
  }

  /**
   * Le viseur enseigne, une consigne à la fois.
   *
   * Quand rien n'est lu, la seule chose à l'écran est un cadre : la personne
   * ne sait pas si elle est trop loin, trop près, ou dans le noir. Deux
   * phrases, l'une après l'autre, disent quoi essayer — jamais les deux
   * ensemble, on ne lit pas deux conseils debout, un téléphone dans une main.
   *
   * ⚠️ Le compte à rebours **repart à chaque lecture** : dès qu'un code est
   * détecté, il n'y a plus rien à conseiller. Et `torch` n'est pas dans les
   * dépendances — allumer la lampe ne doit pas relancer « Rapprochez-vous ».
   */
  const conseil = rangConseil === 0
    ? null
    : rangConseil === 1
      ? 'Rapprochez-vous, le code doit remplir le cadre'
      : torch
        ? 'Reculez un peu, et tenez le téléphone droit'
        : 'Trop sombre ? Allumez la lampe'

  const totalScanned = recentScans.reduce((s, e) => s + e.qty, 0)
  // La trace du dernier scan : elle lève le doute « est-ce que ça a pris ? »
  // sans quitter la caméra des yeux. Elle ne remplace jamais un conseil.
  const dernierScan = !balisePhase && recentScans.length > 0
    // Le CODE, pas le libellé : ce qu'on vérifie d'un coup d'œil, c'est que le
    // bon code-barres est passé — le nom du produit, on l'a sous les yeux.
    ? `Dernier scan · ${recentScans[0].article.ean || recentScans[0].article.sku}`
    : null
  const triggerLabel = balisePhase
    ? (barcodeReady ? 'Scanner la balise' : 'Visez une balise…')
    : (barcodeReady ? 'Scanner maintenant' : 'En attente d\'un code…')
  const camHint = resolving
    ? 'Enregistrement…'
    : barcodeReady
      ? (balisePhase ? 'Balise détectée — appuyez pour ouvrir' : 'Scan automatique — Vol − ou bouton pour forcer')
      : (balisePhase ? 'Visez la balise de la zone' : 'Pointez la caméra vers un code-barres')
  // Ce que la barre dit, par ordre de priorité : ce qui se passe maintenant,
  // puis ce qu'il faut essayer, puis ce qui vient d'être enregistré.
  const barreTexte = (resolving || barcodeReady) ? camHint : (conseil ?? dernierScan ?? camHint)

  return (
    <ClavierEvite style={styles.container}>
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
                      {m === 'count' ? 'Comptage' : 'Audit'}
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
              {/*
                * ⚠️ `hitSlop` plutôt qu'une pastille plus haute : le bandeau
                * doit rester compact, et la clôture est confirmée — un appui
                * de travers ne coûte rien, un appui qu'on rate coûte.
                */}
              <Pressable
                style={styles.zoneCloseBtn}
                onPress={() => { void closeBalise() }}
                disabled={resolving}
                hitSlop={{ top: 7, bottom: 7, left: 8, right: 8 }}
              >
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
              ref={baliseInputRef}
              style={[styles.manualInput, { flex: 1 }, tabular]}
              defaultValue=""
              onChangeText={t => { baliseBufRef.current = t }}
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
                {m === 'camera' ? 'Caméra' : m === 'manual' ? 'Manuel' : 'Douchette'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Auto-scan toggle — articles, caméra */}
      {!balisePhase && mode === 'camera' && (
        <Pressable style={styles.autoScanRow} onPress={() => setAutoScan(v => !v)}>
          <Text style={styles.autoScanLabel}>Scan automatique</Text>
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
            <View
              style={styles.cameraWrapper}
              onLayout={e => {
                const { width, height } = e.nativeEvent.layout
                const v = { l: width, h: height }
                tailleVueRef.current = v
                setTailleVue(v)
              }}
            >
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                enableTorch={torch}
                selectedLens={selectedLens}
                // `autofocus` n'est volontairement pas renseigné : dans
                // expo-camera, `on` signifie « faire le point une fois puis le
                // **verrouiller** », et `off` (le défaut) « refaire le point
                // quand c'est nécessaire ». C'est le défaut qu'on veut ; passer
                // `on` figerait la mise au point sur le premier plan vu.
                barcodeScannerSettings={barcodeSettings}
                // Toujours branché, jamais `undefined` : expo-camera calcule
                // `barcodeScannerEnabled = !!onBarcodeScanned`, et couper puis
                // rebrancher la détection reconfigure la session de capture —
                // ce qui éteint la torche côté matériel. La prop `enableTorch`,
                // elle, n'ayant pas changé de valeur, n'était pas renvoyée au
                // natif : la lampe s'éteignait pendant que l'icône restait
                // allumée. Le double enregistrement est déjà empêché par le
                // verrou synchrone `processingRef`.
                onBarcodeScanned={handleBarcodeDetected}
                onCameraReady={pickCloseFocusLens}
              />
              {/* Torch toggle — helps scanning in low light */}
              <Pressable
                style={[styles.torchBtn, torch && styles.torchBtnOn]}
                onPress={() => setTorch(v => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={torch ? 'Éteindre la lampe' : 'Allumer la lampe'}
              >
                <TorcheIcon color={torch ? '#111' : '#fff'} />
              </Pressable>
              {/* La macro se force, elle ne se règle pas. iOS bascule seul
                  sur l'ultra grand-angle quand on s'approche — quand cette
                  bascule ne se fait pas, ce bouton la demande explicitement.
                  Il n'existe que si le téléphone a l'objectif qu'il faut. */}

              {resolving && (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.overlayText}>Enregistrement…</Text>
                </View>
              )}
              {/* La forme du cadre annonce ce qu'on attend : un carré pour un
                  QR de balise, un rectangle large pour un code-barres. C'est
                  la moitié de ce que le viseur enseigne, et elle ne coûte
                  qu'un style. */}
              {tailleVue && (() => {
                const c = rectCadre(tailleVue.l, tailleVue.h, balisePhase)
                return (
                  <View
                    style={[
                      styles.scanFrame,
                      { left: c.x, top: c.y, width: c.l, height: c.h },
                      barcodeReady && styles.scanFrameReady,
                    ]}
                    pointerEvents="none"
                  />
                )
              })()}
              {/* Cooldown bar */}
              <Animated.View
                style={[styles.cooldownBar, { width: cooldownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
                pointerEvents="none"
              />
              <View style={styles.hintBar} pointerEvents="none">
                <Text style={[styles.hintText, barcodeReady && styles.hintTextReady]} numberOfLines={1}>
                  {barreTexte}
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
            <Text style={styles.permTitre}>Caméra désactivée</Text>
            <Text style={styles.permText}>
              Sans la caméra, Quantinvo ne peut lire ni les balises ni les codes-barres.
            </Text>
            {permission?.canAskAgain ? (
              <Pressable onPress={requestPermission} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Autoriser la caméra</Text>
              </Pressable>
            ) : (
              // Après un refus définitif, seule l'appli Réglages peut rendre
              // l'accès : un bouton qui redemande ne ferait rien.
              <Pressable onPress={() => { void Linking.openSettings() }} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Ouvrir les Réglages</Text>
              </Pressable>
            )}
            {/* Le comptage ne doit pas s'arrêter là : les deux phases ont un
                repli clavier, encore fallait-il le dire ici. */}
            {balisePhase ? (
              <Text style={styles.permAide}>
                En attendant, saisissez le numéro de la balise dans le champ ci-dessus.
              </Text>
            ) : (
              <>
                <Text style={styles.permAide}>En attendant, saisissez les codes à la main.</Text>
                <Pressable onPress={() => setMode('manual')} style={styles.permBtnSecondaire}>
                  <Text style={styles.permBtnSecondaireText}>Passer en saisie manuelle</Text>
                </Pressable>
              </>
            )}
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
            /* ⚠️ La clé REMONTE le champ à chaque validation : c'est la seule
               remise à zéro sûre, `clear()` ne tenait pas. */
            key={`hw-${hwSeq}`}
            ref={hwInputRef}
            style={[styles.manualInput, tabular]}
            defaultValue=""
            onChangeText={frappeDouchette}
            onSubmitEditing={handleHardwareSubmit}
            blurOnSubmit={false}
            showSoftInputOnFocus={false}
            autoFocus={illisibleCode === null}
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
          {/* Ce que le champ montre est la FRAPPE BRUTE — sur une douchette
              QWERTY et un téléphone français, des symboles. Sans cette ligne,
              un scan réussi ressemble à un scan raté : constat de Julien le
              31 août 2026, alors que l'article était bien compté. */}
          {hwPlein ? (
            <Pressable onPress={viderChampDouchette} style={styles.hwEffacer} hitSlop={12}>
              <Text style={styles.hwEffacerText}>Effacer le champ</Text>
            </Pressable>
          ) : dernierScan ? (
            <View style={styles.hwDernier}>
              <View style={styles.hwDernierPuce} />
              <Text style={styles.hwDernierText} numberOfLines={1}>
                {dernierScan}{recentScans[0].article.label ? ` · ${recentScans[0].article.label}` : ''}
              </Text>
            </View>
          ) : null}
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
              <Pressable style={styles.reopenRow} onPress={() => { void rouvrirDepuisListe(item) }}>
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
          {/* Le bouton n'existe pas tant que rien n'est scanné : « 0 article »
              n'apprend rien et occuperait la place qu'on vient de gagner. */}
          {recentScans.length > 0 && (
            <Pressable
              style={styles.voirScansBtn}
              onPress={() => setFeuilleScans(true)}
              accessibilityRole="button"
            >
              <Text style={styles.voirScansTexte}>
                Voir les {recentScans.length} article{recentScans.length > 1 ? 's' : ''} scanné{recentScans.length > 1 ? 's' : ''}
              </Text>
              <ChevronIcon color={theme.textMuted} />
            </Pressable>
          )}
          {activeBalise && (
            <Pressable style={styles.closeFooterBtn} onPress={() => { void closeBalise() }} disabled={resolving}>
              <Text style={styles.closeFooterText}>Clôturer la balise {activeBalise.code}</Text>
            </Pressable>
          )}

          {/* Un voile posé sur l'écran, PAS une `Modal`. iOS refuse de
              présenter un contrôleur par-dessus un autre : la fiche « article
              inconnu » en est une, et les deux se bloqueraient. Même leçon que
              `GeneratingOverlay` le 23 août. */}
          {feuilleScans && (
            <View style={styles.feuilleFond} pointerEvents="box-none">
              <Pressable style={styles.feuilleVoile} onPress={() => setFeuilleScans(false)} />
              <View style={styles.feuille}>
                <View style={styles.feuilleTete}>
                  <Text style={styles.feuilleTitre}>
                    {totalScanned} unité{totalScanned > 1 ? 's' : ''} · {recentScans.length} article{recentScans.length > 1 ? 's' : ''}
                  </Text>
                  <Pressable onPress={() => setFeuilleScans(false)} hitSlop={10} accessibilityLabel="Fermer">
                    <CroixIcon color={theme.textMuted} />
                  </Pressable>
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
                />
              </View>
            </View>
          )}
        </>
      )}

      {/* Illisible modal */}
      {illisibleCode !== null && (
        <IllisibleModal
          scannedCode={illisibleCode}
          sessionId={sessionId}
          zone={activeBalise?.code ?? null}
          onConfirm={handleIllisibleConfirm}
          onCancel={() => setIllisibleCode(null)}
        />
      )}

      {/* Les deux repères du premier scan. Un volet, pas une alerte système :
          il dit ce qui vient de se passer ET ce qui vient ensuite, dans la
          charte, avec un seul geste. Il ne reviendra pas. */}
      {volet && (
        <Modal transparent animationType="slide" onRequestClose={fermerVolet}>
          <Pressable style={styles.voletFond} onPress={fermerVolet}>
            <Pressable style={styles.volet} onPress={() => {}}>
              <View style={styles.voletPoignee} />
              {/* La coche annonce un événement (balise ouverte, balise finie) ;
                  l'anneau explique ce qu'on a sous les yeux. Deux natures, deux
                  dessins — sinon « trois façons de scanner » se lit comme une
                  confirmation de quelque chose qu'on aurait fait. */}
              <View style={[styles.voletIcone, volet.genre === 'terminee' && styles.voletIconeOk]}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
                     stroke={volet.genre === 'terminee' ? theme.success : '#38C9FF'} strokeWidth={2.2}
                     strokeLinecap="round" strokeLinejoin="round">
                  {volet.genre === 'modes' || volet.genre === 'corriger' ? (
                    <>
                      <Circle cx={12} cy={12} r={9} />
                      <Path d="M12 11v5M12 8h.01" />
                    </>
                  ) : (
                    <Path d="M5 12l4 4L19 6" />
                  )}
                </Svg>
              </View>
              {volet.genre === 'ouverte' && (
                <>
                  <Text style={styles.voletTitre}>Balise {volet.code} ouverte</Text>
                  {volet.nom && <Text style={styles.voletSous} numberOfLines={2}>{volet.nom}</Text>}
                  <Text style={styles.voletTexte}>
                    Scannez maintenant les articles de ce rayon. Chaque lecture ajoute une pièce ;
                    la quantité s&apos;ajuste dans la liste. Quand le rayon est fini, touchez
                    <Text style={styles.voletFort}> Clôturer</Text>.
                  </Text>
                </>
              )}
              {volet.genre === 'terminee' && (
                <>
                  <Text style={styles.voletTitre}>Première balise terminée</Text>
                  <Text style={styles.voletTexte}>
                    Balise {volet.code}{volet.nom ? ` · ${volet.nom}` : ''} —{' '}
                    <Text style={styles.voletFort}>{volet.pieces} pièce{volet.pieces > 1 ? 's' : ''}</Text>
                    {' '}sur {volet.refs} référence{volet.refs > 1 ? 's' : ''}.
                    Elles sont déjà sur le tableau de bord de votre superviseur.
                  </Text>
                  <View style={styles.voletFilet} />
                  <Text style={styles.voletNote}>
                    Rendez-vous au rayon suivant et scannez sa balise. Si vous perdez le réseau,
                    le comptage continue et s&apos;envoie tout seul au retour.
                  </Text>
                </>
              )}
              {volet.genre === 'modes' && (
                <>
                  <Text style={styles.voletTitre}>Trois façons de scanner</Text>
                  <Text style={styles.voletTexte}>
                    La <Text style={styles.voletFort}>caméra</Text> du téléphone, la saisie{' '}
                    <Text style={styles.voletFort}>manuelle</Text> d&apos;un code, ou une{' '}
                    <Text style={styles.voletFort}>douchette</Text> Bluetooth appairée au téléphone.
                  </Text>
                  <View style={styles.voletFilet} />
                  <Text style={styles.voletNote}>
                    La douchette est bien plus rapide sur un gros rayon. Le choix se fait en haut
                    de l&apos;écran, et il tient pour tout le comptage.
                  </Text>
                </>
              )}
              {volet.genre === 'corriger' && (
                <>
                  <Text style={styles.voletTitre}>Une erreur se corrige</Text>
                  <Text style={styles.voletTexte}>
                    Vous venez de scanner deux fois le même article. Ouvrez la liste des articles
                    scannés : le <Text style={styles.voletFort}>−</Text> retire une pièce.
                  </Text>
                  <View style={styles.voletFilet} />
                  <Text style={styles.voletNote}>
                    Rien n&apos;est effacé sur le serveur : une correction est une ligne de plus.
                    Votre superviseur voit le total juste, pas l&apos;erreur.
                  </Text>
                </>
              )}
              <Pressable style={styles.voletBtn} onPress={fermerVolet}>
                <Text style={styles.voletBtnText}>
                  {volet.genre === 'terminee' ? 'Balise suivante' : 'Compris'}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </ClavierEvite>
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
        <CroixIcon color={theme.danger} />
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
    // ⚠️ `marginTop` ET `flexShrink: 0`, et il faut les deux. Ce bouton porte
    // une élévation (`shadowButton`) : sur Android, un élément élevé se dessine
    // AU-DESSUS de ses voisins. Sans marge il touchait la carte du dessus, et
    // sans `flexShrink` il se faisait comprimer quand la colonne déborde — le
    // rouge passait alors PAR-DESSUS « Voir les N articles » ou « En attente
    // d'un code ». Constat de Julien le 31 août 2026 : « ça dépend du moment »
    // — c'est l'apparition de la rangée des scans qui change la hauteur totale.
    closeFooterBtn: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.md, flexShrink: 0, backgroundColor: t.danger, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...t.shadowButton },
    closeFooterText: { color: '#fff', fontSize: 15, fontFamily: Font.bold },

    modeToggle: {
      flexDirection: 'row', marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 6,
      borderRadius: Radius.md, borderWidth: 1, borderColor: t.hairline,
      overflow: 'hidden', backgroundColor: t.surface, ...t.shadowCard,
    },
    modeBtn: { flex: 1, minHeight: 48, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
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

    // ⚠️ La caméra est le SEUL élément qui cède la place. 340 pt est la taille
    // validée le 29 août ; `flexShrink: 1` ne l'entame que si la colonne ne
    // tient pas — un petit écran, ou la rangée des scans qui apparaît. Le
    // cadre suit : `rectCadre` travaille sur la hauteur MESURÉE (`onLayout`),
    // jamais sur cette constante.
    cameraWrapper: { height: 340, minHeight: 200, flexShrink: 1, marginHorizontal: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden', position: 'relative', backgroundColor: t.cameraBg },
    camera: { flex: 1 },
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', gap: Spacing.sm,
    },
    overlayText: { color: '#fff', fontSize: 13, fontFamily: Font.semibold },
    scanFrame: {
      position: 'absolute',
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

    voirScansBtn: {
      marginHorizontal: Spacing.md, marginTop: Spacing.sm, flexShrink: 0,
      backgroundColor: t.surface, borderWidth: 1, borderColor: t.border,
      borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.md,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    voirScansTexte: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },

    feuilleFond: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
    feuilleVoile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    feuille: {
      backgroundColor: t.background, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
      paddingBottom: Spacing.md, maxHeight: '72%',
    },
    feuilleTete: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    feuilleTitre: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
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
    voletFond: { flex: 1, backgroundColor: 'rgba(5,7,13,0.55)', justifyContent: 'flex-end' },
    volet: { backgroundColor: t.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.sm },
    voletPoignee: { width: 36, height: 4, borderRadius: 4, backgroundColor: t.borderStrong, alignSelf: 'center', marginBottom: Spacing.md },
    voletIcone: { width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: 'rgba(56,201,255,0.12)', borderWidth: 1, borderColor: 'rgba(56,201,255,0.35)', alignItems: 'center', justifyContent: 'center' },
    voletIconeOk: { backgroundColor: t.successSoft, borderColor: t.success },
    voletTitre: { color: t.textPrimary, fontSize: 21, fontFamily: Font.bold, letterSpacing: -0.4, marginTop: Spacing.sm },
    voletSous: { color: t.textSecondary, fontSize: 13.5, fontFamily: Font.regular },
    voletTexte: { color: t.textSecondary, fontSize: 14, fontFamily: Font.regular, lineHeight: 20, marginTop: Spacing.xs },
    voletFort: { color: t.textPrimary, fontFamily: Font.semibold },
    voletFilet: { height: 1, backgroundColor: t.border, marginVertical: Spacing.md },
    voletNote: { color: t.textMuted, fontSize: 13, fontFamily: Font.regular, lineHeight: 18 },
    voletBtn: { height: 48, borderRadius: Radius.md, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, ...t.shadowButton },
    voletBtnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.semibold },
    amorce: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md, backgroundColor: t.background },
    amorceViseur: { width: 96, height: 96, marginBottom: Spacing.xl },
    coin: { position: 'absolute', width: 26, height: 26, borderColor: '#38C9FF', borderWidth: 2.5, borderRadius: 4 },
    coinHG: { left: 0, top: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    coinHD: { right: 0, top: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    coinBG: { left: 0, bottom: 0, borderRightWidth: 0, borderTopWidth: 0 },
    coinBD: { right: 0, bottom: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    amorceTitre: { color: t.textPrimary, fontSize: 22, fontFamily: Font.bold, textAlign: 'center', lineHeight: 29, letterSpacing: -0.4 },
    amorceTexte: { color: t.textSecondary, fontSize: 14.5, fontFamily: Font.regular, textAlign: 'center', lineHeight: 21 },
    amorceBtn: { height: 48, alignSelf: 'stretch', borderRadius: Radius.md, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, ...t.shadowButton },
    amorceBtnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.semibold },
    amorceNote: { color: t.textMuted, fontSize: 12.5, fontFamily: Font.regular, textAlign: 'center' },
    pleinPuce: {
      width: 52, height: 52, borderRadius: Radius.md, marginBottom: Spacing.md,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline,
    },
    permTitre: { color: t.textPrimary, fontSize: 17, textAlign: 'center', fontFamily: Font.semibold },
    permText: { color: t.textSecondary, fontSize: 15, textAlign: 'center', fontFamily: Font.regular },
    permAide: { color: t.textMuted, fontSize: 13, textAlign: 'center', fontFamily: Font.regular, lineHeight: 18 },
    permBtnSecondaire: { borderColor: t.borderStrong, borderWidth: 1, borderRadius: Radius.md,
      paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    permBtnSecondaireText: { color: t.textPrimary, fontFamily: Font.semibold },
    permBtn: { backgroundColor: t.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...t.shadowButton },
    permBtnText: { color: t.onAccent, fontFamily: Font.semibold },

    manualContainer: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },
    manualLabel: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular },
    hwHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
    hwDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759' },
    hwTitle: { fontSize: 14, fontFamily: Font.bold, color: t.textPrimary },
    hwDernier: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    hwDernierPuce: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
    hwDernierText: { flex: 1, fontSize: 12, color: t.textMuted, fontFamily: Font.regular },
    hwEffacer: { alignSelf: 'flex-start', marginTop: Spacing.sm },
    hwEffacerText: { fontSize: 12, color: t.accent, fontFamily: Font.medium },
    manualRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    manualInput: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 11, minHeight: 48, fontSize: 16,
      backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular, ...tabular,
    },
    manualBtn: { backgroundColor: t.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: 11, minHeight: 48, justifyContent: 'center', ...t.shadowButton },
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
