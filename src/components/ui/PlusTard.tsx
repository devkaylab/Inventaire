import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Font, Spacing, type Theme } from '@/constants/ink'
import { useTheme } from '@/lib/theme'
import { t } from '@/lib/i18n'
import { quitterLeTunnel } from '@/lib/tunnel'

/**
 * « Plus tard » — la sortie du tunnel de préparation, à chacune de ses étapes.
 *
 * Constat de Julien (7 septembre 2026) : *« on a l'impression qu'on est obligé
 * de tout faire maintenant »*. Le tunnel n'offrait qu'un geste, et il avance :
 * il fallait aller au bout, ou reculer jusqu'à la liste.
 *
 * ⚠️ **CE N'EST PAS LA SORTIE QU'IL AVAIT REFUSÉE LA VEILLE.** Le 7 septembre
 * au matin, « Plus tard » avait été proposé **à la place** du bouton retour —
 * réponse de Julien : *« je ne veux pas plus tard, je veux pouvoir revenir à
 * l'étape précédente »*. La flèche existe depuis (les étapes s'empilent) ;
 * celle-ci vient **en plus**, et répond à autre chose. Ne pas relire la note
 * d'hier comme un refus de ce composant.
 *
 * ⚠️ **UN LIEN, JAMAIS UN SECOND BOUTON PLEIN.** Le bouton d'avance est le
 * geste principal de l'écran ; deux aplats côte à côte se disputeraient le
 * regard, et celui qui fait avancer perdrait.
 *
 * ⚠️ **ET C'EST LA PHRASE QUI FAIT LE TRAVAIL, PAS LE LIEN.** « Plus tard »
 * seul peut se lire « annuler » — or l'inventaire est déjà créé. Sans la
 * phrase, on n'ose pas plus qu'avant, et le lien n'aurait rien réglé.
 */
export function PlusTard({ sessionId, note }: {
  sessionId: string
  /**
   * Ce qui rassure. La dernière étape a le sien : son bouton d'avance DÉMARRE
   * le comptage, donc le doute n'est pas le même — partir sans démarrer est
   * précisément le cas qui n'avait aucun chemin.
   */
  note?: string
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  return (
    <View style={styles.bloc}>
      <Pressable onPress={() => quitterLeTunnel(sessionId)} hitSlop={8} style={styles.zone}>
        <Text style={styles.lien}>{t('Plus tard')}</Text>
      </Pressable>
      <Text style={styles.note}>
        {note ?? t('L’inventaire est créé. Vous reprendrez la préparation depuis sa fiche.')}
      </Text>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    bloc: { marginTop: Spacing.md, gap: Spacing.xs },
    // ⚠️ 48 dp de cible, comme tout ce qui se touche dans l'app (passe du
    // 31 août 2026) : un mot n'est pas un bouton tant qu'on ne lui a pas donné
    // sa hauteur.
    zone: { minHeight: 48, justifyContent: 'center' },
    lien: { fontSize: 15, color: t.accent, fontFamily: Font.semibold, textAlign: 'center' },
    note: {
      fontSize: 12.5, color: t.textMuted, fontFamily: Font.regular,
      lineHeight: 18, textAlign: 'center',
    },
  })
}
