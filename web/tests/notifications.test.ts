// Notifications, message à l'administrateur, recherche globale (30 août 2026)
// — les trois systèmes nés avec le tableau de bord d'atterrissage, et ce que
// leur construction ne doit pas perdre.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

/**
 * Le code sans ses commentaires.
 *
 * ⚠️ UNE GARDE D'ABSENCE SE LIT ELLE-MÊME SANS ÇA — dixième fois sur ce
 * dépôt. Le commentaire de l'état vide CITE « dans la barre de gauche »
 * précisément pour dire qu'on ne l'écrit plus.
 */
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
const migration = lire('../../supabase/migrations/20260830110001_notifications.sql')
const migrationQuantinvo = lire('../../supabase/migrations/20260830140001_message_quantinvo.sql')
const cloche = lire('../components/Notifications.tsx')
const shell = lire('../components/AppShell.tsx')
const edge = lire('../../supabase/functions/message-admin/index.ts')
const recherche = lire('../components/dashboard/RechercheGlobale.tsx')
const tableau = lire('../app/dashboard/page.tsx')
const boite = lire('../app/messages/page.tsx')
const migrationFils = lire('../../supabase/migrations/20260830160001_fils_de_messages.sql')
const migrationVoix = lire('../../supabase/migrations/20260830170001_quantinvo_ne_se_nomme_pas.sql')

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
  /**
   * ⚠️ CETTE GARDE A CHANGÉ D'OBJET LE 7 SEPTEMBRE 2026, ET ELLE N'A PAS ÉTÉ
   * AFFAIBLIE. Elle défendait « le bouton d'écriture vit dans le rail » ; ce
   * qu'elle défend vraiment, c'est **qui peut ouvrir un fil, et vers qui** —
   * chacun écrit un cran au-dessus, et le destinataire se déduit du profil.
   * Cette règle-là n'a pas bougé d'un pouce, elle a seulement déménagé du
   * rail vers la page.
   *
   * Ce qui a changé : le rail ne porte plus qu'une PORTE vers la boîte, à
   * côté de la cloche. L'ancien bouton dessinait le même tracé que l'onglet
   * Messages, au caractère près — deux bulles identiques dans la même
   * colonne (constat de Julien).
   */
  it('⚠️ chacun écrit un cran au-dessus, et c’est la page qui le sait', () => {
    expect(boite).toContain("guard.profile.role === 'supervisor' && !guard.profile.is_admin")
    // L'administrateur Quantinvo n'a personne au-dessus : il répond, il
    // n'ouvre pas de fil.
    expect(boite).toContain('peutEcrire')
    expect(boite).toContain('const versQuantinvo = guard.status === \'ready\' && guard.profile.is_company_admin')
    expect(migration).toContain('vous_etes_administrateur')
  })

  it('⚠️ le courrier est à côté de la cloche, et il n’y est qu’une fois', () => {
    // Demande de Julien, 7 septembre 2026 : « il faut placer l'icône messages
    // proche de la cloche ». Ce qui ARRIVE se lit en bas du rail — le
    // courrier, puis les notifications, puis soi.
    const rail = shell.slice(shell.indexOf('className="rail-fin"'))
    expect(rail.indexOf('href="/messages"')).toBeGreaterThan(-1)
    expect(rail.indexOf('href="/messages"')).toBeLessThan(rail.indexOf('<Notifications />'))
    // ⚠️ ET IL A QUITTÉ LES ONGLETS DU MILIEU : ceux-là nomment des LIEUX DE
    // TRAVAIL. Le laisser aux deux endroits, c'est le doublon qu'on ferme.
    const onglets = shell.split('export function ongletsPour')[1]?.split('\n}\n')[0] ?? ''
    expect(code(onglets), 'le courrier n’est pas un lieu de travail').not.toContain("'/messages'")
    expect(code(shell), 'la modale du rail a disparu').not.toContain('MessageAdmin')
    expect(tableau).not.toContain('MessageAdmin')
  })

  it('⚠️ écrire prend la place du fil, pas une fenêtre par-dessus', () => {
    // C'est ce qui rend la fusion vraie (demande de Julien, 7 septembre 2026 :
    // « fusionner boîte de réception et boîte d'envoi sur la même page »). Une
    // modale flotte AU-DESSUS : on serait toujours à deux endroits. En
    // occupant le panneau de droite, la liste des conversations reste
    // visible — de quoi remarquer qu'un fil sur le même sujet existe déjà.
    expect(boite).toContain('boite-redaction')
    expect(code(boite), 'une modale remettrait l’écriture ailleurs que la lecture')
      .not.toContain('modal-backdrop')
    // Le panneau n'a qu'un occupant : ouvrir un fil ferme la rédaction.
    expect(boite).toContain('setRedaction(false)')
  })

  it('⚠️ l’état vide ne renvoie plus vers le rail', () => {
    // Il y disait « le bouton d'écriture est dans la barre de gauche » —
    // devenu faux. Et c'est le seul endroit où la liste, donc son bouton,
    // n'existe pas : il s'y repose.
    expect(code(boite), 'la phrase désigne un bouton qui n’est plus là')
      .not.toContain('dans la barre de gauche')
    // Le bouton apparaît DEUX fois : en tête de liste, et dans l'état vide.
    expect(boite.split('Nouveau message').length - 1).toBeGreaterThanOrEqual(2)
  })

  it('⚠️ le bouton d’en-tête dit toujours la même chose', () => {
    // Une première version le faisait basculer en « Annuler » pendant la
    // rédaction, alors que le formulaire en portait déjà un à trente
    // centimètres de là. L'annulation appartient à la rangée d'actions.
    const tete = boite.slice(boite.indexOf('boite-liste-tete'), boite.indexOf('{fils.map('))
    expect(code(tete), 'un bouton d’en-tête qui change de sens selon l’état')
      .not.toContain('Annuler')
    expect(boite).toContain('boite-redaction-actions')
  })

  it('⚠️ le canal se choisit sur le PROFIL, jamais sur la requête', () => {
    // Un client qui pourrait nommer son destinataire écrirait à qui il veut.
    // L'edge lit le profil avec le jeton de l'appelant et route ; les deux
    // RPC portent chacune leur garde de rôle.
    expect(edge).toContain("caller.rpc('repondre_fil'")
    expect(edge).toContain("caller.rpc('ouvrir_fil'")
    // La portée d'un fil neuf se déduit du profil, dans la fonction.
    expect(migrationFils).toContain("case when v_profil.is_company_admin then 'quantinvo' else 'entreprise' end")
  })

  it('l’auteur d’un message reste lisible après son départ', () => {
    // Libellé figé, comme les journaux : un fil survit à un compte supprimé.
    expect(migrationFils).toContain('auteur_label text not null')
    expect(migrationFils).toContain('on delete set null')
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
    expect(migrationFils).toContain("jsonb_build_object('success', true, 'fil_id', v_fil, 'destinataires', n)")
    expect(edge).not.toMatch(/json\(\{[^)]*adresses/)
  })

  it('les bornes refusent, elles ne tronquent pas — et l’écran les connaît', () => {
    expect(migrationFils).toContain('message_trop_long')
    expect(migrationFils).not.toContain('left(v_msg')
    expect(boite).toContain('maxLength={120}')
    expect(boite).toContain('maxLength={2000}')
  })

  it('l’edge injoignable retombe sur la RPC directe', () => {
    // Le message passe alors sans e-mail, plutôt que de ne pas passer — à
    // l'ouverture comme à la réponse.
    expect(boite).toContain("rpc('ouvrir_fil'")
    expect(boite).toContain("rpc('repondre_fil'")
  })

  it('la réponse va à l’expéditeur — sauf quand Quantinvo écrit à un client', () => {
    // Règle amendée le 30 août 2026, e-mail réel à l'appui : entre deux
    // personnes du produit, on se répond directement ; quand c'est nous qui
    // écrivons à un client, c'est l'adresse de contact — pas la boîte
    // personnelle d'un administrateur.
    expect(edge).toContain('const adresseExpediteur = versClient')
    expect(edge).toContain('(userData.user.email ?? \'\')')
  })
})

