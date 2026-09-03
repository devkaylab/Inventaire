'use client'

import { useMemo, useState } from 'react'
import {
  ACCEPTED_EXTENSIONS, importCatalogFile, importStockFile, type ImportProgress,
} from '@/lib/import'
import { startSession, type ImportState, type SessionStatus } from '@/lib/inventory'
import {
  codeRange, defineZoneRange, deleteZone, groupByName,
  type ZoneDashboardRow, validateRange, MAX_RANGE,
} from '@/lib/zones'
import { BaliseSheetPanel } from '@/components/BaliseSheetPanel'
import { Volet } from '@/components/ui/Volet'
import { fmtQty, plural } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { FileDrop } from '@/components/ui/FileDrop'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Stat } from '@/components/ui/Stat'

type Phase = 'idle' | 'parsing' | 'uploading' | 'done' | 'error'

type StepState = {
  fileName: string | null
  phase: Phase
  progress: ImportProgress
  uploaded: number
  errors: string[]
  notes: string[]
  message: string | null
}

const EMPTY: StepState = {
  fileName: null, phase: 'idle', progress: { parsed: 0, uploaded: 0, total: 0 },
  uploaded: 0, errors: [], notes: [], message: null,
}

/**
 * Tout ce qui prépare l'inventaire : les fichiers à importer et — en mode
 * balises — l'affectation des plages aux emplacements. Le suivi de
 * l'avancement, lui, reste dans l'onglet Suivi.
 *
 * Deux volets repliés, pas un empilement. La page déroulait tout en
 * permanence — planche de balises, affectation des plages, liste des
 * emplacements, deux imports et leurs colonnes attendues — et se lisait comme
 * un mur. « Zone de comptage » et « Données d'inventaire » la ramènent à deux
 * lignes ; chacune dit ce qu'elle contient, on ouvre ce qu'on vient faire.
 *
 * Décision de Julien, 21 août 2026 : **pas d'ouverture automatique**. Ni selon
 * l'avancement, ni pour la seule section restante en mode sans balise. Tout
 * part replié, sans exception — c'est ce qui rend la page prévisible.
 */
