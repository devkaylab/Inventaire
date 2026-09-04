'use client'

import { useEffect, useMemo, useState } from 'react'
import { fmtQty, nb, plural } from '@/lib/format'
import type { ZoneDashboardRow } from '@/lib/zones'
import type { Totals } from '@/hooks/useSessionData'

/**
 * Le geste d'arrivée de la tuile (piste E de la maquette « Tuile Progression
 * en mouvement », mixée avec le reflet A porté par globals.css) : au montage,
 * les barres se remplissent et le grand nombre compte jusqu'à sa valeur en
 * 1,4 s, puis tout est immobile. Trois choses tiennent ce choix :
 * · la page ne monte la tuile qu'une fois `data.loading` passé — les valeurs
 *   sont donc déjà là au montage, l'animation ne compte jamais vers zéro ;
 * · elle ne se joue qu'au montage : un rafraîchissement du direct met à jour
 *   les valeurs sans recompter — un tableau de bord qui recompte toutes les
 *   minutes serait un métronome, pas un geste d'accueil ;
 * · `prefers-reduced-motion` saute l'animation (t = 1 d'emblée), comme le
 *   reste du site coupe déjà ses transitions de barres.
 *
 * ⚠️ **Le chiffre affiché ne doit JAMAIS dépendre de l'arrivée d'une image.**
 * La première version calait tout sur `requestAnimationFrame` : dans un onglet
 * en arrière-plan, aucune image n'est rendue, l'animation ne démarrait pas et
 * la tuile restait bloquée sur **0 %** — un chiffre faux, sur un tableau de
 * bord, pour une décoration. Relevé par Julien le 25 août 2026, reproduit au
 * navigateur. D'où le filet `setTimeout` : lui se déclenche même sans image
 * (bridé à la seconde en arrière-plan, mais il se déclenche), et pose la vraie
 * valeur. L'animation est un bonus ; la justesse ne se négocie pas.
 */
function useArrivee() {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(1)
      return
    }
    let raf = 0
    let filet: ReturnType<typeof setTimeout> | undefined
    let fini = false
    const terminer = () => {
      fini = true
      cancelAnimationFrame(raf)
      clearTimeout(filet)
      setT(1)
    }
    /* Le chronomètre part à la PREMIÈRE image rendue, pas au montage : sinon
       un onglet revenu au premier plan verrait l'arrivée déjà finie au lieu
       de la jouer sous ses yeux. */
    let debut = 0
    const pas = (now: number) => {
      if (fini) return
      if (!debut) debut = now
      const brut = Math.min(1, (now - debut) / 1400)
      if (brut >= 1) { terminer(); return }
      setT(1 - Math.pow(1 - brut, 3))
      raf = requestAnimationFrame(pas)
    }
    filet = setTimeout(terminer, 1800)
    raf = requestAnimationFrame(pas)
    return () => { fini = true; cancelAnimationFrame(raf); clearTimeout(filet) }
  }, [])
  return t
}

/* Pendant l'arrivée, la transition CSS des barres (.4s) doublerait l'easing
   du compteur et le remplissage traînerait derrière le chiffre. */
const sansTransition = (t: number) => (t < 1 ? ('none' as const) : undefined)

/**
 * Colonne de progression. Deux barres, pas une : le comptage et l'audit sont
 * deux cycles indépendants, et le superviseur pilote les deux. Le détail par
 * zone vit dans l'onglet Suivi — le rail n'en garde qu'un total, pour ne pas
 * répéter la même liste à deux endroits de l'écran.
 */
