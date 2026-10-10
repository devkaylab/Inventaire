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
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'
import { venteOuverte } from '../lib/legal'

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

  it('⚠️ et le compte créé enchaîne, il ne laisse pas sur un écran d’attente', () => {
    // Il est venu réserver, pas ouvrir un compte. La même raison que
    // `seConnecter()`, qui réserve dans la foulée depuis le 5 octobre.
    const tunnel = sansCommentaires(
      readFileSync(path.join(racine, 'web/components/vitrine/PageReserver.tsx'), 'utf8'))
    const apresCreation = tunnel.slice(tunnel.indexOf("action: 'creer'"))
    const suite = apresCreation.slice(0, apresCreation.indexOf('\n  }'))
    expect(suite, 'le compte est créé mais la réservation ne repart pas')
      .toContain('reserverMaintenant()')
  })
})
