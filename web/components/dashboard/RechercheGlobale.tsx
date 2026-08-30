'use client'

// Recherche du tableau de bord : inventaires et équipe, dans le même champ.
//
// Pas de nouvelle fonction serveur : elle interroge les DEUX RPC que les
// pages elles-mêmes utilisent (`getAccessibleSessions`, `my_team_by_store`),
// une seule fois, au premier focus — puis filtre sur place. Aux volumes d'un
// superviseur (quelques dizaines de lignes), un aller-retour par frappe
// n'apporterait que de la latence ; le jour où un compte dépasse ça, c'est
// une RPC de recherche qu'il faudra écrire, pas un debounce.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { getAccessibleSessions, type Session } from '@/lib/inventory'

type Personne = { id: string; nom: string; email: string | null; magasin: string }

export function RechercheGlobale() {
  const router = useRouter()
  const [texte, setTexte] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [equipe, setEquipe] = useState<Personne[] | null>(null)
  const boiteRef = useRef<HTMLDivElement>(null)

  // Le premier focus charge les deux listes ; les suivants réutilisent.
  function precharger() {
    if (sessions === null) {
      getAccessibleSessions().then(setSessions).catch(() => setSessions([]))
    }
    if (equipe === null) {
      supabase.rpc('my_team_by_store').then(({ data, error }) => {
        if (error || !data) { setEquipe([]); return }
        const rangs: Personne[] = []
        for (const s of (data.stores ?? []) as { name: string; counters: { id: string; full_name: string | null; email: string | null }[] }[]) {
          for (const c of s.counters ?? []) {
            rangs.push({ id: c.id, nom: c.full_name ?? '', email: c.email, magasin: s.name })
          }
        }
        setEquipe(rangs)
      })
    }
  }

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

  const q = texte.trim().toLowerCase()
  const inventaires = useMemo(() => {
    if (q.length < 2 || !sessions) return []
    return sessions.filter(s =>
      (s.name || '').toLowerCase().includes(q)
      || s.store_name.toLowerCase().includes(q)
      || s.inventory_number.toLowerCase().includes(q)).slice(0, 5)
  }, [q, sessions])
  const membres = useMemo(() => {
    if (q.length < 2 || !equipe) return []
    return equipe.filter(m =>
      m.nom.toLowerCase().includes(q)
      || (m.email ?? '').toLowerCase().includes(q)
      || m.magasin.toLowerCase().includes(q)).slice(0, 5)
  }, [q, equipe])

  const enCharge = q.length >= 2 && (sessions === null || equipe === null)

  function aller(lien: string) {
    setOuvert(false)
    setTexte('')
    router.push(lien)
  }

  return (
    <div className="tb-recherche" ref={boiteRef}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        value={texte}
        placeholder="Rechercher un inventaire, un membre…"
        aria-label="Rechercher un inventaire ou un membre de l’équipe"
        onFocus={() => { precharger(); setOuvert(true) }}
        onChange={(e) => { setTexte(e.target.value); setOuvert(true) }}
      />

      {ouvert && q.length >= 2 && (
        <div className="tb-recherche-resultats" role="listbox" aria-label="Résultats">
          {enCharge ? (
            <div className="tb-recherche-vide">Recherche…</div>
          ) : inventaires.length === 0 && membres.length === 0 ? (
            <div className="tb-recherche-vide">Rien ne correspond à « {texte.trim()} ».</div>
          ) : (
            <>
              {inventaires.length > 0 && <div className="tb-recherche-groupe">Inventaires</div>}
              {inventaires.map(s => (
                <button type="button" className="tb-recherche-rang" key={s.id} onClick={() => aller(`/dashboard/${s.id}`)}>
                  <span className="tb-recherche-nom">{s.name || s.store_name}</span>
                  <span className="tb-recherche-sous">{s.store_name} · <span className="num">{s.inventory_number}</span></span>
                </button>
              ))}
              {membres.length > 0 && <div className="tb-recherche-groupe">Équipe</div>}
              {membres.map(m => (
                <button type="button" className="tb-recherche-rang" key={m.id} onClick={() => aller('/equipe')}>
                  <span className="tb-recherche-nom">{m.nom || m.email || '—'}</span>
                  <span className="tb-recherche-sous">{m.magasin}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
