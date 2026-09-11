import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MenuCard, MenuRow, SectionLabel } from '@/components/ui/MenuList'
import { LANGUES, NOM_LANGUE, t, useLangue } from '@/lib/i18n'
import { changerLangue } from '@/lib/langueAppareil'
import { useTheme } from '@/lib/theme'
import { Font, Spacing, type Theme } from '@/constants/ink'

/**
 * La langue de l'application (10 septembre 2026).
 *
 * Deux lignes, une coche. Chaque langue est nommée DANS SA LANGUE — c'est la
 * seule façon de la retrouver quand on ne lit pas celle qui est affichée.
 *
 * ⚠️ Le choix vaut pour cet appareil, pas pour le compte : un téléphone
 * partagé entre une équipe française et une saisonnière anglophone garde la
 * langue de l'appareil à chaque déconnexion (`oublierCachesLocaux` efface
 * la préférence avec les autres caches). Par défaut, l'application parle la
 * langue du téléphone si elle la connaît, le français sinon.
 *
 * Changer de langue remonte la pile de navigation : tout l'écran se redessine
 * dans la nouvelle langue, écrans déjà ouverts compris. C'est le prix d'un
 * geste rare, et il évite qu'un écran resté en dessous garde l'ancienne.
 */
export default function LangueScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const courante = useLangue()

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>{t('Langue de l’application')}</SectionLabel>
        <MenuCard>
          {LANGUES.map((l, i) => (
            <MenuRow
              key={l}
              label={NOM_LANGUE[l]}
              value={l === courante ? '✓' : undefined}
              onPress={() => { void changerLangue(l) }}
              sansChevron
              last={i === LANGUES.length - 1}
            />
          ))}
        </MenuCard>
        <Text style={styles.note}>
          {t('Le choix vaut pour ce téléphone. Les rapports et les e-mails restent en français.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
    note: { fontSize: 13, color: t.textMuted, fontFamily: Font.regular, lineHeight: 19, marginTop: Spacing.xs },
  })
}
