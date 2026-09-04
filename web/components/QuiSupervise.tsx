'use client'

/**
 * « Qui va superviser ce magasin ? » — au retour du paiement.
 *
 * Julien, une fois son premier magasin payé : *« ouvrir un pop-up pour ajouter
 * des superviseurs sur le magasin, ça évite de chercher la page équipe. »*
 *
 * ⚠️ CE N'EST PAS UN CONFORT, C'EST LE GESTE SUIVANT. Un magasin sans
 * superviseur ne sert à rien — personne ne peut y lancer d'inventaire. La
 * question se pose donc toujours, au même moment, et elle était à chercher deux
 * écrans plus loin.
 *
 * ⚠️ AUCUN SECOND CHEMIN D'AFFECTATION : la fenêtre appelle
 * `ca_set_supervisor_stores`, celle de la page Équipe, avec ses gardes. Elle
 * REMPLACE la liste des magasins d'une personne — on lui envoie donc les siens
 * PLUS celui-ci, jamais celui-ci seul.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { Modal } from '@/components/ui/Modal'

type Membre = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_company_admin: boolean
  email: string | null
  store_ids: string[]
}

/** Le nom qu'on affiche, sans jamais laisser un blanc à la place de quelqu'un. */
function nomDe(m: Membre): string {
  const complet = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
  return m.full_name?.trim() || complet || m.email || 'Sans nom'
}

export function QuiSupervise({
  storeId, magasin, onClose,
}: {
  storeId: string
  magasin: string
  onClose: () => void
}) {
  const [membres, setMembres] = useState<Membre[] | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [faits, setFaits] = useState<string[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('ca_list_team')
    if (error) { setMembres([]); return }
    const tous = (data ?? []) as Membre[]
    setMembres(tous.filter((m) => m.role === 'supervisor' && !m.is_company_admin))
    setFaits(tous.filter((m) => m.store_ids?.includes(storeId)).map((m) => m.id))
  }, [storeId])

  useEffect(() => { charger() }, [charger])

  async function affecter(m: Membre) {
    setEnCours(m.id)
    setErreur(null)
    // ⚠️ Les siens PLUS celui-ci : la fonction remplace la liste entière, lui
    // envoyer ce seul magasin retirerait la personne de tous les autres.
    const { data, error } = await supabase.rpc('ca_set_supervisor_stores', {
      p_user: m.id,
      p_store_ids: [...new Set([...(m.store_ids ?? []), storeId])],
    })
    setEnCours(null)
    if (error || !data?.success) {
      setErreur(data?.error ?? error?.message ?? 'Affectation impossible.')
      return
    }
    setFaits((f) => [...f, m.id])
  }

  const libres = (membres ?? []).filter((m) => !faits.includes(m.id))

  return (
    <Modal
      title={`« ${magasin} » est créé`}
      onClose={onClose}
      footer={
        <>
          <Link href="/equipe" className="btn btn-ghost btn-sm">Inviter un superviseur</Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            {faits.length > 0 ? 'Terminé' : 'Plus tard'}
          </button>
        </>
      }
    >
      <p className="muted small" style={{ marginTop: 0 }}>
        {/* ⚠️ On dit POURQUOI la question se pose ici : sans superviseur, le
            magasin ne sert à rien. Sans ce mot, la fenêtre passe pour une
            étape de plus. */}
        Un magasin sans superviseur ne peut pas lancer d’inventaire.
      </p>

      {membres === null ? (
        <p className="muted">Chargement…</p>
      ) : membres.length === 0 ? (
        <p className="muted small">
          Votre entreprise n’a pas encore de superviseur. Invitez-en un depuis la page Équipe.
        </p>
      ) : (
        <div className="req-list">
          {[...libres, ...(membres.filter((m) => faits.includes(m.id)))].map((m) => (
            <div className="req-row" key={m.id}>
              <div className="qs-qui">
                <div className="req-name">{nomDe(m)}</div>
                {/* ⚠️ L'adresse se tronque, elle ne casse pas la ligne : une
                    adresse longue reléguait « 1 magasin » sur un second rang et
                    déséquilibrait toute la liste. */}
                <div className="muted small qs-ligne">
                  <span className="qs-mail">{m.email}</span>
                  {(m.store_ids?.length ?? 0) > 0 && (
                    <span className="qs-compte">
                      · {m.store_ids.length} magasin{m.store_ids.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              {faits.includes(m.id) ? (
                <span className="pill pill-vous">Affecté</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={enCours === m.id}
                  onClick={() => affecter(m)}
                >
                  {enCours === m.id ? 'Un instant…' : 'Affecter'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {erreur && <p className="field-hint" role="alert" style={{ marginTop: 10 }}>{erreur}</p>}
    </Modal>
  )
}
