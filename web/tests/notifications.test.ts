// Notifications, message à l'administrateur, recherche globale (30 août 2026)
// — les trois systèmes nés avec le tableau de bord d'atterrissage, et ce que
// leur construction ne doit pas perdre.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260830110001_notifications.sql')
const migrationQuantinvo = lire('../../supabase/migrations/20260830140001_message_quantinvo.sql')
const cloche = lire('../components/Notifications.tsx')
const shell = lire('../components/AppShell.tsx')
const message = lire('../components/dashboard/MessageAdmin.tsx')
const edge = lire('../../supabase/functions/message-admin/index.ts')
const recherche = lire('../components/dashboard/RechercheGlobale.tsx')
const tableau = lire('../app/dashboard/page.tsx')
const boite = lire('../app/messages/page.tsx')
const migrationBoite = lire('../../supabase/migrations/20260830150001_boite_de_reception.sql')

describe('les notifications', () => {
  it('⚠️ la table ne s’écrit jamais depuis le client', () => {
    // Les lignes naissent dans des déclencheurs et des RPC SECURITY DEFINER.
    // Une policy UPDATE ouvrirait `donnees` à son porteur ; marquer lu passe
    // par une RPC.
    expect(migration).toContain('for select')
    expect(migration).not.toContain('for insert')
    expect(migration).not.toContain('for update')
    expect(migration).not.toContain('for delete')
  })

  it('« compte activé » suit la définition d’is_active, pas une autre', () => {
    // my_team_by_store dit actif = last_sign_in_at non nul : la notification
    // se déclenche exactement sur cette transition. Deux définitions du même
    // mot, c'est le contresens « Accès retiré » du 23 août qui revient.
    expect(migration).toContain('old.last_sign_in_at is null and new.last_sign_in_at is not null')
  })

  it('on ne se notifie pas soi-même', () => {
    expect(migration).toContain('new.user_id = auth.uid() or new.user_id = v_session.created_by')
    expect(migration).toContain("ss.user_id <> new.id")
  })

  it('la cloche vit dans le rail, pas sur une page', () => {
    // L'administrateur d'entreprise reçoit les messages de ses superviseurs
    // et n'atterrit jamais sur /dashboard : seul le rail est partout.
    expect(shell).toContain('<Notifications />')
    expect(tableau).not.toContain('<Notifications')
  })

  it('ouvrir la cloche marque lu, par la RPC', () => {
    expect(cloche).toContain("rpc('marquer_notifications_lues')")
  })

  it('la purge les nettoie à 90 jours', () => {
    expect(migration).toContain("notifications_ttl    constant interval := interval '90 days'")
    expect(migration).toContain('notifications_supprimees')
  })

  it('les fonctions reposent leurs droits dans la même migration', () => {
    // `create or replace` rend EXECUTE à PUBLIC — et les fonctions de
    // déclencheur n'ont aucune raison d'être appelables (leçon du 28 août).
    expect(migration).toContain('revoke execute on function public.notifier_ajout_inventaire() from public, anon, authenticated;')
    expect(migration).toContain('revoke execute on function public.notifier_premiere_connexion() from public, anon, authenticated;')
    expect(migration).toContain('revoke execute on function public.deposer_message_admin(text, text) from public, anon;')
  })
})

