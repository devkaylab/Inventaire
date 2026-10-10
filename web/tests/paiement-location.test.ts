// Le paiement d'une location — la garde (7 octobre 2026).
//
// La promesse, dictée par Julien : « je suis facturé au bout de 7 jours
// automatiquement sur mon mode de paiement déjà renseigné avant l'inventaire.
// Paiement que Quantinvo a vérifié comme valide. »
//
// Quatre choses peuvent la casser sans bruit, et c'est ce que ce fichier tient :
//
//   1. **la fenêtre s'ouvrirait sans carte** — et on servirait sept jours
//      gratuits à qui réserve ;
//   2. **la machine d'états refuserait le chemin que le code emprunte** — mon
//      premier jet sautait de `prix_calcule` à `prete`, ce que
//      `transition_mission_permise` interdit : le premier client aurait eu une
//      exception. Trouvé en jouant la transition, pas en relisant ;
//   3. **la clé d'idempotence du règlement rejouerait un refus** — Stripe
//      mémorise aussi les échecs : les trois tentatives n'en auraient fait
//      qu'une ;
//   4. **un identifiant Stripe deviendrait lisible par le navigateur** — le
//      défaut du 4 octobre, par une autre porte.
//
// ⚠️ AUCUNE LISTE N'EST CITÉE ICI. Les états viennent de la machine, les
// colonnes du `grant`, les clés d'idempotence du code qui les fabrique. Une
// garde qui récite ce qu'elle surveille valide sa propre copie.
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'
import { venteOuverte } from '../lib/legal'
import { messageSiren, sirenValide } from '../lib/siren'

const racine = path.resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/**
 * ⚠️ **LE CODE SANS SES COMMENTAIRES.** Toutes les gardes de ce dépôt le font,
 * et pour une raison payée : les commentaires de ces fichiers CITENT les règles
 * qu'on surveille (« `prix_calcule → prete` était refusé »). Une garde qui lit
 * le texte brut se satisfait du commentaire et laisse passer le code.
 */
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(--|\/\/).*$/gm, '')

/** Les suites `array[…]` de `transition_mission_permise`, branche par branche. */
function machineDEtats(formule: 'logiciel_seul' | 'equipe'): Map<string, string[]> {
  const corps = sansCommentaires(derniereDefinition('transition_mission_permise').corps)
  // Les deux branches du `case when … = 'logiciel_seul' then … else … end`.
  const coupe = corps.indexOf("= 'logiciel_seul' then")
  expect(coupe, 'la branche « logiciel seul » de la machine ne se lit plus')
    .toBeGreaterThan(0)
  const elseIdx = corps.indexOf('\n  else\n', coupe)
  expect(elseIdx, 'la branche « équipe » de la machine ne se lit plus').toBeGreaterThan(coupe)
  const zone = formule === 'logiciel_seul'
    ? corps.slice(coupe, elseIdx)
    : corps.slice(elseIdx)

  const m = new Map<string, string[]>()
  for (const t of zone.matchAll(/when\s+'(\w+)'\s+then\s+array\[([^\]]*)\]/g)) {
    m.set(t[1], [...t[2].matchAll(/'(\w+)'/g)].map((x) => x[1]))
  }
  expect(m.size, 'aucun état lu dans la machine').toBeGreaterThan(8)
  return m
}

/** Les états que `fn` écrit, dans l'ordre où elle les écrit. */
function etatsEcrits(fn: string): string[] {
  const corps = sansCommentaires(derniereDefinition(fn).corps)
  return [...corps.matchAll(/set\s+etat\s*=\s*'(\w+)'/g)].map((x) => x[1])
}

describe('⚠️ la carte est ce qui ouvre la fenêtre', () => {
  it('la réservation n’ouvre aucun accès', () => {
    // C'est toute la promesse : réserver ne sert rien. Si cette garde tombe,
    // n'importe qui obtient sept jours de Quantinvo en remplissant un
    // formulaire.
    const corps = sansCommentaires(derniereDefinition('reserver_ma_mission').corps)
    expect(corps, 'la réservation ouvre la fenêtre d’accès elle-même')
      .not.toContain('ouvrir_les_acces_mission')
  })

  it('et l’enregistrement de la carte l’ouvre', () => {
    const corps = sansCommentaires(derniereDefinition('enregistrer_l_empreinte').corps)
    expect(corps).toContain('ouvrir_les_acces_mission')
    // ⚠️ ET ELLE DATE LA VÉRIFICATION. Sans cette colonne, rien ne distingue
    // « carte prise » de « carte demandée », et `missions_a_prelever`
    // débiterait quelqu'un qui n'a jamais rien donné.
    expect(corps).toContain('moyen_de_paiement_verifie_le = now()')
  })

  it('⚠️ la fenêtre ne s’ouvre que pour la formule qui se sert seule', () => {
    // Une mission d'équipe confirmée n'a pas encore d'équipe : ouvrir sa
    // fenêtre ouvrirait des accès sur personne. L'exception est isolée dans
    // cette fonction, elle ne passe pas par le déclencheur commun.
    const corps = sansCommentaires(derniereDefinition('enregistrer_l_empreinte').corps)
    const garde = corps.indexOf("'logiciel_seul'")
    expect(garde, 'l’exception « logiciel seul » a disparu').toBeGreaterThan(0)
    expect(corps.indexOf('ouvrir_les_acces_mission'), 'l’ouverture doit être sous la garde')
      .toBeGreaterThan(garde)
  })

  it('⚠️ et le déclencheur commun ne l’ouvre pas sur « prete »', () => {
    // Si `missions_accorder_les_acces` se mettait à réagir à `prete`, la
    // fenêtre s'ouvrirait DEUX fois par deux chemins — et la formule équipe
    // ouvrirait la sienne sans équipe.
    const corps = sansCommentaires(derniereDefinition('missions_accorder_les_acces').corps)
    const ouvre = corps.slice(0, corps.indexOf('ouvrir_les_acces_mission'))
    expect(ouvre).toContain("'en_cours'")
    expect(ouvre, 'le déclencheur commun ouvre maintenant sur « prete »')
      .not.toContain("'prete'")
  })
})

