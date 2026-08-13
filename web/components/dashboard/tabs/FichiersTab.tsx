'use client'

import { useState } from 'react'
import {
  ACCEPTED_EXTENSIONS, importCatalogFile, importStockFile, type ImportProgress,
} from '@/lib/import'
import { startSession, type ImportState, type SessionStatus } from '@/lib/inventory'
import { fmtQty } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { FileDrop } from '@/components/ui/FileDrop'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Stat } from '@/components/ui/Stat'

type Phase = 'idle' | 'parsing' | 'uploading' | 'done' | 'error'

type StepState = {
  fileName: string | null
  phase: Phase
  progress: ImportProgress
  uploaded: number
  errors: string[]
  message: string | null
}

const EMPTY: StepState = {
  fileName: null, phase: 'idle', progress: { parsed: 0, uploaded: 0, total: 0 },
  uploaded: 0, errors: [], message: null,
}

export function FichiersTab({ sessionId, status, readOnly, importState, onChanged }: {
  sessionId: string
  status: SessionStatus
  readOnly: boolean
  importState: ImportState
  onChanged: () => Promise<void> | void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [catalog, setCatalog] = useState<StepState>(EMPTY)
  const [stock, setStock] = useState<StepState>(EMPTY)
  const [starting, setStarting] = useState(false)

  // Le démarrage n'a de sens qu'une fois le référentiel chargé, et une seule
  // fois : passé en « En cours », l'inventaire ne revient pas à « Ouverte ».
  const canStart = !readOnly && status === 'open' && importState.articles > 0

  async function start() {
    setStarting(true)
    try {
      await startSession(sessionId)
      toast.success('Inventaire démarré : l’équipe peut compter.')
      await onChanged()
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
    importer: (f: File, id: string, onProgress: (p: ImportProgress) => void) => Promise<{ uploaded: number; errors: string[] }>,
  ) {
    // Un import remplace intégralement ce qui est déjà chargé : mieux vaut le
    // dire avant, pas après.
    if (existing > 0) {
      const ok = await confirm({
        title: kind === 'catalogue' ? 'Remplacer le référentiel articles ?' : 'Remplacer le stock théorique ?',
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
        ...s, phase: 'done', uploaded: result.uploaded, errors: result.errors,
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

  return (
    <div>
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

      {canStart && (
        <div className="banner banner-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <span>
            Le référentiel est chargé. Démarrez l&apos;inventaire pour signaler à
            l&apos;équipe que la préparation est terminée.
          </span>
          <button type="button" className="btn btn-primary btn-sm" disabled={starting} onClick={start}>
            {starting ? 'Démarrage…' : 'Commencer l’inventaire'}
          </button>
        </div>
      )}

      <div className="banner banner-info">
        CSV ou Excel (.xlsx, .xls). Les en-têtes sont reconnus quelle que soit la casse, les accents
        ou la ponctuation — « Prix d’achat », « PRIX D ACHAT » et « prixdachat » sont équivalents.
      </div>
      <div className="banner banner-warn">
        Formatez vos colonnes de codes (SKU, EAN) en <strong>Texte</strong> dans le tableur : un tableur
        transforme <span className="num">0123</span> en <span className="num">123</span> et l’information
        est perdue avant même l’import. Le scan reste tolérant aux zéros de tête, mais l’export vous
        rendra le code tel qu’il a été chargé.
      </div>

      {readOnly && (
        <div className="banner banner-warn">
          Cet inventaire est clôturé : les fichiers ne peuvent plus être remplacés.
          Rouvrez-le depuis l’onglet Équipe si vous devez recharger un référentiel.
        </div>
      )}

      <ImportStep
        title="1. Référentiel articles"
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
        title="2. Stock théorique"
        description={
          <>
            <p className="muted small">
              Fichier optionnel — uniquement si vous voulez comparer le comptage au stock attendu.
              Le rapprochement se fait par SKU ; les EAN viennent du référentiel de l’étape 1.
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
        {required && <span className="role-tag" style={{ marginLeft: 8 }}>requis</span>}
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

      {state.errors.length > 0 && (
        <div className="import-errors">
          <strong>Lignes signalées</strong>
          <ul>{state.errors.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
    </section>
  )
}
