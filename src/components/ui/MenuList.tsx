import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { MenuIcon, type NomIcone } from '@/components/ui/MenuIcons'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

/**
 * Liste à lignes — le vocabulaire des menus de l'app.
 *
 * L'écran d'un inventaire avait déjà ce motif (« Actions »), redessiné chez
 * lui ; le profil, lui, empilait des blocs et des boutons de quatre tailles.
 * Une seule définition désormais : une carte, des lignes séparées d'un filet,
 * un chevron à droite, le rouge réservé à ce qui ne se répare pas.
 */

export function ChevronIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

export function MenuCard({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const styles = makeStyles(useTheme())
  return <View style={[styles.card, style]}>{children}</View>
}

export function MenuRow({
  label,
  /** Icône de tête. Une ligne sans icône reste possible, mais dépareille. */
  icon,
  /** État affiché à droite du libellé (« Activée », « 3 magasins »…). */
  value,
  onPress,
  danger,
  last,
  /** Sans chevron : la ligne agit sur place au lieu d'ouvrir un écran. */
  sansChevron,
}: {
  label: string
  icon?: NomIcone
  value?: string
  onPress: () => void
  danger?: boolean
  last?: boolean
  sansChevron?: boolean
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  // L'icône prend la couleur du rang : elle rougit avec lui, sans second
  // dessin. Le gris est celui des libellés secondaires, pas celui du texte —
  // à cette taille, un trait à pleine valeur pèse plus que le mot.
  const teinte = danger ? theme.danger : theme.textMuted
  return (
    <Pressable style={[styles.row, !last && styles.rowBorder]} onPress={onPress}>
      {!!icon && <MenuIcon nom={icon} color={teinte} />}
      <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
      {!!value && <Text style={styles.value}>{value}</Text>}
      {!sansChevron && <ChevronIcon color={teinte} />}
    </Pressable>
  )
}

/** Titre de section — même graisse et même échelle que partout ailleurs. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  const styles = makeStyles(useTheme())
  return <Text style={styles.section}>{children}</Text>
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: t.hairline,
      overflow: 'hidden',
      ...t.shadowCard,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: t.hairline },
    label: { flex: 1, fontSize: 15, color: t.textPrimary, fontFamily: Font.semibold },
    labelDanger: { color: t.danger },
    value: { fontSize: 13, color: t.textMuted, fontFamily: Font.medium },
    section: {
      fontSize: 11,
      fontFamily: Font.semibold,
      color: t.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: Spacing.xs,
      marginLeft: 2,
    },
  })
}
