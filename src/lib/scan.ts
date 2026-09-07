import { parseBalise } from '@/lib/baliseCode'

/**
 * Ce qu'on fait d'un code qui vient d'être lu.
 *
 * ⚠️ **Pourquoi cette décision est sortie du scanner.** Elle y vivait au
 * milieu de `resolveAndRecord`, entre deux `await` et trois `useRef` — donc
 * elle ne pouvait s'éprouver qu'avec une caméra et une vraie étiquette. Or
 * c'est la seule partie du scan qui porte des RÈGLES : le reste (viser,
 * enregistrer) est de la plomberie. Ici elle est pure, et la matrice complète
 * — deux modes d'inventaire × deux passes × zone ouverte ou non × quatre
 * natures de code — tient dans un test.
 *
 * Demande de Julien le 7 septembre 2026 : « vérifie que le scan fonctionne à
 * 100 % dans toutes les situations, compte, audit ».
 */
export type DecisionScan =
  /** Rescan de la balise déjà ouverte : c'est le geste de clôture. */
  | { action: 'cloturer' }
  /** Une autre balise pendant qu'une zone est ouverte : on clôture puis on ouvre. */
  | { action: 'changer'; code: string }
  /** Aucune zone ouverte : cette balise ouvre la sienne. */
  | { action: 'ouvrir'; code: string }
  /** Un code-barres d'article, dans une zone ouverte (ou hors mode balises). */
  | { action: 'article'; code: string }
  /** Rien à enregistrer : on dit pourquoi, et ce qu'il faut faire. */
  | { action: 'refus'; titre: string; texte: string }

export type ContexteScan = {
  /** L'inventaire fonctionne-t-il par balises ? (`uses_zones`) */
  parBalises: boolean
  /** Le numéro de la balise ouverte, s'il y en a une. */
  baliseOuverte: string | null
  /** La passe en cours — elle ne change que le mot employé dans les refus. */
  passe: 'count' | 'audit'
}

/**
 * ⚠️ **Le vocabulaire suit la passe.** On « compte » un rayon en passe 1 et on
 * l'« audite » en passe 2 : un message qui dirait « compter » à un auditeur
 * lui ferait croire qu'il s'est trompé d'écran.
 */
const VERBE = { count: 'compter', audit: 'auditer' } as const

export function deciderScan(code: string, ctx: ContexteScan): DecisionScan {
  const valeur = (code ?? '').trim()
  if (!valeur) return { action: 'refus', titre: 'Code vide', texte: 'Rien n’a été lu.' }

  const balise = parseBalise(valeur)

  // ── L'inventaire ne fonctionne pas par balises ────────────────────────────
  if (!ctx.parBalises) {
    /**
     * ⚠️ Une balise scannée ici partait en `resolveArticle`, ne trouvait rien,
     * et ouvrait « Article inconnu » sur `SCB1:1` — proposant donc de créer un
     * ARTICLE portant le numéro d'une balise, dans le référentiel de
     * l'inventaire. C'est une saleté durable née d'un geste anodin.
     */
    if (balise) {
      return {
        action: 'refus',
        titre: 'Balise inutile ici',
        texte: `${luAffiche(valeur)}\nCet inventaire ne fonctionne pas par balises : `
          + `scannez directement les articles à ${VERBE[ctx.passe]}.`,
      }
    }
    return { action: 'article', code: valeur }
  }

  // ── Mode balises ──────────────────────────────────────────────────────────
  if (balise) {
    if (ctx.baliseOuverte && balise.code === ctx.baliseOuverte) return { action: 'cloturer' }
    if (ctx.baliseOuverte) return { action: 'changer', code: balise.code }
    return { action: 'ouvrir', code: balise.code }
  }

  /**
   * ⚠️ **CE REFUS DIT CE QUI A ÉTÉ LU, ET C'EST TOUT L'OBJET DU CORRECTIF.**
   *
   * Il s'appelait « Zone fermée · Scannez d'abord une balise pour ouvrir une
   * zone » — un message écrit pour l'article scanné trop tôt, et servi à
   * TOUT code non reconnu. Constat de Julien (7 septembre 2026) : viser un QR
   * qu'on croit être une balise et lire « Zone fermée » laisse penser que le
   * scan a voulu FERMER quelque chose, alors qu'il n'a simplement pas reconnu
   * l'étiquette.
   *
   * Les deux cas ne se disent donc plus pareil : un QR non reconnu n'est pas
   * une balise, un code-barres arrivé trop tôt attend sa zone.
   */
  if (!ctx.baliseOuverte) {
    return estQrQuelconque(valeur)
      ? {
        action: 'refus',
        titre: 'Ce n’est pas une balise',
        texte: `${luAffiche(valeur)}\nCe code n’a pas été produit par Quantinvo. `
          + `Saisissez le numéro de la balise ci-dessus.`,
      }
      : {
        action: 'refus',
        titre: 'Code non reconnu',
        texte: `${luAffiche(valeur)}\nCe n’est pas une balise Quantinvo. Saisissez `
          + `son numéro ci-dessus pour ouvrir la zone.`,
      }
  }

  return { action: 'article', code: valeur }
}

