'use client'

/**
 * Capacité serveur — quel plafond relever, et quand.
 *
 * Trois sources, distinguées à l'écran parce qu'elles n'ont pas la même
 * fraîcheur : l'instance (relevé à l'instant), la base (le pic sur douze mois),
 * et la facture (ce que rien n'expose). Voir `lib/capacite.ts`.
 *
 * ⚠️ Deux lignes n'ont volontairement PAS de valeur — messages temps réel et
 * sortie réseau. Ne pas les remplir d'un chiffre modélisé : une estimation
 * posée à côté de mesures réelles se lit comme une mesure.
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { nb, octets, fmtDateTime, relativeTime } from '@/lib/format'
import {
  lirePlafonds, aSurveiller, pourcent, LIBELLES_ETAT, LIBELLES_SOURCE,
  type Capacite, type Pointes, type Plafond,
} from '@/lib/capacite'

type Releve = {
  success: boolean
  code?: string
  error?: string
  releve?: string
  capacite?: Capacite
}

export default function AdminCapacitePage() {
  const guard = useAuthGuard('admin')
  const [releve, setReleve] = useState<Releve | null>(null)
  const [pointes, setPointes] = useState<Pointes | null>(null)
  const [busy, setBusy] = useState(false)

  const charger = useCallback(async () => {
    setBusy(true)
    const [m, p] = await Promise.all([
      supabase.functions.invoke('admin-metrics', { body: {} }),
      supabase.rpc('admin_charge_pointes'),
    ])
    setBusy(false)
    setReleve(
      m.error
        ? { success: false, code: 'flux_indisponible', error: m.error.message }
        : (m.data as Releve),
    )
    if (!p.error) setPointes(p.data as Pointes)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    void charger()
  }, [guard.status, charger])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const capacite = releve?.success ? (releve.capacite ?? null) : null
  const plafonds = lirePlafonds(capacite, pointes, { octets })
  const tendus = aSurveiller(plafonds)

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Capacité serveur</h1>
          <p className="page-sub">
            Ce que la charge réelle dit des plafonds à relever — et dans quel ordre
          </p>
        </div>
        <div className="app-head-actions">
          {releve?.releve && (
            <span className="muted small">Relevé {relativeTime(releve.releve)}</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => void charger()} disabled={busy}>
            {busy ? 'Relevé…' : 'Relever'}
          </button>
        </div>
      </div>

      {releve && !releve.success && (
        <div className="panel">
          <h3>
            {releve.code === 'sans_cle'
              ? 'Le relevé de l’instance n’est pas branché'
              : releve.code === 'cle_refusee'
                ? 'La clé de relevé est refusée'
                : 'Le flux de métriques est injoignable'}
          </h3>
          <p>
            {releve.code === 'sans_cle' ? (
              <>
                Créer une clé secrète dédiée dans <b>Project Settings → API Keys</b>, puis la poser
                en secret d’edge function sous le nom <code>METRICS_KEY</code>. Sans elle, seules
                les pointes lues dans la base s’affichent.
              </>
            ) : releve.code === 'cle_refusee' ? (
              <>
                Le flux répond que la clé n’est pas valable — elle a sans doute été révoquée ou
                remplacée. La recréer dans <b>Project Settings → API Keys</b> et remettre à jour le
                secret <code>METRICS_KEY</code>.
              </>
            ) : (
              releve.error
            )}
          </p>
        </div>
      )}

      {tendus.length > 0 && (
        <p className="usage-constat">
          {tendus.length === 1 ? 'Un plafond demande' : `${nb(tendus.length)} plafonds demandent`}
          {' '}de l’attention :{' '}
          <b>{tendus.map((x) => x.nom.toLowerCase()).join(', ')}</b>.
        </p>
      )}

      <div className="panel">
        <h3>Les plafonds</h3>
        <p>Ce qui est mesuré, ce qui ne l’est pas, et où le lire</p>

        <div className="cap-liste">
          {plafonds.map((x) => (
            <LignePlafond key={x.cle} p={x} />
          ))}
        </div>
      </div>

      <div className="dash-detail" style={{ marginTop: 16 }}>
        <div className="panel" style={{ marginTop: 0 }}>
          <h3>L’instance</h3>
          {capacite ? (
            <div style={{ marginTop: 6 }}>
              <Fait nom="Base de données" v={octets(capacite.baseOctets)} />
              <Fait nom="Journal (WAL)" v={capacite.walMo != null ? `${nb(Math.round(capacite.walMo))} Mo` : '—'} />
              <Fait nom="Mémoire disponible" v={octets(capacite.memoireDispo)} />
              <Fait nom="Cœurs" v={capacite.coeurs != null ? String(capacite.coeurs) : '—'} />
              <Fait nom="Comptes" v={capacite.comptes != null ? nb(capacite.comptes) : '—'} />
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 8 }}>Non relevée.</p>
          )}
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <h3>La pointe applicative</h3>
          <p>Retrouvée dans les comptages, minute par minute, sur douze mois</p>
          {pointes ? (
            <div style={{ marginTop: 6 }}>
              <Fait
                nom="Écritures dans la minute"
                v={pointes.ecritures_min != null ? nb(pointes.ecritures_min) : '—'}
                note={pointes.ecritures_quand ? fmtDateTime(pointes.ecritures_quand) : undefined}
              />
              <Fait nom="Compteurs simultanés" v={pointes.compteurs_max != null ? nb(pointes.compteurs_max) : '—'} />
              <Fait nom="Inventaires simultanés" v={pointes.inventaires_max != null ? nb(pointes.inventaires_max) : '—'} />
              <Fait nom="Minutes actives" v={pointes.minutes_actives != null ? nb(pointes.minutes_actives) : '—'} />
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 8 }}>Non relevée.</p>
          )}
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 16, maxWidth: '82ch' }}>
        Le flux de l’instance donne <b>l’instant</b> : une page ouverte l’après-midi ne saura rien
        de la nuit du gros inventaire. C’est pourquoi la pointe se retrouve dans la base, et c’est
        elle qui dimensionne la machine. Les deux dernières lignes ne sont mesurables nulle part
        ici — elles se relèvent sur la facture Supabase.
      </p>
    </AppShell>
  )
}

function LignePlafond({ p }: { p: Plafond }) {
  const largeur = p.part === null ? 0 : Math.min(p.part, 1) * 100
  return (
    <div className={`cap-ligne cap-${p.etat}`}>
      <div className="cap-tete">
        <span className="cap-nom">{p.nom}</span>
        <span className="cap-etat">{LIBELLES_ETAT[p.etat]}</span>
      </div>
      <div className="cap-mesure">
        {/* Pas de piste quand rien n'est mesuré : une jauge vide se lit comme
            un zéro, alors qu'elle voudrait dire « on ne sait pas ». */}
        {p.part !== null && (
          <span className="cap-piste">
            <span className="cap-part" style={{ width: `${largeur}%` }} />
          </span>
        )}
        <span className="cap-chiffres">
          <b>{p.valeur}</b>
          {p.borne && <span className="muted"> / {p.borne}</span>}
          {p.part !== null && <span className="cap-pct">{pourcent(p.part)}</span>}
        </span>
      </div>
      <p className="cap-note">
        <span className="cap-source">{LIBELLES_SOURCE[p.source]}</span>
        {p.note}
      </p>
    </div>
  )
}

function Fait({ nom, v, note }: { nom: string; v: string; note?: string }) {
  return (
    <div className="usage-somme">
      <span className="muted small">
        {nom}
        {note && <span className="cap-quand">{note}</span>}
      </span>
      <b>{v}</b>
    </div>
  )
}
