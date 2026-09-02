import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Sora } from 'next/font/google'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { OrganisationJsonLd } from '@/components/DonneesStructurees'
import { SITE_URL } from '@/lib/site'
import './globals.css'

// Applique le thème (clair/sombre/système) AVANT le premier affichage,
// pour éviter tout clignotement.
const THEME_INIT = `(function(){try{var p=localStorage.getItem('quantinvo-theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' })
const sora = Sora({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-sora', display: 'swap' })

/**
 * ⚠️ `metadataBase` n'est pas un détail : sans elle, Next rend les adresses
 * d'`openGraph.images` et des balises canoniques en **relatif**, et un aperçu
 * de partage ne peut alors pas charger l'image. Elle porte le `www`, l'origine
 * canonique — voir `lib/site.ts`.
 *
 * Le `title.template` évite d'écrire « — Quantinvo » à la main sur chaque
 * page ; `default` sert l'accueil, qui n'a pas de titre propre.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Quantinvo — l'outil d'inventaire pour le commerce de détail",
    template: '%s — Quantinvo',
  },
  description:
    "Comptez vos stocks en magasin avec le téléphone de vos équipes : balises QR imprimées, scan des codes-barres, seconde passe d'audit et rapport d'écarts exportable. Fonctionne sans réseau en réserve.",
  applicationName: 'Quantinvo',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Quantinvo',
    url: SITE_URL,
    title: "Quantinvo — l'outil d'inventaire pour le commerce de détail",
    description:
      "La fiabilité du stock au quotidien : comptage au téléphone, audit en seconde passe, rapport d'écarts.",
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Quantinvo — la fiabilité du stock au quotidien' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Quantinvo — l'outil d'inventaire pour le commerce de détail",
    description:
      "La fiabilité du stock au quotidien : comptage au téléphone, audit en seconde passe, rapport d'écarts.",
    images: ['/og.png'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <OrganisationJsonLd />
        <ToastProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </ToastProvider>
        <ThemeToggle />
      </body>
    </html>
  )
}
