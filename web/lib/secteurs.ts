/**
 * Densité de stock attendue, par secteur d'activité.
 *
 * ## Pourquoi ce module existe
 *
 * Le recoupement stock / surface reposait sur une fourchette unique, de 20 à
 * 400 unités par mètre carré. Il le fallait bien : un magasin de meubles et une
 * pharmacie n'ont rien de comparable. Mais **cette largeur le rendait inutile** —
 * les tranches tarifaires sont espacées d'un facteur 2,5 à 5, quand la
 * fourchette couvrait un facteur 20. Un magasin de 1 800 m² détenant réellement
 * 240 000 pièces pouvait en déclarer 50 000 et rester affiché « cohérent »,
 * soit 6 000 € de licence en moins par an.
 *
 * Le code APE rendu par le registre permet de resserrer la fourchette au
 * secteur, et redonne au repère un sens.
 *
 * ## Ce que ce repère fait, et ce qu'il ne fait pas
 *
 * Il attrape les **erreurs d'ordre de grandeur** — un zéro oublié, une saisie
 * en milliers plutôt qu'en unités. C'est fréquent, et le rattraper avant
 * d'envoyer un devis évite une correction gênante.
 *
 * Il **ne détecte pas un mensonge délibéré** : le stock et la surface sont tous
 * deux déclarés par la même personne, et deux déclarations ne se contrôlent pas
 * l'une l'autre. Ne jamais présenter ce repère comme une garantie.
 *
 * Il ne s'affiche **jamais au prospect**, uniquement dans la console
 * d'administration : sur un formulaire public il soupçonnerait avant le devis,
 * et indiquerait quel chiffre ajuster.
 *
 * ## ⚠ Les chiffres ci-dessous sont une première estimation, à corriger
 *
 * Ils viennent d'un raisonnement sur les ordres de grandeur du commerce de
 * détail, **pas de mesures**. Julien, qui fait de l'inventory control, est
 * mieux placé pour les caler — et c'est le but de ce module : un seul endroit à
 * reprendre. Tant qu'ils ne sont pas calés, mieux vaut une fourchette trop
 * large (qui ne dit rien) qu'une trop étroite (qui accuse à tort).
 *
 * Un test impose au moins qu'aucune fourchette ne soit plus large que la
 * générique : une fourchette qui n'exclut rien ne sert à rien. C'est
 * exactement l'erreur qu'il a attrapée dans la première version de ce
 * tableau, où meubles et bricolage étaient rangés ensemble.
 */

/** Fourchette de densité plausible, en unités de stock par mètre carré. */
export interface Secteur {
  /** Identifiant court, pour les tests et les messages. */
  readonly cle: string
  /** Nom lisible du secteur. */
  readonly nom: string
  /** Classes NAF concernées, préfixes sur les quatre premiers caractères. */
  readonly naf: readonly string[]
  readonly min: number
  readonly max: number
}

/**
 * Fourchette servie quand le secteur est inconnu : c'est l'ancienne fourchette
 * unique, volontairement large. Un code APE hors commerce de détail, ou une
 * entreprise dont le registre ne dit rien, ne doit pas être signalé pour autant.
 */
export const SECTEUR_INCONNU: Secteur = {
  cle: 'inconnu',
  nom: 'Secteur non déterminé',
  naf: [],
  min: 20,
  max: 400,
}

export const SECTEURS: readonly Secteur[] = [
  {
    cle: 'volumineux',
    nom: 'Articles volumineux',
    // Meubles, électroménager, revêtements de sol : peu de pièces, beaucoup de
    // place. Mettre l'électronique et le bricolage ici forçait une fourchette
    // plus large que la générique, donc incapable de signaler quoi que ce soit.
    naf: ['47.59', '47.54', '47.53'],
    min: 1,
    max: 20,
  },
  {
    cle: 'equipementmaison',
    nom: 'Équipement de la maison et bricolage',
    // Informatique, audio-vidéo, quincaillerie et bricolage : des articles
    // encombrants voisinent avec des milliers de petites pièces détachées.
    naf: ['47.41', '47.43', '47.52'],
    min: 10,
    max: 200,
  },
  {
    cle: 'equipement',
    nom: 'Équipement de la personne',
    // Habillement, chaussures, maroquinerie, sport, jouets, textiles au mètre.
    naf: ['47.71', '47.72', '47.64', '47.65', '47.51'],
    min: 25,
    max: 250,
  },
  {
    cle: 'culture',
    nom: 'Culture et loisirs',
    // Livres, journaux et papeterie, enregistrements.
    naf: ['47.61', '47.62', '47.63'],
    min: 60,
    max: 500,
  },
  {
    cle: 'petitsarticles',
    nom: 'Petits articles à forte rotation',
    // Pharmacie, parfumerie et beauté, horlogerie-bijouterie, optique et
    // autres commerces spécialisés de petits objets.
    naf: ['47.73', '47.74', '47.75', '47.77', '47.78'],
    min: 80,
    max: 900,
  },
  {
    cle: 'alimentaire',
    nom: 'Alimentaire',
    // Supermarchés et hypermarchés, commerces alimentaires spécialisés.
    naf: ['47.11', '47.21', '47.22', '47.23', '47.24', '47.25', '47.26', '47.29'],
    min: 50,
    max: 600,
  },
  {
    cle: 'nonspecialise',
    nom: 'Magasin non spécialisé',
    // Grands magasins et bazars : par construction, tout s'y mélange, la
    // fourchette reste donc large.
    naf: ['47.19'],
    min: 20,
    max: 400,
  },
]

/**
 * Secteur correspondant à un code APE.
 *
 * Le registre sert des codes de la forme « 47.71Z ». La comparaison porte sur
 * les quatre premiers caractères — la lettre finale ne distingue rien d'utile
 * ici — et tolère l'absence de point, que certaines sources omettent.
 */
export function secteurDe(ape: string | null | undefined): Secteur {
  const brut = (ape ?? '').trim()
  if (brut === '') return SECTEUR_INCONNU

  const chiffres = brut.replace(/\D/g, '')
  if (chiffres.length < 4) return SECTEUR_INCONNU
  const classe = `${chiffres.slice(0, 2)}.${chiffres.slice(2, 4)}`

  return SECTEURS.find((s) => s.naf.includes(classe)) ?? SECTEUR_INCONNU
}

/**
 * Le repère lui-même : la densité tient-elle debout pour ce secteur ?
 *
 * Renvoie `null` quand un des deux chiffres manque — on ne signale pas une
 * absence de saisie, on ne signale qu'une saisie qui surprend.
 */
export function densiteAttendue(
  densite: number | null,
  ape: string | null | undefined,
): { secteur: Secteur; plausible: boolean } | null {
  if (densite === null) return null
  const secteur = secteurDe(ape)
  return { secteur, plausible: densite >= secteur.min && densite <= secteur.max }
}
