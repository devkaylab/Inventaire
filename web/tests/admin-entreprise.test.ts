// Administrateur d'entreprise — tests de garde.
//
// Ce que ces tests empêchent de défaire : le verrou anti-élévation sur le
// nouveau drapeau, l'exigence de double authentification dans la garde,
// la policy d'invitations restreinte aux compteurs (le trou d'élévation
// fermé par la migration 2), la journalisation de chaque écriture, et la
// purge du journal d'entreprise.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../lib/journal'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const m1 = lire('../../supabase/migrations/20260820190001_admin_entreprise_drapeau.sql')
const m2 = lire('../../supabase/migrations/20260820190002_invitations_avec_role.sql')
const m3 = lire('../../supabase/migrations/20260820190003_fonctions_admin_entreprise.sql')
const m4 = lire('../../supabase/migrations/20260820190004_admin_gere_admin_entreprise.sql')
const pageEquipe = lire('../app/equipe/page.tsx')
// Le bloc de nomination a suivi le détail de l'entreprise sur sa fiche
// (découpage de la console du 21 août 2026).
const ficheEntreprise = lire('../app/admin/entreprise/[companyId]/page.tsx')
const mRole = lire('../../supabase/migrations/20260823120001_ca_changer_le_role.sql')

describe('le drapeau et sa garde (migration 1)', () => {
  it('le verrou anti-élévation fige le nouveau drapeau', () => {
    const corps = m1.split('profiles_pin_privileged_columns()')[1] ?? ''
    expect(corps).toContain('new.is_company_admin := old.is_company_admin')
    // SECURITY INVOKER obligatoire : en DEFINER, current_user vaudrait le
    // propriétaire et le garde-fou ne s'appliquerait jamais.
    expect(corps.split('$$;')[0]).not.toMatch(/security definer/i)
  })

  it('la garde exige aal2 dès qu’un facteur TOTP vérifié existe', () => {
    const corps = m2 + m1.split('function public.is_company_admin(')[1]
    expect(corps).toContain("coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'")
    expect(corps).toContain('auth.mfa_factors')
    expect(corps).toContain("f.status = 'verified'")
  })

  it('anon ne peut pas exécuter la garde', () => {
    expect(m1).toMatch(/revoke all on function public\.is_company_admin\(uuid\) from public, anon/)
  })
})

describe('invitations avec rôle (migration 2)', () => {
  it('restreint la policy des superviseurs aux invitations de compteurs', () => {
    // Sans cette restriction, un superviseur écrirait lui-même une invitation
    // 'company_admin' que handle_new_user honorerait : élévation de privilège.
    const policy = m2.split('create policy team_invitations_supervisor')[1]?.split(';')[0] ?? ''
    expect(policy).toContain("using ((get_my_role() = 'supervisor') and (company_id = get_my_company()) and (role = 'employee'))")
    expect(policy).toContain("with check ((get_my_role() = 'supervisor') and (company_id = get_my_company()) and (role = 'employee'))")
  })

  it('traite les invitations privilégiées avant celles d’inventaire', () => {
    const corps = m2.split('function public.handle_new_user(')[1] ?? ''
    const privilegiee = corps.indexOf("v_team.role in ('supervisor', 'company_admin')")
    const session = corps.indexOf('v_session_count > 0')
    expect(privilegiee).toBeGreaterThan(-1)
    expect(session).toBeGreaterThan(privilegiee)
  })

  it('repose les droits après create or replace', () => {
    expect(m2).toMatch(/revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/)
  })
})

