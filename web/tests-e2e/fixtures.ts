// Jeu de données calqué sur l'inventaire réel INV-20260807-C255 de la base de
// démonstration : 10 balises, deux personnes, un écart de quantité, un article
// audité jamais compté. C'est ce dernier cas qui a motivé la migration
// 20260812000001 — il doit rester visible dans les tests.

export const SESSION_ID = 'a387bef9-f713-4221-b0b7-614f72f75de3'
export const SUPERVISOR_ID = '849fab7c-0a3b-457d-b541-1b78d2686310'
export const COUNTER_ID = 'c924bcd8-6631-4000-a741-8da8c0aba685'

export const PROFILE = {
  id: SUPERVISOR_ID,
  full_name: 'Compte Test Sup',
  role: 'supervisor',
  is_admin: false,
  company_id: 'company-1',
}

export const SESSION = {
  id: SESSION_ID,
  inventory_number: 'INV-20260807-C255',
  name: 'Test',
  store_name: 'Oberlin Lyon',
  store_id: 'store-1',
  status: 'open',
  current_pass: 1,
  uses_zones: true,
  created_by: SUPERVISOR_ID,
  created_at: '2026-08-07T16:29:55.874801Z',
  closed_at: null,
  security_code: 'K7QP2M',
}

const zone = (code: string, count: string, audit: string) => ({
  id: `zone-${code}`,
  code,
  name: 'Surface de vente',
  count_status: count,
  audit_status: audit,
  count_units: count === 'done' ? 4 : 0,
  count_lines: count === 'done' ? 3 : 0,
  audit_units: audit === 'done' ? 2 : 0,
  audit_lines: audit === 'done' ? 2 : 0,
})

export const ZONES = [
  zone('5371', 'done', 'done'),
  zone('5372', 'done', 'done'),
  zone('5373', 'done', 'pending'),
  zone('5374', 'pending', 'pending'),
  zone('5375', 'pending', 'pending'),
  zone('5376', 'open', 'pending'),
  zone('5377', 'pending', 'pending'),
  zone('5378', 'pending', 'pending'),
  zone('5379', 'pending', 'pending'),
  zone('5380', 'pending', 'pending'),
]

export const MEMBERS = [
  {
    user_id: SUPERVISOR_ID, role: 'supervisor', joined_at: '2026-08-07T16:29:55Z',
    profiles: { full_name: 'Compte Test Sup', role: 'supervisor' },
  },
  {
    user_id: COUNTER_ID, role: 'counter', joined_at: '2026-08-07T16:40:00Z',
    profiles: { full_name: 'Compte Test Compteur', role: 'employee' },
  },
]

export function recentCounts(now = Date.now()) {
  return [
    { id: 'c1', counted_by: SUPERVISOR_ID, zone: '5372', pass_number: 2, qty: 1, sku: 'GHI9123', created_at: new Date(now - 2 * 60_000).toISOString() },
    { id: 'c2', counted_by: COUNTER_ID, zone: '5373', pass_number: 1, qty: 1, sku: 'ABC1244', created_at: new Date(now - 5 * 60_000).toISOString() },
    { id: 'c3', counted_by: COUNTER_ID, zone: '5372', pass_number: 1, qty: -1, sku: 'ABC1236', created_at: new Date(now - 8 * 60_000).toISOString() },
  ]
}

export const COUNTS_TOTALS = [
  { qty: 4, pass_number: 1, sku: 'ABC1234' },
  { qty: 4, pass_number: 1, sku: 'DEF5678' },
  { qty: 1, pass_number: 1, sku: 'GHI9123' },
  { qty: 1, pass_number: 2, sku: 'ABC1234' },
  { qty: 1, pass_number: 2, sku: 'DEF5678' },
  { qty: 1, pass_number: 2, sku: 'GHI9123' },
]

/**
 * Totaux tels que la base les calcule désormais (RPC `get_session_count_totals`).
 *
 * Dérivés des lignes ci-dessus plutôt que recopiés : le jour où quelqu'un
 * ajoute un scan au jeu d'essai, les totaux suivent — c'est ce qui empêche le
 * harnais de valider un affichage faux.
 */
