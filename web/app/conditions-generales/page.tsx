import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Fragment } from 'react'
import { Logo } from '@/components/Logo'
import { CONTACT_EMAIL } from '@/lib/contact'
import { NoteVersionFrancaise } from '@/components/NoteVersionFrancaise'
import { blocs, passagePublie, VERSION_CONDITIONS, type Segment } from '@/lib/conditions'

/**
 * Conditions générales de vente et d'utilisation (16 septembre 2026).
 *
 * ⚠️ Elles étaient écrites mais publiées NULLE PART, et aucun écran ne les
 * faisait accepter : l'article 3 décrivait une acceptation que le produit ne
 * recueillait pas. Cette page et la case de `AccepterConditions` ferment ce
 * trou ensemble.
 *
 * ⚠️ UNE SEULE SOURCE : le fichier du dépôt est lu à la CONSTRUCTION, comme la
 * politique de confidentialité. `passagePublie` refuse de construire si une
 * note interne traîne dans le passage publié.
 *
 * Page publique, hors d'`AppShell` : on la lit depuis le parcours d'achat,
 * souvent au téléphone.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/conditions-generales' },
  title: 'Conditions générales de vente et d’utilisation',
  description: 'Les conditions qui régissent la souscription et l’utilisation de Quantinvo.',
}

function texteDesConditions(): string {
  const source = fs.readFileSync(
    path.join(process.cwd(), '..', 'docs', 'entreprise', 'cgv-quantinvo-brouillon.md'),
    'utf8',
  )
  return passagePublie(source)
}

function Texte({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => (s.gras ? <strong key={i}>{s.texte}</strong> : <Fragment key={i}>{s.texte}</Fragment>))}
    </>
  )
}

const dateLisible = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export default function ConditionsGeneralesPage() {
  const contenu = blocs(texteDesConditions())
  return (
    <div className="legal-wrap">
      <header className="legal-head">
        <Link href="/" className="brand"><Logo size={38} gradientId="cgv" /><span>Quantinvo</span></Link>
      </header>

      <main className="legal">
        <NoteVersionFrancaise />
        <h1>Conditions générales de vente et d’utilisation</h1>
        <p className="meta">Version du {dateLisible(VERSION_CONDITIONS)}</p>

        {contenu.map((b, i) => {
          if (b.type === 'titre') return <h2 key={i}>{b.texte}</h2>
          if (b.type === 'paragraphe') return <p key={i}><Texte segments={b.segments} /></p>
          if (b.type === 'liste') {
            return <ul key={i}>{b.items.map((it, j) => <li key={j}><Texte segments={it} /></li>)}</ul>
          }
          return (
            <div className="wrap" key={i}>
              <table>
                <thead>
                  <tr>{b.entete.map((c, j) => <th key={j}><Texte segments={c} /></th>)}</tr>
                </thead>
                <tbody>
                  {b.lignes.map((l, j) => (
                    <tr key={j}>{l.map((c, k) => <td key={k}><Texte segments={c} /></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </main>

      <footer className="legal-pied">
        <Link href="/">Accueil</Link>{' · '}
        <Link href="/confidentialite">Confidentialité</Link>{' · '}
        <Link href="/mentions-legales">Mentions légales</Link>
        {CONTACT_EMAIL && (
          <>{' · '}<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>
        )}
      </footer>
    </div>
  )
}
