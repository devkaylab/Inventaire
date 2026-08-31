import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkTheme, lightTheme, themes, type Theme, type ThemeName } from '@/constants/ink'

// Persisted user override: 'light' | 'dark' | 'system'
type Preference = ThemeName | 'system'
const STORAGE_KEY = 'ui.themePreference.v1'

// Default to dark (validated with the user) until the stored preference loads.
const DEFAULT_PREFERENCE: Preference = 'dark'

interface ThemeContextValue {
  theme: Theme
  name: ThemeName
  preference: Preference
  setPreference: (p: Preference) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // ⚠️ `useColorScheme()` ne dit la vérité que si `userInterfaceStyle` vaut
  // « automatic » dans app.json. Il a valu « light » jusqu'au 31 août 2026 :
  // expo-system-ui posait alors MODE_NIGHT_NO sur l'activité, ce hook rendait
  // toujours 'light', et la préférence « Système » de l'application ne pouvait
  // JAMAIS donner le thème sombre — sur les deux plateformes. Les deux
  // réglages vont ensemble ; un test le vérifie.
  const systemScheme = useColorScheme() // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState<Preference>(DEFAULT_PREFERENCE)

  // Load the stored preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored)
      }
    })
  }, [])

  const setPreference = (p: Preference) => {
    setPreferenceState(p)
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {})
  }

  const name: ThemeName =
    preference === 'system'
      ? (systemScheme === 'light' ? 'light' : 'dark')
      : preference

  const toggle = () => setPreference(name === 'dark' ? 'light' : 'dark')

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: themes[name], name, preference, setPreference, toggle }),
    [name, preference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext)
  if (!ctx) return darkTheme // safe fallback before provider mounts
  return ctx.theme
}

export function useThemeControls(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: darkTheme,
      name: 'dark',
      preference: 'dark',
      setPreference: () => {},
      toggle: () => {},
    }
  }
  return ctx
}

export { lightTheme, darkTheme }
export type { Theme, ThemeName }
