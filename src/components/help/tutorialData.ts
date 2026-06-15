import type { ImageSourcePropType } from 'react-native'
import type { AnnotationData } from './Annotation'
import type { Theme } from '@/constants/ink'
// Annotation x/y are fractions 0–1 of the IMAGE content area (not the container)

export type Role = 'supervisor' | 'employee'

export interface Step {
  icon: string
  title: string
  body: string
  tip?: string
  image: ImageSourcePropType
  annotations?: AnnotationData[]
}

// ─── Supervisor — 9 steps ─────────────────────────────────────────────────────
const supervisor: Step[] = [
  {
    icon: '🗂️',
    title: 'Voir mes sessions',
    body: "À l'ouverture, vous voyez la liste de vos sessions d'inventaire en cours et passées. Chaque carte affiche le magasin, le numéro d'inventaire, le statut et la date.",
    tip: "Le bouton ➕ en bas ouvre la création d'une nouvelle session.",
    image: require('../../../assets/help/supervisor/01-sessions.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.93, size: 70 }],
  },
  {
    icon: '➕',
    title: 'Créer une session',
    body: "Saisissez le nom du magasin. Un code de sécurité aléatoire est généré — vous pouvez en demander un nouveau. Ce code servira aux compteurs à rejoindre la session.",
    tip: "Notez bien le code de sécurité : il sera demandé à chaque compteur.",
    image: require('../../../assets/help/supervisor/02-new-session.png'),
    annotations: [{ type: 'circle', x: 0.50, y: 0.52, size: 90 }],
  },
  {
    icon: '🔑',
    title: 'Partager les identifiants',
    body: 'Sur la page session, le numéro d\'inventaire et le code de sécurité sont affichés. Appuyez sur "Copier" pour envoyer ces informations à vos compteurs.',
    tip: 'Le numéro d\'inventaire est unique et reste valide tant que la session est ouverte.',
    image: require('../../../assets/help/supervisor/03-credentials.png'),
    annotations: [{ type: 'circle', x: 0.82, y: 0.18, size: 60 }],
  },
  {
    icon: '📦',
    title: 'Importer le catalogue',
    body: "Allez dans \"Importer les données\". Importez d'abord le référentiel articles : un fichier CSV ou Excel avec les colonnes sku, ean (optionnel), brand, label, unit_purchase_price.",
    tip: 'Le fichier est analysé puis poussé en base avec une barre de progression.',
    image: require('../../../assets/help/supervisor/04-import-catalog.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.28, size: 100 }],
  },
  {
    icon: '📊',
    title: 'Importer le stock théorique',
    body: 'Importez ensuite le stock théorique (colonnes sku et theoretical_qty). Il servira à calculer les écarts entre quantité comptée et quantité attendue.',
    tip: 'Importez le catalogue AVANT le stock : un stock sans article correspondant est ignoré.',
    image: require('../../../assets/help/supervisor/05-import-stock.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.55, size: 100 }],
  },
  {
    icon: '🔵',
    title: 'Lancer les passes',
    body: 'La session démarre en Passe 1 (Compte). Quand les compteurs ont fini, appuyez sur "Passer en Audit" pour lancer la Passe 2.',
    tip: 'Le statut courant est affiché en haut. Tirez vers le bas pour rafraîchir.',
    image: require('../../../assets/help/supervisor/06-advance-pass.png'),
    annotations: [{ type: 'circle', x: 0.50, y: 0.82, size: 80 }],
  },
  {
    icon: '⚖️',
    title: 'Arbitrer les écarts',
    body: 'Dans "Audits & écarts", chaque article comparé entre les passes apparaît avec son statut. Pour chaque écart, saisissez la quantité finale et validez.',
    tip: "Avant d'arbitrer manuellement, faites une Passe 3 sur le terrain — c'est plus fiable.",
    image: require('../../../assets/help/supervisor/07-audits.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.45, size: 120 }],
  },
  {
    icon: '📈',
    title: 'Consulter les résultats',
    body: "L'écran Résultats agrège tout : écart en unités, écart en valeur. Exportez en Excel pour archivage ou analyse comptable.",
    image: require('../../../assets/help/supervisor/08-results.png'),
    annotations: [{ type: 'circle', x: 0.50, y: 0.47, size: 200 }],
  },
  {
    icon: '🏁',
    title: 'Clôturer la session',
    body: "Une fois l'inventaire validé, clôturez la session. ⚠️ Cette action est définitive et supprime toutes les données associées.",
    tip: "Pensez à exporter les résultats avant de clôturer — vous n'y aurez plus accès après.",
    image: require('../../../assets/help/supervisor/09-close.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.92, size: 80 }],
  },
]

// ─── Employee — 7 steps ───────────────────────────────────────────────────────
const employee: Step[] = [
  {
    icon: '🔗',
    title: 'Rejoindre une session',
    body: 'Saisissez le numéro d\'inventaire et le code de sécurité que votre superviseur vous a transmis. Appuyez sur "Rejoindre" pour entrer dans la session.',
    tip: 'Le code de sécurité est sensible à la casse — recopiez-le exactement.',
    image: require('../../../assets/help/employee/01-join.png'),
    annotations: [{ type: 'circle', x: 0.50, y: 0.42, size: 200 }],
  },
  {
    icon: '📷',
    title: 'Scanner un article',
    body: 'Pointez la caméra sur un code-barres. Le scan se déclenche automatiquement dès qu\'un code est dans le cadre.',
    tip: 'Bip aigu = article reconnu. Double bip grave = article inconnu.',
    image: require('../../../assets/help/employee/02-scanner.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.40, size: 180 }],
  },
  {
    icon: '🟢',
    title: 'Bouton de scan virtuel',
    body: 'Si le scan automatique ne se déclenche pas, le gros bouton vert force un scan immédiat. Il devient gris quand aucun code n\'est dans le cadre.',
    image: require('../../../assets/help/employee/03-virtual-button.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.72, size: 100 }],
  },
  {
    icon: '🔉',
    title: 'Bouton Volume −',
    body: 'Utilisez le bouton physique Volume − du téléphone pour déclencher un scan. Pratique pour scanner sans regarder l\'écran.',
    tip: 'Le volume est verrouillé pendant le scan — c\'est normal.',
    image: require('../../../assets/help/employee/04-volume.png'),
    annotations: [{ type: 'label', x: 0.05, y: 0.38, text: 'Vol −  ◀' }],
  },
  {
    icon: '⌨️',
    title: 'Mode Manuel',
    body: 'Si un code-barres est endommagé, basculez sur "Manuel" en haut. Tapez le SKU ou l\'EAN au clavier et appuyez sur OK pour valider.',
    image: require('../../../assets/help/employee/05-manual.png'),
    annotations: [{ type: 'circle', x: 0.50, y: 0.38, size: 150 }],
  },
  {
    icon: '❓',
    title: 'Article inconnu',
    body: 'Si le code scanné n\'est pas dans le catalogue, une fiche s\'ouvre. Saisissez les informations disponibles puis "Ajouter au comptage".',
    tip: "L'article est ajouté au catalogue de la session avec un prix d'achat à 0 €.",
    image: require('../../../assets/help/employee/06-illisible.png'),
    annotations: [{ type: 'pulse', x: 0.50, y: 0.90, size: 80 }],
  },
  {
    icon: '✏️',
    title: 'Ajuster la liste',
    body: 'La liste affiche tous vos scans. Utilisez − et + pour ajuster la quantité, ou ✕ pour supprimer une ligne.',
    tip: 'Les articles inconnus apparaissent avec un cadre orange en pointillés.',
    image: require('../../../assets/help/employee/07-edit-row.png'),
    annotations: [{ type: 'pulse', x: 0.80, y: 0.55, size: 100 }],
  },
]

export const TUTORIAL_DATA: Record<Role, Step[]> = { supervisor, employee }

export const ROLE_META: Record<Role, { name: string; icon: string; color: string }> = {
  supervisor: { name: 'Superviseur', icon: '🗂️', color: '#4F46E5' },
  employee:   { name: 'Compteur',    icon: '📷', color: '#10B981' },
}

// Theme-aware accent for each role (supervisor → accent indigo, employee → success émeraude)
export function roleColor(theme: Theme, role: Role): string {
  return role === 'supervisor' ? theme.accent : theme.success
}