describe('fonctions de l’administrateur d’entreprise (migration 3)', () => {
  const ECRITURES = ['ca_invite_supervisor', 'ca_set_supervisor_stores', 'ca_remove_supervisor', 'ca_cancel_invitation']

  it('chaque écriture est gardée et journalisée', () => {
    for (const fn of ECRITURES) {
      const corps = m3.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''
      expect(corps, `${fn} doit vérifier is_company_admin`).toContain('is_company_admin()')
      expect(corps, `${fn} doit appeler log_company_action`).toContain('log_company_action')
    }
  })

  it('n’avale pas les erreurs d’écriture du journal', () => {
    const corps = m3.split('function public.log_company_action(')[1]?.split('$$;')[0] ?? ''
    expect(corps).not.toMatch(/exception\s+when/i)
  })

  it('interdit l’écriture du journal aux clients', () => {
    expect(m3).toContain('create policy company_audit_log_select')
    expect(m3).not.toMatch(/create policy .* on public\.company_audit_log[\s\S]*?for (insert|update|delete)/i)
    expect(m3).toMatch(/revoke all on function public\.log_company_action[\s\S]*?from public, anon, authenticated/)
  })

  it('cloisonne : chaque fonction relit l’entreprise de l’appelant, jamais un paramètre', () => {
    for (const fn of ECRITURES) {
      const corps = m3.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''
      expect(corps, `${fn} doit déduire l'entreprise de l'appelant`)
        .toContain('select company_id into v_company from public.profiles where id = auth.uid()')
    }
  })

  it('purge le journal d’entreprise à un an', () => {
    const purge = m3.split('function public.purge_expired_data(')[1] ?? ''
    expect(purge).toContain("journal_entrep_ttl   constant interval := interval '1 year'")
    expect(purge).toContain('delete from public.company_audit_log')
  })

  it('anon n’exécute aucune fonction du chantier', () => {
    for (const fn of [...ECRITURES, 'ca_list_team']) {
      expect(m3, `${fn} doit être révoquée à anon`).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`))
    }
  })
})

describe('nomination par Quantinvo (migration 4)', () => {
  it('les deux fonctions admin sont journalisées', () => {
    for (const fn of ['admin_invite_company_admin', 'admin_revoke_company_admin']) {
      const corps = m4.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''
      expect(corps, `${fn} doit appeler log_admin_action`).toContain('log_admin_action')
      expect(corps, `${fn} doit vérifier is_admin`).toContain('is_admin()')
    }
  })
})

describe('écrans', () => {
  it('« Mon équipe » ne passe que par les RPC gardées', () => {
    expect(pageEquipe).toContain("rpc('ca_list_team')")
    expect(pageEquipe).toContain("functions.invoke('ca-invite-supervisor'")
    expect(pageEquipe).not.toContain(".from('team_invitations')")
    expect(pageEquipe).not.toContain(".from('store_supervisors')")
  })

  it('« Mon équipe » pousse la double authentification', () => {
    expect(pageEquipe).toContain('listFactors')
    expect(pageEquipe).toContain('double')
  })

  it('la fiche entreprise nomme par l’edge function, jamais en direct', () => {
    expect(ficheEntreprise).toContain("functions.invoke('invite-company-admin'")
    expect(ficheEntreprise).toContain("rpc('admin_revoke_company_admin'")
  })
})

// Constats du test terrain du 21 août 2026.
describe('test terrain — corrections', () => {
  const m5 = lire('../../supabase/migrations/20260821090001_equipe_mot_de_passe_a_creer.sql')
  const pageCompte = lire('../app/account/page.tsx')

  it('ca_list_team dit si le compte est utilisable', () => {
    // Le profil existe dès l'invitation : sans cet indicateur, un compte sans
    // mot de passe se présentait comme un superviseur actif.
    expect(m5).toContain("'is_active'")
    expect(m5).toContain('u.last_sign_in_at is not null')
    expect(m5).toMatch(/revoke all on function public\.ca_list_team\(\) from public, anon/)
  })

  it('l’écran équipe affiche « Mot de passe à créer »', () => {
    expect(pageEquipe).toContain('Mot de passe à créer')
    expect(pageEquipe).toContain('!m.is_active')
  })

  it('« Mon compte » nomme correctement l’administrateur d’entreprise', () => {
    // Le badge disait « Superviseur » alors que /equipe disait « Administrateur
    // d'entreprise » : deux écrans, deux vérités.
    expect(pageCompte).toContain('is_company_admin')
    expect(pageCompte).toMatch(/Administrateur d\\u2019entreprise|Administrateur d’entreprise/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ajouter quelqu'un d'une autre entreprise (22 août 2026)
//
// Julien, capture à l'appui : « je viens d'essayer d'ajouter une personne
// d'une autre entreprise dans mon équipe ; plutôt qu'un message d'erreur,
// signale que cette personne fait partie d'une entreprise extérieure à
// celle-ci, inviter à passer par l'admin de l'entreprise ». L'app titrait
// « Erreur — Cette adresse est déjà utilisée dans une autre entreprise »,
// sans dire quoi faire.

describe('une personne d’une autre entreprise', () => {
  const equipe = readFileSync(path.resolve(__dirname, '../../supabase/functions/invite-teammate/index.ts'), 'utf8')
  const inventaire = readFileSync(path.resolve(__dirname, '../../supabase/functions/invite-to-session/index.ts'), 'utf8')
  const ecranMobile = readFileSync(path.resolve(__dirname, '../../src/app/(compte)/new-member.tsx'), 'utf8')
  const ecranSite = readFileSync(path.resolve(__dirname, '../components/dashboard/AddCounter.tsx'), 'utf8')
  const requetes = readFileSync(path.resolve(__dirname, '../../src/lib/queries.ts'), 'utf8')

  it('est annoncée par un code, pas seulement par une phrase', () => {
    // Sans code, un écran ne peut que titrer « Erreur » et recopier le texte.
    expect(equipe).toContain("code: 'other_company'")
    expect(inventaire).toContain("code: 'other_company'")
    expect(requetes).toContain('err.code = res.code')
  })

  it('dit quoi faire, et non seulement ce qui bloque', () => {
    for (const fn of [equipe, inventaire]) {
      expect(fn).toContain("l'administrateur de votre entreprise")
      expect(fn).toContain('une autre adresse e-mail')
    }
  })

  it('ne nomme jamais l’autre entreprise', () => {
    // Le superviseur apprendrait quelque chose sur un client qui n'est pas le
    // sien. Le message reste au fait : « une autre entreprise ».
    for (const fn of [equipe, inventaire]) {
      const bloc = fn.split("code: 'other_company'")[1]?.split('})')[0] ?? ''
      expect(bloc).not.toMatch(/company\.name|found\.company_name|companyName/)
    }
  })

  it('n’est plus présentée comme une erreur de saisie', () => {
    expect(ecranMobile).toContain("code === 'other_company'")
    expect(ecranMobile).toContain('n’est pas de votre entreprise')
    expect(ecranSite).toContain("data?.code === 'other_company'")
    // Sur le site, l'explication reste sous le formulaire au lieu de
    // s'effacer avec une notification.
    expect(ecranSite).toContain('horsEntreprise')
    expect(ecranSite).toContain('banner banner-warn')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// L'administrateur d'entreprise supprime les comptes de son entreprise
// (décision de Julien, 22 août 2026).
//
// Ce que ces tests empêchent de défaire : les trois bornes du droit (pas
// soi-même, pas un autre administrateur, pas une autre entreprise), la trace
// au journal, et la confirmation délibérée à l'écran — « Supprimer le compte »
// est à deux centimètres de « Retirer les accès ».

describe('supprimer un compte de son entreprise', () => {
  const mSupp = lire('../../supabase/migrations/20260822120001_ca_supprimer_un_compte.sql')
  const corps = mSupp.split('function public.ca_delete_user(')[1]?.split('$$;')[0] ?? ''

  it('n’est ouverte qu’à l’administrateur d’entreprise', () => {
    expect(corps).toContain('if not public.is_company_admin() then')
    // La garde porte l'exigence aal2 conditionnelle : une session au mot de
    // passe seul est refusée par le serveur, pas seulement par l'écran.
    expect(corps.indexOf('is_company_admin()')).toBeLessThan(corps.indexOf('delete from auth.users'))
  })

  it('refuse son propre compte et celui d’un autre administrateur', () => {
    expect(corps).toContain('if p_user = auth.uid() then')
    expect(corps).toContain('v_target.is_company_admin or coalesce(v_target.is_admin, false)')
  })

  it('ne sort jamais de son entreprise', () => {
    expect(corps).toContain('where id = p_user and company_id = v_company')
  })

  it('fige l’identité avant de supprimer, et journalise', () => {
    // Après le delete, ni le profil ni l'adresse n'existent : le journal
    // n'aurait plus qu'un identifiant à afficher dans un an.
    expect(corps.indexOf('into v_label, v_email')).toBeLessThan(corps.indexOf('delete from auth.users'))
    expect(corps).toContain("log_company_action(v_company, 'compte_supprime'")
  })

  it('conserve les comptages au lieu de les détruire', () => {
    // Le résultat d'un inventaire clôturé appartient à l'entreprise : on
    // détache, on n'efface pas.
    expect(corps).toContain('update public.counts             set counted_by = null')
    expect(corps).not.toMatch(/delete from public\.counts/)
  })

  it('n’est pas exécutable par anon', () => {
    expect(mSupp).toMatch(/revoke all on function public\.ca_delete_user\(uuid\) from public, anon/)
    expect(mSupp).toMatch(/grant execute on function public\.ca_delete_user\(uuid\) to authenticated/)
  })

  it('exige un geste délibéré à l’écran', () => {
    const fn = pageEquipe.split('async function supprimerCompte(')[1]?.split('\n  }')[0] ?? ''
    expect(fn).toContain('requireText')
    expect(fn).toContain("tone: 'danger'")
    expect(fn).toContain("appliquer('ca_delete_user'")
  })

  it('dit ce que la suppression fait aux rapports déjà produits', () => {
    // C'est la conséquence que personne ne devine : les chiffres restent,
    // le nom disparaît. (Phrase raccourcie à la relecture du 22 août.)
    expect(pageEquipe).toContain('son nom disparaît des rapports déjà faits')
  })

  it('ne propose jamais de supprimer un administrateur', () => {
    // Le bouton vit dans la branche `!m.is_company_admin`, celle qui porte
    // déjà le retrait des accès.
    const bloc = pageEquipe.split('{!m.is_company_admin && (')[1]?.split('store-sup')[0] ?? ''
    expect(bloc).toContain('supprimerCompte(m)')
  })

  it('liste tous les compteurs de l’entreprise, pas seulement les siens', () => {
    // Sans cela le droit serait décoratif : un administrateur de siège ne
    // supervise aucun magasin et ne verrait donc aucun compteur. Le bloc
    // « autres magasins » du matin a été remplacé le jour même par une liste
    // personne par personne, qui couvre toute l'entreprise.
    expect(pageEquipe).toContain("(ca?.members ?? []).filter((m) => m.role !== 'supervisor')")
    expect(pageEquipe).not.toContain('Compteurs · autres magasins')
    // Et elle répond à « qui fait quoi » : dernier comptage, inventaires comptés.
    expect(pageEquipe).toContain('last_count_at')
    expect(pageEquipe).toContain('sessions_counted')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// L'administrateur d'entreprise est affecté à tous les magasins (22 août 2026).
//
// Précision de Julien, capture à l'appui : son écran Magasins annonçait
// « Vous n'êtes affecté à aucun magasin » et l'invitait à s'en affecter un.
// C'était la lecture inverse de la règle — il les a tous, par construction.

describe('l’administrateur d’entreprise a tous les magasins', () => {
  const mTous = lire('../../supabase/migrations/20260822150001_admin_entreprise_tous_les_magasins.sql')
  const pageMagasins = lire('../app/magasins/page.tsx')
  const appMagasins = lire('../../src/app/(compte)/stores.tsx')
  const appEquipe = lire('../../src/app/(compte)/team.tsx')

  it('l’invariant tient par déclencheur, pas par affichage', () => {
    // Tout ce que voit un superviseur se lit dans store_supervisors : c'est
    // l'affectation qu'on rend vraie, une fois, plutôt qu'une condition
    // « ou bien il est administrateur » à recopier dans chaque écran.
    expect(mTous).toContain('after insert on public.stores')
    expect(mTous).toContain('after insert or update of is_company_admin, company_id on public.profiles')
    expect(mTous).toContain('when (new.is_company_admin and new.company_id is not null)')
    // Et le rattrapage de l'existant, sans quoi l'invariant ne vaudrait que
    // pour les magasins créés après la migration.
    expect(mTous).toMatch(/insert into public\.store_supervisors[\s\S]*?where p\.is_company_admin/)
  })

  it('ses affectations ne se retirent ni côté client ni côté Quantinvo', () => {
    // Les déclencheurs ne réparent pas un retrait : ils ne se réveillent qu'à
    // la création d'un magasin ou à la nomination. Sans ces deux refus,
    // l'invariant deviendrait faux en silence.
    const ca = mTous.split('function public.ca_set_supervisor_stores(')[1]?.split('$$;')[0] ?? ''
    expect(ca).toContain("'Un administrateur d''entreprise est affecté à tous les magasins.'")
    const quantinvo = mTous.split('function public.admin_unassign_supervisor(')[1]?.split('$$;')[0] ?? ''
    expect(quantinvo).toContain('is_company_admin')
    expect(quantinvo).toContain(`Retirez-lui d''abord ce rôle`)
  })

  it('« Mon équipe » ne montre ni croix ni sélecteur sur sa ligne', () => {
    // Une croix qui ne marche pas est pire que pas de croix.
    expect(pageEquipe).toContain('Tous les magasins de l&apos;entreprise')
    const rail = pageEquipe.split('className="store-sup"')[1]?.split('</div>')[0] ?? ''
    expect(rail).toContain('m.is_company_admin ?')
  })

  it('aucun écran ne lui parle plus d’affectation', () => {
    // S'il ne voit aucun magasin, c'est que son entreprise n'en a aucun.
    for (const [nom, source] of [
      ['site', pageMagasins], ['app · magasins', appMagasins], ['app · équipe', appEquipe],
    ] as const) {
      expect(source, nom).toContain('Votre entreprise n’a encore aucun magasin')
      expect(source, nom).not.toMatch(/affectez-vous un magasin/i)
    }
  })
})

describe('changer le rôle d’un membre (23 août 2026)', () => {
  // Demande de Julien. Il n'y avait aucun chemin : `profiles.role` est figé
  // par `profiles_pin_privileged` pour `authenticated`, donc une personne
  // embauchée compteur puis promue devait être supprimée et réinvitée — en
  // perdant l'attribution de ses comptages.
  const corps = mRole.split('function public.ca_set_user_role(')[1]?.split('$$;')[0] ?? ''

  it('la fonction est réservée à l’administrateur de l’entreprise', () => {
    expect(corps).toContain('if not public.is_company_admin() then')
    expect(mRole).toContain('revoke all on function public.ca_set_user_role(uuid, text, uuid[]) from public, anon')
  })

  it('les trois refus sont là', () => {
    // Soi-même : un administrateur qui se rétrograde enferme son entreprise.
    expect(corps).toContain('p_user is null or p_user = auth.uid()')
    // Un autre administrateur : son rôle et son drapeau se tiennent.
    expect(corps).toContain('if v_target.is_company_admin then')
    // Un superviseur a toujours au moins un magasin (règle du même jour).
    expect(corps).toContain('Un superviseur a toujours au moins un magasin')
  })

  it('⚠️ les affectations suivent le rôle, sinon la personne ne voit rien', () => {
    // Un superviseur est rattaché par store_supervisors, un compteur par
    // store_team. Écrire `role` sans déplacer les lignes donnerait quelqu'un
    // qui a un rôle et aucun magasin.
    const [promo, retro] = corps
      .split("if v_role = 'supervisor' then")[1]
      .split('-- Rétrogradation')
    expect(promo).toContain('insert into public.store_supervisors')
    expect(promo).toContain('delete from public.store_team')
    expect(retro).toContain('insert into public.store_team')
    expect(retro).toContain('delete from public.store_supervisors')
  })

  it('un second clic n’est pas une erreur', () => {
    expect(corps).toContain("json_build_object('success', true, 'already', true)")
  })

  it('les deux sens sont journalisés, et traduits', () => {
    expect(corps).toContain("'promu_superviseur'")
    expect(corps).toContain("'retrograde_compteur'")
    // Le garde-fou par balayage ne voit pas un `case ... end` : on nomme donc
    // les deux libellés ici.
    expect(ACTIONS['promu_superviseur']).toBeDefined()
    expect(ACTIONS['retrograde_compteur']).toBeDefined()
  })

  it('l’écran porte les deux gestes, dans les deux listes', () => {
    expect(pageEquipe).toContain("changerRole(m, 'employee')")
    expect(pageEquipe).toContain("changerRole(m, 'supervisor')")
    expect(pageEquipe).toContain("appliquer('ca_set_user_role', { p_user: m.id, p_role: vers })")
  })

  it('la confirmation dit ce qui change, sans recopie du nom', () => {
    // Réversible d'un clic, contrairement à la suppression : la recopie du
    // nom serait de la cérémonie.
    const bloc = pageEquipe.split('async function changerRole')[1]?.split('\n  if (guard')[0] ?? ''
    expect(bloc).toContain('mais en tant que superviseur')
    expect(bloc).toContain('Elle ne pourra plus créer ni clôturer d’inventaire')
    expect(bloc).not.toContain('requireText')
  })
})
