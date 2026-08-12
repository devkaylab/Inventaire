import type { ImageSourcePropType } from 'react-native'
import type { Theme } from '@/constants/ink'

export type Role = 'supervisor' | 'employee'

export interface Step {
  icon: string
  title: string
  body: string
  tip?: string
  image: ImageSourcePropType
}

// ─── Supervisor — 8 steps ─────────────────────────────────────────────────────
const supervisor: Step[] = [
  {
    icon: '🗂️',
    title: 'Voir mes sessions',
    body: "À l'ouverture, vous voyez la liste de vos sessions d'inventaire en cours et passées. Chaque carte affiche le magasin, le numéro d'inventaire, le statut et la date.",
    tip: "Le bouton ➕ en bas ouvre la création d'une nouvelle session.",
    image: require('../../../assets/help/supervisor/01-sessions.png'),
  },
  {
    icon: '➕',
    title: 'Créer une session',
    body: "Saisissez le nom du magasin. Un code de sécurité aléatoire est généré — vous pouvez en demander un nouveau. Ce code servira aux compteurs à rejoindre la session.",
    tip: "Notez bien le code de sécurité : il sera demandé à chaque compteur.",
    image: require('../../../assets/help/supervisor/02-new-session.png'),
  },
  {
    icon: '📦',
    title: 'Importer les fichiers',
    body: "Juste après la création, l'app vous propose d'importer les fichiers — les deux imports sont sur le même écran. 1) Le référentiel articles : CSV ou Excel avec les colonnes SKU, EAN (optionnel), Marque, Libellé article et, en option, Prix d'achat. 2) Le stock théorique (SKU, EAN, Quantité théorique), qui sert à calculer les écarts.",
    tip: "Importez le catalogue AVANT le stock : un stock sans article correspondant est ignoré. Sans colonne Prix d'achat, l'écart en valeur sera de 0.",
    image: require('../../../assets/help/supervisor/03-import.png'),
  },
  {
    icon: '🔑',
    title: 'Partager les identifiants',
    body: 'Sur la page session, le numéro d\'inventaire et le code de sécurité sont affichés. Appuyez sur "Copier" pour envoyer ces informations à vos compteurs.',
    tip: 'Le numéro d\'inventaire est unique et reste valide tant que la session est ouverte.',
    image: require('../../../assets/help/supervisor/04-credentials.png'),
  },
  {
    icon: '🔵',
    title: 'Lancer les passes',
    body: 'La session démarre en Passe 1 (Compte). Quand les compteurs ont fini, appuyez sur "Passer en Audit" pour lancer la Passe 2.',
    tip: 'Le statut courant est affiché en haut. Tirez vers le bas pour rafraîchir.',
    image: require('../../../assets/help/supervisor/05-advance-pass.png'),
  },
  {
    icon: '⚖️',
    title: 'Arbitrer les écarts',
    body: 'Dans "Audits & écarts", chaque article apparaît avec son statut. Vous pouvez corriger la quantité comptée de n\'importe quelle ligne et appuyer sur "Enregistrer", ou supprimer une ligne erronée avec 🗑.',
    tip: "Avant de corriger manuellement, faites une Passe 3 (arbitrage) sur le terrain — c'est plus fiable.",
    image: require('../../../assets/help/supervisor/06-audits.png'),
  },
  {
    icon: '📈',
    title: 'Consulter les résultats',
    body: "L'écran Résultats agrège tout : écart en unités, écart en valeur. Exportez en Excel pour archivage ou analyse comptable.",
    image: require('../../../assets/help/supervisor/07-results.png'),
  },
  {
    icon: '🏁',
    title: 'Clôturer la session',
    body: "Une fois l'inventaire validé, appuyez sur « Clôturer l'inventaire ». Le comptage s'arrête pour tout le monde, y compris sur les téléphones encore ouverts sur la session. Toutes les données sont conservées et le rapport reste disponible.",
    tip: "Vous pouvez rouvrir un inventaire clôturé si un comptage a été oublié. « Supprimer définitivement » est une action distincte, et celle-là est irréversible.",
    image: require('../../../assets/help/supervisor/08-close.png'),
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
  },
  {
    icon: '📷',
    title: 'Scanner un article',
    body: 'Pointez la caméra sur un code-barres. Le scan se déclenche automatiquement dès qu\'un code est dans le cadre.',
    tip: 'Bip aigu = article reconnu. Double bip grave = article inconnu.',
    image: require('../../../assets/help/employee/02-scanner.png'),
  },
  {
    icon: '🟢',
    title: 'Bouton de scan virtuel',
    body: 'Si le scan automatique ne se déclenche pas, le gros bouton vert force un scan immédiat. Il devient gris quand aucun code n\'est dans le cadre.',
    image: require('../../../assets/help/employee/03-virtual-button.png'),
  },
  {
    icon: '⌨️',
    title: 'Mode Manuel',
    body: 'Si un code-barres est endommagé, basculez sur "Manuel" en haut. Tapez le SKU ou l\'EAN au clavier et appuyez sur OK pour valider.',
    image: require('../../../assets/help/employee/04-manual.png'),
  },
  {
    icon: '❓',
    title: 'Article inconnu',
    body: 'Si le code scanné n\'est pas dans le catalogue, une fiche s\'ouvre. Saisissez les informations disponibles puis "Ajouter au comptage".',
    tip: "L'article est ajouté au catalogue de la session avec un prix d'achat à 0 €.",
    image: require('../../../assets/help/employee/05-illisible.png'),
  },
  {
    icon: '✏️',
    title: 'Ajuster la liste',
    body: 'La liste affiche tous vos scans. Utilisez − et + pour ajuster la quantité, ou ✕ pour supprimer une ligne.',
    tip: 'Les articles inconnus apparaissent avec un cadre orange en pointillés.',
    image: require('../../../assets/help/employee/06-edit-row.png'),
  },
  {
    icon: '🔄',
    title: "Changer d'étape",
    body: "Quand le comptage de l'étape est terminé, appuyez sur « Passer en … » en bas pour avancer (ex. passer en Audit). Vous pouvez aussi revenir à l'étape précédente avec « Revenir en … » en haut.",
    tip: "En revenant en arrière, vous choisissez de conserver ou de supprimer les comptages de l'étape quittée.",
    image: require('../../../assets/help/employee/07-passes.png'),
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
