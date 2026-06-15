// ─── Design system « Ink » — theme tokens ────────────────────────────────────
// Two palettes (light + dark). Keys are a superset of the old `Colors` object so
// existing styles keep working while we migrate. New semantic tokens (accent,
// hairline, headerBg, …) drive the premium look.

export type ThemeName = 'light' | 'dark'

export interface Theme {
  name: ThemeName
  // Surfaces & background
  background: string
  surface: string
  surfaceElevated: string
  // Header (near-black Ink bar)
  headerBg: string
  headerText: string
  headerSubtle: string
  headerBtnBg: string
  headerBtnBorder: string
  // Lines
  border: string          // = hairline (kept name for compat with old styles)
  hairline: string
  borderStrong: string
  // Text
  textPrimary: string
  textSecondary: string
  textMuted: string
  // Accent (indigo)
  primary: string         // kept name for compat → maps to accent
  primaryDark: string
  accent: string
  accentDark: string
  accentSoft: string
  onAccent: string
  // Semantic
  secondary: string       // success (kept name for compat)
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  // Pass colors
  passColors: { 1: string; 2: string; 3: string }
  // Camera backdrop
  cameraBg: string
  // Shadows (RN style objects)
  shadowCard: object
  shadowElevated: object
  shadowButton: object
}

const lightShadowCard = {
  shadowColor: '#0B0F19',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
}
const lightShadowElevated = {
  shadowColor: '#0B0F19',
  shadowOpacity: 0.12,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
}
const lightShadowButton = {
  shadowColor: '#4F46E5',
  shadowOpacity: 0.28,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
}

const darkShadowCard = {
  shadowColor: '#000000',
  shadowOpacity: 0.4,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
}
const darkShadowElevated = {
  shadowColor: '#000000',
  shadowOpacity: 0.55,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
}
const darkShadowButton = {
  shadowColor: '#6366F1',
  shadowOpacity: 0.45,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 5,
}

export const lightTheme: Theme = {
  name: 'light',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  headerBg: '#0B0F19',
  headerText: '#FFFFFF',
  headerSubtle: 'rgba(255,255,255,0.55)',
  headerBtnBg: 'rgba(255,255,255,0.12)',
  headerBtnBorder: 'rgba(255,255,255,0.18)',
  border: '#EEF0F4',
  hairline: '#EEF0F4',
  borderStrong: '#E2E5EA',
  textPrimary: '#0B0F19',
  textSecondary: '#5A6172',
  textMuted: '#9AA0AE',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  accent: '#4F46E5',
  accentDark: '#4338CA',
  accentSoft: '#EEF0FF',
  onAccent: '#FFFFFF',
  secondary: '#059669',
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  passColors: { 1: '#4F46E5', 2: '#059669', 3: '#DC2626' },
  cameraBg: '#11151F',
  shadowCard: lightShadowCard,
  shadowElevated: lightShadowElevated,
  shadowButton: lightShadowButton,
}

export const darkTheme: Theme = {
  name: 'dark',
  background: '#0B0F19',
  surface: '#151A27',
  surfaceElevated: '#1B2130',
  headerBg: '#060910',
  headerText: '#FFFFFF',
  headerSubtle: 'rgba(255,255,255,0.5)',
  headerBtnBg: 'rgba(255,255,255,0.10)',
  headerBtnBorder: 'rgba(255,255,255,0.14)',
  border: '#232A39',
  hairline: '#232A39',
  borderStrong: '#2D3548',
  textPrimary: '#F3F5F9',
  textSecondary: '#9BA3B4',
  textMuted: '#646C7E',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  accent: '#6366F1',
  accentDark: '#4F46E5',
  accentSoft: 'rgba(99,102,241,0.15)',
  onAccent: '#FFFFFF',
  secondary: '#10B981',
  success: '#10B981',
  successSoft: 'rgba(16,185,129,0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.14)',
  passColors: { 1: '#6366F1', 2: '#10B981', 3: '#EF4444' },
  cameraBg: '#05070D',
  shadowCard: darkShadowCard,
  shadowElevated: darkShadowElevated,
  shadowButton: darkShadowButton,
}

export const themes: Record<ThemeName, Theme> = { light: lightTheme, dark: darkTheme }

// ─── Scales ───────────────────────────────────────────────────────────────────
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const

export const Radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const

// Inter font family names (registered in _layout via expo-font)
export const Font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const

// Helper: tabular figures for numeric values (quantities, money, codes)
export const tabular = { fontVariant: ['tabular-nums' as const] }
