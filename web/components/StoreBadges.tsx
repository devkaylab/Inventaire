// Les deux boutons de téléchargement de l'application mobile.
//
// Dessinés à nos couleurs plutôt qu'en reprenant les images de marque
// d'Apple et de Google : elles sont soumises à leurs chartes, et un bouton
// maison reste cohérent avec le reste du site. Les logos, eux, sont des
// tracés SVG — jamais d'emoji.
//
// Les adresses vivent dans `lib/appStores.ts`, un seul endroit à modifier le
// jour de la publication.

import { APP_STORE_URL, PLAY_STORE_URL, PUBLIEE } from '@/lib/appStores'

export function StoreBadges() {
  return (
    <div className="boutiques">
      <div className="boutiques-row">
        <a
          className="store-badge"
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <AppleIcon />
          <span className="store-badge-txt">
            <span className="store-badge-sur">Télécharger sur</span>
            <span className="store-badge-nom">l’App Store</span>
          </span>
        </a>

        <a
          className="store-badge"
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <PlayIcon />
          <span className="store-badge-txt">
            <span className="store-badge-sur">Disponible sur</span>
            <span className="store-badge-nom">Google Play</span>
          </span>
        </a>
      </div>

      {!PUBLIEE && (
        <p className="boutiques-note">
          L’application arrive bientôt sur les deux boutiques. En attendant, ces
          liens ouvrent la recherche.
        </p>
      )}
    </div>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.66c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.14.83-1.22 1.18-2.41 1.2-2.47-.03-.01-2.29-.88-2.31-3.49z" />
      <path d="M14.86 6.19c.6-.73.99-1.75.88-2.76-.86.04-1.9.57-2.51 1.29-.55.64-1.03 1.68-.9 2.67.96.07 1.94-.49 2.53-1.2z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M3.4 1.9a1 1 0 0 0-.4.8v18.6a1 1 0 0 0 .4.8l9.7-10.1L3.4 1.9z" />
      <path d="M16.9 8.2 5.1 1.4a1 1 0 0 0-.5-.14l9.2 9.55 3.1-2.61z" />
      <path d="M16.9 15.8l-3.1-2.61-9.2 9.55a1 1 0 0 0 .5-.14l11.8-6.8z" />
      <path d="M20.7 10.9 18.2 9.5l-3.3 2.5 3.3 2.5 2.5-1.4a1.26 1.26 0 0 0 0-2.2z" />
    </svg>
  )
}