export function countTotals() {
  const unites = (pass: number) =>
    COUNTS_TOTALS.filter(c => c.pass_number === pass).reduce((n, c) => n + c.qty, 0)
  const refs = (pass: number) =>
    new Set(COUNTS_TOTALS.filter(c => c.pass_number === pass).map(c => c.sku)).size
  return {
    counted: unites(1),
    audited: unites(2),
    counted_skus: refs(1),
    audited_skus: refs(2),
  }
}

export const AUDITS = [
  { id: 'a1', session_id: SESSION_ID, sku: 'ABC1234', zone: '5371', qty_pass1: 4, qty_pass2: 1, qty_pass3: null, final_qty: null, status: 'failed', resolved_by: null, updated_at: '2026-08-07T18:07:18Z' },
  { id: 'a2', session_id: SESSION_ID, sku: 'DEF5678', zone: '5371', qty_pass1: 4, qty_pass2: 1, qty_pass3: null, final_qty: null, status: 'failed', resolved_by: null, updated_at: '2026-08-07T18:07:18Z' },
  // Article trouvé par l'auditeur et jamais compté : le cas que l'ancienne
  // version de get_session_detail faisait disparaître.
  { id: 'a3', session_id: SESSION_ID, sku: 'GHI9123', zone: '5372', qty_pass1: null, qty_pass2: 1, qty_pass3: null, final_qty: null, status: 'pending', resolved_by: null, updated_at: '2026-08-07T18:07:18Z' },
  // Déjà arbitré : doit apparaître dans l'historique, pas dans les écarts.
  { id: 'a4', session_id: SESSION_ID, sku: 'ABC1235', zone: '5372', qty_pass1: 2, qty_pass2: 1, qty_pass3: null, final_qty: 2, status: 'resolved', resolved_by: SUPERVISOR_ID, updated_at: '2026-08-08T09:00:00Z' },
]

export const ARTICLES = [
  { sku: 'ABC1234', label: 'Tee-shirt coton', brand: 'Nike', ean: '3701000000011', unit_purchase_price: 12.5 },
  { sku: 'DEF5678', label: 'Pantalon chino', brand: 'Levis', ean: '3701000000028', unit_purchase_price: 30 },
  { sku: 'GHI9123', label: 'Casquette', brand: 'Nike', ean: '3701000000035', unit_purchase_price: 8 },
  { sku: 'ABC1235', label: 'Sweat capuche', brand: 'Nike', ean: '3701000000042', unit_purchase_price: 45 },
]

export const RESULTS = [
  { sku: 'ABC1234', ean: '3701000000011', brand: 'Nike', label: 'Tee-shirt coton', unit_purchase_price: 12.5, theoretical_qty: 5, counted_qty: 1, status: 'failed', variance_units: -4, variance_value: -50 },
  { sku: 'DEF5678', ean: '3701000000028', brand: 'Levis', label: 'Pantalon chino', unit_purchase_price: 30, theoretical_qty: 4, counted_qty: 1, status: 'failed', variance_units: -3, variance_value: -90 },
  { sku: 'GHI9123', ean: '3701000000035', brand: 'Nike', label: 'Casquette', unit_purchase_price: 8, theoretical_qty: 1, counted_qty: 1, status: 'pending', variance_units: 0, variance_value: 0 },
  { sku: 'ABC1235', ean: '3701000000042', brand: 'Nike', label: 'Sweat capuche', unit_purchase_price: 45, theoretical_qty: 2, counted_qty: 2, status: 'resolved', variance_units: 0, variance_value: 0 },
]

export const DETAIL = [
  { sku: 'ABC1234', ean: '3701000000011', brand: 'Nike', label: 'Tee-shirt coton', zone: '5371', zone_name: 'Surface de vente', counted_qty: 4, counted_by: 'Compte Test Compteur', audited: true, audited_qty: 1, audited_by: 'Compte Test Sup' },
  { sku: 'GHI9123', ean: '3701000000035', brand: 'Nike', label: 'Casquette', zone: '5372', zone_name: 'Surface de vente', counted_qty: 0, counted_by: null, audited: true, audited_qty: 1, audited_by: 'Compte Test Sup' },
]

/* Le rapport paginé (3 septembre 2026).
   ⚠️ Le faux serveur refait le vrai travail — recherche, tri, tranche, total
   de la sélection porté par chaque ligne. Un mock qui rendrait toujours les
   quatre lignes laisserait passer un écran qui ne pagine pas. */
