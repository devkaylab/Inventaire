/**
 * Le libre-service : changer d'offre, ajouter un magasin — sans devis.
 * (4 septembre 2026)
 *
 * ⚠️ CES GARDES PORTENT SUR LE CHEMIN DE L'ARGENT. Ce qui casse ici ne se voit
 * pas à l'écran : un client paie, ou ne paie pas, ou paie deux fois. Chacune a
 * été mise en défaut par sabotage avant d'être gardée.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, fichierDe } from './migrations'
import { APPAREILS_MAX, OFFRES, PLAFOND_LIBRE_SERVICE, SUPPLEMENT, prixCents } from '@/lib/offres'
import { PALIERS_APPAREILS, compositionOffre, proposer } from '@/lib/appareils'

const racine = path.resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

const edge = lire('supabase/functions/libre-service/index.ts')
const stripeShared = lire('supabase/functions/_shared/stripe.ts')
const payer = lire('web/components/PayerEnLigne.tsx')

/**
 * ⚠️ Toute assertion d'ABSENCE lit le code sans ses commentaires. Ces fichiers
 * expliquent précisément ce qu'ils ne font pas — donc ils en citent les mots.
 * Le piège s'est présenté cinq fois sur ce dépôt.
 */
function sansCommentaires(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*(--|\/\/).*$/gm, ' ')
}

const espaces = (s: string) => s.replace(/\s+/g, ' ')

describe('la grille en base est celle du site', () => {
  const { corps } = derniereDefinition('prix_offre')
  const plat = espaces(corps)

  it.each(OFFRES.map((o) => [o.cle, o] as const))(
    'porte %s au montant de web/lib/offres.ts',
    (_cle, o) => {
      // ⚠️ Quatrième copie de la grille, et la seule que les deux dépôts
      // puissent utiliser sans qu'un client puisse se déposer une demande à un
      // centime : ils sont appelés avec le jeton du client, pas en clé de
      // service. Elle doit donc suivre `web/lib/offres.ts` au centime.
      expect(plat).toContain(`v_plan := '${o.cle}'`)
      expect(plat).toContain(`v_plafond := ${o.max};`)
      expect(plat).toContain(`v_mois := ${o.mois * 100};`)
      expect(plat).toContain(`v_an := ${o.an * 100};`)
    },
  )

  it('prolonge Enterprise par tranches de dix entamées, au tarif du supplément', () => {
    expect(plat).toContain(`/ ${SUPPLEMENT.par}.0`)
    expect(plat).toContain(`v_t * ${SUPPLEMENT.mois * 100}`)
    expect(plat).toContain(`v_t * ${SUPPLEMENT.an * 100}`)
  })

  it('a les mêmes paliers que le module de jugement', () => {
    for (const palier of PALIERS_APPAREILS) expect(plat).toContain(`v_plafond := ${palier};`)
  })

  it('distingue ce qui est facturé à l’échéance de ce que le magasin vaut à l’année', () => {
    // La règle des lignes de devis du 2 septembre 2026 : `prixCents` est
    // l'échéance, `annuelCents` l'année. Les confondre facture douze fois trop
    // cher, ou douze fois trop peu.
    expect(plat).toContain("'prix_cents', case when p_billing_period = 'monthly' then v_mois else v_an end")
    expect(plat).toContain("'annuel_cents', case when p_billing_period = 'monthly' then v_mois * 12 else v_an end")
  })
})

describe('les droits', () => {
  it('n’ouvre aucune des fonctions du libre-service à anon', () => {
    // ⚠️ `create` accorde EXECUTE à PUBLIC **et** à `anon` par les droits par
    // défaut de Supabase : un `revoke … from public` seul ne suffit pas.
    for (const fn of [
      'prix_offre',
      'etat_abonnement_magasin',
      'deposer_ajout_magasin',
      'deposer_changement_offre',
      'appliquer_changement_offre',
      'peut_changer_offre',
    ]) {
      // ⚠️ UN `fichierDe(fn)` NE PARLE QUE DE `fn`. Se servir du fichier de la
      // voisine, c'est valider des droits que plus personne ne pose le jour où
      // une migration redéfinit l'une des deux (payé le 4 septembre 2026).
      const f = fichierDe(fn)
      expect(f, fn).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\)\\s*\\n?\\s*from public, anon`))
    }
  })

  it('ne laisse aucun client écrire une licence ni lire la plomberie Stripe', () => {
    for (const fn of ['etat_abonnement_magasin', 'appliquer_changement_offre']) {
      const f = fichierDe(fn)
      expect(f, fn).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]{0,80}?from public, anon, authenticated`))
      expect(f, fn).toContain(`to service_role;`)
    }
  })
})

