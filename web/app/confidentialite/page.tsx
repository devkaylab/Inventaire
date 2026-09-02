import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { CONTACT_EMAIL } from '@/lib/contact'

/**
 * Politique de confidentialité, servie par le site.
 *
 * Elle vivait sur GitHub Pages (`devkaylab.github.io/Inventaire/privacy.html`).
 * Décision de Julien le 2 septembre 2026 : les communications commerciales
 * doivent porter une adresse du domaine, pas celle d'un hébergeur de code.
 *
 * ⚠️ **UNE SEULE SOURCE, et c'est le point.** Le document n'est pas recopié
 * ici : il est LU depuis `docs/privacy.html` à la construction, et son corps
 * est injecté tel quel. Recopier une politique de confidentialité, c'est
 * garantir que les deux versions divergeront — et c'est justement le document
 * où une divergence se paie. Le fichier reste donc l'original, avec sa garde
 * (`web/tests/confidentialite.test.ts`, qui refuse un sous-traitant non
 * déclaré) et son hébergement GitHub Pages.
 *
 * ⚠️ **GitHub Pages reste en ligne, et doit le rester.** Les applications
 * installées sur les téléphones pointent encore vers cette adresse
 * (`src/constants/links.ts` ne prend effet qu'au prochain build), et les
 * e-mails déjà partis aussi. On ajoute une adresse, on n'en retire pas.
 *
 * ⚠️ Page publique, donc **hors de `AppShell`** : elle s'ouvre depuis un
 * e-mail, souvent au téléphone, et l'espace connecté se ferme sous 720 px.
 */
export const metadata: Metadata = {
  title: 'Politique de confidentialité — Quantinvo',
  description:
    'Quelles données personnelles Quantinvo traite, pourquoi, avec qui elles sont partagées, '
    + 'combien de temps elles sont conservées et quels sont vos droits.',
}

/**
 * Le corps du document d'origine.
 *
 * ⚠️ Lu à la CONSTRUCTION, jamais à la requête : la page reste statique, et le
 * fichier n'a pas à exister sur le serveur qui la sert. `process.cwd()` vaut
 * `web/` pendant `next build`.
 */
function corpsDeLaPolitique(): string {
  const source = fs.readFileSync(
    path.join(process.cwd(), '..', 'docs', 'privacy.html'),
    'utf8',
  )
  const debut = source.indexOf('<body>')
  const fin = source.lastIndexOf('</body>')
  if (debut < 0 || fin < 0) {
    throw new Error('docs/privacy.html : <body> introuvable, la page ne peut pas être construite')
  }
  return source.slice(debut + '<body>'.length, fin)
}

export default function ConfidentialitePage() {
  return (
    <div className="legal-wrap">
      <header className="legal-head">
        <Link href="/" className="brand"><Logo size={38} gradientId="conf" /><span>Quantinvo</span></Link>
      </header>

      {/* Le document est injecté tel qu'il est écrit : c'est une pièce
          juridique, on ne la remet pas en forme au passage. */}
      <main className="legal" dangerouslySetInnerHTML={{ __html: corpsDeLaPolitique() }} />

      <footer className="legal-pied">
        <Link href="/">Accueil</Link>{' · '}
        <Link href="/mentions-legales">Mentions légales</Link>
        {CONTACT_EMAIL && (
          <>{' · '}<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>
        )}
      </footer>
    </div>
  )
}
