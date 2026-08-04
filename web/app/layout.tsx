import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: "Quantinvo — Outil d'inventaire",
  description:
    "Quantinvo : l'application d'inventaire pour compter, auditer et fiabiliser vos stocks en magasin. Scan rapide, zones & balises, rapports d'écarts.",
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
