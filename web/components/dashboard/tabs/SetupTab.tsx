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
import { fmtQty, nb, plural } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { FileDrop } from '@/components/ui/FileDrop'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Stat } from '@/components/ui/Stat'
import { t, tn } from '@/lib/i18n'

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
      toast.success(t('Inventaire démarré : l’équipe peut compter.'))
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
        title: kind === 'catalogue' ? t('Remplacer le référentiel articles ?') : t('Remplacer le stock théorique ?'),
        message: tn('%{count} ligne est déjà chargée pour cet inventaire. Elle sera remplacée par le contenu de « %{fichier} ».', '%{count} lignes sont déjà chargées pour cet inventaire. Elles seront remplacées par le contenu de « %{fichier} ».', existing, { fichier: file.name }),
        details: [t('Les comptages déjà enregistrés ne sont pas touchés.')],
        confirmLabel: t('Remplacer'),
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
        message: tn('%{count} ligne importée.', '%{count} lignes importées.', result.uploaded),
      }))
      toast.success(`${file.name} : ${tn('%{count} ligne importée.', '%{count} lignes importées.', result.uploaded)}`)
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
    if (groups.length === 0) return t('Aucun emplacement affecté — les balises ne sont rattachées à rien')
    const balises = groups.reduce((n, g) => n + g.total, 0)
    return `${plural(groups.length, 'emplacement')} · ${plural(balises, 'balise affectée', 'balises affectées')}`
  }, [zones])

  const resumeFichiers = importState.articles === 0
    ? t('Aucun fichier chargé — le référentiel articles est indispensable')
    : `${plural(importState.articles, 'référence')} · ${
        importState.theoreticalQty > 0
          ? t('%{n} pièces attendues', { n: fmtQty(importState.theoreticalQty) })
          : t('aucun stock théorique')
      }`

  const etat = (fait: boolean) =>
    fait ? { libelle: t('Prêt'), ton: 'pret' as const } : { libelle: t('À faire'), ton: 'faire' as const }

  return (
    <div>
      {readOnly && (
        <div className="banner banner-warn">
          {t('Cet inventaire est clôturé : les fichiers ne peuvent plus être remplacés ni les balises réaffectées. Rouvrez-le depuis l’onglet Équipe si nécessaire.')}
        </div>
      )}

      {usesZones && (
        <Volet titre={t('Zone de comptage')} resume={resumeZones} etat={etat(zones.length > 0)}>
          <ZonesSetup
            sessionId={sessionId}
            zones={zones}
            readOnly={readOnly}
            onChanged={onZonesChanged}
          />
        </Volet>
      )}

      <Volet
        titre={t('Données d’inventaire')}
        resume={resumeFichiers}
        etat={etat(importState.articles > 0)}
      >
      <div className="dash-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <Stat
          label={t('Référentiel articles')}
          value={nb(importState.articles)}
          tone={importState.articles > 0 ? 'pos' : 'warn'}
          sub={importState.articles > 0 ? t('références chargées') : t('aucun fichier chargé')}
        />
        <Stat
          label={t('Stock théorique attendu')}
          value={fmtQty(importState.theoreticalQty)}
          tone={importState.theoreticalQty > 0 ? 'pos' : 'neutral'}
          sub={
            importState.theoreticalQty > 0
              ? t('pièces attendues sur %{n} SKU', { n: importState.stock })
              : t('aucun stock théorique importé — fichier optionnel, sans lui aucun écart')
          }
        />
      </div>

      <details className="collapsible" style={{ marginBottom: 14 }}>
        <summary>{t('Conseils de format (CSV / Excel)')}</summary>
        <div className="collapsible-body">
          <p className="muted small" style={{ marginBottom: 10 }}>
            {t('CSV ou Excel (.xlsx, .xls) — première feuille du classeur. Les en-têtes sont reconnus quelle que soit la casse, les accents ou la ponctuation — « Prix d’achat », « PRIX D ACHAT » et « prixdachat » sont équivalents.')}
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            {t('Formatez vos colonnes de codes (SKU, EAN) en ')}<strong>{t('Texte')}</strong>{t(' dans le tableur : un tableur transforme ')}<span className="num">0123</span>{t(' en ')}<span className="num">123</span>{t(' et l’information est perdue avant même l’import. Le scan reste tolérant aux zéros de tête, mais l’export vous rendra le code tel qu’il a été chargé.')}
          </p>
        </div>
      </details>

      <ImportStep
        title={t('Référentiel articles')}
        required
        description={
          <ul className="col-list">
            <li><strong>SKU</strong> — {t('ou Code article, Référence, Réf')}</li>
            <li><strong>EAN</strong> — {t('ou Code-barres, GTIN, Gencod')}</li>
            <li><strong>{t('Marque')}</strong> — {t('ou Fournisseur')}</li>
            <li><strong>{t('Libellé')}</strong> — {t('ou Désignation, Description, Nom')}</li>
            <li><strong>{t('Prix d’achat')}</strong> <em>{t('(optionnel)')}</em> — {t('ou PA, Coût, Cost, COGS. Sans cette colonne, l’écart en valeur sera de 0.')}</li>
          </ul>
        }
        state={catalog}
        disabled={readOnly || busy}
        onFile={f => run(f, importState.articles, 'catalogue', setCatalog, importCatalogFile)}
      />

      <ImportStep
        title={t('Stock théorique')}
        description={
          <>
            <p className="muted small">
              {t('Fichier optionnel — uniquement si vous voulez comparer le comptage au stock attendu. Le rapprochement se fait par SKU ; les EAN viennent du fichier précédent. Un même SKU présent sur plusieurs emplacements voit ses quantités additionnées.')}
            </p>
            <ul className="col-list">
              <li><strong>SKU</strong> — {t('ou Code article, Référence, Réf')}</li>
              <li><strong>{t('Quantité théorique')}</strong> — {t('ou Quantité, Qté, Stock, Qty')}</li>
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
          <div className="demarrage-titre">{t('L’inventaire est en cours')}</div>
          <p className="demarrage-sous">
            {t('L’équipe peut compter depuis l’application. La préparation reste modifiable ici — un fichier se remplace, une plage de balises se réaffecte.')}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onOpenSuivi}>
          {t('Suivre l’avancement')}
        </button>
      </section>
    )
  }

  return (
    <section className={`demarrage${pret ? ' demarrage-pret' : ''}`}>
      <div className="demarrage-txt">
        <div className="demarrage-titre">
          {pret ? t('Tout est prêt : commencez l’inventaire') : t('Il reste une chose à faire')}
        </div>
        <p className="demarrage-sous">
          {pret
            ? t('Le démarrage signale à l’équipe que la préparation est terminée : les compteurs peuvent scanner depuis l’application, et vous suivez l’avancement dans l’onglet Suivi.')
            : t('Chargez le référentiel articles dans « Données d’inventaire », juste au-dessus : sans lui, les scans n’ont aucune référence à laquelle se rattacher.')}
        </p>
      </div>
      <button type="button" className="btn btn-primary" disabled={!pret || starting} onClick={onStart}>
        {starting ? t('Démarrage…') : t('Commencer l’inventaire')}
      </button>
    </section>
  )
}