export function SetupTab({ sessionId, status, readOnly, importState, usesZones, zones, onChanged, onZonesChanged, onOpenSuivi }: {
  sessionId: string
  status: SessionStatus
  readOnly: boolean
  importState: ImportState
  usesZones: boolean
  zones: ZoneDashboardRow[]
  onChanged: () => Promise<void> | void
  onZonesChanged: () => Promise<void> | void
  /** Où l'on va une fois l'inventaire lancé : le suivi de l'avancement. */
  onOpenSuivi: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [catalog, setCatalog] = useState<StepState>(EMPTY)
  const [stock, setStock] = useState<StepState>(EMPTY)
  const [starting, setStarting] = useState(false)

  // Le démarrage n'a de sens qu'une fois le référentiel chargé : sans lui, un
  // scan n'a aucune référence à laquelle se rattacher.
  const pret = importState.articles > 0

  async function start() {
    setStarting(true)
    try {
      await startSession(sessionId)
      toast.success('Inventaire démarré : l’équipe peut compter.')
      await onChanged()
      // La préparation est finie : on n'a plus rien à faire ici. Le geste
      // suivant est de regarder l'équipe compter, donc l'écran y va — après
      // le rafraîchissement, pour que Suivi s'ouvre sur l'état à jour.
      onOpenSuivi()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setStarting(false)
    }
  }

  async function run(
    file: File,
    existing: number,
    kind: 'catalogue' | 'stock',
    setState: React.Dispatch<React.SetStateAction<StepState>>,
    importer: (f: File, id: string, onProgress: (p: ImportProgress) => void) => Promise<{ uploaded: number; errors: string[]; notes: string[] }>,
  ) {
    // Un import remplace intégralement ce qui est déjà chargé : mieux vaut le
    // dire avant, pas après.
    if (existing > 0) {
      const ok = await confirm({
        title: kind === 'catalogue' ? 'Remplacer le référentiel articles ?' : 'Remplacer le stock théorique ?',
        message: `${existing} ligne(s) sont déjà chargées pour cet inventaire. Elles seront remplacées par le contenu de « ${file.name} ».`,
        details: ['Les comptages déjà enregistrés ne sont pas touchés.'],
        confirmLabel: 'Remplacer',
      })
      if (!ok) return
    }

    setState({ ...EMPTY, fileName: file.name, phase: 'parsing' })
    try {
      const result = await importer(file, sessionId, (p) => {
        setState(s => ({ ...s, phase: p.uploaded > 0 ? 'uploading' : 'parsing', progress: p }))
      })
      setState(s => ({
        ...s, phase: 'done', uploaded: result.uploaded, errors: result.errors, notes: result.notes,
        message: `${result.uploaded} ligne(s) importée(s).`,
      }))
      toast.success(`${file.name} : ${result.uploaded} ligne(s) importée(s).`)
      await onChanged()
    } catch (err) {
      const message = friendlyError(err)
      setState(s => ({ ...s, phase: 'error', message }))
      toast.error(message)
    }
  }

  const busy = catalog.phase === 'parsing' || catalog.phase === 'uploading'
    || stock.phase === 'parsing' || stock.phase === 'uploading'

  // Ce que les en-têtes annoncent. C'est la moitié de l'idée : replier n'a
  // d'intérêt que si on n'a pas besoin d'ouvrir pour savoir où on en est.
  const resumeZones = useMemo(() => {
    const groups = groupByName(zones)
    if (groups.length === 0) return 'Aucun emplacement affecté — les balises ne sont rattachées à rien'
    const balises = groups.reduce((n, g) => n + g.total, 0)
    return `${plural(groups.length, 'emplacement')} · ${plural(balises, 'balise affectée', 'balises affectées')}`
  }, [zones])

  const resumeFichiers = importState.articles === 0
    ? 'Aucun fichier chargé — le référentiel articles est indispensable'
    : `${plural(importState.articles, 'référence')} · ${
        importState.theoreticalQty > 0
          ? `${fmtQty(importState.theoreticalQty)} pièces attendues`
          : 'aucun stock théorique'
      }`

  const etat = (fait: boolean) =>
    fait ? { libelle: 'Prêt', ton: 'pret' as const } : { libelle: 'À faire', ton: 'faire' as const }

  return (
    <div>
      {readOnly && (
        <div className="banner banner-warn">
          Cet inventaire est clôturé : les fichiers ne peuvent plus être remplacés ni les
          balises réaffectées. Rouvrez-le depuis l’onglet Équipe si nécessaire.
        </div>
      )}

      {usesZones && (
        <Volet titre="Zone de comptage" resume={resumeZones} etat={etat(zones.length > 0)}>
          <ZonesSetup
            sessionId={sessionId}
            zones={zones}
            readOnly={readOnly}
            onChanged={onZonesChanged}
          />
        </Volet>
      )}

      <Volet
        titre="Données d’inventaire"
        resume={resumeFichiers}
        etat={etat(importState.articles > 0)}
      >
      <div className="dash-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <Stat
          label="Référentiel articles"
          value={String(importState.articles)}
          tone={importState.articles > 0 ? 'pos' : 'warn'}
          sub={importState.articles > 0 ? 'références chargées' : 'aucun fichier chargé'}
        />
        <Stat
          label="Stock théorique attendu"
          value={fmtQty(importState.theoreticalQty)}
          tone={importState.theoreticalQty > 0 ? 'pos' : 'neutral'}
          sub={
            importState.theoreticalQty > 0
              ? `pièces attendues sur ${importState.stock} SKU`
              : 'aucun stock théorique importé — fichier optionnel, sans lui aucun écart'
          }
        />
      </div>

      <details className="collapsible" style={{ marginBottom: 14 }}>
        <summary>Conseils de format (CSV / Excel)</summary>
        <div className="collapsible-body">
          <p className="muted small" style={{ marginBottom: 10 }}>
            CSV ou Excel (.xlsx, .xls) — première feuille du classeur. Les en-têtes sont reconnus
            quelle que soit la casse, les accents ou la ponctuation — « Prix d’achat »,
            « PRIX D ACHAT » et « prixdachat » sont équivalents.
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Formatez vos colonnes de codes (SKU, EAN) en <strong>Texte</strong> dans le tableur :
            un tableur transforme <span className="num">0123</span> en <span className="num">123</span> et
            l’information est perdue avant même l’import. Le scan reste tolérant aux zéros de tête,
            mais l’export vous rendra le code tel qu’il a été chargé.
          </p>
        </div>
      </details>

      <ImportStep
        title="Référentiel articles"
        required
        description={
          <ul className="col-list">
            <li><strong>SKU</strong> — ou Code article, Référence, Réf</li>
            <li><strong>EAN</strong> — ou Code-barres, GTIN, Gencod</li>
            <li><strong>Marque</strong> — ou Fournisseur</li>
            <li><strong>Libellé</strong> — ou Désignation, Description, Nom</li>
            <li><strong>Prix d’achat</strong> <em>(optionnel)</em> — ou PA, Coût, Cost, COGS.
              Sans cette colonne, l’écart en valeur sera de 0.</li>
          </ul>
        }
        state={catalog}
        disabled={readOnly || busy}
        onFile={f => run(f, importState.articles, 'catalogue', setCatalog, importCatalogFile)}
      />

      <ImportStep
        title="Stock théorique"
        description={
          <>
            <p className="muted small">
              Fichier optionnel — uniquement si vous voulez comparer le comptage au stock attendu.
              Le rapprochement se fait par SKU ; les EAN viennent du fichier précédent.
              Un même SKU présent sur plusieurs emplacements voit ses quantités additionnées.
            </p>
            <ul className="col-list">
              <li><strong>SKU</strong> — ou Code article, Référence, Réf</li>
              <li><strong>Quantité théorique</strong> — ou Quantité, Qté, Stock, Qty</li>
            </ul>
          </>
        }
        state={stock}
        disabled={readOnly || busy}
        onFile={f => run(f, importState.stock, 'stock', setStock, importStockFile)}
      />
      </Volet>

      {!readOnly && (
        <Demarrage
          status={status}
          pret={pret}
          starting={starting}
          onStart={start}
          onOpenSuivi={onOpenSuivi}
        />
      )}
    </div>
  )
}

/**
 * Le démarrage, en fin de préparation.
 *
 * ⚠️ **Il vit sous les volets, jamais au-dessus.** Il y a été jusqu'au 25 août
 * 2026, en bandeau d'entrée de section — Julien, test réel sur « Fwee » :
 * « le mettre en haut est perturbant et on ne sait pas quoi faire après ».
 * On arrive sur Set up pour préparer ; une action posée avant le travail se
 * lit comme une consigne, et une fois pressée elle ne dit pas où aller. En
 * fin de page elle conclut ce qu'on vient de faire.
 *
 * Ce qui ne change pas de la règle du 21 août : **il n'entre pas dans un
 * volet**. Une action ne doit jamais se retrouver derrière une section
 * fermée — être en dessous n'est pas être caché.
 *
 * Il est là dans les trois états, parce que c'est le même endroit qu'on
 * regarde : ce qui manque encore, le démarrage, puis la suite (« l'équipe
 * peut compter, allez au suivi »). C'est la seconde moitié du constat — un
 * bouton qui disparaît une fois pressé laisse sans réponse la question
 * « et maintenant ? ».
 *
 * **Le démarrage emmène sur Suivi** (Julien, 25 août 2026) : la préparation
 * est finie, on n'a plus rien à faire ici. Le troisième état n'est donc pas
 * ce qu'on voit juste après avoir cliqué — il est là pour qui revient
 * préparer un inventaire déjà lancé.
 */
function Demarrage({ status, pret, starting, onStart, onOpenSuivi }: {
  status: SessionStatus
  pret: boolean
  starting: boolean
  onStart: () => void
  onOpenSuivi: () => void
}) {
  // Passé en « En cours », l'inventaire ne revient pas à « Ouverte » : la
  // préparation reste modifiable, le démarrage ne se rejoue pas.
  if (status !== 'open') {
    return (
      <section className="demarrage">
        <div className="demarrage-txt">
          <div className="demarrage-titre">L’inventaire est en cours</div>
          <p className="demarrage-sous">
            L’équipe peut compter depuis l’application. La préparation reste modifiable
            ici — un fichier se remplace, une plage de balises se réaffecte.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onOpenSuivi}>
          Suivre l’avancement
        </button>
      </section>
    )
  }

  return (
    <section className={`demarrage${pret ? ' demarrage-pret' : ''}`}>
      <div className="demarrage-txt">
        <div className="demarrage-titre">
          {pret ? 'Tout est prêt : commencez l’inventaire' : 'Il reste une chose à faire'}
        </div>
        <p className="demarrage-sous">
          {pret
            ? 'Le démarrage signale à l’équipe que la préparation est terminée : les compteurs peuvent scanner depuis l’application, et vous suivez l’avancement dans l’onglet Suivi.'
            : 'Chargez le référentiel articles dans « Données d’inventaire », juste au-dessus : sans lui, les scans n’ont aucune référence à laquelle se rattacher.'}
        </p>
      </div>
      <button type="button" className="btn btn-primary" disabled={!pret || starting} onClick={onStart}>
        {starting ? 'Démarrage…' : 'Commencer l’inventaire'}
      </button>
    </section>
  )
}