describe('on ne facture jamais deux fois', () => {
  const { corps } = derniereDefinition('deposer_changement_offre')
  const plat = espaces(sansCommentaires(corps))

  it('refuse le dépôt quand l’entreprise a déjà un abonnement', () => {
    // ⚠️ LE POINT LE PLUS COÛTEUX DE CE CHANTIER. Une seconde session Checkout
    // ouvrirait un SECOND abonnement Stripe : le client paierait les deux
    // offres en même temps, et rien ne le signalerait. Le changement se fait
    // sur l'abonnement existant, par l'API.
    expect(plat).toContain("'abonnement_en_cours'")
    expect(plat).toContain('v_store.stripe_subscription_id')
  })

  it('refuse un second changement en cours pour le même magasin', () => {
    expect(plat).toContain("'deja_en_cours'")
  })

  it('ne vend rien quand le forfait couvre déjà le besoin', () => {
    expect(plat).toContain("'deja_couvert'")
    expect(plat).toContain('public.plafond_appareils(p_store_id)')
  })

  it('garde sur l’entreprise DU MAGASIN, jamais sur un paramètre de l’appelant', () => {
    expect(plat).toContain('public.is_company_admin(v_store.company_id)')
    expect(plat).not.toMatch(/is_company_admin\(p_company/)
  })
})

describe('le webhook met à jour au lieu de créer', () => {
  const { corps } = derniereDefinition('fulfil_paid_request')
  const sans = sansCommentaires(corps)

  it('porte une branche pour le changement d’offre', () => {
    expect(sans).toContain("if v_sto.kind = 'offre' then")
    expect(sans).toContain("'kind', 'store_offer'")
  })

  it('ne crée AUCUN magasin dans cette branche', () => {
    // ⚠️ Sans ce contrôle, un changement d'offre fabriquerait un second magasin
    // avec un second code d'accès, et le client paierait pour deux.
    const debut = sans.indexOf("if v_sto.kind = 'offre' then")
    const fin = sans.indexOf('v_store_code := public.gen_store_code();', debut)
    expect(debut).toBeGreaterThan(0)
    expect(fin).toBeGreaterThan(debut)
    const branche = sans.slice(debut, fin)
    expect(branche).not.toContain('gen_store_code')
    expect(branche).not.toContain('insert into public.stores')
    expect(branche).toContain('update public.stores')
  })

  it('n’écrase jamais un abonnement déjà enregistré', () => {
    const debut = sans.indexOf("if v_sto.kind = 'offre' then")
    const branche = sans.slice(debut, sans.indexOf('v_store_code := public.gen_store_code();', debut))
    expect(espaces(branche)).toContain('stripe_subscription_id = coalesce(stripe_subscription_id, v_sub)')
  })
})

describe('la console ne crée pas de magasin sur un changement d’offre', () => {
  it('refuse tout genre autre que « add »', () => {
    // Une demande `offre` passe par `paid` comme une autre : sans ce refus, le
    // bouton « Créer le magasin » de la fiche entreprise fabriquerait un doublon.
    const { corps } = derniereDefinition('admin_fulfil_store_request')
    expect(espaces(sansCommentaires(corps))).toContain("if v_req.kind <> 'add' then")
  })

  it('range un changement d’offre sous son propre genre dans le pipeline', () => {
    const { corps } = derniereDefinition('admin_pipeline')
    expect(espaces(corps)).toContain("when 'offre' then 'store_offer'")
  })

  it('ne devise pas un changement d’offre', () => {
    const { corps } = derniereDefinition('admin_quote_store_request')
    expect(espaces(sansCommentaires(corps))).toContain("if v_req.kind <> 'add' then")
  })
})

describe('la fonction edge', () => {
  const sans = sansCommentaires(edge)

  it('vérifie le Price AVANT toute écriture', () => {
    // ⚠️ Règle du 30 août 2026 : une demande enregistrée sans page de paiement
    // derrière laisse une ligne morte et un client persuadé d'avoir souscrit.
    const price = sans.indexOf('if (!stripeKey || !priceOffre) return indisponible()')
    const depotMagasin = sans.indexOf("'deposer_ajout_magasin'")
    const depotOffre = sans.indexOf("'deposer_changement_offre'")
    expect(price).toBeGreaterThan(0)
    expect(depotMagasin).toBeGreaterThan(price)
    expect(depotOffre).toBeGreaterThan(price)
  })

  it('ne recopie aucune grille : le tarif vient de la base', () => {
    expect(sans).toContain("appelant.rpc('prix_offre'")
    for (const o of OFFRES) {
      expect(sans, o.nom).not.toContain(String(o.mois * 100))
      expect(sans, o.nom).not.toContain(String(o.an * 100))
    }
  })

  it('ne crée jamais de Price', () => {
    expect(sans).not.toContain('price_data')
    expect(sans).toContain('STRIPE_PRICE_')
  })

  it('demande la garde plutôt que de la déduire', () => {
    // Le refus `abonnement_en_cours` prouverait l'autorisation — mais une
    // autorisation qui tient à l'ordre des `if` d'une autre fonction se perd au
    // premier réagencement.
    const garde = sans.indexOf("'peut_changer_offre'")
    const etat = sans.indexOf("'etat_abonnement_magasin'")
    expect(garde).toBeGreaterThan(0)
    expect(etat).toBeGreaterThan(garde)
  })

  it('appelle les RPC gardées avec le jeton de l’appelant, jamais en clé de service', () => {
    for (const rpc of ['deposer_ajout_magasin', 'deposer_changement_offre', 'peut_changer_offre']) {
      expect(sans, rpc).toContain(`appelant.rpc('${rpc}'`)
      expect(sans, rpc).not.toContain(`service.rpc('${rpc}'`)
    }
  })

  it('garde la plomberie Stripe pour la clé de service', () => {
    expect(sans).toContain("service.rpc('etat_abonnement_magasin'")
    expect(sans).toContain("service.rpc('appliquer_changement_offre'")
  })

  it('porte le même interrupteur de TVA que le site', () => {
    const site = lire('web/lib/offres.ts')
    const souscrire = lire('supabase/functions/subscribe-online/index.ts')
    const valeur = (src: string) => /TVA_APPLICABLE\s*=\s*(true|false)/.exec(src)?.[1]
    expect(valeur(edge)).toBe(valeur(site))
    expect(valeur(edge)).toBe(valeur(souscrire))
  })
})

describe('le prorata est facturé tout de suite', () => {
  it('modifie l’article de l’abonnement plutôt que d’en ouvrir un second', () => {
    // Sans `always_invoice`, le client change d'offre et ne paie rien avant sa
    // prochaine échéance.
    const bloc = stripeShared.slice(stripeShared.indexOf('export async function changerPrixArticle'))
    expect(bloc).toContain("proration_behavior: 'always_invoice'")
    expect(bloc).toContain('/subscription_items/')
  })

  it('retire la ligne des appareils quand le client redescend sous cent', () => {
    const bloc = stripeShared.slice(stripeShared.indexOf('export async function poserArticleAppareils'))
    expect(bloc).toContain("method: 'DELETE'")
  })
})

describe('le panneau de paiement', () => {
  const sans = sansCommentaires(payer)

  it('n’a AUCUN repli sur une RPC directe', () => {
    // Règle de `/souscrire` (30 août 2026) : sans la fonction edge il n'y a pas
    // de session Stripe, donc rien à payer. Déposer la demande quand même
    // laisserait quelqu'un persuadé d'avoir souscrit.
    expect(sans).not.toContain('supabase.rpc')
    expect(sans).toContain("supabase.functions.invoke('libre-service'")
  })

  it('affiche les deux rythmes', () => {
    expect(sans).toContain("['monthly', 'yearly']")
  })

  it('relit le corps du refus, que `invoke` jette', () => {
    expect(sans).toContain('ctx instanceof Response')
  })
})

describe('les écrans', () => {
  it('la fiche d’un magasin fait le changement sur place, plus sur /tarifs', () => {
    const fiche = sansCommentaires(lire('web/app/magasins/[storeId]/page.tsx'))
    expect(fiche).toContain('<PayerEnLigne')
    // Le bouton de la proposition ne renvoie plus vers la grille publique : le
    // client y relisait ce qu'il venait de lire, et devait nous écrire.
    expect(fiche).not.toMatch(/href="\/tarifs" className="btn btn-primary/)
  })

  it('la page Magasins crée le magasin au lieu de le demander', () => {
    const page = sansCommentaires(lire('web/app/magasins/page.tsx'))
    expect(page).toContain('libelle="Créer le magasin"')
    // ⚠️ « à garder uniquement : "Créer le magasin" » (Julien, 4 septembre
    // 2026) : le bouton dit l'action, jamais le montant.
    expect(page).not.toContain('Envoyer la demande')
  })

  it('un changement d’offre ne s’affiche pas parmi les demandes de magasin', () => {
    const page = sansCommentaires(lire('web/app/magasins/page.tsx'))
    expect(page).toContain("d.kind !== 'offre'")
  })

  it('le journal nomme les deux gestes du libre-service', () => {
    const journal = lire('web/lib/journal.ts')
    expect(journal).toContain('offre_changee:')
    expect(journal).toContain('offre_appliquee:')
  })
})

describe('un paiement abandonné ne bloque pas', () => {
  // ⚠️ LE DÉFAUT QUE CES GARDES FERMENT. Julien a ouvert la page de paiement,
  // fait retour sans payer, et sa demande s'est affichée « DEVIS ACCEPTÉ » —
  // sans bouton pour payer, sans bouton pour annuler, et sans pouvoir la
  // refaire (le doublon de nom la refusait). Trois portes fermées d'un coup,
  // sur un état parfaitement normal : une session Checkout dure vingt-quatre
  // heures, et fermer l'onglet est le geste le plus banal du monde.
  const magasins = sansCommentaires(lire('web/app/magasins/page.tsx'))
  const fiche = sansCommentaires(lire('web/app/magasins/[storeId]/page.tsx'))

  it('s’annule tant que rien n’est encaissé, mais jamais un devis accepté', () => {
    const { corps } = derniereDefinition('ca_cancel_store_request')
    const plat = espaces(sansCommentaires(corps))
    expect(plat).toContain('paid_at is null')
    // ⚠️ `quote_sent_at` est ce qui distingue les deux parcours : un accord
    // signé sur un montant négocié n'est pas un brouillon, y renoncer est une
    // conversation.
    expect(plat).toContain("status = 'accepted' and quote_sent_at is null")
  })

  it('ne dit pas « devis » d’une demande que personne n’a devisée', () => {
    expect(magasins).toContain("'Paiement à finir'")
    expect(magasins).toContain('function libreService')
  })

  it('laisse les deux sorties sur les deux écrans', () => {
    for (const [nom, src] of [['/magasins', magasins], ['fiche magasin', fiche]] as const) {
      expect(src, nom).toContain('<ReprendrePaiement')
      expect(src, nom).toContain('ca_cancel_store_request')
    }
  })

  it('ne propose pas d’acheter ce qui est déjà en cours d’achat', () => {
    expect(fiche).toContain('!offreEnCours && verdict.etat')
  })

  it('relit la demande au lieu de croire le corps de la requête', () => {
    // Sinon on pourrait changer l'offre entre le dépôt et le paiement.
    const sans = sansCommentaires(edge)
    const debut = sans.indexOf("if (action === 'reprendre') {")
    const fin = sans.indexOf("if (action === 'reprendre' && reprise)")
    const preambule = sans.slice(debut, fin)
    expect(preambule).toContain("appelant.rpc('peut_reprendre_paiement'")
    expect(preambule).toContain("service.rpc('demande_a_reprendre'")
    expect(preambule).toContain('appareils = Number(dem.appareils)')
    // Un devis se règle depuis son lien, qui porte le document signé.
    expect(preambule).toContain('dem.devise === true')
  })

  it('rouvre la session existante avant d’en créer une neuve', () => {
    const sans = sansCommentaires(edge)
    const branche = sans.slice(sans.indexOf("if (action === 'reprendre' && reprise)"))
    const relecture = branche.indexOf('lireSessionCheckout')
    const creation = branche.indexOf('creerAbonnementCheckout')
    expect(relecture).toBeGreaterThan(0)
    expect(creation).toBeGreaterThan(relecture)
    // ⚠️ Et la clé d'idempotence change quand l'ancienne est morte : sinon
    // Stripe rejoue la session expirée et rend une URL inerte.
    expect(branche).toContain('tentative')
  })

  it('ne rend la plomberie qu’à la clé de service', () => {
    const f = fichierDe('demande_a_reprendre')
    expect(f).toMatch(/revoke all on function public\.demande_a_reprendre\([^)]*\)[\s\S]{0,40}?from public, anon, authenticated/)
    const g = fichierDe('peut_reprendre_paiement')
    expect(g).toMatch(/revoke all on function public\.peut_reprendre_paiement\([^)]*\)\s*\n?\s*from public, anon/)
  })
})

