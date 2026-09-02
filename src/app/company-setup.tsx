import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { SITE_URL } from '@/constants/links'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { ClavierEvite } from '@/components/ui/ClavierEvite'

/**
 * Écran de repli : un compte superviseur sans entreprise rattachée.
 *
 * Deux situations très différentes aboutissaient au même texte, qui décrivait
 * en plus un parcours éteint (« déposez une demande sur /superviseur », dont
 * le formulaire n'existe plus depuis le 21 août 2026) :
 *
 * · **l'administrateur Quantinvo** n'a pas d'entreprise, et n'en aura jamais.
 *   Ce n'est pas une attente, c'est sa nature : il gère depuis le site.
 * · **un superviseur** pas encore rattaché à un magasin : son accès est ouvert
 *   par l'administrateur de son entreprise, depuis la page Mon équipe du site.
 *   Il n'a rien à déposer nulle part.
 *
 * Dans les deux cas l'app ne peut rien faire de plus — mais elle doit dire
 * quoi faire, et à qui s'adresser.
 */
export default function CompanySetupScreen() {
  const { profile, signOut } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const administrateur = !!profile?.is_admin

  return (
    <SafeAreaView style={styles.safe}>
      <ClavierEvite>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>
              {administrateur ? 'Compte administrateur' : 'Accès pas encore ouvert'}
            </Text>
            <Text style={styles.subtitle}>
              {administrateur
                ? 'Ce compte administre Quantinvo depuis le site : entreprises, magasins et accès. L’application, elle, sert à compter — elle demande un compte rattaché à un magasin.'
                : 'Votre compte n’est rattaché à aucun magasin. C’est l’administrateur de votre entreprise qui vous y rattache, depuis la page Mon équipe du site. Prévenez-le : vous n’avez rien à faire de votre côté.'}
            </Text>
          </View>

          <View style={styles.form}>
            <Pressable style={styles.button} onPress={() => Linking.openURL(SITE_URL)}>
              <Text style={styles.buttonText}>Ouvrir le site</Text>
            </Pressable>

            <Pressable style={styles.link} onPress={() => signOut()}>
              <Text style={styles.linkText}>Se déconnecter</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ClavierEvite>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.xxl },
    header: { gap: Spacing.md },
    title: { fontSize: 26, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.4 },
    subtitle: { fontSize: 15, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 22 },
    form: { gap: Spacing.sm },
    button: {
      backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg,
      alignItems: 'center', ...t.shadowButton,
    },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    link: { alignItems: 'center', paddingVertical: Spacing.md },
    linkText: { color: t.textMuted, fontSize: 14, fontFamily: Font.medium },
  })
}
