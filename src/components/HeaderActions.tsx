import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { useThemeControls } from '@/lib/theme'

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

// Icônes de thème (SVG, pas d'emoji) : clair = soleil, sombre = lune,
// système = écran (suit l'appareil).
function ThemeIcon({ preference }: { preference: 'light' | 'dark' | 'system' }) {
  if (preference === 'light') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round">
        <Circle cx={12} cy={12} r={4} />
        <Line x1={12} y1={2.5} x2={12} y2={5} />
        <Line x1={12} y1={19} x2={12} y2={21.5} />
        <Line x1={2.5} y1={12} x2={5} y2={12} />
        <Line x1={19} y1={12} x2={21.5} y2={12} />
        <Line x1={5.2} y1={5.2} x2={7} y2={7} />
        <Line x1={17} y1={17} x2={18.8} y2={18.8} />
        <Line x1={18.8} y1={5.2} x2={17} y2={7} />
        <Line x1={7} y1={17} x2={5.2} y2={18.8} />
      </Svg>
    )
  }
  if (preference === 'dark') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path fill="#fff" d="M20 14.4A8.2 8.2 0 1 1 9.6 4a6.6 6.6 0 0 0 10.4 10.4z" />
      </Svg>
    )
  }
  // système = écran / moniteur
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={4} width={18} height={12.5} rx={2} />
      <Line x1={8.5} y1={20.5} x2={15.5} y2={20.5} />
      <Line x1={12} y1={16.5} x2={12} y2={20.5} />
    </Svg>
  )
}

const NEXT_PREF = { system: 'light', light: 'dark', dark: 'system' } as const

// Circular translucent buttons that sit on the near-black Ink header.
// Optional profile (leftmost) + theme cycle (système/clair/sombre), shared by
// both navigation layouts. `onProfile` is only passed on the supervisor's main
// screens, so the employee header stays unchanged.
export function HeaderActions({ onProfile }: { onProfile?: () => void }) {
  const { preference, setPreference } = useThemeControls()
  return (
    <View style={styles.row}>
      {onProfile && (
        <Pressable
          onPress={onProfile}
          hitSlop={8}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel="Mon compte"
        >
          <ProfileIcon />
        </Pressable>
      )}
      <Pressable
        onPress={() => setPreference(NEXT_PREF[preference])}
        hitSlop={8}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={`Thème : ${preference === 'system' ? 'système' : preference === 'light' ? 'clair' : 'sombre'}`}
      >
        <ThemeIcon preference={preference} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  // ⚠️ L'écart de 16 n'est pas décoratif : chaque bouton fait 32 dp avec un
  // `hitSlop` de 8, donc 48 de zone tactile — sa zone déborde de 8 de chaque
  // côté. À 8 d'écart les deux zones mordaient l'une sur l'autre, et dans
  // cette bande c'est le dernier rendu qui prenait l'appui. À 16, elles se
  // touchent exactement au milieu, sans se chevaucher.
  row: { flexDirection: 'row', gap: 16, marginRight: 2 },
  // ⚠️ NE PAS agrandir la pastille pour gagner de la cible : elle est déjà à
  // 48 grâce au `hitSlop`. Essayé le 31 août 2026 (32 → 40) — aucun gain, et
  // sur iOS 26 les ronds remplissaient alors la capsule que le système dessine
  // lui-même autour des boutons de barre : double habillage, constat de Julien
  // capture à l'appui. C'est le `hitSlop` qui fait la cible, pas le dessin.
  btn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
})