describe('la boîte de réception', () => {
  it('⚠️ une boîte, c’est une conversation — on répond', () => {
    // Le premier jet listait des cartes en lecture seule. Constat de Julien :
    // « je ne peux rien faire avec ». Un fil, des messages empilés, une
    // réponse qui revient à l'expéditeur.
    expect(migrationFils).toContain('create table public.message_fils')
    expect(migrationFils).toContain('create or replace function public.repondre_fil')
    expect(boite).toContain("rpc('mes_fils')")
    expect(boite).toContain('fil-repondre')
    expect(boite).toContain('Répondre')
  })

  it('⚠️ puisqu’on répond, tout le monde a une boîte', () => {
    // Le « il écrit sans recevoir » du premier jet tombe avec le bouton
    // Répondre : un superviseur lit la réponse de son administrateur.
    // ⚠️ La boîte se joignait par un onglet ; elle se joint depuis le
    // 7 septembre 2026 par le rang du rail, posé pour TOUS les rôles — donc
    // sans condition. C'est plus fort que ce que cette garde vérifiait : un
    // onglet dépendait du rôle, le rang du rail non.
    const rail = shell.slice(shell.indexOf('className="rail-fin"'))
    expect(rail).toContain('href="/messages"')
    expect(rail.slice(0, rail.indexOf('href="/messages"')), 'la boîte serait réservée à certains')
      .not.toContain('profile.role ===')
    expect(boite).not.toContain("window.location.replace('/dashboard')")
  })

  it('⚠️ la garde d’une réponse est l’appartenance au fil, rien d’autre', () => {
    // Pas de rôle, pas d'entreprise : on répond à qui vous a écrit.
    const rep = migrationFils.slice(migrationFils.indexOf('function public.repondre_fil'))
    expect(rep).toContain('from public.message_participants p')
    expect(rep).toContain("raise exception 'forbidden'")
  })

  it('⚠️ ouvrir UN fil ne lit que lui', () => {
    // Les autres fils gardent leur pastille, et les invitations à un
    // inventaire ne sont pas concernées : leur lecture vit dans la cloche.
    const ouvre = migrationFils.slice(migrationFils.indexOf('function public.ouvrir_message_fil'))
    expect(ouvre).toContain('where fil_id = p_fil and user_id = v_uid')
    expect(boite).toContain("rpc('ouvrir_message_fil'")
  })

  it('⚠️ Quantinvo parle d’une seule voix, PARTOUT', () => {
    // Défaut vu sur un e-mail réel (30 août 2026) : la règle n'était tenue
    // que par la liste des fils — le message, la cloche et l'e-mail
    // nommaient l'administrateur et donnaient son adresse personnelle.
    // Quatre surfaces, un seul masque.
    const masque = (migrationVoix.match(/then 'Quantinvo'/g) ?? []).length
    expect(masque, 'liste, dernier auteur, fil ouvert, cloche').toBeGreaterThanOrEqual(4)
    // ⚠️ Le masque se pose à la LECTURE : entre nous, le vrai nom reste —
    // on doit savoir quel collègue a répondu.
    expect(migrationVoix).toContain('and not v_admin')
    // Et il survit à la suppression du compte : le drapeau est figé à
    // l'écriture, une jointure sur profiles rendrait null et démasquerait.
    expect(migrationVoix).toContain('add column auteur_interne boolean not null default false')
  })

  it('⚠️ l’e-mail ne donne pas l’adresse personnelle de qui répond', () => {
    // Un client répondrait dans une boîte privée. Quand c'est nous qui
    // écrivons à un client, le reply_to est l'adresse de contact.
    expect(edge).toContain('const versClient = fil?.portee === \'quantinvo\' && jeSuisQuantinvo')
    expect(edge).toContain("? 'Quantinvo'")
    expect(edge).toContain('adresseDeContact()')
    expect(edge).toContain('reply_to: adresseExpediteur || undefined')
  })

  it('une réponse rappelle son sujet', () => {
    // Sans lui, on ne sait pas de quelle conversation il s'agit sans cliquer.
    expect(edge).toContain('`Réponse de ${nomExpediteur} — ${sujetFil}`')
    expect(edge).toContain("intitule: 'Sujet', valeur: sujetFil")
  })

  it('⚠️ la fonction qui sert l’e-mail n’est pas appelable par un client', () => {
    // Elle rend des identifiants de participants : le serveur seul.
    expect(migrationVoix).toContain('revoke execute on function public.fil_pour_email(uuid) from public, anon, authenticated;')
    expect(migrationVoix).toContain('grant execute on function public.fil_pour_email(uuid) to service_role;')
  })

  it('la notification mène au fil, et la cloche compte les non lus', () => {
    expect(cloche).toContain("`/messages?fil=${d.fil_id}`")
    expect(migrationFils).toContain("'message'::text as type")
  })

  it('les fonctions reposent leurs droits, la purge emporte le fil entier', () => {
    expect(migrationFils).toContain('revoke execute on function public.ouvrir_fil(text, text) from public, anon;')
    expect(migrationFils).toContain('revoke execute on function public.repondre_fil(uuid, text) from public, anon;')
    expect(migrationFils).toContain('revoke execute on function public.mes_fils() from public, anon;')
    // Sur la date du DERNIER message : une conversation vivante ne perd pas
    // son début.
    expect(migrationFils).toContain('delete from public.message_fils where dernier_le < now() - messages_ttl;')
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
