import { useCallback, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import { AuthProvider, useAuth } from '@/lib/auth'
import { useNotificationRouting } from '@/lib/push'
import { ThemeProvider, useThemeControls } from '@/lib/theme'
import { SplashAnimation } from '@/components/SplashAnimation'
import { OfflineTopBanner } from '@/components/OfflineTopBanner'
import { PorteBienvenue } from '@/components/PorteBienvenue'
import { Dialogues } from '@/components/ui/Dialogue'

// Hold the native splash until fonts are ready; our animated splash takes over from there.
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
})

/**
 * La barre d'état suit l'écran affiché.
 *
 * Elle était posée en dur sur `light`, ce qui est juste pour l'immense
 * majorité des écrans : leur en-tête est presque noir. Mais quatre écrans
 * s'ouvrent sur le **fond de page** — connexion, inscription, création
 * d'entreprise, et l'écran d'attente. En thème clair, l'heure, le réseau et
 * la batterie s'y affichaient en blanc sur blanc : illisibles. Constaté sur
 * la capture de l'écran de connexion, le 24 août 2026.
 *
 * Le choix se fait ici, à partir de la route, plutôt que par un second
 * `StatusBar` posé sur ces écrans : `expo-status-bar` ne restaure rien au
 * démontage, si bien qu'un style local resterait appliqué après la
 * navigation suivante. Ici, il est recalculé à chaque changement de route.
 */
const ECRANS_SUR_FOND = ['login', 'signup', 'company-setup']

function BarreEtat() {
  const { name } = useThemeControls()
  // `useSegments` est typé sur les routes connues, mais rend un tableau vide
  // sur l'écran d'attente : d'où la lecture du premier segment, pas de la
  // longueur — cet écran est lui aussi sur le fond de page.
  const premier = useSegments()[0] as string | undefined
  const surFond = !premier || ECRANS_SUR_FOND.includes(premier)
  // Texte sombre seulement là où le haut de l'écran est clair : sur le fond
  // de page, en thème clair. Partout ailleurs le haut est sombre — en-tête
  // presque noir, ou fond de page en thème sombre.
  const sombre = name === 'dark'
  return <StatusBar style={surFond && !sombre ? 'dark' : 'light'} />
}

/**
 * Toucher « Nouvel inventaire » ouvrait l'accueil : rien n'écoutait la
 * réponse aux notifications. Le branchement vit ici, sous AuthProvider —
 * c'est le seul endroit monté en permanence qui connaisse le rôle, et le rôle
 * décide de la pile à ouvrir.
 */
function RoutageNotifications() {
  const { profile } = useAuth()
  useNotificationRouting(profile?.role)
  return null
}

export default function RootLayout() {
  // Load Inter; render nothing until ready so we never flash the system font.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  })
  const [showSplash, setShowSplash] = useState(true)

  // Reveal our JS content (and the animated splash overlay) by hiding the native splash.
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {/* Racine des gestes : sans elle, le balayage d'une tuile
              d'inventaire ne recevrait rien. Elle doit envelopper toute
              l'application, pas seulement l'écran concerné. */}
          <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <BarreEtat />
            {/* Au-dessus de la pile : le bandeau doit coiffer l'en-tête de
                chaque écran, et rester visible quelle que soit la page. */}
            <OfflineTopBanner />
            <RoutageNotifications />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="company-setup" />
              <Stack.Screen name="(compte)" />
              <Stack.Screen name="(supervisor)" />
              <Stack.Screen name="(employee)" />
            </Stack>
            {/* Au-dessus de la pile, sous le splash : l'écran de bienvenue
                couvre l'atterrissage le temps d'être lu, une fois par
                appareil et par compte. */}
            <PorteBienvenue />
            {/* Les questions et les bandeaux, au-dessus de la pile et de la
                porte : une question peut être posée depuis n'importe quel
                écran, y compris pendant l'atterrissage. */}
            <Dialogues />
            {showSplash && <SplashAnimation onFinish={() => setShowSplash(false)} />}
          </GestureHandlerRootView>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
