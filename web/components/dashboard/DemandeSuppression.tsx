'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/lib/i18n'

/**
 * Demander à l'administrateur la suppression d'un compte.
 *
 * ⚠️ **UN SUPERVISEUR DEMANDE, IL NE DÉCIDE PAS.** Supprimer un compte reste
 * réservé à l'administrateur d'entreprise : la suppression est irréversible, et
 * un compteur peut travailler pour plusieurs superviseurs — celui qui tranche
 * doit voir toute l'entreprise, pas un magasin.
 *
 * ⚠️ **LE MOTIF EST OBLIGATOIRE** (décision de Julien, 10 octobre 2026) :
 * l'administrateur arbitre sur un geste définitif, il lui faut une raison
 * écrite. Le refus est posé en base aussi — l'écran n'est pas la serrure.
 */
export function DemandeSuppression({ personne, onFermer, onFait }: {
  personne: { id: string; nom: string; email: string | null }
  onFermer: () => void
  onFait: () => Promise<void> | void
}) {
  const toast = useToast()
  const [motif, setMotif] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    const raison = motif.trim()
    if (!raison) {
      setErreur(t('Indiquez le motif de la demande.'))
      return
    }
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('demander-suppression', {
      body: { userId: personne.id, motif: raison },
    })
    setBusy(false)
    if (error || !data?.success) {
      setErreur(data?.error ?? error?.message ?? t('Demande impossible.'))
      return
    }
    toast.success(t('Demande envoyée à l’administrateur de votre entreprise.'))
    onFermer()
    await onFait()
  }

  return (
    <form onSubmit={envoyer}>
      <div className="panel-rappel">
        <div className="panel-rappel-nom">{personne.nom}</div>
        {personne.email && <div className="muted small">{personne.email}</div>}
      </div>

      <p className="section-note" style={{ marginTop: 14 }}>
        {t('Seul l’administrateur de votre entreprise peut supprimer un compte. Votre demande lui est envoyée avec le motif, par notification et par e-mail.')}
      </p>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="motif-suppression">{t('Motif')}</label>
        <textarea
          id="motif-suppression" rows={3} value={motif}
          placeholder={t('A quitté l’entreprise fin septembre.')}
          onChange={(e) => { setMotif(e.target.value); setErreur(null) }}
        />
      </div>

      {erreur && <div className="error" role="alert">{erreur}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? t('Envoi…') : t('Envoyer la demande')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onFermer}>
          {t('Annuler')}
        </button>
      </div>
    </form>
  )
}
