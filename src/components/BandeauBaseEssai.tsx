import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Font, Spacing } from '@/constants/ink'
import { repereDeLaBase, surLaProduction } from '@/lib/baseConnectee'
import { t } from '@/lib/i18n'

/**
 * ⚠️ « CE QUE TU COMPTES ICI NE COMPTE PAS » (4 octobre 2026).
 *
 * Une bande rouge, en haut de chaque écran, quand l'application n'est PAS
 * branchée sur la production. Elle ne s'anime pas et ne se referme pas : ce
 * n'est pas un état qui change, c'est ce qu'est ce build.
 *
 * **Sur l'app publiée, ce composant rend `null`** — pas une bande de hauteur
 * nulle, rien du tout. Aucun pixel ne bouge, aucune zone sûre n'est réservée.
 *
 * Ce qu'il empêche, et qui est arrivé à d'autres : une démonstration chez un
 * client faite par erreur sur une base d'essai, où rien de ce qui est compté
 * n'est conservé. Et l'inverse — un build d'essai qui écrit chez de vrais
 * clients. L'identifiant étant le même pour les deux
 * (`com.quantinvo.app`), rien d'autre ne les distingue sur l'appareil.
 *
 * ⚠️ Les couleurs sont EN DUR, hors du thème. Un thème se charge, peut échouer,
 * et se choisit ; cette bande doit s'afficher même si tout le reste est encore
 * gris. Le rouge et le blanc tiennent l'AA dans les deux thèmes (7,4:1).
 *
 * Connu, et assumé : quand le réseau tombe dans un build d'essai, cette bande
 * et `OfflineTopBanner` réservent chacune la zone sûre, ce qui laisse un écart
 * en trop. Deux bandes de toute façon, et seulement hors production.
 */

/** Hauteur de la bande, hors zone sûre. */
const BANDE_H = 24

const FOND = '#8E1B12'
const ENCRE = '#FFFFFF'

export function BandeauBaseEssai() {
  const insets = useSafeAreaInsets()

  // ⚠️ LA SORTIE EST LA PREMIÈRE LIGNE. Tout ce qui suit — zone sûre comprise —
  // n'existe que hors production.
  if (surLaProduction()) return null

  return (
    <View
      accessibilityRole="alert"
      style={[styles.wrap, { paddingTop: insets.top, backgroundColor: FOND }]}
    >
      <Text style={styles.texte} numberOfLines={1}>
        {t('BASE D’ESSAI — pas la production')} · {repereDeLaBase()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'flex-end' },
  texte: {
    height: BANDE_H,
    lineHeight: BANDE_H,
    textAlign: 'center',
    color: ENCRE,
    fontFamily: Font.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: Spacing.lg,
  },
})
