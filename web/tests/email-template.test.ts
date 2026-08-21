import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { COULEURS, echapper, emailQuantinvo, lienSur } from '../../supabase/functions/_shared/email'

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

  it('reste du HTML d’e-mail : tableaux, styles en ligne, aucune ressource distante', () => {
    const { html } = emailQuantinvo(exemple)
    expect(html).toContain('role="presentation"')
    expect(html).not.toMatch(/<img/i)
    expect(html).not.toMatch(/<link/i)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/display:\s*flex/i)
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