describe('le rythme se change avant de payer', () => {
  // Julien : « je suis obligé d'annuler ma demande et de recommencer » — pour
  // un geste qui n'achète rien d'autre : même magasin, mêmes appareils, même
  // offre, seule l'échéance change.
  const { corps } = derniereDefinition('changer_rythme_demande')
  const plat = espaces(sansCommentaires(corps))

  it('recalcule le montant en base, jamais depuis l’appelant', () => {
    // ⚠️ C'est ce qui préserve la règle du dépôt : le client choisit une
    // échéance, pas un prix. `p_billing_period` est le SEUL paramètre en plus
    // de l'identifiant.
    expect(plat).toContain('public.prix_offre(v_req.devices, p_billing_period)')
    expect(corps).not.toMatch(/p_amount|p_prix|p_montant/)
  })

  it('oublie la session Stripe, qui portait l’ancien prix', () => {
    // La rouvrir ferait payer le mensuel à qui vient de choisir l'annuel.
    expect(plat).toContain('stripe_checkout_session_id = null')
  })

  it('ne touche ni à un devis, ni à ce qui est encaissé', () => {
    expect(plat).toContain('v_req.paid_at is not null')
    expect(plat).toContain('v_req.quote_sent_at is not null')
  })

  it('garde sur l’entreprise DE LA DEMANDE', () => {
    expect(plat).toContain('public.is_company_admin(v_req.company_id)')
  })

  it('la clé d’idempotence Stripe porte le prix', () => {
    // ⚠️ Sans lui, passer du mensuel à l'annuel rejouerait la clé de la session
    // précédente : Stripe rendrait l'ANCIENNE session, et le client paierait le
    // mensuel qu'il vient de quitter.
    expect(stripeShared).toContain('`abonnement-${p.requestId}-${p.priceId}-${p.tentative ?? 0}`')
  })

  it('l’edge ne laisse passer que le rythme', () => {
    const sans = sansCommentaires(edge)
    const debut = sans.indexOf("if (action === 'reprendre') {")
    const fin = sans.indexOf("if (action === 'reprendre' && reprise)")
    const preambule = sans.slice(debut, fin)
    expect(preambule).toContain("appelant.rpc('changer_rythme_demande'")
    // Les appareils restent ceux de la demande, quoi que dise la requête.
    expect(preambule).toContain('appareils = Number(dem.appareils)')
    expect(preambule).not.toContain('Number(corps.devices)')
  })

  it('le panneau propose les deux échéances et n’envoie que celle-là', () => {
    const sans = sansCommentaires(payer)
    expect(sans).toContain("body: { action: 'reprendre', requestId, billingPeriod: rythme }")
    expect(sans).toContain('<ChoixRythme')
  })

  it('le journal nomme le geste', () => {
    expect(lire('web/lib/journal.ts')).toContain('rythme_change:')
  })
})

