import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  annulerArbitrage, getEcartsArbitres, getEcartsPage, getEcartsResume,
  getSession, getZoneDashboard, recomputeAudit, resolveAudit,
} from '@/lib/queries'
import { AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { CocheIcon } from '@/components/ui/Icones'
import type { ArticleAudit, EtiquetteArticle } from '@/lib/queries'
import { depuis } from '@/lib/temps'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { demander, signaler } from '@/lib/dialogue'

const STATUS_RANK: Record<string, number> = { failed: 0, pending: 1, resolved: 2, validated: 3 }

/** Au-delà, la liste des arbitrages se replie derrière « Voir les N autres ». */
const ARBITRES_VUS = 5

/**
 * ⚠️ LA LISTE SE LIT PAR PAGES (3 septembre 2026).
 *
 * L'écran chargeait toutes les lignes d'audit — 400 000 sur un gros inventaire,
 * 12,9 s pour un plafond serveur de 8 s : il ne s'ouvrait plus. La règle qui
 * décide ce qui EST un écart est passée en base, à l'identique, parce qu'elle
 * a besoin de toutes les lignes pour trancher et ne pouvait donc pas paginer.
 *
 * ⚠️ Le serveur rend l'ordre `a_traiter`, qui n'est PAS celui du site : ici,
 * ce qui reste à trancher remonte en premier. Quelqu'un debout dans un rayon
 * veut le travail qui reste.
 */
const PAGE = 50

/** « 3 unités » — un nombre seul ne dit pas ce qu'il compte. */
function unites(v: number): string {
  return `${fmt(v)} unité${v >= 2 ? 's' : ''}`
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
}

// Clé d'un input / d'une ligne : un article peut apparaître dans plusieurs balises.
function keyOf(a: ArticleAudit): string {
  return `${a.zone} ${a.sku}`
}

type Group = { zone: string; name: string | null; rows: ArticleAudit[]; failed: number; pending: number }

/**
 * « 3600551182513 · balise 36 · hier ».
 *
 * Le SKU ne se répète pas quand il EST déjà le titre de la ligne : un article
 * sans libellé s'affiche sous sa référence, l'écrire deux fois n'apprend rien.
 */
function metaArbitre(a: ArticleAudit, nom: string): string {
  const bouts: string[] = []
  if (nom !== a.sku) bouts.push(a.sku)
  if (a.zone) bouts.push(`balise ${a.zone}`)
  const quand = depuis(a.updated_at)
  if (quand) bouts.push(quand)
  return bouts.join(' · ')
}

export default function AuditsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [tousArbitres, setTousArbitres] = useState(false)

  const recompute = useMutation({
    mutationFn: () => recomputeAudit(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audits', sessionId] }),
  })

  /** Tout ce qui doit se relire après un arbitrage. */
  async function relire() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['audits', sessionId] }),
      queryClient.invalidateQueries({ queryKey: ['audits-resume', sessionId] }),
      queryClient.invalidateQueries({ queryKey: ['audits-arbitres', sessionId] }),
    ])
  }

  useEffect(() => { recompute.mutate() }, [sessionId])

  const { data: session } = useQuery({ queryKey: ['session', sessionId], queryFn: () => getSession(sessionId) })
  const usesZones = !!session?.uses_zones

  // ⚠️ Les compteurs portent sur TOUT l'inventaire, la liste sur la page :
  // des chiffres qui changeraient en faisant défiler ne voudraient rien dire.
  const { data: resume, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['audits-resume', sessionId],
    queryFn: () => getEcartsResume(sessionId),
  })

  const {
    data: pages, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['audits', sessionId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getEcartsPage(sessionId, pageParam, PAGE),
    getNextPageParam: (derniere, toutes) => {
      const vus = toutes.reduce((n, p) => n + p.audits.length, 0)
      return vus >= derniere.total ? undefined : vus
    },
  })

  const { data: arbitresPage } = useInfiniteQuery({
    queryKey: ['audits-arbitres', sessionId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getEcartsArbitres(sessionId, pageParam, PAGE),
    getNextPageParam: () => undefined,
  })

  const audits = useMemo(
    () => (pages?.pages ?? []).flatMap((p) => p.audits),
    [pages],
  )
  const labels = useMemo(() => {
    const m: Record<string, EtiquetteArticle> = {}
    for (const p of pages?.pages ?? []) Object.assign(m, p.labels)
    for (const p of arbitresPage?.pages ?? []) Object.assign(m, p.labels)
    return m
  }, [pages, arbitresPage])
  const { data: zoneRows } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
    enabled: usesZones,
  })
  // Le nom des balises : celui du tableau de bord, complété par la page —
  // une balise sans écart n'est pas dans la page.
  const zoneNames = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const z of zoneRows ?? []) m[z.code] = z.name
    for (const p of pages?.pages ?? []) Object.assign(m, p.zoneNames)
    return m
  }, [zoneRows, pages])

  const resolve = useMutation({
    mutationFn: ({ sku, zone, qty }: { sku: string; zone: string; qty: number }) => resolveAudit(sessionId, sku, qty, zone),
    onSuccess: async (result, variables) => {
      if (!result.success) {
        signaler.erreur('Erreur', result.error === 'invalid_qty' ? 'Quantité invalide.' : 'Correction impossible.')
        return
      }
      setInputs((prev) => { const n = { ...prev }; delete n[`${variables.zone} ${variables.sku}`]; return n })
      await queryClient.invalidateQueries({ queryKey: ['audits', sessionId] })
    },
  })

  const annuler = useMutation({
    mutationFn: ({ sku, zone }: { sku: string; zone: string }) => annulerArbitrage(sessionId, sku, zone),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audits', sessionId] }),
    onError: () => signaler.erreur('Erreur', 'Annulation impossible.'),
  })

  function onResolve(a: ArticleAudit) {
    // La virgule est acceptée : c'est ce que donne le clavier français.
    const qty = parseFloat((inputs[keyOf(a)] ?? '').replace(',', '.'))
    if (isNaN(qty) || qty < 0) {
      signaler.erreur('Quantité manquante', 'Entrez un nombre positif, ou touchez « Compteur » ou « Auditeur ».')
      return
    }
    resolve.mutate({ sku: a.sku, zone: a.zone, qty })
  }

  // ⚠️ Annuler un arbitrage se confirme, comme sur le site. Le geste est à
  // portée du pouce dans une liste qu'on fait défiler, et il défait une
  // décision. Le bouton de refus dit « Garder » : deux « Annuler » dans la
  // même carte ne se distingueraient pas.
  function confirmAnnuler(a: ArticleAudit, nom: string) {
    void demander({
      titre: 'Annuler cet arbitrage ?',
      texte: `« ${nom} » repassera en écart. Il faudra l’arbitrer à nouveau.`,
      action: 'Annuler l’arbitrage',
      annuler: 'Garder',
    }).then((ok) => { if (ok) annuler.mutate({ sku: a.sku, zone: a.zone }) })
  }

  const busy = resolve.isPending

  // ⚠️ La règle « écart = Auditeur − Compteur, et seulement dans une balise
  // dont l'audit est TERMINÉ » n'est plus appliquée ici : elle a besoin de
  // toutes les lignes pour trancher, donc elle ne pouvait pas paginer. Elle
  // vit en base (`ecarts_page`), reprise clause par clause. Ce que la page
  // rend EST déjà la liste des écarts.
  const discrepancies = audits
  const ecartsCount = resume?.total ?? 0
  const arbitresTotal = resume?.arbitres ?? 0
  const arbitres = useMemo(
    () => (arbitresPage?.pages ?? []).flatMap((p) => p.audits),
    [arbitresPage],
  )
  const arbitresVus = tousArbitres ? arbitres : arbitres.slice(0, ARBITRES_VUS)

  // Regroupe par balise (zone). Les balises avec écarts d'abord, puis par code.
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const a of discrepancies) {
      const g = map.get(a.zone) ?? { zone: a.zone, name: zoneNames[a.zone] ?? null, rows: [], failed: 0, pending: 0 }
      g.rows.push(a)
      if (a.status === 'failed') g.failed += 1
      if (a.status === 'pending') g.pending += 1
      map.set(a.zone, g)
    }
    const arr = [...map.values()]
    for (const g of arr) {
      g.rows.sort((x, y) => (STATUS_RANK[x.status] - STATUS_RANK[y.status]) || x.sku.localeCompare(y.sku))
    }
    arr.sort((x, y) => {
      if ((y.failed > 0 ? 1 : 0) !== (x.failed > 0 ? 1 : 0)) return (y.failed > 0 ? 1 : 0) - (x.failed > 0 ? 1 : 0)
      if ((y.pending > 0 ? 1 : 0) !== (x.pending > 0 ? 1 : 0)) return (y.pending > 0 ? 1 : 0) - (x.pending > 0 ? 1 : 0)
      const nx = parseInt(x.zone, 10), ny = parseInt(y.zone, 10)
      if (!isNaN(nx) && !isNaN(ny)) return nx - ny
      return x.zone.localeCompare(y.zone)
    })
    return arr
  }, [discrepancies, zoneNames])

  const renderCard = (a: ArticleAudit) => {
    const lbl = labels?.[a.sku]
    const name = lbl?.label || a.sku
    const counted = Number(a.qty_pass1 ?? 0)
    const audited = Number(a.qty_pass2 ?? 0)
    const ecart = audited - counted
    const ecartValue = ecart * (lbl?.price ?? 0)
    return (
      <AuditCard
        key={keyOf(a)}
        a={a}
        name={name}
        brand={lbl?.brand}
        counted={counted}
        audited={audited}
        ecart={ecart}
        ecartValue={ecartValue}
        theme={theme}
        styles={styles}
        value={inputs[keyOf(a)] ?? ''}
        onChange={(t) => setInputs((p) => ({ ...p, [keyOf(a)]: t }))}
        onSave={() => onResolve(a)}
        onRetenir={(qty) => resolve.mutate({ sku: a.sku, zone: a.zone, qty })}
        busy={busy}
      />
    )
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching || recompute.isPending} onRefresh={() => { recompute.mutate(); refetch() }} tintColor={theme.textMuted} />
        }
      >
        <View style={styles.summary}>
          {/* Un zéro ne porte pas de couleur, des deux côtés : en rouge, « aucun
              écart » se lisait comme un problème, et un « 0 arbitré » en vert
              annonçait une réussite qui n'a pas eu lieu. */}
          <Stat
            styles={styles}
            label="À traiter"
            value={ecartsCount}
            color={ecartsCount > 0 ? theme.danger : theme.textPrimary}
          />
          <Stat
            styles={styles}
            label="Arbitrés"
            value={arbitresTotal}
            color={arbitresTotal > 0 ? theme.success : theme.textPrimary}
          />
        </View>

        {ecartsCount === 0 && arbitresTotal === 0 && (
          <Text style={styles.empty}>Les articles apparaîtront après le comptage.</Text>
        )}

        {/* La consigne ne s'affiche que s'il y a quelque chose à corriger : sinon
            elle explique un geste que personne n'a à faire. */}
        {groups.length > 0 && (
          <Text style={styles.hint}>
            {usesZones
              ? 'Les écarts se comparent balise par balise. Retenez le compte du compteur ou celui de l’auditeur, ou saisissez une autre quantité.'
              : 'Un écart apparaît quand le comptage et l’audit diffèrent. Retenez le compte du compteur ou celui de l’auditeur, ou saisissez une autre quantité.'}
          </Text>
        )}

        {ecartsCount === 0 && arbitresTotal > 0 && (
          <View style={styles.okCard}>
            <View style={styles.okIcone}><CocheIcon color={theme.success} size={18} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.okTitre}>Aucun écart à traiter</Text>
              <Text style={styles.okTexte}>
                Le comptage et l’audit concordent
                {usesZones ? ' sur toutes les balises auditées' : ''}.
              </Text>
            </View>
          </View>
        )}

        {groups.map((g) => (
          <View key={g.zone || '_'} style={styles.group}>
            {usesZones && g.zone !== '' && (
              <View style={styles.baliseHeader}>
                <Text style={styles.baliseTitle}>Balise {g.zone}{g.name ? ` · ${g.name}` : ''}</Text>
                {g.failed > 0
                  ? <View style={[styles.baliseBadge, { backgroundColor: theme.dangerSoft }]}><Text style={[styles.baliseBadgeText, { color: theme.danger }]}>{g.failed} écart{g.failed > 1 ? 's' : ''}</Text></View>
                  : <View style={[styles.baliseBadge, { backgroundColor: theme.successSoft }]}><Text style={[styles.baliseBadgeText, { color: theme.success }]}>OK</Text></View>}
              </View>
            )}
            {g.rows.map(renderCard)}
          </View>
        ))}

        {hasNextPage && (
          <Pressable
            style={[styles.plusBtn, isFetchingNextPage && { opacity: 0.6 }]}
            onPress={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage
              ? <ActivityIndicator color={theme.accent} />
              : (
                <Text style={styles.plusBtnText}>
                  Voir {Math.min(PAGE, ecartsCount - discrepancies.length)} écarts de plus
                </Text>
              )}
          </Pressable>
        )}

        {arbitres.length > 0 && (
          <>
            {/* En-tête calqué sur celui d'une balise : deux sections d'une même
                page se présentent de la même façon. */}
            <View style={styles.baliseHeader}>
              <Text style={styles.baliseTitle}>Écarts arbitrés</Text>
              <View style={[styles.baliseBadge, { backgroundColor: theme.successSoft }]}>
                <Text style={[styles.baliseBadgeText, { color: theme.success }, tabular]}>
                  {arbitres.length}
                </Text>
              </View>
            </View>
            <Text style={styles.hint}>
              La quantité retenue part dans le rapport. Un nouveau comptage ne l’écrase pas.
            </Text>
            <View style={styles.arbCard}>
              {arbitresVus.map((a, i) => {
                const nom = labels?.[a.sku]?.label || a.sku
                return (
                  <View key={keyOf(a)} style={[styles.arbLigne, i > 0 && styles.arbFilet]}>
                    <Text style={styles.arbNom} numberOfLines={1}>{nom}</Text>
                    <Text style={[styles.arbMeta, tabular]} numberOfLines={1}>
                      {metaArbitre(a, nom)}
                    </Text>
                    <View style={styles.arbBas}>
                      <View style={styles.arbFigs}>
                        <Fig styles={styles} label="Compteur" value={fmt(Number(a.qty_pass1 ?? 0))} />
                        <Fig styles={styles} label="Auditeur" value={fmt(Number(a.qty_pass2 ?? 0))} />
                        <Fig styles={styles} label="Retenu" value={fmt(Number(a.final_qty ?? 0))} color={theme.accent} />
                      </View>
                      <Pressable
                        onPress={() => confirmAnnuler(a, nom)}
                        disabled={annuler.isPending}
                        // Le libellé ne fait que 18 pt de haut : sans ce
                        // débord, la cible passe sous les 44 pt de la charte.
                        hitSlop={{ top: 14, bottom: 14, left: 16, right: 10 }}
                      >
                        <Text style={styles.arbAnnuler}>Annuler l’arbitrage</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
              {arbitres.length > ARBITRES_VUS && !tousArbitres && (
                <Pressable style={[styles.arbVoir, styles.arbFilet]} onPress={() => setTousArbitres(true)}>
                  <Text style={styles.arbVoirText}>
                    Voir les {arbitres.length - ARBITRES_VUS} autres
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function euro(v: number): string {
  return `${v.toFixed(2).replace('.', ',')} €`
}

function Fig({ label, value, color, styles }: { label: string; value: string; color?: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.fig}>
      <Text style={styles.figLabel}>{label}</Text>
      <Text style={[styles.figValue, color ? { color } : null]}>{value}</Text>
    </View>
  )
}

function AuditCard({
  a, name, brand, counted, audited, ecart, ecartValue, theme, styles, value, onChange, onSave, onRetenir, busy,
}: {
  a: ArticleAudit
  name: string
  brand?: string
  counted: number
  audited: number
  ecart: number
  ecartValue: number
  theme: Theme
  styles: ReturnType<typeof makeStyles>
  value: string
  onChange: (t: string) => void
  onSave: () => void
  onRetenir: (qty: number) => void
  busy: boolean
}) {
  return (
    <View style={[styles.card, { borderLeftColor: theme.danger, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sku}>{name}</Text>
          <Text style={styles.subSku}>SKU : {a.sku}{brand ? ` · ${brand}` : ''}</Text>
        </View>
      </View>
      <View style={styles.figRow}>
        <Fig styles={styles} label="Écart" value={`${fmt(ecart)} u`} color={ecart < 0 ? theme.danger : theme.success} />
        <Fig styles={styles} label="Écart valeur" value={euro(ecartValue)} color={ecartValue < 0 ? theme.danger : undefined} />
      </View>
      {/* Trancher, c'est presque toujours choisir l'un des deux comptes : un
          appui suffit. Les deux boutons portent la quantité qu'ils retiennent
          — sur un téléphone il n'y a pas d'infobulle pour l'expliquer.
          Aucun des deux n'est mis en avant : le compteur a raison aussi
          souvent que l'auditeur, l'écran ne doit pas suggérer la réponse. */}
      <View style={styles.choixRow}>
        <Pressable
          style={[styles.choixBtn, { backgroundColor: theme.accent }, busy && { opacity: 0.6 }]}
          onPress={() => onRetenir(counted)}
          disabled={busy}
        >
          <Text style={[styles.choixTexte, { color: theme.onAccent }, tabular]} numberOfLines={1} adjustsFontSizeToFit>
            Compteur {unites(counted)}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.choixBtn, { backgroundColor: AUDIT_COLOR }, busy && { opacity: 0.6 }]}
          onPress={() => onRetenir(audited)}
          disabled={busy}
        >
          <Text style={[styles.choixTexte, { color: AUDIT_ON }, tabular]} numberOfLines={1} adjustsFontSizeToFit>
            Auditeur {unites(audited)}
          </Text>
        </Pressable>
      </View>
      <View style={styles.resolveRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="Autre quantité"
          placeholderTextColor={theme.textMuted}
        />
        <Pressable style={[styles.resolveBtn, busy && { opacity: 0.6 }]} onPress={onSave} disabled={busy}>
          <Text style={styles.resolveBtnText}>Retenir</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Stat({ label, value, color, styles }: { label: string; value: number; color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}


function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },
    summary: { flexDirection: 'row', gap: Spacing.md },
    stat: { flex: 1, backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    statValue: { fontSize: 26, fontFamily: Font.extrabold, letterSpacing: -0.5, ...tabular },
    statLabel: { fontSize: 12, color: t.textSecondary, marginTop: 2, fontFamily: Font.medium },
    hint: { fontSize: 12, color: t.textMuted, lineHeight: 17, fontFamily: Font.regular },
    group: { gap: Spacing.sm },
    baliseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
    baliseTitle: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2, flex: 1 },
    baliseBadge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
    baliseBadgeText: { fontSize: 11, fontFamily: Font.bold },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    sku: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    subSku: { fontSize: 12, color: t.textSecondary, ...tabular },
    figRow: { flexDirection: 'row', gap: Spacing.xxl, marginTop: 2 },
    fig: {},
    figLabel: { fontSize: 10, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
    figValue: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, marginTop: 2, ...tabular },
    resolveRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
    input: { flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 16, backgroundColor: t.background, color: t.textPrimary, fontFamily: Font.regular, ...tabular },
    resolveBtn: {
      borderRadius: Radius.md, borderWidth: 1, borderColor: t.borderStrong,
      paddingHorizontal: 16, paddingVertical: 11,
    },
    resolveBtnText: { color: t.textPrimary, fontFamily: Font.bold, fontSize: 14 },
    // ⚠️ Les deux couleurs sont celles que l'app emploie déjà pour les deux
    // passes : « Compter des articles » est en accent, « Auditer des articles »
    // en or (`AUDIT_COLOR`). Reprendre cette paire ici, c'est réutiliser une
    // association déjà apprise — et deux aplats ne se confondent avec aucune
    // cellule de chiffres. Constat de Julien sur le premier jet : en contour,
    // avec une étiquette en capitales et un gros nombre, « je n'ai pas
    // l'impression que ce soient des boutons ».
    //
    // ⚠️ EMPILÉS, PAS CÔTE À CÔTE. Le libellé porte les unités, et
    // « Auditeur 100000 unités » demande ~171 pt : côte à côte il ne reste que
    // 136 pt de texte par bouton, il faudrait descendre à 11 pt. Sur toute la
    // largeur il en reste 300, et la ligne tient quel que soit le nombre.
    choixRow: { gap: Spacing.sm, marginTop: Spacing.xs },
    choixBtn: {
      minHeight: 48, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md,
    },
    choixTexte: { fontSize: 15, fontFamily: Font.bold },
      // « Voir N écarts de plus » : un bouton en contour, pas un bouton plein —
      // l'action de l'écran reste l'arbitrage. ⚠️ 48 de haut, la cible tactile
      // minimale d'Android (31 août 2026).
      plusBtn: {
        minHeight: 48, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.hairline,
        backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center',
        marginTop: Spacing.xs,
      },
      plusBtnText: { fontSize: 15, fontFamily: Font.semibold, color: t.accent },
      empty: { fontSize: 14, color: t.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontFamily: Font.regular },

    // Aucun écart à traiter : la bonne nouvelle se dit, au lieu d'une phrase
    // grise perdue en bas de page.
    okCard: {
      flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    okIcone: {
      width: 36, height: 36, borderRadius: Radius.pill, backgroundColor: t.successSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    okTitre: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    okTexte: { fontSize: 12, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 17, marginTop: 3 },

    // Les arbitrages sont une LISTE, pas une pile de cartes : ce sont des
    // affaires réglées, elles doivent peser moins qu'un écart ouvert. Une
    // seule carte, des lignes séparées par un filet.
    arbCard: {
      backgroundColor: t.surface, borderRadius: Radius.lg, borderWidth: 1,
      borderColor: t.hairline, ...t.shadowCard,
    },
    arbLigne: { padding: Spacing.lg - 2 },
    arbFilet: { borderTopWidth: 1, borderTopColor: t.hairline },
    arbNom: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
    arbMeta: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, marginTop: 2 },
    arbBas: {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: Spacing.md, marginTop: 10,
    },
    arbFigs: { flexDirection: 'row', gap: 18 },
    // En gris, pas en accent : défaire un arbitrage est le geste rare de la
    // ligne, il ne doit pas être ce qu'on y voit en premier.
    arbAnnuler: { fontSize: 13, color: t.textSecondary, fontFamily: Font.semibold, paddingBottom: 2 },
    arbVoir: { paddingVertical: Spacing.md + 1, alignItems: 'center' },
    arbVoirText: { fontSize: 14, color: t.accent, fontFamily: Font.semibold },
  })
}
