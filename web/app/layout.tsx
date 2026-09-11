import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Archivo, Public_Sans } from 'next/font/google'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { LangueProvider } from '@/lib/i18n'
import { OrganisationJsonLd } from '@/components/DonneesStructurees'
import { SITE_URL } from '@/lib/site'
import './globals.css'

// Applique le thème (clair/sombre/système) AVANT le premier affichage,
// pour éviter tout clignotement.
/**
 * ⚠️ `<html lang>` est rendu « fr » par le serveur pour toutes les pages : le
 * layout racine ne connaît pas l'adresse. Sous `/en`, ce script le corrige
 * avant le premier affichage — comme le thème juste après. Les moteurs, eux,
 * lisent les balises `hreflang` de chaque page (voir `lib/metaVitrine.ts`),
 * qui font foi sur la langue.
 */
const LANG_INIT = `(function(){try{var p=location.pathname;if(p==='/en'||p.indexOf('/en/')===0){document.documentElement.lang='en';}}catch(e){}})();`

const THEME_INIT = `(function(){try{var p=localStorage.getItem('quantinvo-theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`

/**
 * ⚠️ LES DEUX POLICES SONT AUTO-HÉBERGÉES PAR `next/font`, et ce n'est pas un
 * détail de performance : c'est ce qui fait qu'aucune requête ne part chez
 * Google au chargement d'une page. La politique de confidentialité s'appuie
 * dessus (« aucun traceur, aucune mesure d'audience »). Ne jamais remplacer
 * par un `<link href="fonts.googleapis.com">`.
 *
 * Piste « Ardoise », 6 septembre 2026. Inter et Sora sont parties : ce sont
 * les deux valeurs par défaut de l'époque, et c'est précisément ce qui donnait
 * au produit son air de gabarit.
 *
 * - **Archivo** porte les titres et les nombres. C'est un grotesque de
 *   signalétique, un peu étroit : à 38 px il tient sur une ligne là où une
 *   grotesque large déborde, et ses chiffres tabulaires alignent les colonnes
 *   d'un rapport.
 * - **Public Sans** porte le texte courant. Elle a été dessinée pour le
 *   service public américain — lisible, sobre, sans manière.
 */
const titre = Archivo({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--police-titre', display: 'swap' })
const texte = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--police-texte', display: 'swap' })


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
    <html lang="fr" className={`${texte.variable} ${titre.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: LANG_INIT }} />
        <OrganisationJsonLd />
        {/* La langue de l'espace connecté se relit APRÈS l'hydratation (voir
            lib/i18n.tsx) : le serveur rend en français, le navigateur aussi au
            premier passage, puis la préférence s'applique. La vitrine, elle,
            n'appelle pas ce module et reste en français. */}
        <LangueProvider>
          <ToastProvider>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </ToastProvider>
        </LangueProvider>
        <ThemeToggle />
      </body>
    </html>
  )
}