/**
 * ⚠️ **UN REFUS DIT CE QU'IL A LU, ET C'EST LA MOITIÉ DU MESSAGE.**
 *
 * Constat de Julien, 7 septembre 2026 : *« je ne peux toujours pas ouvrir de
 * balise »*, sur le message corrigé le matin même. Les trois refus disaient
 * bien POURQUOI ils refusaient — mais aucun ne disait **ce que la caméra avait
 * lu**, donc personne, ni lui ni moi, ne pouvait savoir si l'étiquette visée
 * portait autre chose que le format attendu.
 *
 * Sans cette ligne, un refus se discute ; avec elle, il se tranche en une
 * seconde : ou bien le code affiché commence par `SCB1:` et c'est notre
 * lecture qui est fautive, ou bien il porte tout autre chose et l'étiquette
 * n'est pas une balise Quantinvo.
 *
 * ⚠️ **ELLE VIENT EN PREMIER, ET C'EST MESURÉ.** Posée en fin de texte, elle
 * n'apparaissait pas du tout : le bandeau d'erreur coupe à TROIS lignes
 * (`Dialogue.tsx`, `numberOfLines={3}`), et l'explication les consommait
 * toutes. Vu sur le Pixel — le message finissait par « … ci-dessus.... ».
 * Ce qui doit être lu passe avant ce qui explique.
 *
 * Bornée à 40 signes : un QR peut porter une page entière, et une carte de
 * question qui déborde ne se lit plus.
 */
function luAffiche(valeur: string): string {
  const uneLigne = valeur.replace(/\s+/g, ' ').trim()
  const court = uneLigne.length > 40 ? `${uneLigne.slice(0, 40)}…` : uneLigne
  return `Code lu : ${court}`
}

/**
 * Distingue un QR d'un code-barres d'article, pour choisir le bon refus.
 *
 * ⚠️ **Heuristique assumée, et bornée à un choix de PHRASE.** Elle ne décide
 * jamais d'un enregistrement : au pire on affiche l'un des deux refus à la
 * place de l'autre, et les deux disent d'aller chercher la balise. Un SKU peut
 * ressembler à tout, donc on ne retient que ce qu'un code-barres d'article ne
 * porte jamais : une adresse web, ou du texte long.
 */
function estQrQuelconque(valeur: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(valeur)) return true // http://, https://, otpauth://…
  if (/^(mailto|tel|sms|geo|bitcoin|wifi|matmsg|begin):/i.test(valeur)) return true
  if (valeur.includes('\n')) return true // vCard, WIFI:, texte multi-ligne
  return valeur.length > 32 // aucun EAN/UPC/ITF, et quasiment aucun SKU
}
