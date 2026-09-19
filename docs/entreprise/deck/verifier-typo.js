// Contrôle typographique d'un deck, sur le RENDU et non sur le script.
//
// Demande de Julien, 19 septembre 2026 : « pas de mots coupés à la ligne, ni
// de . , : au début d'une deuxième ligne ». `charte.js` rend insécables les
// espaces qui précèdent un signe ; ce contrôle vérifie l'effet, là où il se
// voit : chaque page convertie en PDF par LibreOffice, puis lue ligne à ligne.
//
//   node verifier-typo.js Quantinvo-commercial.pptx [autres.pptx…]
//
// Pour chaque deck : `verif/<nom>/<nom>.pdf`, une image par page
// (`verif/<nom>/page-N.png`) à regarder, et la liste des défauts. Le code de
// sortie vaut 1 s'il y en a un seul.
//
// ⚠️ LibreOffice compose presque comme PowerPoint, pas exactement : une ligne
// peut casser un mot plus tôt ou plus tard. Le contrôle attrape les fautes de
// TEXTE (une espace ordinaire avant un signe, un mot coupé par un tiret) ;
// l'œil sur les images reste nécessaire pour ce qui déborde.

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DEBUT_INTERDIT = /^[.,;:!?»)\]…%€—]/
const fichiers = process.argv.slice(2)
if (!fichiers.length) {
  console.error('usage : node verifier-typo.js <deck.pptx> [...]')
  process.exit(2)
}

let defauts = 0
for (const f of fichiers) {
  const nom = path.basename(f, '.pptx')
  const dossier = path.join(__dirname, 'verif', nom)
  fs.rmSync(dossier, { recursive: true, force: true })
  fs.mkdirSync(dossier, { recursive: true })
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dossier, path.resolve(f)], { stdio: 'ignore' })
  const pdf = path.join(dossier, nom + '.pdf')
  execFileSync('pdftoppm', ['-r', '60', '-png', pdf, path.join(dossier, 'page')])
  const pages = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-']).toString('utf8').split('\f')
  // ⚠️ LE MOT COUPÉ SANS TIRET : une boîte trop étroite pour un mot le casse
  // n'importe où (« anticonstitutionnel / lement »), sans aucun signe. On le
  // reconnaît en recollant la fin d'une ligne au début de la suivante : si ça
  // donne un mot du deck et que les deux morceaux n'en sont pas, c'est une
  // coupure. Le vocabulaire vient du texte même des diapositives.
  const xml = execFileSync('sh', ['-c', `unzip -p "${path.resolve(f)}" 'ppt/slides/slide*.xml'`], { maxBuffer: 64 << 20 }).toString('utf8')
  const vocab = new Set((xml.replace(/<[^>]+>/g, ' ').toLowerCase().match(/[a-zà-ÿœæ0-9’'-]+/g) ?? []))
  const trouves = []
  pages.forEach((texte, i) => {
    const lignes = texte.split('\n').map((l) => l.trim()).filter(Boolean)
    lignes.forEach((l, j) => {
      if (DEBUT_INTERDIT.test(l)) trouves.push(`page ${i + 1} : ligne qui commence par un signe — « ${l.slice(0, 60)} »`)
      const suivante = lignes[j + 1]
      if (/[a-zà-ÿ]-$/i.test(l) && suivante && /^[a-zà-ÿ]/.test(suivante)) {
        trouves.push(`page ${i + 1} : mot coupé — « …${l.slice(-25)} / ${suivante.slice(0, 25)}… »`)
      }
      if (suivante) {
        const fin = (l.toLowerCase().match(/[a-zà-ÿœæ0-9’'-]+$/) ?? [''])[0]
        const debut = (suivante.toLowerCase().match(/^[a-zà-ÿœæ0-9’'-]+/) ?? [''])[0]
        if (fin && debut && vocab.has(fin + debut) && !(vocab.has(fin) && vocab.has(debut))) {
          trouves.push(`page ${i + 1} : mot coupé — « ${fin} / ${debut} »`)
        }
      }
    })
  })
  console.log(`\n${nom} — ${pages.filter((p) => p.trim()).length} pages, ${trouves.length} défaut(s)`)
  for (const t of trouves) console.log('  ' + t)
  console.log(`  images : ${dossier}/page-*.png`)
  defauts += trouves.length
}
process.exit(defauts ? 1 : 0)