export function rapportResume() {
  return {
    lignes: RESULTS.length,
    theorique: RESULTS.reduce((s, r) => s + r.theoretical_qty, 0),
    compte: RESULTS.reduce((s, r) => s + r.counted_qty, 0),
    ecart_unites: RESULTS.reduce((s, r) => s + r.variance_units, 0),
    ecart_valeur: RESULTS.reduce((s, r) => s + r.variance_value, 0),
    non_arbitres: RESULTS.filter(r => r.status === 'failed').length,
  }
}

type Cle = keyof (typeof RESULTS)[number]

export function rapportPage(body: Record<string, unknown>) {
  const q = String(body.p_recherche ?? '').trim().toLowerCase()
  const tri = String(body.p_tri ?? 'variance_value') as Cle
  const sens = String(body.p_sens ?? 'desc') === 'desc' ? -1 : 1
  const off = Number(body.p_offset ?? 0)
  const lim = Number(body.p_limite ?? 50)

  const filtre = q === ''
    ? RESULTS
    : RESULTS.filter(r =>
      r.sku.toLowerCase().includes(q) || (r.ean ?? '').toLowerCase().includes(q)
      || r.label.toLowerCase().includes(q) || r.brand.toLowerCase().includes(q))

  const trie = [...filtre].sort((a, b) => {
    const va = a[tri], vb = b[tri]
    const c = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'fr')
    // Le sku départage, comme en base : sans ordre total, une page peut
    // répéter une ligne et en sauter une autre.
    return (sens * c) || a.sku.localeCompare(b.sku)
  })

  return trie.slice(off, off + lim).map(r => ({ ...r, total: filtre.length }))
}

export function rapportDetailPage(body: Record<string, unknown>) {
  const off = Number(body.p_offset ?? 0)
  const lim = Number(body.p_limite ?? 5000)
  return DETAIL.slice(off, off + lim).map(r => ({ ...r, total: DETAIL.length }))
}

export const STORES = [
  { id: 'store-1', name: 'Oberlin Lyon' },
  { id: 'store-2', name: 'Magasin centre-ville' },
]

export const IMPORT_STATE = { articles: 21, stock: 21 }

/* Le tableau de bord d'atterrissage (30 août 2026) — les agrégats que rend
   `tableau_de_bord_superviseur`, cohérents avec RESULTS : l'écart de la
   session de test vaut -140 € / -7 pièces, comme la somme du rapport. */
export const TABLEAU_DE_BORD = {
  pieces_mois: 5, pieces_mois_prec: 0,
  valeur_mois: 192.5, valeur_mois_prec: 0,
  clotures_mois: 0, clotures_mois_prec: 1,
  semaine_debut: '2026-08-24',
  par_jour: [
    { jour: '2026-08-24', pieces: 2, valeur: 25 },
    { jour: '2026-08-25', pieces: 0, valeur: 0 },
    { jour: '2026-08-26', pieces: 3, valeur: 167.5 },
    { jour: '2026-08-27', pieces: 0, valeur: 0 },
    { jour: '2026-08-28', pieces: 0, valeur: 0 },
    { jour: '2026-08-29', pieces: 0, valeur: 0 },
    { jour: '2026-08-30', pieces: 0, valeur: 0 },
  ],
  ecarts: [
    { session_id: 'session-1', nom: 'Inventaire de test', magasin: 'Oberlin Lyon', statut: 'counting', ecart_qte: -7, ecart_valeur: -140 },
  ],
  derniers: [
    { session_id: 'session-1', nom: 'Inventaire de test', magasin: 'Oberlin Lyon', numero: 'INV-20260823-TEST', statut: 'counting', cree_le: '2026-08-23T18:29:30Z', pieces: 5, valeur: 192.5 },
  ],
}

export const EQUIPE = {
  stores: [
    {
      id: 'store-1', name: 'Oberlin Lyon',
      counters: [
        { id: 'cnt-1', full_name: 'Compte Test Compteur', email: 'compteur@test.fr', is_active: true, sessions_counted: 2, last_count_at: '2026-08-29T10:00:00Z' },
        { id: 'cnt-2', full_name: 'Nadia Test', email: 'nadia@test.fr', is_active: false, sessions_counted: 0, last_count_at: null },
      ],
    },
  ],
  invitations: [],
}
