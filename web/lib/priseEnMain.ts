/**
 * La prise en main de l'application mobile, écran par écran.
 *
 * ⚠️ **Chaque étape cite le repère que l'application affiche à ce moment-là.**
 * C'est ce qui relie ce guide à l'app au lieu d'en faire un document
 * parallèle : un superviseur qui forme une recrue dit exactement ce qu'elle
 * lira ensuite sur son téléphone. Si un repère change de mots dans
 * `src/lib/reperes.ts` ou dans l'écran qui le porte, il change ici aussi.
 *
 * ⚠️ **Et la date des captures est affichée en clair.** Un guide qui montre
 * des écrans disparus est pire que pas de guide — c'est ce qui a tué le
 * tutoriel intégré, dont le retour est interdit pour cette raison. Tant que la
 * date est visible, on sait quand il a vieilli.
 */

/** Le jour où les captures ont été prises. À remonter à chaque nouvelle passe. */
export const CAPTURES_LE = '24 août 2026'

/**
 * ⚠️ Les captures antérieures au 29 août ne montrent PLUS l'écran réel.
 * L'écran de comptage a changé trois fois depuis (cadre du viseur, liste des
 * scans passée derrière un bouton, trace « Dernier scan »), et les quatre
 * repères du compteur datent du 31 août. Tant que ce drapeau est vrai, la page
 * le dit au lecteur plutôt que de le laisser croire ce qu'il voit.
 */
export const CAPTURES_A_REFAIRE = true

export interface Etape {
  /** Le fichier dans `public/prise-en-main/`, sans extension. */
  image: string
  titre: string
  /** Ce qu'on fait, puis le seul piège de l'étape. Deux phrases, pas trois. */
  texte: string
  /** Le repère que l'application affiche à ce moment précis. */
  repere: string
}

export interface Parcours {
  cle: 'compteur' | 'superviseur'
  nom: string
  /** Pour qui, en une phrase — lue avant les étapes. */
  intro: string
  etapes: Etape[]
}

export const PARCOURS: Parcours[] = [
  {
    cle: 'compteur',
    nom: 'Compteur',
    intro:
      'Le parcours le plus court, et le plus fréquent. Une recrue doit pouvoir compter son premier rayon dans les cinq minutes qui suivent son arrivée.',
    etapes: [
      {
        image: 'bienvenue-compteur',
        titre: 'On arrive par un e-mail',
        texte:
          "Personne ne s'inscrit : le compte existe déjà, créé par le superviseur. On choisit son mot de passe sur le site, puis on installe l'application et on se connecte avec la même adresse.",
        repere: "L'application accueille par le prénom, une fois par téléphone.",
      },
      {
        image: 'accueil-compteur',
        titre: "Attendre d'être ajouté à un inventaire",
        texte:
          "Tant que le superviseur n'a ajouté personne, la liste est vide — et l'écran dit qui débloque, plutôt que de laisser devant un formulaire.",
        repere: '« Aucun inventaire pour l’instant · Votre superviseur vous ajoutera. »',
      },
      {
        image: 'inventaire-compteur',
        titre: 'Compter, ou auditer',
        texte:
          "Deux boutons, deux passages. L'audit est un second comptage de vérification : on ne le lance que si le superviseur le demande.",
        repere: 'Deux lignes sous les boutons, au premier passage seulement.',
      },
      {
        image: 'scanner-balise',
        titre: 'Scanner la balise du rayon',
        texte:
          "L'étiquette collée sur l'étagère ouvre la zone. Rien ne se compte avant : c'est elle qui dit où l'on est.",
        repere: '« Balise 1000 ouverte · Scannez maintenant les articles de ce rayon. »',
      },
      {
        image: 'comptage',
        titre: 'Scanner les articles',
        texte:
          "Chaque lecture ajoute une pièce. Trois façons de scanner : la caméra, la saisie manuelle, ou une douchette Bluetooth — bien plus rapide sur un gros rayon.",
        repere: '« Trois façons de scanner », au premier passage en phase article.',
      },
      {
        image: 'balise-terminee',
        titre: 'Clôturer, passer au rayon suivant',
        texte:
          "La confirmation rappelle le nombre de pièces comptées. Une balise clôturée se rouvre si besoin : rien n'est jamais effacé, une correction est une ligne de plus.",
        repere: '« Première balise terminée · Elles sont déjà sur le tableau de bord. »',
      },
      {
        image: 'balises-comptees-detail',
        titre: 'Vérifier avant de quitter le magasin',
        texte:
          "« Balises comptées » vient du serveur : ce travail est sauvé. « En attente » est encore sur le téléphone — il faut retrouver du réseau avant de partir.",
        repere: '« Deux listes, et la différence compte », à la première mise en attente.',
      },
    ],
  },
  {
    cle: 'superviseur',
    nom: 'Superviseur',
    intro:
      "Tout ce qui se prépare une fois, et tout ce qui demande une décision. Les trois quarts se font avant que quiconque ne scanne quoi que ce soit.",
    etapes: [
      {
        image: 'creer-balises',
        titre: 'Imprimer ses balises',
        texte:
          "Une planche d'étiquettes à coller sur les rayons, générée depuis la boîte à outils. À faire une fois : elles resservent d'un inventaire à l'autre.",
        repere: 'Première étape du bandeau de démarrage, sur l’accueil.',
      },
      {
        image: 'nouvel-inventaire',
        titre: "Créer l'inventaire",
        texte:
          "Un nom, un magasin, un code à communiquer à l'équipe. Et le choix du mode : avec balises, plusieurs personnes comptent en parallèle sans se gêner.",
        repere: '« Ce choix ne se change plus après la création. »',
      },
      {
        image: 'zones',
        titre: 'Affecter les plages de balises',
        texte:
          "Dire quelles étiquettes correspondent à quel endroit : les balises 1000 à 1049 sont la Surface de vente. C'est ce qui rend l'avancement lisible rayon par rayon.",
        repere: '« Balise, emplacement, plage », en tête de l’écran.',
      },
      {
        image: 'importer',
        titre: 'Importer les deux fichiers',
        texte:
          "Le référencement nomme les articles ; sans lui tout ressort en « article inconnu ». Le stock théorique donne les quantités attendues — c'est lui, et lui seul, qui fait apparaître les écarts.",
        repere: '« Deux fichiers, deux rôles », avant le premier import.',
      },
      {
        image: 'ajouter-membre',
        titre: 'Ajouter son équipe',
        texte:
          "Prénom, nom, adresse : la personne reçoit une invitation et choisit son mot de passe. Tant qu'elle n'est pas entrée, sa ligne porte « Mot de passe à créer ».",
        repere: 'La personne apparaît tout de suite, avant même sa première connexion.',
      },
      {
        image: 'inventaire-superviseur',
        titre: "Suivre, puis clôturer",
        texte:
          "L'avancement se lit en balises comptées, pas en pièces. À la clôture, l'inventaire passe en lecture seule et le rapport se fige — les écarts se lisent plus au large sur le site.",
        repere: 'La confirmation compte les balises jamais comptées avant de clôturer.',
      },
    ],
  },
]
