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
import { proposer } from '@/lib/appareils'

type Notif = {
  id: string
  type: 'invitation_inventaire' | 'compteur_actif' | 'message' | 'inventaire_volumineux' | 'forfait_trop_juste'
  donnees: Record<string, string | undefined>
  created_at: string
  lu: boolean
}

/**
 * La phrase de chaque type — et où mène l'appui, s'il mène quelque part.
 *
 * `action` est le libellé d'un appel à l'action. Il porte **le dessin plein des
 * autres boutons du produit** (`btn btn-primary btn-sm`) : une pastille en
 * contour se lisait comme une étiquette et n'incitait à rien (constat de
 * Julien, 4 septembre 2026).
 *
 * ⚠️ MAIS C'EST UN `span`, PAS UN `button`, et ce n'est pas négociable : le
 * rang ENTIER est déjà un bouton, et un bouton dans un bouton n'est pas du
 * HTML valide — les navigateurs s'en sortent au hasard, et deux cibles pour un
 * seul geste se disputent le clic. Le `span` hérite du clic du rang, qui mène
 * exactement au même endroit.
 */
function presenter(n: Notif): { titre: string; texte: string; lien: string | null; action?: string } {
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
    // Le rang mène AU FIL : la conversation s'y lit en entier et s'y
    // poursuit (constat de Julien, 30 août 2026).
    case 'message':
      return {
        titre: `Message de ${d.de || 'quelqu’un'}${d.entreprise ? ` — ${d.entreprise}` : ''}`,
        texte: d.sujet ?? '',
        lien: d.fil_id ? `/messages?fil=${d.fil_id}` : '/messages',
      }
    // Le tour de garde, quand un inventaire dépasse les tailles vérifiées.
    // Elle ne va qu'aux administrateurs Quantinvo, et arrive en même temps que
    // l'e-mail — une boîte ne s'ouvre pas toujours, la cloche attend sur place.
    case 'inventaire_volumineux':
      return {
        titre: 'Un inventaire approche de la limite',
        texte: `« ${d.nom || 'Sans nom'} » — ${d.mesure ?? ''}. Au-delà, le rapport et les écarts deviennent trop lents : à regarder avant le jour du comptage.`,
        lien: d.session_id ? `/dashboard/${d.session_id}` : '/admin',
      }
    // Des appareils n'ont pas pu compter. Elle ne va qu'à l'administrateur
    // d'entreprise — un superviseur ne décide pas de la licence — et ne part
    // qu'une fois par magasin et par mois.
    //
    // ⚠️ L'OFFRE SE DÉDUIT ICI, elle n'est pas figée en base. `donnees` porte
    // les nombres ; `proposer()` connaît l'échelle des paliers, et c'est le
    // seul endroit qui la connaisse. La figer côté serveur en ferait une
    // quatrième copie de la grille.
    // ⚠️ La CLÉ du type ne bouge pas — c'est une valeur de la base, portée par
    // la contrainte de `notifications` et par la liste blanche de
    // `mes_notifications`. Seul le texte passe de « forfait » à « offre ».
    case 'forfait_trop_juste': {
      const couvert = Number(d.forfait ?? 0)
      const offre = proposer(couvert, Number(d.besoin ?? 0))
      return {
        titre: 'Votre offre semble trop juste',
        texte: offre
          ? `Sur ${d.magasin || 'un de vos magasins'}, des appareils n’ont pas pu compter faute de place. Votre offre en couvre ${couvert} à la fois — n’hésitez pas à passer à ${offre.nom}, qui en couvre ${offre.couvre}.`
          : `Sur ${d.magasin || 'un de vos magasins'}, des appareils n’ont pas pu compter faute de place.`,
        // ⚠️ L'ANCRE MÈNE À LA SECTION, pas en haut de la fiche : le geste
        // qu'on propose est à mi-page, et sans elle il faut le chercher.
        lien: d.store_id ? `/magasins/${d.store_id}#appareils` : '/magasins',
        // ⚠️ LE LIBELLÉ NOMME L'OFFRE. « Découvrir » seul ne dit pas quoi, et
        // une invitation sans objet ne fait pas agir (Julien, 4 septembre
        // 2026). Le nom vient de `proposer()`, jamais d'une chaîne écrite ici.
        action: offre ? `Découvrir ${offre.nom}` : 'Découvrir les offres',
      }
    }
  }
}

/**
 * La bannière d'avis, en haut à droite.
 *
 * Demandée par Julien le 4 septembre 2026 : « en plus d'une notif dans la
 * cloche, mets une bannière de notif en haut à droite ». La cloche attend
 * qu'on l'ouvre — or un forfait trop juste est précisément ce qu'on ne va pas
 * chercher : on ne sait pas encore qu'il y a quelque chose à savoir.
 *
 * ⚠️ ELLE SE SERT DE LA MÊME LECTURE QUE LA CLOCHE. Elle vit dans ce composant
 * et non dans `AppShell` pour cette seule raison : la liste est déjà chargée,
 * un second appel à `mes_notifications` à chaque page serait du bruit pur. Sa
 * position est `fixed`, l'endroit du DOM où elle est rendue n'a donc aucune
 * importance.
 *
 * ⚠️ UNE FOIS PAR SESSION ET PAR AVIS. La clé porte l'identifiant : un avis
 * refermé ne revient pas d'une page à l'autre, mais un avis NOUVEAU s'affiche.
 * Sans l'identifiant, le premier refus de l'année ferait taire tous les
 * suivants.
 *
 * ⚠️ `sessionStorage` LÈVE dans certains contextes (navigation privée, cookies
 * bloqués). Tout accès est protégé, et sans lui la bannière s'affiche — c'est
 * la dégradation la moins mauvaise : montrer deux fois vaut mieux que jamais.
 */
function AvisForfait({ notif, onOuvrir }: { notif: Notif; onOuvrir: (lien: string) => void }) {
  const [ferme, setFerme] = useState(false)
  const cle = `avis-forfait-${notif.id}`

  useEffect(() => {
    try { if (sessionStorage.getItem(cle)) setFerme(true) } catch { /* on montre */ }
  }, [cle])

  function refermer() {
    setFerme(true)
    try { sessionStorage.setItem(cle, '1') } catch { /* sans mémoire, tant pis */ }
  }

  if (ferme) return null
  const p = presenter(notif)

  return (
    <div className="avis-forfait" role="status" aria-live="polite">
      <div className="avis-forfait-corps">
        <div className="avis-forfait-titre">{p.titre}</div>
        <div className="avis-forfait-texte">{p.texte}</div>
        {p.lien && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => { refermer(); onOuvrir(p.lien as string) }}
          >
            {p.action ?? 'Voir'}
          </button>
        )}
      </div>
      <button type="button" className="toast-close" onClick={refermer} aria-label="Fermer">×</button>
    </div>
  )
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

  // Le premier avis de forfait non lu, s'il y en a un. `find` et non `filter` :
  // deux bannières l'une sur l'autre ne se lisent pas, et il n'y en a de toute
  // façon qu'une par magasin et par mois.
  const avis = liste.find((n) => n.type === 'forfait_trop_juste' && !n.lu)

  return (
    <div className="rail-notif" ref={boiteRef}>
      {avis && <AvisForfait notif={avis} onOuvrir={(l) => router.push(l)} />}
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
                  <div className="notif-pied">
                    <span className="notif-date">{relativeTime(n.created_at)}</span>
                    {p.action && <span className="btn btn-primary btn-sm notif-cta">{p.action}</span>}
                  </div>
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
