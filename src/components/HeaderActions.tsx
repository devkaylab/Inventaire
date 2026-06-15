import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useThemeControls } from '@/lib/theme'
import { Font } from '@/constants/ink'

// Circular translucent buttons that sit on the near-black Ink header.
// Theme toggle (sun/moon) + help (?), shared by both navigation layouts.
export function HeaderActions({ onHelp }: { onHelp: () => void }) {
  const { name, toggle } = useThemeControls()
  return (
    <View style={styles.row}>
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
