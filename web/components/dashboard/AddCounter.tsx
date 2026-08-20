'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/Toast'

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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const first = firstName.trim()
    const last = lastName.trim()
    const mail = email.trim().toLowerCase()
    if (!first || !last) { toast.error('Renseignez le prénom et le nom.'); return }
    if (!mail.includes('@')) { toast.error('Adresse e-mail invalide.'); return }

    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-teammate', {
      body: { firstName: first, lastName: last, email: mail, storeIds: [] },
    })
    setBusy(false)

    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Ajout impossible.')
      return
    }
    if (data.emailSent) {
      toast.success(`${first} ${last} reçoit un e-mail pour vérifier ses informations et choisir son mot de passe.`)
    } else if (data.alreadyInvited) {
      toast.success(`${first} ${last} avait déjà été invité : le lien reçu précédemment reste valable.`)
    } else {
      toast.error(`${first} ${last} a été ajouté, mais l’e-mail n’a pas pu partir : ${data.emailError ?? 'raison inconnue'}.`)
    }
    setFirstName(''); setLastName(''); setEmail(''); setOpen(false)
    await onAdded()
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Ajouter un compteur
      </button>
    )
  }

  return (
    <form className="panel" onSubmit={submit} style={{ marginTop: 12 }}>
      <div className="field">
        <label htmlFor="counter-first">Prénom</label>
        <input id="counter-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marie" />
      </div>
      <div className="field">
        <label htmlFor="counter-last">Nom</label>
        <input id="counter-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" />
      </div>
      <div className="field">
        <label htmlFor="counter-email">Adresse e-mail</label>
        <input id="counter-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marie.dupont@exemple.fr" />
        <p className="field-hint">
          Elle recevra à cette adresse un lien personnel : elle y vérifiera son prénom et son nom,
          puis choisira son mot de passe.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Ajout…' : 'Ajouter à l’équipe'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </form>
  )
}
