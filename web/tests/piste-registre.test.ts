// « Registre » — les surfaces qui font foi.
//
// ⚠️ LE FICHIER S'APPELLE `piste-registre`, PAS `registre`, ET C'EST UNE
// CICATRICE. `web/tests/registre.test.ts` existe déjà : il garde la
// consultation du **registre public** des entreprises (`lib/registre.ts`,
// recherche par SIREN). Je l'ai écrasé en écrivant celui-ci. Le mot est
// surchargé trois fois dans ce dépôt — le registre public, la piste graphique,
// et une classe CSS `.registre` qui était morte et qui a teinté le rapport en
// vert d'eau le temps qu'on la trouve. Avant de nommer quoi que ce soit
// « registre », vérifier ce qui porte déjà ce nom.
//
// Piste validée avec Ardoise le 6 septembre 2026, périmètre tranché par
// Julien : le rapport d'un inventaire, les écarts d'audit, le rapport
// consolidé d'un magasin, le devis PDF et les exports.
//
// Ces gardes ne figent pas un dessin — elles figent les quatre décisions qui
// le portent, et la frontière avec Ardoise. Un dessin se retouche ; une
// frontière effacée ne se remarque pas.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const css = lire('../app/globals.css')
const layout = lire('../app/layout.tsx')
const polices = lire('../lib/policesRegistre.ts')
const shell = lire('../components/AppShell.tsx')
const devis = lire('../../supabase/functions/_shared/devis.ts')
const devisPdf = lire('../../supabase/functions/_shared/devisPdf.ts')
const rapportSite = lire('../lib/report.ts')
const rapportApp = lire('../../src/lib/report.ts')

/** Le code sans ses commentaires — une garde d'absence se lirait elle-même. */
const code = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

/** Le bloc Registre de la feuille de style, commentaires retirés. */
const blocRegistre = (() => {
  const marqueur = css.indexOf('REGISTRE — les trois surfaces qui font foi')
  expect(marqueur, 'le bloc Registre a disparu de la feuille de style').toBeGreaterThan(0)
  // ⚠️ ON REMONTE AU `/*` OUVRANT, sinon on tranche AU MILIEU du commentaire
  // d'en-tête : le dépouilleur ne voit plus son ouverture et laisse tout le
  // reste du commentaire en clair — ce commentaire cite justement les couleurs
  // qu'on a retirées, pour dire qu'on ne les remet pas. La garde se lisait
  // elle-même. C'est la neuvième fois que ce piège se présente sur ce dépôt.
  return code(css.slice(css.lastIndexOf('/*', marqueur)))
})()

describe('Registre — le périmètre', () => {
  it('⚠️ trois surfaces le portent, et elles seules', () => {
    // ⚠️ LA GARDE DÉDUIT SA LISTE, ELLE NE LA CITE PAS EN AMONT : elle balaie
    // `app/` et `components/`, retient tout fichier qui pose la classe, et
    // compare à ce qui a été décidé. Un quatrième écran qui s'y mettrait — un
    // tableau de bord, un écran d'équipe — se signalerait tout seul, et c'est
    // exactement ce qui empêche « deux identités » de devenir « deux
    // produits » : Registre s'arrête où l'on cesse de lire pour faire.
    const porteurs: string[] = []
    const balayer = (dossier: string) => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const f = path.join(dossier, e.name)
        if (e.isDirectory()) balayer(f)
        else if (f.endsWith('.tsx') && /className="registre"/.test(readFileSync(f, 'utf8'))) {
          porteurs.push(path.relative(path.resolve(__dirname, '..'), f))
        }
      }
    }
    balayer(path.resolve(__dirname, '../app'))
    balayer(path.resolve(__dirname, '../components'))

    expect(porteurs.sort()).toEqual([
      'app/magasins/[storeId]/rapport/page.tsx',
      'components/dashboard/tabs/EcartsTab.tsx',
      'components/dashboard/tabs/RapportTab.tsx',
    ])
  })

  it('⚠️ il habille ce qu’on lit, il n’éteint pas ce qui engage', () => {
    // Les deux boutons de passe portent le vert du comptage et l'or de l'audit
    // depuis le 29 août — les mêmes que dans l'application. Un écran où l'on
    // tranche garde ses boutons colorés, quelle que soit l'identité de la page
    // qui les entoure. Registre ne redéfinit donc jamais leurs couleurs.
    for (const classe of ['btn-compteur', 'btn-auditeur']) {
      expect(blocRegistre, `Registre reteint ${classe} : c'est un geste, pas une lecture`)
        .not.toMatch(new RegExp(`\\.registre[^{]*\\.${classe}[^{]*\\{[^}]*(background|color)`))
    }
  })
})

