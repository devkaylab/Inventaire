'use client'

// Le rapport consolidé d'un magasin (4 septembre 2026).
//
// Julien : « Commence d'abord par le rapport par magasin, qui sera également
// consultable par l'admin entreprise en plus de admin Quantinvo. »
// Maquette validée avant codage :
// https://claude.ai/code/artifact/271da757-20b0-4728-b83f-610a265ae127
//
// ⚠️ QUI Y ACCÈDE : l'administrateur de l'entreprise et l'administrateur
// Quantinvo, personne d'autre. « Le superviseur d'un secteur n'a pas besoin de
// voir le rapport de son collègue d'un autre secteur du magasin » — il garde
// le rapport de SES inventaires, par l'onglet Rapport de chacun.
//
// ⚠️ CE QUI EST ADDITIONNÉ EST CE QUI EST COCHÉ. Les deux dates ne servent
// qu'à préparer la sélection ; c'est la liste d'inventaires qui part au
// serveur, et lui n'en retient que les CLÔTURÉS. Un inventaire en cours ferait
// bouger le rapport d'heure en heure.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany, type Company } from '@/lib/account'
import {
  getInventairesDuMagasin, getRapportMagasinPage, getRapportMagasinResume,
  getToutLeDetailMagasin, getToutesLesLignesMagasin,
  type EnteteMagasin, type InventaireDuMagasin, type LigneRapportMagasin,
  type RapportMagasinResume, type TriRapportMagasin,
} from '@/lib/rapportMagasin'
import { downloadStoreCsv, downloadStoreXlsx } from '@/lib/report'
import { fmtQty, fmtSigned, money, nb } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Pagination, useRetourEnHaut } from '@/components/ui/Pagination'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'

const PAGE = 50
const DELAI_RECHERCHE_MS = 350

/**
 * La période proposée à l'ouverture : les 90 derniers jours.
 *
 * Assez large pour attraper une campagne d'inventaires étalée sur plusieurs
 * semaines — c'est le cas courant d'un grand magasin qui compte étage par
 * étage — sans remonter des inventaires de l'an dernier que personne ne
 * voulait additionner. Les deux champs restent modifiables, et un inventaire
 * hors période se coche à la main.
 */
const FENETRE_JOURS = 90

