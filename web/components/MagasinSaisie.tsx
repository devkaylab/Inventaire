'use client'

// La carte « un magasin » — nom, stock théorique, surface, et la tranche
// tarifaire qui s'affiche à la frappe.
//
// Elle est née sur /inscription, où le prospect déclare ses magasins. Elle sert
// aussi à l'administrateur d'entreprise qui demande l'ajout d'un magasin : dans
// les deux cas on demande la même chose, pour la même raison — la licence se
// tarife au volume de stock, donc une demande sans stock est une demande que
// Quantinvo ne peut pas deviser.
//
// Une seule définition, donc. Les deux écrans ne doivent pas se mettre à
// diverger sur les libellés, les unités ou la tranche affichée.

import { trancheDe } from '@/lib/tarifs'

export type SaisieMagasin = { nom: string; stock: string; surface: string }

/** Une saisie libre (« 180 000 », « 1 200,5 ») ramenée à un nombre. */
export function nombreOuNull(saisie: string): number | null {
  const n = Number.parseFloat(saisie.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const euros = (v: number) => v.toLocaleString('fr-FR') + ' €'

export function MagasinSaisie({
  numero, valeur, onChange, onRetirer, idPrefix,
}: {
  /** Rang affiché dans la pastille. Une demande n'en porte qu'un : 1. */
  numero: number
  valeur: SaisieMagasin
  onChange: (champ: keyof SaisieMagasin, v: string) => void
  /** Absent = pas de croix : on ne retire pas la seule ligne d'un formulaire. */
  onRetirer?: () => void
  /** Préfixe d'identifiant, dérivé d'un useId() : les libellés doivent viser
      le bon champ quand la carte est répétée. */
  idPrefix: string
}) {
  const tranche = trancheDe(nombreOuNull(valeur.stock))

  return (
    <div className="magasin">
      <div className="magasin-top">
        <span className="magasin-no">{numero}</span>
        <input
          value={valeur.nom}
          onChange={(e) => onChange('nom', e.target.value)}
          placeholder="Nom du magasin — Lyon Part-Dieu"
          aria-label={`Nom du magasin ${numero}`}
          maxLength={80}
        />
        {onRetirer && (
          <button
            type="button"
            className="magasin-kill"
            onClick={onRetirer}
            aria-label={`Retirer le magasin ${numero}`}
          >
            ×
          </button>
        )}
      </div>

      <div className="field-duo">
        <div className="field">
          <label htmlFor={`${idPrefix}-stock`}>Stock théorique</label>
          <input
            id={`${idPrefix}-stock`}
            type="number"
            min={0}
            step={1000}
            value={valeur.stock}
            onChange={(e) => onChange('stock', e.target.value)}
            placeholder="180 000"
          />
          <p className="field-hint">En pièces, toutes marques confondues.</p>
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-surface`}>Surface de vente</label>
          <input
            id={`${idPrefix}-surface`}
            type="number"
            min={0}
            step={10}
            value={valeur.surface}
            onChange={(e) => onChange('surface', e.target.value)}
            placeholder="1 200"
          />
          <p className="field-hint">En m², réserve comprise.</p>
        </div>
      </div>

      <div className="magasin-tranche">
        {tranche ? (
          <>
            <span className="magasin-tranche-nom">
              <b>{tranche.profil}</b> — {tranche.bornes}
            </span>
            <span className="magasin-tranche-prix">
              {tranche.prixEuros === null ? 'Sur devis' : `${euros(tranche.prixEuros)} / an`}
            </span>
          </>
        ) : (
          <span className="magasin-tranche-vide">Indiquez le stock pour voir la tranche</span>
        )}
      </div>
    </div>
  )
}
