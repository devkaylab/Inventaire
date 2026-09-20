import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { BarreInventoriste } from '@/components/BarreInventoriste'
import { duree, euros, monEspace, quand } from '@/lib/onDemand'

/**
 * Mes revenus — ce qui vient, et ce qui est parti.
 *
 * Maquette : Prestataire-Revenus.
 *
 * ⚠️ **« À VENIR » N'EST PAS UNE PROMESSE DE DATE.** Tant que les versements
 * automatiques ne sont pas branchés (Stripe Connect, `07-par-ou-on-commence`),
 * annoncer « versés mercredi » serait faux un mercredi sur deux. On dit ce
 * qu'on sait : le montant acquis, et que c'est Stripe qui verse.
 *
 * ⚠️ **ET LE MONTANT EST CELUI DE L'AFFECTATION**, pas un recalcul. Il a été
 * annoncé avant l'acceptation et figé dessus : le recalculer ici ouvrirait la
 * porte à un écart entre ce qu'on a promis et ce qu'on affiche.
 */
export default function RevenusScreen() {
  const theme = useTheme()
  const styles = faireStyles(theme)
  const espace = useQuery({ queryKey: ['espace-inventoriste'], queryFn: monEspace })

  const revenus = espace.data?.revenus
  const missions = espace.data?.missions ?? []
  const profil = espace.data?.profil

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        {espace.isLoading && <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxl }} />}

        {revenus ? (
          <View style={styles.carteTete}>
            <Text style={styles.etiquette}>À venir</Text>
            <Text style={[styles.montant, tabular]}>{euros(revenus.a_venir_cents)}</Text>
            <Text style={styles.detail}>
              {revenus.a_venir_cents === 0
                ? 'Rien en attente pour l’instant.'
                : 'Acquis sur des missions terminées. Le versement part dès que Stripe a validé votre dossier.'}
            </Text>
          </View>
        ) : null}

        {missions.length > 0 && (
          <>
            <Text style={styles.chapeau}>Ce qui compose ce montant</Text>
            {missions.map((m) => (
              <View key={m.mission_id} style={styles.ligne}>
                <View style={{ flexGrow: 1, flexShrink: 1 }}>
                  <Text style={styles.nom}>{m.magasin}</Text>
                  <Text style={styles.detail}>
                    {quand(m.debut_prevu)} · {duree(m.duree_minutes)}
                  </Text>
                </View>
                <Text style={[styles.somme, tabular]}>{euros(m.remuneration_cents)}</Text>
              </View>
            ))}
          </>
        )}

        {revenus && revenus.verse_cents > 0 && (
          <>
            <Text style={styles.chapeau}>Déjà versé</Text>
            <View style={styles.ligne}>
              <Text style={styles.nom}>Total des missions payées</Text>
              <Text style={[styles.somme, tabular]}>{euros(revenus.verse_cents)}</Text>
            </View>
          </>
        )}

        <Text style={styles.note}>
          {profil && !profil.paiements_ouverts
            ? 'Votre compte de paiement n’est pas encore validé par Stripe. Votre dû est conservé : le versement part dès que votre dossier est complet.'
            : 'Les versements partent par Stripe, sur le compte que vous lui avez donné. Quantinvo ne voit pas vos coordonnées bancaires.'}
        </Text>
      </ScrollView>
      <BarreInventoriste />
    </SafeAreaView>
  )
}

const faireStyles = (theme: Theme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  contenu: { padding: Spacing.xl, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  carteTete: { backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.xl, gap: 8 },
  etiquette: { color: theme.textSecondary, fontFamily: Font.medium, fontSize: 12.5 },
  montant: { color: theme.textPrimary, fontFamily: Font.bold, fontSize: 36, letterSpacing: -1 },
  chapeau: { color: theme.textSecondary, fontFamily: Font.medium, fontSize: 14, marginTop: Spacing.md },
  ligne: {
    backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  nom: { color: theme.textPrimary, fontFamily: Font.semibold, fontSize: 15 },
  somme: { color: theme.textPrimary, fontFamily: Font.bold, fontSize: 17 },
  detail: { color: theme.textSecondary, fontSize: 13, lineHeight: 19 },
  note: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: Spacing.md },
})