function jour(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function RapportMagasinPage() {
  const guard = useAuthGuard('supervisor')
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId
  const toast = useToast()

  const [company, setCompany] = useState<Company | null>(null)
  const [magasin, setMagasin] = useState<EnteteMagasin | null>(null)
  const [inventaires, setInventaires] = useState<InventaireDuMagasin[]>([])
  const [coches, setCoches] = useState<string[]>([])
  const [listeOuverte, setListeOuverte] = useState(false)
  const [erreur, setErreur] = useState(false)

  const [du, setDu] = useState(() => jour(new Date(Date.now() - FENETRE_JOURS * 86_400_000)))
  const [au, setAu] = useState(() => jour(new Date()))

  const [chargementListe, setChargementListe] = useState(true)
  const [resume, setResume] = useState<RapportMagasinResume | null>(null)
  const [chargementResume, setChargementResume] = useState(true)
  const [rows, setRows] = useState<LigneRapportMagasin[]>([])
  const [totalFiltre, setTotalFiltre] = useState(0)
  const [chargeantPage, setChargeantPage] = useState(false)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [recherche, setRecherche] = useState('')
  const [multi, setMulti] = useState(false)
  const [sort, setSort] = useState<{ key: TriRapportMagasin; dir: 1 | -1 }>({ key: 'variance_value', dir: -1 })
  const [askFormat, setAskFormat] = useState(false)
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)
  const [avance, setAvance] = useState<string | null>(null)

  const hautDuTableau = useRetourEnHaut(page)
  /** Une clé stable pour la sélection : un tableau change d'identité à chaque rendu. */
  const cles = coches.join(',')

  useEffect(() => {
    const t = setTimeout(() => setRecherche(query), DELAI_RECHERCHE_MS)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => { setPage(0) }, [recherche, sort, multi, cles])

  useEffect(() => {
    if (guard.status !== 'ready') return
    if (!guard.profile.is_company_admin && !guard.profile.is_admin) {
      window.location.replace('/magasins')
      return
    }
    getMyCompany().then(setCompany).catch(() => setCompany(null))
  }, [guard])

  /** La liste des inventaires, et la sélection qu'elle propose. */
  useEffect(() => {
    if (guard.status !== 'ready' || !storeId) return
    let vivant = true
    setChargementListe(true)
    getInventairesDuMagasin(storeId, du, au)
      .then(({ magasin: m, inventaires: liste }) => {
        if (!vivant) return
        setMagasin(m)
        setInventaires(liste)
        // ⚠️ La proposition, pas la décision : on coche ce que la période
        // retient, et rien n'empêche ensuite d'en décocher ou d'aller
        // chercher un inventaire plus ancien.
        setCoches(liste.filter(i => i.dans_periode).map(i => i.session_id))
      })
      .catch(() => { if (vivant) setErreur(true) })
      .finally(() => { if (vivant) setChargementListe(false) })
    return () => { vivant = false }
  }, [guard.status, storeId, du, au])

  /** Les totaux : tout le périmètre, jamais la page. */
  useEffect(() => {
    if (!storeId || chargementListe) return
    let vivant = true
    setChargementResume(true)
    getRapportMagasinResume(storeId, coches)
      .then(r => { if (vivant) setResume(r) })
      .catch(() => { if (vivant) setResume(null) })
      .finally(() => { if (vivant) setChargementResume(false) })
    return () => { vivant = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, cles, chargementListe])

  /** La page affichée. */
  useEffect(() => {
    if (!storeId || chargementListe) return
    let vivant = true
    setChargeantPage(true)
    getRapportMagasinPage(storeId, coches, {
      recherche,
      tri: sort.key,
      sens: sort.dir === 1 ? 'asc' : 'desc',
      offset: page * PAGE,
      limite: PAGE,
      multiSeulement: multi,
    })
      .then(({ rows: r, total }) => { if (vivant) { setRows(r); setTotalFiltre(total) } })
      .catch(err => { if (vivant) toast.error(friendlyError(err)) })
      .finally(() => { if (vivant) setChargeantPage(false) })
    return () => { vivant = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, cles, chargementListe, recherche, sort, page, multi])

  const basculer = useCallback((id: string) => {
    setCoches(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]))
  }, [])

  const clos = useMemo(() => inventaires.filter(i => i.statut === 'closed'), [inventaires])
  const enCours = useMemo(() => inventaires.filter(i => i.statut !== 'closed'), [inventaires])

  // Le filtre du bandeau ne survit pas à la disparition des doublons : il
  // laisserait un tableau vide sans rien pour l'expliquer.
  useEffect(() => {
    if (multi && resume && resume.doublons === 0) setMulti(false)
  }, [multi, resume])

  function trier(key: TriRapportMagasin) {
    setSort(s => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: -1 }))
  }

  async function exporter(format: 'xlsx' | 'csv') {
    if (!magasin) return
    setExporting(format)
    setAvance('Préparation…')
    try {
      const suivi = (quoi: string) => (fait: number, total: number) =>
        setAvance(`${quoi} ${nb(fait)} / ${nb(total)}`)
      // ⚠️ Le fichier remis au client contient TOUT le périmètre, par tranches.
      const tout = await getToutesLesLignesMagasin(storeId!, coches, suivi('Références'))
      const detail = await getToutLeDetailMagasin(storeId!, coches, suivi('Par inventaire'))

      if (format === 'csv') {
        const noms = downloadStoreCsv(magasin.nom, tout, detail)
        toast.success(noms.length > 1
          ? `${noms.length} fichiers téléchargés : consolidé et détail par inventaire.`
          : `${noms[0]} téléchargé.`)
      } else {
        const nom = await downloadStoreXlsx(magasin.nom, tout, detail)
        toast.success(`${nom} téléchargé (2 feuilles : Consolidé, Par inventaire).`)
      }
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setExporting(null)
      setAvance(null)
    }
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const retour = guard.profile.is_company_admin
    ? { href: `/magasins/${storeId}`, texte: '← Retour au magasin' }
    : { href: magasin ? `/admin/entreprise/${magasin.entreprise_id}` : '/admin', texte: '← Retour à l’entreprise' }

  if (erreur) {
    return (
      <AppShell profile={guard.profile} companyName={company?.name}>
        <p className="muted">Ce rapport n&apos;est pas accessible.</p>
        <Link href="/magasins" className="btn btn-ghost" style={{ marginTop: 16 }}>← Tous les magasins</Link>
      </AppShell>
    )
  }

  const pages = Math.max(1, Math.ceil(totalFiltre / PAGE))
  const premier = totalFiltre === 0 ? 0 : page * PAGE + 1
  const dernier = Math.min(totalFiltre, (page + 1) * PAGE)
  const retenus = resume?.inventaires ?? 0

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <Link href={retour.href} className="link-btn" style={{ display: 'inline-block', marginBottom: 14 }}>
        {retour.texte}
      </Link>

      <div className="app-head">
        <div>
          <h1 className="page-title">Rapport du magasin</h1>
          <p className="page-sub">
            {magasin ? `${magasin.nom} · ${magasin.entreprise}` : 'Chargement…'}
          </p>
        </div>
        <div className="app-head-actions">
          <button
            type="button" className="btn btn-primary"
            disabled={retenus === 0 || exporting !== null}
            onClick={() => setAskFormat(true)}
          >
            {exporting ? (avance ?? 'Préparation…') : 'Télécharger'}
          </button>
        </div>
      </div>

      <section className="perimetre">
        <div className="perimetre-haut">
          <div className="perimetre-champ">
            <label htmlFor="du">Du</label>
            <input id="du" type="date" value={du} max={au} onChange={e => setDu(e.target.value)} />
          </div>
          <div className="perimetre-champ">
            <label htmlFor="au">Au</label>
            <input id="au" type="date" value={au} min={du} onChange={e => setAu(e.target.value)} />
          </div>
          <div className="perimetre-retenus">
            <span>
              <b>{nb(coches.length)}</b> inventaire{coches.length > 1 ? 's' : ''} retenu{coches.length > 1 ? 's' : ''}
              {' sur '}{nb(clos.length)} clôturé{clos.length > 1 ? 's' : ''}
            </span>
            <button
              type="button" className="btn btn-ghost btn-sm"
              aria-expanded={listeOuverte} aria-controls="liste-inventaires"
              onClick={() => setListeOuverte(o => !o)}
            >
              {listeOuverte ? 'Masquer' : 'Choisir'}
            </button>
          </div>
        </div>

        {listeOuverte && (
          <div className="liste-inv" id="liste-inventaires">
            {inventaires.length === 0 && !chargementListe && (
              <p className="muted small">Ce magasin n&apos;a encore aucun inventaire.</p>
            )}
            {clos.map(i => (
              <label className="inv-rang" key={i.session_id}>
                <input
                  type="checkbox"
                  checked={coches.includes(i.session_id)}
                  onChange={() => basculer(i.session_id)}
                />
                <span className="inv-nom">
                  {i.nom}
                  <span className="inv-date">
                    Clôturé le {i.cloture_le ? new Date(i.cloture_le).toLocaleDateString('fr-FR') : '—'}
                    {i.references_attendues > 0 && ` · ${nb(i.references_attendues)} réf. attendues`}
                  </span>
                </span>
                {!i.dans_periode && <span className="pill">Hors période</span>}
              </label>
            ))}
            {enCours.length > 0 && (
              <>
                {/* ⚠️ Ils se voient mais ne s'additionnent pas : le serveur ne
                    retient que les inventaires clôturés. Les cacher ferait
                    croire à un magasin qui ne compte plus. */}
                <p className="muted small inv-note">
                  {enCours.length === 1 ? 'Un inventaire est' : `${nb(enCours.length)} inventaires sont`} encore
                  en cours. Ils n&apos;entrent dans le total qu&apos;une fois clôturés.
                </p>
                {enCours.map(i => (
                  <div className="inv-rang inv-rang-inerte" key={i.session_id}>
                    <span className="inv-nom">
                      {i.nom}
                      <span className="inv-date">
                        Ouvert le {new Date(i.cree_le).toLocaleDateString('fr-FR')}
                      </span>
                    </span>
                    <span className="pill pill-attente">En cours</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {chargementResume && !resume ? (
        <div>
          <p className="chargement-note" role="status">
            Consolidation en cours… Sur un magasin qui porte plusieurs gros inventaires,
            comptez quelques secondes.
          </p>
          <SkeletonRows rows={5} />
        </div>
      ) : (
        <>
          {/* ⚠️ Sans résumé, on écrit « — », jamais « 0 » : un zéro se lit
              comme un résultat, et celui-là serait faux. */}
          <div className="dash-stats">
            <Stat label="Stock théorique" value={resume ? fmtQty(resume.theorique) : '—'} />
            <Stat label="Stock compté" value={resume ? fmtQty(resume.compte) : '—'} />
            <Stat
              label="Écart total (unités)"
              value={resume ? fmtSigned(resume.ecart_unites) : '—'}
              tone={!resume ? 'neutral' : resume.ecart_unites < 0 ? 'neg' : 'pos'}
            />
            <Stat
              label="Écart total (valeur achat)"
              value={resume ? `${money(resume.ecart_valeur)} €` : '—'}
              tone={!resume ? 'neutral' : resume.ecart_valeur < 0 ? 'neg' : 'pos'}
            />
          </div>

          {!resume && (
            <div className="banner banner-warn">
              Les totaux n’ont pas pu être calculés — le serveur a mis trop de temps à répondre.
              Rien n’est perdu&nbsp;: réduisez le périmètre, ou réessayez.
            </div>
          )}

          {resume && resume.non_arbitres > 0 && (
            <div className="banner banner-warn">
              {nb(resume.non_arbitres)} référence{resume.non_arbitres > 1 ? 's présentent' : ' présente'} encore
              un écart non arbitré entre le comptage et l’audit. Sans arbitrage, c’est{' '}
              <strong>la quantité de l’auditeur</strong> qui part dans le rapport.
            </div>
          )}

          {resume && resume.doublons > 0 && (
            <div className="banner banner-warn bandeau-doublons">
              <span>
                <b>{nb(resume.doublons)} référence{resume.doublons > 1 ? 's' : ''}</b>{' '}
                {resume.doublons > 1 ? 'apparaissent' : 'apparaît'} dans plusieurs inventaires.
                Leurs quantités sont <b>additionnées</b>.
              </span>
              <button
                type="button" className="btn btn-ghost btn-sm"
                aria-pressed={multi}
                onClick={() => setMulti(m => !m)}
              >
                {multi ? 'Voir toutes les références' : 'Ne voir que celles-ci'}
              </button>
            </div>
          )}

          <div className="toolbar">
            <div className="toolbar-grow">
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher un article, un SKU, un EAN…"
                aria-label="Rechercher dans le rapport du magasin"
              />
            </div>
          </div>

          {askFormat && (
            <Modal title="Format du téléchargement" onClose={() => setAskFormat(false)}>
              <div className="format-choice">
                <button type="button" className="format-option" onClick={() => { setAskFormat(false); void exporter('xlsx') }}>
                  <strong>Excel (.xlsx)</strong>
                  <span className="muted small">
                    Deux feuilles : « Consolidé » (une ligne par référence, tous inventaires
                    additionnés) et « Par inventaire » (la même chose, ligne par ligne, avec
                    l&apos;inventaire d&apos;origine).
                  </span>
                </button>
                <button type="button" className="format-option" onClick={() => { setAskFormat(false); void exporter('csv') }}>
                  <strong>CSV (2 fichiers)</strong>
                  <span className="muted small">
                    Le CSV ne connaît pas les feuilles : vous recevez les deux mêmes tableaux
                    en deux fichiers, avec exactement les mêmes colonnes qu&apos;Excel.
                  </span>
                </button>
              </div>
            </Modal>
          )}

          {retenus === 0 ? (
            <EmptyState
              title="Aucun inventaire retenu"
              hint="Élargissez la période, ou cochez un inventaire clôturé dans la liste ci-dessus. Un inventaire encore en cours n’entre pas dans le total."
            />
          ) : totalFiltre === 0 && !chargeantPage ? (
            <EmptyState
              title="Aucune référence ne correspond"
              hint={recherche ? `Rien ne correspond à « ${recherche} ».` : 'Le périmètre choisi ne porte aucune référence.'}
            />
          ) : (
            <>
              <div ref={hautDuTableau} />
              <Pagination page={page} pages={pages} chargement={chargeantPage} onPage={setPage}>
                <span className="muted small">
                  {nb(premier)}–{nb(dernier)} sur {nb(totalFiltre)}{' '}
                  {multi ? 'références vues dans plusieurs inventaires' : 'références'}
                  {chargeantPage && ' · chargement…'}
                </span>
              </Pagination>

              <div className="dash-table-wrap" style={{ opacity: chargeantPage ? 0.55 : 1 }}>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <Th label="Article" onClick={() => trier('sku')} active={sort.key === 'sku'} dir={sort.dir} />
                      <Th label="Théorique" num onClick={() => trier('theoretical_qty')} active={sort.key === 'theoretical_qty'} dir={sort.dir} />
                      <Th label="Compté" num onClick={() => trier('counted_qty')} active={sort.key === 'counted_qty'} dir={sort.dir} />
                      <Th label="Écart" num onClick={() => trier('variance_units')} active={sort.key === 'variance_units'} dir={sort.dir} />
                      <Th label="Valeur" num onClick={() => trier('variance_value')} active={sort.key === 'variance_value'} dir={sort.dir} />
                      <Th label="Inventaires" onClick={() => trier('inventaires')} active={sort.key === 'inventaires'} dir={sort.dir} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const u = Number(r.variance_units)
                      const v = Number(r.variance_value)
                      return (
                        <tr key={r.sku}>
                          <td>
                            <div className="dash-art-label">{r.label || r.sku}</div>
                            <div className="muted small">{r.brand}{r.ean ? ` · ${r.ean}` : ''}</div>
                          </td>
                          <td className="num">{fmtQty(Number(r.theoretical_qty))}</td>
                          <td className="num">{fmtQty(Number(r.counted_qty))}</td>
                          <td className={`num ${u === 0 ? '' : u < 0 ? 'neg' : 'pos'}`}>{fmtSigned(u)}</td>
                          <td className={`num ${v < 0 ? 'neg' : ''}`}>{money(v)} €</td>
                          <td>
                            {r.inventaires > 1
                              ? <span className="pill pill-attente">{nb(r.inventaires)} inventaires</span>
                              : <span className="muted small">1</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} pages={pages} chargement={chargeantPage} onPage={setPage}>
                <span className="muted small">
                  {nb(premier)}–{nb(dernier)} sur {nb(totalFiltre)}.{' '}
                  Quantité retenue : arbitrage, sinon auditeur, sinon compteur.
                </span>
              </Pagination>
            </>
          )}
        </>
      )}
    </AppShell>
  )
}

function Th({ label, num, onClick, active, dir }: {
  label: string; num?: boolean; onClick: () => void; active: boolean; dir: 1 | -1
}) {
  return (
    <th
      className={`sortable${num ? ' num' : ''}`}
      onClick={onClick}
      aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      {label}{active ? (dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  )
}
