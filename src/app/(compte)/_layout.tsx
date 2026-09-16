import { Redirect, router, Stack } from 'expo-router'
import { contenuColonne } from '@/constants/layout'
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { HeaderActions } from '@/components/HeaderActions'
import { t } from '@/lib/i18n'

/**
 * « Mon compte » et tout ce qu'il ouvre — une seule pile de navigation.
 *
 * Les écrans de travail (Magasins, Mon équipe, Boîte à outils) vivaient dans
 * le groupe `(supervisor)`. Les ouvrir depuis « Mon compte », qui est ici,
 * traversait deux groupes : la pile repartait de zéro et **la flèche de retour
 * disparaissait**. Ce qu'un écran ouvre doit être dans sa pile.
 *
 * Les écrans du compte, eux, sont communs à tous les rôles.
 *
 * Ils vivaient sous `(supervisor)`, donc un compteur ne pouvait pas les
 * atteindre : la garde de ce groupe renvoie tout ce qui n'est pas superviseur
 * vers la connexion. Or changer son mot de passe ou récupérer ses données ne
 * dépend pas du rôle — c'est le compte de la personne. Le site n'a qu'une
 * page « Mon compte » pour tout le monde ; l'app fait pareil.
 *
 * Seule condition d'entrée : un profil, et une session complète. Un compte
 * resté au mot de passe seul alors qu'il a un second facteur n'entre pas —
 * sans quoi on pourrait retirer sa double authentification à moitié
 * authentifié.
 */
/**
 * Retour vers l'écran d'où l'on vient — Sessions pour un superviseur, l'accueil
 * pour un compteur.
 *
 * « Mon compte » est le premier écran de cette pile : la pile n'a donc rien
 * en dessous et la flèche native ne s'affiche pas, alors qu'on arrive bien de
 * quelque part (la pile racine, elle, a une histoire). Ce bouton la rend.
 */
function RetourVersApp() {
  if (!router.canGoBack()) return null
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      style={styles.retour}
      accessibilityRole="button"
      accessibilityLabel={t('Retour')}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d={ANDROID ? 'M20 12H4M11 5l-7 7 7 7' : 'M15 6l-6 6 6 6'}
          stroke="#fff"
          strokeWidth={ANDROID ? 2 : 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  )
}

const ANDROID = Platform.OS === 'android'

const styles = StyleSheet.create({
  // Flèche seule : le libellé « Retour » chevauchait le titre sur le Pixel.
  // Sans texte, le nom passe par `accessibilityLabel`, et le `hitSlop` porte
  // la cible à 48 dp (24 + 2 × 12).
  // ⚠️ Elle imite la flèche NATIVE de chaque système, sinon deux écrans voisins
  // ne portent pas le même retour : sur Android une flèche « ← » suivie d'un
  // vrai blanc avant le titre (mesuré sur le Pixel, 16/09/2026), sur iOS un
  // chevron collé au bord.
  retour: ANDROID
    ? { flexDirection: 'row', alignItems: 'center', marginRight: 32 }
    : { flexDirection: 'row', alignItems: 'center', marginLeft: -6 },
})

export default function CompteLayout() {
  const { profile, loading, mfaRequired } = useAuth()
  const theme = useTheme()

  // Sablier seulement tant qu'on ne sait pas qui est là. S'il se rallumait
  // alors que le profil est connu, la pile repartirait de « Mon compte » —
  // par exemple juste après un changement de mot de passe, qui émet un
  // événement d'authentification.
  if (loading && !profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  if (!profile || mfaRequired) return <Redirect href="/login" />

  const headerBase = {
    headerStyle: { backgroundColor: theme.headerBg },
    headerTintColor: theme.headerText,
    headerTitleStyle: { fontFamily: Font.bold, color: theme.headerText },
    contentStyle: { backgroundColor: theme.background },
    // La flèche seule, sans libellé (16/09/2026) : sur le Pixel, « Retour »
    // chevauchait le titre de l'écran. `minimal` retire aussi le titre de
    // l'écran précédent qu'iOS affiche par défaut.
    headerBackButtonDisplayMode: 'minimal' as const,
  }

  const actionsRight = () => <HeaderActions />

  return (
    <Stack screenOptions={{ contentStyle: contenuColonne }}>
      <Stack.Screen
        name="account"
        options={{
          title: t('Mon compte'),
          ...headerBase,
          headerLeft: () => <RetourVersApp />,
          headerRight: actionsRight,
        }}
      />
      {/* ⚠️ **TOUT ÉCRAN DE CE GROUPE OUVERT DEPUIS UN AUTRE GROUPE DOIT
          PORTER `headerLeft`.** Arrivé ainsi, il est le PREMIER écran de cette
          pile — la flèche native ne s'affiche pas, et on reste coincé dessus
          (vu au simulateur le 23 août 2026 sur Mon équipe et Boîte à outils).
          `RetourVersApp` la rend, ici comme sur « Mon compte », et pointe vers
          le bon écran dans tous les cas.

          ⚠️ **Magasins avait été oublié**, et le commentaire d'alors ne
          nommait que les deux écrans du jour : constat de Julien le
          4 septembre 2026, depuis un compte d'administrateur d'entreprise —
          son bandeau de démarrage et sa porte de bienvenue mènent tous deux
          ici. C'est pourquoi la règle est désormais tenue par un test qui
          DÉDUIT la liste du code (`tests/compte.test.ts`, « une porte s'ouvre
          des deux côtés ») au lieu de citer des écrans à la main : la
          prochaine porte se signalera toute seule. */}
      <Stack.Screen name="stores" options={{ title: t('Magasins'), ...headerBase, headerLeft: () => <RetourVersApp />, headerRight: actionsRight }} />
      <Stack.Screen name="team" options={{ title: t('Mon équipe'), ...headerBase, headerLeft: () => <RetourVersApp />, headerRight: actionsRight }} />
      <Stack.Screen name="new-member" options={{ title: t('Ajouter un membre'), ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="tools" options={{ title: t('Boîte à outils'), ...headerBase, headerLeft: () => <RetourVersApp />, headerRight: actionsRight }} />
      <Stack.Screen name="profile" options={{ title: t('Mon profil'), ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="password" options={{ title: t('Mot de passe'), ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="mfa" options={{ title: t('Double authentification'), ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="my-data" options={{ title: t('Mes données'), ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="name" options={{ title: t('Mon nom'), ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="langue" options={{ title: t('Langue'), ...headerBase, headerRight: actionsRight }} />
    </Stack>
  )
}
