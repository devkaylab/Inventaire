import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { getMyCompany } from '@/lib/queries'
import { oublierReperes } from '@/lib/reperes'
import { DeletionPendingNote, useAccountDeletion } from '@/components/AccountDeletion'
import { MenuCard, MenuRow, SectionLabel } from '@/components/ui/MenuList'
import { useTheme } from '@/lib/theme'
import { SITE_URL } from '@/constants/links'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { demander } from '@/lib/dialogue'

/**
 * Mon compte — la personne, puis ce qu'elle ouvre.
 *
 * Cet écran s'appelait « Mon profil » et servait de carrefour : identité,
 * entreprise, magasins et leurs codes, balises, inventaires, équipe,
 * déconnexion et suppression, empilés sur deux hauteurs d'écran. Le site a
 * démonté le même carrefour ; l'app suit, en gardant un seul point d'entrée.
 *
 * Ce qui reste ici : qui on est, et des lignes vers le reste. Les inventaires
 * n'y figurent plus — l'écran Sessions les liste déjà, c'était le doublon que
 * le site avait lui aussi retiré de « Mon compte ».
 *
 * **Un seul écran pour tous les rôles**, comme /account sur le site. Seul le
 * bloc « Mon travail » dépend du rôle : un compteur n'a ni magasins, ni
 * équipe, ni balises à imprimer. Sa sécurité et ses données, en revanche, sont
 * les mêmes que celles de n'importe qui — il n'y avait aucune raison qu'elles
 * restent réservées aux superviseurs.
 */

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function AccountScreen() {
  const { profile, session, signOut } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const suppression = useAccountDeletion()

  const { data: company } = useQuery({ queryKey: ['my-company'], queryFn: getMyCompany })


  const email = session?.user.email ?? '—'
  const superviseur = profile?.role === 'supervisor'
  const role = profile?.is_company_admin
    ? 'Administrateur'
    : superviseur ? 'Superviseur' : 'Compteur'

  /** Remet à zéro les repères de ce compte sur cet appareil. */

  async function confirmerReperes() {
    const ok = await demander({
      titre: 'Revoir les repères ?',
      texte: 'L’écran de bienvenue et les explications du premier scan réapparaîtront une fois, sur ce téléphone.',
      action: 'Revoir',
    })
    if (ok && profile?.id) void oublierReperes(profile.id)
  }


  async function confirmSignOut() {
    const ok = await demander({
      titre: 'Se déconnecter ?',
      texte: 'Vous devrez ressaisir votre mot de passe.',
      action: 'Se déconnecter',
      ton: 'danger',
    })
    if (ok) void signOut()
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile?.full_name ?? '?')}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name || 'Superviseur'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{role}</Text>
          </View>
          <Text style={styles.email}>{email}</Text>
          {!!company?.name && (
            <View style={styles.companyRow}>
              <Text style={styles.companyText}>
                <Text style={styles.companyName}>{company.name}</Text> · {role}
              </Text>
            </View>
          )}
        </View>

        {superviseur && (
          <>
            <SectionLabel>Mon travail</SectionLabel>
            <MenuCard>
              <MenuRow icon="magasin" label="Mes magasins" onPress={() => router.push('/(compte)/stores')} />
              <MenuRow icon="equipe" label="Mon équipe" onPress={() => router.push('/(compte)/team')} />
              <MenuRow icon="outils" label="Boîte à outils" onPress={() => router.push('/(compte)/tools')} last />
            </MenuCard>
          </>
        )}

        <SectionLabel>Mon compte</SectionLabel>
        <MenuCard>
          {/* Le nom, le mot de passe, la double authentification et la
              suppression vivent derrière cette ligne. Ce qui reste ici est
              sans conséquence. */}
          <MenuRow icon="profil" label="Mon profil" onPress={() => router.push('/(compte)/profile')} />
          <MenuRow icon="donnees" label="Télécharger mes données" onPress={() => router.push('/(compte)/my-data')} />
          {/* Les repères d'onboarding ne se montrent qu'une fois. Ils doivent
              rester retrouvables (règle Apple HIG, Things 3) — sans quoi une
              personne qui a touché « Plus tard » n'a plus aucun moyen d'y revenir. */}
          <MenuRow icon="reperes" label="Revoir les repères" onPress={confirmerReperes} />
          {/* ⚠️ En rouge, et c'est nouveau : elle est désormais la SEULE ligne
              colorée de l'écran. Tant que « Supprimer mon compte » était juste
              en dessous, deux rouges voisins n'auraient rien distingué — c'est
              d'ailleurs la suppression qu'on touchait en visant celle-ci
              (constat de Julien, 28 août 2026). Sans chevron : elle agit sur
              place, elle n'ouvre rien. */}
          <MenuRow
            icon="sortie"
            label="Se déconnecter"
            onPress={confirmSignOut}
            danger
            sansChevron
            last
          />
        </MenuCard>
        {suppression.pending && <DeletionPendingNote />}

        <Text style={styles.footNote}>
          Quantinvo — {SITE_URL.replace(/^https?:\/\//, '')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },

    identityCard: {
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
      borderWidth: 1,
      borderColor: t.hairline,
      alignItems: 'center',
      gap: Spacing.xs,
      ...t.shadowCard,
    },
    avatar: {
      width: 68, height: 68, borderRadius: 34, backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
    },
    avatarText: { fontSize: 26, fontFamily: Font.bold, color: t.onAccent },
    name: { fontSize: 20, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    roleBadge: {
      backgroundColor: t.accentSoft, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md, paddingVertical: 3,
    },
    roleBadgeText: {
      fontSize: 11, fontFamily: Font.bold, color: t.accent,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    email: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular, marginTop: 2 },
    companyRow: {
      alignSelf: 'stretch', marginTop: Spacing.md, paddingTop: Spacing.md,
      borderTopWidth: 1, borderTopColor: t.hairline, alignItems: 'center',
    },
    companyText: { fontSize: 13, color: t.textSecondary, fontFamily: Font.medium },
    companyName: { color: t.textPrimary, fontFamily: Font.semibold },

    footNote: {
      fontSize: 11, color: t.textMuted, fontFamily: Font.regular,
      textAlign: 'center', marginTop: Spacing.lg,
    },
  })
}
