import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { CHEMIN_LOGO, COULEURS, echapper, emailQuantinvo, lienSur } from '../../supabase/functions/_shared/email'

const exemple = {
  titre: 'Votre accès superviseur',
  salutation: 'Bonjour Camille,',
  paragraphes: ['Premier paragraphe.', 'Second paragraphe.'],
  details: [{ intitule: 'Magasin', valeur: 'Lyon Part-Dieu' }],
  bouton: { libelle: 'Finaliser mon compte', lien: 'https://www.quantinvo.com/bienvenue?token=abc' },
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
    expect(html.split('www.quantinvo.com/bienvenue?token=abc').length - 1).toBeGreaterThanOrEqual(2)
  })

  it('accompagne le HTML d’une version texte complète', () => {
    const { text } = emailQuantinvo(exemple)
    expect(text).toContain('QUANTINVO')
    expect(text).toContain('Magasin : Lyon Part-Dieu')
    expect(text).toContain('https://www.quantinvo.com/bienvenue?token=abc')
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
    expect(lienSur('javascript:alert(1)')).toBe('https://www.quantinvo.com')
    expect(lienSur('data:text/html,<b>x</b>')).toBe('https://www.quantinvo.com')
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
      bouton: { libelle: 'Agir', lien: 'https://www.quantinvo.com/x' },
      lienSecondaire: { libelle: 'Votre facture <F-1>', lien: 'https://invoice.stripe.com/i/abc' },
    })
    expect(html).toContain('href="https://invoice.stripe.com/i/abc"')
    expect(html).toContain('Votre facture &lt;F-1&gt;')
    expect(text).toContain('Votre facture <F-1> : https://invoice.stripe.com/i/abc')
    const refus = emailQuantinvo({ titre: 'T', paragraphes: ['p'], lienSecondaire: { libelle: 'x', lien: 'javascript:alert(1)' } })
    expect(refus.html).not.toContain('javascript:')
  })

  it('aucun message ne promet une réponse sans adresse pour la recevoir', () => {
    // Julien, 22 août 2026 : « tu dis “dites-le nous en répondant à ce
    // message”, sauf qu'on ne peut pas y répondre ». Les messages partent
    // d'une adresse d'envoi qui ne lit rien. Deux règles : tout envoi pose un
    // `reply_to` (CONTACT_EMAIL, ou un repli lu par l'appelant), et un texte
    // qui invite à écrire donne l'adresse — ou se tait.
    const racine = path.resolve(__dirname, '../../supabase/functions')
    const fonctions = readdirSync(racine).filter((d) => !d.startsWith('_'))
    for (const f of fonctions) {
      const src = readFileSync(path.join(racine, f, 'index.ts'), 'utf8')
      if (!src.includes('api.resend.com') && !src.includes('envoyerEmail(')) continue
      expect(src, `${f} : un envoi sans reply_to`).toMatch(/reply_to|envoyerEmail\(/)
      expect(src, `${f} : promet une réponse à un message qui ne se lit pas`)
        .not.toMatch(/répond(ez|re|ant) (simplement )?(à|a) (ce|notre) (message|e-mail)/i)
    }
    const page = readFileSync(path.resolve(__dirname, '../app/devis/[token]/page.tsx'), 'utf8')
    expect(page).not.toMatch(/répondez à notre/i)
    expect(page).toContain("from '@/lib/contact'")
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

/**
 * L'invitation d'un compteur (28 août 2026).
 *
 * Elle disait « Vous avez été ajouté à une équipe d'inventaire » : ni le
 * magasin, ni l'entreprise, et rien sur l'application qu'il faudra installer.
 * Le nom du responsable et celui du magasin sont les deux seules preuves, pour
 * qui reçoit ce message, qu'il est au bon endroit.
 */
describe('l’invitation d’un compteur nomme qui invite, et où l’on arrive', () => {
  const src = readFileSync(
    path.resolve(__dirname, '../../supabase/functions/invite-teammate/index.ts'),
    'utf8',
  )

  it('l’objet porte le nom de qui invite et celui du lieu', () => {
    expect(src).toContain("vous ajoute à l'équipe de ${lieu}")
    // Et il tient sans le nom du responsable, que le profil peut ne pas porter.
    expect(src).toContain("Vous rejoignez l'équipe d'inventaire de ${lieu}")
    expect(src).not.toContain("subject: 'Finalisez votre compte Quantinvo'")
  })

  it('le magasin n’est nommé que s’il y en a un seul', () => {
    // Une invitation peut porter plusieurs magasins, ou aucun — « aucun »
    // voulant dire tous ceux du superviseur. Une liste ne se lit pas dans un
    // objet d'e-mail : l'entreprise prend alors sa place.
    expect(src).toContain('if (idsPourLeNom.length === 1)')
    expect(src).toContain('const lieu = storeName ?? companyName')
  })

  it('les deux lectures viennent après les contrôles, jamais avant', () => {
    // Elles servent à écrire le message, pas à décider de l'invitation.
    const controle = src.indexOf("code: 'other_company'")
    const lecture = src.indexOf("from('stores')")
    expect(controle).toBeGreaterThan(-1)
    expect(lecture).toBeGreaterThan(controle)
  })

  it('elle annonce l’application, et ne donne aucun lien de boutique', () => {
    expect(src).toContain("installer l'application Quantinvo sur votre téléphone")
    // Deux gestes concurrents dans un message qui n'en veut qu'un — et un lien
    // mort tant que l'application n'est pas publiée. La boutique est sur
    // /bienvenue, après le mot de passe.
    expect(src).not.toMatch(/apps\.apple|play\.google/)
  })

  it('l’identifiant figure dans l’encadré de faits', () => {
    // C'est ce que la personne devra retaper dans l'application.
    expect(src).toContain("{ intitule: 'Votre identifiant', valeur: email }")
  })
})
