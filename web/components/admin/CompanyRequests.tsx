'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { densite } from '@/lib/tarifs'
import { type Secteur, densiteAttendue, secteurReconnu } from '@/lib/secteurs'
import { formaterSiren } from '@/lib/siren'
import { lignesProposees, referenceProposee, totalProposeCents, type Rythme } from '@/lib/devis'
import { nomOffre, prixCents } from '@/lib/offres'
import { nb } from '@/lib/format'

export type CompanyRequest = {
  id: string
  company_name: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  store_count: number
  message: string
  status: 'pending' | 'quoted' | 'accepted' | 'paid' | 'created' | 'rejected' | 'declined'
  quote_reference: string
  decline_reason?: string | null
  declined_at?: string | null
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
  /** Appareils comptant en même temps — l'assiette depuis le 2 septembre 2026. */
  devices?: number | null
  /** ⚠️ Volume de stock : ne tarife plus rien. Les demandes d'avant la bascule
      n'ont que lui, et c'est le seul cas où le recoupement de densité s'affiche. */
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
  declined: 'Déclinée par le client',
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
  const liste = (stores ?? []).filter(
    (m) => m.devices != null || m.units != null || m.sqm != null || (m.name ?? '') !== '',
  )
  if (liste.length === 0) return null

  return (
    <div className="declare">
      {liste.map((m, i) => {
        const offre = nomOffre(m.devices)
        const prix = prixCents(m.devices, 'yearly')
        // ⚠️ Le recoupement stock / surface ne s'affiche que pour les demandes
        // qui portent un volume, c'est-à-dire celles d'avant le 2 septembre
        // 2026. Il n'a plus de source sur les nouvelles, et une ligne
        // « densité non calculable » sous chacune d'elles ferait chercher un
        // défaut là où il y a une règle.
        const ancienne = m.units != null || m.sqm != null
        const d = densite(m.units, m.sqm)
        const repere = densiteAttendue(d, ape)
        return (
          <div className="declare-row" key={i}>
            <div className="declare-haut">
              <span className="declare-nom">{(m.name ?? '').trim() || `Magasin ${i + 1}`}</span>
              <span className="declare-meta">
                {m.devices == null
                  ? 'appareils non déclarés'
                  : `${nb(m.devices)} appareil${m.devices > 1 ? 's' : ''}`}
              </span>
              {offre && prix !== null && (
                <span className="declare-tranche">
                  {offre} · {(prix / 100).toLocaleString('fr-FR')} €/an
                </span>
              )}
            </div>

            {ancienne && (
              <div className="declare-bas">
                <span className="declare-meta">
                  {/* Demande d'avant la bascule : son volume ne tarife plus,
                      il ne sert qu'au recoupement d'ordre de grandeur. */}
                  {m.units == null ? 'stock non déclaré' : `${nb(m.units)} u`}
                  {m.sqm == null ? '' : ` · ${nb(m.sqm)} m²`} — {libelleDensite(d, repere)}
                </span>
                {repere && !repere.plausible && (
                  <span
                    className="declare-flag"
                    title={`Attendu entre ${repere.secteur.min} et ${repere.secteur.max} u/m² pour « ${repere.secteur.nom} »`}
                  >
                    Densité inhabituelle — vérifier qu’il ne manque pas un zéro
                  </span>
                )}
              </div>
            )}
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
/**
 * Le panneau qui établit le devis : un rythme, deux champs et un bouton.
 *
 * Le montant est **proposé** depuis la grille des offres et le nombre
 * d'appareils déclaré, et reste modifiable — un devis se négocie, et c'est la
 * ligne saisie qui part dans le PDF. La référence est proposée de façon stable
 * pour une demande donnée : rouvrir le panneau ne la change pas.
 *
 * ⚠️ **Le rythme n'est pas un détail d'affichage.** Il décide de ce qui est
 * facturé (une année ou un mois), de ce que dit le PDF, et de la session
 * Stripe que l'acceptation ouvre — paiement unique pour l'année, abonnement
 * pour le mois. Changer de rythme recalcule le montant proposé : c'est
 * volontaire, laisser un montant annuel sous un devis mensuel serait la faute
 * la plus coûteuse de cet écran.
 */
function PanneauDevis({
  requete, busy, onEnvoyer,
}: {
  requete: CompanyRequest
  busy: boolean
  onEnvoyer: (reference: string, cents: number, rythme: Rythme) => void
}) {
  const [rythme, setRythme] = useState<Rythme>('yearly')
  const lignes = lignesProposees(requete.stores, requete.store_count, rythme)
  const propose = totalProposeCents(lignes)
  const [reference, setReference] = useState(
    requete.quote_reference || referenceProposee(new Date().getFullYear(), requete.id),
  )
  // Le montant suit le rythme, sauf si l'administrateur l'a lui-même touché :
  // `touche` retient ce choix, sinon un aller-retour entre les deux boutons
  // effacerait une négociation déjà saisie.
  const [touche, setTouche] = useState(false)
  const [montant, setMontant] = useState(
    ((requete.quote_amount_cents ?? propose.cents) / 100).toFixed(2).replace('.', ','),
  )

  function changerRythme(r: Rythme) {
    setRythme(r)
    if (touche) return
    const t = totalProposeCents(lignesProposees(requete.stores, requete.store_count, r))
    setMontant((t.cents / 100).toFixed(2).replace('.', ','))
  }

  const cents = Math.round(Number(montant.replace(/\s/g, '').replace(',', '.')) * 100)
  const valide = reference.trim() !== '' && Number.isFinite(cents) && cents >= 0
  const mensuel = rythme === 'monthly'

  return (
    <div className="devis-panneau">
      <div className="devis-rythme" role="group" aria-label="Rythme de facturation">
        <button
          type="button" className={mensuel ? '' : 'actif'} aria-pressed={!mensuel}
          onClick={() => changerRythme('yearly')}
        >
          À l’année
        </button>
        <button
          type="button" className={mensuel ? 'actif' : ''} aria-pressed={mensuel}
          onClick={() => changerRythme('monthly')}
        >
          Par mois
        </button>
      </div>

      <div className="devis-panneau-lignes">
        {lignes.map((l, i) => (
          <div className="devis-panneau-ligne" key={i}>
            <span>{l.libelle}</span>
            <span className="muted">
              {l.appareils == null ? '—' : `${nb(l.appareils)} appareil${l.appareils > 1 ? 's' : ''}`}
            </span>
            <span className="muted">{l.offre || '—'}</span>
            <span className="n">{l.prixCents == null ? 'sur devis' : euros(l.prixCents)}</span>
          </div>
        ))}
        <div className="devis-panneau-ligne devis-panneau-total">
          <span>Proposition de la grille</span>
          <span />
          <span />
          <span className="n">{euros(propose.cents)}</span>
        </div>
      </div>

      {propose.surDevis > 0 && (
        <div className="muted small">
          {propose.surDevis} magasin{propose.surDevis > 1 ? 's n’ont' : ' n’a'} pas déclaré
          d&apos;appareils : leur prix se fait à la main, ils ne sont pas dans la proposition.
        </div>
      )}

      <div className="devis-panneau-champs">
        <label>
          Référence
          <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={40} />
        </label>
        <label>
          {mensuel ? 'Montant mensuel HT' : 'Montant annuel HT'}
          <input
            value={montant}
            onChange={(e) => { setTouche(true); setMontant(e.target.value) }}
            inputMode="decimal"
          />
        </label>
      </div>

      <div className="devis-panneau-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !valide}
          onClick={() => valide && onEnvoyer(reference.trim(), cents, rythme)}
        >
          {busy ? 'Envoi…' : 'Envoyer le devis'}
        </button>
        <span className="muted small">
          {mensuel
            ? 'Le PDF dit « abonnement mensuel », et l’acceptation ouvre un abonnement Stripe.'
            : 'Le PDF est fabriqué et joint à l’envoi, avec le lien d’acceptation.'}
        </span>
      </div>
    </div>
  )
}

export function CompanyRequests({ onCompanyCreated }: { onCompanyCreated: () => void }) {
  const [rows, setRows] = useState<CompanyRequest[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_company_requests')
    setRows((data as CompanyRequest[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  // Le panneau de devis n'est ouvert que sur une demande à la fois : deux
  // formulaires ouverts côte à côte, ce sont deux montants qu'on confond.
  const [devisOuvert, setDevisOuvert] = useState<string | null>(null)

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

  /**
   * Envoyer le devis : la RPC l'enregistre, l'edge fabrique le PDF et l'envoie.
   *
   * Le montant part **tel qu'il est saisi**, jamais recalculé à l'envoi : la
   * grille propose, l'administrateur dispose — un devis se négocie. Les lignes
   * partent avec lui, pour que le PDF dise d'où vient le total.
   *
   * Repli sur la RPC directe si l'edge est injoignable : le devis est alors
   * enregistré sans partir, et l'écran le dit plutôt que de laisser croire
   * qu'il est parti.
   */
  async function envoyerDevis(r: CompanyRequest, reference: string, cents: number, rythme: Rythme) {
    const lignes = lignesProposees(r.stores, r.store_count, rythme)
    setBusy(r.id)
    const { data, error } = await supabase.functions.invoke('admin-send-quote', {
      body: { requestId: r.id, reference, amountCents: cents, lines: lignes, billingPeriod: rythme },
    })
    setBusy(null)
    if (!error && data?.success) {
      setDevisOuvert(null)
      if (data.emailed === false) {
        alert(`Devis enregistré, mais l'e-mail n'a pas pu partir : ${data.error ?? 'raison inconnue'}`)
      }
      await load()
      return
    }
    if (error) {
      const ok = await run(r.id, () =>
        supabase.rpc('admin_quote_company_request', {
          p_id: r.id, p_reference: reference, p_amount_cents: cents, p_note: '', p_lines: lignes,
          p_billing_period: rythme,
        }),
      )
      if (ok) {
        alert("Devis enregistré, mais l'envoi automatique n'a pas répondu : le client n'a rien reçu.")
        setDevisOuvert(null)
      }
      return
    }
    alert('Erreur : ' + (data?.error ?? 'inconnue'))
  }

  async function setStatus(r: CompanyRequest, status: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    await run(r.id, () =>
      supabase.rpc('admin_set_company_request_status', { p_id: r.id, p_status: status, p_note: '' }),
    )
  }

  /**
   * Supprimer une demande qui n'a rien produit — refusée, déclinée, ou un
   * essai. La base refuse ce qui a créé une entreprise ou porte un paiement ;
   * l'écran ne propose le geste que sur les deux états terminaux, pour ne pas
   * faire découvrir le refus après coup.
   */
  async function supprimer(r: CompanyRequest) {
    if (!confirm(`Supprimer définitivement la demande de « ${r.company_name} » ?\n\nElle disparaîtra de la console ; le journal garde la trace.`)) return
    await run(r.id, () => supabase.rpc('admin_delete_company_request', { p_id: r.id }))
  }

  async function fulfil(r: CompanyRequest) {
    // Les noms déclarés au formulaire sont proposés tels quels : dans la
    // plupart des cas il n'y a plus qu'à valider. Le tarif de chaque magasin
    // est posé côté base depuis la ligne du devis — son offre, donc son nombre
    // d'appareils.
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
            {r.status === 'declined' && (
              <div className="muted small">
                Déclinée par le client{r.decline_reason ? ` : « ${r.decline_reason} »` : ', sans motif'}.
              </div>
            )}
            {r.message && <div className="muted small">« {r.message} »</div>}
            <MagasinsDeclares stores={r.stores} ape={r.ape} />
            {devisOuvert === r.id && (
              <PanneauDevis
                requete={r}
                busy={busy === r.id}
                onEnvoyer={(reference, cents, rythme) => envoyerDevis(r, reference, cents, rythme)}
              />
            )}
          </div>

          <div className="req-actions">
            {r.status === 'pending' && (
              <button
                className="btn btn-primary btn-sm"
                disabled={busy === r.id}
                onClick={() => setDevisOuvert(devisOuvert === r.id ? null : r.id)}
              >
                {devisOuvert === r.id ? 'Fermer' : 'Établir le devis'}
              </button>
            )}
            {r.status === 'declined' && (
              // Décliner n'est pas définitif : une seconde proposition est
              // une conversation, et elle repart d'ici.
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy === r.id}
                onClick={() => setDevisOuvert(devisOuvert === r.id ? null : r.id)}
              >
                {devisOuvert === r.id ? 'Fermer' : 'Nouveau devis'}
              </button>
            )}
            {r.status === 'quoted' && (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy === r.id}
                  onClick={() => setDevisOuvert(devisOuvert === r.id ? null : r.id)}
                >
                  {devisOuvert === r.id ? 'Fermer' : 'Renvoyer le devis'}
                </button>
                {/* Le client accepte en ligne ; ce lien est le secours, pour
                    un accord reçu par un autre canal. */}
                <button className="link-btn" disabled={busy === r.id} onClick={() => setStatus(r, 'accepted')}>
                  Marquer accepté
                </button>
              </>
            )}
            {r.status === 'accepted' && (
              // Le paiement passe par Stripe, qui crée tout seul. Ce bouton
              // est le secours — un virement hors Stripe — et il le dit.
              <button className="link-btn" disabled={busy === r.id}
                onClick={() => setStatus(r, 'paid', 'Marquer ce devis comme réglé hors Stripe ?\n\nÀ n’utiliser que pour un paiement reçu par un autre canal. La création restera à faire à la main.')}>
                Réglé hors Stripe
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
            {(r.status === 'rejected' || r.status === 'declined') && (
              <button className="link-btn" disabled={busy === r.id} onClick={() => supprimer(r)}>
                Supprimer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