describe('⚠️ la machine d’états permet le chemin que le code emprunte', () => {
  it('l’enregistrement de la carte marche des pas permis', () => {
    // ⚠️ **LA GARDE QUI AURAIT ÉVITÉ MON PREMIER JET.** Il posait
    // `prix_calcule → prete` d'un seul `update` ; la machine rend faux, donc le
    // déclencheur aurait levé `check_violation` au premier client. Ici on
    // DÉDUIT la suite d'états que la fonction écrit et on la fait valider par
    // la machine, pas par un commentaire.
    const machine = machineDEtats('logiciel_seul')
    const pas = etatsEcrits('enregistrer_l_empreinte')
    expect(pas.length, 'aucun état écrit : la fonction ne se lit plus').toBeGreaterThan(2)

    // Le point de départ : l'état d'une mission qui vient d'être réservée.
    const depart = etatsEcrits('reserver_ma_mission')
    const reserve = depart[depart.length - 1] ?? 'prix_calcule'

    // ⚠️ On ne suppose pas que la fonction part de `reserve` : elle commence
    // par rattraper un `brouillon`. On vérifie que CHAQUE pas est atteignable
    // depuis l'un des états déjà possibles.
    let possibles = new Set(['brouillon', reserve])
    for (const vers of pas) {
      const ok = [...possibles].some((de) => (machine.get(de) ?? []).includes(vers))
      expect(ok, `« ${vers} » n’est atteignable depuis aucun de `
        + `[${[...possibles].join(', ')}] — la machine le refusera`).toBe(true)
      possibles = new Set([vers])
    }
  })

  it('la clôture termine par un pas permis', () => {
    // Elle pose `terminee` depuis la liste d'états de son `where`. Chacun doit
    // pouvoir y aller : sinon la tâche horaire lève une exception et
    // l'inventaire reste ouvert pour toujours.
    const machine = machineDEtats('logiciel_seul')
    const corps = sansCommentaires(derniereDefinition('cloturer_les_inventaires_hors_fenetre').corps)
    const vers = etatsEcrits('cloturer_les_inventaires_hors_fenetre')
    expect(vers, 'la clôture n’écrit plus d’état de mission').toContain('terminee')

    const zone = corps.slice(corps.indexOf('update public.missions'))
    const depuis = [...zone.matchAll(/'(\w+)'/g)].map((x) => x[1]).filter((e) => machine.has(e))
    const sources = depuis.filter((e) => !vers.includes(e))
    expect(sources.length, 'les états de départ de la clôture ne se lisent plus')
      .toBeGreaterThan(0)
    for (const de of sources) {
      expect(machine.get(de) ?? [], `« ${de} → terminee » est refusé par la machine`)
        .toContain('terminee')
    }
  })

  it('⚠️ un refus de carte mène là où l’on peut encore encaisser', () => {
    // `echouee` dirait que la MISSION a échoué : or l'inventaire a eu lieu. Et
    // surtout, il faut une sortie — un règlement obtenu autrement doit pouvoir
    // se consigner. On déduit l'état d'arrivée et on exige cette sortie.
    const machine = machineDEtats('logiciel_seul')
    const arrivee = etatsEcrits('echouer_le_prelevement')
    expect(arrivee.length, 'l’abandon n’écrit plus d’état').toBe(1)
    expect(machine.get(arrivee[0]) ?? [],
      `depuis « ${arrivee[0] }» on ne peut plus encaisser`).toContain('payee')
  })

  it('⚠️ et la branche « équipe » n’a pas bougé', () => {
    // Les deux transitions ajoutées le 7 octobre sont pour la location. Les
    // poser aussi côté équipe sauterait la constitution de l'équipe : une
    // mission « prête » sans personne dessus.
    const equipe = machineDEtats('equipe')
    expect(equipe.get('prete') ?? [], 'la branche équipe termine sans contrôle qualité')
      .not.toContain('terminee')
    expect(equipe.get('confirmee') ?? []).toContain('en_constitution')
  })
})

