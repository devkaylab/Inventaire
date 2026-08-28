import { useCallback } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Redirect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getCompanyOverview, getMyAssignedStores } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'

/**
 * Magasins — les magasins du superviseur et leurs codes.
 *
 * Ce bloc vivait au milieu de « Mon profil », entre l'entreprise et les
 * balises. Il a son écran : on y vient pour relever un code, pas en passant.
 *
 * Deux choses corrigées au passage. Le nom du magasin s'affichait aligné à
 * droite et son code à gauche — le style servait aussi dans un tableau
 * clé/valeur, où l'alignement à droite est juste. Et le code, confidentiel,
 * était l'élément le plus voyant de l'écran, juste au-dessus de la phrase qui
 * demande de ne le montrer à personne : il passe derrière le nom.
 */
export default function StoresScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { profile } = useAuth()

  const { data: stores, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['my-stores'],
    queryFn: getMyAssignedStores,
  })

  /**
   * Qui tient chaque magasin — pour l'administrateur seulement.
   *
   * Il voit tous les magasins de son entreprise par construction ; ce qu'il
   * ne voyait nulle part dans l'application, c'est **lequel n'a personne pour
   * le tenir**. C'est la deuxième étape de son bandeau de démarrage, et c'est
   * ici qu'elle se règle.
   *
   * ⚠️ `supervisors` **ne le compte pas lui-même** (la RPC exclut les
   * administrateurs) : sinon chaque magasin paraîtrait encadré.
   */
  const estAdmin = !!profile?.is_company_admin
  const { data: apercu } = useQuery({
    queryKey: ['apercu-entreprise'],
    queryFn: getCompanyOverview,
    enabled: estAdmin,
  })
  const encadrement = new Map(
    (apercu?.stores ?? []).map(m => [m.id, m.supervisors.map(p => p.full_name).filter(Boolean) as string[]]),
  )

  /** Deux noms, puis « et N autres » — la règle du 23 août 2026. */
  function nommer(noms: string[]): string {
    if (noms.length <= 2) return noms.join(', ')
    return `${noms[0]}, ${noms[1]} et ${noms.length - 2} autre${noms.length - 2 > 1 ? 's' : ''}`
  }

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  /**
   * Transmettre un code magasin.
   *
   * Le code identifie le magasin ; les accès superviseur sont ouverts par
   * l'administrateur de l'entreprise (/equipe) — plus de demande publique
   * depuis le 21 août 2026. Il ne doit jamais circuler auprès des compteurs.
   */
  async function shareStoreCode(name: string, code: string) {
    try {
      await Share.share({
        message:
          `Code du magasin « ${name} » : ${code}\n\n` +
          'Ce code identifie le magasin dans Quantinvo. Les accès superviseur sont ouverts par ' +
          'l’administrateur de votre entreprise (page Mon équipe du site). ' +
          'Ce code est confidentiel : ne le communiquez pas aux compteurs.',
      })
    } catch (e) {
      signaler.erreur('Partage impossible', errorMessage(e))
    }
  }


  // Ces trois écrans sont le travail du superviseur. Ils vivent dans la pile de
  // « Mon compte » pour que la flèche de retour y ramène ; la garde de rôle,
  // que portait le groupe `(supervisor)`, se pose donc ici. Les RPC refusent
  // déjà un compteur côté serveur — ceci lui évite un écran en erreur.
  if (profile?.role !== 'supervisor') return <Redirect href="/(compte)/account" />

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxxl }} />
        ) : isError ? (
          // Une requête en échec n'est pas une liste vide. Sans cette
          // distinction, une coupure de réseau annonçait « Aucun magasin » à
          // quelqu'un qui en a — et l'envoyait réclamer un accès pour rien.
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Chargement impossible</Text>
            <Text style={styles.emptyText}>
              Vos magasins n&apos;ont pas pu être chargés. Vérifiez votre connexion, puis tirez
              vers le bas pour réessayer.
            </Text>
          </View>
        ) : (stores?.length ?? 0) === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>Aucun magasin</Text>
            <Text style={styles.emptyText}>
              {/* Un administrateur d'entreprise supervise tous les magasins de
                  son entreprise : s'il n'en voit aucun, c'est qu'elle n'en a
                  aucun. Lui parler d'affectation le renverrait à lui-même. */}
              {profile?.is_company_admin
                ? 'Votre entreprise n’a encore aucun magasin. Demandez à Quantinvo d’en ajouter un depuis la page Magasins du site.'
                : 'Vous n’êtes affecté à aucun magasin. L’administrateur de votre entreprise vous en affecte un depuis la page Mon équipe du site.'}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {stores!.map((s, i) => (
              <View key={s.id} style={[styles.storeRow, i > 0 && styles.storeRowSep]}>
                <View style={styles.storeLeft}>
                  <Text style={styles.storeName}>{s.name}</Text>
                  {estAdmin && encadrement.has(s.id) && (
                    encadrement.get(s.id)!.length > 0 ? (
                      <Text style={styles.encadrement} numberOfLines={1}>
                        {nommer(encadrement.get(s.id)!)}
                      </Text>
                    ) : (
                      // Une pastille, pas une phrase : c'est ce qu'on cherche
                      // du regard en parcourant la liste.
                      <Text style={styles.aPourvoir}>Aucun superviseur · à pourvoir</Text>
                    )
                  )}
                  <Text style={styles.codeLabel}>Code magasin</Text>
                  <Text style={[styles.code, tabular]}>{s.join_code ?? '—'}</Text>
                </View>
                {!!s.join_code && (
                  <Pressable
                    style={styles.shareBtn}
                    onPress={() => shareStoreCode(s.name, s.join_code!)}
                  >
                    <Text style={styles.shareBtnText}>Partager</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {estAdmin && (apercu?.stores ?? []).some(m => m.supervisors.length === 0) && (
              <Text style={styles.note}>
                Un magasin sans superviseur n&apos;a personne pour y lancer un inventaire.
                L&apos;accès s&apos;ouvre depuis la page Mon équipe du site : l&apos;application
                n&apos;a pas d&apos;écran d&apos;administration.
              </Text>
            )}
            <Text style={styles.note}>
              Ce code est confidentiel : ne le communiquez jamais aux compteurs. Les accès
              superviseur sont ouverts par l&apos;administrateur de votre entreprise, depuis le
              site.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },

    card: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    encadrement: { fontSize: 13, color: t.textMuted, fontFamily: Font.regular, marginTop: 2 },
    aPourvoir: {
      alignSelf: 'flex-start', marginTop: 4,
      fontSize: 11, fontFamily: Font.semibold, color: t.warning,
      backgroundColor: t.warningSoft, borderRadius: Radius.pill,
      paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
    },
    storeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    storeRowSep: {
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline,
      marginTop: Spacing.md, paddingTop: Spacing.md,
    },
    storeLeft: { flex: 1, minWidth: 0 },
    storeName: { fontSize: 15, color: t.textPrimary, fontFamily: Font.semibold },
    codeLabel: {
      fontSize: 10, fontFamily: Font.semibold, color: t.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.sm,
    },
    code: { fontSize: 17, color: t.accent, fontFamily: Font.bold, letterSpacing: 2, marginTop: 1 },

    shareBtn: {
      backgroundColor: t.accentSoft, borderRadius: Radius.md,
      paddingVertical: 12, paddingHorizontal: Spacing.lg,
    },
    shareBtnText: { color: t.accent, fontSize: 14, fontFamily: Font.semibold },

    note: {
      fontSize: 12, color: t.textMuted, lineHeight: 17, fontFamily: Font.regular,
      marginTop: Spacing.md, paddingTop: Spacing.md,
      borderTopWidth: 1, borderTopColor: t.hairline,
    },
    emptyTitle: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    emptyText: {
      fontSize: 13, color: t.textSecondary, fontFamily: Font.regular,
      lineHeight: 19, marginTop: Spacing.xs,
    },
  })
}
