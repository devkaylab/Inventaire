import { useCallback } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Redirect, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelMyInvitation, getMyTeamByStore, removeCounterFromStore,
  type TeamCounter, type TeamInvite, type TeamStore,
} from '@/lib/queries'
import { SectionLabel } from '@/components/ui/MenuList'
import { errorMessage } from '@/lib/errors'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { CroixIcon } from '@/components/ui/Icones'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

/**
 * Mon équipe — les compteurs du superviseur, rangés par magasin.
 *
 * Même source que la page « Mon équipe » du site (`my_team_by_store`) : deux
 * écrans qui montrent la même chose doivent la demander de la même façon.
 * L'ancienne liste du profil affichait tous les profils visibles, y compris
 * les co-superviseurs ; ceux-ci se gèrent depuis le site, par l'administrateur
 * de l'entreprise.
 */

/** Nom lisible d'une invitation : la RPC rend prénom et nom, jamais `full_name`. */
function nomInvite(inv: TeamInvite) {
  return [inv.first_name, inv.last_name].filter(Boolean).join(' ').trim()
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function TeamScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['my-team'],
    queryFn: getMyTeamByStore,
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  /**
   * Retirer un compteur — d'un magasin, jamais de tous.
   *
   * Même règle que le site : une même personne peut compter dans plusieurs
   * magasins, supervisés par des personnes différentes. La confirmation nomme
   * donc la personne **et** le magasin, pour qu'on sache exactement ce qu'on
   * retire.
   */
  const handleRemoveCounter = useCallback((counter: TeamCounter, store: TeamStore) => {
    const nom = counter.full_name || counter.email || 'ce compteur'
    Alert.alert(
      `Retirer ${nom} ?`,
      `${nom} n'aura plus accès aux inventaires de ${store.name}. Ses comptages déjà enregistrés sont conservés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCounterFromStore(counter.id, store.id)
              await queryClient.invalidateQueries({ queryKey: ['my-team'] })
            } catch (e) {
              Alert.alert('Retrait impossible', errorMessage(e))
            }
          },
        },
      ],
    )
  }, [queryClient])

  const stores = data?.stores ?? []
  const invitations = data?.invitations ?? []
  const sansMagasin = stores.length === 0
  const personne = stores.every((s) => s.counters.length === 0) && invitations.length === 0

  function handleCancelInvite(inv: TeamInvite) {
    Alert.alert(
      'Annuler l’invitation ?',
      `${nomInvite(inv) || inv.email} ne pourra plus créer son compte.`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler l’invitation',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMyInvitation(inv.id)
              await queryClient.invalidateQueries({ queryKey: ['my-team'] })
            } catch (e) {
              Alert.alert('Erreur', errorMessage(e))
            }
          },
        },
      ],
    )
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
          // Même règle que les magasins : un échec n'est pas une équipe vide.
          <Text style={styles.empty}>
            Votre équipe n&apos;a pas pu être chargée. Vérifiez votre connexion, puis tirez vers le
            bas pour réessayer.
          </Text>
        ) : (
          <>
            {personne && (
              <Text style={styles.empty}>
                {/* L'équipe se lit magasin par magasin, et un magasin n'apparaît
                    que si l'on en est superviseur. Un administrateur
                    d'entreprise qui n'en supervise aucun ne verrait rien, sans
                    comprendre pourquoi. */}
                {sansMagasin
                  ? profile?.is_company_admin
                    ? 'Votre entreprise n’a encore aucun magasin, et une équipe se lit magasin par magasin. Demandez à Quantinvo d’en ajouter un depuis la page Magasins du site.'
                    : 'Aucun magasin ne vous est affecté. L’administrateur de votre entreprise vous en affecte un depuis la page Mon équipe du site.'
                  : 'Personne dans votre équipe pour l’instant. Ajoutez un compteur : il recevra une invitation par e-mail.'}
              </Text>
            )}

            {stores.map((store) => (
              <View key={store.id} style={styles.block}>
                <SectionLabel>{store.name}</SectionLabel>
                {store.counters.length === 0 ? (
                  <Text style={styles.empty}>Aucun compteur pour ce magasin.</Text>
                ) : (
                  store.counters.map((c) => (
                    <CounterRow
                      key={c.id}
                      counter={c}
                      styles={styles}
                      onRemove={() => handleRemoveCounter(c, store)}
                    />
                  ))
                )}
              </View>
            ))}

            {invitations.length > 0 && (
              <View style={styles.block}>
                <SectionLabel>Invitations en attente</SectionLabel>
                {invitations.map((inv) => (
                  <View key={inv.id} style={[styles.row, styles.rowPending]}>
                    <View style={[styles.avatar, styles.avatarPending]}>
                      <Text style={styles.avatarTextPending}>
                        {initials(nomInvite(inv) || inv.email)}
                      </Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.name}>{nomInvite(inv) || inv.email}</Text>
                      <Text style={styles.meta}>{inv.email}</Text>
                    </View>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>En attente</Text>
                    </View>
                    <Pressable style={styles.cancelBtn} onPress={() => handleCancelInvite(inv)} hitSlop={6}>
                      <CroixIcon color={theme.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {!sansMagasin && (
              <Pressable style={styles.addBtn} onPress={() => router.push('/(compte)/new-member')}>
                <Text style={styles.addBtnText}>Ajouter un membre</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function CounterRow({
  counter,
  styles,
  onRemove,
}: {
  counter: TeamCounter
  styles: ReturnType<typeof makeStyles>
  onRemove: () => void
}) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(counter.full_name || counter.email || '?')}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name}>{counter.full_name || counter.email || 'Sans nom'}</Text>
        <Text style={styles.meta}>
          {counter.sessions_counted > 0
            ? `${counter.sessions_counted} inventaire${counter.sessions_counted > 1 ? 's' : ''} compté${counter.sessions_counted > 1 ? 's' : ''}`
            : 'Compteur'}
        </Text>
      </View>
      {!counter.is_active && (
        <View style={styles.offBadge}>
          <Text style={styles.offBadgeText}>Accès retiré</Text>
        </View>
      )}
      {/* « Accès retiré » dit un état, « Retirer » déclenche une action : même
          distinction que sur la fiche d'un inventaire — l'étiquette est
          neutre, l'action est du texte rouge. */}
      <Pressable style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
        <Text style={styles.removeBtnText}>Retirer</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
    block: { gap: Spacing.sm },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    rowPending: { borderStyle: 'dashed', borderColor: t.borderStrong, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
    rowText: { flex: 1, minWidth: 0 },
    avatar: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: t.accentSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarPending: { backgroundColor: t.warningSoft },
    avatarText: { fontSize: 13, fontFamily: Font.bold, color: t.accent },
    avatarTextPending: { fontSize: 13, fontFamily: Font.bold, color: t.warning },
    name: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
    meta: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, marginTop: 1 },

    pendingBadge: {
      backgroundColor: t.warningSoft, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3,
    },
    pendingBadgeText: {
      fontSize: 10, fontFamily: Font.bold, color: t.warning,
      textTransform: 'uppercase', letterSpacing: 0.4,
    },
    offBadge: {
      backgroundColor: t.accentSoft, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3,
    },
    offBadgeText: { fontSize: 10, fontFamily: Font.bold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

    cancelBtn: {
      width: 28, height: 28, borderRadius: 14, backgroundColor: t.dangerSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    removeBtn: { paddingHorizontal: 4, paddingVertical: 4 },
    removeBtnText: { fontSize: 13, color: t.danger, fontFamily: Font.semibold },

    empty: { fontSize: 13, color: t.textMuted, fontFamily: Font.regular, lineHeight: 19, marginLeft: 2 },

    addBtn: {
      backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: 14,
      alignItems: 'center', ...t.shadowButton,
    },
    addBtnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
  })
}
