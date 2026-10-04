'use client'

// ⚠️ UN APERÇU SANS BASE À LUI N'OUVRE PAS L'APP (4 octobre 2026).
//
// Voir `lib/apercuSansBase.ts` pour le pourquoi. Ici, l'effet : au lieu de
// servir un site qui écrira dans la base des vrais clients, on sert un écran
// qui dit ce qui manque. Pas de formulaire de connexion, donc pas une seule
// écriture possible.
//
// ⚠️ CET ÉCRAN RESTE EN FRANÇAIS, et ce n'est pas un oubli d'i18n : il ne
// s'adresse jamais à un client, seulement à celui qui déploie.
//
// ⚠️ Les styles sont écrits ici, en ligne. Dépendre de `globals.css` ferait
// tenir le refus à une feuille de style qu'une refonte peut déplacer.

import { useSyncExternalStore, type ReactNode } from 'react'
import { apercuSansBase, configDeRepli, hoteEstUnApercu, porteeEstProduction } from '@/lib/apercuSansBase'

const fond: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, background: '#11161c', color: '#e8edf2',
  font: '400 16px/1.6 system-ui, sans-serif',
}

function EcranSansBase() {
  return (
    <div style={fond} role="alert">
      <div style={{ maxWidth: 520 }}>
        <p style={{ margin: '0 0 12px', font: '600 13px/1 system-ui, sans-serif', letterSpacing: '.08em', color: '#f0a97a' }}>
          APERÇU ARRÊTÉ
        </p>
        <h1 style={{ margin: '0 0 16px', font: '700 26px/1.25 system-ui, sans-serif' }}>
          Cet aperçu n’a pas de base à lui.
        </h1>
        <p style={{ margin: '0 0 16px' }}>
          Les variables <code>NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> manquent à ce déploiement. Sans
          elles, le site retombe sur le projet Supabase de <strong>production</strong> :
          tout ce qui serait fait ici s’écrirait chez les vrais clients.
        </p>
        <p style={{ margin: 0, color: '#9fb0c0' }}>
          À faire : poser les deux variables dans Vercel, <strong>portée Preview
          uniquement</strong>, puis redéployer.
        </p>
      </div>
    </div>
  )
}

/**
 * ⚠️ `useSyncExternalStore` ET PAS UN `useEffect` QUI POSE UN ÉTAT. Le serveur
 * ne connaît pas le nom d'hôte, le navigateur si : les deux rendus diffèrent
 * donc légitimement, et c'est exactement ce que ce hook sait faire — un
 * instantané pour le serveur, un pour le navigateur, sans discordance
 * d'hydratation ni rendu en cascade.
 */
const sAbonner = () => () => {}

/** Au rendu serveur, seul le signal de Vercel est lisible. */
const surLeServeur = () => apercuSansBase

/** Dans le navigateur, le nom d'hôte s'ajoute — sauf si Vercel a dit « production ». */
const dansLeNavigateur = () =>
  apercuSansBase ||
  (!porteeEstProduction && configDeRepli && hoteEstUnApercu(window.location.hostname))

export function GardeApercu({ children }: { children: ReactNode }) {
  const bloque = useSyncExternalStore(sAbonner, dansLeNavigateur, surLeServeur)

  if (bloque) return <EcranSansBase />
  return <>{children}</>
}