describe('le prix dit comment il se compose', () => {
  // ⚠️ Julien, sur la page Stripe : « pourquoi j'ai un Qté 4 ? ». Il avait
  // saisi 137 appareils ; Stripe décompose en « Enterprise » + « Appareils
  // supplémentaires, Qté 4 », et notre écran n'annonçait que le total. Le
  // montant était juste — c'est l'écran qui n'avait pas prévenu.
  it('décompose au-delà du dernier palier, et pas avant', () => {
    expect(compositionOffre(proposer(2, 7)!)).toBeNull()
    const gros = proposer(100, 137)!
    expect(gros.couvre).toBe(140)
    expect(gros.tranches).toBe(4)
    // ⚠️ Une tranche ENTAMÉE se paie entière : 137 demandés, 140 couverts.
    expect(compositionOffre(gros)).toBe('100 appareils + 4 tranches de 10')
    expect(compositionOffre(proposer(100, 105)!)).toBe('100 appareils + 1 tranche de 10')
  })

  it('le prix décomposé fait bien le total', () => {
    const gros = proposer(100, 137)!
    expect(gros.an).toBe(9450 + 4 * SUPPLEMENT.an)
    expect(gros.mois).toBe(890 + 4 * SUPPLEMENT.mois)
  })

  it('les deux écrans l’affichent', () => {
    for (const [nom, src] of [
      ['/magasins', sansCommentaires(lire('web/app/magasins/page.tsx'))],
      ['fiche magasin', sansCommentaires(lire('web/app/magasins/[storeId]/page.tsx'))],
    ] as const) {
      expect(src, nom).toContain('compositionOffre')
    }
  })
})

