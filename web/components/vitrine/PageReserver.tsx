'use client'

/**
 * Réserver un inventaire — le tunnel client (20 septembre 2026).
 *
 * Maquette : https://claude.ai/artifact/BSqAQUPZ7tnjAfdswK35MV
 * (Etape1-Visiteur, Etape1-Etablissement, Etape2-Date, Etape3-Stock, Prix,
 * HorsZone, PasDeCreneau)
 *
 * Trois questions, puis un prix ferme. Pas de devis, jamais : le prix affiché
 * est le prix payé.
 *
 * ⚠️ **AUCUN PRIX N'EST DÉCIDÉ ICI.** `prixFerme()` vient de `lib/prixOnDemand.ts`,
 * la copie d'affichage — le montant qui engage vient de `prix_ferme_mission` en
 * base, à l'étape du compte. Une garde compare les deux copies.
 *
 * ⚠️ **CETTE PAGE EST EN FRANÇAIS SEUL, ET C'EST UNE DÉCISION.** On-Demand ne
 * se vend qu'à Paris et en Île-de-France, à Lyon et à Lille : une jumelle sous
 * `/en` promettrait un service qu'on ne rend pas. `/reserver` n'est donc pas
 * dans `CHEMINS_VITRINE`, comme `/devis`. Le jour où une ville anglophone
 * ouvre, la page se traduit — pas avant.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SiteFooter } from '@/components/SiteChrome'
import { EnTeteAuDefilement } from '@/components/EnTeteAuDefilement'
import { venteOuverte } from '@/lib/legal'
import { supabase } from '@/lib/supabaseClient'
import { PasswordRules } from '@/components/PasswordRules'
import { MentionCollecte } from '@/components/MentionCollecte'
import { passwordError } from '@/lib/password'
import { formaterSiren, messageSiren, normaliserSiren } from '@/lib/siren'
import { mesEtablissements, reserverMaMission, type Etablissement } from '@/lib/onDemandClient'
import { useTraduction } from '@/lib/i18n'
import { Logo } from '@/components/Logo'
import { euros } from '@/lib/offres'
import { nb } from '@/lib/format'
import {
  DELAI_HEURES, MOMENTS, OU_NOUS_ALLONS, SECTEURS,
  TRANCHES_ARTICLES, TRANCHES_REFERENCES,
  prixFerme, duree, estDesservi,
  FORMULE_EQUIPE_OUVERTE, formuleParDefaut, formuleDemandee,
  REGLAGES, minimumAppareils,
  type PrixFerme, type Formule, type MomentCle, type Secteur,
} from '@/lib/prixOnDemand'

/**
 * ⚠️ **DEUX PARCOURS, DEUX LISTES.** Le logiciel seul pose DEUX questions —
 * c'est sa promesse, et la troisième (secteur, références, code-barres) ne
 * sert qu'aux coefficients de pénibilité de la formule équipe. Les poser à
 * quelqu'un qui achète une licence, c'est lui faire remplir un formulaire
 * pour rien.
 */
const ETAPES_LOGICIEL = ['Volume', 'Date'] as const
const ETAPES_EQUIPE = ['Établissement', 'Date', 'Stock'] as const

// ⚠️ Trois lettres, comme la planche : « L M M J V S D » demande de compter
// les colonnes pour savoir laquelle est mercredi.
const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/** ⚠️ `euros()` attend des EUROS. Tout le reste du module compte en centimes. */
const enEuros = (cents: number) => euros(cents / 100)

