'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LIENS_PUBLICS } from '@/lib/navigation'
import { venteOuverte } from '@/lib/legal'

/**
 * Le menu de la barre publique sur un téléphone.
 *
 * ⚠️ IL COMBLE UN TROU, IL N'EMBELLIT RIEN. Sous 780 px, `.nav-links` passait
 * en `display: none` et les quatre liens du site — Pourquoi nous choisir,
 * L'inventaire, Fonctionnalités, Tarifs — DISPARAISSAIENT sans remplacement :
 * un visiteur sur téléphone ne pouvait atteindre aucune page intérieure
 * autrement qu'en devinant les adresses. Relevé le 5 septembre 2026.
 *
 * La forme est celle de Qonto, mesurée sur sa version mobile le même jour :
 *
 * - le panneau prend TOUT L'ÉCRAN sous la barre, il ne pend pas dessous. Un
 *   menu court laisse voir la page derrière et se lit comme une infobulle ;
 *   plein, il devient un écran à part entière, et les liens peuvent grossir ;
 * - les liens sont GRANDS, avec un chevron. C'est ce qui les distingue des
 *   deux actions du bas — on parcourt en haut, on agit en bas ;
 * - les DEUX ACTIONS sont en pied, dans leurs rangs respectifs : le bouton
 *   plein sur toute la largeur, puis « Se connecter » en lien souligné ;
 * - ⚠️ et le bouton de la barre S'EFFACE tant que le menu est ouvert. Il est
 *   déjà dans le panneau : le laisser en haut, c'est le même geste offert
 *   deux fois à trente centimètres d'écart.
 */
export function MenuMobile() {
  const [ouvert, setOuvert] = useState(false)
  const chemin = usePathname()
  const panneau = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)

  // Naviguer referme : sans cela, le panneau reste ouvert par-dessus la page
  // d'arrivée, et on croit que le lien n'a pas marché.
  useEffect(() => { setOuvert(false) }, [chemin])

  useEffect(() => {
    // ⚠️ La classe vit sur <html>, pas sur le composant : c'est elle qui efface
    // le bouton de la barre et bloque le défilement de la page derrière le
    // panneau. Retirée au démontage, sinon une page quittée menu ouvert
    // laisserait le document verrouillé.
    const racine = document.documentElement
    racine.classList.toggle('menu-ouvert', ouvert)
    if (!ouvert) return

    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOuvert(false); bouton.current?.focus() }
    }
    const ailleurs = (e: MouseEvent) => {
      const cible = e.target as Node
      if (!panneau.current?.contains(cible) && !bouton.current?.contains(cible)) setOuvert(false)
    }
    document.addEventListener('keydown', auClavier)
    document.addEventListener('mousedown', ailleurs)
    return () => {
      racine.classList.remove('menu-ouvert')
      document.removeEventListener('keydown', auClavier)
      document.removeEventListener('mousedown', ailleurs)
    }
  }, [ouvert])

  return (
    <>
      <button
        ref={bouton}
        type="button"
        className="burger"
        aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        onClick={() => setOuvert((v) => !v)}
      >
        {/* Trois traits, dessinés : à cette taille un caractère ne se lit plus. */}
        <span className={ouvert ? 'burger-traits ouvert' : 'burger-traits'} aria-hidden="true">
          <i /><i /><i />
        </span>
      </button>

      <div id="menu-mobile" ref={panneau} className="menu-mobile" hidden={!ouvert}>
        <nav className="menu-mobile-liens">
          {LIENS_PUBLICS.map((l) => (
            <Link href={l.href} key={l.href}>
              {l.libelle}
              <span className="menu-chevron" aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <div className="menu-mobile-actions">
          <Link href="/inscription" className="btn btn-primary btn-block">
            {venteOuverte() ? 'Inscrire mon entreprise' : 'Nous écrire'}
          </Link>
          <Link href="/login" className="menu-mobile-connexion">Se connecter</Link>
        </div>
      </div>
    </>
  )
}
