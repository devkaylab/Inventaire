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
//    aucune classe CSS, aucune police distante. Une seule image, le logo,
//    servi par le site — et le mot-symbole reste en texte à côté, pour les
//    messageries qui coupent les images. Outlook ne connaît ni flexbox ni
//    `border-radius` : la dégradation est prévue (coins droits, mêmes
//    couleurs). Ne pas « moderniser » ce balisage.
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

/**
 * La palette d'ARDOISE, thème clair. Aucune autre couleur dans ce fichier.
 *
 * ⚠️ ELLE A REMPLACÉ « PAPIER » LE 7 SEPTEMBRE 2026, et ce gabarit était le
 * DERNIER endroit du produit à porter l'ancienne identité : bandeau bleu nuit
 * `#0b0f19`, filet de scan cyan `#38c9ff`, bouton indigo `#6366f1`, gris
 * bleutés. Le site est passé le 6, l'application l'après-midi ; les e-mails
 * n'avaient pas suivi parce qu'ils vivent hors du site — constat de Julien,
 * capture d'un message reçu à l'appui.
 *
 * ⚠️ IL N'Y A PAS DE THÈME SOMBRE ICI, et il ne faut pas en ajouter. Un e-mail
 * se lit dans une messagerie qui compose comme elle veut ; le gabarit déclare
 * `color-scheme: light` et s'y tient. Les valeurs sont donc celles du thème
 * clair du site (`web/app/globals.css`, bloc `[data-theme="light"]`).
 *
 * Contrastes mesurés sur les fonds où chacune sert : le texte courant 10,3:1
 * sur blanc, le second plan 6,6:1 sur blanc et 5,8:1 sur le pied, le blanc du
 * bouton 9,6:1 sur l'accent.
 */
export const COULEURS = {
  blanc: '#ffffff',
  /** L'encre d'Ardoise — celle du rail du site et du bandeau de l'app. */
  encre: '#14181a',
  /** Le texte courant : l'encre adoucie, sans bleu. */
  encre2: '#3a423f',
  /**
   * Le vert forêt du thème clair. Il ne sert QU'À CE QUI ENGAGE — le bouton et
   * le lien secondaire — comme partout ailleurs dans Ardoise.
   */
  accent: '#1e4d3b',
  /** Second plan : notes, pied, adresse de secours. */
  ardoise: '#575f5c',
  /** Le papier d'Ardoise : pied de page et encadré de faits. */
  brume: '#f2f3f1',
  filet: '#e2e5e1',
} as const

/**
 * Les rayons. ⚠️ Trois valeurs, pas dix-sept — et petites : « un outil de
 * travail n'a pas les coins ronds d'une application grand public ». Ils
 * valaient 14, 13, 10 et 8 px avant Ardoise.
 */
const RAYON = { carte: '4px', interieur: '3px' } as const

const POLICE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

/** Adresse du site, reprise du pied de page et des liens légaux. */
export const SITE_PAR_DEFAUT = 'https://www.quantinvo.com'
// ⚠️ Effectif au REDÉPLOIEMENT de chaque fonction edge : c'est une constante,
// pas une variable d'environnement lue à l'exécution. Les messages partis
// d'ici gardent l'ancienne adresse tant que la fonction n'est pas redéployée —
// et cette adresse reste en ligne, donc rien ne casse entre-temps.
export const POLITIQUE_URL = 'https://www.quantinvo.com/confidentialite'
/**
 * Le logo est servi par le site (`web/public/email/`), en PNG : Gmail retire
 * les SVG et bloque les `data:` en source d'image. Il suit donc `siteUrl`,
 * c'est-à-dire `APP_PUBLIC_URL` — le jour du domaine propre, rien à reprendre
 * ici.
 *
 * C'est **le cube seul, sur fond transparent** : la tuile de l'icône
 * d'application, posée sur le bandeau encre, faisait vignette rapportée.
 */