function enDate(d: Date): string {
  return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
}
function enHeure(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Les jours du mois, alignés sur une semaine qui commence le lundi. */
function grilleDuMois(annee: number, mois: number): (Date | null)[] {
  const premier = new Date(annee, mois, 1)
  const vide = (premier.getDay() + 6) % 7
  const jours = new Date(annee, mois + 1, 0).getDate()
  const cases: (Date | null)[] = Array.from({ length: vide }, () => null)
  for (let j = 1; j <= jours; j++) cases.push(new Date(annee, mois, j))
  return cases
}

export function PageReserver() {
  // ⚠️ LE CONTENU EST EN FRANÇAIS, LES LIENS NON. Un visiteur anglophone qui
  // arrive ici doit repartir vers `/en/tarifs`, pas vers la page française :
  // c'est la sortie qui compte, pas la page qu'on ne traduit pas.
  const { lien } = useTraduction()
  const uid = useId()
  const [etape, setEtape] = useState(1)

  /**
   * ⚠️ **LA FORMULE ARRIVE PAR L'ADRESSE, PAS PAR UNE QUESTION DE PLUS.** La
   * page « À la demande » l'a déjà posée — « qui tient le téléphone ? » — et
   * la reposer ici dirait qu'on n'a pas écouté la réponse. Le tunnel reste à
   * trois questions, c'est la promesse.
   *
   * ⚠️ ET ELLE SE CHANGE QUAND MÊME, depuis l'écran du prix : quelqu'un qui
   * découvre l'écart entre les deux montants doit pouvoir basculer sans
   * refaire le parcours.
   */
  const params = useSearchParams()
  const [formule, setFormule] = useState<Formule>(formuleParDefaut())
  useEffect(() => {
    setFormule(formuleDemandee(params.get('formule')))
  }, [params])
  const logicielSeul = formule === 'logiciel_seul'

  /**
   * Le nombre d'appareils demandé.
   *
   * ⚠️ **IL NE DESCEND PAS SOUS LE MINIMUM QU'IMPOSE LA TAILLE.** Sans ça,
   * déclarer 100 000 pièces sur deux appareils ramènerait le mois de référence
   * à Essential, donc le prix à 44 € — voir `minimumAppareils`. Le moteur en
   * base applique la même borne : celle-ci n'est que l'affichage.
   */
  const [appareilsVoulus, setAppareilsVoulus] = useState(1)

  // ⚠️ Chaque étape recommence en haut. Sans ça, on arrive au milieu de la
  // question suivante — d'autant plus que les étapes n'ont pas la même hauteur.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [etape])

  const [repris, setRepris] = useState(false)

  /**
   * ⚠️ **UN CLIENT CONNECTÉ NE RETAPE PAS SON ADRESSE.** La maquette a deux
   * étapes 1 — Etape1-Visiteur et Etape1-Etablissement — et c'est le même
   * tunnel : ce qui change, c'est qu'on connaît déjà ses magasins. Deux pages
   * séparées auraient voulu dire deux fois les étapes 2 et 3.
   */
  const [connecte, setConnecte] = useState<boolean | null>(null)
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [etablissementChoisi, setEtablissementChoisi] = useState<string | null>(null)
  const [nouvelEtablissement, setNouvelEtablissement] = useState(false)

  useEffect(() => {
    let vivant = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!vivant) return
      setConnecte(Boolean(session))
      if (!session) return
      try {
        const liste = await mesEtablissements()
        if (vivant) setEtablissements(liste)
      } catch { /* la liste reste vide : on retombe sur la saisie d'adresse */ }
    })()
    return () => { vivant = false }
  }, [])

  const choisirEtablissement = (e: Etablissement) => {
    setEtablissementChoisi(e.id)
    setNouvelEtablissement(false)
    setMagasin(e.name)
    // `stores.address` porte l'adresse complète : on la redécoupe pour que le
    // code postal — celui qui décide de la zone — reste une valeur à part.
    const adr = e.address ?? ''
    const cp = adr.match(/\b(\d{5})\b/)
    setAdresse(cp ? adr.slice(0, adr.indexOf(cp[1])).replace(/,\s*$/, '').trim() : adr)
    setCodePostal(cp ? cp[1] : '')
    setVille(cp ? adr.slice(adr.indexOf(cp[1]) + 5).trim() : '')
    if (e.sqm) setSurfaceVente(String(e.sqm))
  }

  // Étape 1 — où
  const [adresse, setAdresse] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [ville, setVille] = useState('')
  const [magasin, setMagasin] = useState('')

  // Étape 2 — quand
  const aujourdhui = useMemo(() => new Date(), [])
  const [curseur, setCurseur] = useState(() => new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1))
  const [jour, setJour] = useState<Date | null>(null)
  const [moment, setMoment] = useState<MomentCle>('apres_fermeture')
  const [heure, setHeure] = useState('20:00')

  // Étape 3 — quoi
  const [secteur, setSecteur] = useState<Secteur | ''>('')
  const [surfaceVente, setSurfaceVente] = useState('')
  const [surfaceReserve, setSurfaceReserve] = useState('')
  const [trancheArticles, setTrancheArticles] = useState('')
  const [trancheReferences, setTrancheReferences] = useState('')
  const [codeBarres, setCodeBarres] = useState<'tous' | 'partiel' | ''>('')
  const [engage, setEngage] = useState(false)

  // Étapes 5 et 6 — qui réserve
  const [prenom, setPrenom] = useState('')
  const [nomFamille, setNomFamille] = useState('')
  const [courriel, setCourriel] = useState('')
  const [telephone, setTelephone] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [siren, setSiren] = useState('')
  const [societe, setSociete] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  /**
   * ⚠️ LA RÉFÉRENCE DE LA RÉSERVATION PRISE, et c'est elle qui distingue les
   * deux arrivées : « c'est réservé, voici votre référence » pour un client
   * connecté, « regardez votre boîte mail » pour un visiteur dont le compte
   * reste à ouvrir. L'écran d'arrivée affirmait « votre réservation est
   * enregistrée » dans les deux cas — et dans aucun ce n'était vrai.
   */
  const [reference, setReference] = useState<string | null>(null)
  /** Le serveur réclame une raison sociale : il n'a pas d'entreprise utilisable. */
  const [entrepriseAFournir, setEntrepriseAFournir] = useState(false)
  const [occupe, setOccupe] = useState(false)

  /**
   * ⚠️ **L'ÉCRAN DE CONNEXION PROMET « vous reprenez où vous en êtes, même en
   * revenant demain ».** Sans ce qui suit, la promesse serait fausse : un
   * visiteur qui va chercher son mot de passe dans sa boîte mail et revient
   * retrouverait un parcours vide. C'est un confort par navigateur, donc
   * `localStorage` — pas un état partagé, et rien de personnel n'y entre au-delà
   * de ce que la personne vient de taper sur cette page.
   *
   * ⚠️ Lecture et écriture SOUS `try` : en navigation privée, avec les données
   * de site bloquées, l'accesseur lève — et le parcours doit marcher quand même.
   *
   * ⚠️ ET C'EST BIEN UN EFFET, malgré l'avertissement d'ESLint. Lire le
   * stockage dans l'initialiseur de `useState` le ferait lire AUSSI au rendu
   * serveur, où il n'existe pas : le serveur rendrait une page vide et le
   * client une page remplie — une divergence d'hydratation. Les cinquante
   * autres avertissements du même genre dans ce dépôt ont la même cause.
   */
  const REPRISE = 'quantinvo-reserver'

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(REPRISE)
      if (brut) {
        const r = JSON.parse(brut) as Record<string, string>
        if (r.adresse) setAdresse(r.adresse)
        if (r.codePostal) setCodePostal(r.codePostal)
        if (r.ville) setVille(r.ville)
        if (r.magasin) setMagasin(r.magasin)
        if (r.jour) setJour(new Date(r.jour))
        if (r.moment) setMoment(r.moment as MomentCle)
        if (r.heure) setHeure(r.heure)
        if (r.secteur) setSecteur(r.secteur as Secteur)
        if (r.surfaceVente) setSurfaceVente(r.surfaceVente)
        if (r.surfaceReserve) setSurfaceReserve(r.surfaceReserve)
        if (r.trancheArticles) setTrancheArticles(r.trancheArticles)
        if (r.trancheReferences) setTrancheReferences(r.trancheReferences)
        if (r.codeBarres) setCodeBarres(r.codeBarres as 'tous' | 'partiel')
        // ⚠️ L'adresse gagne sur le stockage : quelqu'un qui revient par
        // « Réserver le logiciel » veut le logiciel, pas ce qu'il regardait
        // hier. L'effet qui lit `?formule=` tourne après celui-ci.
        if (r.formule) setFormule(r.formule as Formule)
      }
    } catch { /* stockage indisponible : on repart d'une page vierge */ }
    setRepris(true)
  }, [])

  useEffect(() => {
    if (!repris) return
    try {
      window.localStorage.setItem(REPRISE, JSON.stringify({
        adresse, codePostal, ville, magasin,
        jour: jour ? jour.toISOString() : '', moment, heure,
        secteur, surfaceVente, surfaceReserve,
        trancheArticles, trancheReferences, codeBarres, formule,
      }))
    } catch { /* idem : ne rien garder vaut mieux que planter */ }
  }, [repris, adresse, codePostal, ville, magasin, jour, moment, heure,
      secteur, surfaceVente, surfaceReserve, trancheArticles, trancheReferences,
      codeBarres, formule])

  const debut = useMemo(() => {
    if (!jour) return null
    const [h, m] = heure.split(':').map(Number)
    return new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), h, m)
  }, [jour, heure])

  /** Le haut de la tranche choisie, et le minimum d'appareils qu'il impose. */
  const hautDeTranche = TRANCHES_ARTICLES.find((t) => t.cle === trancheArticles)?.max ?? 0
  const minimumChoisi = hautDeTranche ? minimumAppareils(hautDeTranche) : 1

  /**
   * ⚠️ **LE PLANCHER SE CALCULE À L'AFFICHAGE, IL NE SE STOCKE PAS.** L'état
   * démarrait à 1 alors que la tranche par défaut en impose six : le compteur
   * disait « 1 » et la phrase en dessous « plusieurs jours — une soirée.
   * C'est le minimum », trois contradictions sur deux lignes. Borner ici plutôt
   * que de compter sur chaque geste pour le faire, c'est ce qui garantit qu'on
   * ne repasse jamais sous le minimum, quel que soit l'ordre des clics.
   */
  const appareils = Math.max(appareilsVoulus, minimumChoisi)
  const setAppareils = (n: number | ((p: number) => number)) =>
    setAppareilsVoulus((p) => Math.max(minimumChoisi,
      typeof n === 'function' ? n(Math.max(p, minimumChoisi)) : n))

  const resultat: PrixFerme = useMemo(
    () => prixFerme({ codePostal, secteur, trancheArticles, debut, formule, appareils }),
    [codePostal, secteur, trancheArticles, debut, formule, appareils],
  )

  /**
   * ⚠️ Le conseil se CALCULE, il ne se choisit pas : la durée vient du volume
   * et du nombre d'appareils, à la productivité du ponctuel. Trois cas — « il
   * en faudrait N » quand le client en a déjà mis plus n'aurait aucun sens.
   */
  const conseilAppareils = useMemo(() => {
    if (!hautDeTranche) return 'Choisissez d’abord un volume.'
    const heures = hautDeTranche / (REGLAGES.productivitePonctuel * appareils)
    const arrondi = Math.ceil(heures * 2) / 2
    const lu = arrondi > 12
      ? 'plusieurs jours'
      : `${Math.floor(arrondi)} h${arrondi % 1 >= 0.5 ? ' 30' : ''}`
    const fin = appareils > minimumChoisi ? ' — vous êtes large.'
      : ' — une soirée. C’est le minimum pour cette taille d’inventaire.'
    return `Avec ${appareils} appareil${appareils > 1 ? 's' : ''}, comptez environ ${lu}${fin}`
  }, [hautDeTranche, appareils, minimumChoisi])

  /**
   * ⚠️ **LA TOLÉRANCE EST À DOUBLE SENS**, et c'est ce qui la rend acceptable :
   * une clause qui ne facture que les dépassements est une pénalité, pas une
   * mesure. Quantinvo est le seul à connaître le compte réel, puisque c'est
   * son outil qui a compté — la règle est vérifiable des deux côtés.
   */
  const clauseTolerance =
    `Nous comptons ce que vous comptez : au-delà de ${REGLAGES.tolerancePct} % d’écart `
    + 'sur cette tranche, la réservation est réajustée à la clôture, dans les deux sens.'

  /** L'autre formule, au même volume — pour montrer l'écart sans le recopier. */
  const autreFormule: PrixFerme = useMemo(
    () => prixFerme({ codePostal, secteur, trancheArticles, debut,
                  formule: logicielSeul ? 'equipe_quantinvo' : 'logiciel_seul' }),
    [codePostal, secteur, trancheArticles, debut, logicielSeul],
  )

  // ⚠️ La zone se vérifie DÈS L'ÉTAPE 1, avant de faire choisir une date à
  // quelqu'un qu'on ne peut pas servir. Le refus ne propose pas de devis de
  // rattrapage : c'est toute la promesse du produit.
  // ⚠️ LA ZONE NE VAUT QUE QUAND UNE ÉQUIPE SE DÉPLACE. Le logiciel se livre
  // partout : refuser un code postal reviendrait à refuser de vendre ce qu'on
  // sait livrer.
  const zoneConnue = codePostal.replace(/\D/g, '').length >= 2
  const horsZone = !logicielSeul && zoneConnue && !estDesservi(codePostal)

  const etape1Prete = adresse.trim().length > 4 && zoneConnue && !horsZone
  /**
   * ⚠️ **UN CRÉNEAU QUE LE DEVIS REFUSE NE DOIT PAS LAISSER PASSER.** Sans ça,
   * on arrive à l'étape du prix avec un prix en échec — et comme cette étape
   * ne s'affiche que si le prix tient, on arrive sur une PAGE BLANCHE.
   * Trouvé le 20 septembre 2026 en jouant le tunnel au volet : formule
   * logiciel, date d'aujourd'hui, heure déjà passée. Le refus existait déjà
   * plus bas ; il n'empêchait rien.
   */
  const etape2Prete = Boolean(debut) && (resultat.ok || resultat.refus !== 'trop_tot')
  const etape3Prete = Boolean(secteur && trancheArticles && codeBarres && engage)

  const heures = MOMENTS.find((m) => m.cle === moment)?.heures ?? []

  /**
   * ⚠️ MÊME PORTE QUE `/inscription`, ET C'EST VOLONTAIRE. La fonction edge
   * `inscription` porte déjà la limitation de débit, l'absence d'oracle
   * d'énumération et le drapeau `VENTE_OUVERTE`. Créer un second chemin
   * d'inscription, ce serait recopier ces trois protections — et en oublier
   * une.
   */
  const edge = useCallback(async (corps: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('inscription', {
      body: corps,
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    })
    // ⚠️ `invoke` JETTE le corps d'un refus, or c'est là que vit le message
    // utile. On le relit sur la réponse portée par l'erreur.
    if (error) {
      const r = (error as { context?: Response }).context
      if (r) { try { return await r.json() } catch { /* corps illisible */ } }
      return { success: false, error: 'Le service n’a pas répondu. Réessayez dans un instant.' }
    }
    return data as { success?: boolean; error?: string } | null
  }, [])

  /**
   * ⚠️⚠️ **C'EST ICI QUE LA RÉSERVATION EXISTE**, et elle n'existait nulle part
   * avant le 5 octobre 2026 : le seul appel serveur du tunnel était l'envoi
   * d'un code d'inscription. On arrivait sur « Votre réservation est
   * enregistrée avec ce prix » sans que rien n'ait été écrit.
   *
   * ⚠️ AUCUN MONTANT N'EST ENVOYÉ. `reserver_ma_mission` recalcule le prix en
   * base ; ce qui part d'ici, ce sont les réponses.
   *
   * ⚠️ ET SI LE SERVEUR RÉCLAME LA RAISON SOCIALE, ON LA DEMANDE — on ne
   * devine pas son cas en relisant `profiles.role`. C'est lui qui sait si
   * l'appelant a une entreprise utilisable, et depuis le 5 octobre un compteur
   * invité chez quelqu'un d'autre n'en a plus : celui qui paie devient le
   * client, avec la sienne.
   */
  const reserverMaintenant = async () => {
    if (!debut || !resultat.ok) return
    const tranche = TRANCHES_ARTICLES.find((t) => t.cle === trancheArticles)
    if (!tranche) { setErreur('Choisissez un volume de pièces.'); return }
    setErreur(null); setOccupe(true)
    const r = await reserverMaMission({
      entreprise: societe.trim(),
      siren: siren.trim(),
      magasin: magasin.trim(),
      adresse: adresse.trim(),
      codePostal: codePostal,
      ville: ville.trim(),
      secteur,
      surfaceVente,
      surfaceReserve,
      articlesMin: tranche.min,
      articlesMax: tranche.max,
      referencesMin: null,
      referencesMax: null,
      codeBarres: codeBarres,
      formule,
      appareils,
      debut,
      moment,
    })
    setOccupe(false)
    if (!r.ok) {
      if (r.code === 'entreprise' || r.code === 'siren') {
        setEntrepriseAFournir(true)
        setEtape(8)
        setErreur(r.code === 'siren' ? r.message : null)
        return
      }
      setErreur(r.message)
      return
    }
    setReference(r.reference)
    // Le parcours est consommé : le garder ferait réapparaître cette
    // réservation la prochaine fois.
    try { window.localStorage.removeItem(REPRISE) } catch { /* indisponible */ }
    setEtape(7)
  }

  const seConnecter = async () => {
    setErreur(null); setOccupe(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: courriel.trim().toLowerCase(), password: motDePasse,
    })
    setOccupe(false)
    if (error) { setErreur('Adresse ou mot de passe incorrect.'); return }
    setMotDePasse('')
    setConnecte(true)
    // ⚠️ IL EST VENU RÉSERVER, PAS SE CONNECTER. Le bouton dit « Se connecter
    // et continuer » : l'envoyer sur un écran d'attente serait lui faire
    // recommencer. C'est le chemin du pro qui revient avec une adresse déjà
    // connue — celui que Julien a demandé le 5 octobre 2026.
    await reserverMaintenant()
  }

  const ouvrirMonCompte = async () => {
    setErreur(null)
    const faible = passwordError(motDePasse)
    if (faible) { setErreur(faible); return }
    const mauvaisSiren = siren.trim() ? messageSiren(siren) : null
    if (mauvaisSiren) { setErreur(mauvaisSiren); return }
    setOccupe(true)
    const r = await edge({ action: 'code', email: courriel.trim().toLowerCase(), retour: 'reserver' })
    setOccupe(false)
    if (!r?.success) {
      setErreur(r?.error ?? 'Envoi impossible.')
      return
    }
    setEtape(7)
  }

  const compteComplet = prenom.trim() !== '' && nomFamille.trim() !== ''
    && /.+@.+\..+/.test(courriel.trim()) && motDePasse !== '' && societe.trim() !== ''

  const recap = (
    <aside className="res-recap" aria-label="Votre réservation">
      <h2>Votre réservation</h2>
      <dl>
        {logicielSeul ? (
          <>
            <div>
              <dt>Pièces</dt>
              <dd>{(() => {
                const t = TRANCHES_ARTICLES.find((x) => x.cle === trancheArticles)
                return t ? (t.court ?? t.nom) : <span className="muted">À choisir</span>
              })()}</dd>
            </div>
            <div>
              <dt>Appareils</dt>
              <dd>{appareils > minimumChoisi
                ? `${appareils} (${minimumChoisi} compris, ${appareils - minimumChoisi} en plus)`
                : `${appareils} (compris)`}</dd>
            </div>
            <div>
              <dt>Durée estimée</dt>
              <dd>{resultat.ok ? duree(resultat.chaine.dureeMinutes) : <span className="muted">—</span>}</dd>
            </div>
            <div>
              <dt>Période</dt>
              {/* ⚠️ UNE SEMAINE, pas le temps du comptage : « l'inventaire peut
                  durer assez longtemps, on ne compte en général pas plus
                  longtemps » (Julien, 28 septembre 2026). */}
              <dd>{resultat.ok
                ? `${enDate(resultat.arrivee)} → ${enDate(resultat.finPrevue)}`
                : <span className="muted">À choisir</span>}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Établissement</dt>
              <dd>{magasin.trim() || adresse.trim() || <span className="muted">À renseigner</span>}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{debut ? `${enDate(debut)}, ${enHeure(debut)}` : <span className="muted">À choisir</span>}</dd>
            </div>
          </>
        )}
        {!logicielSeul && (
          <div>
            <dt>{etape >= 5 ? 'À payer' : 'Prix'}</dt>
            <dd>
              {resultat.ok
                ? <strong className="num">{enEuros(resultat.chaine.prixCents)}</strong>
                : <span className="muted">
                    {etape < 2 ? 'Après la dernière question' : 'Une réponse et il s’affiche'}
                  </span>}
            </dd>
          </div>
        )}
      </dl>

      {/* ⚠️ **LE PRIX EN GRAND, ET LE BOUTON SOUS LUI** — c'est la planche, et
          c'est mieux placé : l'action est contre le chiffre qu'elle engage et
          contre le détail de ce qu'on achète. Le montant ne s'écrit qu'une
          fois : il était dans le libellé du bouton tant que celui-ci vivait à
          l'autre bout de l'écran. */}
      {logicielSeul && (
        <div className="res-somme">
          {resultat.ok ? (
            <>
              <strong className="res-montant">{enEuros(resultat.chaine.prixCents)}</strong>
              {/* ⚠️ **CE BOUTON-CI N'AVAIT PAS LE VERROU DE VENTE** (trouvé le
                  5 octobre 2026). Celui de l'écran du prix l'avait, pas celui
                  du récapitulatif — et tant que rien n'était enregistré, ça ne
                  se voyait pas. Le jour où il réserve pour de vrai, il vendrait
                  pendant que `web/lib/legal.ts` est incomplet. */}
              <button type="button" className="btn btn-primary btn-block"
                      disabled={occupe || !venteOuverte()}
                      onClick={() => { if (connecte) void reserverMaintenant(); else setEtape(5) }}>
                {occupe ? 'Un instant…' : 'Réserver'}
              </button>
              {/* ⚠️ **UN BOUTON MORT DIT POURQUOI.** En formule logiciel, ce
                  bouton EST l'action principale : le parcours s'arrête à la
                  date, et l'écran du prix — qui porte l'explication de la vente
                  fermée — n'est jamais atteint. Mesuré au volet le 5 octobre
                  2026 : le verrou qu'on venait de poser laissait un bouton gris
                  sans un mot. */}
              {!venteOuverte() && (
                <p className="res-ferme">
                  La réservation n’est pas encore ouverte. Ce prix est bien celui
                  que vous paierez le jour où elle le sera.
                </p>
              )}
              {erreur && <p className="field-err">{erreur}</p>}
            </>
          ) : (
            <span className="muted">
              {etape < 2 ? 'Après la dernière question' : 'Une réponse et il s’affiche'}
            </span>
          )}
        </div>
      )}
      {/* ⚠️ La clause vit ICI et nulle part ailleurs (Julien, sur la maquette) :
          « gardons la phrase seulement dans le volet de droite ». Elle porte sa
          justification — « nous comptons ce que vous comptez » — sans quoi
          « réajusté » se lit comme une pénalité qu'on s'autorise. */}
      {logicielSeul && resultat.ok && (
        <p className="res-clause muted">
          Prix de la tranche, {minimumChoisi} appareil{minimumChoisi > 1 ? 's' : ''} compris.{' '}
          {clauseTolerance}
        </p>
      )}
    </aside>
  )

  return (
    <>
      {/* ⚠️ C'EST LA BARRE DU SITE, PAS UNE COPIE. Elle en reprend les classes
          — `.site-header` et `.container inner` — donc sa hauteur de 64 px, son
          fond flouté, son filet, son logo à 38, et surtout sa LARGEUR : elle
          tient les deux bords de l'écran, avec 40 px de marge. C'est la règle
          posée le 11 septembre 2026 (« l'en-tête et le pied ne sont pas bridés
          à la largeur de lecture »), et une barre de ce tunnel qui flotterait
          au milieu se verrait au premier coup d'œil à côté du reste du site.
          `EnTeteAuDefilement` et l'espaceur vont avec : sans eux, la barre ne
          s'efface pas au défilement et, sous 780 px où elle passe en `fixed`,
          la première question passerait dessous. */}
      <EnTeteAuDefilement />
      <header className="site-header">
        <div className="container inner">
          <Link href={lien('/')} className="brand" aria-label="Quantinvo">
            <Logo size={38} /><span>Quantinvo</span>
          </Link>
          <span className="res-titre">Réserver un inventaire</span>
          <ol className="res-pas" aria-label="Progression">
            {(logicielSeul ? [] : ETAPES_EQUIPE).map((nom, i) => (
              <li key={nom} className={etape > i + 1 ? 'fait' : etape === i + 1 ? 'ici' : ''}
                  aria-current={etape === i + 1 ? 'step' : undefined}>
                {nom}
              </li>
            ))}
          </ol>
          <div className="res-barre-actions">
            <Link href="/login" className="header-lien">Se connecter</Link>
            <Link href={lien('/')} className="header-lien">Quitter</Link>
          </div>
        </div>
      </header>
      <div className="site-header-espace" aria-hidden="true" />

      <main className="container res-page">
        {/* ⚠️ **DEUX ÉTAPES 1, ET C'EST VOULU.** Le logiciel seul n'a pas besoin
            de savoir OÙ : il se livre partout, il n'y a ni zone ni équipe à
            déplacer. Il a besoin de savoir COMBIEN — de pièces, puis
            d'appareils. L'adresse redescend au moment du compte, où elle sert
            à facturer. L'étape de l'équipe reste juste en dessous, intacte,
            derrière `FORMULE_EQUIPE_OUVERTE`. */}
        {etape === 1 && logicielSeul && (
          <div className="res-colonnes res-seule">
            <section className="res-questions echange-entre">
              {/* ⚠️ La barre de la planche : deux segments, celui de l'étape en
                  cours en accent. Elle remplace la liste d'étapes de la barre du
                  site pour le ponctuel — deux indicateurs se contrediraient. */}
              <div className="res-jauge" aria-hidden="true">
                <span className="fait" />
                <span className={etape >= 2 ? 'fait' : ''} />
              </div>
              <h1>Combien d’appareils prévoyez-vous d’utiliser&nbsp;?</h1>

              <div className="field">
                <span className="champ-label">Pièces à compter</span>
                <div className="res-choix">
                  {TRANCHES_ARTICLES.map((t) => (
                    <button key={t.cle} type="button"
                            className={`res-option${trancheArticles === t.cle ? ' actif' : ''}`}
                            onClick={() => {
                              setTrancheArticles(t.cle)
                              setAppareils(minimumAppareils(t.max))
                            }}>{t.court ?? t.nom}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor={`${uid}-appareils`}>Nombre d’appareils souhaités</label>
                <div className="res-compteur">
                  <button type="button" aria-label="Un appareil de moins"
                          onClick={() => setAppareils((n) => Math.max(minimumChoisi, n - 1))}>−</button>
                  <output id={`${uid}-appareils`} htmlFor={`${uid}-appareils`}>{appareils}</output>
                  <button type="button" aria-label="Un appareil de plus"
                          onClick={() => setAppareils((n) => Math.min(100, n + 1))}>+</button>
                </div>
                <p className="muted res-aide">{conseilAppareils}</p>
                {/* ⚠️ Les raccourcis de la maquette : un compteur à flèches
                    seul oblige à cliquer six fois pour arriver à six. Ceux qui
                    tombent sous le minimum imposé par la taille sont écartés —
                    proposer un chiffre qu'on refusera ensuite est pire que ne
                    pas le proposer. */}
                <div className="res-raccourcis">
                  {[2, 4, 6, 10, 20].map((n) => (
                    <button key={n} type="button"
                            className={`res-raccourci${appareils === n ? ' actif' : ''}`}
                            onClick={() => setAppareils(n)}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="res-actions">
                {/* ⚠️ Un retour dès la PREMIÈRE question (demande de Julien,
                    28 septembre 2026) : sans lui, la seule sortie du tunnel
                    est la croix du navigateur, et on perd ce qu'on a saisi. */}
                <Link href={lien('/on-demand')} className="btn btn-ghost">Retour</Link>
                <button type="button" className="btn btn-primary"
                        disabled={!trancheArticles}
                        onClick={() => setEtape(2)}>Continuer</button>
              </div>
            </section>
            {/* ⚠️ **PAS DE VOLET À LA PREMIÈRE QUESTION** (Julien, sur la
                maquette) : il afficherait « Période — à choisir » et un tiret à
                la place du prix, c'est-à-dire les trous de sa propre réponse.
                Il arrive avec le prix, et c'est un meilleur moment. */}
          </div>
        )}

        {etape === 1 && !logicielSeul && (
          <div className="res-colonnes">
            <section className="res-questions">
              <h1>Où faut-il compter ?</h1>
              <p className="muted">
                {connecte
                  ? 'Un inventaire, un magasin. Pour en réserver plusieurs, vous recommencerez ici — vos réponses sont gardées.'
                  : 'Trois questions et votre prix s’affiche. Vous ne créerez un compte qu’au moment de réserver.'}
              </p>

              {etablissements.length > 0 && (
                <div className="field">
                  <div className="res-etabs-tete">
                    <span className="champ-label">Vos établissements</span>
                    <button type="button" className="link-btn"
                            onClick={() => {
                              setNouvelEtablissement(true); setEtablissementChoisi(null)
                              setAdresse(''); setCodePostal(''); setVille(''); setMagasin('')
                            }}>
                      Ajouter un établissement
                    </button>
                  </div>
                  <div className="res-etabs">
                    {etablissements.map((e) => (
                      <button key={e.id} type="button"
                              className={`res-etab${etablissementChoisi === e.id ? ' actif' : ''}`}
                              onClick={() => choisirEtablissement(e)}>
                        <span className="res-etab-nom">{e.name}</span>
                        <span className="res-etab-detail">
                          {e.address ?? 'adresse non renseignée'}
                          {e.sqm ? ` — ${e.sqm} m² de vente` : ''}
                        </span>
                        <span className="res-etab-detail">
                          {e.derniere
                            ? `Dernier inventaire : ${new Date(e.derniere.debut_prevu)
                                .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                            : 'Jamais inventorié'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="field"
                   hidden={etablissements.length > 0 && !nouvelEtablissement}>
                <label htmlFor={`${uid}-adresse`}>Adresse du magasin</label>
                <input id={`${uid}-adresse`} value={adresse} autoComplete="street-address"
                       maxLength={160} placeholder="12 rue de Rivoli"
                       onChange={(e) => setAdresse(e.target.value)} />
              </div>
              <div className="field-duo"
                   hidden={etablissements.length > 0 && !nouvelEtablissement}>
                <div className="field">
                  <label htmlFor={`${uid}-cp`}>Code postal</label>
                  <input id={`${uid}-cp`} value={codePostal} inputMode="numeric" maxLength={5}
                         autoComplete="postal-code" placeholder="75004"
                         onChange={(e) => setCodePostal(e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-ville`}>Ville</label>
                  <input id={`${uid}-ville`} value={ville} autoComplete="address-level2"
                         maxLength={80} placeholder="Paris"
                         onChange={(e) => setVille(e.target.value)} />
                </div>
              </div>
              {!horsZone && (
                <p className="res-zone-note">
                  {etablissementChoisi
                    ? 'Nous servons cette adresse. Ce magasin est déjà enregistré dans votre compte.'
                    : logicielSeul
                      ? 'Le logiciel fonctionne partout en France — aucune zone à vérifier.'
                      : `Nous intervenons à ${OU_NOUS_ALLONS}.`}
                  {!etablissementChoisi && connecte && nouvelEtablissement
                    && ' Ce magasin sera enregistré dans votre compte : la prochaine fois, il sera dans la liste.'}
                </p>
              )}

              {horsZone && (
                <div className="res-refus" role="status">
                  <h2>Nous n’allons pas encore là-bas</h2>
                  <p>
                    Nous intervenons à {OU_NOUS_ALLONS}. Ouvrir une ville demande
                    d’y avoir une équipe : nous ne prenons pas de réservation que
                    nous ne saurions pas tenir.
                  </p>
                  <p className="muted">
                    Laissez-nous votre adresse à l’ouverture et nous vous
                    préviendrons — sans relance commerciale entre-temps.
                  </p>
                  <Link href={lien('/tarifs')} className="btn btn-ghost">Voir Quantinvo OS</Link>
                </div>
              )}

              <div className="field"
                   hidden={etablissements.length > 0 && !nouvelEtablissement}>
                <label htmlFor={`${uid}-magasin`}>Nom du magasin <span className="muted">(facultatif)</span></label>
                <input id={`${uid}-magasin`} value={magasin} maxLength={80}
                       placeholder="Paris Rivoli"
                       onChange={(e) => setMagasin(e.target.value)} />
                <p className="field-hint">C’est le nom que vous verrez sur vos rapports.</p>
              </div>

              <div className="res-actions">
                <span className="muted">
                  {etape1Prete ? 'Étape 1 sur 3' : 'Étape 1 sur 3 — entrez une adresse pour continuer.'}
                </span>
                <button type="button" className="btn btn-primary" disabled={!etape1Prete}
                        onClick={() => setEtape(2)}>Continuer</button>
              </div>
            </section>

            <div className="res-cote">
              <section className="res-encadre">
                <h2>Ce qui vient après</h2>
                <ul>
                  <li>La date et l’heure qui vous arrangent</li>
                  <li>Quelques mots sur votre stock</li>
                  <li>Votre prix, ferme, tout de suite</li>
                </ul>
              </section>
              <section className="res-encadre" hidden={connecte === true}>
                <h2>Vous êtes déjà venu ?</h2>
                <p className="muted">
                  Connectez-vous : vos établissements, vos coordonnées et votre
                  carte sont déjà là. Il ne restera que la date.
                </p>
                <Link href="/login" className="btn btn-ghost btn-block">Se connecter</Link>
              </section>
            </div>
          </div>
        )}

        {/* ⚠️ La date ouvre une FENÊTRE d'une semaine pour le logiciel, pas un
            créneau : le client compte quand il veut dedans. */}
        {etape === 2 && (
          <div className="res-colonnes">
            <section className="res-questions echange-entre">
              {logicielSeul && (
              <div className="res-jauge" aria-hidden="true">
                <span className="fait" />
                <span className="fait" />
              </div>
              )}
              <h1>{logicielSeul ? 'À partir de quand ?' : 'Quand ?'}</h1>
              <p className="muted">
                {logicielSeul
                  ? 'Votre licence s’ouvre ce jour-là et reste ouverte sept jours.'
                  : 'Avant l’ouverture, en pleine journée ou après la fermeture — comme vous voulez. Nous n’affichons que les créneaux où nous avons une équipe.'}
              </p>

              <div className="res-quand">
                <div className="res-calendrier">
                  <div className="res-mois">
                    <button type="button" className="link-btn" aria-label="Mois précédent"
                            onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() - 1, 1))}>
                      ‹
                    </button>
                    <strong>{MOIS[curseur.getMonth()]} {curseur.getFullYear()}</strong>
                    <button type="button" className="link-btn" aria-label="Mois suivant"
                            onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1))}>
                      ›
                    </button>
                  </div>
                  <div className="res-jours" role="grid">
                    {JOURS.map((j, i) => <span key={i} className="res-jour-nom">{j}</span>)}
                    {grilleDuMois(curseur.getFullYear(), curseur.getMonth()).map((d, i) => {
                      if (!d) return <span key={`v${i}`} />
                      // ⚠️ AUCUNE CAPACITÉ RÉELLE DERRIÈRE CE CALENDRIER pour
                      // l'instant : le seul refus est le délai de constitution
                      // d'équipe. Le jour où le vivier existe, c'est ici que la
                      // disponibilité se branchera — et la légende est déjà juste.
                      // ⚠️ ON COMPARE LA FIN DE LA JOURNÉE, PAS SON DÉBUT. À
                      // minuit, un jour tout entier tombait sous le délai alors
                      // que son créneau de 22 h était parfaitement tenable — la
                      // veille du premier jour réservable disparaissait pour rien.
                      // Le créneau précis, lui, est refusé plus bas.
                      const finDuJour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59)
                      // ⚠️ LE DÉLAI EXISTE POUR CONSTITUER UNE ÉQUIPE. Sans
                      // équipe, il ne protège rien : il barrerait le calendrier
                      // de quelqu'un qui compte ce soir.
                      const tropTot = finDuJour.getTime()
                        < aujourdhui.getTime() + (logicielSeul ? 0 : DELAI_HEURES) * 3600_000
                      const choisi = jour?.toDateString() === d.toDateString()
                      // ⚠️ **LA FENÊTRE SE VOIT, PAS SEULEMENT SON PREMIER
                      // JOUR** : on vend une semaine, et un calendrier qui
                      // n'éclaire qu'une case laisse croire qu'on vend un jour.
                      const dansLaFenetre = logicielSeul && jour != null && !choisi
                        && d.getTime() > jour.getTime()
                        && d.getTime() < jour.getTime() + REGLAGES.fenetreJours * 24 * 3600_000
                      return (
                        <button key={d.toISOString()} type="button" disabled={tropTot}
                                className={`res-jour${choisi ? ' choisi' : ''}${dansLaFenetre ? ' fenetre' : ''}${tropTot ? ' vide' : ''}`}
                                onClick={() => setJour(d)}>
                          {d.getDate()}
                        </button>
                      )
                    })}
                  </div>
                  {logicielSeul && resultat.ok && (
                    <p className="res-fenetre muted">
                      Du {enDate(resultat.arrivee)} au {enDate(resultat.finPrevue)}.
                      {' '}Vous comptez quand vous voulez dans cette semaine,
                      autant de fois qu’il le faut.
                    </p>
                  )}
                  {!logicielSeul && (
                  <p className="res-legende">
                    {(
                      <>
                        <span className="res-pastille dispo" /> Équipe disponible
                        <span className="res-pastille absente" /> Pas d’équipe
                      </>
                    )}
                  </p>
                  )}
                </div>

                {/* ⚠️ **PAS D'HEURE POUR LE LOGICIEL** — la planche ne la montre
                    pas, et elle a raison : une licence qui court sept jours ne
                    se règle pas à l'heure près. L'équipe, elle, arrive à une
                    heure dite. Le créneau par défaut suffit à ouvrir la
                    licence le jour choisi. */}
                {!logicielSeul && (
                <div className="res-heures">
                  <div className="field">
                    <span className="champ-label">Moment de la journée</span>
                    <div className="res-choix">
                      {MOMENTS.map((m) => (
                        <button key={m.cle} type="button"
                                className={`res-option${moment === m.cle ? ' actif' : ''}`}
                                onClick={() => { setMoment(m.cle); setHeure(m.heures[0]) }}>
                          {m.nom}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <span className="champ-label">Heure de début</span>
                    <div className="res-choix">
                      {heures.map((h) => (
                        <button key={h} type="button"
                                className={`res-option${heure === h ? ' actif' : ''}`}
                                onClick={() => setHeure(h)}>{h}</button>
                      ))}
                    </div>
                  </div>
                  <p className="field-hint">
                    {logicielSeul
                      ? 'Vos comptes ont accès à partir de cette heure-là.'
                      : 'L’équipe arrive quinze minutes avant pour s’installer.'}
                  </p>
                </div>
                )}
              </div>

              {!resultat.ok && resultat.refus === 'trop_tot' && jour && (
                <div className="res-refus" role="status">
                  <h2>{logicielSeul ? 'Ce créneau est passé' : 'Ce créneau est trop proche'}</h2>
                  <p>
                    {logicielSeul
                      ? 'Choisissez une heure à venir : le reste ne change pas.'
                      : `Constituer une équipe demande ${DELAI_HEURES} heures. Choisissez un jour plus loin : le reste ne change pas.`}
                  </p>
                </div>
              )}

              <div className="res-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEtape(1)}>Retour</button>
                {/* ⚠️ Pas de « Voir mon prix » pour le logiciel : le prix est
                    DÉJÀ dans le volet, à côté, et le bouton qui engage est
                    juste dessous. Un second bouton pour aller voir ce qu'on a
                    sous les yeux est un pas de plus pour rien. */}
                {!logicielSeul && (
                <button type="button" className="btn btn-primary" disabled={!etape2Prete}
                        onClick={() => setEtape(3)}>
                  Continuer
                </button>
                )}
              </div>
            </section>
            {recap}
          </div>
        )}

        {etape === 3 && (
          <div className="res-colonnes">
            <section className="res-questions echange-entre">
              <h1>Que faut-il compter ?</h1>

              <div className="field">
                <span className="champ-label">Ce que vous vendez</span>
                <div className="res-choix">
                  {SECTEURS.map((s) => (
                    <button key={s.cle} type="button"
                            className={`res-option${secteur === s.cle ? ' actif' : ''}`}
                            onClick={() => setSecteur(s.cle)}>{s.nom}</button>
                  ))}
                </div>
              </div>

              <div className="field-duo">
                <div className="field">
                  <label htmlFor={`${uid}-sv`}>Surface de vente</label>
                  <input id={`${uid}-sv`} value={surfaceVente} inputMode="numeric" maxLength={6}
                         placeholder="600" onChange={(e) => setSurfaceVente(e.target.value.replace(/\D/g, ''))} />
                  <p className="field-hint">m²</p>
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-sr`}>Surface de réserve</label>
                  <input id={`${uid}-sr`} value={surfaceReserve} inputMode="numeric" maxLength={6}
                         placeholder="150" onChange={(e) => setSurfaceReserve(e.target.value.replace(/\D/g, ''))} />
                  <p className="field-hint">m²</p>
                </div>
              </div>

              <div className="field">
                <label htmlFor={`${uid}-art`}>Combien d’articles, à peu près</label>
                <select id={`${uid}-art`} value={trancheArticles}
                        onChange={(e) => setTrancheArticles(e.target.value)}>
                  <option value="">Choisir…</option>
                  {TRANCHES_ARTICLES.map((t) => <option key={t.cle} value={t.cle}>{t.nom}</option>)}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`${uid}-ref`}>Combien de références différentes</label>
                <select id={`${uid}-ref`} value={trancheReferences}
                        onChange={(e) => setTrancheReferences(e.target.value)}>
                  <option value="">Choisir…</option>
                  {TRANCHES_REFERENCES.map((t) => <option key={t.cle} value={t.cle}>{t.nom}</option>)}
                </select>
              </div>

              <div className="field">
                <span className="champ-label">Tous les articles portent-ils un code-barres ?</span>
                <div className="res-choix">
                  <button type="button" className={`res-option${codeBarres === 'tous' ? ' actif' : ''}`}
                          onClick={() => setCodeBarres('tous')}>Oui</button>
                  <button type="button" className={`res-option${codeBarres === 'partiel' ? ' actif' : ''}`}
                          onClick={() => setCodeBarres('partiel')}>Non, une partie seulement</button>
                </div>
              </div>

              {/* ⚠️ C'est cet engagement qui autorise le recalcul sur place si le
                  magasin trouvé n'est pas celui décrit. Il est daté en base, pas
                  seulement coché — comme les CGV. */}
              <label className="res-engagement">
                <input type="checkbox" checked={engage} onChange={(e) => setEngage(e.target.checked)} />
                <span>
                  <strong>Je m’engage à ce que le stock soit rangé et chaque article scannable</strong>
                  <em>
                    Articles à leur place, réserve accessible, étiquettes lisibles et
                    atteignables. C’est ce qui nous permet d’annoncer une durée et un
                    prix fermes.
                  </em>
                </span>
              </label>

              <div className="res-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEtape(2)}>Retour</button>
                <button type="button" className="btn btn-primary" disabled={!etape3Prete}
                        onClick={() => setEtape(4)}>Voir mon prix</button>
              </div>
            </section>
            {recap}
          </div>
        )}

        {/* ⚠️ SI LE DEVIS NE TIENT PAS, ON LE DIT. Une étape qui ne se rend
            que sous condition rend une page vide quand la condition tombe —
            et une page vide ne dit à personne ce qu'il faut corriger. */}
        {etape === 4 && !resultat.ok && (
          <div className="res-prix-page">
            <div className="res-refus" role="status">
              <h2>Il manque une réponse</h2>
              <p>
                {resultat.refus === 'trop_tot'
                  ? 'Le créneau choisi est passé ou trop proche. Revenez à la date.'
                  : resultat.refus === 'hors_zone'
                    ? 'Nous n’intervenons pas encore à cette adresse avec une équipe.'
                    : 'Reprenez les questions : l’une d’elles attend encore une réponse.'}
              </p>
              <button type="button" className="btn btn-ghost"
                      onClick={() => setEtape(resultat.refus === 'trop_tot' ? 2 : 1)}>
                Revenir
              </button>
            </div>
          </div>
        )}

        {etape === 4 && resultat.ok && (
          <div className="res-prix-page">
            <div className="res-prix-tete">
              <h1>Votre inventaire</h1>
              <p className="muted">
                {magasin.trim() || adresse.trim()} — {debut && `${enDate(debut)}, ${enHeure(debut)}`}
              </p>
            </div>

            <div className="res-prix-carte">
              <strong className="res-montant num">{enEuros(resultat.chaine.prixCents)}</strong>
              <p className="muted">TVA non applicable, article 293 B du CGI</p>
              {/* ⚠️ DEUX LISTES, PAS UNE LISTE AVEC DES `&&` PARTOUT. Ce que
                  le client achète n'est pas le même objet dans les deux
                  formules : dans l'une on vend des gens, dans l'autre un
                  accès. Une liste unique truffée de conditions finit par
                  promettre un inventoriste à quelqu'un qui n'en a pas. */}
              {logicielSeul ? (
                <ul className="res-compris">
                  <li>
                    <strong>
                      Quantinvo ouvert pour {nb(resultat.chaine.appareils)} appareil
                      {resultat.chaine.appareils > 1 ? 's' : ''}
                    {/* ⚠️ « le temps de cet inventaire » était devenu faux le jour
                        où la licence est passée à une semaine : elle ne se ferme
                        pas quand le comptage finit. Une phrase vague au moment de
                        payer, c'est une réclamation plus tard. */}
                    </strong>, pendant {REGLAGES.fenetreJours} jours
                  </li>
                  <li>
                    Comptez environ {duree(resultat.chaine.dureeMinutes)} de travail
                    {resultat.chaine.appareils > 1
                      ? `, à ${nb(resultat.chaine.appareils)} appareils en parallèle`
                      : ''}
                  </li>
                  <li>Comptage, seconde passe d’audit, écarts recomptés</li>
                  <li>Rapport à la clôture — Excel, CSV, PDF</li>
                </ul>
              ) : (
                <ul className="res-compris">
                  <li>
                    <strong>
                      {nb(resultat.chaine.inventoristes)} inventoriste{resultat.chaine.inventoristes > 1 ? 's' : ''}
                      {resultat.chaine.responsable ? ' et un responsable' : ''}
                    </strong>, sur place à {enHeure(resultat.arrivee)}
                  </li>
                  <li>{duree(resultat.chaine.dureeMinutes)} environ — fin prévue vers {enHeure(resultat.finPrevue)}</li>
                  <li>Écarts contrôlés et recomptés avant la clôture</li>
                  <li>Rapport à la clôture — Excel, CSV, PDF</li>
                </ul>
              )}
              {venteOuverte() ? (
                <>
                  <button type="button" className="btn btn-primary btn-block"
                          disabled={occupe}
                          onClick={() => { if (connecte) void reserverMaintenant(); else setEtape(5) }}>
                    {occupe ? 'Un instant…' : `Réserver — ${enEuros(resultat.chaine.prixCents)}`}
                  </button>
                  {/* ⚠️ LE REFUS S'AFFICHE SOUS LE BOUTON QUI L'A PROVOQUÉ.
                      Sans ça, un « cette date est trop proche » rendu par la
                      base ne s'écrirait nulle part : cet écran n'avait aucun
                      endroit pour une erreur, puisqu'il ne parlait au serveur
                      que depuis le 5 octobre 2026. */}
                  {erreur && <p className="field-err">{erreur}</p>}
                </>
              ) : (
                /* ⚠️ MÊME VERROU QUE `/inscription` ET `/souscrire` : tant que
                   `web/lib/legal.ts` est incomplet, rien ne se vend. Le prix
                   s'affiche quand même — il est juste, et le cacher ne
                   protégerait personne. C'est la réservation qui attend. */
                <>
                  <button type="button" className="btn btn-primary btn-block" disabled>
                    Réserver — {enEuros(resultat.chaine.prixCents)}
                  </button>
                  <p className="res-ferme">
                    La réservation n’est pas encore ouverte. Ce prix est bien celui
                    que vous paierez le jour où elle le sera.
                  </p>
                  <button type="button" className="link-btn res-suite"
                          onClick={() => setEtape(5)}>
                    Voir la suite du parcours
                  </button>
                </>
              )}

              {/* ⚠️ **L'AUTRE FORMULE, AVEC SON PRIX, ET PAS SEULEMENT SON
                  NOM.** C'est ici que quelqu'un découvre l'écart entre les
                  deux — et c'est le seul endroit du parcours où il a les deux
                  chiffres sous les yeux. Un lien qui dirait « voir l'autre
                  formule » l'obligerait à refaire le tunnel pour savoir. */}
              {FORMULE_EQUIPE_OUVERTE && autreFormule.ok && (
                <p className="res-bascule muted">
                  {logicielSeul
                    ? 'Personne pour compter ce jour-là ?'
                    : 'Vous avez du monde pour compter ?'}{' '}
                  <button type="button" className="link-btn"
                          onClick={() => setFormule(logicielSeul ? 'equipe_quantinvo' : 'logiciel_seul')}>
                    {logicielSeul
                      ? `Venir compter pour vous — ${enEuros(autreFormule.chaine.prixCents)}`
                      : `Le logiciel seul — ${enEuros(autreFormule.chaine.prixCents)}`}
                  </button>
                </p>
              )}

              <button type="button" className="link-btn" onClick={() => setEtape(1)}>
                Modifier mes réponses
              </button>
            </div>

            <div className="res-notes">
              <section>
                <h2>Ce prix est ferme</h2>
                <p>
                  Il ne bougera plus après votre réservation. La seule exception :
                  si le magasin que nous trouvons sur place n’est pas celui que
                  vous avez décrit — deux fois plus de stock, une réserve fermée,
                  un rayon en vrac. Dans ce cas nous vous prévenons avant de
                  commencer, et vous décidez.
                </p>
              </section>
              <section>
                <h2>Rien n’est débité aujourd’hui</h2>
                <p>
                  Nous bloquons le montant sur votre carte à la réservation. Le
                  débit a lieu quand l’inventaire est terminé et le rapport
                  disponible.
                </p>
              </section>
              <section>
                <h2>Annulation gratuite</h2>
                <p>
                  Jusqu’au {enDate(resultat.annulationGratuiteJusquAu)} à{' '}
                  {enHeure(resultat.annulationGratuiteJusquAu)}, soit trois jours
                  avant. Au-delà, une part du montant reste due.
                </p>
              </section>
            </div>
          </div>
        )}

        {etape === 5 && (
          <div className="res-colonnes">
            <section className="res-questions">
              <h1>Votre compte</h1>
              <p className="muted">
                Il sert à suivre l’inventaire en direct, à retrouver vos rapports
                et vos factures.
              </p>
              <button type="button" className="link-btn res-bascule"
                      onClick={() => { setErreur(null); setEtape(6) }}>
                J’ai déjà un compte
              </button>

              <div className="field-duo">
                <div className="field">
                  <label htmlFor={`${uid}-prenom`}>Prénom</label>
                  <input id={`${uid}-prenom`} value={prenom} autoComplete="given-name"
                         maxLength={80} onChange={(e) => setPrenom(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-nomf`}>Nom</label>
                  <input id={`${uid}-nomf`} value={nomFamille} autoComplete="family-name"
                         maxLength={80} onChange={(e) => setNomFamille(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-mail`}>Adresse e-mail</label>
                <input id={`${uid}-mail`} type="email" autoComplete="email" value={courriel}
                       placeholder="vous@entreprise.fr"
                       onChange={(e) => setCourriel(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`${uid}-tel`}>Téléphone</label>
                <input id={`${uid}-tel`} type="tel" autoComplete="tel" value={telephone}
                       maxLength={30} onChange={(e) => setTelephone(e.target.value)} />
                <p className="field-hint">
                  Pour vous joindre le soir de l’inventaire, et pour rien d’autre.
                </p>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-mdp`}>Mot de passe</label>
                <input id={`${uid}-mdp`} type="password" autoComplete="new-password"
                       value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                <PasswordRules password={motDePasse} />
              </div>
              <div className="field-duo">
                <div className="field">
                  <label htmlFor={`${uid}-siren`}>SIREN <span className="muted">(facultatif)</span></label>
                  <input id={`${uid}-siren`} value={siren} inputMode="numeric"
                         placeholder="123 456 789"
                         onChange={(e) => setSiren(formaterSiren(e.target.value))} />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-societe`}>Raison sociale</label>
                  <input id={`${uid}-societe`} value={societe} maxLength={80}
                         autoComplete="organization"
                         onChange={(e) => setSociete(e.target.value)} />
                </div>
              </div>

              {erreur && <p className="field-err">{erreur}</p>}

              <MentionCollecte finalite="créer votre compte, organiser votre inventaire et vous adresser votre facture" />

              <div className="res-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEtape(4)}>Retour</button>
                <button type="button" className="btn btn-primary"
                        disabled={occupe || !compteComplet || !venteOuverte()}
                        onClick={ouvrirMonCompte}>
                  {occupe ? 'Un instant…' : 'Continuer vers le paiement'}
                </button>
              </div>
              {!venteOuverte() && (
                <p className="res-ferme">
                  La création de compte ouvre en même temps que la réservation.
                </p>
              )}
            </section>

            <div className="res-cote">
              {recap}
              <section className="res-encadre">
                <h2>Ce que le compte garde</h2>
                <p className="muted">
                  {(magasin.trim() || adresse.trim())} et ses surfaces y sont
                  enregistrés. La prochaine réservation partira de là :
                  l’établissement est déjà connu, il ne reste que la date.
                </p>
              </section>
              <p className="res-aucun-prelevement">Aucun prélèvement à cette étape.</p>
            </div>
          </div>
        )}

        {etape === 6 && (
          <div className="res-colonnes">
            <section className="res-questions">
              <h1>Se connecter</h1>
              <p className="muted">Le même compte que pour Quantinvo OS, s’il vous en faut un.</p>
              <button type="button" className="link-btn res-bascule"
                      onClick={() => { setErreur(null); setEtape(5) }}>
                Créer un compte
              </button>

              <div className="field">
                <label htmlFor={`${uid}-mail2`}>Adresse e-mail</label>
                <input id={`${uid}-mail2`} type="email" autoComplete="email" value={courriel}
                       onChange={(e) => setCourriel(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`${uid}-mdp2`}>Mot de passe</label>
                <input id={`${uid}-mdp2`} type="password" autoComplete="current-password"
                       value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                <Link href="/mot-de-passe-oublie" className="field-hint res-oubli">
                  Mot de passe oublié
                </Link>
              </div>

              {erreur && <p className="field-err">{erreur}</p>}

              <section className="res-encadre res-note-os">
                <h2>Vous êtes déjà abonné à Quantinvo OS ?</h2>
                <p className="muted">
                  Connectez-vous : vos magasins, vos coordonnées et votre carte
                  sont déjà là. Réserver une équipe ne crée pas un second compte.
                </p>
              </section>

              <div className="res-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEtape(4)}>Retour</button>
                <button type="button" className="btn btn-primary"
                        disabled={occupe || !courriel.trim() || !motDePasse}
                        onClick={seConnecter}>
                  {occupe ? 'Un instant…' : 'Se connecter et continuer'}
                </button>
              </div>
            </section>

            <div className="res-cote">
              {recap}
              <section className="res-encadre">
                <h2>Votre réservation est gardée</h2>
                <p className="muted">
                  Vos réponses et ce prix vous attendent. Vous reprenez où vous en
                  êtes, même en revenant demain.
                </p>
              </section>
              <p className="res-aucun-prelevement">Aucun prélèvement à cette étape.</p>
            </div>
          </div>
        )}

        {/* ⚠️⚠️ **DEUX ARRIVÉES, PARCE QU'IL Y A DEUX SITUATIONS** (5 octobre
            2026). Cet écran disait « Votre réservation est enregistrée avec ce
            prix » à tout le monde — alors que le tunnel n'écrivait rien, nulle
            part. Désormais : une référence quand c'est réservé, et un renvoi
            vers la boîte mail quand le compte reste à ouvrir. */}
        {etape === 7 && reference && (
          <div className="res-prix-page">
            <div className="res-prix-tete">
              <h1>C’est réservé</h1>
              <p className="muted">
                Votre inventaire est enregistré sous la référence <strong>{reference}</strong>.
                Vous le retrouvez dans vos inventaires, avec ce qu’il reste à préparer.
              </p>
            </div>
            <div className="res-prix-carte">
              <ul className="res-compris">
                <li>Annulation gratuite jusqu’à trois jours avant, sans frais.</li>
                <li>Vous créez votre inventaire depuis votre tableau de bord, quand vous voulez.</li>
                {/* ⚠️ Le paiement n'est pas branché, et le dire vaut mieux que
                    de laisser croire qu'une carte a été prise. */}
                <li>Le paiement n’est pas encore ouvert : nous vous écrivons dès qu’il l’est.</li>
              </ul>
              <Link href="/on-demand/mes-inventaires" className="btn btn-primary btn-block">
                Voir mes inventaires
              </Link>
              <Link href="/dashboard" className="btn btn-ghost btn-block">
                Aller à mon tableau de bord
              </Link>
            </div>
          </div>
        )}

        {etape === 7 && !reference && (
          <div className="res-prix-page">
            <div className="res-prix-tete">
              <h1>Regardez votre boîte mail</h1>
              <p className="muted">
                {/* ⚠️ LA MÊME PHRASE DANS TOUS LES CAS, et c'est ici que ça se
                    joue : « cette adresse a déjà un compte » rouvrirait
                    l'oracle d'énumération fermé le 28 août 2026. C'est
                    l'e-mail, qui n'atteint que le propriétaire de la boîte,
                    qui dit la vérité — et il dit quoi faire : si un compte
                    existe déjà, se connecter, et la réservation reprend ici. */}
                Nous venons de vous écrire à {courriel.trim().toLowerCase()}. Le
                message vous dit comment continuer — soit avec le code, soit en
                vous connectant si vous avez déjà un compte.
              </p>
            </div>
            <div className="res-prix-carte">
              <ul className="res-compris">
                <li>Votre parcours est conservé : vous reprenez où vous en êtes.</li>
                <li>Annulation gratuite jusqu’à trois jours avant.</li>
              </ul>
              <button type="button" className="btn btn-primary btn-block"
                      onClick={() => { setErreur(null); setEtape(6) }}>
                J’ai déjà un compte — me connecter
              </button>
              <Link href={lien('/')} className="btn btn-ghost btn-block">Revenir à l’accueil</Link>
            </div>
          </div>
        )}

        {/* ⚠️ **LA RAISON SOCIALE, DEMANDÉE SEULEMENT QUAND LE SERVEUR LA
            RÉCLAME.** Un pro connecté n'a pas forcément d'entreprise
            utilisable : depuis le 5 octobre 2026, un compteur invité chez
            quelqu'un d'autre n'en a plus — celui qui paie devient le client,
            avec la sienne. L'écran ne devine pas son cas en relisant
            `profiles.role`, il réagit au refus. */}
        {etape === 8 && entrepriseAFournir && (
          <div className="res-colonnes">
            <section className="res-questions">
              <h1>Au nom de quelle entreprise ?</h1>
              <p className="muted">
                C’est elle qui apparaîtra sur votre facture et sur votre rapport
                d’inventaire.
              </p>
              <div className="field-duo">
                <div className="field">
                  <label htmlFor={`${uid}-soc2`}>Raison sociale</label>
                  <input id={`${uid}-soc2`} value={societe} maxLength={80}
                         autoComplete="organization"
                         onChange={(e) => setSociete(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-siren2`}>SIREN <span className="muted">(facultatif)</span></label>
                  <input id={`${uid}-siren2`} value={siren} inputMode="numeric"
                         placeholder="123 456 789"
                         onChange={(e) => setSiren(formaterSiren(e.target.value))} />
                </div>
              </div>
              {erreur && <p className="field-err">{erreur}</p>}
              <div className="res-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEtape(4)}>Retour</button>
                <button type="button" className="btn btn-primary"
                        disabled={occupe || societe.trim() === '' || !venteOuverte()}
                        onClick={() => void reserverMaintenant()}>
                  {occupe ? 'Un instant…' : 'Réserver'}
                </button>
              </div>
            </section>
            <div className="res-cote">
              {recap}
            </div>
          </div>
        )}
      </main>
      <SiteFooter langue="fr" />
    </>
  )
}
