'use client'

// Les pièces communes des tableaux de bord (30 août 2026).
//
// Trois écrans partagent la même langue visuelle — /dashboard (superviseur),
// /entreprise (administrateur d'entreprise), /admin (console Quantinvo) : les
// tuiles d'indicateurs, le diagramme de la semaine, l'anneau de répartition.
// Une seule définition ; deux écrans qui montrent la même chose doivent la
// montrer de la même façon.
//
// L'anneau replie tout au-delà de trois parts nommées dans « Autres » : la
// palette est validée pour trois teintes voisines (règle dataviz, validateur
// du 30 août 2026), et son centre est dessiné DANS le SVG — il scale avec
// l'anneau, sa taille suit la longueur du montant, il ne peut pas déborder.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { nb } from '@/lib/format'

export type JourTb = { jour: string; pieces: number; valeur: number }

/* Les couleurs des séries — validées pour les daltonismes sur les deux
   surfaces. L'or et le cyan du thème sombre sont des pas plus foncés que les
   jetons de marque : les jetons clairs seraient illisibles sur --surface. */
const SERIES_SOMBRE = ['#6366f1', '#bd7f09', '#1590c1']
const SERIES_CLAIR = ['#4f46e5', '#d97706', '#0aa5d8']

/** Les trois couleurs de série du thème courant, suivies en direct. */
export function useSeries(): string[] {
  const [sombre, setSombre] = useState(true)
  useEffect(() => {
    const racine = document.documentElement
    const lire = () => setSombre(racine.getAttribute('data-theme') !== 'light')
    lire()
    const obs = new MutationObserver(lire)
    obs.observe(racine, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return sombre ? SERIES_SOMBRE : SERIES_CLAIR
}

/** Lundi de la semaine d'aujourd'hui, décalé de `retard` semaines. */
export function lundiDeLaSemaine(retard: number): string {
  const d = new Date()
  const decalage = (d.getDay() + 6) % 7 // lundi = 0
  d.setDate(d.getDate() - decalage - retard * 7)
  return d.toISOString().slice(0, 10)
}

export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/**
 * 4 000 plutôt que 3 846 : la graduation se lit, la barre ne déborde pas.
 * Le plafond vaut 4 pas « ronds » (1, 2, 5 × 10^n) : les cinq graduations
 * sont toujours entières et toutes différentes — une semaine vide affichait
 * « 0, 0, 1, 1, 1 » avec un plafond naïf.
 */
export function plafondRond(max: number): number {
  const cible = Math.max(max, 4) / 4
  const puissance = Math.pow(10, Math.floor(Math.log10(cible)))
  const base = cible / puissance
  const pas = (base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10) * puissance
  return 4 * pas
}

/** Les icônes des tuiles — au trait, grille 24, comme tout le produit. */
const KPI_ICONES = {
  pieces: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  ),
  clotures: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4v16h16" />
      <rect x="7" y="12" width="2.6" height="5" rx="0.5" />
      <rect x="11.7" y="8" width="2.6" height="9" rx="0.5" />
      <rect x="16.4" y="5" width="2.6" height="12" rx="0.5" />
    </svg>
  ),
  valeur: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M15 8.5a4 4 0 1 0 0 7" />
      <line x1="8" y1="10.8" x2="13" y2="10.8" />
      <line x1="8" y1="13.2" x2="13" y2="13.2" />
    </svg>
  ),
  magasin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 9 5 4.5A1 1 0 0 1 6 4h12a1 1 0 0 1 .95.68L20.5 9" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  ),
  equipe: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.4a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 20" />
    </svg>
  ),
  actif: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M15 11l2 2 4-4" />
    </svg>
  ),
} as const

/**
 * Un indicateur, son icône, et — quand un mois précédent existe — son
 * évolution. `absolu` : la différence en unités plutôt qu'en pourcentage.
 * Un précédent à zéro n'affiche pas d'évolution : un pourcentage de zéro est
 * un chiffre inventé.
 */