export const CHEMIN_LOGO = '/email/logo-quantinvo-encre.png'

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
  /**
   * Un second lien, sous le bouton, en texte : « Votre facture ». Pour ce qui
   * accompagne l'action sans la concurrencer — la facture Stripe à côté de
   * « Créer mon accès ». Jamais un second bouton : un seul geste par message.
   */
  lienSecondaire?: BoutonEmail
  /** Précision discrète sous le bouton (usage unique, expiration…). */
  note?: string
  /** Pourquoi cette personne reçoit ce message — affiché sous le bouton. */
  raison?: string
  /** Racine du site, pour les liens de pied de page. */
  siteUrl?: string
  /** Logo affiché en tête. Par défaut, celui servi par le site. */
  logoUrl?: string
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
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${COULEURS.encre2};">${echapper(texte)}</p>`
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
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 24px;background:${COULEURS.brume};border:1px solid ${COULEURS.filet};border-radius:${RAYON.interieur};">
            <tr><td style="padding:14px 16px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">${lignes}</table>
            </td></tr>
          </table>`
}

function boutonHtml(bouton: BoutonEmail): string {
  const lien = echapper(lienSur(bouton.lien))
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
            <tr><td align="center" bgcolor="${COULEURS.accent}" style="border-radius:${RAYON.carte};">
              <a href="${lien}" style="display:inline-block;padding:11px 20px;font-family:${POLICE};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:${RAYON.carte};">${echapper(bouton.libelle)}</a>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:${COULEURS.ardoise};">Le bouton ne fonctionne pas ? Copiez cette adresse :<br>
            <a href="${lien}" style="color:${COULEURS.ardoise};text-decoration:underline;word-break:break-all;">${lien}</a>
          </p>`
}

/**
 * Rend le message en HTML et en texte brut. Resend reçoit les deux : la version
 * texte sert aux messageries qui n'affichent pas le HTML, et pèse dans le
 * jugement des filtres anti-spam.
 */
export function emailQuantinvo(contenu: ContenuEmail): { html: string; text: string } {
  const site = lienSur(contenu.siteUrl ?? SITE_PAR_DEFAUT)
  // Le mot-symbole reste du texte **à côté** de l'image : la moitié des
  // messageries coupent les images par défaut, et la marque doit se lire
  // quand même. D'où l'`alt` vide sur la tuile — un `alt` parlant afficherait
  // « Quantinvo » deux fois.
  const logo = echapper(lienSur(contenu.logoUrl ?? `${site}${CHEMIN_LOGO}`))
  const apercu = contenu.apercu ?? contenu.paragraphes[0] ?? ''

  const corps = [
    contenu.salutation
      ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:${COULEURS.encre2};">${echapper(contenu.salutation)}</p>`
      : '',
    ...contenu.paragraphes.map(paragraphe),
    contenu.details?.length ? encadreDetails(contenu.details) : '',
    contenu.bouton ? boutonHtml(contenu.bouton) : '',
    contenu.lienSecondaire
      ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:${COULEURS.encre2};"><a href="${echapper(lienSur(contenu.lienSecondaire.lien))}" style="color:${COULEURS.accent};text-decoration:underline;font-weight:600;">${echapper(contenu.lienSecondaire.libelle)}</a></p>`
      : '',
    contenu.note
      ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${COULEURS.ardoise};">${echapper(contenu.note)}</p>`
      : '',
    contenu.raison
      ? `<p style="margin:${contenu.note ? 8 : 20}px 0 0;font-size:13px;line-height:1.6;color:${COULEURS.ardoise};">${echapper(contenu.raison)}</p>`
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
<body style="margin:0;padding:0;background:${COULEURS.filet};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${echapper(apercu)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COULEURS.filet};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:${COULEURS.blanc};border:1px solid ${COULEURS.filet};border-radius:${RAYON.carte};font-family:${POLICE};">

      <!-- En-tête : bandeau encre, la marque et le mot-symbole en os.
           ⚠️ LE FILET DE SCAN CYAN A DISPARU LE 7 SEPTEMBRE 2026. C'était le
           faisceau du cube isométrique, retiré du produit le 6 ; un filet
           décoratif n'engage rien, et dans Ardoise l'accent ne sert qu'à ce
           qui engage. L'encre s'arrête, le blanc commence — c'est ce qu'on a
           fait le même jour en retirant la lueur de tous les héros du site. -->
      <tr><td bgcolor="${COULEURS.encre}" style="background:${COULEURS.encre};padding:28px 32px;border-radius:${RAYON.interieur} ${RAYON.interieur} 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle" style="padding-right:14px;">
              <img src="${logo}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0;">
            </td>
            <td valign="middle">
              <span style="font-size:28px;font-weight:800;letter-spacing:-0.7px;color:#ffffff;">Quantinvo</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Corps -->
      <tr><td style="padding:26px 32px 30px;">
        <h1 style="margin:0 0 18px;font-size:20px;line-height:1.35;font-weight:700;letter-spacing:-0.3px;color:${COULEURS.encre};">${echapper(contenu.titre)}</h1>
        ${corps}
      </td></tr>

      <!-- Pied : bande gris clair, tout ce qui est secondaire y descend -->
      <tr><td style="background:${COULEURS.brume};border-top:1px solid ${COULEURS.filet};padding:20px 32px 22px;border-radius:0 0 ${RAYON.interieur} ${RAYON.interieur};">
        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${COULEURS.ardoise};">
          <strong style="color:${COULEURS.encre};font-weight:600;">Quantinvo</strong> — l'outil d'inventaire pour le commerce.
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:${COULEURS.ardoise};">
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
    ...(contenu.lienSecondaire ? [`${contenu.lienSecondaire.libelle} : ${lienSur(contenu.lienSecondaire.lien)}`] : []),
    ...(contenu.note ? ['', contenu.note] : []),
    ...(contenu.raison ? ['', contenu.raison] : []),
    '',
    '--',
    "Quantinvo — l'outil d'inventaire pour le commerce.",
    site,
    `Politique de confidentialité : ${POLITIQUE_URL}`,
  ]
    .filter((ligne, i, tout) => !(ligne === '' && tout[i - 1] === ''))
    .join('\n')
    .trim()

  return { html, text }
}