describe('l’abonnement suit le magasin', () => {
  // ⚠️ Trouvé en vérifiant le PREMIER PAIEMENT RÉEL : le magasin était créé au
  // bon prix, et `companies.stripe_subscription_id` restait nul. Deux
  // conséquences, et la seconde coûte de l'argent — le cycle de vie de la
  // licence devenait invisible, et le changement d'offre suivant ouvrait un
  // SECOND abonnement.
  const { corps } = derniereDefinition('fulfil_paid_request')
  const sans = sansCommentaires(corps)

  it('note l’abonnement sur le magasin qu’il crée', () => {
    expect(espaces(sans)).toContain('units, sqm, stripe_subscription_id')
  })

  it('n’écrase jamais celui de l’entreprise', () => {
    // Ce serait perdre la trace de ce que le client paie déjà.
    expect(espaces(sans)).toContain('stripe_subscription_id = coalesce(stripe_subscription_id, v_sub)')
  })

  it('le changement d’offre lit celui du MAGASIN d’abord', () => {
    // Une entreprise peut porter plusieurs abonnements : router sur celui de
    // l'entreprise ferait modifier l'article du mauvais magasin.
    for (const fn of ['etat_abonnement_magasin', 'deposer_changement_offre']) {
      const c = espaces(sansCommentaires(derniereDefinition(fn).corps))
      expect(c, fn).toContain('coalesce(s.stripe_subscription_id, c.stripe_subscription_id)')
    }
  })

  it('le cycle de vie retrouve un magasin, pas seulement une entreprise', () => {
    const c = espaces(sansCommentaires(derniereDefinition('sync_subscription_status').corps))
    expect(c).toContain('where s.stripe_subscription_id = v_sub')
  })
})