describe('le message à l’administrateur', () => {
  it('le bouton vit dans le rail, à côté de la cloche — chacun écrit un cran au-dessus', () => {
    // Demande de Julien, 30 août 2026 : écrire à qui l'on rend compte ne
    // dépend pas de la page. Le superviseur écrit à son administrateur,
    // l'administrateur d'entreprise à Quantinvo ; l'administrateur Quantinvo
    // n'a personne au-dessus — pas de bouton.
    expect(shell).toContain("profile.role === 'supervisor' && !profile.is_admin && (")
    expect(shell).toContain("destinataire={profile.is_company_admin ? 'quantinvo' : 'entreprise'}")
    const rail = shell.slice(shell.indexOf('className="rail-fin"'))
    expect(rail.indexOf('<MessageAdmin')).toBeGreaterThan(-1)
    expect(rail.indexOf('<MessageAdmin')).toBeLessThan(rail.indexOf('<Notifications />'))
    expect(tableau).not.toContain('MessageAdmin')
    expect(migration).toContain('vous_etes_administrateur')
  })

  it('⚠️ le canal se choisit sur le PROFIL, jamais sur la requête', () => {
    // Un client qui pourrait nommer son destinataire écrirait à qui il veut.
    // L'edge lit le profil avec le jeton de l'appelant et route ; les deux
    // RPC portent chacune leur garde de rôle.
    expect(edge).toContain("versQuantinvo ? 'deposer_message_quantinvo' : 'deposer_message_admin'")
    expect(edge.indexOf("select('is_company_admin')")).toBeLessThan(edge.indexOf('deposer_message_quantinvo'))
    expect(migrationQuantinvo).toContain('not coalesce(v_profil.is_company_admin, false)')
  })

  it('le canal Quantinvo repose ses droits et fige l’entreprise', () => {
    expect(migrationQuantinvo).toContain('revoke execute on function public.deposer_message_quantinvo(text, text) from public, anon;')
    expect(migrationQuantinvo).toContain("'entreprise', coalesce(v_cie, '')")
    // Et la cloche sait présenter le nouveau type.
    expect(cloche).toContain("'message_entreprise'")
  })

  it('⚠️ l’edge dépose avec le jeton de l’appelant, la clé de service ne sert qu’après', () => {
    // Règle de ca-request-store : le service_role lit les adresses pour
    // l'e-mail, il n'écrit jamais la demande.
    const depot = edge.indexOf('caller.rpc(')
    const service = edge.indexOf('createClient(url, serviceKey)')
    expect(depot).toBeGreaterThan(-1)
    expect(service).toBeGreaterThan(-1)
    expect(depot).toBeLessThan(service)
  })

  it('aucune adresse d’administrateur ne redescend au client', () => {
    // La RPC ne rend qu'un compte ; les adresses lues par l'edge servent à
    // l'envoi et ne figurent dans aucune de ses réponses JSON.
    expect(migration).toContain("jsonb_build_object('success', true, 'destinataires', n)")
    expect(edge).not.toMatch(/json\(\{[^)]*adresses/)
  })

  it('les bornes refusent, elles ne tronquent pas — et l’écran les connaît', () => {
    expect(migration).toContain('message_trop_long')
    expect(migration).not.toContain('left(v_msg')
    expect(message).toContain('maxLength={120}')
    expect(message).toContain('maxLength={2000}')
  })

  it('l’edge injoignable retombe sur la RPC directe', () => {
    // Le message passe alors sans e-mail, plutôt que de ne pas passer — et le
    // repli suit le même canal que l'edge.
    expect(message).toContain("versQuantinvo ? 'deposer_message_quantinvo' : 'deposer_message_admin'")
  })

  it('la réponse va à l’expéditeur, pas à une boîte de service', () => {
    expect(edge).toContain('reply_to: userData.user.email')
  })
})

describe('la boîte de réception', () => {
  it('un message se lit en entier, pas seulement en notification', () => {
    // Constat de Julien au premier message réel : la cloche annonce et
    // tronque, rien ne permettait d'ouvrir. Le rang mène à la boîte.
    expect(cloche).toContain("lien: '/messages'")
    expect(boite).toContain("rpc('mes_messages')")
    // Un message est un texte : ses retours à la ligne comptent.
    expect(lire('../app/globals.css')).toContain('.msg-corps {')
    expect(lire('../app/globals.css')).toContain('white-space: pre-line')
  })

  it('elle est réservée à qui reçoit', () => {
    // Un superviseur ordinaire écrit, il ne reçoit pas : l'écran serait vide
    // à jamais. La garde le renvoie chez lui.
    expect(boite).toContain('guard.profile.is_company_admin || !!guard.profile.is_admin')
    expect(boite).toContain("window.location.replace('/dashboard')")
    // Et le rail ne l'offre qu'aux deux profils concernés.
    const onglets = shell.split('export function ongletsPour')[1]?.split('\n}\n')[0] ?? ''
    const superviseur = onglets.split('profile.is_company_admin')[1]?.split('return [')[2] ?? ''
    expect(superviseur).not.toContain("'/messages'")
    expect(onglets).toContain("{ href: '/messages', label: 'Messages' }")
  })

  it('⚠️ ouvrir la boîte ne marque QUE les messages', () => {
    // Une invitation à un inventaire garde son point tant que la cloche ne
    // l'a pas montrée : deux gestes de lecture, deux portées.
    expect(migrationBoite).toContain("and type in ('message_superviseur', 'message_entreprise')")
    expect(boite).toContain("rpc('marquer_messages_lus')")
  })

  it('les deux fonctions reposent leurs droits', () => {
    expect(migrationBoite).toContain('revoke execute on function public.mes_messages() from public, anon;')
    expect(migrationBoite).toContain('revoke execute on function public.marquer_messages_lus() from public, anon;')
  })
})

describe('la recherche globale', () => {
  it('n’ouvre aucune surface serveur nouvelle', () => {
    // Elle interroge les deux RPC que les pages utilisent déjà, une fois au
    // premier focus, puis filtre sur place.
    expect(recherche).toContain('getAccessibleSessions')
    expect(recherche).toContain("rpc('my_team_by_store')")
    expect(recherche).not.toContain("rpc('recherche")
  })

  it('vit sur le tableau de bord', () => {
    expect(tableau).toContain('<RechercheGlobale />')
  })
})
