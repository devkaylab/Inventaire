import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { CHEMIN_LOGO, COULEURS, echapper, emailQuantinvo, lienSur } from '../../supabase/functions/_shared/email'

const exemple = {
  titre: 'Votre accès superviseur',
  salutation: 'Bonjour Camille,',
  paragraphes: ['Premier paragraphe.', 'Second paragraphe.'],
  details: [{ intitule: 'Magasin', valeur: 'Lyon Part-Dieu' }],
  bouton: { libelle: 'Finaliser mon compte', lien: 'https://quantinvo.vercel.app/bienvenue?token=abc' },
  note: 'Ce lien est personnel et à usage unique.',
  raison: 'Vous recevez ce message parce que…',
}

describe('Gabarit d’e-mail — charte', () => {
  it('pose la palette Papier : fond blanc, filet de scan cyan, bouton indigo', () => {
    const { html } = emailQuantinvo(exemple)
    expect(html).toContain(COULEURS.blanc)
    expect(html).toContain(COULEURS.cyan)
    expect(html).toContain(COULEURS.indigo)
    // La direction sombre du site n'a pas cours dans un e-mail (règle « Papier »).
    expect(html).not.toContain('#151a27')
  })

  it('reste du HTML d’e-mail : tableaux, styles en ligne, pas de feuille ni de script', () => {
    const { html } = emailQuantinvo(exemple)
    expect(html).toContain('role="presentation"')
    expect(html).not.toMatch(/<link/i)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/display:\s*flex/i)
  })

  it('porte le logo, en PNG servi par le site, et le nom en texte à côté', () => {
    const { html } = emailQuantinvo({ ...exemple, siteUrl: 'https://quantinvo.com' })
    const images = html.match(/<img[^>]*>/gi) ?? []
    expect(images).toHaveLength(1)
    expect(images[0]).toContain(`src="https://quantinvo.com${CHEMIN_LOGO}"`)
    // Gmail retire les SVG et bloque les `data:` : le logo doit rester un
    // fichier servi en http(s).
    expect(images[0]).not.toMatch(/\.svg|data:/i)
    // `alt` vide, parce que le mot-symbole est déjà en texte juste à côté :
    // images coupées, la marque se lit quand même, et sans doublon.
    expect(images[0]).toMatch(/alt=""/)
    expect(html).toContain('>Quantinvo</span>')
  })

  it('sert le logo depuis la même racine que le reste — un seul point à changer', () => {
    const { html } = emailQuantinvo({ ...exemple, siteUrl: 'https://apercu.quantinvo.com' })
    expect(html).toContain(`src="https://apercu.quantinvo.com${CHEMIN_LOGO}"`)
  })

  it('le fichier du logo existe bien là où le gabarit va le chercher', () => {
    const fichier = path.resolve(__dirname, '../public', CHEMIN_LOGO.replace(/^\//, ''))
    expect(existsSync(fichier)).toBe(true)
    expect(readFileSync(fichier).subarray(1, 4).toString()).toBe('PNG')
  })

  it('rend tout le contenu demandé, bouton et lien en clair compris', () => {
    const { html } = emailQuantinvo(exemple)
    for (const attendu of [exemple.titre, exemple.salutation, ...exemple.paragraphes, exemple.note, exemple.raison]) {
      expect(html).toContain(attendu.replace(/'/g, '&#39;'))
    }
    expect(html).toContain('Lyon Part-Dieu')
    // Le lien apparaît deux fois : sur le bouton, et en clair pour les
    // messageries qui n'affichent pas les boutons.
    expect(html.split('quantinvo.vercel.app/bienvenue?token=abc').length - 1).toBeGreaterThanOrEqual(2)
  })

  it('accompagne le HTML d’une version texte complète', () => {
    const { text } = emailQuantinvo(exemple)
    expect(text).toContain('QUANTINVO')
    expect(text).toContain('Magasin : Lyon Part-Dieu')
    expect(text).toContain('https://quantinvo.vercel.app/bienvenue?token=abc')
    expect(text).not.toMatch(/<[a-z]/i)
  })
})

describe('Gabarit d’e-mail — sûreté', () => {
  it('échappe les valeurs venues de la base', () => {
    const { html } = emailQuantinvo({
      titre: 'Bonjour',
      paragraphes: ['Magasin « <img src=x onerror=alert(1)> »'],
      details: [{ intitule: 'Magasin', valeur: '"><b>gras</b>' }],
    })
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>gras</b>')
    expect(html).toContain('&lt;img src=x')
  })

  it('refuse un lien qui n’est pas http(s)', () => {
    expect(lienSur('javascript:alert(1)')).toBe('https://quantinvo.vercel.app')
    expect(lienSur('data:text/html,<b>x</b>')).toBe('https://quantinvo.vercel.app')
    expect(lienSur('https://exemple.fr/ok')).toBe('https://exemple.fr/ok')
  })

  it('échappe les guillemets, sans quoi un attribut se refermerait', () => {
    expect(echapper('a"b')).toBe('a&quot;b')
  })
})

describe('Fonctions edge — un seul gabarit', () => {
  const dossier = path.resolve(__dirname, '../../supabase/functions')
  const envoyeuses = readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => ({ nom: e.name, source: readFileSync(path.join(dossier, e.name, 'index.ts'), 'utf8') }))
    .filter((f) => f.source.includes('api.resend.com'))

  it('rend un lien secondaire sous le bouton, échappé, http(s) seulement', () => {
    // La facture Stripe à côté de « Créer mon accès » : un lien, pas un second
    // bouton. Un seul geste par message.
    const { html, text } = emailQuantinvo({
      titre: 'T', paragraphes: ['p'],
      bouton: { libelle: 'Agir', lien: 'https://quantinvo.vercel.app/x' },
      lienSecondaire: { libelle: 'Votre facture <F-1>', lien: 'https://invoice.stripe.com/i/abc' },
    })
    expect(html).toContain('href="https://invoice.stripe.com/i/abc"')
    expect(html).toContain('Votre facture &lt;F-1&gt;')
    expect(text).toContain('Votre facture <F-1> : https://invoice.stripe.com/i/abc')
    const refus = emailQuantinvo({ titre: 'T', paragraphes: ['p'], lienSecondaire: { libelle: 'x', lien: 'javascript:alert(1)' } })
    expect(refus.html).not.toContain('javascript:')
  })

  it('trouve bien les fonctions qui envoient des e-mails', () => {
    expect(envoyeuses.length).toBeGreaterThanOrEqual(4)
  })

  for (const f of envoyeuses) {
    it(`${f.nom} compose son message avec emailQuantinvo`, () => {
      expect(f.source).toContain("from '../_shared/email.ts'")
      expect(f.source).toContain('emailQuantinvo({')
      // Plus de HTML écrit à la main dans les fonctions : la charte se change
      // en un seul point.
      expect(f.source).not.toMatch(/const html = `\s*<(div|table|!doctype)/i)
    })

    it(`${f.nom} envoie aussi la version texte à Resend`, () => {
      expect(f.source).toMatch(/html,\s*\n?\s*text,|html,\s*text\s*\}/)
    })
  }
})
