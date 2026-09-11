import { useCallback, useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { usePorteVisible } from '@/lib/porte'
import { contenuColonne } from '@/constants/layout'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
/**
 * ⚠️ CHAQUE GRAISSE S'IMPORTE PAR SON PROPRE CHEMIN, JAMAIS PAR LA RACINE DU
 * PAQUET — et c'est mesuré, pas théorique.
 *
 * L'index de `@expo-google-fonts/<famille>` fait un `require()` de **toutes**
 * ses graisses et de toutes leurs italiques. Metro les embarque alors toutes :
 * en important depuis la racine, le paquet du 6 septembre 2026 emportait
 * **64 fichiers de police, 6,9 Mo**, pour huit fichiers réellement employés.
 *
 * ⚠️ ET LE DÉFAUT PRÉEXISTAIT : l'application importait Inter depuis sa racine
 * depuis le premier jour, donc elle embarquait déjà les dix-huit fichiers
 * d'Inter. Le changement de polices ne l'a pas créé, il l'a rendu visible.
 *
 * `useFonts` vient donc d'`expo-font` : les entrées par graisse n'exportent
 * que la police.
 */
import { useFonts } from 'expo-font'
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold'
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold'
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular'
import { PublicSans_500Medium } from '@expo-google-fonts/public-sans/500Medium'
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold'
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium'
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular'
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium'
import { AuthProvider, useAuth } from '@/lib/auth'
import { useNotificationRouting } from '@/lib/push'
import { ThemeProvider, useThemeControls } from '@/lib/theme'
import { useLangue } from '@/lib/i18n'
import { chargerLangue } from '@/lib/langueAppareil'
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
  // La porte de bienvenue couvre l'écran sans être une route : sans ce
  // signal, son fond clair porterait une heure blanche. Voir `lib/porte.ts`.
  const porte = usePorteVisible()
  // `useSegments` est typé sur les routes connues, mais rend un tableau vide
  // sur l'écran d'attente : d'où la lecture du premier segment, pas de la
  // longueur — cet écran est lui aussi sur le fond de page.
  const premier = useSegments()[0] as string | undefined
  const surFond = porte || !premier || ECRANS_SUR_FOND.includes(premier)
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
  /**
   * On ne rend rien tant que les polices ne sont pas là : sinon l'application
   * s'ouvre une fraction de seconde dans la police du système, puis saute.
   *
   * ⚠️ ARDOISE, 6 septembre 2026 — Inter est partie. Elle était l'une des deux
   * valeurs par défaut de l'époque, et l'un des trois signes mesurés de l'air
   * « fait par une IA ». Archivo porte les titres et les nombres, Public Sans
   * le texte courant, comme sur le site.
   *
   * ⚠️ ET LES DEUX DERNIÈRES NE SERVENT QUE SUR LES ÉCRANS QUI FONT FOI —
   * Newsreader pour le titre d'un rapport, IBM Plex Mono pour ses nombres.
   * C'est la piste « Registre ». Ne pas les employer ailleurs : la frontière
   * est ce qui empêche « deux identités » de devenir « deux produits ».
   *
   * Mesuré : les cinq graisses d'Inter pesaient 1 678 ko de TTF ; ces huit
   * fichiers en pèsent 792. On ajoute deux familles et on allège de 886 ko.
   */
  const [fontsLoaded] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    Newsreader_500Medium,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  })
  const [showSplash, setShowSplash] = useState(true)
  /**
   * La langue se lit AVANT le premier rendu, comme les polices : sinon
   * l'application s'ouvre en français et saute en anglais une fraction de
   * seconde plus tard. Elle vient de l'appareil, ou du choix fait dans
   * Mon compte (`langueAppareil.ts`).
   */
  const [langueChargee, setLangueChargee] = useState(false)
  useEffect(() => {
    chargerLangue().finally(() => setLangueChargee(true))
  }, [])
  // ⚠️ La pile est CLÉE sur la langue : en changer remonte tous les écrans,
  // y compris ceux restés ouverts sous celui du choix. Sans cette clé, un
  // écran déjà monté garderait ses textes dans l'ancienne langue jusqu'à ce
  // qu'on le rouvre — et c'est justement celui vers lequel on revient.
  const langueCourante = useLangue()

  // Reveal our JS content (and the animated splash overlay) by hiding the native splash.
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded || !langueChargee) return null

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
            <Stack key={langueCourante} screenOptions={{ headerShown: false, contentStyle: contenuColonne }}>
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
