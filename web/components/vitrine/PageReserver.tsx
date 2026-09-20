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
import { useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { SiteFooter } from '@/components/SiteChrome'
import { venteOuverte } from '@/lib/legal'
import { useTraduction } from '@/lib/i18n'
import { Logo } from '@/components/Logo'
import { euros } from '@/lib/offres'
import { nb } from '@/lib/format'
import {
  DELAI_HEURES, MOMENTS, OU_NOUS_ALLONS, SECTEURS,
  TRANCHES_ARTICLES, TRANCHES_REFERENCES,
  devis, duree, estDesservi, type Devis, type MomentCle, type Secteur,
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

  // ⚠️ Chaque étape recommence en haut. Sans ça, on arrive au milieu de la
  // question suivante — d'autant plus que les étapes n'ont pas la même hauteur.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [etape])

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

  const debut = useMemo(() => {
    if (!jour) return null
    const [h, m] = heure.split(':').map(Number)
    return new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), h, m)
  }, [jour, heure])

  const resultat: Devis = useMemo(
    () => devis({ codePostal, secteur, trancheArticles, debut }),
    [codePostal, secteur, trancheArticles, debut],
  )

  // ⚠️ La zone se vérifie DÈS L'ÉTAPE 1, avant de faire choisir une date à
  // quelqu'un qu'on ne peut pas servir. Le refus ne propose pas de devis de
  // rattrapage : c'est toute la promesse du produit.
  const zoneConnue = codePostal.replace(/\D/g, '').length >= 2
  const horsZone = zoneConnue && !estDesservi(codePostal)

  const etape1Prete = adresse.trim().length > 4 && zoneConnue && !horsZone
  const etape2Prete = Boolean(debut)
  const etape3Prete = Boolean(secteur && trancheArticles && codeBarres && engage)

  const heures = MOMENTS.find((m) => m.cle === moment)?.heures ?? []

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
          <dt>Prix</dt>
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
      <header className="res-barre">
        <div className="res-barre-inner">
          <Link href={lien('/')} className="brand" aria-label="Quantinvo">
            <Logo size={22} /><span>Quantinvo</span>
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

      <main className="res-page">
        {etape === 1 && (
          <div className="res-colonnes">
            <section className="res-questions">
              <h1>Où faut-il compter ?</h1>
              <p className="muted">
                Trois questions et votre prix s’affiche. Vous ne créerez un compte
                qu’au moment de réserver.
              </p>

              <div className="field">
                <label htmlFor={`${uid}-adresse`}>Adresse du magasin</label>
                <input id={`${uid}-adresse`} value={adresse} autoComplete="street-address"
                       maxLength={160} placeholder="12 rue de Rivoli"
                       onChange={(e) => setAdresse(e.target.value)} />
              </div>
              <div className="field-duo">
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
              <p className="res-zone-note">Nous intervenons à {OU_NOUS_ALLONS}.</p>

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

              <div className="field">
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
              <section className="res-encadre">
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
                vous voulez. Nous n’affichons que les créneaux où nous avons une équipe.
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
                      const tropTot = finDuJour.getTime() < aujourdhui.getTime() + DELAI_HEURES * 3600_000
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
                    <span className="res-pastille dispo" /> Équipe disponible
                    <span className="res-pastille absente" /> Pas d’équipe
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
                  <p className="field-hint">L’équipe arrive quinze minutes avant pour s’installer.</p>
                </div>
              </div>

              {!resultat.ok && resultat.refus === 'trop_tot' && jour && (
                <div className="res-refus" role="status">
                  <h2>Ce créneau est trop proche</h2>
                  <p>
                    Constituer une équipe demande {DELAI_HEURES} heures. Choisissez
                    un jour plus loin : le reste ne change pas.
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
              {venteOuverte() ? (
                <button type="button" className="btn btn-primary btn-block">
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
                </>
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
      </main>
      <SiteFooter langue="fr" />
    </>
  )
}