/**
 * L'affectation des plages de balises aux emplacements (mode balises
 * seulement) — et, depuis le 7 septembre 2026, **une question avant elle**.
 *
 * Le volet s'ouvrait sur « Créer des balises » : un paragraphe d'explication,
 * trois étapes numérotées, un choix de numérotation, deux champs, un bouton —
 * et l'affectation seulement en dessous. Quelqu'un dont les balises sont déjà
 * collées traversait tout cela pour rien. Constat de Julien : « ne pas tout
 * afficher en même temps, plus clair pour l'user ».
 *
 * ⚠️ LA QUESTION NE SE POSE QUE TANT QUE RIEN N'EST AFFECTÉ. Dès qu'un
 * emplacement existe, la réponse est connue et le formulaire s'ouvre
 * directement — c'est la leçon du bandeau de démarrage (28 août) : une aide
 * qui se rejoue des semaines plus tard, à quelqu'un qui connaît le produit,
 * cesse d'en être une. « Créer d'autres balises » reste joignable par un lien.
 *
 * ⚠️ ET RIEN N'EST STOCKÉ : l'inventaire répond tout seul. Quelqu'un qui
 * répond « Non », télécharge sa planche et revient le lendemain retrouve la
 * question — et c'est juste, il peut maintenant répondre « Oui ».
 */
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
  /**
   * ⚠️ Une seule balise plutôt qu'une plage. Sans cette bascule, rattacher la
   * balise 42 à un emplacement demande d'écrire 42 deux fois — un même numéro
   * recopié est une faute qu'on invite à commettre, le second champ ne
   * contrôlant rien. Côté serveur rien ne change : c'est une plage de un.
   */
  const [unique, setUnique] = useState(false)

  const groups = useMemo(() => groupByName(zones), [zones])
  const dejaAffecte = groups.length > 0

  // Ce qu'on répond à la question. `null` = pas encore répondu, et c'est alors
  // l'état de l'inventaire qui décide de ce qu'on montre.
  const [choix, setChoix] = useState<'creer' | 'affecter' | null>(null)
  const etape = choix ?? (dejaAffecte ? 'affecter' : 'question')

  async function onDefine(e: React.FormEvent) {
    e.preventDefault()
    // Une balise seule est une plage de un : `define_zone` ne connaît que les
    // plages, et n'a pas à connaître autre chose.
    const fin = unique ? start : end
    const error = validateRange(name, start, fin, unique)
    setFormError(error)
    if (error) return

    setBusy(true)
    try {
      const r = await defineZoneRange(sessionId, name.trim(), Number(start), Number(fin))
      if (!r.success) { toast.error(r.error ?? t('Affectation impossible.')); return }
      toast.success(t('%{n} à « %{nom} ».', { n: plural(r.created ?? 0, 'balise affectée', 'balises affectées'), nom: name.trim() }))
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
      title: t("Retirer l'emplacement « %{nom} » ?", { nom: zoneName }),
      message: tn('Sa balise ne sera plus rattachée à un emplacement.', 'Ses %{count} balises ne seront plus rattachées à un emplacement.', count),
      details: [t('Les comptages déjà enregistrés sur ces balises sont conservés.')],
      confirmLabel: t('Retirer'),
      tone: 'danger',
    })
    if (!ok) return

    try {
      const r = await deleteZone(sessionId, zoneName)
      if (!r.success) { toast.error(r.error ?? t('Suppression impossible.')); return }
      toast.success(t('Emplacement « %{nom} » retiré.', { nom: zoneName }))
      await onChanged()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  return (
    <div>
      {!readOnly && etape === 'question' && (
        <section className="panel zone-question">
          <h3>{t('Avez-vous vos balises ?')}</h3>
          <p className="muted small" style={{ marginTop: 6 }}>
            {t('Les balises sont les étiquettes QR numérotées, collées dans le magasin, que les compteurs scannent pour dire où ils sont.')}
          </p>
          <div className="zone-choix">
            <button type="button" onClick={() => setChoix('affecter')}>
              <span className="zone-choix-t">{t('Oui, elles sont collées')}</span>
              <span className="zone-choix-s">{t('Indiquer quelles balises sont à quel endroit')}</span>
            </button>
            <button type="button" onClick={() => setChoix('creer')}>
              <span className="zone-choix-t">{t('Non, pas encore')}</span>
              <span className="zone-choix-s">{t('Créer et imprimer une planche de balises')}</span>
            </button>
          </div>
        </section>
      )}

      {!readOnly && etape === 'creer' && (
        <BaliseSheetPanel
          context="setup"
          onRetour={dejaAffecte ? undefined : () => setChoix(null)}
          onAffecter={() => setChoix('affecter')}
        />
      )}

      {!readOnly && etape === 'affecter' && (
        <form className="panel" onSubmit={onDefine}>
          {!dejaAffecte && (
            <div className="zone-fil">
              <button type="button" className="link-btn" onClick={() => setChoix(null)}>
                {t('← Revenir à la question')}
              </button>
            </div>
          )}
          {/* ⚠️ Le texte suit le CHAMP qu'on a sous les yeux. Avec la bascule
              active il n'y a plus qu'un champ : parler de plage et donner un
              exemple « 1 à 10 » fait chercher un second champ qui n'existe
              pas. Même règle que le message de saisie, dont `validateRange`
              change déjà le libellé selon le mode. */}
          <h3>{unique ? t('Affecter une balise à un emplacement') : t('Affecter une plage de balises à un emplacement')}</h3>
          <p className="muted small" style={{ marginTop: 6, marginBottom: 0 }}>
            {unique ? (
              <>
                {t('Indiquez à quel endroit se trouve cette balise — imprimée et collée. Exemple : la balise 42 est en « Réserve ». Réaffecter une balise déjà nommée la renomme.')}
              </>
            ) : (
              <>
                {t('Indiquez quelles balises — imprimées et collées — sont à quel endroit. Exemple : « Réserve » = balises 1 à 10, « Surface de vente » = 11 à 30. Réaffecter une plage déjà nommée la renomme. %{max} balises au maximum par affectation.', { max: MAX_RANGE })}
              </>
            )}
          </p>

          <button
            type="button" role="switch" aria-checked={unique}
            className={`bascule${unique ? ' on' : ''}`}
            onClick={() => { setUnique(u => !u); setFormError(null) }}
          >
            <span className="bascule-piste" aria-hidden="true" />
            <span>
              <span className="bascule-t">{t('Une seule balise')}</span>
              <span className="bascule-s">{t('Pour rattacher une balise isolée à un emplacement')}</span>
            </span>
          </button>

          <div className={unique ? 'zone-form zone-form-unique' : 'zone-form'}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-name">{t('Emplacement')}</label>
              <input
                id="zone-name" value={name} onChange={e => setName(e.target.value)}
                placeholder={t('Réserve')} autoComplete="off"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="zone-start">{unique ? t('Balise') : t('Balise début')}</label>
              <input
                id="zone-start" value={start} onChange={e => setStart(e.target.value)}
                inputMode="numeric" placeholder={unique ? '42' : '1'}
              />
            </div>
            {!unique && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="zone-end">{t('Balise fin')}</label>
                <input id="zone-end" value={end} onChange={e => setEnd(e.target.value)} inputMode="numeric" placeholder="10" />
              </div>
            )}
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? t('Affectation…') : t('Affecter')}
            </button>
          </div>

          {formError && <div className="error" style={{ marginTop: 14, marginBottom: 0 }} role="alert">{formError}</div>}

          <div className="zone-autres">
            <button type="button" className="link-btn" onClick={() => setChoix('creer')}>
              {t('Créer d’autres balises')}
            </button>
          </div>
        </form>
      )}

      {/* ⚠️ La question ne s'accompagne d'AUCUN état vide : elle est déjà ce
          qu'on a à répondre, et « indiquez une première plage ci-dessus »
          désignerait deux boutons qui ne demandent aucune plage. */}
      {groups.length === 0 ? (
        (readOnly || etape === 'affecter') && (
          <EmptyState
            title={t('Aucun emplacement affecté')}
            hint={readOnly
              ? t("Aucune balise n'a été rattachée à un emplacement sur cet inventaire.")
              : unique
                ? t('Indiquez une première balise ci-dessus pour pouvoir suivre l’avancement zone par zone.')
                : t('Indiquez une première plage de balises ci-dessus pour pouvoir suivre l’avancement zone par zone.')}
          />
        )
      ) : (
        <div className="zone-list" style={{ marginTop: readOnly ? 0 : 14 }}>
          {groups.map(g => (
            <div className="zone-card" key={g.name}>
              <div className="zone-card-head">
                <div>
                  <div className="zone-name">{g.name}</div>
                  <div className="zone-range num">{t('Balises')} {codeRange(g.codes)} · {t('%{n} au total', { n: g.total })}</div>
                </div>
                {!readOnly && !g.unnamed && (
                  <button type="button" className="link-btn danger-link" onClick={() => onDelete(g.name, g.total)}>
                    {t('Retirer')}
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
        <span className="role-tag" style={{ marginLeft: 8 }}>{required ? t('requis') : t('optionnel')}</span>
      </h3>
      <div style={{ marginTop: 8, marginBottom: 16 }}>{description}</div>

      <FileDrop
        accept={ACCEPTED_EXTENSIONS}
        disabled={disabled}
        label={state.fileName ? t('Remplacer « %{fichier} »', { fichier: state.fileName }) : t('Déposez un fichier ou cliquez pour le choisir')}
        hint={t('CSV, XLSX ou XLS — première feuille du classeur')}
        onFile={onFile}
      />

      {state.phase === 'parsing' && (
        <p className="muted small" style={{ marginTop: 12 }}>{t('Lecture du fichier…')}</p>
      )}

      {state.phase === 'uploading' && (
        <>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small">
            <span className="num">{pct}%</span> — {state.progress.uploaded} / {state.progress.total} {t('lignes')}
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
          <strong>{t('Lignes non importées')}</strong>
          <ul>{state.errors.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {/* Ce que l'import a regroupé. ⚠️ Boîte NEUTRE, jamais `import-errors` :
          un référentiel liste couramment la même référence une fois par
          emplacement, et rien n'est perdu — crier dessus fait douter d'un
          import réussi. */}
      {state.notes.length > 0 && (
        <div className="import-notes">
          <strong>{t('À savoir')}</strong>
          <ul>{state.notes.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
    </section>
  )
}
