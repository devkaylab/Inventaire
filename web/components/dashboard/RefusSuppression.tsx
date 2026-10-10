'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errors'
import { t } from '@/lib/i18n'

/**
 * Refuser une demande de suppression — administrateur d'entreprise.
 *
 * ⚠️⚠️ **CE N'EST PAS UNE SYMÉTRIE DE DÉCOR, C'EST LA SORTIE QUI MANQUAIT.**
 * La section des demandes n'offrait qu'un chemin : supprimer. Un administrateur
 * qui ne veut PAS supprimer n'avait aucun geste — la demande restait « en
 * attente » pour toujours, et le superviseur n'apprenait jamais la décision.
 * C'est le cul-de-sac du 9 octobre 2026 (un compte supprimé faute d'autre
 * bouton), à l'autre bout du même parcours.
 *
 * ⚠️ **ET LE COMMENTAIRE EST FACULTATIF ICI**, alors que le motif de la demande
 * est obligatoire. Ce n'est pas un oubli : celui qui demande fait arbitrer
 * quelqu'un d'autre sur un geste définitif, il doit sa raison ; celui qui
 * refuse ne détruit rien. Exiger un texte pour ne RIEN faire ajouterait une
 * friction à la décision prudente.
 */
export function RefusSuppression({ demande, onFermer, onFait }: {
  demande: { id: number; cible_nom: string; par: string; motif: string }
  onFermer: () => void
  onFait: () => Promise<void> | void
}) {
  const toast = useToast()
  const [commentaire, setCommentaire] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function refuser(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('ca_refuser_suppression', {
      p_id: demande.id, p_motif: commentaire.trim(),
    })
    setBusy(false)
    if (error || !data?.success) {
      // ⚠️ L'erreur s'affiche DANS la fenêtre, pas derrière : posée sur la page,
      // elle n'est lisible qu'après avoir refermé ce qui la cachait (relevé par
      // Julien, 10 octobre 2026).
      setErreur(errorMessage(data?.error ?? error ?? t('Refus impossible.')))
      return
    }
    toast.success(t('Demande refusée. %{par} en est informé.', { par: demande.par || t('Le superviseur') }))
    onFermer()
    await onFait()
  }

  return (
    <form onSubmit={refuser}>
      <div className="panel-rappel">
        <div className="panel-rappel-nom">{demande.cible_nom}</div>
        <div className="muted small">
          {t('Demandé par %{par} — %{motif}', { par: demande.par || t('un superviseur'), motif: demande.motif })}
        </div>
      </div>

      <p className="section-note" style={{ marginTop: 14 }}>
        {t('Le compte est conservé tel quel. %{par} reçoit une notification lui disant que la demande est refusée.', { par: demande.par || t('Le superviseur') })}
      </p>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="motif-refus">{t('Commentaire (facultatif)')}</label>
        <textarea
          id="motif-refus" rows={3} value={commentaire}
          placeholder={t('Elle revient sur l’inventaire de novembre.')}
          onChange={(e) => { setCommentaire(e.target.value); setErreur(null) }}
        />
      </div>

      {erreur && <div className="error" role="alert">{erreur}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? t('Refus…') : t('Refuser la demande')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onFermer}>
          {t('Annuler')}
        </button>
      </div>
    </form>
  )
}