describe('le magasin créé demande qui le supervise', () => {
  // Julien : « ouvrir un pop-up pour ajouter des superviseurs sur le magasin,
  // ça évite de chercher la page équipe ». Un magasin sans superviseur ne peut
  // pas lancer d'inventaire : le geste suivant est toujours le même.
  const fenetre = sansCommentaires(lire('web/components/QuiSupervise.tsx'))
  const page = sansCommentaires(lire('web/app/magasins/page.tsx'))

  it('n’écrit aucun second chemin d’affectation', () => {
    expect(fenetre).toContain("rpc('ca_set_supervisor_stores'")
    expect(fenetre).not.toContain('.from(')
  })

  it('envoie les magasins de la personne PLUS celui-ci', () => {
    // ⚠️ La fonction REMPLACE la liste : lui envoyer ce seul magasin retirerait
    // la personne de tous les autres.
    expect(fenetre).toContain('[...new Set([...(m.store_ids ?? []), storeId])]')
  })

  it('ne propose pas les administrateurs, qui ont déjà tous les magasins', () => {
    expect(fenetre).toContain("m.role === 'supervisor' && !m.is_company_admin")
  })

  it('attend le webhook avant de conclure qu’il n’y a rien', () => {
    // Stripe renvoie le client dans la seconde ; le magasin naît quand le
    // webhook passe.
    expect(page).toContain("rpc('magasin_cree_par'")
    expect(page).toContain("r.statut === 'created'")
    expect(page).toContain('setTimeout(voir')
  })

  it('nettoie l’adresse pour qu’un rafraîchissement ne rouvre rien', () => {
    expect(page).toContain("window.history.replaceState({}, '', '/magasins')")
  })

  it('l’adresse de retour porte la demande', () => {
    expect(sansCommentaires(edge)).toContain('magasin=ok&demande=')
  })
})

