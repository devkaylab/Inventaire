/**
 * Consultation du registre public des entreprises.
 *
 * Source : l'API Recherche d'Entreprises (`recherche-entreprises.api.gouv.fr`),
 * service public opéré par la DINUM, sans clé ni compte. C'est la même base que
 * celle derrière `annuaire-entreprises.data.gouv.fr`.
 *
 * **L'appel part du navigateur, volontairement**, et non d'une fonction edge :
 *
 * - le quota de l'API est de sept appels par seconde et par IP appelante. Un
 *   appel serveur concentrerait tous les visiteurs sur les quelques IP de
 *   sortie de l'hébergeur, partagées avec d'autres locataires — le quota
 *   sauterait globalement. Depuis le navigateur, chaque visiteur consomme le
 *   sien, et une saturation ne gêne que lui ;
 * - une fonction edge sur un formulaire public devrait être déployée sans
 *   vérification de jeton, donc avec sa propre limitation de débit à écrire et
 *   à maintenir. C'est une surface publique de plus pour un service de confort.
 *
 * La contrepartie, à connaître : l'adresse IP du visiteur est vue par
 * l'API. C'est une administration française, la même que celle qu'il
 * consulterait en allant lui-même sur l'annuaire des entreprises, et la
 * politique de confidentialité le déclare.
 *
 * **Ce qui est lu est délibérément étroit.** La réponse contient un champ
 * `dirigeants` avec les noms des personnes physiques : il n'est ni lu, ni
 * affiché, ni transmis. On ne garde que ce qui répond à la question posée —
 * cette société existe-t-elle, est-elle active, et comment s'appelle-t-elle.
 *
 * Une réserve à ne pas oublier : **pour un entrepreneur individuel, la raison
 * sociale est un nom de personne**. Ce qui s'affiche alors est bien une donnée
 * à caractère personnel, quoique publiée en données ouvertes par l'État, et
 * rendue à la personne qui vient de saisir son propre numéro. Le registre des
 * traitements le dit ; ce n'est pas une raison de masquer le résultat, c'en est
 * une de ne pas prétendre que rien de personnel ne transite ici.
 *
 * Les entreprises ayant demandé la non-diffusion de leurs données sont servies
 * sans raison sociale : la fiche est alors traitée comme introuvable plutôt que
 * d'afficher un cadre vide.
 */

const ENDPOINT = 'https://recherche-entreprises.api.gouv.fr/search'

/** Ce qu'on retient du registre, et rien d'autre. */
export interface FicheRegistre {
  siren: string
  /** Raison sociale telle qu'inscrite. */
  raisonSociale: string
  /** `true` si l'établissement est administrativement actif. */
  active: boolean
  /** Commune du siège, en clair. Absente si le registre ne la diffuse pas. */
  commune: string | null
  codePostal: string | null
  /** Code APE du siège, sans son libellé (le registre ne le sert pas toujours). */
  ape: string | null
}

export type ResultatRegistre =
  | { etat: 'trouve'; fiche: FicheRegistre }
  | { etat: 'introuvable' }
  | { etat: 'indisponible' }

/** Forme minimale attendue ; tout le reste de la réponse est ignoré. */
interface ReponseBrute {
  results?: {
    siren?: string
    nom_complet?: string | null
    nom_raison_sociale?: string | null
    etat_administratif?: string | null
    activite_principale?: string | null
    siege?: {
      libelle_commune?: string | null
      code_postal?: string | null
      etat_administratif?: string | null
    } | null
  }[]
}

/**
 * Cherche une entreprise par son SIREN.
 *
 * La recherche de l'API est floue : interroger neuf chiffres peut théoriquement
 * ramener une société dont le nom contient ces chiffres. Le résultat n'est donc
 * retenu que si son SIREN est **exactement** celui demandé.
 *
 * Ne lève jamais : une panne du registre renvoie `indisponible`, et le
 * formulaire continue de fonctionner sans lui. Vérifier l'existence d'une
 * société est un confort, pas une condition pour déposer une demande.
 */
export async function chercherParSiren(
  siren: string,
  options?: { signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<ResultatRegistre> {
  const numero = (siren ?? '').replace(/\D/g, '')
  if (numero.length !== 9) return { etat: 'introuvable' }

  const appel = options?.fetchImpl ?? fetch
  const url = `${ENDPOINT}?q=${numero}&page=1&per_page=1`

  let brut: ReponseBrute
  try {
    const reponse = await appel(url, { signal: options?.signal, headers: { Accept: 'application/json' } })
    if (!reponse.ok) return { etat: 'indisponible' }
    brut = (await reponse.json()) as ReponseBrute
  } catch {
    // Réseau coupé, requête annulée, réponse illisible : dans tous les cas le
    // formulaire doit rester utilisable.
    return { etat: 'indisponible' }
  }

  const ligne = (brut.results ?? []).find((r) => r.siren === numero)
  if (!ligne) return { etat: 'introuvable' }

  const raisonSociale = (ligne.nom_complet ?? ligne.nom_raison_sociale ?? '').trim()
  if (raisonSociale === '') {
    // Une société peut demander que ses données ne soient pas diffusées. Elle
    // existe, mais on ne peut rien en dire : ne pas afficher une fiche vide.
    return { etat: 'introuvable' }
  }

  const siege = ligne.siege ?? {}
  return {
    etat: 'trouve',
    fiche: {
      siren: numero,
      raisonSociale,
      active: (siege.etat_administratif ?? ligne.etat_administratif ?? 'A') === 'A',
      commune: (siege.libelle_commune ?? '').trim() || null,
      codePostal: (siege.code_postal ?? '').trim() || null,
      ape: (ligne.activite_principale ?? '').trim() || null,
    },
  }
}

/** Ligne d'adresse courte : « 75015 PARIS », ou ce qui est disponible. */
export function lieuCourt(fiche: FicheRegistre): string | null {
  const morceaux = [fiche.codePostal, fiche.commune].filter(Boolean)
  return morceaux.length > 0 ? morceaux.join(' ') : null
}
