import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useThemeControls } from '@/lib/theme'
import { Font } from '@/constants/ink'

// Icône profil (silhouette) — dessinée en SVG, pas d'emoji.
function ProfileIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      />
    </Svg>
  )
}

// Circular translucent buttons that sit on the near-black Ink header.
// Optional profile (leftmost) + theme toggle (sun/moon) + help (?),
// shared by both navigation layouts. `onProfile` is only passed on the
// supervisor's main screens, so the employee header stays unchanged.
export function HeaderActions({ onProfile, onHelp }: { onProfile?: () => void; onHelp: () => void }) {
  const { name, toggle } = useThemeControls()
  return (
    <View style={styles.row}>
      {onProfile && (
        <Pressable onPress={onProfile} hitSlop={8} style={styles.btn}>
          <ProfileIcon />
        </Pressable>
      )}
      <Pressable onPress={toggle} hitSlop={8} style={styles.btn}>
        <Text style={styles.glyph}>{name === 'dark' ? '☀' : '☾'}</Text>
      </Pressable>
      <Pressable onPress={onHelp} hitSlop={8} style={styles.btn}>
        <Text style={styles.glyphBold}>?</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginRight: 2 },
  btn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  glyph: { color: '#fff', fontSize: 15, fontFamily: Font.semibold },
  glyphBold: { color: '#fff', fontSize: 16, fontFamily: Font.bold },
})
