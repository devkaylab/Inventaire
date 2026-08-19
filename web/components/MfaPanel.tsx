'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  challengeAndVerify, startEnrollTotp, unenrollTotp, verifiedTotpFactor, type EnrollData,
} from '@/lib/mfa'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

type State =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'enrolling'; enroll: EnrollData }
  | { kind: 'on'; factorId: string }

/**
 * Activation de la double authentification depuis Mon compte.
 * Le code sera ensuite demandé à chaque connexion (page /login).
 */
export function MfaPanel() {
  const toast = useToast()
  const confirm = useConfirm()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const factorId = await verifiedTotpFactor()
    setState(factorId ? { kind: 'on', factorId } : { kind: 'off' })
  }, [])

  useEffect(() => { void load() }, [load])

  async function begin() {
    setBusy(true)
    try {
      const enroll = await startEnrollTotp()
      setCode('')
      setState({ kind: 'enrolling', enroll })
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (state.kind !== 'enrolling') return
    setBusy(true)
    const r = await challengeAndVerify(state.enroll.factorId, code)
    setBusy(false)
    if (!r.success) {
      toast.error('Code incorrect ou expiré. Vérifiez le code affiché par votre application.')
      return
    }
    toast.success('Double authentification activée.')
    setState({ kind: 'on', factorId: state.enroll.factorId })
  }

  async function disable() {
    if (state.kind !== 'on') return
    const ok = await confirm({
      title: 'Désactiver la double authentification ?',
      message: 'Le mot de passe redeviendra la seule protection du compte.',
      confirmLabel: 'Désactiver',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    const r = await unenrollTotp(state.factorId)
    setBusy(false)
    if (!r.success) { toast.error(r.error ?? 'Désactivation impossible.'); return }
    toast.success('Double authentification désactivée.')
    setState({ kind: 'off' })
  }

  return (
    <div className="panel">
      <h3>Double authentification</h3>

      {state.kind === 'loading' && <p className="muted small">Chargement…</p>}

      {state.kind === 'off' && (
        <>
          <p className="muted small">
            En plus du mot de passe, un code à usage unique — généré par une application
            d&apos;authentification sur votre téléphone (Google Authenticator, Aegis, 1Password…) —
            sera demandé à chaque connexion. Fortement recommandé pour les comptes superviseur
            et administrateur.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={begin}>
            {busy ? 'Préparation…' : 'Activer la double authentification'}
          </button>
        </>
      )}

      {state.kind === 'enrolling' && (
        <>
          <p className="muted small">
            1. Scannez ce QR code avec votre application d&apos;authentification.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI générée par Supabase */}
          <img src={state.enroll.qrCode} alt="QR code d’enrôlement" className="mfa-qr" />
          <p className="muted small">
            Impossible de scanner ? Saisissez la clé à la main :{' '}
            <span className="num">{state.enroll.secret}</span>
          </p>

          <form onSubmit={verify} style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="mfa-code">Code de vérification</label>
              <input
                id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={e => setCode(e.target.value)} placeholder="123456"
              />
              <p className="field-hint">2. Saisissez le code à 6 chiffres affiché par l&apos;application.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" disabled={busy || code.trim().length < 6} type="submit">
                {busy ? 'Vérification…' : 'Vérifier'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setState({ kind: 'off' })}>
                Annuler
              </button>
            </div>
          </form>
        </>
      )}

      {state.kind === 'on' && (
        <>
          <p className="muted small">
            <strong className="pos">La double authentification est activée.</strong>{' '}
            Le code de votre application d&apos;authentification est demandé à chaque connexion.
          </p>
          <button className="link-btn danger-link" style={{ marginTop: 12 }} disabled={busy} onClick={disable}>
            Désactiver
          </button>
        </>
      )}
    </div>
  )
}
