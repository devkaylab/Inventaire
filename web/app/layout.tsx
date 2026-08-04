import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter, Sora } from 'next/font/google'
import './globals.css'

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
    <html lang="fr" className={`${inter.variable} ${sora.variable}`}>
      <body>{children}</body>
    </html>
  )
}