/** Affectation des plages de balises aux emplacements (mode balises seulement). */
function ZonesSetup({ sessionId, zones, readOnly, onChanged }: {
  sessionId: string
  zones: ZoneDashboardRow[]
  readOnly: boolean
  onChanged: () => Promise<void> | void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => groupByName(zones), [zones])

  async function onDefine(e: React.FormEvent) {
    e.preventDefault()
    const error = validateRange(name, start, end)
    setFormError(error)
    if (error) return

    setBusy(true)
    try {
      const r = await defineZoneRange(sessionId, name.trim(), Number(start), Number(end))
      if (!r.success) { toast.error(r.error ?? "Affectation impossible."); return }
      toast.success(`${plural(r.created ?? 0, 'balise affectée', 'balises affectées')} à « ${name.trim()} ».`)
      setName(''); setStart(''); setEnd('')
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(zoneName: string, count: number) {
    const ok = await confirm({
      title: `Retirer l'emplacement « ${zoneName} » ?`,
      message: `Ses ${count} balises ne seront plus rattachées à un emplacement.`,
      details: ['Les comptages déjà enregistrés sur ces balises sont conservés.'],
      confirmLabel: 'Retirer',
      tone: 'danger',
    })
    if (!ok) return

    try {
      const r = await deleteZone(sessionId, zoneName)
      if (!r.success) { toast.error(r.error ?? 'Suppression impossible.'); return }
      toast.success(`Emplacement « ${zoneName} » retiré.`)
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <div>
      {!readOnly && <BaliseSheetPanel context="setup" />}

      {!readOnly && (
        <form className="panel" onSubmit={onDefine} style={{ marginTop: 16 }}>
          <h3>Affecter une plage de balises à un emplacement</h3>
          <p className="muted small" style={{ marginTop: 6, marginBottom: 16 }}>
            Indiquez quelles balises — imprimées et collées — sont à quel endroit.
            Exemple : « Réserve » = balises 1 à 10, « Surface de vente » = 11 à 30.
            Réaffecter une plage déjà nommée la renomme. {MAX_RANGE} balises au maximum par affectation.
          </p>

          <div className="zone-form">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-name">Emplacement</label>
              <input
                id="zone-name" value={name} onChange={e => setName(e.target.value)}
                placeholder="Réserve" autoComplete="off"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-start">Balise début</label>
              <input id="zone-start" value={start} onChange={e => setStart(e.target.value)} inputMode="numeric" placeholder="1" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-end">Balise fin</label>
              <input id="zone-end" value={end} onChange={e => setEnd(e.target.value)} inputMode="numeric" placeholder="10" />
            </div>
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? 'Affectation…' : 'Affecter'}
            </button>
          </div>

          {formError && <div className="error" style={{ marginTop: 14, marginBottom: 0 }} role="alert">{formError}</div>}
        </form>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="Aucun emplacement affecté"
          hint={readOnly
            ? "Aucune balise n'a été rattachée à un emplacement sur cet inventaire."
            : 'Indiquez une première plage de balises ci-dessus pour pouvoir suivre l’avancement zone par zone.'}
        />
      ) : (
        <div className="zone-list" style={{ marginTop: readOnly ? 0 : 14 }}>
          {groups.map(g => (
            <div className="zone-card" key={g.name}>
              <div className="zone-card-head">
                <div>
                  <div className="zone-name">{g.name}</div>
                  <div className="zone-range num">Balises {codeRange(g.codes)} · {g.total} au total</div>
                </div>
                {!readOnly && !g.unnamed && (
                  <button type="button" className="link-btn danger-link" onClick={() => onDelete(g.name, g.total)}>
                    Retirer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImportStep({ title, description, state, disabled, onFile, required }: {
  title: string
  description: React.ReactNode
  state: StepState
  disabled: boolean
  onFile: (file: File) => void
  required?: boolean
}) {
  const pct = state.progress.total > 0
    ? Math.round((state.progress.uploaded / state.progress.total) * 100)
    : 0

  return (
    <section className="panel import-step">
      <h3>
        {title}
        <span className="role-tag" style={{ marginLeft: 8 }}>{required ? 'requis' : 'optionnel'}</span>
      </h3>
      <div style={{ marginTop: 8, marginBottom: 16 }}>{description}</div>

      <FileDrop
        accept={ACCEPTED_EXTENSIONS}
        disabled={disabled}
        label={state.fileName ? `Remplacer « ${state.fileName} »` : 'Déposez un fichier ou cliquez pour le choisir'}
        hint="CSV, XLSX ou XLS — première feuille du classeur"
        onFile={onFile}
      />

      {state.phase === 'parsing' && (
        <p className="muted small" style={{ marginTop: 12 }}>Lecture du fichier…</p>
      )}

      {state.phase === 'uploading' && (
        <>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small">
            <span className="num">{pct}%</span> — {state.progress.uploaded} / {state.progress.total} lignes
          </p>
        </>
      )}

      {state.phase === 'done' && (
        <div className="banner banner-ok" style={{ marginTop: 12, marginBottom: 0 }}>{state.message}</div>
      )}

      {state.phase === 'error' && (
        <div className="import-errors">{state.message}</div>
      )}

      {/* Ce qui n'a PAS été importé : le seul cas qui appelle un geste. */}
      {state.errors.length > 0 && (
        <div className="import-errors">
          <strong>Lignes non importées</strong>
          <ul>{state.errors.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {/* Ce que l'import a regroupé. ⚠️ Boîte NEUTRE, jamais `import-errors` :
          un référentiel liste couramment la même référence une fois par
          emplacement, et rien n'est perdu — crier dessus fait douter d'un
          import réussi. */}
      {state.notes.length > 0 && (
        <div className="import-notes">
          <strong>À savoir</strong>
          <ul>{state.notes.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
    </section>
  )
}
