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
 * ⚠️ **AUCUN PRIX N'EST DÉCIDÉ ICI.** `devis()` vient de `lib/prixOnDemand.ts`,
 * la copie d'affichage — le montant qui engage vient de `devis_mission` en
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
import { mesEtablissements, type Etablissement } from '@/lib/onDemandClient'
import { useTraduction } from '@/lib/i18n'
import { Logo } from '@/components/Logo'
import { euros } from '@/lib/offres'
import { nb } from '@/lib/format'
import {
  DELAI_HEURES, MOMENTS, OU_NOUS_ALLONS, SECTEURS,
  TRANCHES_ARTICLES, TRANCHES_REFERENCES,
  devis, duree, estDesservi,
  type Devis, type Formule, type MomentCle, type Secteur,
} from '@/lib/prixOnDemand'

const ETAPES = ['Établissement', 'Date', 'Stock'] as const

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
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
  const [formule, setFormule] = useState<Formule>('equipe_quantinvo')
  useEffect(() => {
    const p = params.get('formule')
    if (p === 'logiciel') setFormule('logiciel_seul')
    else if (p === 'equipe') setFormule('equipe_quantinvo')
  }, [params])
  const logicielSeul = formule === 'logiciel_seul'

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

  const resultat: Devis = useMemo(
    () => devis({ codePostal, secteur, trancheArticles, debut, formule }),
    [codePostal, secteur, trancheArticles, debut, formule],
  )

  /** L'autre formule, au même volume — pour montrer l'écart sans le recopier. */
  const autreFormule: Devis = useMemo(
    () => devis({ codePostal, secteur, trancheArticles, debut,
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
   * on arrive à l'étape du prix avec un devis en échec — et comme cette étape
   * ne s'affiche que si le devis tient, on arrive sur une PAGE BLANCHE.
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

  const seConnecter = async () => {
    setErreur(null); setOccupe(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: courriel.trim().toLowerCase(), password: motDePasse,
    })
    setOccupe(false)
    if (error) { setErreur('Adresse ou mot de passe incorrect.'); return }
    setMotDePasse('')
    setEtape(7)
  }

  const ouvrirMonCompte = async () => {
    setErreur(null)
    const faible = passwordError(motDePasse)
    if (faible) { setErreur(faible); return }
    const mauvaisSiren = siren.trim() ? messageSiren(siren) : null
    if (mauvaisSiren) { setErreur(mauvaisSiren); return }
    setOccupe(true)
    const r = await edge({ action: 'code', email: courriel.trim().toLowerCase() })
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
        <div>
          <dt>Établissement</dt>
          <dd>{magasin.trim() || adresse.trim() || <span className="muted">À renseigner</span>}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{debut ? `${enDate(debut)}, ${enHeure(debut)}` : <span className="muted">À choisir</span>}</dd>
        </div>
        <div>
          <dt>{etape >= 5 ? 'À payer' : 'Prix'}</dt>
          <dd>
            {resultat.ok
              ? <strong className="num">{enEuros(resultat.chaine.prixCents)}</strong>
              : <span className="muted">
                  {etape < 3 ? 'Après la dernière question' : 'Une réponse et il s’affiche'}
                </span>}
          </dd>
        </div>
      </dl>
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
            {ETAPES.map((nom, i) => (
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
        {etape === 1 && (
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

        {etape === 2 && (
          <div className="res-colonnes">
            <section className="res-questions">
              <h1>Quand ?</h1>
              <p className="muted">
                Avant l’ouverture, en pleine journée ou après la fermeture — comme
                vous voulez.{' '}
                {logicielSeul
                  ? 'Le logiciel s’ouvre à l’heure que vous choisissez, même aujourd’hui.'
                  : 'Nous n’affichons que les créneaux où nous avons une équipe.'}
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
                      return (
                        <button key={d.toISOString()} type="button" disabled={tropTot}
                                className={`res-jour${choisi ? ' choisi' : ''}${tropTot ? ' vide' : ''}`}
                                onClick={() => setJour(d)}>
                          {d.getDate()}
                        </button>
                      )
                    })}
                  </div>
                  <p className="res-legende">
                    {logicielSeul ? (
                      <>
                        <span className="res-pastille dispo" /> Ouvrable
                        <span className="res-pastille absente" /> Déjà passé
                      </>
                    ) : (
                      <>
                        <span className="res-pastille dispo" /> Équipe disponible
                        <span className="res-pastille absente" /> Pas d’équipe
                      </>
                    )}
                  </p>
                </div>

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
                <button type="button" className="btn btn-primary" disabled={!etape2Prete}
                        onClick={() => setEtape(3)}>Continuer</button>
              </div>
            </section>
            {recap}
          </div>
        )}

        {etape === 3 && (
          <div className="res-colonnes">
            <section className="res-questions">
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
                    </strong>, le temps de cet inventaire
                  </li>
                  <li>
                    Prévoyez {nb(resultat.chaine.compteursAttendus)} personne
                    {resultat.chaine.compteursAttendus > 1 ? 's' : ''} pour {duree(resultat.chaine.dureeMinutes)} environ
                    {resultat.chaine.compteursAttendus >= 3 ? ', plus qui encadre' : ''}
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
                <button type="button" className="btn btn-primary btn-block"
                        onClick={() => setEtape(connecte ? 7 : 5)}>
                  Réserver — {enEuros(resultat.chaine.prixCents)}
                </button>
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
              {autreFormule.ok && (
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

        {etape === 7 && (
          <div className="res-prix-page">
            <div className="res-prix-tete">
              <h1>Le paiement arrive</h1>
              <p className="muted">
                {/* ⚠️ Cette page n'existe pas encore, et le dire vaut mieux que
                    de la dessiner à moitié : l'empreinte bancaire passe par
                    Stripe, qui n'est pas en live (`docs/notes/047`). */}
                L’empreinte bancaire n’est pas encore branchée. Votre réservation
                est enregistrée avec ce prix ; nous vous écrivons dès que le
                paiement ouvre.
              </p>
            </div>
            <div className="res-prix-carte">
              <ul className="res-compris">
                <li>Nous bloquons le montant sur votre carte à la réservation.</li>
                <li>Le débit a lieu à la fin de l’inventaire, rapport disponible.</li>
                <li>Annulation gratuite jusqu’à trois jours avant.</li>
              </ul>
              <Link href={lien('/')} className="btn btn-ghost btn-block">Revenir à l’accueil</Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter langue="fr" />
    </>
  )
}
