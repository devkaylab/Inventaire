'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { densite, trancheDe } from '@/lib/tarifs'
import { type Secteur, densiteAttendue, secteurReconnu } from '@/lib/secteurs'
import { formaterSiren } from '@/lib/siren'

export type CompanyRequest = {
  id: string
  company_name: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  store_count: number
  message: string
  status: 'pending' | 'quoted' | 'accepted' | 'paid' | 'created' | 'rejected'
  quote_reference: string
  quote_amount_cents: number | null
  admin_note: string
  company_id: string | null
  created_at: string
  siren: string | null
  stores: MagasinDeclare[] | null
  ape: string | null
}

/** Ce que le prospect a déclaré, magasin par magasin, sur /inscription. */
export type MagasinDeclare = {
  name: string | null
  units: number | null
  sqm: number | null
}

const STATUS_LABEL: Record<CompanyRequest['status'], string> = {
  pending: 'À traiter',
  quoted: 'Devis envoyé',
  accepted: 'Devis accepté',
  paid: 'Facture encaissée',
  created: 'Entreprise créée',
  rejected: 'Refusée',
}

function euros(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

/**
 * Magasins déclarés au formulaire, avec le recoupement stock / surface.
 *
 * Le repère de cohérence n'existe **que** dans cette console. Sur le formulaire
 * public il reviendrait à soupçonner le prospect avant même le devis, et
 * surtout à lui indiquer quel chiffre ajuster pour changer de tranche.
 *
 * **Ce n'est pas un détecteur de mensonge, et il ne faut pas le lire ainsi.**
 * Le stock et la surface sont déclarés par la même personne : deux
 * déclarations ne se contrôlent pas l'une l'autre. Ce que le repère attrape,
 * c'est l'erreur d'ordre de grandeur — un zéro oublié, une saisie en milliers.
 * C'est fréquent, et le rattraper avant le devis évite une correction gênante.
 *
 * La fourchette vient du secteur d'activité, tiré du code APE rendu par le
 * registre (`web/lib/secteurs.ts`). Une fourchette unique ne servait à rien :
 * assez large pour couvrir meubles et pharmacie, elle laissait passer trois
 * tranches tarifaires d'écart.
 *
 * **Chaque ligne dit contre quoi elle a été comparée**, et le dit même quand
 * tout va bien. Avant, le silence recouvrait deux situations opposées : « la
 * densité a été comparée à la bonne fourchette et elle tient » et « aucun
 * secteur n'est connu, donc rien n'a été vérifié ». Prendre la seconde pour la
 * première, c'est exactement le piège qu'on venait de refermer en retirant le
 * libellé « Cohérent ». Seul l'avertissement reste conditionnel : un écran
 * d'administration qui crie tout le temps ne se lit plus.
 */
/**
 * Ce qui s'écrit sous chaque magasin à propos de la densité.
 *
 * Quatre cas, et il faut les distinguer : la densité mesurée et comparée à un
 * secteur connu ; la densité mesurée mais sans secteur pour la juger ; la
 * surface manquante, qui rend le calcul impossible ; et le stock manquant.
 * Les trois derniers signifient **rien n'a été vérifié**, et doivent le dire.
 */
function libelleDensite(
  d: number | null,
  repere: { secteur: Secteur; plausible: boolean } | null,
): string {
  if (d === null || repere === null) {
    return 'densité non calculable — stock ou surface manquant'
  }
  const mesure = `${Math.round(d)} u/m²`
  return secteurReconnu(repere.secteur)
    ? `${mesure} — ${repere.secteur.nom}`
    : `${mesure} — secteur inconnu, densité non vérifiée`
}

function MagasinsDeclares({ stores, ape }: { stores: MagasinDeclare[] | null; ape: string | null }) {
  const liste = (stores ?? []).filter((m) => m.units != null || m.sqm != null || (m.name ?? '') !== '')
  if (liste.length === 0) return null

  return (
    <div className="declare">
      {liste.map((m, i) => {
        const tranche = trancheDe(m.units)
        const d = densite(m.units, m.sqm)
        const repere = densiteAttendue(d, ape)
        return (
          <div className="declare-row" key={i}>
            <div className="declare-haut">
              <span className="declare-nom">{(m.name ?? '').trim() || `Magasin ${i + 1}`}</span>
              <span className="declare-meta">
                {m.units == null ? 'stock non déclaré' : `${m.units.toLocaleString('fr-FR')} u`}
                {m.sqm == null ? '' : ` · ${m.sqm.toLocaleString('fr-FR')} m²`}
              </span>
              {tranche && (
                <span className="declare-tranche">
                  {tranche.profil}
                  {tranche.prixEuros === null
                    ? ' · sur devis'
                    : ` · ${tranche.prixEuros.toLocaleString('fr-FR')} €/an`}
                </span>
              )}
            </div>

            <div className="declare-bas">
              <span className="declare-meta">{libelleDensite(d, repere)}</span>
              {repere && !repere.plausible && (
                <span
                  className="declare-flag"
                  title={`Attendu entre ${repere.secteur.min} et ${repere.secteur.max} u/m² pour « ${repere.secteur.nom} »`}
                >
                  Densité inhabituelle — vérifier qu’il ne manque pas un zéro
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Traitement des demandes d'inscription d'entreprise.
 *
 * L'ordre des étapes est imposé par la base (`admin_set_company_request_status`
 * refuse les transitions hors séquence) : on ne peut pas encaisser un devis qui
 * n'a pas été accepté, ni créer l'entreprise avant encaissement. Cet écran ne
 * fait donc qu'exposer l'action suivante, jamais un choix libre.
 */
export function CompanyRequests({ onCompanyCreated }: { onCompanyCreated: () => void }) {
  const [rows, setRows] = useState<CompanyRequest[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_company_requests')
    setRows((data as CompanyRequest[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  // `supabase.rpc` renvoie un builder « thenable », pas une vraie Promise :
  // on le type en PromiseLike pour pouvoir l'attendre sans le dénaturer.
  type RpcResult = { error: { message?: string } | null; data: { success?: boolean; error?: string } | null }

  async function run(id: string, fn: () => PromiseLike<RpcResult>) {
    setBusy(id)
    const { error, data } = await fn()
    setBusy(null)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return false
    }
    await load()
    return true
  }

  async function quote(r: CompanyRequest) {
    const reference = prompt(`Référence du devis pour « ${r.company_name} » :`, r.quote_reference || '')
    if (reference === null) return
    const amount = prompt('Montant TTC en euros :', r.quote_amount_cents ? String(r.quote_amount_cents / 100) : '')
    if (amount === null) return
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 0) { alert('Montant invalide.'); return }
    await run(r.id, () =>
      supabase.rpc('admin_quote_company_request', {
        p_id: r.id, p_reference: reference, p_amount_cents: cents, p_note: '',
      }),
    )
  }

  async function setStatus(r: CompanyRequest, status: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    await run(r.id, () =>
      supabase.rpc('admin_set_company_request_status', { p_id: r.id, p_status: status, p_note: '' }),
    )
  }

  async function fulfil(r: CompanyRequest) {
    // Les noms déclarés au formulaire sont proposés tels quels : dans la
    // plupart des cas il n'y a plus qu'à valider. Le tarif de chaque magasin
    // est posé côté base depuis la tranche de son volume déclaré.
    const proposes = (r.stores ?? [])
      .map((m) => (m.name ?? '').trim())
      .filter(Boolean)
      .join(', ')
    const raw = prompt(
      `Créer « ${r.company_name} » et ses ${r.store_count} magasin(s).\n\n` +
        'Noms des magasins, séparés par une virgule (laissez vide pour « Magasin 1 », « Magasin 2 »…) :',
      proposes,
    )
    if (raw === null) return
    const names = raw.split(',').map((s) => s.trim()).filter(Boolean)

    setBusy(r.id)
    const { data, error } = await supabase.rpc('admin_fulfil_company_request', {
      p_id: r.id,
      p_store_names: names.length > 0 ? names : null,
    })
    setBusy(null)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return
    }
    const stores = (data.stores as { name: string; join_code: string; annual_price_cents: number | null }[]) ?? []
    alert(
      `Entreprise créée.\n\nCode entreprise : ${data.company_code}\n\n` +
        stores
          .map(
            (s) =>
              `${s.name} : ${s.join_code}` +
              (s.annual_price_cents == null ? ' (tarif à saisir)' : ` — ${euros(s.annual_price_cents)}/an`),
          )
          .join('\n') +
        '\n\nTransmettez les codes magasin à l’administrateur de l’entreprise : chaque demande de superviseur devra être accompagnée du code de son magasin.',
    )
    await load()
    onCompanyCreated()
  }

  if (rows.length === 0) {
    return <p className="muted">Aucune demande d&apos;inscription d&apos;entreprise.</p>
  }

  return (
    <div className="req-list">
      {rows.map((r) => (
        <div className="req-row req-row-block" key={r.id}>
          <div>
            <div className="req-name">
              {r.company_name} <span className="pill">{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="muted small">
              {r.contact_first_name} {r.contact_last_name} · {r.contact_email}
              {r.contact_phone ? ` · ${r.contact_phone}` : ''} · {r.store_count} magasin{r.store_count > 1 ? 's' : ''}
            </div>
            {r.siren && (
              <div className="muted small">
                SIREN {formaterSiren(r.siren)} —{' '}
                <a
                  href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${r.siren}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  voir au registre
                </a>
              </div>
            )}
            {r.quote_reference && (
              <div className="muted small">Devis {r.quote_reference} — {euros(r.quote_amount_cents)}</div>
            )}
            {r.message && <div className="muted small">« {r.message} »</div>}
            <MagasinsDeclares stores={r.stores} ape={r.ape} />
          </div>

          <div className="req-actions">
            {r.status === 'pending' && (
              <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => quote(r)}>
                Émettre un devis
              </button>
            )}
            {r.status === 'quoted' && (
              <>
                <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => quote(r)}>
                  Modifier le devis
                </button>
                <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => setStatus(r, 'accepted')}>
                  Devis accepté
                </button>
              </>
            )}
            {r.status === 'accepted' && (
              <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => setStatus(r, 'paid')}>
                Facture encaissée
              </button>
            )}
            {r.status === 'paid' && (
              <button className="btn btn-success btn-sm" disabled={busy === r.id} onClick={() => fulfil(r)}>
                Créer l&apos;entreprise et les magasins
              </button>
            )}
            {r.status !== 'created' && r.status !== 'rejected' && (
              <button
                className="btn btn-danger btn-sm"
                disabled={busy === r.id}
                onClick={() => setStatus(r, 'rejected', `Refuser la demande de « ${r.company_name} » ?`)}
              >
                Refuser
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
