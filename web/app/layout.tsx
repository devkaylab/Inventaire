import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Sora } from 'next/font/google'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import './globals.css'

// Applique le thème (clair/sombre/système) AVANT le premier affichage,
// pour éviter tout clignotement.
const THEME_INIT = `(function(){try{var p=localStorage.getItem('quantinvo-theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' })
const sora = Sora({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-sora', display: 'swap' })

export const metadata: Metadata = {
  title: "Quantinvo — Outil d'inventaire",
  description:
    "Quantinvo : l'application d'inventaire pour compter, auditer et fiabiliser vos stocks en magasin. Scan rapide, zones & balises, rapports d'écarts.",
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
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