// ── L'envoi lui-même ────────────────────────────────────────────────────────
// Un seul point pour parler à Resend. Ce qui vit ici, et nulle part ailleurs :
//
// · **`reply_to`** — l'adresse qui reçoit les réponses. Les messages partent
//   d'une adresse d'envoi (`INVITE_FROM_EMAIL`) qui ne lit rien ; plusieurs
//   d'entre eux disent pourtant « répondez à ce message ». Constat de Julien
//   le 22 août 2026 : « on ne peut pas y répondre ». `CONTACT_EMAIL` règle
//   ça, à défaut l'adresse des administrateurs lue en base par l'appelant.
//   Sans l'un ni l'autre, la promesse est fausse : `adresseDeContact()` rend
//   alors `null`, et les textes qui l'affichent doivent se taire.
// · l'en-tête `from`, au même endroit pour les douze fonctions ;
// · l'erreur Resend, relevée en clair.
//
// Ce bloc lit `Deno.env` : il est donc **hors de la partie testée par le
// site**, et c'est voulu — les tests vérifient le gabarit, pas l'envoi.

export type EnvoiEmail = {
  to: string | string[]
  subject: string
  html: string
  text: string
  /** Pièces jointes au format Resend (`filename`, `content` en base64). */
  attachments?: { filename: string; content: string }[]
  /** Adresse de réponse explicite. À défaut, `adresseDeContact()`. */
  replyTo?: string | null
}

/**
 * L'adresse à laquelle un client peut écrire. `CONTACT_EMAIL` d'abord ; sinon
 * ce que l'appelant a pu lire en base (`admin_notify_emails`) ; sinon rien —
 * et « rien » doit se voir dans le texte, pas devenir une promesse vide.
 */
export function adresseDeContact(repli?: string | string[] | null): string | null {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env?.get?.('CONTACT_EMAIL') as string | undefined
  const explicite = (env ?? '').trim()
  if (explicite) return explicite
  const liste = Array.isArray(repli) ? repli : repli ? [repli] : []
  const premiere = liste.map((a) => (a ?? '').trim()).find(Boolean)
  return premiere ?? null
}

/** Envoie par Resend. Lève en cas d'échec, avec le statut et le corps. */
export async function envoyerEmail(e: EnvoiEmail): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env
  const cle = env?.get?.('RESEND_API_KEY') as string | undefined
  if (!cle) throw new Error('Resend non configuré')
  const from = ((env?.get?.('INVITE_FROM_EMAIL') as string | undefined) ?? '').trim() || 'Quantinvo <onboarding@resend.dev>'
  const replyTo = e.replyTo === undefined ? adresseDeContact() : e.replyTo
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: Array.isArray(e.to) ? e.to : [e.to],
      subject: e.subject,
      html: e.html,
      text: e.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(e.attachments?.length ? { attachments: e.attachments } : {}),
    }),
  })
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`)
}