describe('on ne facture pas les tranches deux fois', () => {
  // ⚠️ TROUVÉ EN RELISANT POUR RÉPONDRE À JULIEN, pas par un test. Un magasin
  // né d'un Checkout au-delà de cent appareils porte DÉJÀ une ligne « appareils
  // supplémentaires » chez Stripe, alors que `stores.stripe_item_appareils` est
  // nul : le paiement enregistre l'abonnement, pas le détail de ses lignes.
  // Le chemin d'API ne cherchait que l'article de l'offre — il aurait CRÉÉ un
  // second article de tranches, et le client aurait payé les siennes deux fois.
  const sans = sansCommentaires(edge)

  it('retrouve les DEUX articles dans l’abonnement, pas seulement l’offre', () => {
    expect(sans).toContain('if (!itemOffre || (!itemSuppl && tranches > 0))')
    expect(sans).toContain("itemSuppl = abo.articles.find((a) => a.price === suppl)?.id ?? ''")
  })

  it('n’envoie jamais « pas d’article » quand l’abonnement en a un', () => {
    // Le `null` dit à `poserArticleAppareils` d'en créer un : il ne doit sortir
    // que d'une recherche qui n'a rien trouvé.
    expect(sans).toContain('itemId: itemSuppl || null')
    expect(sans).not.toContain("itemId: String(etat.item_appareils ?? '').trim() || null")
  })
})

/**
 * La grille du libre-service s'arrête à 200 appareils (5 septembre 2026)
 *
 * Julien, en tranchant la décision 3 de la maquette d'inscription : « au bout
 * d'un moment on n'ajoute plus d'appareils, on passe par une autre offre. […]
 * Possible d'ajouter des appareils jusqu'à 200 appareils, au-delà → nouvel
 * abonnement. Au pire le client nous contactera. »
 *
 * La borne valait 1 000, un chiffre posé faute de décision.
 */
