import { parseBalise } from '@/lib/baliseCode'
import { gtinValide } from '@/lib/douchette'
import { t } from '@/lib/i18n'

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

export function deciderScan(code: string, ctx: ContexteScan): DecisionScan {
  const valeur = (code ?? '').trim()
  if (!valeur) return { action: 'refus', titre: t('Code vide'), texte: t('Rien n’a été lu.') }

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
        titre: t('Balise inutile ici'),
        texte: `${luAffiche(valeur)}\n` + (ctx.passe === 'count'
          ? t('Cet inventaire ne fonctionne pas par balises : scannez directement les articles à compter.')
          : t('Cet inventaire ne fonctionne pas par balises : scannez directement les articles à auditer.')),
      }
    }
    return { action: 'article', code: valeur }
  }

  // ── Mode balises ──────────────────────────────────────────────────────────
  /**
   * ⚠️ **UN NUMÉRO NU EST UNE BALISE, PAS SEULEMENT UN QR `SCB1:`.**
   *
   * Constat de Julien, 7 septembre 2026 : *« aucune balise n'est reconnue, ni
   * 1, ni 1001, ni 98729 »*, alors que la saisie manuelle des mêmes numéros
   * ouvrait la zone sans broncher — vérifié sur son téléphone. Le scan
   * n'acceptait que le QR produit par nos planches ; toute autre étiquette
   * numérotée — un code-barres imprimé par le magasin, une étiquette d'un
   * autre système, un QR portant le seul numéro — était refusée.
   *
   * Sa règle : **« je dois pouvoir lire toutes suites de chiffres »**. Le
   * champ manuel le faisait déjà ; la caméra le fait maintenant aussi. Les
   * deux chemins lisent enfin la même chose.
   */
  const numero = /^\d+$/.test(valeur) ? valeur : null

  if (balise || numero) {
    const code = balise ? balise.code : (numero as string)

    // Rescan de l'étiquette ouverte → clôture, quel que soit le format lu.
    if (ctx.baliseOuverte && code === ctx.baliseOuverte) return { action: 'cloturer' }

    /**
     * ⚠️ **UNE ZONE OUVERTE CHANGE LA LECTURE D'UN NUMÉRO NU, ET C'EST VOULU.**
     *
     * Là, on compte : la plupart des codes visés sont des articles, et
     * beaucoup de références sont purement numériques. Un numéro nu y reste
     * donc un ARTICLE — seul le QR `SCB1:` passe encore à une autre balise
     * sans clôturer. Sinon un SKU numérique fermerait le rayon en cours.
     *
     * La règle de Julien tient quand même : « on ouvre d'abord, on ferme
     * ensuite » — c'est à l'ouverture qu'un numéro nu doit être lu, et à la
     * clôture qu'on rescanne la MÊME étiquette, cas traité juste au-dessus.
     */
    if (ctx.baliseOuverte) {
      if (balise) return { action: 'changer', code }
      return { action: 'article', code: valeur }
    }

    /**
     * ⚠️ **UN CODE-BARRES D'ARTICLE N'OUVRE PAS UNE BALISE.** Sa clé de
     * contrôle le distingue d'un numéro de balise : EAN-8, UPC-A, EAN-13 et
     * ITF-14 se vérifient tout seuls (`gtinValide`, déjà écrite pour la
     * douchette). Sans ce tri, viser un article avant d'ouvrir sa zone
     * proposerait de créer une balise portant son code-barres.
     */
    if (numero && !balise && gtinValide(valeur)) {
      return {
        action: 'refus',
        titre: t('Aucune zone ouverte'),
        texte: `${luAffiche(valeur)}\n` + (ctx.passe === 'count'
          ? t('C’est un code-barres d’article. Scannez d’abord la balise du rayon : elle dit où vous comptez.')
          : t('C’est un code-barres d’article. Scannez d’abord la balise du rayon : elle dit où vous auditez.')),
      }
    }

    return { action: 'ouvrir', code }
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
        titre: t('Ce n’est pas une balise'),
        texte: `${luAffiche(valeur)}\n` + t('Ce code n’a pas été produit par Quantinvo. Saisissez le numéro de la balise ci-dessus.'),
      }
      : {
        action: 'refus',
        titre: t('Code non reconnu'),
        texte: `${luAffiche(valeur)}\n` + t('Ce n’est pas une balise Quantinvo. Saisissez son numéro ci-dessus pour ouvrir la zone.'),
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