describe('⚠️ on ne prélève que ce qui est dû', () => {
  it('une mission annulée n’est jamais dans la liste', () => {
    // Annuler est GRATUIT depuis le 4 octobre. Le danger n'est pas le montant,
    // il est nul : c'est qu'une mission annulée ressorte ici parce qu'elle a
    // une carte vérifiée et une fenêtre passée.
    const corps = sansCommentaires(derniereDefinition('missions_a_prelever').corps)
    const etats = [...corps.matchAll(/etat\s*(?:=|in \()\s*(.*)/g)].map((x) => x[1]).join(' ')
    const cites = [...etats.matchAll(/'(\w+)'/g)].map((x) => x[1])
    expect(cites.length, 'les états de la liste ne se lisent plus').toBeGreaterThan(0)
    for (const interdit of ['annulee', 'remboursee', 'payee']) {
      expect(cites, `« ${interdit} » est devenu prélevable`).not.toContain(interdit)
    }
  })

  it('⚠️ et la liste exige la carte, pas seulement la fenêtre', () => {
    const corps = sansCommentaires(derniereDefinition('missions_a_prelever').corps)
    for (const condition of [
      'moyen_de_paiement_verifie_le is not null',
      'stripe_payment_method_id is not null',
      'stripe_customer_id is not null',
      'stripe_invoice_id is null',
    ]) {
      expect(corps, `la liste ne vérifie plus : ${condition}`).toContain(condition)
    }
  })

  it('⚠️ la base interdit la facture en double, pas seulement le code', () => {
    // L'idempotence de Stripe protège un rejeu immédiat ; elle ne protège pas
    // deux ticks de `cron` séparés d'une heure. L'index le fait, et il le fait
    // même si la fonction edge est réécrite de travers.
    const fichier = sansCommentaires(fichierDe('missions_a_prelever'))
    expect(fichier).toMatch(
      /create unique index[\s\S]{0,120}on public\.missions \(stripe_invoice_id\)/,
    )
  })

  it('la tentative est marquée AVANT l’appel à Stripe', () => {
    // Un appel dont la réponse se perd aurait peut-être débité le client.
    const src = sansCommentaires(lire('supabase/functions/mission-prelever/index.ts'))
    const marque = src.indexOf("rpc('prelevement_tente'")
    const facture = src.indexOf('facturerLaLocation(')
    expect(marque, 'la tentative n’est plus marquée').toBeGreaterThan(0)
    expect(facture).toBeGreaterThan(0)
    expect(marque, 'Stripe est appelé avant que la tentative soit marquée')
      .toBeLessThan(facture)
  })

  it('⚠️ et seule une facture « paid » compte comme payée', () => {
    const src = sansCommentaires(lire('supabase/functions/mission-prelever/index.ts'))
    const pose = src.indexOf("rpc('enregistrer_le_prelevement'")
    const controle = src.indexOf("statut !== 'paid'")
    expect(controle, 'le contrôle de l’état de la facture a disparu').toBeGreaterThan(0)
    expect(controle, 'on consigne le paiement avant de vérifier qu’il a eu lieu')
      .toBeLessThan(pose)
  })
})

describe('⚠️ les clés d’idempotence de Stripe', () => {
  /** Les clés que `facturerLaLocation` fabrique, par appel. */
  function clesDeLaFacture(): Map<string, string> {
    const src = sansCommentaires(lire('supabase/functions/_shared/stripe.ts'))
    const debut = src.indexOf('export async function facturerLaLocation')
    expect(debut, 'facturerLaLocation ne se lit plus').toBeGreaterThan(0)
    const corps = src.slice(debut)
    const m = new Map<string, string>()
    // `poster('/chemin', …, `cle-…`)` — le chemin et la clé, par appel.
    for (const t of corps.matchAll(/poster\(\s*`?['`]([^'`]+)['`][\s\S]*?`([^`]*\$\{[^`]*)`/g)) {
      m.set(t[1].replace(/\$\{[^}]*\}/g, ':id'), t[2])
    }
    expect(m.size, 'les appels de facturation ne se lisent plus').toBeGreaterThan(2)
    return m
  }

  it('⚠️ celle du RÈGLEMENT change à chaque tentative', () => {
    // ⚠️ **LE DÉFAUT QUE CETTE GARDE FIGE.** Stripe mémorise la réponse d'une
    // clé pendant vingt-quatre heures, **y compris un refus**. Une clé fixe
    // rejouerait donc le premier refus sans jamais retenter : les trois
    // tentatives n'en feraient qu'une, et une carte réapprovisionnée ne serait
    // jamais débitée.
    const cles = clesDeLaFacture()
    const paiement = [...cles.entries()].filter(([chemin]) => chemin.endsWith('/pay'))
    expect(paiement.length, 'l’appel de règlement ne se lit plus').toBe(1)
    expect(paiement[0][1], 'la clé du règlement ne varie pas avec la tentative')
      .toContain('tentative')
  })

  it('⚠️ et celles de la FACTURE ne changent pas', () => {
    // L'inverse : une clé qui varierait créerait une facture par tentative,
    // donc trois pièces comptables pour une semaine vendue.
    const cles = clesDeLaFacture()
    for (const [chemin, cle] of cles) {
      if (chemin.endsWith('/pay')) continue
      expect(cle, `la clé de ${chemin} varie avec la tentative : facture en double`)
        .not.toContain('tentative')
      expect(cle, `la clé de ${chemin} ne porte pas la mission`).toContain('missionId')
    }
  })
})

describe('⚠️ ce que le navigateur ne voit pas, et ne décide pas', () => {
  it('aucun identifiant Stripe n’est lisible par le client', () => {
    // Le défaut du 4 octobre, par une autre porte : `authenticated` n'a pas
    // `select` sur la table, les droits sont posés colonne par colonne. Une
    // colonne Stripe dans ce `grant` rouvrirait tout en silence.
    const fichier = sansCommentaires(fichierDe('enregistrer_l_empreinte'))
    const grants = [...fichier.matchAll(
      /grant select \(([^)]*)\)\s*\n?\s*on public\.missions to authenticated/g,
    )]
    expect(grants.length, 'le grant colonne par colonne ne se lit plus').toBeGreaterThan(0)
    const ouvertes = grants.flatMap((g) => g[1].split(',').map((c) => c.trim()))
    const fuites = ouvertes.filter((c) => /^stripe_/.test(c) || c === 'prelevement_echec')
    expect(fuites, `colonnes ouvertes au client qui ne devraient pas l’être : ${fuites}`)
      .toEqual([])
  })

  it('⚠️ et les colonnes neuves de la migration sont fermées par défaut', () => {
    // La règle du 30 octobre : une table neuve porte ses droits. Celle-ci n'est
    // pas neuve — ce qui compte ici, c'est qu'on n'ait pas « réparé » un
    // « permission denied » par un `grant select on public.missions` sans liste
    // de colonnes, qui supersède tout (mémoire du 4 octobre).
    const fichier = sansCommentaires(fichierDe('enregistrer_l_empreinte'))
    expect(fichier, 'un grant sans colonnes rouvrirait toute la table')
      .not.toMatch(/grant select on (?:table )?public\.missions to/)
  })

  it('aucun montant ne part du navigateur', () => {
    // Même règle que la réservation : « laisser le client porter un montant,
    // c'est le laisser réserver à un centime » (docs/notes/074).
    const client = sansCommentaires(lire('web/lib/missionEmpreinte.ts'))
    const envois = [...client.matchAll(/appeler\(\{([^}]*)\}\)/g)].map((m) => m[1]).join(' ')
    expect(envois.length, 'les appels du navigateur ne se lisent plus').toBeGreaterThan(10)
    expect(envois).not.toMatch(/prix|montant|cents|amount/i)
  })

  it('⚠️ et le montant facturé vient de la base, pas de la requête', () => {
    const edge = sansCommentaires(lire('supabase/functions/mission-prelever/index.ts'))
    const appel = edge.slice(edge.indexOf('facturerLaLocation(cle, {'))
    const montant = /montantCents:\s*([\w.]+)/.exec(appel)?.[1]
    expect(montant, 'le montant facturé ne se lit plus').toBeTruthy()
    // `m` est la ligne rendue par `missions_a_prelever`.
    expect(montant, `le montant facturé vient de « ${montant} », pas de la base`)
      .toMatch(/\bm\./)
    // ⚠️ ET LA PLUS SOLIDE DES DEUX : cette fonction ne lit PAS le corps de la
    // requête. `cron` l'appelle avec `{}` ; si elle se mettait à en lire quoi
    // que ce soit, n'importe qui connaissant la clé partagée pourrait lui
    // dicter un montant ou une mission.
    expect(edge, 'la fonction de prélèvement lit le corps de la requête')
      .not.toMatch(/req\.json\(\)|await req\.text\(\)/)
  })

  it('⚠️ le retour de Stripe ne fait pas foi', () => {
    // `?carte=ok` s'ouvre à la main. Ce qui ouvre la fenêtre, c'est la session
    // relue CHEZ STRIPE par le serveur — l'écran ne fait que la lui demander.
    const page = sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
    expect(page).toContain('confirmerLEmpreinte(')
    const edge = sansCommentaires(lire('supabase/functions/mission-empreinte/index.ts'))
    const lecture = edge.indexOf('lireEmpreinteCheckout(')
    const pose = edge.indexOf("rpc('enregistrer_l_empreinte'")
    expect(lecture, 'la fonction edge ne relit plus Stripe').toBeGreaterThan(0)
    expect(lecture, 'la carte est enregistrée sans avoir été relue chez Stripe')
      .toBeLessThan(pose)
  })

  it('⚠️ et une carte non validée n’enregistre rien', () => {
    // Une session peut se terminer sur un SetupIntent qui attend encore une
    // authentification bancaire. L'enregistrer ouvrirait la semaine sur une
    // carte que la banque n'a pas validée.
    const partage = sansCommentaires(lire('supabase/functions/_shared/stripe.ts'))
    const debut = partage.indexOf('export async function lireEmpreinteCheckout')
    expect(debut).toBeGreaterThan(0)
    const corps = partage.slice(debut, debut + 1600)
    expect(corps, 'le succès du SetupIntent n’est plus exigé').toContain("'succeeded'")
    expect(corps, 'le moyen de paiement sort même sans succès')
      .toMatch(/paymentMethod:\s*reussi\s*\?/)
  })
})

describe('⚠️ la vente reste fermée partout en même temps', () => {
  /** Les fonctions edge qui déclarent le drapeau, DÉDUITES — aucune n'est citée. */
  function fonctionsEdge(): { nom: string; src: string }[] {
    const dossier = path.join(racine, 'supabase/functions')
    return readdirSync(dossier, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '_shared')
      .map((d) => {
        let src = ''
        try { src = readFileSync(path.join(dossier, d.name, 'index.ts'), 'utf8') } catch {
          /* pas de fonction dans ce dossier */
        }
        return { nom: d.name, src }
      })
      .filter((f) => f.src !== '')
  }

  function edgesAvecDrapeau(): { nom: string; src: string; ouvert: boolean }[] {
    return fonctionsEdge()
      .filter((f) => /const VENTE_OUVERTE = (true|false)/.test(f.src))
      .map((f) => ({ ...f, ouvert: /const VENTE_OUVERTE = true/.test(f.src) }))
  }

  it('⚠️ toute fonction qui prend de l’argent porte le drapeau', () => {
    // ⚠️ LA LISTE SE DÉDUIT : toute fonction edge qui ouvre un Checkout
    // d'empreinte ou qui facture une location DOIT porter le drapeau. Prendre
    // l'empreinte d'une carte EST une vente — elle engage le client à payer
    // sept jours plus tard.
    const coupables: string[] = []
    for (const { nom, src } of fonctionsEdge()) {
      const prend = /creerEmpreinteCheckout|facturerLaLocation/.test(sansCommentaires(src))
      if (!prend) continue
      // ⚠️ `mission-prelever` est appelée par `cron`, pas par un prospect : ce
      // qu'elle encaisse a été engagé par une empreinte déjà prise, et à ce
      // moment-là le drapeau était ouvert. C'est la PRISE d'engagement qui se
      // ferme, pas l'encaissement — refuser d'encaisser laisserait un service
      // rendu impayé.
      if (/x-prelevement-cle|PRELEVEMENT_CLE/.test(src)) continue
      if (!/const VENTE_OUVERTE = (true|false)/.test(src)) coupables.push(nom)
    }
    expect(coupables, `fonctions qui prennent un engagement sans drapeau : ${coupables}`)
      .toEqual([])
  })

  it('⚠️ et toutes portent le MÊME verdict que le site', () => {
    const edges = edgesAvecDrapeau()
    expect(edges.length, 'plus aucune fonction edge ne porte le drapeau')
      .toBeGreaterThan(2)
    for (const f of edges) {
      expect(f.ouvert, `la fonction edge « ${f.nom} » a divergé du site`)
        .toBe(venteOuverte())
    }
  })

  it('⚠️⚠️ une porte de banc ne peut JAMAIS ouvrir une vraie vente', () => {
    // Éprouver le parcours contre Stripe demande d'ouvrir la porte quelque
    // part. La tentation est de basculer `VENTE_OUVERTE` « le temps d'un
    // essai » — c'est ainsi qu'un drapeau commercial finit en production, et
    // la garde du verdict partagé l'interdit déjà.
    //
    // Une porte séparée est donc permise, à UNE condition : qu'elle exige une
    // clé Stripe de TEST. Cette condition est structurelle — le jour où le
    // compte passe en `live`, la porte se referme toute seule, quoi qu'il y
    // ait dans les secrets. Sans elle, un simple secret mal posé encaisserait
    // de l'argent réel.
    for (const { nom, src } of fonctionsEdge()) {
      const nu = sansCommentaires(src)
      const portes = [...nu.matchAll(/const ([A-Z_]*BANC[A-Z_]*) =([^\n]*)/g)]
      for (const [, drapeau, definition] of portes) {
        expect(
          definition,
          `« ${nom} » : la porte de banc « ${drapeau} » ne vérifie plus que la clé Stripe est une clé de test`,
        ).toMatch(/CLE_EST_DE_TEST|sk_test_/)
      }
      // ⚠️ Et une porte de banc ne se contente jamais d'un drapeau d'environnement.
      if (portes.length > 0) {
        expect(nu, `« ${nom} » : la clé de test ne se déduit plus de la clé Stripe`)
          .toMatch(/sk_test_/)
      }
    }
  })

  it('⚠️ et chacune refuse AVANT de lire ou d’écrire quoi que ce soit', () => {
    // Envoyer quelqu'un sur une page de paiement qui refuserait sa carte est
    // pire que de ne rien ouvrir du tout.
    for (const f of edgesAvecDrapeau()) {
      const src = sansCommentaires(f.src)
      // ⚠️ SANS LA PARENTHÈSE FERMANTE : la garde peut porter une seconde
      // condition (la porte de banc, qui exige une clé de test). Citer
      // `'if (!VENTE_OUVERTE)'` en entier la faisait tomber sur du code juste
      // — quatrième fois que ce piège se présente (10 octobre 2026).
      const garde = src.indexOf('if (!VENTE_OUVERTE')
      expect(garde, `« ${f.nom} » ne garde plus rien`).toBeGreaterThan(0)
      for (const t of src.matchAll(/\.rpc\('(\w+)'|functions\.invoke|creer\w*Checkout\(/g)) {
        expect(t.index, `« ${f.nom} » agit avant sa garde (${t[0]})`).toBeGreaterThan(garde)
      }
    }
  })
})

describe('⚠️⚠️ un tunnel qui demande un code doit savoir le recevoir', () => {
  /**
   * LE DÉFAUT DU 10 OCTOBRE 2026, EN UNE RÈGLE.
   *
   * `/reserver` envoyait un code à six chiffres, affichait « Regardez votre
   * boîte mail — soit avec le code », et n'avait **aucun champ pour le code**.
   * Pas même une variable pour le stocker : la page n'appelait jamais
   * `action: 'creer'`. Un prospect sans compte n'avait donc qu'une sortie,
   * « j'ai déjà un compte » — un cul-de-sac.
   *
   * Découvert en jouant le parcours de bout en bout, jamais à la relecture, et
   * invisible au compte d'essai qui porte déjà toutes les casquettes. Julien :
   * « tu dois penser jusqu'au bout, c'est pas normal de parler de code alors
   * qu'il y a aucun champ ».
   *
   * ⚠️ LA LISTE SE DÉDUIT : toute page qui demande un code par courriel est
   * tenue de savoir le recevoir. Citer les deux pages d'aujourd'hui laisserait
   * la troisième retomber dans le trou.
   */
  // ⚠️ `racine` est la racine du DÉPÔT dans ce fichier, pas `web/`.
  const dossiers = ['web/components/vitrine', 'web/app']

  function pagesQuiDemandentUnCode(): { nom: string; src: string }[] {
    const trouvees: { nom: string; src: string }[] = []
    const parcourir = (rel: string) => {
      const abs = path.join(racine, rel)
      for (const e of readdirSync(abs, { withFileTypes: true })) {
        const sous = path.join(rel, e.name)
        if (e.isDirectory()) { parcourir(sous); continue }
        if (!e.name.endsWith('.tsx')) continue
        const src = readFileSync(path.join(racine, sous), 'utf8')
        if (/action: 'code'/.test(sansCommentaires(src))) trouvees.push({ nom: sous, src })
      }
    }
    for (const d of dossiers) parcourir(d)
    return trouvees
  }

  it('toute page qui envoie un code sait aussi le recevoir', () => {
    const pages = pagesQuiDemandentUnCode()
    expect(pages.length, 'plus aucune page ne demande de code par courriel')
      .toBeGreaterThan(0)
    for (const { nom, src } of pages) {
      const nu = sansCommentaires(src)
      expect(nu, `« ${nom} » demande un code et n’appelle jamais « creer » : le prospect est en cul-de-sac`)
        .toContain("action: 'creer'")
      expect(nu, `« ${nom} » n’a aucun champ pour saisir le code`)
        .toMatch(/autoComplete="one-time-code"/)
      expect(nu, `« ${nom} » ne garde pas le code saisi`)
        .toMatch(/setCode\(/)
    }
  })

  /**
   * ⚠️⚠️ **LE COMPTE ET LA RÉSERVATION PARTENT ENSEMBLE** (règle de Julien,
   * 10 octobre 2026 : « ne crée pas de compte tant que c'est pas fait, ça ne
   * sert à rien et ça nous complique la vie »).
   *
   * Cette garde exigeait l'inverse : que la réservation REPARTE après la
   * création. C'était déjà un progrès sur l'écran d'attente qu'elle a
   * remplacé — mais ça laissait un intervalle, et dans cet intervalle tout
   * pouvait arriver : un refus du serveur, un onglet fermé, une coupure. Ce
   * qui restait alors était un compte sans entreprise, sans magasin, sans
   * inventaire, et sans aucune sortie. Il n'y a plus d'intervalle.
   */
  it('⚠️⚠️ la réservation part AVEC la création, pas après', () => {
    const tunnel = sansCommentaires(
      readFileSync(path.join(racine, 'web/components/vitrine/PageReserver.tsx'), 'utf8'))
    const apresCreation = tunnel.slice(tunnel.indexOf("action: 'creer'"))
    const appel = apresCreation.slice(0, apresCreation.indexOf('})'))
    expect(appel, 'la création de compte ne porte pas la réservation')
      .toContain('reservation:')

    // Et rien ne réserve APRÈS, dans la même fonction : ce serait réouvrir
    // l'intervalle qu'on vient de fermer.
    const suite = apresCreation.slice(0, apresCreation.indexOf('\n  }'))
    expect(suite, 'le compte créé réserve ensuite : l’intervalle est rouvert')
      .not.toContain('reserverMaintenant()')
  })

  it('⚠️⚠️ et le serveur supprime le compte si la réservation est refusée', () => {
    // C'est là que la règle se tient vraiment : le navigateur peut disparaître
    // entre les deux appels, le serveur non.
    const fn = sansCommentaires(lire('supabase/functions/inscription/index.ts'))
    const creer = fn.slice(fn.indexOf("action === 'creer'"))
    // ⚠️ On s'arrête à l'action suivante, pas à un commentaire :
    // `sansCommentaires` les a déjà retirés.
    const bloc = creer.slice(0, creer.indexOf("action === 'payer'"))
    expect(bloc, 'la création de compte ne réserve pas').toContain('reserver_ma_mission')
    expect(bloc, 'un compte survit à une réservation refusée')
      .toContain('deleteUser')

    // ⚠️ ET ELLE RÉSERVE AVEC UNE SESSION, PAS AVEC LA CLÉ DE SERVICE :
    // `reserver_ma_mission` lit `auth.uid()`, qui serait nul, et la mission
    // n'appartiendrait à personne.
    const avantRpc = bloc.slice(0, bloc.indexOf('reserver_ma_mission'))
    expect(avantRpc, 'la réservation part sans session : `auth.uid()` serait nul')
      .toContain('signInWithPassword')
  })
})

describe('⚠️⚠️ une erreur ne survit pas à son écran', () => {
  const tunnel = () => sansCommentaires(
    readFileSync(path.join(racine, 'web/components/vitrine/PageReserver.tsx'), 'utf8'))

  it('toute navigation passe par le chemin qui vide l’erreur', () => {
    // LE DÉFAUT DU 10 OCTOBRE 2026 : un seul `erreur` sert les huit étapes, et
    // rien ne le vidait en changeant d'écran. Julien a lu « Le code postal doit
    // comporter cinq chiffres » sur « Regardez votre boîte mail » — à propos
    // d'un champ qu'aucun écran de son parcours n'affiche, et depuis un écran
    // qui n'avait aucune sortie pour le corriger.
    const src = tunnel()
    // ⚠️ On ne compte pas les `setEtape` : on vérifie qu'aucun n'est posé sur
    // un `onClick`, c'est-à-dire sur une navigation. Ceux qui restent sont
    // dans des gestes qui ont déjà vidé l'erreur, ou qui la posent exprès.
    const surUnClic = [...src.matchAll(/onClick=\{[^}]*setEtape\(/g)]
    expect(
      surUnClic.map((m) => m[0]),
      'une navigation change d’étape sans vider l’erreur : elle suivra le client',
    ).toEqual([])
    expect(src, 'le chemin unique de navigation a disparu')
      .toMatch(/const allerA = \(n: number\) => \{ setErreur\(null\); setEtape\(n\) \}/)
  })

  it('⚠️ et un refus ramène là où il se corrige', () => {
    // Les messages disaient « Reprenez l'étape 1 », « Reprenez l'étape 3 » —
    // et rien n'y ramenait. Une consigne que le client devait exécuter à la
    // main, depuis un écran sans retour.
    const src = tunnel()
    expect(src, 'la table des refus a disparu').toContain('etapeDuRefus')
    const table = /const etapeDuRefus[\s\S]*?\n  \}/.exec(src)?.[0] ?? ''
    for (const code of ['code_postal', 'adresse', 'date', 'engagement']) {
      expect(table, `le refus « ${code} » ne ramène nulle part`).toContain(code)
    }
    // ⚠️ Et la destination dépend de la FORMULE : « logiciel seul » n'a que
    // deux étapes. Y renvoyer à l'étape 3 ouvrirait un écran vide.
    expect(table, 'la destination ne tient plus compte de la formule')
      .toContain('logicielSeul')
  })

  it('⚠️ et l’écran d’attente du code disparaît dès que le compte existe', () => {
    // Dernier cul-de-sac : compte créé, connexion réussie, réservation en
    // échec — et l'écran redemandait un code pour un compte qui existait.
    const src = tunnel()
    expect(src, 'l’écran d’attente ne distingue plus le compte déjà créé')
      .toContain('!missionId && !reference && !connecte')
    expect(src, 'il n’y a plus d’écran pour le compte créé qui doit réserver')
      .toContain('!missionId && !reference && connecte')
  })
})

describe('⚠️⚠️ `coalesce` ne rattrape pas une chaîne vide', () => {
  /**
   * LE PIÈGE DE FOND DU 10 OCTOBRE 2026, derrière DEUX murs successifs.
   *
   * La formule « logiciel seul » n'a pas d'étape 3 : elle envoie donc
   * `secteur: ''` et `code_barres: ''`. La fonction écrivait
   * `coalesce(p_reponses ->> 'code_barres', 'tous')` et croyait se protéger —
   * mais **`coalesce` ne remplace que NULL**. La chaîne vide passait, et la
   * contrainte explosait AU VISAGE DU CLIENT : « new row for relation
   * "missions" violates check constraint ».
   *
   * Un défaut non vide dans un `coalesce` sur une réponse du navigateur est
   * donc toujours un faux ami : ce qui arrive du formulaire est vide, pas nul.
   */
  it('aucun défaut non vide ne se cache derrière un coalesce', () => {
    const { corps } = derniereDefinition('reserver_ma_mission')
    const nu = corps.replace(/^\s*--.*$/gm, '')
    const faux = [...nu.matchAll(/coalesce\(p_reponses ->> '(\w+)', '([^']+)'\)/g)]
    expect(
      faux.map((m) => `${m[1]} → '${m[2]}'`),
      'un défaut non vide derrière un coalesce : la chaîne vide du formulaire passera au travers',
    ).toEqual([])
  })

  it('⚠️ et la normalisation existe, en un seul endroit', () => {
    // Recopier `nullif(btrim(coalesce(…)))` à chaque champ, c'est recopier
    // l'oubli du prochain.
    const { corps } = derniereDefinition('normaliser_reponse_mission')
    expect(corps, 'la normalisation partagée a disparu').not.toBe('')
    expect(corps, 'elle ne traite plus la chaîne vide').toContain('nullif(btrim(')
  })
})

describe('⚠️⚠️ l’écran demande tout ce que la base exige', () => {
  /**
   * LA LEÇON DES TROIS MURS DU 10 OCTOBRE 2026. Le tunnel de réservation est
   * une copie RÉDUITE de l'onboarding OS, et **chaque champ retiré est devenu
   * un mur** : code postal, code-barres, secteur, SIREN, magasin. Trois d'entre
   * eux ont frappé APRÈS le paiement — le pire moment possible.
   *
   * Julien : « il faut les mêmes infos qu'un onboarding OS, c'est juste le
   * profil de client qui change. »
   *
   * ⚠️ LA GARDE DÉDUIT SA LISTE de la fonction qui réserve : tout `code` de
   * refus qu'elle peut rendre sur une donnée saisie doit correspondre à un
   * champ que l'écran demande. Citer les champs les figerait.
   */
  it('tout refus de saisie a son champ dans le tunnel', () => {
    const { corps } = derniereDefinition('reserver_ma_mission')
    const refus = new Set(
      [...corps.matchAll(/'code', '(\w+)'/g)].map((m) => m[1]))
    const tunnel = sansCommentaires(
      readFileSync(path.join(racine, 'web/components/vitrine/PageReserver.tsx'), 'utf8'))
    // Ce que l'écran sait saisir, déduit de ses `setX(` — pas d'une liste.
    const saisis = new Set(
      [...tunnel.matchAll(/set([A-Z]\w+)\(/g)].map((m) => m[1].toLowerCase()))
    const correspond: Record<string, string> = {
      code_postal: 'codepostal', adresse: 'adresse', magasin: 'magasin',
      entreprise: 'societe', siren: 'siren', articles: 'tranchearticles',
      date: 'jour', engagement: 'engage', formule: 'formule',
    }
    const orphelins = [...refus]
      .filter((r) => r in correspond)
      .filter((r) => !saisis.has(correspond[r]))
    expect(orphelins, `la base refuse sur ${orphelins.join(', ')} et l’écran ne le demande jamais`)
      .toEqual([])
  })

  it('⚠️ et le bouton du compte exige le SIREN et le magasin', () => {
    const tunnel = sansCommentaires(
      readFileSync(path.join(racine, 'web/components/vitrine/PageReserver.tsx'), 'utf8'))
    const complet = /const compteComplet =[\s\S]*?\n\n/.exec(tunnel)?.[0] ?? ''
    expect(complet, 'la complétude du compte ne se lit plus').not.toBe('')
    expect(complet, 'le SIREN est redevenu facultatif alors que la base l’exige')
      .toContain('siren')
    expect(complet, 'le magasin n’est plus exigé : le client paiera sans lieu à inventorier')
      .toContain('magasinComplet')
  })
})

/**
 * ⚠️⚠️ **UN INVENTAIRE EST TOUJOURS RATTACHÉ À UN MAGASIN, ET LE CLIENT
 * CONNECTÉ DOIT POUVOIR DIRE LEQUEL** (Julien, 10 octobre 2026 : « je peux
 * avoir plusieurs magasins »).
 *
 * Le parcours connecté sautait l'étape du compte et réservait directement
 * depuis l'écran du prix : il n'était JAMAIS interrogé sur le lieu. Tant que
 * la licence se passait d'adresse, ça ne se voyait pas. Depuis que le code
 * postal est exigé en base, il se faisait refuser — et renvoyer sur un écran
 * qui n'a pas de champ d'adresse. Un cul-de-sac complet.
 */
describe('⚠️⚠️ le client connecté dit pour quel magasin il réserve', () => {
  const src = () => sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))

  /**
   * Le corps JSX d'une étape.
   *
   * ⚠️ **UNE ÉTAPE PEUT AVOIR PLUSIEURS BLOCS**, et les prendre pour un seul
   * rend la garde aveugle : l'étape 4 en a deux — avec prix et sans —, et une
   * version qui s'arrêtait au premier laissait passer le défaut qu'elle
   * surveille. Vu en la sabotant. On les recolle tous.
   */
  const ecran = (texte: string, n: number) => {
    const bornes = [...texte.matchAll(/\{etape === (\d)/g)]
    let corps = ''
    for (let i = 0; i < bornes.length; i++) {
      if (Number(bornes[i][1]) !== n) continue
      const d = bornes[i].index!
      const f = i + 1 < bornes.length ? bornes[i + 1].index! : texte.length
      corps += texte.slice(d, f)
    }
    return corps
  }

  it('aucun chemin ne réserve sans être passé par l’étape du magasin', () => {
    // ⚠️ On ne cite pas les boutons : on cherche tout appel qui réserve
    // depuis un `onClick`, et on exige qu'il vienne de l'écran où le lieu se
    // saisit. Ailleurs, le client réserverait un inventaire sans lieu.
    const texte = src()
    const etapeDuMagasin = [1, 2, 3, 4, 5, 6, 7]
      .filter((n) => ecran(texte, n).includes('setCodePostal'))
    expect(etapeDuMagasin, 'plus aucun écran ne demande le code postal')
      .not.toEqual([])

    for (const n of [1, 2, 4]) {
      expect(
        ecran(texte, n),
        `l’étape ${n} réserve directement, sans avoir demandé le magasin`,
      ).not.toMatch(/onClick=\{[^}]*reserverMaintenant\(\)/)
    }
  })

  it('⚠️ et un refus de lieu ramène sur un écran qui porte le champ', () => {
    // LE DÉFAUT : `code_postal` ramenait à l'étape 1, qui pour une licence est
    // l'écran du VOLUME. On reprochait au client une adresse qu'aucun champ
    // visible ne lui permettait de corriger.
    const texte = src()
    const table = /const etapeDuRefus[\s\S]*?\n  \}/.exec(texte)?.[0] ?? ''
    expect(table, 'la table des refus a disparu').not.toBe('')

    for (const code of ['adresse', 'code_postal', 'magasin']) {
      const ligne = new RegExp(`${code}: logicielSeul \\? (\\d+) :`).exec(table)
      expect(ligne, `le refus « ${code} » ne distingue plus la formule`).toBeTruthy()
      const n = Number(ligne![1])
      expect(
        ecran(texte, n),
        `le refus « ${code} » renvoie à l’étape ${n}, qui n’a pas de champ d’adresse`,
      ).toContain('setCodePostal')
    }
  })

  /**
   * ⚠️ **LA LISTE DES ÉTABLISSEMENTS EST ÉCRITE UNE FOIS.** Deux copies
   * divergent au premier changement — c'est la règle de la coquille.
   */
  it('⚠️ la liste des établissements n’existe qu’en un exemplaire', () => {
    const copies = [...src().matchAll(/res-etabs-tete/g)]
    expect(copies.length, 'la liste des établissements a été recopiée')
      .toBe(1)
  })

  it('⚠️ un bouton « réserver » par établissement porte son établissement', () => {
    // Les trois lignes de « Réserver à nouveau » menaient au même
    // `/reserver` nu : le client désignait un magasin et arrivait sur un
    // tunnel qui l'ignorait.
    const page = sansCommentaires(lire('web/app/on-demand/mes-inventaires/page.tsx'))
    const liste = /etablissements\.map\(\([\s\S]*?\n            \}\)\}/.exec(page)?.[0] ?? ''
    expect(liste, 'la liste des établissements a disparu de l’espace client').not.toBe('')
    expect(liste, 'la ligne d’un établissement mène à un tunnel qui ne le connaît pas')
      .toMatch(/href=\{`\/reserver\?etablissement=/)

    // Et le tunnel sait lire ce qu'on lui envoie.
    expect(src(), 'le tunnel ignore l’établissement qu’on lui désigne')
      .toMatch(/get\('etablissement'\)/)
  })
})

/**
 * ⚠️⚠️ **« REPRENDRE » DOIT REPRENDRE, ET LA SORTIE DOIT ÊTRE OUVERTE**
 * (Julien, 10 octobre 2026).
 *
 * Le message « vous avez déjà un compte » portait un bouton « Reprendre ma
 * réservation » qui ramenait sur la PREMIÈRE question : le tunnel garde ses
 * réponses par navigateur, mais pas son étape. Tout était là, et il fallait
 * pourtant recliquer tout le parcours. Et il disait « la page de connexion
 * sait réinitialiser » sans jamais donner l'adresse : on décrivait une sortie
 * au lieu de l'ouvrir.
 */
describe('⚠️⚠️ le message « vous avez déjà un compte »', () => {
  const fonction = () => sansCommentaires(lire('supabase/functions/inscription/index.ts'))

  it('le bouton ramène où le client en était, et le tunnel sait le lire', () => {
    const src = fonction()
    const chemin = /reserver: \{ chemin: '([^']+)'/.exec(src)?.[1]
    expect(chemin, 'le retour vers la réservation a disparu').toBeTruthy()

    // ⚠️ On ne cite pas le nom du paramètre : on le LIT dans le chemin, et on
    // exige que le tunnel lise le même. Le renommer d'un seul côté remettrait
    // le client à la première question, en silence.
    const cle = /\?([a-z_]+)=/.exec(chemin!)?.[1]
    expect(cle, `« ${chemin} » ne porte aucun paramètre de reprise`).toBeTruthy()

    const tunnel = sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
    expect(tunnel, `le tunnel ignore « ${cle} » : le bouton rouvrira la première question`)
      .toContain(`get('${cle}')`)
  })

  it('⚠️ et il DONNE le lien du mot de passe, au lieu de le décrire', () => {
    const src = fonction()
    const bloc = src.slice(src.indexOf("outcome === 'compte_existant'"))
    const corps = bloc.slice(0, bloc.indexOf('await envoyerEmail'))
    const lien = /lienSecondaire: \{[\s\S]*?lien: `\$\{site\(\)\}([^`]+)`/.exec(corps)?.[1]
    expect(lien, 'le message ne donne plus de lien pour le mot de passe').toBeTruthy()

    // Et cette page existe vraiment : un lien d'e-mail vers une page absente
    // est pire que pas de lien du tout.
    expect(
      existsSync(path.join(racine, 'web/app', lien!.replace(/^\//, ''), 'page.tsx')),
      `le message renvoie vers ${lien}, qui n’existe pas`,
    ).toBe(true)
  })
})

/**
 * ⚠️⚠️ **`!messageSiren()` NE VAUT PAS « SIREN VALIDE ».**
 *
 * `messageSiren` se TAIT tant que le numéro est incomplet — c'est voulu, on ne
 * harcèle pas quelqu'un qui tape. S'en servir comme condition laissait passer
 * « 5521 » : bouton allumé, code envoyé, compte créé, puis la base refusait la
 * réservation sur `siren`. Le mur arrivait APRÈS la création du compte.
 */
describe('⚠️ le tunnel exige un SIREN valide, et dit pourquoi', () => {
  it('les deux fonctions ne disent PAS la même chose', () => {
    // La garde tient la raison, pas seulement la conséquence : si un jour
    // `messageSiren` se mettait à parler dès le premier chiffre, ce test
    // tomberait et la règle ci-dessous serait à relire.
    expect(messageSiren('5521'), '`messageSiren` ne se tait plus sur un numéro court')
      .toBeNull()
    expect(sirenValide('5521'), '`sirenValide` accepte un numéro court').toBe(false)
  })

  it('⚠️ et c’est `sirenValide` qui garde le bouton', () => {
    const tunnel = sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
    const complet = /const compteComplet =[\s\S]*?\n\n/.exec(tunnel)?.[0] ?? ''
    expect(complet, 'la condition du bouton a disparu').not.toBe('')
    expect(complet, 'le bouton se contente de `messageSiren`, qui se tait sur un numéro court')
      .toContain('sirenValide(siren)')
  })

  it('⚠️ et un bouton éteint dit pourquoi', () => {
    // La règle est écrite deux fois dans le projet (« un bouton mort dit
    // pourquoi ») : elle manquait sous ce champ-ci.
    const tunnel = sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
    expect(tunnel, 'un SIREN refusé n’affiche plus rien sous le champ')
      .toMatch(/!sirenValide\(siren\) && \(/)
    expect(tunnel, 'une adresse incomplète éteint le bouton sans un mot')
      .toMatch(/courriel\.trim\(\) !== '' && !\/\.\+@/)
  })
})

/**
 * ⚠️⚠️ **LE SIREN DONNE LA RAISON SOCIALE** (Julien, 10 octobre 2026 :
 * « remplir le numéro siren donne la désignation sociale automatiquement »).
 *
 * Le tunnel demandait les deux à la main, côte à côte : deux champs pour un
 * seul fait, et c'est celui qui est TAPÉ qui part sur la facture. Or le SIREN
 * est l'adresse de routage de la facture électronique, et le registre donne le
 * nom exact.
 */
describe('⚠️ le SIREN remplit la raison sociale', () => {
  const src = () => sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
  const corps = (texte: string) => {
    const d = texte.indexOf('const reprendreLaSociete')
    return d < 0 ? '' : texte.slice(d, texte.indexOf('\n  }', d))
  }

  it('le champ SIREN interroge le registre', () => {
    const texte = src()
    expect(corps(texte), 'la reprise depuis le registre a disparu')
      .toContain('chercherParSiren')
    // Et elle est bien branchée sur la saisie, pas seulement écrite.
    const champ = /onChange=\{\(e\) => \{[\s\S]{0,240}?formaterSiren[\s\S]{0,240}?\}\}/.exec(texte)?.[0] ?? ''
    expect(champ, 'le champ SIREN ne déclenche plus la reprise')
      .toContain('reprendreLaSociete')
  })

  it('⚠️ elle n’interroge pas le registre pour un numéro invalide', () => {
    // La clé de Luhn se vérifie en local : filtrer avant, c'est autant
    // d'appels en moins au registre public — et rien de perdu.
    const b = corps(src())
    const avant = b.slice(0, b.indexOf('chercherParSiren'))
    expect(avant, 'le registre est interrogé avant d’avoir vérifié la clé')
      .toMatch(/if \(!sirenValide\([\s\S]*?return/)
  })

  /**
   * ⚠️ **LA DERNIÈRE RÉPONSE GAGNE, PAS LA PLUS LENTE.** Corriger un chiffre
   * lance un second appel ; sans jeton, une réponse tardive du numéro
   * PRÉCÉDENT écraserait la bonne, et le client partirait avec la raison
   * sociale d'une autre société — sur une facture.
   */
  it('⚠️ une réponse en retard n’écrase pas la bonne', () => {
    const b = corps(src())
    const jeton = /const (\w+) = \+\+\w+\.current/.exec(b)?.[1]
    expect(jeton, 'aucun jeton ne protège la reprise : deux appels peuvent se doubler')
      .toBeTruthy()

    const apres = b.slice(b.indexOf('await chercherParSiren'))
    expect(apres, 'le jeton n’est pas relu après l’attente : il ne protège rien')
      .toContain(jeton!)
    const garde = apres.slice(0, apres.indexOf('setSociete'))
    expect(garde, 'rien n’abandonne une réponse périmée avant d’écrire')
      .toMatch(/return/)
  })

  it('⚠️ et le registre remplit, il ne refuse pas', () => {
    // Même règle que sur l'inscription : `introuvable` couvre AUSSI une
    // société qui a demandé la non-diffusion de ses données. La refuser
    // accuserait un vrai client de ne pas exister.
    const texte = src()
    const complet = /const compteComplet =[\s\S]*?\n\n/.exec(texte)?.[0] ?? ''
    expect(complet, 'la condition du bouton a disparu').not.toBe('')
    expect(complet, 'le registre est devenu une condition du bouton')
      .not.toMatch(/registre|chercherParSiren|introuvable/)
  })
})

/**
 * ⚠️⚠️ **L'ÉCRAN « AU NOM DE QUELLE ENTREPRISE ? » EST UNE SORTIE DE
 * SECOURS** (10 octobre 2026, en cherchant pourquoi un compte créé la veille
 * « ne marchait pas »).
 *
 * On n'y arrive QUE parce qu'une réservation vient d'échouer : la base a
 * répondu `entreprise` ou `siren`. C'est donc l'écran où l'on peut le moins
 * se permettre une boucle — et il laissait passer un SIREN quelconque, que la
 * base refusait aussitôt, ramenant ici sans que rien n'indique quoi changer.
 *
 * ⚠️ La base traite un `employee` comme un nouveau venu : elle annule son
 * entreprise, puis exige raison sociale ET SIREN valide. Un compteur invité
 * par quelqu'un d'autre passe donc toujours par ici.
 */
describe('⚠️ la sortie de secours ne boucle pas', () => {
  const src = () => sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
  const ecran8 = (texte: string) => {
    const d = texte.indexOf('{etape === 8 &&')
    return d < 0 ? '' : texte.slice(d)
  }

  it('la base exige un SIREN VALIDE pour fabriquer l’entreprise', () => {
    // On le relit dans la migration : si elle se relâchait, l'écran pourrait
    // se relâcher aussi — mais pas avant.
    const { corps } = derniereDefinition('reserver_ma_mission')
    expect(corps, 'la création d’entreprise n’exige plus de SIREN valide')
      .toMatch(/siren_valide\([\s\S]{0,60}?\)\s*then[\s\S]{0,120}?'siren'/)
    expect(corps, 'un compteur n’est plus traité comme un nouveau venu')
      .toMatch(/v_role = 'employee'[\s\S]{0,80}?v_company := null/)
  })

  it('⚠️ et l’écran l’exige aussi, au lieu de laisser la base refuser', () => {
    const bloc8 = ecran8(src())
    expect(bloc8, 'l’écran de l’entreprise a disparu').not.toBe('')
    const bouton = /disabled=\{occupe[\s\S]{0,200}?\}/.exec(bloc8)?.[0] ?? ''
    expect(bouton, 'le bouton de secours a disparu').not.toBe('')
    expect(bouton, 'un SIREN quelconque repart vers la base, qui le refusera')
      .toContain('sirenValide(siren)')
  })

  it('⚠️ le SIREN y remplit la raison sociale, comme ailleurs', () => {
    // Deux champs pour un seul fait, sur l'écran de quelqu'un qui vient
    // d'échouer : c'est là qu'on lui en demande le moins.
    const bloc8 = ecran8(src())
    expect(bloc8, 'le SIREN de la sortie de secours ne reprend pas le registre')
      .toContain('reprendreLaSociete')
    expect(bloc8, 'un SIREN refusé n’affiche rien sous le champ')
      .toMatch(/!sirenValide\(siren\) && \(/)
  })
})

/**
 * ⚠️⚠️ **UNE RÉSERVATION SANS CARTE SE RELANCE** (Julien, 10 octobre 2026 :
 * « on envoie un lien au bout d'un moment pour inviter le client à finaliser
 * sa réservation »).
 *
 * Ce n'est plus le compte qui peut rester en plan — il part avec la
 * réservation. Le seul abandon encore possible est la CARTE, et il est
 * silencieux : la réservation existe, le prix est figé, mais la fenêtre
 * d'accès n'est pas ouverte. Le client croit avoir réservé.
 */
describe('⚠️⚠️ la réservation sans carte se relance', () => {
  it('on ne relance que ce qui précède la carte', () => {
    // ⚠️ Les états ne sont pas cités de mémoire : ce sont ceux où
    // `enregistrer_l_empreinte` trouve la mission quand elle fait son travail.
    // Relancer au-delà écrirait à quelqu'un qui a déjà donné sa carte.
    const { corps } = derniereDefinition('missions_a_relancer')
    expect(corps, 'la relance ne regarde plus la fenêtre d’accès')
      .toMatch(/acces_ouverts_le is null/)
    expect(corps, 'on relancerait une réservation annulée')
      .toMatch(/annulee_le is null/)
    expect(corps, 'on relancerait après la date : ça ne sert plus à rien')
      .toMatch(/debut_prevu > now\(\)/)

    const empreinte = derniereDefinition('enregistrer_l_empreinte').corps
    const avantLaCarte = [...corps.matchAll(/'(brouillon|prix_calcule|paiement_autorise|confirmee|prete)'/g)]
      .map((m) => m[1])
    expect(avantLaCarte.length, 'la relance ne dit plus quels états elle vise')
      .toBeGreaterThan(0)
    for (const etat of avantLaCarte) {
      expect(
        empreinte,
        `« ${etat} » n’est pas un état d’avant la carte : la relance écrirait à qui a déjà payé`,
      ).toContain(`'${etat}'`)
    }
  })

  it('⚠️ trois fois, jamais quatre, et jamais deux dans l’heure', () => {
    const { corps } = derniereDefinition('missions_a_relancer')
    expect(corps, 'le compte des relances n’est plus borné')
      .toMatch(/relances < array_length/)
    expect(corps, 'deux passages du tour de garde peuvent en envoyer deux')
      .toMatch(/derniere_relance_le < now\(\) - interval/)

    // Le marquage borne AUSSI : la lecture seule ne suffit pas si l'écriture
    // peut dépasser.
    const marque = derniereDefinition('marquer_relance_mission').corps
    expect(marque, 'le marquage ne borne plus le nombre de relances')
      .toMatch(/relances < \d/)
  })

  /**
   * ⚠️ **ON MARQUE APRÈS L'ENVOI, JAMAIS AVANT.** Un e-mail qui ne part pas
   * laisse la relance ouverte, et l'heure suivante réessaie. L'ordre inverse
   * la ferait taire pour de bon sur un incident réseau d'une seconde.
   */
  it('⚠️ l’envoi précède le marquage', () => {
    const fn = sansCommentaires(lire('supabase/functions/relance-reservation/index.ts'))
    // ⚠️ **DANS LE BLOC QUI ENVOIE, PAS DANS LE FICHIER.** Première version :
    // `fn.indexOf('envoyerEmail')` — qui tombait sur la LIGNE D'IMPORT, en
    // tête de fichier, donc toujours avant le marquage. La garde passait au
    // vert sur un fichier où l'ordre était inversé. Trouvé en la sabotant.
    const essai = /try \{([\s\S]*?)\} catch/.exec(fn)?.[1] ?? ''
    expect(essai, 'le bloc d’envoi de la relance ne se lit plus').not.toBe('')
    const envoi = essai.indexOf('envoyerEmail')
    const marque = essai.indexOf('marquer_relance_mission')
    expect(envoi, 'la relance n’envoie plus rien').toBeGreaterThan(-1)
    expect(marque, 'la relance ne marque plus rien').toBeGreaterThan(-1)
    expect(marque, 'on marque avant d’envoyer : un incident réseau la ferait taire')
      .toBeGreaterThan(envoi)
  })

  it('⚠️ le lien mène à la carte, pas au début du tunnel', () => {
    const fn = sansCommentaires(lire('supabase/functions/relance-reservation/index.ts'))
    const lien = /const lien = `\$\{appUrl\}([^`]+)`/.exec(fn)?.[1]
    expect(lien, 'le lien de la relance a disparu').toBeTruthy()
    expect(lien, 'la relance renvoie au début du tunnel : il recommencerait tout')
      .toMatch(/mission=/)

    // Et le tunnel sait ouvrir l'écran de la carte sur cette adresse.
    const tunnel = sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
    expect(tunnel, 'le tunnel ne lit plus la mission de l’adresse')
      .toMatch(/params\.get\('mission'\)/)
    expect(tunnel, 'le tunnel ne lit plus le retour de carte')
      .toMatch(/params\.get\('carte'\)/)
  })

  /**
   * ⚠️⚠️ **REVENIR POUR SA CARTE NE RÉSERVE PAS UNE SECONDE FOIS.** Le lien
   * de la relance mène à une réservation DÉJÀ prise ; si le client doit
   * s'identifier en chemin, `seConnecter()` enchaînait sur une réservation.
   * Deux missions, deux prix, pour un seul inventaire — et le garde-fou de
   * `reserver_ma_mission` annule la précédente, donc ça ne se verrait même
   * pas tout de suite.
   */
  it('⚠️⚠️ se reconnecter pour la carte ne réserve pas deux fois', () => {
    const tunnel = sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
    const corps = /const seConnecter = async \(\) => \{[\s\S]*?\n  \}/.exec(tunnel)?.[0] ?? ''
    expect(corps, 'la connexion du tunnel a disparu').not.toBe('')
    const avant = corps.slice(0, corps.indexOf('reserverMaintenant'))
    expect(avant, 'une reconnexion avec une mission en main réserve une seconde fois')
      .toMatch(/if \(missionId\)/)
  })

  it('⚠️ et l’écran de la carte sait qu’on peut y arriver sans session', () => {
    // On y arrive depuis un e-mail. `missionEmpreinte` passe par une fonction
    // edge qui exige un jeton : sans ce détour, le bouton échouait sur un
    // message technique, au bout d'un e-mail dont c'était tout le propos.
    const tunnel = sansCommentaires(lire('web/components/vitrine/PageReserver.tsx'))
    const ecran = tunnel.slice(tunnel.indexOf('{etape === 7 && missionId && !carteEnregistree'))
    const bloc = ecran.slice(0, ecran.indexOf('{etape === 7 && missionId && carteEnregistree'))
    expect(bloc, 'l’écran de la carte a disparu').not.toBe('')
    expect(bloc, 'l’écran de la carte ignore qu’on peut y arriver sans session')
      .toMatch(/connecte === false/)
  })

  /**
   * ⚠️⚠️ **L'ADRESSE DU PROJET VIT DANS LE COFFRE, PAS DANS LA FONCTION.**
   * `declencher_alerte` porte celle de la production EN DUR. Ce chantier vit
   * sur DEUX projets — le jumeau aujourd'hui, la production le jour J — et
   * une adresse en dur ferait relancer les clients de l'un depuis l'autre.
   */
  it('⚠️ le déclencheur ne porte aucune adresse en dur', () => {
    const { corps } = derniereDefinition('declencher_relance_reservation')
    expect(corps, 'le déclencheur porte une adresse de projet en dur')
      .not.toMatch(/https:\/\/[a-z0-9]+\.supabase\.co/)
    expect(corps, 'l’adresse ne vient plus du coffre')
      .toMatch(/base_fonctions/)
    // Et sans secret, il ne fait rien : la tâche est inoffensive avant d'être
    // configurée.
    expect(corps, 'le déclencheur part sans vérifier que les secrets sont là')
      .toMatch(/is null[\s\S]{0,120}?return/)
  })
})
