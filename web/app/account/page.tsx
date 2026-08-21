'use client'

// Mon compte — la personne, et rien d'autre.
//
// Cette page était le carrefour du site : jusqu'à dix blocs empilés, dont
// les inventaires en double, l'entreprise, les magasins, l'équipe et les
// balises. Chacun a rejoint son écran ; la navigation est dans la barre du
// haut. Il ne reste ici que ce qui parle de la personne connectée : qui
// elle est, comment elle se protège, ce que nous détenons d'elle.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard, type Profile } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { MfaPanel } from '@/components/MfaPanel'
import { PasswordRules } from '@/components/PasswordRules'
import { friendlyPasswordError, passwordError, passwordSatisfies } from '@/lib/password'
import { getMyCompany, type Company } from '@/lib/account'

export default function AccountPage() {
  const guard = useAuthGuard('auth')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState<Company | null>(null)
  const [exporting, setExporting] = useState(false)

  const charger = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setEmail(session?.user.email ?? '')
    setCompany(await getMyCompany().catch(() => null))
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  // Droit d'accès et de portabilité (articles 15 et 20 du RGPD) : la base
  // assemble l'export, le navigateur le remet en fichier — rien ne transite
  // par un serveur tiers.
  async function downloadMyData() {
    if (exporting) return
    setExporting(true)
    const { data, error } = await supabase.rpc('export_my_data')
    setExporting(false)
    if (error || !data) {
      alert('Export impossible pour le moment. Réessayez dans un instant.')
      return
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quantinvo-mes-donnees.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function demanderSuppression() {
    if (!confirm('Demander la suppression de votre compte ?\n\nVos comptages seront anonymisés et conservés pour les inventaires auxquels vous avez participé ; votre compte sera supprimé.')) return
    const { data, error } = await supabase.rpc('request_account_deletion')
    if (error || !data?.success) {
      alert('Demande impossible pour le moment. Réessayez dans un instant.')
      return
    }
    alert(data.already
      ? 'Votre demande est déjà enregistrée.'
      : 'Demande enregistrée. Nous la traitons sous quelques jours.')
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const profile = guard.profile
  const role = profile.is_admin
    ? 'Administrateur Quantinvo'
    : profile.is_company_admin
      ? 'Administrateur d’entreprise'
      : profile.role === 'supervisor' ? 'Superviseur' : 'Compteur'

  return (
    <AppShell profile={profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">Mon compte</h1>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        <h3>Mes informations</h3>
        <div style={{ marginTop: 12 }}>
          <div className="acc-kv"><span>Nom</span><strong>{profile.full_name || '—'}</strong></div>
          <div className="acc-kv"><span>Adresse e-mail</span><strong>{email || '—'}</strong></div>
          <div className="acc-kv">
            <span>Rôle</span>
            <strong>{role}{company?.name ? ` — ${company.name}` : ''}</strong>
          </div>
        </div>
        {/* Le nom est la seule information qu'on peut corriger soi-même :
            l'adresse identifie le compte, le rôle est figé par le serveur
            (trigger profiles_pin_privileged). */}
        <ModifierMonNom profile={profile} onSaved={charger} />
      </div>

      <div className="panel">
        <h3>Mot de passe</h3>
        <p className="muted small">
          Il fallait jusqu&apos;ici se déconnecter et passer par «&nbsp;mot de passe
          oublié&nbsp;». Vous pouvez le changer ici, en restant connecté.
        </p>
        <ChangerMotDePasse />
      </div>

      <MfaPanel />

      <div className="panel">
        <h3>Mes données</h3>
        <p className="muted small">
          Téléchargez une copie des données associées à votre compte — profil, inventaires,
          invitations, demandes — dans un format lisible et réutilisable
          (articles 15 et 20 du RGPD).
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={downloadMyData} disabled={exporting}>
            {exporting ? 'Préparation…' : 'Télécharger mes données'}
          </button>
          <button className="btn btn-danger" onClick={demanderSuppression}>
            Supprimer mon compte
          </button>
        </div>
      </div>
    </AppShell>
  )
}

/**
 * Correction de son propre nom.
 *
 * `profiles` est modifiable par son porteur, mais le trigger
 * profiles_pin_privileged fige le rôle, l'entreprise et les drapeaux : même
 * une requête forgée ne peut toucher qu'au nom.
 */
function ModifierMonNom({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState(profile.full_name ?? '')
  const [busy, setBusy] = useState(false)

  if (!ouvert) {
    return (
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => { setNom(profile.full_name ?? ''); setOuvert(true) }}>
        Modifier mon nom
      </button>
    )
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const propre = nom.trim().replace(/\s+/g, ' ')
    if (propre.length < 2) { alert('Indiquez au moins deux caractères.'); return }
    const morceaux = propre.split(' ')
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: propre,
        first_name: morceaux[0],
        last_name: morceaux.length > 1 ? morceaux.slice(1).join(' ') : '',
      })
      .eq('id', profile.id)
    setBusy(false)
    if (error) { alert('Modification impossible pour le moment.'); return }
    setOuvert(false)
    onSaved()
  }

  return (
    <form onSubmit={enregistrer} className="inline-form" style={{ marginTop: 14, flexWrap: 'wrap' }}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom et nom" style={{ minWidth: 220 }} autoFocus />
      <button className="btn btn-primary btn-sm" disabled={busy || nom.trim() === (profile.full_name ?? '')}>
        {busy ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOuvert(false)}>Annuler</button>
    </form>
  )
}

/**
 * Changement de mot de passe en restant connecté.
 *
 * Les mêmes règles que /bienvenue et /reinitialisation, par le même module :
 * douze caractères, majuscule, minuscule, chiffre, symbole — et la traduction
 * des refus que seul le serveur peut prononcer (mot de passe issu d'une fuite,
 * réutilisation de l'ancien).
 */
function ChangerMotDePasse() {
  const [ouvert, setOuvert] = useState(false)
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fait, setFait] = useState(false)

  if (!ouvert) {
    return (
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setFait(false); setOuvert(true) }}>
          Changer mon mot de passe
        </button>
        {fait && <p className="balise-done" role="status" style={{ marginTop: 10 }}>Mot de passe modifié.</p>}
      </div>
    )
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const probleme = passwordError(mdp)
    if (probleme) { setErreur(probleme); return }
    if (mdp !== confirmation) { setErreur('Les deux saisies ne correspondent pas.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: mdp })
    setBusy(false)
    if (error) { setErreur(friendlyPasswordError(error.message)); return }
    setMdp(''); setConfirmation(''); setErreur(null)
    setOuvert(false); setFait(true)
  }

  return (
    <form onSubmit={enregistrer} style={{ marginTop: 14 }}>
      {erreur && <div className="error" role="alert">{erreur}</div>}
      <div className="field">
        <label htmlFor="mdp-nouveau">Nouveau mot de passe</label>
        <input
          id="mdp-nouveau" type="password" autoComplete="new-password" value={mdp}
          onChange={(e) => { setMdp(e.target.value); setErreur(null) }} autoFocus
        />
        <PasswordRules password={mdp} />
      </div>
      <div className="field">
        <label htmlFor="mdp-confirmation">Confirmer</label>
        <input
          id="mdp-confirmation" type="password" autoComplete="new-password" value={confirmation}
          onChange={(e) => { setConfirmation(e.target.value); setErreur(null) }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !passwordSatisfies(mdp) || mdp !== confirmation}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOuvert(false); setErreur(null); setMdp(''); setConfirmation('') }}>
          Annuler
        </button>
      </div>
    </form>
  )
}
