// ============================================================================
// Gabarit d'e-mail Quantinvo — charte « Papier » (v1.1)
// ----------------------------------------------------------------------------
// Un seul gabarit pour tous les envois Resend du produit. Chaque fonction edge
// décrit *ce qu'elle a à dire* (titre, paragraphes, bouton) ; la mise en forme,
// l'échappement et la version texte sont ici.
//
// Trois règles à connaître avant de le modifier :
//
// 1. C'est du HTML d'e-mail, pas du HTML de site : tableaux, styles en ligne,
//    aucune classe CSS, aucune police distante, aucune image distante. Outlook
//    ne connaît ni flexbox ni `border-radius` — la dégradation est prévue
//    (coins droits, mêmes couleurs). Ne pas « moderniser » ce balisage.
// 2. Fond blanc, palette « Papier » : un e-mail se lit, s'imprime et se
//    transfère comme un document. La direction sombre du site n'a pas cours
//    ici (règle de marque du 21 août 2026).
// 3. **Tout ce qui vient de la base est échappé** (`echapper`). Un nom de
//    magasin ou un prénom se retrouve sinon interprété comme du balisage dans
//    la boîte de réception du destinataire.
//
// Le module est volontairement sans API Deno : il est importé tel quel par les
// fonctions edge *et* par les tests du site (web/tests/email-template.test.ts).
// ============================================================================

/** Palette « Papier » de la charte v1.1. Aucune autre couleur dans ce fichier. */
export const COULEURS = {
  blanc: '#ffffff',
  encre: '#0b0f19',
  encre2: '#2a3140',
  indigoProfond: '#4636b0',
  indigo: '#6366f1',
  ardoise: '#5b6475',
  brume: '#f4f5f9',
  filet: '#e3e6ee',
  cyan: '#38c9ff',
} as const

const POLICE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

/** Adresse du site, reprise du pied de page et des liens légaux. */
export const SITE_PAR_DEFAUT = 'https://quantinvo.vercel.app'
export const POLITIQUE_URL = 'https://devkaylab.github.io/Inventaire/privacy.html'

export type BoutonEmail = { libelle: string; lien: string }
export type DetailEmail = { intitule: string; valeur: string }

export type ContenuEmail = {
  /** Titre affiché en tête du message (et repris en objet si besoin). */
  titre: string
  /** Ligne d'aperçu des boîtes de réception. À défaut, le premier paragraphe. */
  apercu?: string
  /** « Bonjour Camille, » — omis si la personne n'est pas nommée. */
  salutation?: string
  /** Corps du message, un paragraphe par entrée. */
  paragraphes: string[]
  /** Encadré de faits (magasin, inventaire, rôle…), facultatif. */
  details?: DetailEmail[]
  /** Bouton d'action principal. Le lien est aussi donné en clair dessous. */
  bouton?: BoutonEmail
  /** Précision discrète sous le bouton (usage unique, expiration…). */
  note?: string
  /** Pourquoi cette personne reçoit ce message — affiché en pied. */
  raison?: string
  /** Racine du site, pour les liens de pied de page. */
  siteUrl?: string
}

/** Échappe une valeur avant insertion dans du HTML (texte ou attribut). */
export function echapper(valeur: string): string {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * N'accepte qu'un lien http(s). Un `javascript:` ou un `data:` glissé dans une
 * valeur de base ne doit jamais devenir un `href` cliquable.
 */
export function lienSur(lien: string): string {
  const propre = String(lien).trim()
  return /^https?:\/\//i.test(propre) ? propre : SITE_PAR_DEFAUT
}

function paragraphe(texte: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COULEURS.encre2};">${echapper(texte)}</p>`
}