describe('la grille s’arrête à 200 appareils', () => {
  const magasins = lire('web/app/magasins/page.tsx')

  it('la base porte la même borne que le site', () => {
    // ⚠️ Cinquième copie assumée de la grille — le site et la base ne compilent
    // pas ensemble. C'est `prix_offre` qui fait foi côté serveur : les deux
    // dépôts la vérifient aussi, mais pour rendre un message lisible.
    const plat = espaces(derniereDefinition('prix_offre').corps)
    expect(plat).toContain(`if p_devices > ${PLAFOND_LIBRE_SERVICE} then`)
  })

  it.each(['deposer_changement_offre', 'deposer_ajout_magasin'])(
    '%s refuse au-delà, avec un code que l’écran peut lire',
    (fn) => {
      const plat = espaces(derniereDefinition(fn).corps)
      expect(plat).toContain(`if p_devices > ${PLAFOND_LIBRE_SERVICE} then`)
      expect(plat).toContain("'code', 'hors_grille'")
    },
  )

  it.each(['deposer_changement_offre', 'deposer_ajout_magasin'])(
    '%s ne renvoie plus vers un devis',
    (fn) => {
      // Le message d'avant proposait de « construire le tarif avec vous » —
      // c'est-à-dire un devis, que ce parcours ne fait plus depuis le 4
      // septembre. Au-delà de la borne, c'est un abonnement de plus.
      const plat = espaces(sansCommentaires(derniereDefinition(fn).corps))
      expect(plat).not.toContain('nous construisons le tarif avec vous')
    },
  )

  it('⚠️ ne borne PAS la lecture : plafond_appareils reste entière', () => {
    // Elle calcule ce qu'un magasin a le DROIT de faire tourner, y compris un
    // magasin devisé plus haut hors libre-service. La borner couperait le
    // verrou d'un client légitime : c'est la VENTE qui s'arrête à 200.
    const plat = espaces(sansCommentaires(derniereDefinition('plafond_appareils').corps))
    expect(plat).not.toContain(`> ${PLAFOND_LIBRE_SERVICE}`)
  })

  it('le prix existe jusqu’à la borne, et pas au-delà', () => {
    expect(prixCents(PLAFOND_LIBRE_SERVICE, 'monthly')).not.toBeNull()
    expect(prixCents(PLAFOND_LIBRE_SERVICE, 'yearly')).not.toBeNull()
    expect(prixCents(PLAFOND_LIBRE_SERVICE + 1, 'monthly')).toBeNull()
    expect(prixCents(1000, 'yearly')).toBeNull()
  })

  it('la proposition s’arrête à la borne', () => {
    expect(proposer(2, PLAFOND_LIBRE_SERVICE)).not.toBeNull()
    expect(proposer(2, PLAFOND_LIBRE_SERVICE + 1)).toBeNull()
  })

  it('et le dernier prix vendable est bien celui de la grille', () => {
    // Enterprise plus dix tranches de dix : 890 + 10 × 64, et 9 450 + 10 × 690.
    const tranches = (PLAFOND_LIBRE_SERVICE - APPAREILS_MAX) / SUPPLEMENT.par
    const socle = OFFRES[OFFRES.length - 1]
    expect(prixCents(PLAFOND_LIBRE_SERVICE, 'monthly'))
      .toBe((socle.mois + tranches * SUPPLEMENT.mois) * 100)
    expect(prixCents(PLAFOND_LIBRE_SERVICE, 'yearly'))
      .toBe((socle.an + tranches * SUPPLEMENT.an) * 100)
  })

  it.each([['la fiche magasin', payer], ['la page magasins', magasins]])(
    '%s écrit un refus qui se lit',
    (_ou, src) => {
      // ⚠️ `.field-hint` est en `--text-3` à 12 px, soit ~3:1 sur la carte —
      // sous le seuil AA. C'est le défaut corrigé le 22 août 2026 sur la ligne
      // de tranche, et une phrase qui dit « vous ne pouvez pas acheter » est
      // exactement l'endroit où il coûte le plus cher.
      const sans = sansCommentaires(src)
      const bloc = sans.slice(sans.indexOf('{horsGrille && ('))
      expect(bloc.slice(0, 200)).toContain('offre-refus')
      expect(bloc.slice(0, 200)).not.toContain('field-hint')
    },
  )

  it.each([['la fiche magasin', payer], ['la page magasins', magasins]])(
    '%s dit le refus AVANT le clic',
    (_ou, src) => {
      // ⚠️ Renversement du 5 septembre 2026 : à 1 000 la borne était théorique,
      // personne ne la tapait ; à 200 elle se rencontre. Un écran qui laisse
      // calculer un prix puis refuse au clic fait douter du bouton.
      // ⚠️ On vérifie que le drapeau se CALCULE sur la borne, pas qu'il existe :
      // un `const horsGrille = false` laisse les deux mots dans le fichier et
      // passait la première version de cette garde. Un test qui passe sans
      // rien vérifier ne protège rien.
      const sans = sansCommentaires(src)
      expect(sans).toMatch(/horsGrille\s*=[^\n]*>\s*PLAFOND_LIBRE_SERVICE/)
      expect(sans).toContain('{horsGrille && (')
    },
  )
})
