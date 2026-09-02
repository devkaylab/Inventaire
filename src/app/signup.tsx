import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/lib/theme'
import { SITE_URL } from '@/constants/links'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { ClavierEvite } from '@/components/ui/ClavierEvite'

/**
 * Plus d'inscription depuis l'application.
 *
 * Les deux parcours passent désormais par un lien reçu par e-mail :
 *
 *  • le compteur est ajouté par son superviseur, qui déclenche l'invitation ;
 *  • le superviseur dépose une demande sur le site avec son code magasin,
 *    validée par Quantinvo.
 *
 * Dans les deux cas le compte auth existe déjà quand la personne clique : elle
 * vérifie son prénom et son nom, pré-remplis, puis choisit son mot de passe.
 * Un formulaire d'inscription ici ne pourrait donc qu'échouer — l'adresse est
 * déjà prise. Cet écran explique où aller plutôt que de laisser buter dessus.
 */
export default function SignupScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)

  return (
    <SafeAreaView style={styles.safe}>
      <ClavierEvite>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Créer mon compte</Text>
            <Text style={styles.subtitle}>
              Les comptes Quantinvo se créent sur invitation. Vous n&apos;avez rien à saisir ici.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vous êtes compteur</Text>
              <Text style={styles.cardBody}>
                Votre superviseur vous ajoute à son équipe. Vous recevez alors un e-mail : le lien
                vous permet de vérifier votre prénom et votre nom, puis de choisir votre mot de
                passe. Votre accès est actif immédiatement après.
              </Text>
              <Text style={styles.cardHint}>
                Pas d&apos;e-mail reçu ? Vérifiez vos indésirables, puis demandez à votre superviseur
                de relancer l&apos;invitation.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vous êtes superviseur</Text>
              <Text style={styles.cardBody}>
                Votre accès est ouvert par l&apos;administrateur de votre entreprise, depuis la
                page Mon équipe du site. Il vous envoie une invitation par e-mail, avec le lien
                de création de votre mot de passe.
              </Text>
              <Text style={styles.cardBody}>
                Vous n&apos;avez pas d&apos;administrateur d&apos;entreprise ? Écrivez-nous depuis
                le site.
              </Text>
              <Pressable style={styles.button} onPress={() => Linking.openURL(SITE_URL)}>
                <Text style={styles.buttonText}>Ouvrir le site</Text>
              </Pressable>
            </View>

            <Pressable style={styles.link} onPress={() => router.back()}>
              <Text style={styles.linkText}>Retour à la connexion</Text>
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
    container: { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xxxl },
    header: { alignItems: 'center', marginBottom: Spacing.xxl, gap: Spacing.sm },
    title: { fontSize: 28, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -0.5 },
    subtitle: {
      fontSize: 14, fontFamily: Font.regular, color: t.textSecondary,
      textAlign: 'center', lineHeight: 20,
    },
    form: { gap: Spacing.lg },
    card: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      backgroundColor: t.surface, padding: Spacing.xl, gap: Spacing.sm,
    },
    cardTitle: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary },
    cardBody: { fontSize: 14, fontFamily: Font.regular, color: t.textSecondary, lineHeight: 20 },
    cardHint: { fontSize: 12, fontFamily: Font.regular, color: t.textMuted, lineHeight: 17 },
    button: {
      backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg,
      alignItems: 'center', marginTop: Spacing.sm, ...t.shadowButton,
    },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    link: { alignItems: 'center', paddingVertical: Spacing.md },
    linkText: { color: t.accent, fontSize: 14, fontFamily: Font.semibold },
  })
}