function encadreDetails(details: DetailEmail[]): string {
  const lignes = details
    .map(
      (d) => `<tr>
              <td style="padding:3px 0;font-size:13px;line-height:1.5;color:${COULEURS.ardoise};white-space:nowrap;">${echapper(d.intitule)}</td>
              <td style="padding:3px 0 3px 16px;font-size:13px;line-height:1.5;color:${COULEURS.encre};font-weight:600;">${echapper(d.valeur)}</td>
            </tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;background:${COULEURS.brume};border:1px solid ${COULEURS.filet};border-radius:10px;">
            <tr><td style="padding:14px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">${lignes}</table>
            </td></tr>
          </table>`
}

function boutonHtml(bouton: BoutonEmail): string {
  const lien = echapper(lienSur(bouton.lien))
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px;">
            <tr><td align="center" bgcolor="${COULEURS.indigo}" style="border-radius:10px;">
              <a href="${lien}" style="display:inline-block;padding:14px 26px;font-family:${POLICE};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${echapper(bouton.libelle)}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:${COULEURS.ardoise};">Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :<br>
            <a href="${lien}" style="color:${COULEURS.indigoProfond};text-decoration:underline;word-break:break-all;">${lien}</a>
          </p>`
}

/**
 * Rend le message en HTML et en texte brut. Resend reçoit les deux : la version
 * texte sert aux messageries qui n'affichent pas le HTML, et pèse dans le
 * jugement des filtres anti-spam.
 */
export function emailQuantinvo(contenu: ContenuEmail): { html: string; text: string } {
  const site = lienSur(contenu.siteUrl ?? SITE_PAR_DEFAUT)
  const apercu = contenu.apercu ?? contenu.paragraphes[0] ?? ''

  const corps = [
    contenu.salutation ? paragraphe(contenu.salutation) : '',
    ...contenu.paragraphes.map(paragraphe),
    contenu.details?.length ? encadreDetails(contenu.details) : '',
    contenu.bouton ? boutonHtml(contenu.bouton) : '',
    contenu.note
      ? `<p style="margin:16px 0 0;font-size:12.5px;line-height:1.6;color:${COULEURS.ardoise};">${echapper(contenu.note)}</p>`
      : '',
  ].join('')

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${echapper(contenu.titre)}</title>
</head>
<body style="margin:0;padding:0;background:${COULEURS.brume};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${echapper(apercu)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COULEURS.brume};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${COULEURS.blanc};border:1px solid ${COULEURS.filet};border-radius:14px;font-family:${POLICE};">

      <!-- En-tête : mot-symbole + filet de scan cyan -->
      <tr><td style="padding:26px 30px 14px;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:${COULEURS.encre};">Quantinvo</span>
        <span style="font-size:12px;color:${COULEURS.ardoise};">&nbsp;&nbsp;par Devkaylab</span>
      </td></tr>
      <tr><td style="padding:0 30px;">
        <div style="height:2px;line-height:2px;font-size:0;background:${COULEURS.cyan};border-radius:2px;">&nbsp;</div>
      </td></tr>

      <!-- Corps -->
      <tr><td style="padding:24px 30px 6px;">
        <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:800;letter-spacing:-0.4px;color:${COULEURS.indigoProfond};">${echapper(contenu.titre)}</h1>
        ${corps}
      </td></tr>

      <!-- Pied -->
      <tr><td style="padding:24px 30px 26px;">
        <div style="height:1px;line-height:1px;font-size:0;background:${COULEURS.filet};margin-bottom:16px;">&nbsp;</div>
        <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${COULEURS.ardoise};">
          <strong style="color:${COULEURS.encre};">Quantinvo</strong> — l'outil d'inventaire pour le commerce.${contenu.raison ? `<br>${echapper(contenu.raison)}` : ''}
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${COULEURS.ardoise};">
          <a href="${echapper(site)}" style="color:${COULEURS.ardoise};text-decoration:underline;">${echapper(site.replace(/^https?:\/\//, ''))}</a>
          &nbsp;·&nbsp;
          <a href="${POLITIQUE_URL}" style="color:${COULEURS.ardoise};text-decoration:underline;">Politique de confidentialité</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    'QUANTINVO',
    '',
    contenu.titre,
    '',
    contenu.salutation ?? '',
    ...contenu.paragraphes,
    ...(contenu.details?.length ? ['', ...contenu.details.map((d) => `${d.intitule} : ${d.valeur}`)] : []),
    ...(contenu.bouton ? ['', `${contenu.bouton.libelle} : ${lienSur(contenu.bouton.lien)}`] : []),
    ...(contenu.note ? ['', contenu.note] : []),
    '',
    '--',
    "Quantinvo — l'outil d'inventaire pour le commerce.",
    ...(contenu.raison ? [contenu.raison] : []),
    site,
    `Politique de confidentialité : ${POLITIQUE_URL}`,
  ]
    .filter((ligne, i, tout) => !(ligne === '' && tout[i - 1] === ''))
    .join('\n')
    .trim()

  return { html, text }
}
