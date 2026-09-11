'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/lib/i18n'

/**
 * Ajout d'un compteur à l'équipe, depuis le dashboard web.
 *
 * Jusqu'ici l'opération n'existait que dans l'application mobile ; le web
 * renvoyait vers elle. Elle passe par la même edge function `invite-teammate`,
 * donc les mêmes règles s'appliquent : e-mail unique, entreprise du
 * superviseur, rattachement automatique au magasin — le code magasin n'est
 * jamais exposé au compteur.
 *
 * Le choix des magasins n'est pas proposé ici : le dashboard est cadré sur un
 * inventaire, donc sur un magasin. L'invitation part sans `storeIds`, ce que
 * `handle_new_user` interprète comme « tous les magasins du superviseur ».
 * Pour restreindre, l'écran mobile propose la sélection.
 */
export function AddCounter({ onAdded }: { onAdded: () => Promise<void> | void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  // Un compte qui appartient à une autre entreprise n'est pas une faute de
  // saisie : il n'y a rien à corriger dans le formulaire, et l'explication ne
  // tient pas dans une notification qui s'efface. Elle reste sous le
  // formulaire, le temps qu'on la lise.
  const [horsEntreprise, setHorsEntreprise] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const first = firstName.trim()
    const last = lastName.trim()
    const mail = email.trim().toLowerCase()
    if (!first || !last) { toast.error(t('Renseignez le prénom et le nom.')); return }
    if (!mail.includes('@')) { toast.error(t('Adresse e-mail invalide.')); return }

    setBusy(true)
    setHorsEntreprise(null)
    const { data, error } = await supabase.functions.invoke('invite-teammate', {
      body: { firstName: first, lastName: last, email: mail, storeIds: [] },
    })
    setBusy(false)

    if (error || !data?.success) {
      if (data?.code === 'other_company') {
        setHorsEntreprise(data.error as string)
        return
      }
      toast.error(data?.error ?? error?.message ?? t('Ajout impossible.'))
      return
    }
    if (data.emailSent) {
      toast.success(t('%{nom} reçoit un e-mail pour vérifier ses informations et choisir son mot de passe.', { nom: `${first} ${last}` }))
    } else if (data.alreadyInvited) {
      toast.success(t('%{nom} avait déjà été invité : le lien reçu précédemment reste valable.', { nom: `${first} ${last}` }))
    } else {
      toast.error(t('%{nom} a été ajouté, mais l’e-mail n’a pas pu partir : %{raison}.', { nom: `${first} ${last}`, raison: data.emailError ?? t('raison inconnue') }))
    }
    setFirstName(''); setLastName(''); setEmail(''); setOpen(false)
    await onAdded()
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        {t('Ajouter un compteur')}
      </button>
    )
  }

  return (
    <form className="panel" onSubmit={submit} style={{ marginTop: 12 }}>
      {horsEntreprise && (
        <div className="banner banner-warn" role="status">
          <strong>{t('Cette personne n’est pas de votre entreprise.')}</strong> {horsEntreprise}
        </div>
      )}

      <div className="field">
        <label htmlFor="counter-first">{t('Prénom')}</label>
        <input id="counter-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('Marie')} />
      </div>
      <div className="field">
        <label htmlFor="counter-last">{t('Nom')}</label>
        <input id="counter-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('Dupont')} />
      </div>
      <div className="field">
        <label htmlFor="counter-email">{t('Adresse e-mail')}</label>
        <input
          id="counter-email" type="email" value={email} placeholder="marie.dupont@exemple.fr"
          onChange={(e) => { setEmail(e.target.value); setHorsEntreprise(null) }}
        />
        <p className="field-hint">
          {t('Elle recevra à cette adresse un lien personnel : elle y vérifiera son prénom et son nom, puis choisira son mot de passe.')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? t('Ajout…') : t('Ajouter à l’équipe')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setOpen(false)}>
          {t('Annuler')}
        </button>
      </div>
    </form>
  )
}
