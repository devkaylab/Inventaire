import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MenuCard, MenuRow, SectionLabel } from '@/components/ui/MenuList'
import { DeletionPendingNote, useAccountDeletion } from '@/components/AccountDeletion'
import { useAuth } from '@/lib/auth'
import { verifiedTotpFactor } from '@/lib/mfa'
import { useTheme } from '@/lib/theme'
import { Font, Spacing, type Theme } from '@/constants/ink'

/**
 * Mon profil — ce qui me concerne, moi.
 *
 * ⚠️ POURQUOI CET ÉCRAN EXISTE. « Supprimer mon compte » vivait sur « Mon
 * compte », **juste sous « Se déconnecter »**, dans la même carte. C'était la
 * seule ligne colorée de l'écran, donc celle qui attirait l'œil : Julien, le
 * 28 août 2026, en voulant se déconnecter — « c'est celui qu'on a envie de
 * cliquer ». Deux gestes sans rapport, à un centimètre l'un de l'autre, dont
 * le plus grave est le plus visible.
 *
 * Elle descend donc d'un cran, sous son propre titre, séparée du reste par un
 * blanc. Le nom et les accès viennent avec elle : ce sont les trois choses
 * qu'on vient modifier **sur soi**, elles n'avaient pas de raison d'être
 * réparties sur deux écrans.
 *
 * ⚠️ Ce qui reste sur « Mon compte » n'est plus que du sans-risque, et « Se
 * déconnecter » y est passé en rouge — ce qui n'était possible qu'une fois la
 * suppression partie : deux rouges voisins n'auraient rien distingué.
 *
 * Le déplacement ajoute une distance ; il ne remplace pas la confirmation, qui
 * n'a pas bougé (`useAccountDeletion`).
 */
export default function ProfileScreen() {
  const { profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const suppression = useAccountDeletion()

  // L'état du second facteur se relit à chaque retour sur l'écran : on en
  // revient précisément après l'avoir activé ou retiré. `useFocusEffect`
  // couvre aussi le premier affichage — pas de `useEffect` en plus.
  const [mfaOn, setMfaOn] = useState<boolean | null>(null)
  const relireMfa = useCallback(() => {
    let vivant = true
    verifiedTotpFactor()
      .then((id) => { if (vivant) setMfaOn(!!id) })
      .catch(() => { if (vivant) setMfaOn(null) })
    return () => { vivant = false }
  }, [])
  useFocusEffect(relireMfa)

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Mon identité</SectionLabel>
        <MenuCard>
          <MenuRow
            icon="nom"
            label="Prénom et nom"
            value={profile?.full_name || undefined}
            onPress={() => router.push('/(compte)/name')}
            last
          />
        </MenuCard>

        <SectionLabel>Mes accès</SectionLabel>
        <MenuCard>
          <MenuRow icon="cle" label="Mot de passe" onPress={() => router.push('/(compte)/password')} />
          <MenuRow
            icon="bouclier"
            label="Double authentification"
            value={mfaOn === null ? undefined : mfaOn ? 'Activée' : 'Non activée'}
            onPress={() => router.push('/(compte)/mfa')}
            last
          />
        </MenuCard>

        {/* Seule sous son titre, et en bas : c'est la distance qui protège. */}
        <SectionLabel>Zone sensible</SectionLabel>
        {suppression.pending ? (
          <DeletionPendingNote />
        ) : (
          <MenuCard>
            <MenuRow
              icon="corbeille"
              label="Supprimer mon compte"
              onPress={suppression.confirm}
              danger
              last
            />
          </MenuCard>
        )}

        <Text style={styles.note}>
          La suppression efface votre compte et vos informations personnelles. Elle vous sera
          demandée une seconde fois.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.xs },
    note: {
      marginTop: Spacing.md,
      fontSize: 12,
      lineHeight: 17,
      color: t.textMuted,
      fontFamily: Font.regular,
    },
  })
}
