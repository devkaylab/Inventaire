'use client'

// Mon compte — la personne, et rien d'autre.
//
// Cette page était le carrefour du site : jusqu'à dix blocs empilés, dont
// les inventaires en double, l'entreprise, les magasins, l'équipe et les
// balises. Chacun a rejoint son écran ; la navigation est dans la barre du
// haut. Il ne reste ici que ce qui parle de la personne connectée : qui
// elle est, comment elle se protège, ce que nous détenons d'elle.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard, type Profile } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { MfaPanel } from '@/components/MfaPanel'
import { PasswordRules } from '@/components/PasswordRules'
import { friendlyPasswordError, passwordError, passwordSatisfies } from '@/lib/password'
import { getMyCompany, type Company } from '@/lib/account'
import { verifyCurrentPassword } from '@/lib/reauth'
import { Chargement } from '@/components/Chargement'
import { LANGUES, NOM_LANGUE, changerLangue, useTraduction } from '@/lib/i18n'

export default function AccountPage() {
  const guard = useAuthGuard('auth')
  const { t, langue } = useTraduction()
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
      alert(t('Export impossible pour le moment. Réessayez dans un instant.'))
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
    if (!confirm(t('Demander la suppression de votre compte ?\n\nVos comptages seront anonymisés et conservés pour les inventaires auxquels vous avez participé ; votre compte sera supprimé.'))) return
    const { data, error } = await supabase.rpc('request_account_deletion')
    if (error || !data?.success) {
      alert(t('Demande impossible pour le moment. Réessayez dans un instant.'))
      return
    }
    alert(data.already
      ? t('Votre demande est déjà enregistrée.')
      : t('Demande enregistrée. Nous la traitons sous quelques jours.'))
  }

  if (guard.status !== 'ready') {
    return <Chargement />
  }

  const profile = guard.profile
  const role = profile.is_admin
    ? t('Administrateur Quantinvo')
    : profile.is_company_admin
      ? t('Administrateur d’entreprise')
      : profile.role === 'supervisor' ? t('Superviseur') : t('Compteur')

  return (
    <AppShell profile={profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">{t('Mon compte')}</h1>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        <h3>{t('Mes informations')}</h3>
        <div style={{ marginTop: 12 }}>
          <div className="acc-kv"><span>{t('Nom complet')}</span><strong>{profile.full_name || '—'}</strong></div>
          <div className="acc-kv"><span>{t('Adresse e-mail')}</span><strong>{email || '—'}</strong></div>
          <div className="acc-kv">
            <span>{t('Rôle')}</span>
            <strong>{role}{company?.name ? ` — ${company.name}` : ''}</strong>
          </div>
        </div>
        {/* Le nom est la seule information qu'on peut corriger soi-même :
            l'adresse identifie le compte, le rôle est figé par le serveur
            (trigger profiles_pin_privileged). */}
        <ModifierMonNom profile={profile} onSaved={charger} />
      </div>

      {/* La langue de l'interface (10 septembre 2026). Le choix vaut pour ce
          navigateur, comme le thème : la langue d'un poste n'est pas celle du
          téléphone, et chaque appareil garde la sienne. */}
      <div className="panel">
        <h3>{t('Langue')}</h3>
        <p className="muted small">
          {t('Le choix vaut pour ce navigateur. Les rapports et les e-mails restent en français.')}
        </p>
        <div className="langue-choix" role="radiogroup" aria-label={t('Langue')}>
          {LANGUES.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={l === langue}
              className={`btn btn-sm ${l === langue ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => changerLangue(l)}
            >
              {NOM_LANGUE[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>{t('Mot de passe')}</h3>
        <p className="muted small">
          {t("Il fallait jusqu'ici se déconnecter et passer par « mot de passe oublié ». Vous pouvez le changer ici, en restant connecté.")}
        </p>
        <ChangerMotDePasse email={email} />
      </div>

      <MfaPanel />

      <div className="panel">
        <h3>{t('Mes données')}</h3>
        <p className="muted small">
          {t('Téléchargez une copie des données associées à votre compte — profil, inventaires, invitations, demandes — dans un format lisible et réutilisable (articles 15 et 20 du RGPD).')}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={downloadMyData} disabled={exporting}>
            {exporting ? t('Préparation…') : t('Télécharger mes données')}
          </button>
          <button className="btn btn-danger" onClick={demanderSuppression}>
            {t('Supprimer mon compte')}
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
  const { t } = useTraduction()
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState(profile.full_name ?? '')
  const [busy, setBusy] = useState(false)

  if (!ouvert) {
    return (
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => { setNom(profile.full_name ?? ''); setOuvert(true) }}>
        {t('Modifier mon nom')}
      </button>
    )
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const propre = nom.trim().replace(/\s+/g, ' ')
    if (propre.length < 2) { alert(t('Indiquez au moins deux caractères.')); return }
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
    if (error) { alert(t('Modification impossible pour le moment.')); return }
    setOuvert(false)
    onSaved()
  }

  return (
    <form onSubmit={enregistrer} className="inline-form" style={{ marginTop: 14, flexWrap: 'wrap' }}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('Prénom et nom')} style={{ minWidth: 220 }} autoFocus />
      <button className="btn btn-primary btn-sm" disabled={busy || nom.trim() === (profile.full_name ?? '')}>
        {busy ? t('Enregistrement…') : t('Enregistrer')}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOuvert(false)}>{t('Annuler')}</button>
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
/**
 * Changer son mot de passe.
 *
 * **Le mot de passe actuel est exigé.** `updateUser({ password })` ne demande
 * rien d'autre que d'être connecté : un poste laissé ouvert suffisait à
 * s'approprier le compte. Qui ne s'en souvient plus passe par « mot de passe
 * oublié », qui vérifie l'identité par l'e-mail.
 */
function ChangerMotDePasse({ email }: { email: string }) {
  const { t } = useTraduction()
  const [ouvert, setOuvert] = useState(false)
  const [actuel, setActuel] = useState('')
  const [mdp, setMdp] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fait, setFait] = useState(false)

  if (!ouvert) {
    return (
      <div style={{ marginTop: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setFait(false); setOuvert(true) }}>
          {t('Changer mon mot de passe')}
        </button>
        {fait && <p className="balise-done" role="status" style={{ marginTop: 10 }}>{t('Mot de passe modifié.')}</p>}
      </div>
    )
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const probleme = passwordError(mdp)
    if (probleme) { setErreur(t(probleme)); return }
    if (mdp !== confirmation) { setErreur(t('Les deux saisies ne correspondent pas.')); return }
    setBusy(true)
    if (!(await verifyCurrentPassword(email, actuel))) {
      setBusy(false)
      setErreur(t('Mot de passe actuel incorrect. Si vous ne vous en souvenez plus, passez par « mot de passe oublié ».'))
      return
    }
    const { error } = await supabase.auth.updateUser({ password: mdp })
    setBusy(false)
    if (error) { setErreur(t(friendlyPasswordError(error.message))); return }
    setActuel(''); setMdp(''); setConfirmation(''); setErreur(null)
    setOuvert(false); setFait(true)
  }

  return (
    <form onSubmit={enregistrer} style={{ marginTop: 14 }}>
      {erreur && <div className="error" role="alert">{erreur}</div>}
      <div className="field">
        <label htmlFor="mdp-actuel">{t('Mot de passe actuel')}</label>
        <input
          id="mdp-actuel" type="password" autoComplete="current-password" value={actuel}
          onChange={(e) => { setActuel(e.target.value); setErreur(null) }} autoFocus
        />
        <p className="muted small" style={{ marginTop: 6 }}>
          <Link href="/mot-de-passe-oublie">{t('Mot de passe oublié ?')}</Link>
        </p>
      </div>
      <div className="field">
        <label htmlFor="mdp-nouveau">{t('Nouveau mot de passe')}</label>
        <input
          id="mdp-nouveau" type="password" autoComplete="new-password" value={mdp}
          onChange={(e) => { setMdp(e.target.value); setErreur(null) }}
        />
        <PasswordRules password={mdp} />
      </div>
      <div className="field">
        <label htmlFor="mdp-confirmation">{t('Confirmer')}</label>
        <input
          id="mdp-confirmation" type="password" autoComplete="new-password" value={confirmation}
          onChange={(e) => { setConfirmation(e.target.value); setErreur(null) }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !actuel || !passwordSatisfies(mdp) || mdp !== confirmation}>
          {busy ? t('Enregistrement…') : t('Enregistrer')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOuvert(false); setErreur(null); setActuel(''); setMdp(''); setConfirmation('') }}>
          {t('Annuler')}
        </button>
      </div>
    </form>
  )
}
