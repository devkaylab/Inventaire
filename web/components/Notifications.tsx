'use client'

// La cloche du rail (30 août 2026).
//
// Elle vit dans le RAIL, pas sur le tableau de bord, contrairement à la
// maquette — et c'est un choix : l'administrateur d'entreprise reçoit les
// messages de ses superviseurs, or il atterrit sur /entreprise et ne passe
// pas par /dashboard. Le rail est le seul endroit que tous les rôles voient.
//
// Ouvrir la cloche, c'est lire : le panneau marque tout lu à l'ouverture
// (`marquer_notifications_lues`), la pastille tombe. Les libellés sont figés
// à l'écriture côté serveur ; ici on ne fait que les mettre en phrase.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { relativeTime } from '@/lib/format'

type Notif = {
  id: number
  type: 'invitation_inventaire' | 'compteur_actif' | 'message_superviseur' | 'message_entreprise'
  donnees: Record<string, string | undefined>
  created_at: string
  lu: boolean
}

/** La phrase de chaque type — et où mène l'appui, s'il mène quelque part. */
function presenter(n: Notif): { titre: string; texte: string; lien: string | null } {
  const d = n.donnees
  switch (n.type) {
    case 'invitation_inventaire':
      return {
        titre: 'Invitation reçue',
        texte: `${d.par ? `${d.par} vous a ajouté` : 'Vous avez été ajouté'} à l’inventaire « ${d.nom ?? ''} » — ${d.magasin ?? ''}.`,
        lien: d.session_id ? `/dashboard/${d.session_id}` : null,
      }
    case 'compteur_actif':
      return {
        titre: 'Compte activé',
        texte: `${d.nom || 'Un compteur'} s’est connecté pour la première fois : son profil de compteur est prêt.`,
        lien: '/equipe',
      }
    // Le texte est tronqué par la fenêtre : le rang mène à la boîte, où le
    // message se lit en entier (constat de Julien, 30 août 2026).
    case 'message_superviseur':
      return {
        titre: `Message de ${d.de || 'un superviseur'}`,
        texte: d.sujet ?? '',
        lien: '/messages',
      }
    case 'message_entreprise':
      return {
        titre: `Message de ${d.de || 'une entreprise'}${d.entreprise ? ` — ${d.entreprise}` : ''}`,
        texte: d.sujet ?? '',
        lien: '/messages',
      }
  }
}

export function Notifications() {
  const router = useRouter()
  const [ouvert, setOuvert] = useState(false)
  const [nonLues, setNonLues] = useState(0)
  const [liste, setListe] = useState<Notif[]>([])
  const boiteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let actif = true
    supabase.rpc('mes_notifications').then(({ data, error }) => {
      if (!actif || error || !data) return
      setNonLues(Number(data.non_lues ?? 0))
      setListe((data.liste ?? []) as Notif[])
    })
    return () => { actif = false }
  }, [])

  useEffect(() => {
    if (!ouvert) return
    function auClic(e: MouseEvent) {
      if (boiteRef.current && !boiteRef.current.contains(e.target as Node)) setOuvert(false)
    }
    function auClavier(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', auClic)
    document.addEventListener('keydown', auClavier)
    return () => {
      document.removeEventListener('mousedown', auClic)
      document.removeEventListener('keydown', auClavier)
    }
  }, [ouvert])

  function basculer() {
    const prochain = !ouvert
    setOuvert(prochain)
    if (prochain && nonLues > 0) {
      // Marqué APRÈS l'affichage : le panneau montre encore quelles lignes
      // étaient neuves (leur point), la prochaine ouverture ne les aura plus.
      supabase.rpc('marquer_notifications_lues').then(() => setNonLues(0))
    }
  }

  function ouvrir(lien: string | null) {
    if (!lien) return
    setOuvert(false)
    router.push(lien)
  }

  return (
    <div className="rail-notif" ref={boiteRef}>
      <button
        type="button"
        className="rail-onglet"
        title="Notifications"
        aria-label={nonLues > 0 ? `Notifications — ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        onClick={basculer}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {nonLues > 0 && <span className="rail-badge num">{nonLues > 9 ? '9+' : nonLues}</span>}
      </button>

      {ouvert && (
        <div className="notif-panneau" role="dialog" aria-label="Notifications">
          <div className="notif-panneau-tete">Notifications</div>
          {liste.length === 0 ? (
            <p className="notif-vide">Rien pour l’instant.</p>
          ) : (
            liste.map((n) => {
              const p = presenter(n)
              const corps = (
                <>
                  <div className="notif-titre">{p.titre}</div>
                  <div className="notif-texte">{p.texte}</div>
                  <div className="notif-date">{relativeTime(n.created_at)}</div>
                </>
              )
              return p.lien ? (
                <button type="button" className="notif-rang notif-rang-lien" key={n.id} onClick={() => ouvrir(p.lien)}>
                  <span className="notif-corps">{corps}</span>
                  {!n.lu && <span className="notif-point" aria-label="non lue" />}
                </button>
              ) : (
                <div className="notif-rang" key={n.id}>
                  <span className="notif-corps">{corps}</span>
                  {!n.lu && <span className="notif-point" aria-label="non lue" />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