export function Kpi({ nom, valeur, actuel, precedent, refTexte, absolu, icone }: {
  nom: string; valeur: string; icone: keyof typeof KPI_ICONES
  actuel?: number; precedent?: number; refTexte?: string; absolu?: boolean
}) {
  let chip: { texte: string; sens: 'plus' | 'moins' } | null = null
  if (actuel !== undefined && precedent !== undefined && precedent > 0 && actuel !== precedent) {
    const delta = actuel - precedent
    chip = absolu
      ? { texte: `${nb(Math.abs(delta))} de ${delta > 0 ? 'plus' : 'moins'}`, sens: delta > 0 ? 'plus' : 'moins' }
      : { texte: `${nb(Math.round(Math.abs(delta) / precedent * 100))} %`, sens: delta > 0 ? 'plus' : 'moins' }
  }
  return (
    <div className="panel tb-kpi">
      <div className="tb-kpi-haut">
        <span className="tb-kpi-ico">{KPI_ICONES[icone]}</span>
        <span className="tb-kpi-nom">{nom}</span>
      </div>
      <div className="tb-kpi-bas">
        <span className="tb-kpi-valeur num">{valeur}</span>
        {chip && (
          <span className={`tb-chip tb-chip-${chip.sens}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {chip.sens === 'plus' ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
            </svg>
            {chip.texte}
          </span>
        )}
        {refTexte && <span className="tb-kpi-ref num">{refTexte}</span>}
      </div>
    </div>
  )
}

export const SEMAINES = [
  { valeur: 0, label: 'Cette semaine' },
  { valeur: 1, label: 'Semaine dernière' },
  { valeur: 2, label: 'Il y a 2 semaines' },
  { valeur: 3, label: 'Il y a 3 semaines' },
]

/** Le diagramme des comptages de la semaine, bascule Quantité / Valeur. */
export function BarresSemaine({ jours, mesure, onMesure, semaine, onSemaine, enChargement, format }: {
  jours: JourTb[]
  mesure: 'pieces' | 'valeur'
  onMesure: (m: 'pieces' | 'valeur') => void
  semaine: number
  onSemaine: (s: number) => void
  enChargement: boolean
  format: { pieces: (v: number) => string; valeur: (v: number) => string }
}) {
  const valeurs = jours.map(j => (mesure === 'pieces' ? j.pieces : j.valeur))
  const max = Math.max(...valeurs, 1)
  const plafond = plafondRond(max)
  const iMax = valeurs.indexOf(Math.max(...valeurs))

  return (
    <div className="panel tb-carte" style={{ opacity: enChargement ? 0.6 : 1 }}>
      <div className="tb-carte-tete">
        <h2>{mesure === 'pieces' ? 'Pièces comptées par jour' : 'Valeur comptée par jour'}</h2>
        <div className="tb-filtres">
          <div className="tb-segmente" role="group" aria-label="Mesure du graphique">
            <button type="button" aria-pressed={mesure === 'pieces'} className={mesure === 'pieces' ? 'choisi' : ''} onClick={() => onMesure('pieces')}>Quantité</button>
            <button type="button" aria-pressed={mesure === 'valeur'} className={mesure === 'valeur' ? 'choisi' : ''} onClick={() => onMesure('valeur')}>Valeur</button>
          </div>
          <select
            value={semaine}
            onChange={(e) => onSemaine(Number(e.target.value))}
            aria-label="Semaine affichée"
          >
            {SEMAINES.map(s => <option key={s.valeur} value={s.valeur}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="tb-plot">
        <div className="tb-grille">
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <div className="tb-grille-ligne" style={{ bottom: `${f * 100}%` }} key={f}>
              <span className="num">{nb(Math.round(plafond * f))}</span>
            </div>
          ))}
          <div className="tb-barres">
            {jours.map((j, i) => {
              const v = valeurs[i]
              const h = Math.round(v / plafond * 100)
              return (
                <div className="tb-jour" key={j.jour}>
                  <div
                    className={`tb-barre${i === iMax && v > 0 ? ' tb-barre-forte' : ''}`}
                    style={{ height: `${Math.max(h, v > 0 ? 2 : 0)}%` }}
                  >
                    {v > 0 && (
                      <div className="tb-bulle num" role="tooltip">
                        {mesure === 'pieces' ? format.pieces(v) : format.valeur(v)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="tb-jours-noms">
          {jours.map((j, i) => <span key={j.jour}>{JOURS_COURTS[i] ?? ''}</span>)}
        </div>
      </div>
    </div>
  )
}

export type PartAnneau = { nom: string; brut: number; lien?: string }

/**
 * L'anneau de répartition : trois parts nommées au plus, le reste en
 * « Autres ». Les parts se dessinent en valeur absolue — le signe se lit au
 * centre et sur chaque ligne, pas dans la taille des parts.
 */
export function Anneau({ titre, entetes, parts, format, sous, note, vide }: {
  titre: string
  entetes?: React.ReactNode
  parts: PartAnneau[]
  format: (v: number) => string
  sous: string
  note?: string
  vide?: React.ReactNode
}) {
  const series = useSeries()

  const tetes = parts.slice(0, 3)
  const reste = parts.slice(3)
  const affichees: (PartAnneau & { couleur: string })[] = [
    ...tetes.map((p, i) => ({ ...p, couleur: series[i] })),
    ...(reste.length > 0
      ? [{ nom: `${reste.length} autre${reste.length > 1 ? 's' : ''}`, brut: reste.reduce((s, p) => s + p.brut, 0), couleur: 'var(--text-3)' }]
      : []),
  ]
  const total = affichees.reduce((s, p) => s + p.brut, 0)
  const totalAbs = affichees.reduce((s, p) => s + Math.abs(p.brut), 0)

  const texteCentre = format(total)
  // Le trou fait 108 unités de viewBox ; un glyphe de Sora 800 pèse ~0,6 fois
  // sa taille. Borné pour que le montant tienne, quel qu'il soit.
  const tailleCentre = Math.min(22, Math.max(11, 164 / Math.max(texteCentre.length, 1)))

  const C = 2 * Math.PI * 66
  let offset = 0
  const arcs = affichees.map((p) => {
    const part = totalAbs > 0 ? Math.abs(p.brut) / totalAbs : 0
    const longueur = Math.max(part * C - 4.5, 0)
    const a = { ...p, longueur, offset }
    offset += part * C
    return a
  })

  return (
    <div className="panel tb-carte">
      <div className="tb-carte-tete">
        <h2>{titre}</h2>
        {entetes && <div className="tb-filtres">{entetes}</div>}
      </div>
      {parts.length === 0 ? (
        <div className="tb-vide">{vide}</div>
      ) : (
        <div className="tb-anneau-corps">
          <div className="tb-anneau">
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <g transform="rotate(-90 90 90)">
                {/* L'anneau de fond : sans lui, un total nul ferait
                    disparaître la figure entière. */}
                <circle cx="90" cy="90" r="66" fill="none" stroke="var(--hairline)" strokeWidth="24" />
                {arcs.map((a) => (
                  <circle
                    key={a.nom} cx="90" cy="90" r="66" fill="none"
                    stroke={a.couleur} strokeWidth="24"
                    strokeDasharray={`${a.longueur.toFixed(1)} ${(C - a.longueur).toFixed(1)}`}
                    strokeDashoffset={(-a.offset).toFixed(1)}
                  />
                ))}
              </g>
              <text x="90" y="92" textAnchor="middle" className="tb-anneau-gros" style={{ fontSize: tailleCentre }}>
                {texteCentre}
              </text>
              <text x="90" y="110" textAnchor="middle" className="tb-anneau-sous">{sous}</text>
            </svg>
          </div>
          <div className="tb-legende">
            {arcs.map((a) => (
              <div className="tb-legende-rang" key={a.nom}>
                <span className="tb-puce" style={{ background: a.couleur }} />
                {a.lien ? (
                  <Link href={a.lien} className="tb-legende-nom">{a.nom}</Link>
                ) : (
                  <span className="tb-legende-nom">{a.nom}</span>
                )}
                <span className="tb-legende-val num">{format(a.brut)}</span>
              </div>
            ))}
            {note && <div className="tb-legende-note">{note}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