describe('Registre — les quatre décisions', () => {
  it('⚠️ décision 1 : la grammaire, pas le papier — rien n’est peint en sombre', () => {
    // La palette de Registre est crème. Posée telle quelle dans la coquille
    // sombre, elle donnerait un rectangle blanc de 1 400 px au milieu de
    // l'écran qu'on regarde le plus longtemps de la journée. Le fond ne bouge
    // donc QUE sous le thème clair.
    const fonds = blocRegistre.match(/^[^\n]*\.registre[^\n]*background:[^\n]*$/gm) ?? []
    expect(fonds.length, 'plus aucune règle de fond : la garde ne garde rien').toBeGreaterThan(0)
    for (const regle of fonds) {
      if (/#f|rgb/i.test(regle) && !/transparent/.test(regle)) {
        expect(regle, 'un fond de Registre hors du thème clair').toMatch(/data-theme="light"/)
      }
    }
  })

  it('⚠️ décision 2 : aucun accent à l’écran, le marine ne vit que sur le document', () => {
    // #1D3E63 donne 1,6:1 sur le fond sombre — très loin du seuil AA. Il ne
    // sert que sur le devis PDF, qui n'a pas de thème.
    expect(blocRegistre.toLowerCase(), 'le marine de Registre est entré dans la feuille de style')
      .not.toContain('1d3e63')
    expect(blocRegistre, 'Registre s’est donné un accent : à l’écran il n’y a que de l’encre')
      .not.toMatch(/\.registre[^{]*\{[^}]*var\(--accent\)/)
    expect(devis, 'le marine a quitté le devis').toContain("marine: '#1d3e63'")
  })

  it('⚠️ décision 3 : les deux polices sont AUTO-HÉBERGÉES', () => {
    // La politique de confidentialité s'appuie dessus : aucune requête ne part
    // chez Google au chargement d'une page.
    expect(polices).toContain('Newsreader')
    expect(polices).toContain('IBM_Plex_Mono')
    expect(polices).toContain("variable: '--police-registre'")
    expect(polices).toContain("variable: '--police-nombre'")
    for (const [nom, src] of [['le module', polices], ['la racine', layout]] as const) {
      expect(code(src), `${nom} : une police distante, et la politique de confidentialité tombe`)
        .not.toContain('fonts.googleapis.com')
    }
  })

  it('⚠️ et elles ne partent PAS sur la vitrine — mesuré, pas supposé', () => {
    // Déclarées dans `app/layout.tsx`, elles chargeaient sur TOUTES les pages :
    // `/tarifs` téléchargeait 136,6 ko de polices au lieu de 60,1 (mesuré au
    // navigateur le 6 septembre 2026). `next/font` n'émet sa feuille que dans
    // les morceaux qui importent le module : porté par la seule coquille de
    // l'espace connecté, il n'atteint que les écrans qui l'emploient.
    expect(code(layout), 'les polices de Registre sont revenues à la racine')
      .not.toMatch(/Newsreader|IBM_Plex_Mono/)
    expect(code(shell), 'la coquille ne porte plus les variables : le rapport perdrait ses polices')
      .toMatch(/app-main \$\{policeRegistre\.variable\} \$\{policeNombre\.variable\}/)
  })

  it('⚠️ le rayon se pose élément par élément, jamais par le jeton', () => {
    // Redéfinir `--r` sur `.registre` carrerait aussi ce qui n'appartient pas
    // au document : la modale du format de téléchargement, l'anneau de focus.
    expect(blocRegistre, 'Registre redéfinit un jeton de rayon')
      .not.toMatch(/\.registre[^{]*\{[^}]*--(r|r-grand|radius):/)
  })
})

describe('Registre — un document se lit', () => {
  it('⚠️ pas de --text-3 dans le bloc Registre', () => {
    // Mesuré sur le papier (#faf9f6) : `--text-3` y donne 3,06:1, sous AA. Or
    // les rôles concernés se LISENT — on cherche un code-barres, on relit un
    // en-tête de colonne, on vérifie un statut. La hiérarchie d'un document
    // vient de la taille et des capitales, pas de la pâleur du gris.
    expect(blocRegistre, 'un gris sous le seuil AA est revenu dans le document')
      .not.toContain('var(--text-3)')
  })

  it('⚠️ et pas de troisième gris sur le devis non plus', () => {
    // Même règle, même raison : sur du papier blanc le gris d'avant (#8b877c)
    // donnait 3,2:1, et il portait la date de validité et le SIREN.
    expect(code(devis)).not.toContain('#8b877c')
    expect(code(devis), 'le devis a repris un troisième gris').not.toMatch(/C\.ardoise/)
  })

  it('⚠️ et le papier tient l’AA avec le jeton qui s’y lit', () => {
    // Le fond de Registre n'est pas `--bg` : c'est un papier écrit en dur.
    // Le garde-fou de jetons de `navigation.test.ts` ne le voit donc pas —
    // il compare `--text`/`--text-2` à `--bg` et `--surface`. Sans ce test,
    // un papier assombri un jour passerait sans que rien ne le dise.
    const lum = (hex: string) => {
      const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
    }
    const ratio = (a: string, b: string) => {
      const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (h + 0.05) / (l + 0.05)
    }
    const papier = /\.registre \{ background: (#[0-9a-f]{6}); \}/i.exec(blocRegistre)?.[1]
    expect(papier, 'le papier de Registre est introuvable').toBeTruthy()

    const clair = css.slice(css.indexOf(':root[data-theme="light"]'))
    for (const nom of ['text', 'text-2']) {
      const jeton = new RegExp(`--${nom}: (#[0-9a-f]{6});`, 'i').exec(clair)?.[1]
      const r = ratio(jeton!, papier!)
      expect(r, `--${nom} sur le papier de Registre ne fait que ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(4.5)
    }
  })

  it('les nombres du rapport passent en chasse fixe', () => {
    expect(blocRegistre).toMatch(/\.registre \.num[\s\S]{0,400}var\(--police-nombre\)/)
  })
})

describe('Registre — le devis', () => {
  it('⚠️ le dernier indigo du produit a quitté le document', () => {
    const c = code(devis).toLowerCase()
    for (const mort of ['#4636b0', '#6366f1', '#38c9ff', '#0b0f19', 'indigoprofond', 'cyan']) {
      expect(c, `« ${mort} » est un reste de l’identité d’avant`).not.toContain(mort)
    }
  })

  it('⚠️ l’en-tête est un filet, plus un bandeau plein', () => {
    // Un aplat d'encre de 26 mm en haut d'une A4 est une bannière de site
    // posée sur un document — et il s'imprime.
    expect(code(devis)).not.toMatch(/type: 'bloc'[^}]*hauteur: 26/)
  })

  it('⚠️ la serif du PDF est Times : zéro octet embarqué', () => {
    // Embarquer Newsreader voudrait dire glisser un fichier de police dans le
    // paquet de la fonction edge, pour un document que personne ne comparera
    // côte à côte avec un écran.
    expect(devisPdf).toContain('StandardFonts.TimesRoman')
    expect(code(devisPdf), 'une police embarquée dans la fonction edge').not.toContain('fontkit')
    expect(code(devisPdf)).toContain("el.police === 'serif'")
  })

  it('⚠️ l’ocre ne porte que la mention réglementaire', () => {
    const usages = code(devis).match(/C\.ocre/g) ?? []
    expect(usages.length, 'l’ocre est un signal, pas une couleur de décor').toBe(1)
    expect(code(devis)).toMatch(/ligne === MENTION_TVA \? C\.ocre/)
  })
})

describe('Registre — les exports', () => {
  it('⚠️ les formats se posent par NOM de colonne, jamais par indice', () => {
    // Une colonne insérée un jour décalerait tout, en silence : le fichier
    // resterait juste, il s'afficherait faux.
    for (const [nom, src] of [['site', rapportSite], ['application', rapportApp]] as const) {
      expect(code(src), `${nom} : les formats ont été posés par indice`)
        .toMatch(/encode_cell\(\{ r: range\.s\.r, c: C \}\)/)
      expect(code(src)).toContain("FORMAT_EUROS = '#,##0.00\" €\"'")
    }
  })

  it('⚠️ le filtre s’arrête AVANT la ligne TOTAL', () => {
    // Sinon le tableur la trie au milieu du tableau, ou la masque — sur la
    // seule ligne qu'on cherche toujours.
    for (const src of [rapportSite, rapportApp]) {
      expect(code(src)).toMatch(/e: \{ r: range\.e\.r - (lignesDeTotal|totalRows), c: range\.e\.c \}/)
    }
    // ⚠️ ET CHAQUE FEUILLE QUI EN PORTE UNE LE DÉCLARE — la garde COMPTE, elle
    // ne cherche pas une occurrence. Premier jet : elle vérifiait qu'un appel
    // `…, 1)` existait quelque part dans le fichier. Retirer le `1` de la
    // feuille « Écarts » la laissait passer, parce que « Consolidé » gardait
    // le sien. Une garde qui cherche UNE occurrence ne garde que la première.
    for (const [nom, src, appel] of [
      ['site', rapportSite, /filtrerEnTete\([^)]*,\s*1\)/g],
      ['application', rapportApp, /headerFilter\([^)]*,\s*1\)/g],
    ] as const) {
      const feuillesAvecTotal = (code(src).match(/SKU: 'TOTAL'/g) ?? []).length
      expect(feuillesAvecTotal, `${nom} : plus aucune ligne TOTAL, la garde ne garde rien`)
        .toBeGreaterThan(0)
      expect((code(src).match(appel) ?? []).length,
        `${nom} : ${feuillesAvecTotal} feuille(s) finissent par un TOTAL, le filtre ne l’écarte pas partout`)
        .toBe(feuillesAvecTotal)
    }
  })

  it('⚠️ aucun style de cellule n’est écrit — le tableur libre n’en écrit pas', () => {
    // Mesuré le 6 septembre sur la version 0.20.3 du dépôt : ni gras, ni
    // couleur, ni bordure. Croire le contraire produirait un fichier qui
    // s'ouvre sans rien de ce qu'on croyait avoir mis.
    for (const src of [rapportSite, rapportApp]) {
      expect(code(src), 'un style de cellule : la version libre l’ignore en silence')
        .not.toMatch(/(cell|ws\[[^\]]+\])\.s\s*=/)
    }
  })

  it('⚠️ le site et l’application écrivent LE MÊME fichier', () => {
    // Un rapport partagé depuis le téléphone et un rapport téléchargé sur le
    // site doivent être le même classeur : les deux tables bougent ensemble.
    const table = (src: string) => {
      const i = src.indexOf('const FORMATS')
      return src.slice(i, src.indexOf('}', i) + 1).replace(/\s+/g, ' ')
    }
    expect(table(rapportApp)).toBe(table(rapportSite))
  })
})
