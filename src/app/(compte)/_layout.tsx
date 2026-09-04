import { Redirect, router, Stack } from 'expo-router'
import { contenuColonne } from '@/constants/layout'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { HeaderActions } from '@/components/HeaderActions'

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
    <Pressable onPress={() => router.back()} hitSlop={10} style={styles.retour}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          d="M15 6l-6 6 6 6"
          stroke="#fff"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Text style={styles.retourText}>Retour</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  retour: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6 },
  retourText: { color: '#fff', fontSize: 16 },
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
    // iOS reprend par défaut le titre de l'écran précédent — « Mon compte »,
    // « Session »… Un seul mot, toujours le même, se lit plus vite qu'un
    // libellé qui change à chaque écran, et ne risque pas d'être tronqué.
    headerBackTitle: 'Retour',
  }

  const actionsRight = () => <HeaderActions />

  return (
    <Stack screenOptions={{ contentStyle: contenuColonne }}>
      <Stack.Screen
        name="account"
        options={{
          title: 'Mon compte',
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
      <Stack.Screen name="stores" options={{ title: 'Magasins', ...headerBase, headerLeft: () => <RetourVersApp />, headerRight: actionsRight }} />
      <Stack.Screen name="team" options={{ title: 'Mon équipe', ...headerBase, headerLeft: () => <RetourVersApp />, headerRight: actionsRight }} />
      <Stack.Screen name="new-member" options={{ title: 'Ajouter un membre', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="tools" options={{ title: 'Boîte à outils', ...headerBase, headerLeft: () => <RetourVersApp />, headerRight: actionsRight }} />
      <Stack.Screen name="profile" options={{ title: 'Mon profil', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="password" options={{ title: 'Mot de passe', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="mfa" options={{ title: 'Double authentification', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="my-data" options={{ title: 'Mes données', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="name" options={{ title: 'Mon nom', ...headerBase, headerRight: actionsRight }} />
    </Stack>
  )
}