export function ProgressRail({
  usesZones, zones, totals, theoreticalQty, onOpenTab,
}: {
  usesZones: boolean
  zones: ZoneDashboardRow[]
  totals: Totals
  /** Somme des quantités attendues ; 0 quand aucun stock théorique n'est importé. */
  theoreticalQty: number
  /** Renvoie vers un onglet : l'avancement dans Suivi, la préparation dans Set up. */
  onOpenTab: (tab: 'suivi' | 'setup') => void
}) {
  const arrivee = useArrivee()
  const stats = useMemo(() => {
    const total = zones.length
    const counted = zones.filter(z => z.count_status === 'done').length
    const audited = zones.filter(z => z.audit_status === 'done').length
    const countOpen = zones.filter(z => z.count_status === 'open').length
    const auditOpen = zones.filter(z => z.audit_status === 'open').length
    return {
      total, counted, audited, countOpen, auditOpen,
      countPct: total > 0 ? Math.round((counted / total) * 100) : 0,
      auditPct: total > 0 ? Math.round((audited / total) * 100) : 0,
    }
  }, [zones])

  if (!usesZones) {
    // Mode classique : sans balise, le seul dénominateur qui parle au terrain
    // est le stock théorique attendu — un nombre de pièces, comparable à ce qui
    // est scanné. L'ancienne version rapportait le comptage au *nombre de
    // références* du référentiel, ce qui mélangeait deux unités : on pouvait
    // afficher « 80 % » avec la moitié des pièces manquantes.
    const pct = theoreticalQty > 0
      ? Math.min(100, Math.round((totals.counted / theoreticalQty) * 100))
      : 0
    return (
      <aside className="dash-progress panel">
        <div className="dash-section-label">Progression</div>
        <div className="dash-big num">{fmtQty(Math.round(totals.counted * arrivee))}</div>
        <div className="dash-progress-sub">
          {totals.counted > 1 ? 'pièces scannées' : 'pièce scannée'} en comptage
        </div>

        <div className="dash-bar-row">
          <div className="dash-bar-legend">
            <span>Audit</span>
            <strong className="num">{fmtQty(totals.audited)}</strong>
          </div>
          <div className="dash-progress-sub small">
            {plural(totals.auditedSkus, 'article audité', 'articles audités')}
          </div>
        </div>

        <div className="dash-bar-row">
          <div className="dash-bar-legend">
            <span>Stock théorique attendu</span>
            <strong className="num">{fmtQty(theoreticalQty)}</strong>
          </div>
          {theoreticalQty > 0 ? (
            <>
              <div className="dash-bar">
                <div
                  className="dash-bar-fill dash-bar-count"
                  style={{ width: `${pct * arrivee}%`, transition: sansTransition(arrivee) }}
                />
              </div>
              <div className="dash-progress-sub small">
                {fmtQty(totals.counted)} / {fmtQty(theoreticalQty)} pièces attendues — {pct}%
              </div>
            </>
          ) : (
            // Un 0 sans explication laisse croire à une panne. C'est presque
            // toujours un fichier optionnel qu'on n'a pas chargé.
            <div className="dash-progress-sub small">
              Aucun stock théorique importé : l&apos;attendu vaut 0 et aucun écart ne peut être
              calculé.{' '}
              <button type="button" className="link-btn" onClick={() => onOpenTab('setup')}>
                Importer le fichier
              </button>
            </div>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside className="dash-progress panel">
      <div className="dash-section-label">Progression</div>
      <div className="dash-big num">{Math.round(stats.countPct * arrivee)}<span className="dash-big-unit">%</span></div>
      <div className="dash-progress-sub">des balises comptées</div>

      <div className="dash-bar-row">
        <div className="dash-bar-legend">
          <span>Comptage</span>
          <strong className="num">{nb(stats.counted)}/{nb(stats.total)}</strong>
        </div>
        <div className="dash-bar">
          <div
            className="dash-bar-fill dash-bar-count"
            style={{ width: `${stats.countPct * arrivee}%`, transition: sansTransition(arrivee) }}
          />
        </div>
        {stats.countOpen > 0 && (
          <div className="dash-progress-sub small">{plural(stats.countOpen, 'balise en cours', 'balises en cours')}</div>
        )}
      </div>

      <div className="dash-bar-row">
        <div className="dash-bar-legend">
          <span>Audit</span>
          <strong className="num">{nb(stats.audited)}/{nb(stats.total)}</strong>
        </div>
        <div className="dash-bar">
          <div
            className="dash-bar-fill dash-bar-audit"
            style={{ width: `${stats.auditPct * arrivee}%`, transition: sansTransition(arrivee) }}
          />
        </div>
        {stats.auditOpen > 0 && (
          <div className="dash-progress-sub small">{plural(stats.auditOpen, 'balise en cours', 'balises en cours')}</div>
        )}
      </div>

      {stats.total === 0 ? (
        <div className="dash-missing">
          <p className="muted small">
            Aucune balise affectée. Renseignez les emplacements à inventorier pour suivre l&apos;avancement.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenTab('setup')}>
            Renseigner les zones
          </button>
        </div>
      ) : stats.total - stats.counted === 0 ? (
        <div className="dash-ok">Toutes les balises ont été comptées.</div>
      ) : (
        <div className="dash-missing">
          <div className="dash-missing-row">
            <span>Reste à compter</span>
            <span className="dash-missing-count num">
              {plural(stats.total - stats.counted, 'balise')}
            </span>
          </div>
          <button type="button" className="link-btn" onClick={() => onOpenTab('suivi')}>
            Voir l&apos;avancement par zone
          </button>
        </div>
      )}
    </aside>
  )
}
